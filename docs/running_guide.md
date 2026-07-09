# Local Running & Operations Guide - Country Dairy

This guide explains how to start, configure, and operate the Country Dairy applications locally in development.

---

## 1. Prerequisites
Ensure you have the following installed on your machine:
*   **Node.js**: `v20.x` or higher
*   **npm**: `v10.x` or higher
*   **PostgreSQL**: Running locally on port `5432`

---

## 2. Environment Variables configuration

Verify that the following `.env` configuration files exist in your workspace:

### A. Database Settings (`packages/database/.env`)
```ini
DATABASE_URL="postgresql://deepakchand@localhost:5432/country_dairy?schema=public"
```

### B. Backend API Settings (`apps/api/.env`)
```ini
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://deepakchand@localhost:5432/country_dairy?schema=public"
JWT_SECRET="country-dairy-dev-secret-key-12345"
JWT_EXPIRES_IN="7d"
```

---

## 3. Database Initialization (Prisma)

Before launching the servers, prepare the PostgreSQL database tables and populate mock seed entries.

```bash
# 1. Run migrations to create PostgreSQL tables
DATABASE_URL="postgresql://deepakchand@localhost:5432/country_dairy?schema=public" npx prisma migrate dev --name init --schema=packages/database/prisma/schema.prisma

# 2. Seed mock products, categories, lab reports, and users
DATABASE_URL="postgresql://deepakchand@localhost:5432/country_dairy?schema=public" npm run db:seed --workspace=@country-dairy/database
```

---

## 4. Launching the Applications

Since we are in a Turborepo monorepo, we can start applications individually or concurrently.

### Option A: Boot the Entire Stack Concurrently (Web + API + Admin + Mobile)
Run the dev task at the root directory. This launches all four apps:
```bash
# Run from workspace root directory
./node_modules/.bin/turbo run dev
```

### Option B: Boot Applications Individually
If you want to focus on a specific project or keep terminal output clean:

```bash
# Start Backend NestJS API only (Runs on http://localhost:4000/api)
npm run start:dev --workspace=api

# Start Next.js Customer Web only (Runs on http://localhost:3000)
npm run dev --workspace=web

# Start Vite Admin Panel only (Runs on http://localhost:5173)
npm run dev --workspace=admin

# Start Expo Mobile App only
npm run start --workspace=mobile
```

---

## 5. Testing & Verification

To verify that the NestJS API is online and responding, use a curl request:
```bash
# Request test phone verification code (OTP)
curl -X POST http://localhost:4000/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone":"+919876543210"}'

# Verify code and generate JWT user session
curl -X POST http://localhost:4000/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"phone":"+919876543210", "otp":"123456"}'
```
Check the terminal log where the NestJS API is running; it logs generated OTPs directly to stdout for development.
