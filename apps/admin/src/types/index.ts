export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'CATALOG_MANAGER' 
  | 'ORDER_MANAGER' 
  | 'DELIVERY_DRIVER' 
  | 'CUSTOMER';

/** Mirrors what GET /auth/me returns. */
export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  walletBalance?: string | number;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Display helper — the API stores a single optional name. */
export function displayName(user: Pick<UserProfile, 'name' | 'email'>): string {
  return user.name || user.email?.split('@')[0] || 'Unknown user';
}

// Availability is derived from variant stock, so OUT_OF_STOCK is no longer a
// lifecycle status. Use Product.forceOutOfStock for a manual override.
export type ProductStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED';

/**
 * Packaging is a database lookup table now, so new vessels (amber bottles for
 * oil, squeeze bottles for honey) are added from the admin rather than by
 * editing this union. Kept as a string for that reason.
 */
export type PackagingType = string;

export interface PackagingOption {
  code: string;
  label: string;
  displayOrder?: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface AdminOrderItem {
  id: string;
  productTitle: string;
  variantSizeLabel: string;
  sku: string;
  imageUrl?: string | null;
  hsnCode?: string | null;
  quantity: number;
  unitPrice: string | number;
  mrpPrice: string | number;
  gstRate: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryType: 'LOCAL' | 'COURIER';
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  deliveryCharges: string | number;
  totalAmount: string | number;
  couponCode?: string | null;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  customerNote?: string | null;
  shippingAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    phone?: string | null;
  };
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  driver?: { id: string; name: string | null } | null;
  orderItems: AdminOrderItem[];
  createdAt: string;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
}

export interface AdminCustomer extends UserProfile {
  walletBalance?: string | number;
  /** Set once the account has been erased; the row stays, the person does not. */
  deletedAt?: string | null;
  totalOrders?: number;
  totalSpent?: number;
  addresses?: {
    id: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    phone?: string | null;
    isDefault: boolean;
  }[];
  orders?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalAmount: string | number;
    createdAt: string;
  }[];
}

export interface WhatsAppConfig {
  isEnabled: boolean;
  phoneNumber: string;
  messageTemplate: string;
  cartMessageTemplate: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  currentStock: number;
  threshold: number;
  type: 'OUT_OF_STOCK' | 'LOW_STOCK';
  updatedAt: string;
}

export interface DashboardData {
  periodDays: number;
  totals: {
    pageViews: number;
    productViews: number;
    whatsappClicks: number;
    addToCart: number;
    orders: number;
  };
  pageViewsByDay: ChartPoint[];
  whatsappClicksByDay: ChartPoint[];
  revenueByDay: ChartPoint[];
  deviceSplit: ChartPoint[];
  topProducts: { productId: string | null; title: string; views: number }[];
  stockAlerts: StockAlert[];
}

/** Envelope for any list the API pages. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminReview {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  mediaUrls: string[];
  /** Parallel to mediaUrls: mediaTypes[i] describes mediaUrls[i]. */
  mediaTypes?: MediaType[];
  isVerifiedPurchase: boolean;
  createdAt: string;
  editedAt?: string | null;
  /** Set means hidden from customers but recoverable from the deleted list. */
  deletedAt?: string | null;
  deletedBy?: string | null;
  user: { id: string; name: string | null; email: string | null };
  product: { id: string; title: string; slug: string };
}

export interface OrderStats {
  byStatus: Partial<Record<OrderStatus, number>>;
  totalRevenue: number;
  ordersToday: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  displayOrder: number;
  isActive: boolean;
  /**
   * Set when this is a type within a category — Desi Ghee under Ghee. Null for
   * a category in its own right. Two levels only; a type cannot have types.
   */
  parentId?: string | null;
  /** Promoted to the storefront nav bar rather than living in its dropdown. */
  showInNav?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  sizeLabel: string;
  sellingPrice: number;
  mrpPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  /** Code from the PackagingOption lookup table, e.g. GLASS_JAR. */
  packagingCode?: string | null;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Gives this size its own card on the homepage shelf. */
  showOnHome?: boolean;

  /**
   * Shipping dimensions. Couriers price on weight, and on volumetric weight
   * where the box is bulky for what it holds — a courier quote without these
   * is a guess.
   *
   * They were saveable through the API and absent from this type, so the
   * product editor had no way to offer them and every variant went out
   * weighing nothing.
   */
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  barcode?: string | null;
}

