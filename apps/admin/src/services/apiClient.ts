import type { Product, CategoryItem, HeroBanner, TrustBadge, FeatureFlag } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('country_dairy_admin_token');
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
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const adminApi = {
  // Media Upload API (Pre-Signed URL Object Storage Pattern)
  async uploadMedia(file: Blob, filename: string = 'image.webp', bucket: string = 'hero-banners'): Promise<string> {
    // 1. Fetch pre-signed upload URL from backend API
    const presigned = await fetchJson<{ uploadUrl: string; fileUrl: string; method?: string }>(
      `/media/presigned-url?filename=${encodeURIComponent(filename)}&contentType=image/webp&bucket=${bucket}`
    );

    const { uploadUrl, fileUrl, method = 'POST' } = presigned;

    // 2. Direct upload to object storage uploadUrl (S3 or local handler)
    let uploadRes: Response;
    if (method === 'PUT' && !uploadUrl.includes('/media/upload')) {
      // Direct S3 / R2 Object Storage PUT Upload
      uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/webp',
        },
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

  // Products API
  async getProducts(categoryId?: string, search?: string, status?: string): Promise<Product[]> {
    const query = new URLSearchParams();
    if (categoryId) query.append('categoryId', categoryId);
    if (search) query.append('search', search);
    if (status) query.append('status', status);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchJson<Product[]>(`/catalog/products${queryString}`);
  },

  async createProduct(product: Product): Promise<Product> {
    return fetchJson<Product>('/catalog/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    return fetchJson<Product>(`/catalog/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
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
    return fetchJson<CategoryItem[]>('/catalog/categories');
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

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return fetchJson<FeatureFlag[]>('/cms/feature-flags');
  },

  async toggleFeatureFlag(key: string): Promise<FeatureFlag> {
    return fetchJson<FeatureFlag>(`/cms/feature-flags/${key}/toggle`, {
      method: 'PATCH',
    });
  },
};
