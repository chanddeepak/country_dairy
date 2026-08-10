#!/usr/bin/env node
/**
 * Catalog and audit test.
 *
 *   npm run test:catalog
 *
 * Covers the admin's core workflow — creating and editing a product — and the
 * audit trail it produces. The "previously silent defaults" checks pin bugs
 * where a missing price became ₹100 and a missing category became a literal
 * 'cat-1' that failed the foreign key.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = 'http://localhost:4000/api';
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n} ${d}`)); };

async function call(p, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await res.text();
  return { status: res.status, ok: res.ok, data: t ? JSON.parse(t) : null };
}

async function main() {
  const admin = await call('/auth/admin/login', {
    method: 'POST', body: { email: 'admin@countrydairy.in', password: 'ChangeMe#2026' },
  });
  const token = admin.data.accessToken;

  const auditBefore = await prisma.auditLog.count();

  console.log('CREATE PRODUCT (was returning 500)');
  const slug = `test-honey-${Date.now()}`;
  const created = await call('/catalog/products', {
    method: 'POST', token,
    body: {
      title: 'Raw Wild Forest Honey (test)',
      slug,
      categoryName: 'Honey',
      status: 'DRAFT',
      hsnCode: '0409',
      gstRate: 5,
      variants: [
        { sizeLabel: '500g Glass Jar', sellingPrice: 450, mrpPrice: 520, stockQuantity: 25, packagingCode: 'GLASS_JAR' },
        { sizeLabel: '1kg Squeeze Bottle', sellingPrice: 820, mrpPrice: 950, stockQuantity: 10, packagingCode: 'SQUEEZE_BOTTLE' },
      ],
    },
  });
  ok('product created', created.ok, `status ${created.status}: ${JSON.stringify(created.data?.message)}`);
  if (!created.ok) throw new Error('cannot continue');

  const productId = created.data.id;
  ok('two variants created', created.data.variants.length === 2);
  ok('prices stored as sent, not defaulted to 100', Number(created.data.variants[0].sellingPrice) === 450);
  ok('packagingCode persisted', created.data.variants[0].packagingCode === 'GLASS_JAR');
  ok('honey packaging option resolvable', created.data.variants[1].packagingCode === 'SQUEEZE_BOTTLE');
  ok('GST + HSN stored', Number(created.data.gstRate) === 5 && created.data.hsnCode === '0409');
  ok('category resolved by name', !!created.data.categoryId);

  console.log('\nVALIDATION (previously silent defaults)');
  const noPrice = await call('/catalog/products', {
    method: 'POST', token,
    body: { title: 'No Price Product', categoryName: 'Honey', variants: [{ sizeLabel: '1kg' }] },
  });
  ok('missing price rejected instead of becoming ₹100', noPrice.status === 400,
    `status ${noPrice.status}`);

  const noCategory = await call('/catalog/products', {
    method: 'POST', token, body: { title: 'No Category Product' },
  });
  ok('missing category rejected instead of FK-failing on cat-1', noCategory.status === 400);

  const dupSlug = await call('/catalog/products', {
    method: 'POST', token, body: { title: 'Dup', slug, categoryName: 'Honey' },
  });
  ok('duplicate slug rejected with a clear message', dupSlug.status === 400);

  console.log('\nUPDATE PRESERVES VARIANT IDENTITY');
  const originalVariantIds = created.data.variants.map((v) => v.id).sort();

  const updated = await call(`/catalog/products/${productId}`, {
    method: 'PUT', token,
    body: {
      title: 'Raw Wild Forest Honey (renamed)',
      status: 'LIVE',
      variants: created.data.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        sizeLabel: v.sizeLabel,
        sellingPrice: Number(v.sellingPrice) + 10,
        mrpPrice: Number(v.mrpPrice),
        stockQuantity: v.stockQuantity,
        packagingCode: v.packagingCode,
      })),
    },
  });
  ok('product updated', updated.ok, `status ${updated.status}`);

  const afterIds = updated.data.variants.map((v) => v.id).sort();
  // Variants used to be deleted and recreated on every save, which detached
  // order history and emptied customers' carts.
  ok('variant ids survive an edit', JSON.stringify(afterIds) === JSON.stringify(originalVariantIds),
    `before ${originalVariantIds.length}, after ${afterIds.length}`);
  ok('price change applied', Number(updated.data.variants[0].sellingPrice) === 460);
  ok('title change applied', updated.data.title.includes('renamed'));
  ok('untouched fields preserved', updated.data.hsnCode === '0409');

  console.log('\nSTOCK IS NOT RESET BY AN EDIT');
  await prisma.productVariant.update({ where: { id: originalVariantIds[0] }, data: { stockQuantity: 7 } });
  const reUpdate = await call(`/catalog/products/${productId}`, {
    method: 'PUT', token,
    body: {
      variants: updated.data.variants.map((v) => ({
        id: v.id, sku: v.sku, sizeLabel: v.sizeLabel,
        sellingPrice: Number(v.sellingPrice), mrpPrice: Number(v.mrpPrice),
        // stockQuantity deliberately omitted, as the editor does when the
        // field is untouched
      })),
    },
  });
  const stockNow = (await prisma.productVariant.findUnique({ where: { id: originalVariantIds[0] } })).stockQuantity;
  ok('omitted stock keeps its existing value', stockNow === 7, `got ${stockNow}`);

  console.log('\nAUDIT LOG');
  const auditAfter = await prisma.auditLog.count();
  ok('audit rows written', auditAfter > auditBefore, `${auditBefore} -> ${auditAfter}`);

  const entries = await call('/audit?entity=Product', { token });
  ok('audit endpoint returns product entries', entries.ok && entries.data.length > 0);

  const createEntry = entries.data.find((e) => e.action === 'CREATE' && e.entityId === productId);
  ok('CREATE recorded', !!createEntry);
  ok('actor attributed to the signed-in admin', createEntry?.userName?.includes('Admin') || !!createEntry?.userId,
    `userName=${createEntry?.userName}`);
  ok('IP captured', !!createEntry?.ipAddress, `ip=${createEntry?.ipAddress}`);

  const updateEntry = entries.data.find((e) => e.action === 'UPDATE' && e.entityId === productId);
  ok('UPDATE records before and after', !!updateEntry?.payloadBefore && !!updateEntry?.payloadAfter);

  console.log('\nAUDIT REDACTION');
  const staffEmail = `audit_${Date.now()}@countrydairy.in`;
  const staff = await call('/users/staff', {
    method: 'POST', token,
    body: { email: staffEmail, name: 'Audit Probe', password: 'SuperSecret123', role: 'CATALOG_MANAGER' },
  });
  const staffEntries = await call('/audit?entity=StaffAccount', { token });
  const staffCreate = staffEntries.data.find((e) => e.entityId === staff.data.id);
  const serialized = JSON.stringify(staffCreate ?? {});
  ok('staff creation recorded', !!staffCreate);
  ok('password never appears in the audit payload', !serialized.includes('SuperSecret123'));

  console.log('\nACCESS CONTROL');
  ok('audit log requires super admin', (await call('/audit')).status === 401);

  console.log('\nFEATURE FLAG TOGGLE IS AUDITED');
  await call('/cms/feature-flags/ENABLE_SUBSCRIPTIONS/toggle', { method: 'PATCH', token });
  const flagEntries = await call('/audit?entity=FeatureFlag', { token });
  ok('flag toggle recorded', flagEntries.data.some((e) => e.entityId === 'ENABLE_SUBSCRIPTIONS'));
  await call('/cms/feature-flags/ENABLE_SUBSCRIPTIONS/toggle', { method: 'PATCH', token });

  // Cleanup
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityId: productId }, { entityId: staff.data.id }, { entityId: 'ENABLE_SUBSCRIPTIONS' }] },
  });
  await prisma.authIdentity.deleteMany({ where: { userId: staff.data.id } });
  await prisma.user.delete({ where: { id: staff.data.id } });
  await prisma.productImage.deleteMany({ where: { productId } });
  await prisma.productVariant.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
  await prisma.category.deleteMany({ where: { slug: 'honey', products: { none: {} } } }).catch(() => {});
  console.log('\n  cleaned up');
}

main()
  .catch((e) => { fail++; console.error('FATAL', e.message); })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
