import { API_URL } from '../constants';

/**
 * Talking to the Country Dairy API.
 *
 * Deliberately small and dependency-free: the app needs a handful of GETs and
 * two POSTs, and a data-fetching library would be more machinery than the
 * whole of it.
 *
 * Every request sets Content-Type when it carries a body. On the web that
 * omission cost a day — a string body with no content type is sent as
 * text/plain, the API's JSON parser skips it, and the request arrives empty,
 * failing validation on fields the customer never filled in.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Aborts rather than leaving a spinner running for ever on a dead network. */
  timeoutMs?: number;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 15000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      // The API returns one message per failed rule. The first is enough to
      // act on; the whole list reads as a telling-off.
      const problem = await res.json().catch(() => null);
      const message = Array.isArray(problem?.message)
        ? problem.message[0]
        : (problem?.message ?? `Request failed (${res.status})`);
      throw new ApiError(message, res.status);
    }

    // 204 and friends have no body to parse.
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to answer.', 0);
    }
    // A network failure is ours to explain, not theirs to decode.
    throw new ApiError('Could not reach Country Dairy. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}

// --- Catalogue -------------------------------------------------------------

/** What the API actually returns, as opposed to the app's display shape. */
export interface ApiVariant {
  id: string;
  sku: string;
  sizeLabel: string;
  sellingPrice: string;
  mrpPrice: string;
  stockQuantity: number;
  imageUrl?: string | null;
  isActive: boolean;
  showOnHome?: boolean;
}

export interface ApiProduct {
  id: string;
  title: string;
  slug: string;
  tagline?: string | null;
  storyDescription?: string | null;
  badgeText?: string | null;
  isFeatured: boolean;
  categoryName?: string | null;
  latestBatchNumber?: string | null;
  latestBatchTestDate?: string | null;
  nutritionFacts?: Record<string, string> | null;
  variants?: ApiVariant[];
  galleryImages?: { imageUrl: string; isPrimary?: boolean; variantId?: string | null }[];
}

interface Paged<T> {
  items: T[];
  total: number;
}

export async function fetchProducts(): Promise<ApiProduct[]> {
  const body = await request<Paged<ApiProduct> | ApiProduct[]>('/catalog/products');
  // The endpoint has been both a bare array and a paged envelope. Accepting
  // either costs one line and avoids an empty shelf if it changes again.
  return Array.isArray(body) ? body : (body.items ?? []);
}

export async function fetchProduct(slug: string): Promise<ApiProduct> {
  return request<ApiProduct>(`/catalog/products/${slug}`);
}

// --- Money -----------------------------------------------------------------

/**
 * Prices arrive as decimal strings, because floating point and money do not
 * mix. Formatted for display only — never added up in the app. The totals a
 * customer is charged come from the API, which is the only thing that can be
 * authoritative about them.
 */
export function rupees(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
}
