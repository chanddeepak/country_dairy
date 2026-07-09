# Product Requirements Document (PRD) - Country Dairy

This document outlines the product requirements for **Country Dairy**, an e-commerce platform that supports both fresh dairy delivery (via subscriptions) and general farm-fresh organic food products (via standard one-time deliveries).

---

## 1. Vision & Expansion Goals
The platform is built initially for **Country Dairy** products but must support **easy expansion** to other categories (e.g., cold-pressed oils, organic honey, spices, grains, dry fruits). 

### How We Handle Expansion:
1. **Generic Catalog Model**: Avoid hardcoding dairy-specific attributes in the core database fields. Use standard e-commerce fields (name, description, category, price, stock, images).
2. **Metadata & Dynamic Attributes**: Support nutritional facts, allergens, and certification documents as flexible JSON structures, allowing different categories of products to have different specifications without schema changes.
3. **Multiple Delivery Channels**:
   * **Daily/Hyperlocal Deliveries**: For milk, curd, paneer, and other short-shelf-life products.
   * **Standard Courier Logistics**: For long-shelf-life goods (ghee, oils, honey) shipped via partners like Delhivery, Shiprocket, or Blue Dart nationwide.

---

## 2. Core Modules & User Journeys

### A. Customer App & Website (React / Next.js / Expo)
*   **Onboarding**: OTP-based phone login (OTP verified using Twilio/local provider). Profile creation and default address selection.
*   **E-Commerce Catalog**:
    *   Browse categories (Dairy, Oils, Honey, etc.).
    *   Traceability View: Show quality check parameters (purity, fat %, lab verification date) and a downloadable PDF certificate for each batch.
*   **Shopping Cart**:
    *   Mix of subscription products (e.g., daily milk) and one-time items.
    *   Dynamic calculation of shipping/delivery charges based on delivery type (local delivery runner vs. nationwide courier).
*   **Subscription Calendar**:
    *   Subscribe to a product (e.g., A2 Cow Milk, 1L, Mon-Wed-Fri).
    *   Manage calendar: Skip a day, pause subscription, or increase quantity for specific dates.
*   **Prepaid Wallet**:
    *   To support automated daily subscription orders, customers top-up their wallet.
    *   Credits/debits are tracked in a transaction ledger.
*   **Payments**: Integrated with Razorpay for card, UPI, Netbanking, and automated recurring mandate options.
*   **Ratings & Reviews**:
    *   Submit a rating (1-5 stars) and a written review for purchased products.
    *   Upload images/videos from the customer app to visually showcase product verification (e.g. density, packaging quality).
    *   View summarized ratings (e.g. 4.8/5) and a list of customer reviews directly on the product detail page.
*   **Product Media**:
    *   Support playing product videos (educational clips, farm tours, cold-pressing demonstrations) in addition to scrolling images.

### B. Admin Dashboard (Vite React)
*   **Catalog & Inventory**: Manage products, categories, base stock level, and price adjustments. Associate batch numbers and upload lab reports.
*   **Logistics Dispatch Centre**:
    *   *Local Subscriptions*: Export daily morning dispatch lists for local delivery runners.
    *   *Courier Shipments*: Select pending nationwide orders, assign weight/dimensions, and request pickup from delivery partner (Delhivery/Shiprocket) API with a single click. Print labels.
*   **Wallet Adjustments**: View ledger and execute credit adjustments (e.g., for missing delivery reports).
*   **Customer Support Console**: Search profiles, view past orders, cancel subscription orders.

### C. Logistics & Courier Service Integration
To scale deliveries efficiently:
*   **Local Deliveries (Fresh Dairy)**: Managed by in-house delivery agents or local hub-and-spoke drivers.
*   **Nationwide Deliveries (Dry Goods)**: Integrated with **Delhivery** / **Shiprocket** APIs.
    *   Automated serviceability checks based on PIN code.
    *   Waybill generation and shipping label download from Admin Panel.
    *   Webhook listeners to auto-update tracking stages (In-Transit, Out for Delivery, Delivered, RTO).

---

## 3. Scope of MVP
1. Monorepo codebase setup.
2. User management (OTP Login) and Addresses.
3. Catalog navigation & dynamic detail views with lab reports.
4. Cart, checkout flow, Razorpay integration.
5. Wallet deposit & transaction log.
6. Local delivery schedule calendar & Admin dispatch dashboard.
7. Delhivery shipping service integration (shipment booking & tracking).
8. Product Rating & Reviews (1-5 star ratings + customer photo/video reviews).
9. AWS S3 / Cloudinary media hosting & upload pipelines.
