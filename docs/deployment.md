# Deployment & Infrastructure Hosting - Country Dairy

This document specifies the hosting layout, environment configurations, CI/CD pipeline, and instructions for deploying the Country Dairy infrastructure.

---

## 1. Hosting Environment Comparison (AWS vs. Low-Cost MVP Stack)

For an early-stage startup, AWS can be **expensive** due to idle resource costs and hidden fees (like NAT Gateways). Below is a comparison of an **Enterprise AWS Stack** versus a **Low-Cost MVP Stack** which we highly recommend for initial launch.

### Option A: Low-Cost MVP Stack (Recommended: ~$25 - $45/month)
This stack uses dedicated platforms-as-a-service (PaaS) to achieve developer speed and lowest possible hosting bills with excellent performance.

| Service / Component | Provider | Tier & Est. Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **Backend API (`apps/api`)** | **Render.com** or **Railway.app** | Starter Web Service ($7/month) | Container hosting with auto-builds from git, automatic TLS certificates, and easy env management. |
| **Customer Web (`apps/web`)** | **Vercel** | Hobby/Pro ($0 - $20/month) | Industry standard for Next.js. Fast SSR speeds, edge caching, and preview deployments. |
| **Admin Panel (`apps/admin`)** | **Vercel** or **Netlify** | Free Tier ($0/month) | Hosted as a static frontend. Zero hosting costs for low-to-medium usage. |
| **PostgreSQL Database** | **Supabase** | Free / Pro ($0 - $25/month) | Fully managed PostgreSQL. Includes backups, auto-scaling, connection pooling, and 500MB free database space. |
| **Queue & Cache (Redis)** | **Upstash** or **Render Redis** | Free / Starter ($0 - $10/month) | Serverless Redis with zero idle fees, perfect for OTP verification and BullMQ queues. |
| **Files & Reports (S3)** | **Cloudinary** or **AWS S3** | Free / Pay-as-you-go (<$1/month) | Storage of lab reports and product images. |

*   **Total Cost**: **~$7 to $45 / month**
*   **Pros**: Super simple setup, zero infrastructure maintenance, no NAT Gateways, scales to production easily.

---

### Option B: Enterprise Cloud Stack (AWS: ~$120+/month minimum)
Use this stack when you have high, stable traffic and require corporate compliance, strict VPC layouts, or unified AWS billing.

| Service / Component | AWS Service | Est. Cost (Minimums) | Rationale |
| :--- | :--- | :--- | :--- |
| **Backend API (`apps/api`)** | **ECS Fargate** | ~$15 - $30/month | Run Docker containers in a virtual private cloud (VPC). |
| **Customer Web & Admin** | **AWS Amplify** / **S3 + CloudFront** | ~$10 - $20/month | Deploys SSR Next.js and static Vite dashboard. |
| **Database** | **RDS PostgreSQL** | ~$25 - $40/month | Managed database service. Multi-AZ options double the cost. |
| **Queue & Cache (Redis)** | **ElastiCache Redis** | ~$18 - $30/month | Single node Redis cache. |
| **VPC Infrastructure** | **NAT Gateway** | **~$32/month** (Fixed fee) | **Hidden trap**: Required if your private ECS containers need internet access to call external API services (Delhivery, Razorpay, SMS). |

*   **Total Cost**: **~$110 to $160 / month** (even with zero active traffic).
*   **Pros**: Unified infrastructure under one cloud provider, fine-grained IAM security policies, customizable VPC routing.

---

---

## 2. Docker Setup for NestJS API (`apps/api`)

To compile and package the NestJS API into a docker image to deploy to AWS ECR/ECS, create a `Dockerfile` in the root (supporting Turborepo prune):

```dockerfile
# Stage 1: Build packages
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# Stage 2: Install dependencies & compile
FROM node:20-alpine AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm clean-install

COPY --from=builder /app/out/full/ .
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npx turbo run build --filter=api

# Stage 3: Run app
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

COPY --from=installer /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/packages/database ./packages/database

EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
```

---

## 3. Environment Variables Configuration

Create appropriate local `.env` and configure secret keys inside AWS Systems Manager / Vercel dashboard.

### A. Backend API (`apps/api/.env`)
```ini
PORT=4000
NODE_ENV=production
DATABASE_URL="postgresql://db_user:db_password@rds-instance-url:5432/country_dairy?schema=public"
REDIS_URL="redis://elasticache-redis-url:6379"

# Token JWT secret keys
JWT_SECRET="super-secret-signature-key"
JWT_EXPIRES_IN="7d"

# Razorpay configuration
RAZORPAY_KEY_ID="rzp_live_xxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxxxxx"

# Delhivery courier service config
DELHIVERY_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxx"
DELHIVERY_SANDBOX=false

# OTP Gateway credentials (e.g. MSG91)
OTP_GATEWAY_AUTHKEY="xxxxxxxxxxxx"
OTP_TEMPLATE_ID="xxxxxxx"

# AWS S3 file upload configurations (lab reports, product images)
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_S3_BUCKET_NAME="country-dairy-assets"
AWS_REGION="ap-south-1"
```

### B. Customer Web (`apps/web/.env`)
```ini
NEXT_PUBLIC_API_URL="https://api.countrydairy.in"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_xxxxxxxx"
```

### C. Admin Dashboard (`apps/admin/.env`)
```ini
VITE_API_URL="https://api.countrydairy.in"
```

---

## 4. Turborepo Monorepo Cloud Hosting (Vercel & Render)

