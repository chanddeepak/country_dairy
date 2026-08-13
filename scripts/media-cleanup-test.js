/**
 * Media lifecycle contract test.
 *
 * Storage is billed by the gigabyte-month, so a file that outlives the row
 * pointing at it costs money for ever. This checks that replacing or removing
 * something actually frees its file, in every bucket — not just the two the
 * delete helper used to recognise.
 *
 * Also covers the endpoints themselves: media routes were unauthenticated, so
 * anyone could delete a product image or fill the bucket for free.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
// Node 20 has no global WebSocket; supabase-js needs one even though this
// script only touches Storage.
const ws = require('ws');

const prisma = new PrismaClient();

const API = process.env.TEST_API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@countrydairy.in';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'ChangeMe#2026';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ieugxahinfowtlryyzmv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  },
);

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

const stamp = Date.now();
const planted = [];

/** Puts a tiny real object in a bucket so we can watch it live and die. */
async function plant(bucket, label) {
  const name = `test-${label}-${stamp}.bin`;
  const body = Buffer.from(`cleanup probe ${label} ${stamp}`);
  const opts = { contentType: 'application/octet-stream', upsert: true };

  let { error } = await supabase.storage.from(bucket).upload(name, body, opts);

  // Buckets are created on first use by the presigned-url handler, so a
  // bucket nobody has uploaded to yet simply does not exist.
  if (error && /not found/i.test(error.message)) {
    await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
    ({ error } = await supabase.storage.from(bucket).upload(name, body, opts));
  }

  if (error) throw new Error(`could not plant in ${bucket}: ${error.message}`);
  planted.push({ bucket, name });
  return `/${bucket}/${name}`;
}

async function exists(bucket, name) {
  const { data } = await supabase.storage.from(bucket).list('', { search: name, limit: 100 });
  return !!data?.some((o) => o.name === name);
}

