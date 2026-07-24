# Country Dairy Admin Panel — Comprehensive Architecture & UX Flows Plan

## Table of Contents
1. [Infrastructure & Deployment Strategy](#infrastructure)
2. [Storage, CDN & Media Pipeline](#storage)
3. [Authentication & Credential Management](#auth)
4. [Role-Based Access Control (RBAC)](#rbac)
5. [Admin Panel Components & UX Flows](#components)
6. [Inventory & Out-of-Stock Management](#inventory)
7. [Basic Analytics Dashboard](#analytics)
8. [Audit Logs & Change History](#audit)
9. [Future-Ready CMS Modules](#cms)
10. [Error Handling & Resilience](#errors)
11. [Implementation Sequence](#sequence)
12. [Verification Plan](#verification)

---

## 1. Infrastructure & Deployment Strategy {#infrastructure}

### Staging Environment (Before Production)

> [!IMPORTANT]
> For MVP, all changes go directly to production. However, the architecture is designed from day one to support a full staging pipeline with a single environment variable toggle.

**MVP (Now):** `main` branch → direct deploy to Production (Vercel + Supabase Prod).

**Future-Ready Design (When Needed):**
```
Developer → Git Push → Preview Branch
                         ↓
                   Staging Environment
                   (Supabase Staging DB)
                   (Vercel Preview URL)
                         ↓
               Admin Review & QA Testing
                         ↓
                   Production Deploy
                   (Supabase Prod DB)
                   (Vercel Production URL)
```

**How We Make It Flexible Now:**
- All environment configs isolated in `.env.local` (Supabase URL, API keys).
- A single `NEXT_PUBLIC_ENV=staging|production` flag controls data source.
- Admin Panel CMS changes write to `cms_drafts` table first; a **"Publish to Live"** button promotes to `cms_live` table (works for both MVP and staging pipeline).

---

## 2. Storage, CDN & Media Pipeline {#storage}

### Supabase Storage (Built on AWS S3)
- S3-compatible bucket storage with integrated global CDN (Cloudflare/Fastly).
- Automatic image resizing, WebP/AVIF transformation via Supabase Transform API.
- Row-Level Security (RLS) policies control read/write access per role.

### Cost Breakdown
| Tier | Storage | CDN Bandwidth | Cost |
| :--- | :--- | :--- | :--- |
| **Free Tier** | 1 GB | 2 GB/month | **₹0/month** |
| **Pro Plan** | 100 GB | 50 GB/month | **$25/month (~₹2,050)** |
| **Overage** | +$0.021/GB | +$0.09/GB | Pay-as-you-go |

### Why CDN Cost Stays Near ₹0
1. **Local Device Cache** (`Cache-Control: max-age=31536000`): After first load, images are served from user's device disk — 0 CDN bandwidth consumed on repeat visits.
2. **Client-Side WebP Compression**: Raw 4MB photo → compressed to ~150–300 KB before upload.
3. **At free tier pricing**: 1 GB storage ÷ 150 KB avg image = **~6,800 product photos for ₹0**.
4. **Cloudflare Free Tier (Future Scale)**: Unlimited CDN bandwidth at ₹0 if pointed through Cloudflare DNS.

### 5MB Upload Limit Policy
- **Client-Side**: `file.size <= 5 * 1024 * 1024` validation. Immediate error toast on violation.
- **Server-Side**: Supabase bucket configured with `file_size_limit: 5242880`.
- **Compression Pipeline**: Browser Canvas API auto-converts JPG/PNG to WebP at 85% quality before upload (no user action needed).

### Supabase Storage Buckets
| Bucket | Contents | Max File Size | Access |
| :--- | :--- | :--- | :--- |
| `product-images/` | Product gallery photos | 5 MB | Public (CDN) |
| `hero-banners/` | Hero carousel banners | 5 MB | Public (CDN) |
| `lab-certificates/` | Batch purity PDF reports | 5 MB | Public (CDN) |

---

## 3. Authentication & Credential Management {#auth}

### Login Screen (`apps/admin/src/pages/Login.tsx`)
- Branded card with Country Dairy logo + "Admin Console Sign In".
- Email + Password form with "Sign In" button.
- Unauthenticated route access automatically redirected to `/login` via `<RequireAuth>` guard.

### Super Admin Controls All Credentials
> [!IMPORTANT]
> **No self-service password reset.** All admin user accounts are created and managed exclusively by the Super Admin. This prevents unauthorized access attempts via email reset flows and keeps credential control centralized.

**Credential Lifecycle:**
1. Super Admin creates a staff account from `/settings/users` with a temporary password.
2. Super Admin securely shares credentials with the employee (WhatsApp/Phone).
3. If employee loses access → Super Admin resets the password directly from the Admin Panel user management page.
4. When an employee leaves → Super Admin immediately **Deactivates** their account (blocks all sessions instantly via Supabase Auth `admin.deleteUser()`).

### Session Management
- JWT tokens issued by Supabase Auth with **1-hour expiry**.
- **Silent auto-refresh**: Supabase `onAuthStateChange` listener refreshes tokens every 55 minutes in the background — admin never gets logged out mid-task.
- **Hard logout after 24 hours idle** (configurable) to protect unattended terminals.
- Active sessions listed in `/settings/users` — Super Admin can **Revoke All Sessions** for any user instantly.

### Post-Login Automatic Redirection
```typescript
export type UserRole = 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'ORDER_MANAGER' | 'DELIVERY_DRIVER';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string;
}
```

| Role | Redirects To | Default Landing |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | `/overview` | Full Dashboard |
| `CATALOG_MANAGER` | `/inventory` | Product Catalog |
| `ORDER_MANAGER` | `/orders` | Order Queue |
| `DELIVERY_DRIVER` | `/driver` | Today's Deliveries |

---

## 4. Role-Based Access Control (RBAC) {#rbac}

### System Roles & Permission Matrix

| User Role | Accessible Modules | Key Restrictions |
| :--- | :--- | :--- |
| **Super Admin** | ALL modules + Settings + User Management | No restrictions |
| **Catalog Manager** | Hero Carousel, Products, Variants, Categories, CMS Banners | No access to Orders, Financials, Users |
| **Order & Stock Manager** | Orders, Inventory (Stock only), Customers, Wallets | No product description/price edits |
| **Delivery Driver** | `/driver` view only | Address + contact only, no customer financials |

### Route Guard Implementation
```tsx
<ProtectedRoute requiredPermissions={['CATALOG_MANAGE']}>
  <ProductEditorPage />
</ProtectedRoute>
```
Unauthorized access → clean **403 Access Denied** screen with "Return to Dashboard" button.

### Delivery Driver: Assignment & Confirmation Flow
1. **Order Manager** assigns a specific local-delivery order to a Driver account from the `/orders` page.
2. Driver logs in → `/driver` shows only their assigned orders for today.
3. Driver view shows: Customer name, address (Google Maps deep link), phone number (one-tap call), order items.
4. Driver taps **"Mark as Delivered"** → triggers OTP sent to customer's phone (via Twilio/MSG91). Customer confirms with OTP → order marked `DELIVERED`.
5. If no OTP confirmation within 10 minutes → auto-escalates to Order Manager for manual verification.

> [!NOTE]
> Driver login uses the same Admin Panel URL. The role-based redirect sends them directly to `/driver` — they never see any other admin screens.

---

## 5. Admin Panel Components & UX Flows {#components}

### Component 1: Hero Carousel Manager (`/hero-carousel`)
- **Constraints**: Min 1 slide, Max 6 slides. Max 5 MB per image.
- **Slide Schema**: `title`, `subtitle`, `badgeText`, `ctaLabel`, `ctaLink`, `desktopImageUrl`, `mobileImageUrl`, `overlayOpacity`, `isActive`, `sortOrder`.

**UX Flow:**
1. Grid of up to 6 slide cards with drag-to-reorder handles, status badge (`Live` / `Draft`), and counter **"Active Slides: 4 / 6"**.
2. If at 6 active slides → "+ Add Slide" button disabled with tooltip: *"Maximum 6 hero slides allowed"*.
3. Slide Editor Drawer:
   - Desktop + Mobile image uploaders (5MB max, auto-WebP compressed).
   - Text fields: Badge Tag, Title, Subtitle, CTA Label + CTA Link Picker.
   - Overlay opacity range slider (0–70%).
   - Live desktop/mobile preview switcher.
4. "Publish" writes to `cms_live` table → real-time storefront update.

---

### Component 2: Product & Variant Manager (`/inventory`)

**UX Flow (Tabbed Editor):**

**Tab 1: Core Details**
- Title, Auto-slug, Category, Farm Story (Rich Text), Highlight Badge (`★ Best Seller`), Discount Badge (`14% OFF`).
- **Product Status Selector**: `Live` / `Draft` / `Archived` / `Out of Stock (Manual Override)`.

**Tab 2: Image Gallery (Min 1, Max 10, 5MB each)**
- Drag-and-drop grid uploader → Supabase `product-images/` bucket.
- Star icon to mark Primary Thumbnail.
- Counter: **"Uploaded: 4 / 10"**.
- Delete icon per image (with confirmation: *"This image will be permanently removed"*).

**Tab 3: Variant Matrix**
- Table of all size options (500ml, 1L, 2.5L Dolchi, 5L Dolchi).
- Per-variant fields: Selling Price (₹), MRP/Original Price (₹), Stock Quantity, SKU, Packaging Type, Variant-specific Image.
- "+ Add Variant" modal for new sizes.
- When stock = 0 → row highlights red with badge **"Out of Stock"**.

**Tab 4: Specifications & Nutrition Facts**
- Dynamic key-value editor for Nutrition (`Fat: 99.8g`, `Energy: 897 kcal`).
- Storage instructions, Shelf Life, Serving Size.

---

### Component 3: Add New Product Wizard (`/inventory/new`)
```
Step 1: Core Info → Step 2: Variants & Pricing → Step 3: Image Gallery → Step 4: Nutrition & Publish
```
- Step 2 includes **Variant Preset Templates** (e.g., *Ghee Pack Sizes*, *Milk Pack Sizes*) that auto-fill the variant table.
- Step 3 enforces 1–10 images with WebP compression.
- Step 4: Set `Live`, `Draft`, or `Homepage Featured` on publish.

---

## 6. Inventory & Out-of-Stock Management {#inventory}

### Product Status States
| Status | Storefront Display | Admin UI Indicator |
| :--- | :--- | :--- |
| `Live` | Fully visible, orderable | Green badge |
| `Draft` | Hidden from storefront | Grey badge |
| `Archived` | Hidden, preserved in order history | Dark badge |
| `Out of Stock` | Visible with "Out of Stock" banner, order button disabled | Red badge |

### Auto Out-of-Stock Logic
- When a variant's **Stock Quantity reaches 0** (via manual stock adjustment or fulfilled order):
  - Storefront automatically shows **"Out of Stock"** badge on that variant chip.
  - WhatsApp order button is disabled for that variant.
  - If **all variants** of a product reach 0 → entire product card shows "Out of Stock" overlay.

### Low-Stock & Out-of-Stock Admin Notifications
- **Low-Stock Alert**: When any variant stock drops to **≤ 10 units** → red notification badge appears on sidebar `Inventory` tab.
- **Out-of-Stock Alert**: When any variant hits 0 → Admin receives:
  - In-app notification toast: *"⚠️ Country Dairy A2 Vedic Ghee (1L Jar) is now Out of Stock!"*
  - WhatsApp message to Super Admin's registered number (via `WHATSAPP_NUMBER`).
- **Notification Log**: `/overview` dashboard displays a "Stock Alerts" panel with all recent low-stock/out-of-stock events.

---

## 7. Basic Analytics Dashboard {#analytics}

> [!NOTE]
> For MVP, we use **Vercel Analytics** (free tier, zero setup) + simple custom event tracking. No complex third-party tools needed initially.

### Metrics to Track (Free, Privacy-Friendly)
| Metric | How Tracked | Dashboard View |
| :--- | :--- | :--- |
| **Daily / Weekly Page Visits** | Vercel Analytics auto-capture | Line chart on Overview |
| **Product Page Views** | Vercel Analytics per-route | Top 5 products table |
| **WhatsApp Order Button Clicks** | Custom `analytics.track('whatsapp_order_click', {product, variant})` event | Bar chart per product |
| **Most Viewed Products** | Aggregated from page view events | Ranked list |
| **Mobile vs Desktop Visitors** | Vercel Analytics device split | Donut chart |

### Analytics Dashboard (`/overview` section)
- **Today's Summary Cards**: Total Page Views · WhatsApp Clicks Today · New Customers · Low-Stock Alerts.
- **7-Day Trend Chart**: Site visits + WhatsApp order clicks overlaid.
- **Top Products by Interest**: Ranked by product page views this week.
- **Conversion Funnel (Future)**: Page Views → WhatsApp Clicks → Confirmed Orders.

### Privacy Note
- Vercel Analytics is GDPR-compliant, requires no cookie consent banner, and collects no personal user data.

---

## 8. Audit Logs & Change History {#audit}

### Why This Is Critical
If a Catalog Manager accidentally sets Ghee price to ₹1, or deletes a product image, the Super Admin needs a complete history to identify who did it and revert instantly.

### What Gets Logged
| Action | Logged Fields |
| :--- | :--- |
| Product price/stock change | Field name, old value, new value, user, timestamp |
| Product created / archived | Product name, status, user, timestamp |
| Hero slide added / deleted | Slide title, image URL, user, timestamp |
| Variant added / removed | Variant name, product, user, timestamp |
| User account created / deactivated | User email, role, admin, timestamp |
| Feature flag toggled | Flag name, old state, new state, admin, timestamp |

### Audit Log UI (`/settings/audit-log`)
- Searchable/filterable table: filter by user, module, date range, action type.
- Each row expandable to show full JSON diff (old vs new values).
- **Revert Button** (Super Admin only): One-click rollback of the last N changes on a record.

---

## 9. Future-Ready CMS Modules {#cms}

### 9.1 Announcement Banner CMS (`/cms/announcement`)
- Enable/disable the top-of-page promotional strip.
- Edit message text: *"🎉 Free Shipping on orders above ₹499 | Direct Farm Delivery"*.
- Background color picker, text color picker, optional click-through URL.
- Preview renders live in the editor.

### 9.2 WhatsApp Template Customizer (`/cms/whatsapp`)
- Edit the pre-filled WhatsApp order message with dynamic tags:
  ```
  Hi! I'd like to order:
  - {quantity} x {product_name} ({variant}) — ₹{price} each
  Total Amount: ₹{total_amount}

  Please help me place this order. Thank you!
  ```
- Edit target WhatsApp number (e.g. switch to a new business number without code deploy).
- Live preview renders the formatted message below the editor.

### 9.3 Feature Flags Panel (`/settings/flags`)
| Flag | Description | Default |
| :--- | :--- | :--- |
| `ENABLE_WEBSITE_PAYMENT` | Toggle Cart/Checkout vs WhatsApp-only ordering | OFF |
| `ENABLE_PRODUCT_RATINGS` | Show/hide star rating + review counts | OFF |
| `ENABLE_SUBSCRIPTIONS` | Show/hide Subscribe & Save option | OFF |
| `ENABLE_CART` | Show/hide cart icon in navbar | OFF |
| `ENABLE_USER_ACCOUNTS` | Enable customer accounts & login | OFF |

- Toggle switches with confirmation modal: *"This change goes live immediately across Web & Mobile. Continue?"*
- Each flag change logged in Audit Log.

### 9.4 Batch Purity & Lab Certificate Manager (`/purity-lab`)
- Upload PDF lab test certificate per batch code (e.g. `BATCH-2026-GHEE03`).
- Link batch code to a product variant.
- System auto-generates a QR code that customers can scan from the product jar to view the purity report.
- Certificate PDF stored in Supabase `lab-certificates/` bucket.

### 9.5 Homepage Value Propositions CMS (`/cms/trust-badges`)
- Manage the 4 trust cards shown on the homepage:
  - Icon picker + Title + Subtitle for each card.
  - Example: *"🚚 Free Shipping — Orders Above ₹499"*.

### 9.6 User Management (`/settings/users`) — Super Admin Only
- Create new staff accounts (email + temporary password + role assignment).
- View last login time, active session indicator.
- Deactivate account (immediately revokes all active sessions).
- Reset password on behalf of an employee.
- **No employee self-service password reset allowed.**

---

## 10. Error Handling & Resilience {#errors}

### Upload Failure Strategy
- If Supabase upload fails mid-way: Error toast with **"Retry Upload"** button. Partial progress is preserved.
- Automatic retry: up to 3 attempts with exponential backoff.
- If all retries fail: Changes saved locally as `Draft` with banner: *"Changes saved locally. Sync when connection restores."*

### Network Drop During Product Save
- All form state auto-saved to `localStorage` every 30 seconds.
- If the user's session drops mid-save: On re-login, banner shows *"You have unsaved changes from your last session. Restore?"*

### Validation Errors
- Inline field-level errors (not just top-of-form alert).
- Product cannot be published if: no primary image, no active variant, empty title.
- Wizard Step navigation blocked if current step has validation errors.

---

## 11. Implementation Sequence {#sequence}

Build order is designed to deliver usable value at each stage:

```
Phase 1 (Foundation)
  ├── Login Screen + Auth Guard + Session Management
  ├── RBAC Route Guards + Dynamic Sidebar
  └── Super Admin User Management (/settings/users)

Phase 2 (Core CMS)
  ├── Product Editor (Tabs 1-4) + Image Gallery Manager
  ├── Hero Carousel Manager
  └── Add New Product Wizard

Phase 3 (Inventory Operations)
  ├── Out-of-Stock Auto-Detection + UI States
  ├── Low-Stock Notifications (in-app + WhatsApp alert)
  └── Audit Log (/settings/audit-log)

Phase 4 (Analytics & Intelligence)
  ├── Vercel Analytics Integration
  ├── WhatsApp Click Tracking Events
  └── Analytics Dashboard Widgets on /overview

Phase 5 (Advanced CMS)
  ├── Announcement Banner CMS
  ├── WhatsApp Template Customizer
  ├── Feature Flags Panel
  ├── Trust Badges CMS
  └── Batch Purity & Lab Certificates

Phase 6 (Delivery & Staging)
  ├── Driver Assignment + OTP Delivery Confirmation
  └── Staging Environment (Supabase Staging DB + Preview Deploy)
```

---

## 12. Verification Plan {#verification}

### Automated Build Verification
- Admin: `npm run build --workspace=admin`
- Web: `npm run build --workspace=web`
- Mobile: `npx expo export` in `apps/mobile`

### Functional Test Matrix
| Test | Expected Result |
| :--- | :--- |
| Upload 7MB image | Blocked with error toast before upload begins |
| Upload 4MB JPG | Auto-compressed to ~180KB WebP in browser, then uploaded |
| Visit `/overview` while logged out | Immediate redirect to `/login` |
| Catalog Manager visits `/settings/users` | 403 Access Denied screen |
| Add 7th hero slide | "+ Add Slide" button disabled with tooltip |
| Variant stock set to 0 | Storefront shows "Out of Stock" badge; WhatsApp button disabled |
| Variant stock drops to 10 | Red notification badge on admin sidebar Inventory tab |
| Idle session for 24 hours | Auto-logout, JWT invalidated |
| Feature flag toggled | Change appears live on storefront within 5 seconds |
| Product price changed | Audit log entry created with old/new values and editor's name |
