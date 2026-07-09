# High-Level Design (HLD) - Country Dairy

This document specifies the system architecture, service communication channels, and design principles for the Country Dairy e-commerce platform.

---

## 1. System Topology & Architecture

The system utilizes a modular monolith backend (NestJS) serving three frontend client applications managed under a unified monorepo workspace.

```mermaid
graph TD
    subgraph Clients
        NextWeb["Next.js Customer Web"]
        RNApp["React Native Expo Customer App"]
        ViteAdmin["Vite Admin Dashboard"]
    end

    subgraph Hosting Layer
        LoadBalancer["ALB / Cloudflare Nginx Reverse Proxy"]
        NestServer["Node.js NestJS API Server (Docker ECS/AppRunner)"]
    end

    subgraph Data & Storage Layer
        PostgreSQL[("RDS PostgreSQL Database")]
        Redis[("Redis Cache & BullMQ Queue")]
        S3Bucket[("AWS S3 Object Storage (Images & Reports)")]
    end

    subgraph External Services
        Razorpay["Razorpay API"]
        Delhivery["Delhivery Courier API"]
        SMSProvider["SMS OTP Gateway (e.g. MSG91)"]
    end

    %% Client communication
    NextWeb -->|REST API over HTTPS| LoadBalancer
    RNApp -->|REST API over HTTPS| LoadBalancer
    ViteAdmin -->|REST API over HTTPS| LoadBalancer

    LoadBalancer --> NestServer

    %% Internal API Communication
    NestServer --> PostgreSQL
    NestServer --> Redis
    NestServer --> S3Bucket

    %% External APIs
    NestServer --> Razorpay
    NestServer --> Delhivery
    NestServer --> SMSProvider

    %% Asset access
    NextWeb & RNApp & ViteAdmin -->|Download Files| S3Bucket
```

---

## 2. Infrastructure & Deployment Architecture

To host this setup in production, we propose the following AWS cloud architecture:

1.  **VPC & Subnets**:
    *   Public subnets for Application Load Balancer (ALB).
    *   Private subnets for ECS (Elastic Container Service) running the NestJS Nest app, Redis, and RDS PostgreSQL instance.
2.  **App Hosting (API & Admin)**:
    *   **Backend (NestJS)**: Packaged as a Docker container, deployed to AWS ECS Fargate or AWS App Runner.
    *   **Customer Web (Next.js)**: Deployed to Vercel or AWS Amplify (takes care of SSR caching, globally optimized edge routing).
    *   **Admin Web (Vite React)**: Built as static HTML/JS, hosted on AWS S3 and distributed globally via CloudFront CDN.
3.  **Database**:
    *   AWS RDS PostgreSQL (db.t4g.small or similar for MVP).
    *   Automatic daily backups enabled.
    *   Connection pooling managed by PgBouncer (or Prisma Accelerate) to handle scaling connections from NestJS workers.
4.  **Cache & Queues (Redis)**:
    *   Used for:
        *   OTP expiry and verification states.
        *   Cron tasks & background job queueing (e.g., Delhivery shipment creation retries, morning delivery sheet compilation).
5.  **CI/CD Pipeline**:
    *   GitHub Actions running on push to `main` branch.
    *   Runs TypeScript check, ESLint, and builds artifacts.
    *   Deploys Next.js to Vercel, Admin to S3/CloudFront, and NestJS to ECS (via AWS ECR Docker registry push).

---

## 3. Data Flow & Subsystems

### A. Subscription Execution Flow
Dairy subscription orders require nightly processing to schedule deliveries for the next morning.

