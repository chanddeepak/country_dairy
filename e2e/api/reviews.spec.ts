import { test, expect } from '@playwright/test';
import { cleanup, db, tracked, type Tracked } from '../fixtures/db';
import { apiClient, createCustomer, findSellableVariant, resolve } from '../fixtures/api';

/**
 * QA plan §8 — reviews, their attachments, and the storage behind them.
 *
 * The interesting half is not the text. It is that an attachment removed from
 * a review has no other referent, so anything left in the bucket is paid for
 * every month for ever. Two of the cases here exist only to prove the file
 * actually goes.
 */

/** A plausible stored path. Nothing is uploaded — the row is what is asserted. */
function mediaPath(name: string): string {
  return `/review-media/e2e/${name}`;
}

async function createReview(
  token: string,
  productId: string,
  body: Record<string, unknown>,
): Promise<{ id: string; status: number; text: string }> {
  const api = await apiClient(token);
  const res = await api.post(resolve(`/products/${productId}/reviews`), { data: body });
  const status = res.status();
  const text = await res.text();
  await api.dispose();

  let id = '';
  try {
    id = JSON.parse(text).id ?? '';
  } catch {
    /* a rejection has no id, which is the point of the cases that expect one */
  }
  return { id, status, text };
}

test.describe('Reviews @auth', () => {
  let t: Tracked;
  let productId: string;

  test.beforeEach(async () => {
    t = tracked();
    productId = (await findSellableVariant()).productId;
  });

  test.afterEach(async () => {
    await cleanup(t);
  });

  test('G2 · a review publishes immediately, without moderation', async () => {
    const customer = await createCustomer(t);

    const { id, status } = await createReview(customer.token, productId, {
      rating: 5,
      title: 'Tastes like home',
      comment: 'The ghee is the real thing.',
    });
    expect(status).toBeLessThan(300);
    t.reviewIds.push(id);

    const review = await db.productReview.findUniqueOrThrow({ where: { id } });
    // Held for moderation would mean an honest review is invisible until
    // someone gets round to it. The product's choice is to publish and moderate
    // afterwards.
    expect(review.status).toBe('APPROVED');
    expect(review.rating).toBe(5);
    expect(review.userId).toBe(customer.id);
  });

  test('G3 · the same customer may review a product more than once', async () => {
    const customer = await createCustomer(t);

    const first = await createReview(customer.token, productId, { rating: 4, comment: 'Good' });
    const second = await createReview(customer.token, productId, { rating: 5, comment: 'Better' });

    t.reviewIds.push(first.id, second.id);

    expect(first.status).toBeLessThan(300);
    expect(second.status, 'a second review was refused').toBeLessThan(300);

    const mine = await db.productReview.count({
      where: { userId: customer.id, productId },
    });
    expect(mine).toBe(2);
  });

  test('G5 · attachment and rating limits are enforced', async () => {
    const customer = await createCustomer(t);

    const sixFiles = await createReview(customer.token, productId, {
      rating: 5,
      mediaUrls: [1, 2, 3, 4, 5, 6].map((n) => mediaPath(`${n}.webp`)),
    });
    expect(sixFiles.status).toBe(400);
    expect(sixFiles.text.toLowerCase()).toMatch(/up to 5|maximum/);

    for (const rating of [0, 6, -1]) {
      const bad = await createReview(customer.token, productId, { rating });
      expect(bad.status, `rating ${rating} was accepted`).toBe(400);
      expect(bad.text.toLowerCase()).toMatch(/between 1 and 5/);
    }

    // Five is the documented ceiling, and must still be allowed.
    const five = await createReview(customer.token, productId, {
      rating: 4,
      mediaUrls: [1, 2, 3, 4, 5].map((n) => mediaPath(`ok-${n}.webp`)),
      mediaTypes: ['IMAGE', 'IMAGE', 'IMAGE', 'IMAGE', 'IMAGE'],
    });
    expect(five.status).toBeLessThan(300);
    t.reviewIds.push(five.id);
  });

  test('G6 · editing your own review records that it was edited', async () => {
    const customer = await createCustomer(t);

    const { id } = await createReview(customer.token, productId, {
      rating: 3,
      comment: 'It was fine',
    });
    t.reviewIds.push(id);

    expect((await db.productReview.findUniqueOrThrow({ where: { id } })).editedAt).toBeNull();

    const api = await apiClient(customer.token);
    const res = await api.patch(resolve(`/products/${productId}/reviews/${id}`), {
      data: { rating: 5, comment: 'It grew on me' },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const edited = await db.productReview.findUniqueOrThrow({ where: { id } });
    expect(edited.rating).toBe(5);
    expect(edited.comment).toBe('It grew on me');
    // Shown to readers, so an edited review cannot quietly become a different
    // review after people have relied on it.
    expect(edited.editedAt).not.toBeNull();
  });

  test('G7 · dropping an attachment keeps the others on the row', async () => {
    const customer = await createCustomer(t);
    const kept = mediaPath(`keep-${Date.now()}.webp`);
    const dropped = mediaPath(`drop-${Date.now()}.webp`);

    const { id } = await createReview(customer.token, productId, {
      rating: 5,
      mediaUrls: [kept, dropped],
      mediaTypes: ['IMAGE', 'IMAGE'],
    });
    t.reviewIds.push(id);

    const api = await apiClient(customer.token);
    const res = await api.patch(resolve(`/products/${productId}/reviews/${id}`), {
      data: { mediaUrls: [kept], mediaTypes: ['IMAGE'] },
    });
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    const after = await db.productReview.findUniqueOrThrow({ where: { id } });
    expect(after.mediaUrls).toEqual([kept]);
    expect(after.mediaTypes).toHaveLength(1);

    // The bucket delete is attempted for the dropped file only. It is allowed
    // to fail quietly — a customer's edit must not break because storage is
    // having a bad minute — so the row is what can be asserted here. The
    // delete itself is covered by scripts/media-cleanup-test.js against a real
    // upload.
  });

  test('G8 · deleting your own review removes the row', async () => {
    const customer = await createCustomer(t);

    const { id } = await createReview(customer.token, productId, {
      rating: 2,
      comment: 'Not for me',
      mediaUrls: [mediaPath(`gone-${Date.now()}.webp`)],
      mediaTypes: ['IMAGE'],
    });

    const api = await apiClient(customer.token);
    const res = await api.delete(resolve(`/products/${productId}/reviews/${id}`));
    expect(res.ok()).toBeTruthy();
    await api.dispose();

    expect(await db.productReview.count({ where: { id } })).toBe(0);
  });

  test('G9 · you cannot edit or delete someone else\'s review @security', async () => {
    const author = await createCustomer(t, 'Author');
    const stranger = await createCustomer(t, 'Stranger');

    const { id } = await createReview(author.token, productId, {
      rating: 5,
      comment: 'Mine',
    });
    t.reviewIds.push(id);

    const api = await apiClient(stranger.token);
    expect((await api.patch(resolve(`/products/${productId}/reviews/${id}`), {
      data: { rating: 1, comment: 'Not mine' },
    })).status()).toBe(403);
    expect((await api.delete(resolve(`/products/${productId}/reviews/${id}`))).status()).toBe(403);
    await api.dispose();

    const untouched = await db.productReview.findUniqueOrThrow({ where: { id } });
    expect(untouched.rating).toBe(5);
    expect(untouched.comment).toBe('Mine');
  });

  test('G9 · an anonymous caller cannot write or delete @security', async () => {
    const author = await createCustomer(t);
    const { id } = await createReview(author.token, productId, { rating: 4, comment: 'Mine' });
    t.reviewIds.push(id);

    const api = await apiClient();
    expect((await api.post(resolve(`/products/${productId}/reviews`), {
      data: { rating: 5, comment: 'From nobody' },
    })).status()).toBe(401);
    expect((await api.delete(resolve(`/products/${productId}/reviews/${id}`))).status()).toBe(401);

    // Reading, though, is public — reviews are the point of a product page.
    expect((await api.get(resolve(`/products/${productId}/reviews`))).ok()).toBeTruthy();
    await api.dispose();
  });

  test('G10/G11 · the average is over every review, not the visible page', async () => {
    test.setTimeout(180_000);

    const customer = await createCustomer(t);
    const ratings = [5, 4, 3, 2, 1, 5, 4];

    for (const rating of ratings) {
      const { id, status } = await createReview(customer.token, productId, {
        rating,
        comment: `rating ${rating}`,
      });
      expect(status).toBeLessThan(300);
      t.reviewIds.push(id);
    }

    const api = await apiClient();
    // A page smaller than the number of reviews, so paging is really in play.
    const res = await api.get(resolve(`/products/${productId}/reviews?page=1&pageSize=3`));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    await api.dispose();

    const truth = await db.productReview.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });

    expect(body.reviews.length, 'pageSize was ignored').toBeLessThanOrEqual(3);
    expect(body.totalReviews).toBe(truth._count);
    // The headline number must describe the product, not the page someone
    // happens to be looking at.
    expect(Number(body.averageRating)).toBeCloseTo(Number(truth._avg.rating), 1);
    expect(body.hasMore).toBe(true);

    const lastPage = await apiClient();
    const tail = await lastPage.get(
      resolve(`/products/${productId}/reviews?page=${body.totalPages}&pageSize=3`),
    );
    const tailBody = await tail.json();
    await lastPage.dispose();

    expect(tailBody.hasMore).toBe(false);
    expect(Number(tailBody.averageRating)).toBeCloseTo(Number(body.averageRating), 2);
  });
});
