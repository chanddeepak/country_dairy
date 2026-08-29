import type {
  Product,
  CategoryItem,
  HeroBanner,
  TrustBadge,
  FeatureFlag,
  UserProfile,
  AdminOrder,
  AdminCustomer,
  AdminReview,
  OrderStats,
  PackagingOption,
  DashboardData,
  StockAlert,
  WhatsAppConfig,
  AuditEntry,
  Paginated,
  LabReport,
  LabParameter,
  DeliveryStop,
  RouteSheetResponse,
  SupportTicket,
} from '../types';

// Accepts either name: .env.staging defines VITE_API_URL while the original
// code read VITE_API_BASE_URL, so staging silently fell back to localhost.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'country_dairy_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Thrown for non-2xx responses, carrying the status so callers can branch. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractMessage(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed?.message)) return parsed.message.join('. ');
    return parsed?.message || fallback;
  } catch {
    return body || fallback;
  }
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();

    // An expired or revoked token should drop the session rather than leave
    // the console in a half-authenticated state.
    if (response.status === 401) {
      clearAdminToken();
    }

    throw new ApiError(response.status, extractMessage(body, response.statusText));
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

/**
 * What every paged admin list returns. `total` is the count matching the
 * filter, not the length of `items` — without it there is no way to tell a
 * last page from a truncated one, which is exactly what these lists used to do.
 */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Removes the fields the server owns before a product is sent back.
 *
 * The console loads a product from the API and posts the same shape back. That
 * payload carries ids, timestamps, foreign keys and computed display orders,
 * and the API validates with forbidNonWhitelisted — so every edit of an
 * existing product was rejected outright with a 400 listing thirty-odd
 * properties, while creating a new one worked because a blank form has none of
 * them. The console showed no error, so the save looked like it had happened.
 *
 * A variant keeps its `id`: the API matches on it to update a variant in place
 * rather than deleting and recreating it, which is what protects order history.
 */
function forSaving(product: Record<string, unknown>): Record<string, unknown> {
  const { id, createdAt, updatedAt, ...rest } = product;
  void id;
  void createdAt;
  void updatedAt;

  const strip = <T extends Record<string, unknown>>(row: T, keep: string[]) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (keep.includes(key)) out[key] = value;
    }
    return out;
  };

  // Allow-listed rather than deny-listed. A new column added to the database
  // then appears in the payload the moment the API accepts it, instead of
  // breaking every save until somebody remembers to add it to a deny list.
  const VARIANT_FIELDS = [
    'id', 'sku', 'sizeLabel', 'sellingPrice', 'mrpPrice', 'stockQuantity',
    'lowStockThreshold', 'packagingCode', 'weightGrams', 'barcode',
    'lengthCm', 'widthCm', 'heightCm', 'imageUrl', 'isActive', 'showOnHome',
  ];
  const IMAGE_FIELDS = [
    'imageUrl', 'mediaType', 'thumbnailUrl', 'durationSeconds', 'isPrimary',
    'variantId', 'isVariantPrimary', 'altText',
  ];

  if (Array.isArray(rest.variants)) {
    rest.variants = (rest.variants as Record<string, unknown>[]).map((v) =>
      strip(v, VARIANT_FIELDS),
    );
  }
  if (Array.isArray(rest.galleryImages)) {
    rest.galleryImages = (rest.galleryImages as Record<string, unknown>[]).map((g) =>
      strip(g, IMAGE_FIELDS),
    );
  }

  return rest;
}

