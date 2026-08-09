/**
 * Exports catalog + CMS content to JSON before a baseline migration reset.
 * Orders/customers are intentionally excluded — this is content, not history.
 *
 *   node packages/database/prisma/backup-content.js
 */
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const dump = {
    exportedAt: new Date().toISOString(),
    categories: await prisma.category.findMany(),
    products: await prisma.product.findMany({
      include: { variants: true, galleryImages: true },
    }),
    heroBanners: await prisma.heroBanner.findMany(),
    trustBadges: await prisma.trustBadge.findMany(),
    featureFlags: await prisma.featureFlag.findMany(),
  };

  const outPath = path.join(__dirname, 'content-backup.json');
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(
    `  categories=${dump.categories.length} products=${dump.products.length} ` +
      `variants=${dump.products.reduce((n, p) => n + p.variants.length, 0)} ` +
      `images=${dump.products.reduce((n, p) => n + p.galleryImages.length, 0)} ` +
      `heroBanners=${dump.heroBanners.length} trustBadges=${dump.trustBadges.length} ` +
      `featureFlags=${dump.featureFlags.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
