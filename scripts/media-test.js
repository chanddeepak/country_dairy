#!/usr/bin/env node
/**
 * Media test.
 *
 *   npm run test:media
 *
 * Covers product video in the gallery and customer photo/video on reviews —
 * the mediaType column added on top of the baseline migration.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@countrydairy.in';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'ChangeMe#2026';

let pass = 0;
let fail = 0;
const failures = [];

const ok = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function call(endpoint, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, data: text ? JSON.parse(text) : null };
}

const created = { productIds: [], userIds: [] };

async function run() {
  const admin = await call('/auth/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = admin.data.accessToken;

  section('Product gallery accepts video');
  const slug = `media-test-${Date.now()}`;
  const product = await call('/catalog/products', {
    method: 'POST',
    token,
    body: {
      title: 'Media Test Product',
      slug,
      categoryName: 'Dairy',
      status: 'DRAFT',
      variants: [{ sizeLabel: '1L', sellingPrice: 100, mrpPrice: 120, stockQuantity: 5 }],
      galleryImages: [
        { imageUrl: '/products/still.webp', mediaType: 'IMAGE', isPrimary: true },
        {
          imageUrl: '/products/clip.mp4',
          mediaType: 'VIDEO',
          thumbnailUrl: '/products/poster.webp',
          durationSeconds: 24,
        },
      ],
    },
  });
  ok('product with mixed media created', product.ok, `status ${product.status}`);
  if (!product.ok) throw new Error(JSON.stringify(product.data));
  created.productIds.push(product.data.id);

  const gallery = await prisma.productImage.findMany({
    where: { productId: product.data.id },
    orderBy: { displayOrder: 'asc' },
  });
  ok('two gallery rows stored', gallery.length === 2);
  ok('image row typed IMAGE', gallery[0].mediaType === 'IMAGE');
  ok('video row typed VIDEO', gallery[1].mediaType === 'VIDEO');
  ok('video poster frame stored', gallery[1].thumbnailUrl === '/products/poster.webp');
  ok('video duration stored', gallery[1].durationSeconds === 24);

  // A card needs a still; a video must never become the catalogue cover.
  const videoAsCover = await call('/catalog/products', {
    method: 'POST',
    token,
    body: {
      title: 'Video Cover Test',
      slug: `${slug}-cover`,
      categoryName: 'Dairy',
      galleryImages: [{ imageUrl: '/products/clip2.mp4', mediaType: 'VIDEO', isPrimary: true }],
    },
  });
  created.productIds.push(videoAsCover.data?.id);
  const coverRows = await prisma.productImage.findMany({
    where: { productId: videoAsCover.data.id },
  });
  ok('a video cannot be marked as the primary cover', coverRows[0].isPrimary === false);

  section('Media type validation');
  const badType = await call('/catalog/products', {
    method: 'POST',
    token,
    body: {
      title: 'Bad Media Type',
      slug: `${slug}-bad`,
      categoryName: 'Dairy',
      galleryImages: [{ imageUrl: '/x.gif', mediaType: 'GIF' }],
    },
  });
  ok('unknown mediaType rejected', badType.status === 400);

  const presignBad = await call(
    '/media/presigned-url?filename=x.exe&contentType=application/x-msdownload&bucket=products',
    { token },
  );
  ok('presigned URL refused for a disallowed content type', presignBad.status === 400);

  const presignVideo = await call(
    '/media/presigned-url?filename=clip.mp4&contentType=video/mp4&bucket=products',
    { token },
  );
  ok('presigned URL issued for video/mp4', presignVideo.ok, `status ${presignVideo.status}`);
  ok('response declares the media kind', presignVideo.data?.mediaType === 'VIDEO');

  section('Review photos and video');
  const flags = (await call('/cms/feature-flags/map')).data;
  if (!flags.ENABLE_PRODUCT_RATINGS) {
    console.log('  \x1b[33m—\x1b[0m ratings flag off, skipping review media checks');
  } else {
    const email = `media_${Date.now()}@example.com`;
    const reg = await call('/auth/email/register', {
      method: 'POST',
      body: { email, password: 'MediaTest123', name: 'Media Tester' },
    });
    const custToken = reg.data.accessToken;
    const customer = await prisma.user.findUnique({ where: { email } });
    created.userIds.push(customer.id);

    const review = await call(`/products/${product.data.id}/reviews`, {
      method: 'POST',
      token: custToken,
      body: {
        rating: 5,
        comment: 'Attaching a photo and a clip.',
        mediaUrls: ['/review-media/photo.webp', '/review-media/clip.mp4'],
        mediaTypes: ['IMAGE', 'VIDEO'],
      },
    });
    ok('review with mixed media accepted', review.ok, `status ${review.status}`);

    const row = await prisma.productReview.findUnique({ where: { id: review.data.id } });
    ok('both media URLs stored', row.mediaUrls.length === 2);
    ok('media types stored positionally', row.mediaTypes[0] === 'IMAGE' && row.mediaTypes[1] === 'VIDEO');

    const tooMany = await call(`/products/${product.data.id}/reviews`, {
      method: 'POST',
      token: custToken,
      body: {
        rating: 4,
        mediaUrls: Array(6).fill('/review-media/x.webp'),
        mediaTypes: Array(6).fill('IMAGE'),
      },
    });
    ok('more than five attachments rejected', tooMany.status === 400);

    await prisma.productReview.deleteMany({ where: { userId: customer.id } });
  }
}

async function cleanup() {
  section('Cleanup');
  try {
    const ids = created.productIds.filter(Boolean);
    if (ids.length) {
      await prisma.productReview.deleteMany({ where: { productId: { in: ids } } });
      await prisma.productImage.deleteMany({ where: { productId: { in: ids } } });
      await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } });
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    }
    if (created.userIds.length) {
      await prisma.authIdentity.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    console.log('  test data removed');
  } catch (e) {
    console.log(`  \x1b[33mcleanup warning:\x1b[0m ${e.message}`);
  }
}

run()
  .catch((e) => {
    fail++;
    failures.push(`fatal: ${e.message}`);
    console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}`);
  })
  .then(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
    if (failures.length) failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(fail > 0 ? 1 : 0);
  });