(async () => {
  console.log('\n\x1b[1mMEDIA LIFECYCLE\x1b[0m\n');

  const login = await call('/auth/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data?.accessToken;
  ok('admin can sign in', !!token);
  if (!token) throw new Error('no admin token');

  // --- Endpoints are no longer open ---
  console.log('\n  The media routes are not open to the public');
  const anonDelete = await call('/media/delete', {
    method: 'POST',
    body: { url: '/products/anything.webp' },
  });
  ok('anonymous delete rejected', anonDelete.status === 401, `status ${anonDelete.status}`);

  const anonSweep = await call('/media/orphans/sweep', { method: 'POST', body: {} });
  ok('anonymous sweep rejected', anonSweep.status === 401, `status ${anonSweep.status}`);

  const anonOrphans = await call('/media/orphans');
  ok('anonymous orphan listing rejected', anonOrphans.status === 401, `status ${anonOrphans.status}`);

  const customer = await call('/auth/email/register', {
    method: 'POST',
    body: {
      email: `media-test-${stamp}@countrydairy.test`,
      password: 'TestPass#2026',
      name: 'Media Tester',
    },
  });
  const customerToken = customer.data?.accessToken;

  const customerDelete = await call('/media/delete', {
    method: 'POST',
    token: customerToken,
    body: { url: '/products/anything.webp' },
  });
  ok('a customer cannot delete store media', customerDelete.status === 403, `status ${customerDelete.status}`);

  const customerSweep = await call('/media/orphans/sweep', {
    method: 'POST',
    token: customerToken,
    body: {},
  });
  ok('a customer cannot sweep the bucket', customerSweep.status === 403, `status ${customerSweep.status}`);

  // --- Every bucket is actually cleanable ---
  console.log('\n  Delete works in every bucket, not just two');
  for (const bucket of ['products', 'hero-banners', 'review-media', 'lab-reports']) {
    const url = await plant(bucket, bucket);
    const name = url.split('/').pop();

    ok(`${bucket}: probe file planted`, await exists(bucket, name));

    const removed = await call('/media/delete', { method: 'POST', token, body: { url } });
    ok(`${bucket}: delete reported success`, removed.data?.success === true, JSON.stringify(removed.data));
    ok(`${bucket}: file is actually gone`, !(await exists(bucket, name)));
  }

  // --- Review attachments are released ---
  console.log('\n  A deleted review releases its attachments');
  const variant = await prisma.productVariant.findFirst({ include: { product: true } });
  const cust = await prisma.user.findUnique({
    where: { email: `media-test-${stamp}@countrydairy.test` },
  });

  const attachment = await plant('review-media', 'review');
  const attachmentName = attachment.split('/').pop();

  const review = await prisma.productReview.create({
    data: {
      userId: cust.id,
      productId: variant.productId,
      rating: 5,
      title: 'Cleanup probe',
      comment: 'Checking that attachments are released.',
      mediaUrls: [attachment],
      mediaTypes: ['IMAGE'],
      status: 'APPROVED',
    },
  });

  ok('attachment exists while the review does', await exists('review-media', attachmentName));

  const removedReview = await call(
    `/products/${variant.productId}/reviews/${review.id}`,
    { method: 'DELETE', token: customerToken },
  );
  ok('customer deleted their review', removedReview.ok, `status ${removedReview.status}`);
  ok(
    'the attachment went with it',
    !(await exists('review-media', attachmentName)),
    'file survived the review',
  );

  // --- Editing a review off an image releases it ---
  console.log('\n  Editing an attachment off a review releases it');
  const keep = await plant('review-media', 'keep');
  const drop = await plant('review-media', 'drop');
  const keepName = keep.split('/').pop();
  const dropName = drop.split('/').pop();

  const editable = await prisma.productReview.create({
    data: {
      userId: cust.id,
      productId: variant.productId,
      rating: 4,
      comment: 'Two attachments, one about to go.',
      mediaUrls: [keep, drop],
      mediaTypes: ['IMAGE', 'IMAGE'],
      status: 'APPROVED',
    },
  });

  const edited = await call(`/products/${variant.productId}/reviews/${editable.id}`, {
    method: 'PATCH',
    token: customerToken,
    body: { mediaUrls: [keep], mediaTypes: ['IMAGE'] },
  });
  ok('review edited', edited.ok, `status ${edited.status}`);
  ok('the removed attachment is gone', !(await exists('review-media', dropName)));
  ok('the kept attachment survived', await exists('review-media', keepName));

  // --- Orphan sweep ---
  console.log('\n  Orphan sweep');
  const orphan = await plant('products', 'orphan');
  const orphanName = orphan.split('/').pop();

  const report = await call('/media/orphans?minAgeHours=0', { token });
  ok('sweep report returned', report.ok, `status ${report.status}`);
  ok('it is a dry run by default', report.data?.dryRun === true);
  ok('nothing was deleted by the report', report.data?.deleted === 0);
  ok(
    'our orphan was spotted',
    report.data?.details?.some((d) => d.name === orphanName),
    `${report.data?.orphans} orphans found`,
  );
  ok('the file is still there after a dry run', await exists('products', orphanName));

  // A referenced file must never be swept.
  const referenced = await prisma.productImage.findFirst({
    where: { imageUrl: { startsWith: '/products/' } },
  });
  if (referenced) {
    const refName = referenced.imageUrl.split('/').pop();
    ok(
      'a file the catalogue still points at is not listed as an orphan',
      !report.data?.details?.some((d) => d.name === refName),
      refName,
    );
  }

  const recent = await call('/media/orphans?minAgeHours=24', { token });
  ok(
    'a fresh upload is protected by the age guard',
    !recent.data?.details?.some((d) => d.name === orphanName),
    'a form still being filled in would have lost its upload',
  );
  ok('and it is counted as skipped', (recent.data?.skippedTooRecent ?? 0) > 0);

  const swept = await call('/media/orphans/sweep', {
    method: 'POST',
    token,
    body: { minAgeHours: 0 },
  });
  ok('sweep ran', swept.ok, `status ${swept.status}`);
  ok('it removed something', (swept.data?.deleted ?? 0) > 0, JSON.stringify(swept.data?.deleted));
  ok('our orphan is gone', !(await exists('products', orphanName)));

  const stillReferenced = referenced
    ? await exists('products', referenced.imageUrl.split('/').pop())
    : true;
  ok('the referenced catalogue image survived the sweep', stillReferenced);
})()
  .catch((err) => {
    fail++;
    console.error('\n\x1b[31mFATAL\x1b[0m', err.message);
  })
  .finally(async () => {
    // Remove anything the run left behind, in storage and in the database.
    for (const { bucket, name } of planted) {
      await supabase.storage.from(bucket).remove([name]).catch(() => {});
    }
    const u = await prisma.user
      .findUnique({ where: { email: `media-test-${stamp}@countrydairy.test` } })
      .catch(() => null);
    if (u) {
      await prisma.productReview.deleteMany({ where: { userId: u.id } });
      await prisma.cartItem.deleteMany({ where: { userId: u.id } });
      await prisma.authIdentity.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.$disconnect();

    const colour = fail ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n${colour}\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
    process.exit(fail ? 1 : 0);
  });