export const adminApi = {
  // Auth API
  async login(email: string, password: string): Promise<{ accessToken: string; user: UserProfile }> {
    return fetchJson<{ accessToken: string; user: UserProfile }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getCurrentUser(): Promise<UserProfile> {
    return fetchJson<UserProfile>('/auth/me');
  },

  // Media Upload API (Pre-Signed URL Object Storage Pattern)
  async uploadMedia(
    file: Blob,
    filename: string = 'image.webp',
    bucket: string = 'hero-banners',
    // Was pinned to image/webp, so a video was stored with an image content
    // type and would not play back.
    contentType: string = 'image/webp',
  ): Promise<string> {
    // 1. Fetch pre-signed upload URL from backend API
    const presigned = await fetchJson<{ uploadUrl: string; fileUrl: string; method?: string }>(
      `/media/presigned-url?filename=${encodeURIComponent(filename)}` +
        `&contentType=${encodeURIComponent(contentType)}&bucket=${bucket}`
    );

    const { uploadUrl, fileUrl, method = 'POST' } = presigned;

    // 2. Direct upload to object storage uploadUrl (S3 or local handler)
    let uploadRes: Response;
    if (method === 'PUT' && !uploadUrl.includes('/media/upload')) {
      // Direct S3 / R2 Object Storage PUT Upload
      uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
    } else {
      // Local multipart handler fallback
      const formData = new FormData();
      formData.append('file', file, filename);
      
      const token = localStorage.getItem('country_dairy_admin_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Direct media upload failed (${uploadRes.status}): ${errText}`);
      }

      const resData = await uploadRes.json();
      console.log('[adminApi.uploadMedia] Upload response:', resData);
      return resData.url || fileUrl;
    }

    if (!uploadRes.ok) {
      throw new Error(`Direct media upload failed (${uploadRes.status})`);
    }

    return fileUrl;
  },

  async deleteMedia(url: string): Promise<void> {
    if (!url) return;
    try {
      await fetchJson<void>('/media/delete', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    } catch (err) {
      console.warn('adminApi.deleteMedia warning:', err);
    }
  },

  // Products API — the admin routes return every status. The public
  // /catalog/products endpoint is pinned to LIVE so drafts stay unlisted.
  async getProducts(categoryId?: string, search?: string, status?: string): Promise<Product[]> {
    const query = new URLSearchParams();
    if (categoryId) query.append('categoryId', categoryId);
    if (search) query.append('search', search);
    if (status) query.append('status', status);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchJson<Product[]>(`/catalog/admin/products${queryString}`);
  },

  async getProduct(slugOrId: string): Promise<Product> {
    return fetchJson<Product>(`/catalog/admin/products/${slugOrId}`);
  },

  async getPackagingOptions(): Promise<PackagingOption[]> {
    return fetchJson<PackagingOption[]>('/catalog/packaging-options');
  },

  async createProduct(product: Product): Promise<Product> {
    return fetchJson<Product>('/catalog/products', {
      method: 'POST',
      body: JSON.stringify(forSaving(product as unknown as Record<string, unknown>)),
    });
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    return fetchJson<Product>(`/catalog/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(forSaving(product as unknown as Record<string, unknown>)),
    });
  },

  async toggleSubscription(id: string): Promise<Product> {
    return fetchJson<Product>(`/catalog/products/${id}/toggle-subscription`, {
      method: 'PATCH',
    });
  },

  async deleteProduct(id: string): Promise<void> {
    return fetchJson<void>(`/catalog/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Categories API
  async getCategories(): Promise<CategoryItem[]> {
    return fetchJson<CategoryItem[]>('/catalog/admin/categories');
  },

  async createCategory(category: Partial<CategoryItem>): Promise<CategoryItem> {
    return fetchJson<CategoryItem>('/catalog/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  },

  async updateCategory(id: string, category: Partial<CategoryItem>): Promise<CategoryItem> {
    return fetchJson<CategoryItem>(`/catalog/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(category),
    });
  },

  async deleteCategory(id: string): Promise<void> {
    return fetchJson<void>(`/catalog/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // CMS API
  async getHeroBanners(deviceType?: 'DESKTOP' | 'MOBILE'): Promise<HeroBanner[]> {
    const query = deviceType ? `?deviceType=${deviceType}` : '';
    return fetchJson<HeroBanner[]>(`/cms/hero${query}`);
  },

  async createHeroBanner(banner: Partial<HeroBanner>): Promise<HeroBanner> {
    return fetchJson<HeroBanner>('/cms/hero', {
      method: 'POST',
      body: JSON.stringify(banner),
    });
  },

  async updateHeroBanner(id: string, banner: Partial<HeroBanner>): Promise<HeroBanner> {
    return fetchJson<HeroBanner>(`/cms/hero/${id}`, {
      method: 'PUT',
      body: JSON.stringify(banner),
    });
  },

  async deleteHeroBanner(id: string): Promise<void> {
    return fetchJson<void>(`/cms/hero/${id}`, {
      method: 'DELETE',
    });
  },

  async getTrustBadges(): Promise<TrustBadge[]> {
    return fetchJson<TrustBadge[]>('/cms/trust-badges');
  },

  async createTrustBadge(badge: Partial<TrustBadge>): Promise<TrustBadge> {
    return fetchJson<TrustBadge>('/cms/trust-badges', {
      method: 'POST',
      body: JSON.stringify(badge),
    });
  },

  async updateTrustBadge(id: string, badge: Partial<TrustBadge>): Promise<TrustBadge> {
    return fetchJson<TrustBadge>(`/cms/trust-badges/${id}`, {
      method: 'PUT',
      body: JSON.stringify(badge),
    });
  },

  async deleteTrustBadge(id: string): Promise<void> {
    return fetchJson<void>(`/cms/trust-badges/${id}`, { method: 'DELETE' });
  },

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return fetchJson<FeatureFlag[]>('/cms/feature-flags');
  },

  /** Flat { KEY: boolean } map, for gating UI without matching on rows. */
  async getFeatureFlagMap(): Promise<Record<string, boolean>> {
    return fetchJson<Record<string, boolean>>('/cms/feature-flags/map');
  },

  async toggleFeatureFlag(key: string): Promise<FeatureFlag> {
    return fetchJson<FeatureFlag>(`/cms/feature-flags/${key}/toggle`, {
      method: 'PATCH',
    });
  },

  // Staff & Customers API
  async getStaff(): Promise<UserProfile[]> {
    return fetchJson<UserProfile[]>('/users/staff');
  },

  async createStaff(payload: {
    email: string;
    name: string;
    password: string;
    role: string;
  }): Promise<UserProfile> {
    return fetchJson<UserProfile>('/users/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateStaff(
    id: string,
    payload: { name?: string; role?: string; isActive?: boolean },
  ): Promise<UserProfile> {
    return fetchJson<UserProfile>(`/users/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async resetStaffPassword(id: string, password: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`/users/staff/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
  },

  async getDrivers(): Promise<{ id: string; name: string | null; phone: string | null }[]> {
    return fetchJson<{ id: string; name: string | null; phone: string | null }[]>('/users/drivers');
  },

  async getCustomers(
    search?: string,
    paging: { page?: number; pageSize?: number } = {},
  ): Promise<Page<AdminCustomer>> {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    if (paging.page) query.append('page', String(paging.page));
    if (paging.pageSize) query.append('pageSize', String(paging.pageSize));
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchJson<Page<AdminCustomer>>(`/users/customers${queryString}`);
  },

  async getCustomer(id: string): Promise<AdminCustomer> {
    return fetchJson<AdminCustomer>(`/users/customers/${id}`);
  },

  /**
   * Erase a customer at their request. Irreversible, super admin only.
   *
   * Past orders survive with the address redacted, because the invoice is a
   * tax record and cannot go with the person.
   */
  async eraseCustomer(id: string, reason?: string): Promise<{ ordersRetained: number; message: string }> {
    return fetchJson(`/users/customers/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: reason?.trim() || undefined }),
    });
  },

  // WhatsApp ordering config
  // --- Local delivery ---

  async getRouteSheets(date?: string): Promise<RouteSheetResponse> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchJson<RouteSheetResponse>(`/delivery/routes${query}`);
  },

  async assignRoute(orderIds: string[], driverId: string | null): Promise<{ assigned: number }> {
    return fetchJson<{ assigned: number }>('/delivery/routes/assign', {
      method: 'POST',
      body: JSON.stringify({ orderIds, driverId }),
    });
  },

  async getMyDeliveries(): Promise<DeliveryStop[]> {
    return fetchJson<DeliveryStop[]>('/delivery/my-deliveries');
  },

  async getMyCompletedDeliveries(): Promise<DeliveryStop[]> {
    return fetchJson<DeliveryStop[]>('/delivery/my-deliveries/completed');
  },

  async markDelivered(orderId: string, note?: string): Promise<DeliveryStop> {
    return fetchJson<DeliveryStop>(`/delivery/${orderId}/delivered`, {
      method: 'PATCH',
      body: JSON.stringify(note ? { note } : {}),
    });
  },

  async markDeliveryFailed(orderId: string, reason: string): Promise<DeliveryStop> {
    return fetchJson<DeliveryStop>(`/delivery/${orderId}/failed`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  // --- Batch lab reports ---

  async getLabReports(productId?: string): Promise<LabReport[]> {
    const query = productId ? `?productId=${encodeURIComponent(productId)}` : '';
    return fetchJson<LabReport[]>(`/lab-reports/admin${query}`);
  },

  async createLabReport(payload: {
    productId: string;
    batchNumber: string;
    testDate: string;
    labName?: string;
    fileUrl?: string;
    notes?: string;
    parameters?: LabParameter[];
    isPublished?: boolean;
  }): Promise<LabReport> {
    return fetchJson<LabReport>('/lab-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateLabReport(id: string, payload: Partial<Omit<LabReport, 'id'>>): Promise<LabReport> {
    return fetchJson<LabReport>(`/lab-reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteLabReport(id: string): Promise<void> {
    await fetchJson<void>(`/lab-reports/${id}`, { method: 'DELETE' });
  },

  async getWhatsAppConfig(): Promise<WhatsAppConfig> {
    return fetchJson<WhatsAppConfig>('/cms/whatsapp');
  },

  async setWhatsAppConfig(config: WhatsAppConfig): Promise<WhatsAppConfig> {
    return fetchJson<WhatsAppConfig>('/cms/whatsapp', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },


  // Customer queries
  /**
   * One thread, in full. The list omits order line items because no row shows
   * them and loading every order to render a page of the inbox would be
   * absurd — so opening a thread has to ask for the rest.
   */
  async getTicket(id: string): Promise<SupportTicket> {
    return fetchJson<SupportTicket>(`/support/admin/${id}`);
  },

  async getTickets(
    filters: { status?: string; search?: string; page?: number; pageSize?: number } = {},
  ): Promise<Page<SupportTicket>> {
    const q = new URLSearchParams();
    if (filters.status) q.append('status', filters.status);
    if (filters.search) q.append('search', filters.search);
    if (filters.page) q.append('page', String(filters.page));
    if (filters.pageSize) q.append('pageSize', String(filters.pageSize));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<Page<SupportTicket>>(`/support/admin${qs}`);
  },

  async getTicketStats(): Promise<Record<string, number>> {
    return fetchJson<Record<string, number>>('/support/admin/stats');
  },

  async replyToTicket(id: string, body: string): Promise<unknown> {
    return fetchJson(`/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async setTicketStatus(id: string, status: string): Promise<SupportTicket> {
    return fetchJson<SupportTicket>(`/support/admin/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Audit log API
  async getAuditLog(
    filters: {
      entity?: string;
      action?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<Page<AuditEntry>> {
    const query = new URLSearchParams();
    if (filters.entity) query.append('entity', filters.entity);
    if (filters.action) query.append('action', filters.action);
    if (filters.search) query.append('search', filters.search);
    if (filters.page) query.append('page', String(filters.page));
    if (filters.pageSize) query.append('pageSize', String(filters.pageSize));
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchJson<Page<AuditEntry>>(`/audit${queryString}`);
  },

  async getAuditFilters(): Promise<{ entities: string[]; actions: string[] }> {
    return fetchJson<{ entities: string[]; actions: string[] }>('/audit/filters');
  },

  // Analytics API
  async getDashboard(days = 7): Promise<DashboardData> {
    return fetchJson<DashboardData>(`/analytics/dashboard?days=${days}`);
  },

  async getStockAlerts(): Promise<StockAlert[]> {
    return fetchJson<StockAlert[]>('/analytics/stock-alerts');
  },

  // Reviews. There is no approval queue — reviews publish immediately, so the
  // only two lists are what is live and what has been taken down.
  async getReviewsAdmin(
    deleted = false,
    search?: string,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<AdminReview>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (deleted) query.append('deleted', 'true');
    if (search) query.append('search', search);
    return fetchJson<Paginated<AdminReview>>(`/reviews/admin?${query.toString()}`);
  },

  async getReviewStats(): Promise<{ live: number; deleted: number }> {
    return fetchJson<{ live: number; deleted: number }>('/reviews/admin/stats');
  },

  /** Hide from customers. Recoverable, and the attachments are kept. */
  async deleteReview(id: string): Promise<AdminReview> {
    return fetchJson<AdminReview>(`/reviews/admin/${id}`, { method: 'DELETE' });
  },

  async restoreReview(id: string): Promise<AdminReview> {
    return fetchJson<AdminReview>(`/reviews/admin/${id}/restore`, { method: 'POST' });
  },

  /** Gone for good, attachments included. Only valid on an already-deleted review. */
  async destroyReview(id: string): Promise<void> {
    return fetchJson<void>(`/reviews/admin/${id}/permanent`, { method: 'DELETE' });
  },

  // Admin Orders API
  async getOrdersAdmin(
    status?: string,
    search?: string,
    paging: { page?: number; pageSize?: number } = {},
  ): Promise<Page<AdminOrder>> {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (search) query.append('search', search);
    if (paging.page) query.append('page', String(paging.page));
    if (paging.pageSize) query.append('pageSize', String(paging.pageSize));
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchJson<Page<AdminOrder>>(`/orders/admin/all${queryString}`);
  },

  async getOrderStatsAdmin(): Promise<OrderStats> {
    return fetchJson<OrderStats>('/orders/admin/stats');
  },

  /**
   * Moves an order between the local round and the courier desk. Nothing at
   * checkout can know whether an address is inside the van's area, so this is
   * the desk's call.
   */
  async setOrderDeliveryType(
    orderId: string,
    deliveryType: 'LOCAL' | 'COURIER',
    note?: string,
  ): Promise<AdminOrder> {
    return fetchJson<AdminOrder>(`/orders/admin/${orderId}/delivery-type`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryType, ...(note ? { note } : {}) }),
    });
  },

  async updateOrderStatusAdmin(
    orderId: string,
    status: string,
    options: {
      driverId?: string;
      trackingNumber?: string;
      shippingCarrier?: string;
      note?: string;
    } = {},
  ): Promise<AdminOrder> {
    return fetchJson<AdminOrder>(`/orders/admin/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...options }),
    });
  },

  /**
   * Frees stock held by checkouts nobody paid for.
   *
   * Run from here because nothing runs it automatically: there is no scheduler
   * in the API, and the free hosting plan sleeps when idle, so a timer inside
   * the process would not fire dependably. Safe to press repeatedly — it only
   * looks at orders past the window, and asks the gateway before releasing
   * anything.
   */
  async expireAbandonedOrders(olderThanMinutes?: number): Promise<{
    examined: number;
    released: number;
    settled: number;
    failed: number;
  }> {
    return fetchJson('/orders/admin/expire-abandoned', {
      method: 'POST',
      body: JSON.stringify(olderThanMinutes ? { olderThanMinutes } : {}),
    });
  },
};
