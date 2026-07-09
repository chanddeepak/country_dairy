# Low-Level Design (LLD) - Country Dairy

This document outlines the low-level database schemas, module definitions, core API contract specifications, and integration endpoints for the Country Dairy platform.

---

## 1. Database Schema (Prisma PostgreSQL)

The physical database model is designed to support users, addresses, product categories, flexible catalog structures, transaction ledgers, subscriptions, and logistics tracking.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CUSTOMER
  ADMIN
  DELIVERY
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
}

enum TransactionType {
  CREDIT
  DEBIT
}

model User {
  id            String    @id @default(uuid())
  email         String?   @unique
  phone         String    @unique
  name          String?
  passwordHash  String?   // Nullable for OTP-only accounts
  role          Role      @default(CUSTOMER)
  walletBalance Decimal   @default(0.00) @db.Decimal(10, 2)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  addresses     Address[]
  orders        Order[]
  subscriptions Subscription[]
  transactions  WalletTransaction[]
  cartItems     CartItem[]
  reviews       ProductReview[]
}

model Address {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  street      String
  city        String
  state       String
  postalCode  String
  country     String   @default("India")
  isDefault   Boolean  @default(false)
  latitude    Float?
  longitude   Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
}

model Category {
  id          String     @id @default(uuid())
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  parentId    String?
  parent      Category?  @relation("SubCategories", fields: [parentId], references: [id])
  subCategories Category[] @relation("SubCategories")
  products    Product[]
  createdAt   DateTime   @default(now())
}

model Product {
  id                    String        @id @default(uuid())
  categoryId            String
  category              Category      @relation(fields: [categoryId], references: [id])
  name                  String
  slug                  String        @unique
  description           String
  price                 Decimal       @db.Decimal(10, 2)
  stock                 Int           @default(0)
  imageUrls             String[]
  videoUrls             String[]
  isSubscriptionAllowed Boolean       @default(false)
  nutritionFacts        Json?         // Custom key-value pairs (fat, protein, energy)
  metadata              Json?         // Dynamic values (shelf-life, packing size, pressing details)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  orderItems            OrderItem[]
  cartItems             CartItem[]
  subscriptions         Subscription[]
  labReports            LabReport[]
  reviews               ProductReview[]
}

