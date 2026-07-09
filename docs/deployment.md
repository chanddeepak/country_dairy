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

## 4. Run & Release Steps

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
