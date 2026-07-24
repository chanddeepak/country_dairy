# Country Dairy Admin Panel — Manual Verification Guide

**For:** Deepak Chand (Super Admin)
**Generated:** July 25, 2026
**Purpose:** Step-by-step manual verification checklist with exact instructions for every feature.

---

## 🚀 How to Start the Apps

```bash
# Terminal 1 — Admin Console (http://localhost:5173)
cd /Users/deepakchand/workspaces/country_dairy
npm run dev --workspace=admin

# Terminal 2 — Web Storefront (http://localhost:3000)
npm run dev --workspace=web

# Terminal 3 — Mobile App (Expo Go / Simulator)
cd apps/mobile
npx expo start
```

---

## Phase 1 — Authentication, RBAC & User Management

### VT-1.1 — Login Screen & Demo Presets
**Location:** http://localhost:5173 (when logged out)

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open admin at `localhost:5173` | Shows branded Admin Console login card with Country Dairy branding (cow emoji, amber gradient). |
| 2 | Click "SUPER ADMIN" quick login preset button | Email auto-fills to `admin@countrydairy.in`, role changes to `SUPER_ADMIN`. |
| 3 | Click "CATALOG MANAGER" quick preset | Email auto-fills to `catalog@countrydairy.in`, role becomes `CATALOG_MANAGER`. |
| 4 | Click "Sign In to Admin Console" button | Authenticates and enters the dashboard. |
| 5 | Try to sign in with wrong email (e.g. `test@example.com`) | Shows red error: "Invalid credentials or account deactivated." |

### VT-1.2 — Role-Based Sidebar Filtering
**Location:** Admin Console, Sidebar

| Role | Expected Visible Tabs |
|:---|:---|
| `SUPER_ADMIN` | All 13 tabs visible (Overview, Inventory, Hero Carousel, Orders, Delhivery, Driver, Routes, Customers, Wallets, CMS, Reviews, User Management, Audit Logs) |
| `CATALOG_MANAGER` | Inventory, Hero Carousel, CMS, Reviews |
| `ORDER_MANAGER` | Overview, Inventory, Orders, Delhivery, Routes, Customers, Wallets |
| `DELIVERY_DRIVER` | Only "Driver Delivery App" tab |

**How to test:** Log in with each role preset, count and verify the sidebar tabs shown.

### VT-1.3 — 403 Access Denied Screen
**Location:** Admin Console

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Log in as `DELIVERY_DRIVER` | Only "Driver Delivery App" tab is visible. |
| 2 | Manually navigate to a restricted page by clicking the Overview tab (if visible via direct URL) | Shows styled 403 Access Denied screen with user role scope and "Return to Dashboard" button. |

**Note:** The sidebar hides inaccessible tabs, so the 403 screen is the fallback if someone bypasses the nav. The `ProtectedRoute` component guards each page server-side too.

### VT-1.4 — 24-Hour Idle Auto-Logout
| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Log in as Super Admin. | Session stored in `localStorage` under key `country_dairy_admin_session`. |
| 2 | Open DevTools → Application → Local Storage → check `country_dairy_admin_session` | Key `expiresAt` is set to 24 hours from now. |
| 3 | Manually change `expiresAt` to a past timestamp (e.g. `2020-01-01T00:00:00Z`) | On next page visit / F5, session is cleared and login screen appears. |

### VT-1.5 — User Management (Super Admin Only)
**Location:** Admin Console → "User Management & Roles" tab

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open "User Management & Roles" tab as Super Admin | Staff directory table shows 4 demo staff accounts. |
| 2 | Click "Create Staff Account" button | Modal opens with form fields (Name, Email, Role, Password). |
| 3 | Fill in the form and submit | New staff member appears in the staff table. |
| 4 | Click "Reset Password" button on a staff row | Confirmation modal appears, generates new temporary password on confirm. |
| 5 | Click "Deactivate" button on a staff row | Staff account marked as Inactive (grayed out in table). |
| 6 | Log in as `CATALOG_MANAGER` and try to access User Management tab | Tab is not visible in sidebar (filtered out by RBAC). |

---

## Phase 2 — Storefront CMS & Product Engine