model LabReport {
  id          String   @id @default(uuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  batchNumber String
  testDate    DateTime
  fileUrl     String
  parameters  Json     // { "purity": "100%", "adulteration": "Absent", "fat": "4.8%" }
  createdAt   DateTime @default(now())
}

model CartItem {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity  Int      @default(1)
  createdAt DateTime @default(now())

  @@unique([userId, productId])
}

model Order {
  id                String       @id @default(uuid())
  userId            String
  user              User         @relation(fields: [userId], references: [id])
  addressId         String
  address           Address      @relation(fields: [addressId], references: [id])
  totalAmount       Decimal      @db.Decimal(10, 2)
  deliveryCharges   Decimal      @default(0.00) @db.Decimal(10, 2)
  status            OrderStatus  @default(PENDING)
  paymentStatus     PaymentStatus @default(PENDING)
  paymentGatewayId  String?      // Razorpay Payment/Order ID
  
  // Logistics Fields
  deliveryType      String       @default("COURIER") // "LOCAL" or "COURIER"
  shippingCarrier   String?      // e.g. "DELHIVERY", "SHIPROCKET", "LOCAL"
  trackingNumber    String?
  shippingLabelUrl  String?
  shippingStatus    String?      // "BOOKED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "RTO"
  
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  orderItems        OrderItem[]
}

model OrderItem {
  id        String   @id @default(uuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  quantity  Int
  price     Decimal  @db.Decimal(10, 2)
}

model Subscription {
  id            String             @id @default(uuid())
  userId        String
  user          User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId     String
  product       Product            @relation(fields: [productId], references: [id])
  quantity      Int                @default(1)
  frequency     String             // "DAILY", "ALTERNATE", "WEEKENDS", "CUSTOM"
  daysOfWeek    Int[]              // 0 = Sunday, 6 = Saturday
  startDate     DateTime
  endDate       DateTime?
  status        SubscriptionStatus @default(ACTIVE)
  nextDelivery  DateTime
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  deliveries    SubscriptionDelivery[]
}

model SubscriptionDelivery {
  id             String       @id @default(uuid())
  subscriptionId String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  deliveryDate   DateTime
  status         String       // "PENDING", "DELIVERED", "SKIPPED", "FAILED_NO_BALANCE"
  quantity       Int
  priceCharged   Decimal      @db.Decimal(10, 2)
  createdAt      DateTime     @default(now())
}

model WalletTransaction {
  id          String          @id @default(uuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount      Decimal         @db.Decimal(10, 2)
  type        TransactionType // "CREDIT" or "DEBIT"
  description String
  referenceId String?         // Payment ID, Order ID, or Subscription ID
  createdAt   DateTime        @default(now())
}

model ProductReview {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  rating     Int      // 1 to 5 stars
  title      String?
  comment    String?
  mediaUrls  String[] // Array of S3/Cloudinary URLs for uploaded photos/videos
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, productId])
}
```

---

## 2. API Contract Specification (Key REST Endpoints)

### A. Authentication Module (`/api/auth`)

#### `POST /send-otp`
Triggers an SMS verification code to the customer's phone number.
*   **Request Body**:
    ```json
    {
      "phone": "+919876543210"
    }
    ```
*   **Response Payload (200 OK)**:
    ```json
    {
      "success": true,
      "message": "OTP sent successfully to +919876543210"
    }
    ```

#### `POST /verify-otp`
Validates OTP and handles customer session generation.
*   **Request Body**:
    ```json
    {
      "phone": "+919876543210",
      "otp": "456123"
    }
    ```
*   **Response Payload (200 OK)**:
    ```json
    {
      "success": true,
      "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "u-7a2c-4903-8d6b",
        "name": "Arjun Kumar",
        "phone": "+919876543210",
        "role": "CUSTOMER",
        "walletBalance": "0.00"
      }
    }
    ```

---

### B. Courier Shipping & Tracking Module (`/api/admin/shipping`)

#### `POST /book-shipment` (Admin Only)
Registers order details with Delhivery/Shiprocket API.
*   **Request Body**:
    ```json
    {
      "orderId": "ord-4927-4a0b",
      "weightInGrams": 1500,
      "lengthInCm": 20,
      "widthInCm": 15,
      "heightInCm": 10
    }
    ```
*   **Response Payload (200 OK)**:
    ```json
    {
      "success": true,
      "trackingNumber": "AWB-4819283749",
      "shippingLabelUrl": "https://delhivery-labels.s3.amazonaws.com/label_4819283749.pdf",
      "shippingStatus": "BOOKED"
    }
    ```

#### `POST /webhook/delhivery` (Public Endpoint)
Webhook endpoint consumed by Delhivery to sync delivery statuses.
*   **Request Body**:
    ```json
    {
      "awb": "AWB-4819283749",
      "status": "In Transit",
      "location": "Gurugram Hub",
      "timestamp": "2026-07-05T18:30:00Z"
    }
    ```
*   **Response Payload (200 OK)**:
    ```json
    {
      "received": true
    }
    ```

---

### C. Subscription Management Module (`/api/subscriptions`)

#### `POST /`
Subscribes customer to a recurring delivery of a specific item.
*   **Request Body**:
    ```json
    {
      "productId": "p-cow-milk-1l",
      "quantity": 2,
      "frequency": "CUSTOM",
      "daysOfWeek": [1, 3, 5],
      "startDate": "2026-07-06T00:00:00.000Z"
    }
    ```
*   **Response Payload (201 Created)**:
    ```json
    {
      "success": true,
      "subscription": {
        "id": "sub-1830-49b8",
        "productId": "p-cow-milk-1l",
        "quantity": 2,
        "frequency": "CUSTOM",
        "daysOfWeek": [1, 3, 5],
        "status": "ACTIVE",
        "nextDelivery": "2026-07-06T00:00:00.000Z"
      }
    }
    ```

---

### D. Media & Product Reviews Module (`/api/products/:productId/reviews` & `/api/media`)

#### `GET /api/media/presigned-url`
Acquires temporary upload authorization for images/videos.
*   **Request Query**: `?filename=review-milk.mp4&contentType=video/mp4`
*   **Response Payload (200 OK)**:
    ```json
    {
      "uploadUrl": "https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reviews/review-milk.mp4?AWSAccessKeyId=...",
      "fileUrl": "https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reviews/review-milk.mp4"
    }
    ```

#### `POST /api/products/:productId/reviews`
Submits product rating review with media attachments.
*   **Request Body**:
    ```json
    {
      "rating": 5,
      "title": "Extremely Fresh!",
      "comment": "Tastes exactly like farm fresh milk. Highly recommend.",
      "mediaUrls": [
        "https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reviews/review-milk.mp4"
      ]
    }
    ```
*   **Response Payload (201 Created)**:
    ```json
    {
      "success": true,
      "review": {
        "id": "rev-3928-8b9a",
        "productId": "p-cow-milk-1l",
        "rating": 5,
        "comment": "Tastes exactly like farm fresh milk. Highly recommend.",
        "mediaUrls": [
          "https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reviews/review-milk.mp4"
        ]
      }
    }
    ```

