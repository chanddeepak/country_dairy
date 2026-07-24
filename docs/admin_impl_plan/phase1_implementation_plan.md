# Implementation Plan — Phase 1: Auth, RBAC, Database Schemas & Admin Login Console

This implementation plan details the technical steps for executing **Phase 1** of the Country Dairy Admin Panel development, adhering strictly to the architecture and design patterns outlined in [db_schema_and_architecture.md](file:///Users/deepakchand/workspaces/country_dairy/docs/db_schema_and_architecture.md) and the task checklist in [tasks.md](file:///Users/deepakchand/workspaces/country_dairy/docs/tasks.md).

---

## User Review Required

> [!IMPORTANT]
> - **Super Admin Credential Control**: Self-service password reset is disabled. Super Admin manually creates and manages all employee credentials.
> - **Extensible Layering**: All UI components use custom hooks & Service Interfaces (`IProductRepository`, `IAuthService`) to ensure smooth scaling and backend decoupling.

---

## Open Questions

- *None at this stage. All requirements align with agreed specs.*

---

## Proposed Changes

### Component 1: Database Schemas & Types (`apps/admin/src/types` & Supabase DDL)

#### [NEW] [types.ts](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/types/index.ts)
- Define TypeScript interfaces for `UserProfile`, `UserRole`, `Product`, `ProductVariant`, `HeroSlide`, `AuditLog`, `FeatureFlag`, `Category`.

#### [NEW] [schema.sql](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/db/schema.sql)
- Full SQL DDL script for PostgreSQL tables: `user_profiles`, `categories`, `products`, `product_variants`, `product_images`, `hero_carousel`, `audit_logs`, `cms_modules`, `lab_certificates`.
- Create Indexes & Row-Level Security (RLS) policies.

---

### Component 2: Authentication & Session Management (`apps/admin/src/context`)

#### [NEW] [AuthContext.tsx](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/context/AuthContext.tsx)
- Auth State Context managing current logged-in `UserProfile`, session tokens, role checks, and silent token auto-refresh (55 min).
- Local storage token manager for persistent login state.

---

### Component 3: UI Pages & Navigation (`apps/admin/src/pages` & `components`)

#### [NEW] [Login.tsx](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/pages/Login.tsx)
- Modern D2C branded Admin Login Console with logo, email/password input, loading states, and error toasts.

#### [NEW] [ProtectedRoute.tsx](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/components/auth/ProtectedRoute.tsx)
- Route guard component checking authentication state & user role permissions.
- Renders `403 Access Denied` screen if role is unauthorized.

#### [MODIFY] [Sidebar.tsx](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/components/layout/Sidebar.tsx)
- Dynamic sidebar navigation filtering tabs based on `user.role`.

#### [NEW] [UserManagement.tsx](file:///Users/deepakchand/workspaces/country_dairy/apps/admin/src/pages/UserManagement.tsx)
- Super Admin page to create staff accounts, assign roles, reset employee passwords, and deactivate accounts.

---

## Verification Plan

### Automated Build Verification
- Admin app build: `npm run build --workspace=admin`
- TypeScript type check: `npx tsc --noEmit` in `apps/admin`

### Manual Verification
1. Open Admin Login page $\rightarrow$ Enter invalid credentials $\rightarrow$ Verify error toast.
2. Enter Super Admin credentials $\rightarrow$ Redirected automatically to `/overview`.
3. Enter Catalog Manager credentials $\rightarrow$ Redirected automatically to `/inventory`.
4. Logged-in Catalog Manager attempts to access `/settings/users` manually $\rightarrow$ Verify 403 Access Denied screen.