### VT-2.1 — Hero Carousel Manager
**Location:** Admin Console → "Hero Carousel CMS" tab

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Navigate to "Hero Carousel CMS" tab | Shows existing hero slides with up/down reorder arrows and delete button. |
| 2 | Click "+ Add Slide" button when 6 slides exist | Button is disabled (greyed out) and shows "Maximum 6 slides reached" state. |
| 3 | Fill in the slide form (title, subtitle, CTA) | Changes reflect in the live Preview Simulator panel on the right. |
| 4 | Toggle between "Desktop Preview" and "Mobile Preview" in the simulator | Banner renders in respective aspect ratios. |
| 5 | Move the "Dark Scrim Overlay" opacity slider | Overlay darkness of the preview banner changes in real time. |
| 6 | Click "↑" / "↓" reorder buttons on a slide | Slide moves up or down in the list. |
| 7 | Delete a slide when only 1 slide remains | Delete button is disabled — minimum 1 slide enforced. |

### VT-2.2 — Image Uploader (5MB WebP Compression)
**Location:** Admin Console → Hero Carousel or Product Editor → Gallery Tab

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Click the image drop zone and select a small image (< 5MB) | File processes, shows WebP compression info badge ("Saved 85% — 3.2MB → 480KB"). |
| 2 | Drag and drop a file > 5MB onto the upload zone | Red error: "File exceeds the 5MB size limit. Please choose a smaller file." Upload is rejected, no upload proceeds. |
| 3 | Click "Remove" on an uploaded image | Image removed from gallery and slot becomes available. |

### VT-2.3 — Product Editor (Tabbed)
**Location:** Admin Console → "Product Catalog & Stock" → click any product's "Edit" icon

| Step | Tab | Expected Result |
|:---|:---|:---|
| 1 | Tab 1 (Core) | Can edit Product Title, Category, Farm Description, Status selector (`Live`, `Draft`, `Archived`, `Out of Stock`), and Highlight Badges. |
| 2 | Tab 2 (Gallery) | Displays up to 10 image slots. Can star (⭐) one image as Primary Thumbnail. Can delete images. Cannot add an 11th image. |
| 3 | Tab 3 (Variant Matrix) | Each size variant row shows SKU, MRP (strikethrough), Selling Price, Packaging Type dropdown, and Stock Quantity. Rows with Stock = 0 highlighted in red ("OUT OF STOCK"). |
| 4 | Tab 4 (Nutrition) | Shows dynamic key-value table. Can add/delete rows (e.g. "Calcium" → "80mg per 100g"). |
| 5 | Click "Save Product" button | Alert confirms save. Changes reflected in Inventory table. |

### VT-2.4 — Add Product Wizard (4-Step)
**Location:** Admin Console → "Product Catalog & Stock" → "+ Add New Product (4-Step Wizard)" button

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Click "+ Add New Product" | 4-step wizard opens with Step 1: Core Details. |
| 2 | Leave required fields empty and click "Next" | Inline validation error shown ("Please fill all required fields"). Step does not advance. |
| 3 | Fill in Step 1 (Product name, category, description) | Step 2 unlocks. |
| 4 | In Step 2 (Variants), click "Ghee Pack Sizes" preset button | Variant rows auto-populate with 250ml, 500ml, 1L, 2.5L pack sizes. |
| 5 | In Step 2 (Variants), click "Milk Pack Sizes" preset button | Variant rows auto-populate with 500ml, 1L, 2L, 5L options. |
| 6 | Complete all 4 steps and click "Publish Product" | Product appears in the Inventory catalog table. |

### VT-2.5 — Storefront Gallery Slider
**Location:** http://localhost:3000/products/[any-product-slug]

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open any product detail page on the storefront | Amazon-style gallery with vertical thumbnails on the left (desktop). |
| 2 | Hover mouse over the main product image | Zoom lens overlay appears (magnified texture view for Ghee/Milk inspection). |
| 3 | Click a thumbnail on the left | Main image switches to that photo. |
| 4 | On mobile (resize browser to < 768px) | Thumbnails move to a horizontal strip below. Touch swipe left/right navigates images. |

---

## Phase 3 — Out-of-Stock Engine & Audit Logs

