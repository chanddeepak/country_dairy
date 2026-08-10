/**
 * Batch lab report contract test.
 *
 * Covers what the console writes, what the storefront and the jar QR code are
 * allowed to read, and the boundary between them: an unpublished batch must be
 * invisible to every public route, including the one that takes a batch number
 * a customer could guess.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const API = process.env.TEST_API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@countrydairy.in';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'ChangeMe#2026';

let pass = 0;
let fail = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  console.log('\n\x1b[1mBATCH LAB REPORTS\x1b[0m\n');

  const login = await call('/auth/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data?.accessToken;
  ok('admin can sign in', !!token, `status ${login.status}`);
  if (!token) throw new Error('cannot continue without an admin token');

  const products = await call('/catalog/admin/products', { token });
  const product = products.data?.[0];
  ok('a product exists to attach a batch to', !!product);
  if (!product) throw new Error('no products');

  const stamp = Date.now();
  const batch = `TEST-${stamp}`;
  const heldBatch = `TEST-HELD-${stamp}`;

  // --- Create ---
  console.log('\n  Creating');
  const created = await call('/lab-reports', {
    method: 'POST',
    token,
    body: {
      productId: product.id,
      batchNumber: batch.toLowerCase(), // uppercased server-side
      testDate: new Date().toISOString(),
      labName: 'Test NABL Lab',
      notes: 'Automated contract test.',
      parameters: [
        { name: 'Milk Fat', value: '99.7%', standard: 'min 99.5%', passed: true },
        { name: 'Moisture', value: '0.2%', standard: 'max 0.5%', passed: true },
      ],
    },
  });
  ok('report created', created.ok, `status ${created.status} ${JSON.stringify(created.data?.message ?? '')}`);
  ok('batch number normalised to uppercase', created.data?.batchNumber === batch, created.data?.batchNumber);
  ok('parameters round-trip', created.data?.parameters?.length === 2);
  ok('parameter verdict preserved', created.data?.parameters?.[0]?.passed === true);
  ok('published by default', created.data?.isPublished === true);
  ok('product title joined in', created.data?.productTitle === product.title);

  const reportId = created.data?.id;

  // --- Validation ---
  console.log('\n  Validation');
  const dupe = await call('/lab-reports', {
    method: 'POST',
    token,
    body: { productId: product.id, batchNumber: batch, testDate: new Date().toISOString() },
  });
  ok('duplicate batch on same product rejected', dupe.status === 409, `status ${dupe.status}`);

  const noBatch = await call('/lab-reports', {
    method: 'POST',
    token,
    body: { productId: product.id, batchNumber: 'x', testDate: new Date().toISOString() },
  });
  ok('too-short batch number rejected', noBatch.status === 400, `status ${noBatch.status}`);

  const badDate = await call('/lab-reports', {
    method: 'POST',
    token,
    body: { productId: product.id, batchNumber: `BAD-${stamp}`, testDate: 'not-a-date' },
  });
  ok('invalid test date rejected', badDate.status === 400, `status ${badDate.status}`);

  const badProduct = await call('/lab-reports', {
    method: 'POST',
    token,
    body: {
      productId: '00000000-0000-0000-0000-000000000000',
      batchNumber: `ORPHAN-${stamp}`,
      testDate: new Date().toISOString(),
    },
  });
  ok('report for a missing product rejected', badProduct.status === 404, `status ${badProduct.status}`);

  const badFile = await call('/lab-reports', {
    method: 'POST',
    token,
    body: {
      productId: product.id,
      batchNumber: `FILE-${stamp}`,
      testDate: new Date().toISOString(),
      fileUrl: 'javascript:alert(1)',
    },
  });
  ok('non-http report URL rejected', badFile.status === 400, `status ${badFile.status}`);

  const extraField = await call('/lab-reports', {
    method: 'POST',
    token,
    body: {
      productId: product.id,
      batchNumber: `EXTRA-${stamp}`,
      testDate: new Date().toISOString(),
      isVerifiedByUs: true,
    },
  });
  ok('unknown field rejected by whitelist', extraField.status === 400, `status ${extraField.status}`);

  // --- Public reads ---
  console.log('\n  Public reads');
  const publicList = await call(`/lab-reports/product/${product.id}`);
  ok('storefront lists published reports without a token', publicList.ok);
  ok('the new batch is visible', publicList.data?.some((r) => r.batchNumber === batch));

  const qr = await call(`/lab-reports/batch/${batch}`);
  ok('QR batch lookup resolves', qr.ok, `status ${qr.status}`);
  ok('QR lookup returns the product slug for the link back', !!qr.data?.productSlug);

  const missing = await call(`/lab-reports/batch/NO-SUCH-BATCH-${stamp}`);
  ok('unknown batch returns 404, not an empty shell', missing.status === 404);

  // --- Unpublished stays private ---
  console.log('\n  Held-back batches stay private');
  const held = await call('/lab-reports', {
    method: 'POST',
    token,
    body: {
      productId: product.id,
      batchNumber: heldBatch,
      testDate: new Date().toISOString(),
      isPublished: false,
      parameters: [{ name: 'Moisture', value: '0.9%', standard: 'max 0.5%', passed: false }],
    },
  });
  ok('unpublished report created', held.ok && held.data?.isPublished === false);

  const publicAfterHold = await call(`/lab-reports/product/${product.id}`);
  ok(
    'held-back batch absent from the storefront list',
    !publicAfterHold.data?.some((r) => r.batchNumber === heldBatch),
  );

  const qrHeld = await call(`/lab-reports/batch/${heldBatch}`);
  ok('held-back batch not reachable by QR lookup', qrHeld.status === 404, `status ${qrHeld.status}`);

  const adminList = await call('/lab-reports/admin', { token });
  ok(
    'console still sees the held-back batch',
    adminList.data?.some((r) => r.batchNumber === heldBatch),
  );

  const filtered = await call(`/lab-reports/admin?productId=${product.id}`, { token });
  ok(
    'console filter by product works',
    filtered.ok && filtered.data.every((r) => r.productId === product.id),
  );

  // --- Auth ---
  console.log('\n  Authorisation');
  const anonList = await call('/lab-reports/admin');
  ok('console listing needs a token', anonList.status === 401, `status ${anonList.status}`);

  const anonCreate = await call('/lab-reports', {
    method: 'POST',
    body: { productId: product.id, batchNumber: `ANON-${stamp}`, testDate: new Date().toISOString() },
  });
  ok('anonymous create rejected', anonCreate.status === 401, `status ${anonCreate.status}`);

  const anonDelete = await call(`/lab-reports/${reportId}`, { method: 'DELETE' });
  ok('anonymous delete rejected', anonDelete.status === 401, `status ${anonDelete.status}`);

  const forged = await call('/lab-reports/admin', { token: `${token.slice(0, -4)}abcd` });
  ok('forged token rejected', forged.status === 401, `status ${forged.status}`);

  // --- Update ---
  console.log('\n  Updating');
  const updated = await call(`/lab-reports/${reportId}`, {
    method: 'PATCH',
    token,
    body: { labName: 'Renamed Lab', parameters: [{ name: 'Milk Fat', value: '99.9%' }] },
  });
  ok('update accepted', updated.ok, `status ${updated.status}`);
  ok('lab name changed', updated.data?.labName === 'Renamed Lab');
  ok('parameters replaced, not appended', updated.data?.parameters?.length === 1);
  ok('batch number untouched by a partial update', updated.data?.batchNumber === batch);

  const unpublish = await call(`/lab-reports/${reportId}`, {
    method: 'PATCH',
    token,
    body: { isPublished: false },
  });
  ok('report can be pulled from the storefront', unpublish.data?.isPublished === false);

  const goneFromPublic = await call(`/lab-reports/batch/${batch}`);
  ok('pulled report stops resolving for the QR code', goneFromPublic.status === 404);

  await call(`/lab-reports/${reportId}`, {
    method: 'PATCH',
    token,
    body: { isPublished: true },
  });
  const backPublic = await call(`/lab-reports/batch/${batch}`);
  ok('republishing restores the QR lookup', backPublic.ok);

  const clash = await call(`/lab-reports/${reportId}`, {
    method: 'PATCH',
    token,
    body: { batchNumber: heldBatch },
  });
  ok('renaming onto an existing batch rejected', clash.status === 409, `status ${clash.status}`);

  // --- Delete ---
  console.log('\n  Deleting');
  const removed = await call(`/lab-reports/${reportId}`, { method: 'DELETE', token });
  ok('delete accepted', removed.ok, `status ${removed.status}`);

  const afterDelete = await call(`/lab-reports/batch/${batch}`);
  ok('deleted batch stops resolving', afterDelete.status === 404);

  const deleteAgain = await call(`/lab-reports/${reportId}`, { method: 'DELETE', token });
  ok('deleting a gone report returns 404', deleteAgain.status === 404);

  // Clean up the held-back one too.
  if (held.data?.id) await call(`/lab-reports/${held.data.id}`, { method: 'DELETE', token });

  const finalList = await call('/lab-reports/admin', { token });
  ok(
    'no test rows left behind',
    !finalList.data?.some((r) => r.batchNumber.startsWith(`TEST-`) && r.batchNumber.includes(String(stamp))),
  );
})()
  .catch((err) => {
    fail++;
    console.error('\n\x1b[31mFATAL\x1b[0m', err.message);
  })
  .finally(() => {
    const colour = fail ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n${colour}\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
    process.exit(fail ? 1 : 0);
  });