export type MediaType = 'IMAGE' | 'VIDEO';

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  /** Gallery entries carry video as well as stills. */
  mediaType?: MediaType;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  altText?: string;
  variantId?: string;
  displayOrder: number;
  isPrimary: boolean;
  isVariantPrimary?: boolean;
  createdAt?: string;
}

export interface Product {
  /** Batch number of the newest published lab report, null when untested. */
  latestBatchNumber?: string | null;
  latestBatchTestDate?: string | null;

  id: string;
  categoryId?: string;
  categoryName?: string;
  title: string;
  slug: string;
  tagline?: string;
  storyDescription?: string;
  status: ProductStatus;
  /** Manual storefront override, independent of the lifecycle status. */
  forceOutOfStock?: boolean;
  badgeText?: string;
  isFeatured: boolean;
  displayOrder: number;
  isSubscriptionAllowed?: boolean;
  /** Indian GST compliance — differs per product line. */
  hsnCode?: string | null;
  gstRate?: string | number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  nutritionFacts?: Record<string, string>;
  specifications?: Record<string, string>;
  metadata?: Record<string, any>;
  variants?: ProductVariant[];
  galleryImages?: ProductImage[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaLabel: string;
  ctaLink: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  overlayOpacity: number;
  sortOrder: number;
  /** Placement of the text on the artwork. Null keeps the original stack. */
  layout?: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors an AuditLog row as returned by GET /audit. */
export interface AuditEntry {
  id: string;
  userId?: string | null;
  userName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  payloadBefore?: Record<string, unknown> | null;
  payloadAfter?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string | null; role: UserRole } | null;
}

export interface FeatureFlags {
  ENABLE_WEBSITE_PAYMENT: boolean;
  ENABLE_PRODUCT_RATINGS: boolean;
  ENABLE_SUBSCRIPTIONS: boolean;
  ENABLE_CART: boolean;
  ENABLE_USER_ACCOUNTS: boolean;
}

export type CategoryItem = Category;

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  deviceType: 'DESKTOP' | 'MOBILE';
  ctaText: string;
  ctaLink: string;
  badgeText?: string;
  displayOrder: number;
  isActive: boolean;
  /** Where the text sits and how it is set. Null means the original stack. */
  layout?: unknown;
}

export interface TrustBadge {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
}

/** One tested row on a lab report. */
export interface LabParameter {
  name: string;
  value: string;
  /** The permissible limit measured against, e.g. "min 99.5%". */
  standard?: string;
  /** Undefined when the lab gave a figure without a pass/fail verdict. */
  passed?: boolean;
}

export interface LabReport {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  batchNumber: string;
  testDate: string;
  labName: string | null;
  /** Relative bucket path (/lab-reports/x.pdf) or an https URL. */
  fileUrl: string | null;
  notes: string | null;
  parameters: LabParameter[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Local delivery ---

export interface DeliveryStop {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  addressLine: string;
  area: string;
  pincode: string;
  itemsSummary: string;
  itemCount: number;
  /** What the driver collects at the door; 0 when already paid online. */
  amountToCollect: number;
  totalAmount: number;
  isCashOnDelivery: boolean;
  status: OrderStatus;
  driverId: string | null;
  driverName: string | null;
  customerNote: string | null;
  placedAt: string;
}

export interface RouteSheet {
  pincode: string;
  area: string;
  stops: DeliveryStop[];
  stopCount: number;
  cashToCollect: number;
  driverIds: string[];
}

export interface RouteSheetResponse {
  date: string;
  routes: RouteSheet[];
  unassignedCount: number;
  totalStops: number;
  totalCashToCollect: number;
}

export type SupportStatus = 'OPEN' | 'AWAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';

export interface SupportMessage {
  id: string;
  authorName: string;
  /** Recorded on the message, not derived from the author's current role. */
  fromStaff: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketRef: string;
  subject: string;
  status: SupportStatus;
  createdAt: string;
  lastReplyAt?: string | null;
  user?: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  /** Set instead of `user` when the query came from the contact form. */
  contactName?: string | null;
  contactEmail?: string | null;
  /**
   * `items` and `createdAt` arrive only when a single thread is opened — the
   * inbox list omits them, so treat them as optional even on a ticket that
   * has an order.
   */
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string;
    createdAt?: string;
    orderItems?: SupportOrderItem[];
  } | null;
  messages: SupportMessage[];
}

/** A line as it was at checkout, not as the catalogue reads today. */
export interface SupportOrderItem {
  id: string;
  productTitle: string;
  variantSizeLabel: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: string;
  product?: { id: string; slug: string } | null;
}