### VT-3.1 — Out-of-Stock Engine (Admin Dashboard)
**Location:** Admin Console → "Overview & Analytics" tab

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open Overview tab | "Inventory Stock Alerts" panel is visible with red/amber cards for each low-stock/out-of-stock item. |
| 2 | Find the "OUT OF STOCK" item (CD-GHEE-2.5L-DOLCHI, 0 units) | Red card shows `OUT OF STOCK` badge in red background. |
| 3 | Find the "LOW STOCK" item (CD-GHEE-1L, 6 units) | Amber card shows `LOW STOCK` badge with unit count and threshold. |
| 4 | Click "Alert Super Admin" WhatsApp button on any stock alert card | Opens WhatsApp web/app with pre-filled stock alert message to the Super Admin number. |

### VT-3.2 — Out-of-Stock on Storefront
**Location:** http://localhost:3000/products

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Find a product marked as `OUT_OF_STOCK` in inventory | On the product card, the WhatsApp "Order on WhatsApp" button shows as disabled / "Notify Me" or is visually grayed out. |
| 2 | Open the product detail page for an out-of-stock variant | The variant's "Order on WhatsApp" button is disabled. An "Out of Stock" overlay badge is visible on the variant selector. |

> **Note:** The storefront reads the `stockQuantity` from the `lib/constants.ts` data. For full live-data testing, this requires Supabase backend integration.

### VT-3.3 — Audit Logs & JSON Diff Viewer
**Location:** Admin Console → "Audit Logs & Revert" tab (Super Admin only)

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open "Audit Logs & Revert" tab as Super Admin | Table shows 4 seeded mock log entries (PRICE_UPDATE, STOCK_ADJUSTMENT, FEATURE_FLAG_TOGGLE, HERO_SLIDE_ADDED). |
| 2 | Click any log row | Row expands to show JSON diff view: left panel (red) = old state, right panel (green) = new state. |
| 3 | Click "Revert" button on a log entry with `oldData` | Confirmation prompt appears. On confirm, a new rollback log entry is prepended to the table. |
| 4 | Search in the search box (e.g. "Rajesh") | Only logs from Rajesh Kumar are shown. |
| 5 | Filter by "Stock Adjustment" action type | Only stock-related log entries are shown. |
| 6 | Log in as `CATALOG_MANAGER` and check sidebar | "Audit Logs & Revert" tab is **not** visible (SUPER_ADMIN only). |

### VT-3.4 — Auto-Save Draft (Error Resilience)
**Location:** Admin Console → Product Editor or Hero Manager

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open Product Editor, make some changes (modify the title) | Every 30 seconds, the form state is auto-saved to `localStorage` under a draft key. |
| 2 | Open DevTools → Application → Local Storage | Find a key starting with `draft_` containing the form's JSON snapshot. |
| 3 | Hard refresh the page (Cmd+Shift+R) and re-open the editor | A restore banner ("Unsaved draft found — would you like to restore?") appears allowing draft recovery. |

---

## Phase 4 — Analytics & Conversion Tracking

### VT-4.1 — WhatsApp Click Tracking
**Location:** http://localhost:3000 (Web Storefront)

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open browser DevTools → Console on the storefront. | — |
| 2 | Click any "Order on WhatsApp" button on the storefront | Console logs: `[Analytics Event Captured]: {eventName: "whatsapp_order_click", productName: "...", ...}` |
| 3 | View Admin Dashboard Overview tab | "WhatsApp Order Clicks" stat card shows current tracked count. 7-Day trend bar chart shows daily click volume. |

### VT-4.2 — Page Analytics Dashboard
**Location:** Admin Console → "Overview & Analytics" tab

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | View the 4 stat cards at the top | Shows: Gross Sales Today, WhatsApp Order Clicks, Total Store Visits, and Stock Alerts count. |
| 2 | View the "Sales Trend Log (INR)" line chart | 7-day sales trend (Mon–Sun) shown as a line chart. |
| 3 | View the "Storefront WhatsApp Order Button Clicks" bar chart | 7-day bar chart of click volumes. |
| 4 | View the "System Telemetry" panel at the bottom | Shows 4 health cards: Supabase DB, Storage S3, Cloudflare CDN, Vercel Analytics. |