To deploy the Country Dairy workspace to Vercel and Render, configure the following settings in their respective dashboards:

### 1. Customer Web (Next.js) on Vercel
1. Select **New Project** and import the `chanddeepak/country_dairy` repository.
2. In the setup panel, configure:
   * **Project Name**: `country-dairy-web`
   * **Framework Preset**: `Next.js`
   * **Root Directory**: `.` (the root of the monorepo)
   * Expand **Build and Development Settings** and set:
     * **Build Command**: `npx turbo run build --filter=web`
     * **Output Directory**: `apps/web/.next`
   * Under **Environment Variables**, add:
     * `NEXT_PUBLIC_API_URL` = `https://[your-api-domain]/api`
3. Click **Deploy**.

### 2. Admin Panel (Vite SPA) on Vercel
1. Select **New Project** and import the same repository.
2. Configure:
   * **Project Name**: `country-dairy-admin`
   * **Framework Preset**: `Other` or `Vite`
   * **Root Directory**: `.` (the root of the monorepo)
   * Expand **Build and Development Settings** and set:
     * **Build Command**: `npx turbo run build --filter=admin`
     * **Output Directory**: `apps/admin/dist`
   * Under **Environment Variables**, add:
     * `VITE_API_URL` = `https://[your-api-domain]/api`
3. Click **Deploy**.

### 3. NestJS API (Container) on Render.com
1. Click **New +** -> **Web Service** on Render.
2. Connect your GitHub account and import `chanddeepak/country_dairy`.
3. Configure:
   * **Name**: `country-dairy-api`
   * **Runtime**: `Docker` (Render automatically uses the `Dockerfile` at the root)
   * Under **Environment Variables**, add:
     * `DATABASE_URL` (Supabase pooler URL with `pgbouncer=true` query param)
     * `DIRECT_URL` (Supabase direct URL used for migrations)
     * `JWT_SECRET` (Secure JWT secret key)
     * `JWT_EXPIRES_IN` = `7d`
     * `PORT` = `4000`
4. Click **Deploy Web Service**.

---

## 5. Local Run & Release Steps

To boot the system locally or inside production containers:

### 1. Database Migrations
Run schema migration before launching the API server:
```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

### 2. Seeding Categories & Products
Optional database seed to initialize basic categories (Milk, Curd, Ghee) and initial products:
```bash
npx prisma db seed --schema=packages/database/prisma/schema.prisma
```

### 3. Execution Commands
```bash
# Build production code
npm run build

# Run API in production
npm run start --filter=api
```

---

## 7. Database migrations

### How they are applied

The container applies them. `scripts/docker-entrypoint.sh` runs
`prisma migrate deploy` and only then execs the API, so the schema a build
needs is applied by that build or the build does not serve at all.

Before this existed nothing in the pipeline ran migrations — the image went
straight to `node apps/api/dist/main`, and the schema was kept current by
someone remembering. That is how a deploy went out whose code expected a
column the database did not have, surfacing as a 500 from an endpoint that
looked unrelated.

Two consequences worth knowing:

- **A failed migration means the service does not start.** That is deliberate.
  An API serving against a schema it was not built for produces corrupt data,
  which is worse and much harder to undo than downtime.
- **`DIRECT_URL` must bypass the pooler.** Prisma runs migrations over it, and
  they cannot run through pgbouncer in transaction mode. On Supabase that is
  the port 5432 string, not the 6543 one.

`RUN_MIGRATIONS=false` starts the API without applying anything. It exists for
the case where a migration is itself what is broken and you need to boot in
order to look. It is not a normal setting.

### Before the first deploy to an environment

Check what the deploy would do. This reads and changes nothing:

```sh
DIRECT_URL='postgresql://…:5432/postgres' sh scripts/check-prod-schema.sh
```

It reports whether the database has a migration history, and prints the SQL
that would be needed to bring it up to the current schema. Empty SQL means the
database already matches.

### Baselining a `db push` database

**The production database needs this before it can ever take a deploy.** It was
created with `prisma db push`, which builds tables without recording a
migration history, so it has no `_prisma_migrations` table. `migrate deploy`
against it fails with P3005 — it cannot tell which migrations are already
reflected there, so it refuses to guess.

Two ways out. Pick by what `check-prod-schema.sh` prints:

**If the drift SQL is empty** — the database already matches the current
schema. Mark every migration as applied without running any of them:

```sh
export DATABASE_URL='…' DIRECT_URL='…'
for m in packages/database/prisma/migrations/*/; do
  npx prisma migrate resolve --applied "$(basename "$m")" \
    --schema=packages/database/prisma/schema.prisma
done
npx prisma migrate status --schema=packages/database/prisma/schema.prisma
```

**If the drift SQL is not empty** — the database is behind the schema. Do NOT
baseline everything; that would mark migrations as applied whose tables do not
exist, and the missing ones would never be created. Baseline only up to the
last migration the database genuinely contains, then let `migrate deploy`
apply the rest.

If the database is also empty of data, the simplest correct option is to drop
the schema and let `migrate deploy` build it from nothing, which yields a clean
history with no baselining at all. **That destroys everything in it**, so
confirm the row counts first and take a Supabase backup regardless.

### Adding a migration

Never `prisma migrate dev` against a shared database — it prompts, and it can
reset. Generate the SQL and apply it deliberately:

```sh
npx prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --script > packages/database/prisma/migrations/<timestamp>_<name>/migration.sql

npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```
