/**
 * Paging for the admin lists.
 *
 * These lists used to take a fixed slice — 200 orders, 200 customers, 100
 * audit entries — and return it as a bare array. Nothing said a slice had been
 * taken, so the 201st order did not appear and nobody was told it existed.
 * That is fine on a seeded database and wrong on a real one.
 *
 * There is deliberately no DTO here. The global pipe runs with
 * forbidNonWhitelisted, so binding a whole query object to a paging DTO would
 * reject every list's own filters as unknown properties. Controllers read
 * `page` and `pageSize` individually and pageParams does the coercing.
 */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export const DEFAULT_PAGE_SIZE = 50;

/** Normalises whatever arrived on the query string into skip/take. */
export function pageParams(
  query: { page?: number; pageSize?: number } = {},
): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const pageSize = Math.min(
    200,
    Math.max(1, Math.trunc(Number(query.pageSize) || DEFAULT_PAGE_SIZE)),
  );

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Wraps rows with what the caller needs to page through them.
 *
 * `total` is the count matching the filter, not the length of `items` — a
 * client cannot render "showing 50 of 1,284" from the page alone, and without
 * it there is no way to tell a last page from a truncated one.
 */
export function paginate<T>(
  items: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
): Page<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore: page * pageSize < total,
  };
}