---

## Phase 5 — Advanced CMS Modules

### VT-5.1 — CMS Manager (4 Sub-Tabs)
**Location:** Admin Console → "Storefront CMS & Flags" tab

#### Sub-tab 1: Announcement Banner
| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Navigate to "Storefront CMS & Flags" → "1. Announcement Banner" sub-tab | Editor shows current banner text and color pickers. |
| 2 | Edit the banner text | Live preview below updates in real time. |
| 3 | Change the background color via color picker | Live preview reflects the new background color instantly. |
| 4 | Uncheck "Enable Announcement Banner" | Banner preview dims / is marked as disabled. |
| 5 | Click "Save Banner" | Alert confirmation: "Announcement Banner settings saved!" |

#### Sub-tab 2: Trust Badges
| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Click "2. Homepage Trust Cards" sub-tab | Shows 4 editable trust card fields (title + subtitle pairs). |
| 2 | Edit a card title (e.g. change "100% Certified A2" to "100% Lab Certified A2 Vedic") | Text field updates inline. |
| 3 | Click "Save Cards" | Alert confirmation. |

#### Sub-tab 3: WhatsApp Template
| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Click "3. WhatsApp Order Template" sub-tab | Shows WhatsApp target number field and message template editor. |
| 2 | Edit the template text (e.g. change quantity wording) | Live WhatsApp chat preview on the right updates with dummy data substituted for `{quantity}`, `{product_name}`, etc. |
| 3 | The preview chat bubble renders in WhatsApp dark green style. | ✅ Correct |

#### Sub-tab 4: Feature Flags
| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Click "4. Feature Flags" sub-tab | Shows 5 toggle switches: Online Payment, Product Ratings, Subscriptions, Cart, User Accounts. |
| 2 | Toggle "Direct Online Payment Checkout" | Toggle slider animates; label changes from enabled (green) to disabled (grey). |
| 3 | Click "Save Feature Flags" | Alert confirmation: "Storefront Master Feature Flags saved successfully!" |

### VT-5.2 — Batch Lab Certificate Manager
**Location:** Admin Console → "Product Catalog & Stock" → Inventory page → Batch Certificate section OR via the PurityLabCMS page (directly rendered in Inventory)

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open the Inventory tab | Existing certified batches list is visible (BATCH-2026-GHEE03, BATCH-2026-MILK01). |
| 2 | Click on a batch certificate row | Right panel shows: QR code graphic, batch code, purity %, lab testing notes, and "View PDF" button. |
| 3 | Click "Issue Batch Certificate" button | Modal opens with form fields (Batch Code, Purity Score %, Testing Date, QA Notes). |
| 4 | Fill in form with batch code "BATCH-2026-GHEE04" and submit | New certificate appears in the left list with amber "Purity Score" badge. |
| 5 | The QR code shown links to `countrydairy.in/purity/BATCH-2026-GHEE04` | ✅ Correct scan URL for jar labels. |
| 6 | Click "View PDF" | Opens the lab report PDF URL in a new tab. |
| 7 | Delete a certificate | Confirmation prompt, then certificate removed from list. |

---

## Phase 6 — Delivery Logistics & Driver App

### VT-6.1 — Delivery Driver View
**Location:** Admin Console → "Driver Delivery App" tab (Log in as `DELIVERY_DRIVER`)

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Log in as `DELIVERY_DRIVER` (driver@countrydairy.in) | Only "Driver Delivery App" tab is visible in the sidebar. |
| 2 | View the delivery list | Shows 2 assigned deliveries: ORD-10492 (OUT_FOR_DELIVERY) and ORD-10495 (ASSIGNED). |
| 3 | Click "Call Customer" link | Opens phone dialer with the customer's number pre-filled (`tel:` link). |
| 4 | Click "Open Google Maps Navigation" | Opens Google Maps in a new tab with the customer's delivery address as the destination. |
| 5 | Click "Mark Delivered" button | Customer OTP verification modal opens. |
| 6 | Enter a 4-digit OTP and click "Confirm Delivery" | Order status changes to "DELIVERED" (green badge). Card grays out. |
| 7 | Try to input letters in the OTP field | Only digits accepted (auto-filtered). |

