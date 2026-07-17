# Country Dairy — Web Feature Specifications & Decisions

> **Last Updated:** 2026-07-17
> **Purpose:** Single source of truth for all feature decisions, architecture, configs, and credentials setup. Granular enough to resume work after context loss.

---

## Table of Contents

1. [Feature Flags](#1-feature-flags)
2. [WhatsApp Ordering (Primary Purchase Mechanism)](#2-whatsapp-ordering)
3. [Hero Image Carousel](#3-hero-image-carousel)
4. [Homepage Navigation Architecture](#4-homepage-navigation-architecture)
5. [Scroll Anchor Fix (Sticky Navbar Truncation)](#5-scroll-anchor-fix)
6. [India-Only Delivery Note](#6-india-only-delivery-note)
7. [Multi-Auth: Email & Google Sign-In](#7-multi-auth-email--google-sign-in)
8. [Google OAuth Setup Guide](#8-google-oauth-setup-guide)
9. [File-by-File Change Reference](#9-file-by-file-change-reference)

---

## 1. Feature Flags

All feature flags live in `apps/web/src/lib/constants.ts`.

| Flag | Type | Default | Purpose |
|:---|:---|:---|:---|
| `ENABLE_SUBSCRIPTIONS` | `boolean` | `false` | Hides "Subscribe & Save" button on product cards and SubscriptionModal. Turn ON once subscription flow is tested. |
| `ENABLE_WEBSITE_PAYMENT` | `boolean` | `false` | Hides "Add to Cart" + website checkout flow. Shows "Order on WhatsApp" instead. Turn ON once Razorpay integration is done. |

### How flags affect UI:

**When `ENABLE_WEBSITE_PAYMENT = false` (current):**
- ProductCard: Shows ONLY "Order on WhatsApp" button (green WhatsApp button)
- CartDrawer: Replace "Checkout Now" with "Complete Order on WhatsApp" (sends cart summary via WhatsApp)
- Checkout page: Not accessible (redirects to homepage or shows WhatsApp CTA)

**When `ENABLE_WEBSITE_PAYMENT = true` (future):**
- ProductCard: Shows "Add to Cart" (gold) + "Order on WhatsApp" (green) side by side
- CartDrawer: Shows normal "Checkout Now" button
- Checkout page: Full Razorpay checkout flow

**When `ENABLE_SUBSCRIPTIONS = false` (current):**
- ProductCard: "Subscribe & Save" button is hidden regardless of `isSubscriptionAllowed`
- SubscriptionModal: Never triggered

**When `ENABLE_SUBSCRIPTIONS = true` (future):**
- ProductCard: Shows "Subscribe & Save" if `product.isSubscriptionAllowed === true`

---

## 2. WhatsApp Ordering

### Config
```
WHATSAPP_NUMBER = '918800573313'  (without + prefix, per wa.me format)
```

### URL Format
```
https://wa.me/918800573313?text=<URL_ENCODED_MESSAGE>
```

### Message Templates

**Single product order (from ProductCard / product detail page):**
```
Hi! I'd like to order:
📦 Country Dairy A2 Cow Milk (1 Litre) — ₹95
Please help me place this order. Thank you!
```

**Cart summary order (from CartDrawer):**
```
Hi! I'd like to order the following items:
📦 Country Dairy A2 Cow Milk × 2 — ₹190
📦 Country Dairy A2 Vedic Ghee × 1 — ₹1450
💰 Total: ₹1640
Please help me place this order. Thank you!
```

### Button Design
- Color: WhatsApp green `#25D366`
- Hover: darker green `#1DA851`
- Icon: WhatsApp SVG icon (inline SVG, not from lucide)
- Text: "Order on WhatsApp"
- Full-width on ProductCard
- Opens in new tab: `target="_blank"` with `rel="noopener noreferrer"`

### Files to Change
- `apps/web/src/lib/constants.ts` — Add WHATSAPP_NUMBER + message template helper
- `apps/web/src/components/product/ProductCard.tsx` — Replace Add to Cart with WhatsApp button
- `apps/web/src/components/cart/CartDrawer.tsx` — Replace Checkout with WhatsApp button
- `apps/web/src/components/layout/Footer.tsx` — Update WhatsApp number from 919876543210 to 918800573313

---

## 3. Hero Image Carousel

### Behavior
- **3 slides** that auto-advance every **4 seconds**
- **Smooth crossfade** transition (opacity fade, ~500ms duration)
- **On mouse hover**: auto-scrolling pauses
- **On mouse leave**: auto-scrolling resumes
- **Dot indicators** at the bottom center (clickable to jump to a specific slide)
- Active dot: white filled; inactive dots: white/50 outline

### Slide Data Structure
Each slide has:
```ts
interface HeroSlide {
  image: string;       // path to hero image in /public/images/
  headline: string;    // e.g. "Farm Fresh. Organic."
  subtitle: string;    // e.g. "Experience the finest A2 Milk..."
  ctaText: string;     // e.g. "Shop All Products"
  ctaHref: string;     // "/products"
}
```

### Slides Content (3 slides)
| # | Image | Headline | Subtitle |
|:---|:---|:---|:---|
| 1 | `/images/hero-banner.png` (existing) | Farm Fresh. Organic. Pure Happiness. | Experience the finest A2 Milk & Organic Ghee, sourced directly from our happy cows. |
| 2 | `/images/hero-banner-2.png` (generate) | Pure A2 Milk. From Happy Cows. | Grass-fed, free-range Gir & Sahiwal cows. NABL lab-verified. Zero adulterants. |
| 3 | `/images/hero-banner-3.png` (generate) | Traditional. Organic. Authentic. | Wood-pressed mustard oil & raw forest honey. The way nature intended. |

All slides CTA: **"Shop All Products" → `/products`**

### Images to Generate
- `hero-banner-2.png`: Beautiful morning scene of Indian cows grazing on green pasture with golden sunrise
- `hero-banner-3.png`: Rustic wooden table with organic dairy products (ghee jar, honey jar, mustard oil bottle) with farm in background

### Files to Change
- `apps/web/src/components/home/HeroSection.tsx` — Full rewrite to carousel component
- `apps/web/public/images/hero-banner-2.png` — New generated image
- `apps/web/public/images/hero-banner-3.png` — New generated image

---

## 4. Homepage Navigation Architecture

### Navbar Links (desktop and mobile)

| Link Label | Destination | Behavior |
|:---|:---|:---|
| **Shop** | `#shop` | Scrolls to bestsellers section on homepage. If on another page, navigates to `/#shop`. |
| **About** | `#about` | Scrolls to About section. If on another page, navigates to `/#about`. |
| **Farm** | `#values` | Scrolls to "Why Country Dairy" section. If on another page, navigates to `/#values`. |
| **Contact** | `#contact` | Scrolls to footer. If on another page, navigates to `/#contact`. |
| 🔍 Search icon | `/products` | Navigates to full products page. |

**No changes needed to Navbar.** The "Shop" link stays as `#shop` hash link.

### Homepage Sections (top to bottom)
1. **HeroSection** — Carousel with CTA → `/products`
2. **AboutSection** — "Our Story" (`id="about"`)
3. **ProductShelf** — "Our Bestsellers" (`id="shop"`) + **"View All Products →"** link at bottom
4. **ValueBanner** — "Why Country Dairy" (`id="values"`)
5. **Footer** — Contact info (`id="contact"`)

### "View All Products" Link on ProductShelf
- Text: "View All Products →"
- Style: Green link with arrow, centered below the product grid
- Navigates to: `/products`

### Files to Change
- `apps/web/src/components/home/ProductShelf.tsx` — Add "View All Products →" link
- `apps/web/src/components/home/HeroSection.tsx` — CTA href changes from `#shop` to `/products`

---

## 5. Scroll Anchor Fix (Sticky Navbar Truncation)

### Problem
The sticky navbar is 80px tall (`h-20`). When the browser scrolls to a hash anchor (e.g. `#values`), the section heading ("Why Country Dairy") is hidden behind the navbar.

### Solution
Add CSS `scroll-margin-top` to all anchor sections. This creates an offset so the heading is visible below the navbar.

```css
/* In globals.css */
[id] {
  scroll-margin-top: 6rem; /* 96px = 80px navbar + 16px breathing room */
}
```

### Files to Change
- `apps/web/src/app/globals.css` — Add the scroll-margin-top rule

---

## 6. India-Only Delivery Note

### Placement
1. **ValueBanner section** — Small badge/text below the value cards: "🇮🇳 We currently deliver across India only"
2. **Footer** — Add "📦 Delivery available across India" in the Support & Contacts column

### Design
- Small text, muted color (`text-stone-500`), centered below the value proposition cards
- Indian flag emoji + text

### Files to Change
- `apps/web/src/components/home/ValueBanner.tsx` — Add India delivery note
- `apps/web/src/components/layout/Footer.tsx` — Add delivery note + update WhatsApp number

---

## 7. Multi-Auth: Email & Google Sign-In

### Auth Methods
| Method | Status | Details |
|:---|:---|:---|
| 📱 Mobile OTP | ✅ Working | Existing flow. Dev code: `123456` |
| 📧 Email + Password | 🔨 Build now | Login + Register forms |
| 🔵 Google OAuth | 🔨 Build UI now | Plug in Client ID later |

### AuthModal Tabs
- Three horizontal tabs at top of modal: `📱 Mobile` | `📧 Email` | `🔵 Google`
- Default selected: Mobile (existing flow)
- Switching tabs resets form state

### Email Tab
- **Login mode** (default): Email + Password fields + "Sign In" button
- **Register mode** (toggle): Name + Email + Password fields + "Create Account" button
- Toggle link: "Don't have an account? Register" / "Already have an account? Sign In"

### Google Tab
- Single "Sign in with Google" button using Google Identity Services (GIS)
- Uses `google.accounts.id.initialize()` + `google.accounts.id.renderButton()`
- Script loaded: `https://accounts.google.com/gsi/client`
- Client ID stored in: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env var
- When no Client ID configured: Show "Google Sign-In coming soon" placeholder

### Backend Endpoints

#### `POST /api/auth/email/register`
```json
// Request
{ "email": "user@example.com", "password": "securepassword", "name": "Amit Sharma" }
// Response
{ "accessToken": "jwt...", "user": { ... } }
```
- Validates email format, password min 6 chars
- Hashes password with bcrypt
- Creates user with `authProvider: "EMAIL"`
- Phone field: set to null (made optional in schema)

#### `POST /api/auth/email/login`
```json
// Request
{ "email": "user@example.com", "password": "securepassword" }
// Response
{ "accessToken": "jwt...", "user": { ... } }
```
- Finds user by email
- Verifies bcrypt hash
- Returns JWT + user

#### `POST /api/auth/google`
```json
// Request
{ "idToken": "google-id-token-string" }
// Response
{ "accessToken": "jwt...", "user": { ... } }
```
- Verifies Google ID token using `google-auth-library` npm package
- Extracts email, name from token payload
- Upserts user by email with `authProvider: "GOOGLE"`
- Returns JWT + user

### Database Schema Changes

The User model already has `email` (optional, unique) and `passwordHash` (optional) fields. Need to add:

```prisma
// In User model, add:
authProvider  String?   // "PHONE", "EMAIL", "GOOGLE"
```

Also, the `phone` field is currently `String @unique` (required). For email/Google users who don't provide a phone, we need to make it optional:

```prisma
phone         String?   @unique  // Changed from required to optional
```

⚠️ **Migration required** — Run `npx prisma migrate dev` after schema change.

### Frontend Context Changes (`AppContext.tsx`)
Add methods:
- `loginWithEmail(email: string, password: string): Promise<boolean>`
- `registerWithEmail(email: string, password: string, name: string): Promise<boolean>`
- `loginWithGoogle(idToken: string): Promise<boolean>`

All three methods follow the same pattern as `verifyOtp()`:
1. POST to backend
2. On success: set token + user in state + localStorage
3. Sync guest cart to server
4. Return true/false

### Files to Change
- `packages/database/prisma/schema.prisma` — Make phone optional, add authProvider
- `apps/api/src/auth/auth.service.ts` — Add email login/register + Google login methods
- `apps/api/src/auth/auth.controller.ts` — Add 3 new endpoints
- `apps/web/src/components/modals/AuthModal.tsx` — Add tabbed UI
- `apps/web/src/context/AppContext.tsx` — Add new auth methods

---

## 8. Google OAuth Setup Guide

### Step-by-Step Instructions for User

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/

2. **Create a New Project (or select existing):**
   - Click the project dropdown at the top bar
   - Click "NEW PROJECT"
   - Project name: `Country Dairy`
   - Click "CREATE"

3. **Enable the Google Identity API:**
   - In the left sidebar, go to **APIs & Services > Library**
   - Search for "Google Identity Services" or "Google Sign-In"
   - Note: GIS (Google Identity Services) doesn't need to be explicitly enabled — it's available by default

4. **Configure OAuth Consent Screen:**
   - Go to **APIs & Services > OAuth consent screen**
   - Select **External** (unless you have a Google Workspace org)
   - Click "CREATE"
   - Fill in:
     - App name: `Country Dairy`
     - User support email: your email
     - Developer contact email: your email
   - Click "SAVE AND CONTINUE"
   - Scopes: Add `email`, `profile`, `openid` → Save
   - Test users: Add your own Google email for testing → Save
   - Click "BACK TO DASHBOARD"

5. **Create OAuth 2.0 Client ID:**
   - Go to **APIs & Services > Credentials**
   - Click **"+ CREATE CREDENTIALS" > "OAuth client ID"**
   - Application type: **Web application**
   - Name: `Country Dairy Web`
   - **Authorized JavaScript origins:** Add:
     - `http://localhost:3000` (development)
     - `https://your-production-domain.com` (add later when deployed)
   - **Authorized redirect URIs:** Leave empty (GIS uses popup, not redirects)
   - Click "CREATE"

6. **Copy the Client ID:**
   - You'll see a modal with your Client ID (looks like: `123456789-abcdef.apps.googleusercontent.com`)
   - Copy this value

7. **Set the Environment Variable:**
   - Add to `apps/web/.env.local`:
     ```
     NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
     ```
   - Add to production deployment environment variables too

8. **Share the Client ID with us** — We'll configure the backend to verify Google tokens using the `google-auth-library` npm package.

### Important Notes
- In development, the consent screen is in "Testing" mode — only emails added as "Test users" can sign in
- For production, you'll need to "Publish" the app (Google may review it)
- The Client ID is NOT secret — it's safe to use in frontend code
- The Client Secret is NOT needed for Google Identity Services (frontend-only popup flow)

---

## 9. File-by-File Change Reference

### Frontend (`apps/web/`)

| File | Changes |
|:---|:---|
| `src/lib/constants.ts` | Add `ENABLE_SUBSCRIPTIONS`, `ENABLE_WEBSITE_PAYMENT`, `WHATSAPP_NUMBER`, WhatsApp message helper |
| `src/components/home/HeroSection.tsx` | Full rewrite to carousel. CTA → `/products` |
| `src/components/home/ProductShelf.tsx` | Add "View All Products →" link below grid |
| `src/components/home/ValueBanner.tsx` | Add India delivery note below cards |
| `src/components/product/ProductCard.tsx` | Conditional: WhatsApp button when payment flag off. Hide Subscribe when flag off |
| `src/components/cart/CartDrawer.tsx` | Conditional: WhatsApp checkout when payment flag off |
| `src/components/modals/AuthModal.tsx` | Add tabbed UI: Mobile / Email / Google |
| `src/components/layout/Footer.tsx` | Update WhatsApp number to 918800573313, add India delivery note |
| `src/context/AppContext.tsx` | Add `loginWithEmail`, `registerWithEmail`, `loginWithGoogle` methods |
| `src/app/globals.css` | Add `scroll-margin-top: 6rem` for `[id]` elements |
| `public/images/hero-banner-2.png` | New: AI-generated hero image |
| `public/images/hero-banner-3.png` | New: AI-generated hero image |

### Backend (`apps/api/`)

| File | Changes |
|:---|:---|
| `src/auth/auth.service.ts` | Add `loginWithEmail()`, `registerWithEmail()`, `loginWithGoogle()` |
| `src/auth/auth.controller.ts` | Add 3 new POST endpoints |

### Database (`packages/database/`)

| File | Changes |
|:---|:---|
| `prisma/schema.prisma` | Make `phone` optional, add `authProvider` field |

---

## Execution Order (Recommended)

1. **Phase 1 — Quick Wins (no backend changes):**
   - Feature flags in constants.ts
   - WhatsApp ordering buttons (ProductCard, CartDrawer, Footer)
   - Hero carousel + generate images
   - ProductShelf "View All Products" link
   - Scroll anchor fix (globals.css)
   - India delivery note (ValueBanner, Footer)

2. **Phase 2 — Auth Enhancement (backend + frontend):**
   - Schema migration (phone optional, authProvider)
   - Backend email endpoints
   - Backend Google endpoint
   - AuthModal tabbed UI
   - AppContext new auth methods

3. **Phase 3 — Verification:**
   - Build check: `npx turbo run build --filter=web`
   - Browser testing of all flows
