/**
 * Seeds reference data and restores catalog content captured by
 * backup-content.js before the baseline migration.
 *
 *   node packages/database/prisma/seed.js
 *
 * Safe to re-run: every write is an upsert keyed on a natural key.
 */
const path = require('path');

// Loaded explicitly rather than relying on Prisma to discover .env, which
// depends on the working directory the script happens to be run from.
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const prisma = new PrismaClient();

// Packaging lives in a table now, so this list is a starting point rather than
// a fixed set — the catalog manager adds to it from the admin console.
const PACKAGING_OPTIONS = [
  { code: 'GLASS_JAR', label: 'Glass Jar', displayOrder: 1 },
  { code: 'METAL_DOLCHI', label: 'Traditional Metal Dolchi', displayOrder: 2 },
  { code: 'FOOD_GRADE_TIN', label: 'Food Grade Tin', displayOrder: 3 },
  { code: 'PET_BOTTLE', label: 'PET Bottle', displayOrder: 4 },
  { code: 'ECO_POUCH', label: 'Eco Pouch', displayOrder: 5 },
  { code: 'AMBER_GLASS_BOTTLE', label: 'Amber Glass Bottle', displayOrder: 6 },
  { code: 'SQUEEZE_BOTTLE', label: 'Squeeze Bottle', displayOrder: 7 },
];

const FEATURE_FLAGS = [
  { key: 'ENABLE_CART', description: 'Storefront shopping cart' },
  { key: 'ENABLE_USER_ACCOUNTS', description: 'Customer accounts and login' },
  { key: 'ENABLE_WEBSITE_PAYMENT', description: 'Online payment at checkout' },
  { key: 'ENABLE_SUBSCRIPTIONS', description: 'Recurring subscription orders' },
  { key: 'ENABLE_PRODUCT_RATINGS', description: 'Customer ratings and reviews' },
  { key: 'ENABLE_WALLET', description: 'Customer wallet balance and subscription auto-debit' },
  { key: 'ENABLE_OTP_LOGIN', description: 'Phone OTP sign-in (needs an SMS provider)' },
  // Off. Mobile OTP is how customers sign in; this exists so the older form
  // can be switched back on for the accounts that predate it, not as a path
  // anyone new should take. Staff are unaffected — the console uses
  // /auth/admin/login, which is deliberately a separate route.
  { key: 'ENABLE_EMAIL_LOGIN', description: 'Email and password sign-in (legacy accounts)' },
  { key: 'ENABLE_GOOGLE_LOGIN', description: 'Google sign-in (needs GOOGLE_CLIENT_ID)' },
  // Declared in code since the integration was written, but never given rows —
  // so the console had no switch for them and the storefront could not read
  // them. Off, and off is also what an unknown flag reads as, so nothing here
  // turns anything on.
  {
    key: 'ENABLE_SHIPROCKET_CHECKOUT',
    description: 'Hand checkout to Shiprocket (needs SHIPROCKET_API_KEY and SECRET)',
  },
  {
    key: 'ENABLE_CASHFREE_CHECKOUT',
    description: 'Take payment through Cashfree One Click Checkout (needs CASHFREE_CLIENT_ID and SECRET)',
  },
  {
    key: 'ENABLE_SHIPROCKET_OUR_COUPONS',
    description: 'Validate coupons against our own table rather than Shiprocket\'s dashboard',
  },
];

// GST and HSN differ per product line, which is exactly why they sit on the
// product rather than in a shared constant.
const TAX_DEFAULTS = [
  { match: /ghee/i, hsnCode: '0405', gstRate: 12.0 },
  { match: /milk|curd|paneer/i, hsnCode: '0401', gstRate: 0.0 },
  { match: /honey/i, hsnCode: '0409', gstRate: 5.0 },
  { match: /oil/i, hsnCode: '1515', gstRate: 5.0 },
];

function taxFor(title) {
  const hit = TAX_DEFAULTS.find((t) => t.match.test(title));
  return hit ? { hsnCode: hit.hsnCode, gstRate: hit.gstRate } : { hsnCode: null, gstRate: 0.0 };
}

async function seedPackaging() {
  for (const opt of PACKAGING_OPTIONS) {
    await prisma.packagingOption.upsert({
      where: { code: opt.code },
      update: { label: opt.label, displayOrder: opt.displayOrder },
      create: opt,
    });
  }
  console.log(`  packaging options: ${PACKAGING_OPTIONS.length}`);
}

