# Country Dairy - Project Context & Progress Tracker

This document acts as a persistent **Context Gatherer and Tracker**. We will update it periodically so that if you or the AI coding assistant lose session history, we can refer to this file to instantly resume progress.

---

## 1. Project Overview & Meta
*   **Startup Name**: Country Dairy
*   **Target Market**: India (INR currency, OTP-based phone login, Razorpay payments, Delhivery logistics).
*   **Business Model**: E-commerce catalog with support for both one-time orders (nationwide shipping) and recurring subscriptions (hyperlocal fresh milk/curd).

---

## 2. Tech Stack Decisions (MVP)

*   **Repository Type**: Turborepo Monorepo (npm workspaces)
*   **Backend API**: Node.js with **NestJS** (Docker container hosted on Render.com)
*   **Customer Web**: **Next.js** (Hosted on Vercel)
*   **Admin Panel**: **React (Vite SPA)** (Hosted on Vercel)
*   **Mobile Client**: **React Native (Expo)**
*   **Database**: **PostgreSQL** (Prisma ORM, hosted on Supabase Pro)
*   **Cache & Queue**: **Redis** (Upstash Serverless Redis)
*   **Media Storage**: **AWS S3 / Cloudinary** (Product images & videos, customer review photo/video uploads via client-side SDK or pre-signed URLs)
*   **Ratings & Reviews**: **ProductReview** model (1-5 star ratings, textual comments, customer photo/video uploads, unique per user-product combo)
*   **Payments**: **Razorpay** (Webhooks for sync)
*   **Logistics**: **Delhivery API** (Nationwide) + Local manual routes (Daily sheets)

---

## 3. Project Documentation Links
All specifications are saved in the [docs/](file:///Users/deepakchand/workspaces/country_dairy/docs/) directory:
*   [requirements.md (PRD)](file:///Users/deepakchand/workspaces/country_dairy/docs/requirements.md) - Features, scope, and user flows.
*   [hld.md (High-Level Design)](file:///Users/deepakchand/workspaces/country_dairy/docs/hld.md) - System architecture and subscription sequence diagrams.
*   [lld.md (Low-Level Design)](file:///Users/deepakchand/workspaces/country_dairy/docs/lld.md) - Prisma schemas and API endpoint contracts.
*   [logistics.md](file:///Users/deepakchand/workspaces/country_dairy/docs/logistics.md) - Delhivery shipment bookings and runner routing details.
*   [deployment.md](file:///Users/deepakchand/workspaces/country_dairy/docs/deployment.md) - Cost breakdown comparison and deployment guidelines.
*   [ux_mocks.md](file:///Users/deepakchand/workspaces/country_dairy/docs/ux_mocks.md) - Visual layout mockups and identity specs.
*   [running_guide.md](file:///Users/deepakchand/workspaces/country_dairy/docs/running_guide.md) - Instructions to run and operate all applications locally.

---

## 4. Work Progress & Status Checklist

```markdown
- [x] Phase 1: Planning and Requirements
    - [x] Requirements gathering & expansion layout defined
    - [x] High-level and Low-level design docs completed
    - [x] Cost analysis comparing AWS vs PaaS completed (Low-cost stack chosen)
    - [x] UX / UI mockup assets generated
- [x] Phase 2: Workspace & Infrastructure Initialization
    - [x] Setup Turborepo workspace
    - [x] Configure tsconfig & eslint configs
    - [x] Create apps structure: apps/api, apps/web, apps/admin, apps/mobile
    - [x] Setup database package with Prisma configuration
- [x] Phase 3: Backend API Foundations
    - [x] Set up PostgreSQL database tables via Prisma migrations
    - [x] Implement Phone OTP auth routes
    - [x] Catalog, cart, and payment routes
- [x] Phase 4: Customer Web & Admin Panel
    - [x] Next.js Customer web integration
    - [x] React Vite Admin dashboard panel
- [ ] Phase 5: Mobile App
    - [ ] Expo React Native customer application
```

---

## 5. Active Context & Next Step
*   **Where we are**: All backend API services, database structures, seed sets, and Next.js / Vite React frontend applications are fully implemented, verified, and compiling successfully.
*   **Current Action**: Ready to develop Phase 5 (Expo React Native Mobile client application).
*   **Session Transition Tip**: To resume, check Expo configuration files (`apps/mobile/app.json`) and start constructing navigation links.