```mermaid
sequenceDiagram
    participant Cron as Cron Scheduler (BullMQ)
    participant DB as RDS PostgreSQL
    participant Wallet as Wallet Service
    participant Runner as Delivery Operations

    Cron->>DB: Fetch active Subscriptions for Date = Tomorrow
    loop For each Subscription
        Cron->>DB: Check User Wallet Balance
        alt Balance >= Product Price * Quantity
            Cron->>Wallet: Deduct (Product Price * Quantity)
            Cron->>DB: Create 'SubscriptionDelivery' entry (Status: PENDING)
            Cron->>DB: Log WalletTransaction (DEBIT, Description: Milk delivery)
        else Balance < Product Price * Quantity
            Cron->>DB: Create 'SubscriptionDelivery' entry (Status: FAILED_INSUFFICIENT_BALANCE)
            Cron->>DB: Send SMS Alert ("Delivery paused, please recharge wallet")
        end
    end
    Cron->>Runner: Generate Morning Routing Sheet PDF/Excel
```

### B. Standard Logistics Flow (Nationwide)
For dry products (ghee, honey, oil) that are sent via nationwide couriers:

```mermaid
sequenceDiagram
    participant User as Customer App
    participant Admin as Admin Panel
    participant Nest as Backend API
    participant Delhivery as Delhivery Courier API

    User->>Nest: Checkout order (Type: Nationwide Courier)
    Nest->>User: Redirect to Razorpay -> Complete Payment
    Nest->>Nest: Update Order status to 'CONFIRMED'
    Admin->>Nest: Select Order -> Click "Create Shipment"
    Nest->>Delhivery: POST /api/v1/shipment/create (address, wt, tracking)
    Delhivery-->>Nest: Return Waybill (AWB) & Shipping Label URL
    Nest->>Nest: Update Order shippingStatus to 'SHIPMENT_CREATED'
    Admin->>Admin: Download & Print PDF Shipping Label
    Delhivery->>Delhivery: Dispatcher picks up package -> In Transit
    Delhivery-->>Nest: Webhook Notification (In-Transit / Delivered)
    Nest->>Nest: Update status to 'DELIVERED' -> Send SMS notification
```

### C. Media Storage & Review Upload Flow
To manage large binary assets efficiently without overloading the NestJS API:

1.  **Product Images & Videos (Admin Upload)**:
    *   Admin uploads files via Vite Admin panel.
    *   API uploads to **AWS S3 / Cloudinary** bucket.
    *   URLs are stored in `Product.imageUrls` and `Product.videoUrls`.
    *   Delivered to customers using **CloudFront CDN / Cloudinary Optimizer** for low-latency playback.

2.  **Customer Review Images & Videos**:
    *   Customer uploads photo/video reviews using the Customer App/Web.
    *   **Direct-to-S3 Upload Flow** (Pre-signed URLs) is used:

```mermaid
sequenceDiagram
    participant App as Customer App
    participant Nest as Backend API
    participant S3 as AWS S3 Storage
    participant DB as PostgreSQL

    App->>Nest: GET /api/media/presigned-url?filename=review.mp4
    Nest-->>App: Return Pre-signed Upload URL (Temporary access)
    App->>S3: PUT review.mp4 (Upload binary directly to S3)
    S3-->>App: 200 OK (Upload Success)
    App->>Nest: POST /api/products/:id/reviews (rating, comment, mediaUrls: [S3_Url])
    Nest->>DB: Save ProductReview record
    Nest-->>App: Return success status
```

---

## 4. Expansion Design Strategy
To ensure the HLD can handle non-dairy catalog expansion seamlessly:
*   **Flexible Inventory Rules**: Subscriptions can be active only on items marked `isSubscriptionAllowed = true` (e.g., milk, paneer, curd, fresh cream). Standard items (e.g. 5L Ghee) will only permit one-time purchases and will be excluded from the subscription scheduler.
*   **Logistics Dispatch Router**: When checkouts are executed, the system automatically tags items based on shelf-life or category. If a cart contains a mix, it enforces split checkouts (fresh delivery schedule for local dairy, and standard shipment for courier products).
*   **Dynamic Attributes Pattern**: We avoid adding custom database columns for dairy attributes. Product metadata is stored in a JSONB type column `nutritionFacts` and dynamic properties (e.g., origin farm location, pressing method for oils, pasteurization temperature for dairy) to enable dynamic rendering on the frontend.