async function seedFeatureFlags(backupFlags) {
  for (const flag of FEATURE_FLAGS) {
    const previous = backupFlags?.find((f) => f.key === flag.key);
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: {
        key: flag.key,
        description: flag.description,
        isEnabled: previous ? previous.isEnabled : Boolean(flag.defaultEnabled),
      },
    });
  }
  console.log(`  feature flags: ${FEATURE_FLAGS.length}`);
}

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@countrydairy.in';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.log('  admin user: skipped (set SEED_ADMIN_PASSWORD to create one)');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'SUPER_ADMIN', isActive: true },
    create: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await prisma.authIdentity.upsert({
    where: { provider_providerId: { provider: 'EMAIL', providerId: email } },
    update: { userId: user.id, verifiedAt: new Date() },
    create: {
      userId: user.id,
      provider: 'EMAIL',
      providerId: email,
      verifiedAt: new Date(),
    },
  });

  console.log(`  admin user: ${email}`);
}

async function restoreContent(backup) {
  for (const c of backup.categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        iconName: c.iconName,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        parentId: c.parentId,
      },
    });
  }
  console.log(`  categories: ${backup.categories.length}`);

  let variantCount = 0;
  let imageCount = 0;

  for (const p of backup.products) {
    const tax = taxFor(p.title);

    // OUT_OF_STOCK is no longer a lifecycle status; it is derived from stock.
    const status = ['DRAFT', 'LIVE', 'ARCHIVED'].includes(p.status) ? p.status : 'LIVE';

    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        id: p.id,
        categoryId: p.categoryId,
        title: p.title,
        slug: p.slug,
        tagline: p.tagline,
        storyDescription: p.storyDescription,
        status,
        forceOutOfStock: p.status === 'OUT_OF_STOCK',
        badgeText: p.badgeText,
        isFeatured: p.isFeatured,
        displayOrder: p.displayOrder,
        isSubscriptionAllowed: p.isSubscriptionAllowed,
        batchCode: p.batchCode,
        verified: p.verified,
        hsnCode: tax.hsnCode,
        gstRate: tax.gstRate,
        specifications: p.specifications ?? undefined,
        nutritionFacts: p.nutritionFacts ?? undefined,
        metadata: p.metadata ?? undefined,
      },
    });

    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          id: v.id,
          productId: p.id,
          sku: v.sku,
          sizeLabel: v.sizeLabel,
          sellingPrice: v.sellingPrice,
          mrpPrice: v.mrpPrice,
          stockQuantity: v.stockQuantity,
          lowStockThreshold: v.lowStockThreshold,
          // The old enum value becomes a lookup-table code.
          packagingCode: v.packagingType || null,
          imageUrl: v.imageUrl,
          isActive: v.isActive,
          displayOrder: v.displayOrder,
        },
      });
      variantCount++;
    }

    for (const img of p.galleryImages) {
      await prisma.productImage.upsert({
        where: { id: img.id },
        update: {},
        create: {
          id: img.id,
          productId: p.id,
          imageUrl: img.imageUrl,
          variantId: img.variantId,
          isPrimary: img.isPrimary,
          isVariantPrimary: img.isVariantPrimary,
          displayOrder: img.displayOrder,
        },
      });
      imageCount++;
    }
  }
  console.log(`  products: ${backup.products.length} (variants: ${variantCount}, images: ${imageCount})`);

  for (const h of backup.heroBanners) {
    await prisma.heroBanner.upsert({
      where: { id: h.id },
      update: {},
      create: {
        id: h.id,
        title: h.title,
        subtitle: h.subtitle,
        imageUrl: h.imageUrl,
        deviceType: h.deviceType,
        ctaText: h.ctaText,
        ctaLink: h.ctaLink,
        badgeText: h.badgeText,
        displayOrder: h.displayOrder,
        isActive: h.isActive,
      },
    });
  }
  console.log(`  hero banners: ${backup.heroBanners.length}`);

  for (const b of backup.trustBadges) {
    await prisma.trustBadge.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        iconName: b.iconName,
        displayOrder: b.displayOrder,
        isActive: b.isActive,
      },
    });
  }
  console.log(`  trust badges: ${backup.trustBadges.length}`);
}

async function main() {
  console.log('Seeding Country Dairy database...');

  await seedPackaging();

  const backupPath = path.join(__dirname, 'content-backup.json');
  const backup = fs.existsSync(backupPath)
    ? JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    : null;

  if (backup) {
    console.log(`Restoring content captured ${backup.exportedAt}`);
    await restoreContent(backup);
  } else {
    console.log('  no content-backup.json found, skipping content restore');
  }

  await seedFeatureFlags(backup?.featureFlags);
  await seedAdminUser();

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