### VT-6.2 — Order Management & Delhivery
**Location:** Admin Console → "Order Queue & Fulfillment" tab (Super Admin / Order Manager)

| Step | Action | Expected Result |
|:---|:---|:---|
| 1 | Open "Order Queue & Fulfillment" tab | Table shows 4 seeded orders with status badges. |
| 2 | Click on any order row | Order detail panel expands with customer details, item summary, payment status, and delivery type. |
| 3 | Change order status (e.g. from PENDING → CONFIRMED) via status dropdown | Status badge updates in both the table row and the detail panel. |
| 4 | Click "Print Invoice" icon | Opens a browser print dialog with a styled HTML invoice containing order details, items, total, and Country Dairy branding. |
| 5 | Navigate to "Delhivery Shipping" tab | Shows orders eligible for courier dispatch (COURIER delivery type). |
| 6 | Enter a waybill number and click "Book Delhivery Courier" | Order status changes to "SHIPPED" and waybill number is saved. |

---

## ⚡ Resolution Status — All 11 Identified Gaps Fully Resolved

> **Updated On:** July 25, 2026 | **Status:** 100% Resolved & Verified

All 11 implementation gaps previously identified have been fully resolved in the codebase and verified with clean production builds:

| # | Feature / Gap | Resolution Details | Status |
|:---|:---|:---|:---:|
| **1** | **Post-Login Redirection Matrix** (Task 1.9) | Added `useEffect` role listener in `App.tsx`: `DELIVERY_DRIVER` auto-lands on `/driver`, `CATALOG_MANAGER` on `/inventory`, `ORDER_MANAGER` on `/orders`, `SUPER_ADMIN` on `/overview`. | ✅ RESOLVED |
| **2** | **Storefront Out-of-Stock Guard** (Tasks 3.1 & 3.2) | Added stock calculations to `ProductCard.tsx`. Out of stock products render a red "Out of Stock" backdrop ribbon and disable the WhatsApp ordering button. | ✅ RESOLVED |
| **3** | **WhatsApp Click Event Tracking** (Task 4.2) | `handleWhatsAppClick` wired to `ProductCard.tsx` `<a>` tag, firing `trackStorefrontEvent({ eventName: 'whatsapp_order_click', ... })` on every click. | ✅ RESOLVED |
| **4** | **Category & Taxonomy Management** (Task 5.6) | Created `CategoryCMS.tsx` with category taxonomy table, display order editor, active/disabled toggle, and Add/Edit modals. Integrated into `CMSManager.tsx`. | ✅ RESOLVED |
| **5** | **Trust Badges CMS Standalone** (Task 5.4) | Created `TrustBadgesCMS.tsx` standalone page component and integrated it into `CMSManager.tsx`. | ✅ RESOLVED |
| **6** | **Batch Lab Certificate QR Code** (Task 5.5) | Created SVG QR Code matrix renderer in `PurityLabCMS.tsx` linking to `countrydairy.in/purity/{batchCode}` for jar label printing. | ✅ RESOLVED |
| **7** | **Driver Assignment in Orders** (Task 6.2) | Added Driver Selection dropdown in `Orders.tsx` modal for all `LOCAL` delivery orders (assigning routes to Vikram Singh, Ramesh Kumar, etc.). | ✅ RESOLVED |
| **8** | **Staging Environment Switcher** (Task 6.4) | Created `.env.staging` files for both `apps/web` and `apps/admin` defining `NEXT_PUBLIC_ENV=staging` and staging API endpoints. | ✅ RESOLVED |
| **9** | **Vercel Analytics SDK Helper** (Task 4.1) | `analytics.ts` client tracking helper ready and integrated across storefront interaction points. | ✅ RESOLVED |
| **10** | **Audit Log State Diff Logger** (Task 3.6) | Audit log page `AuditLog.tsx` fully structured with old vs new state diff viewer and Super Admin change revert actions. | ✅ RESOLVED |
| **11** | **Supabase Storage Buckets Schema** (Task 2.1) | `schema.sql` database policies configured for `product-images/`, `hero-banners/`, and `lab-certificates/` storage buckets. | ✅ RESOLVED |


