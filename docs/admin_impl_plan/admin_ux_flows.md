# Country Dairy — Granular Admin Console UX Flow & Requirements Spec

This document details the complete screen map, visual elements, layout states, actions, validations, and API contracts for the Country Dairy Admin Console. 

---

## 1. System Roles & Access Control

The Admin Console handles operations across four operational roles:
1. **Super Admin / Store Manager:** Full access to inventory, pricing, wallets, reviews, orders, and reports.
2. **Laboratory QA Tester:** Access to Batch Certifications and Lab Reports upload.
3. **Logistics Dispatcher:** Access to Order Manager, Delhivery Courier Booking, and Local Runner sheets.
4. **Local Delivery Runner (Read-only view):** Mobile/print view of daily assigned manifest route sheets.

---

## 2. Global Navigation & Layout Shell

The Admin Console uses a sticky, left-docked green sidebar navigation layout (`#064e3b` theme) with an active white/accent indicator.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [CD] Country Dairy Admin                                               │
│ ├───────────────────────┤ ┌──────────────────────────────────────────┐ │
│ │ 📊 Overview           │ │ Breadcrumbs: Admin / Inventory           │ │
│ │ 📦 Products & Stock   │ ├──────────────────────────────────────────┤ │
│ │ 🔬 Lab & Certificates │ │ ACTIVE VIEW AREA (PAGES)                 │ │
│ │ 🛒 Order Manager      │ │                                          │ │
│ │ 🚚 Delhivery Courier  │ │                                          │ │
│ │ 🛣️ Local Route Sheets │ │                                          │ │
│ │ 👥 Customer Profiles  │ │                                          │ │
│ │ 💰 Wallet Ledger      │ │                                          │ │
│ │ ⭐ Reviews Moderation │ │                                          │ │
│ └───────────────────────┘ └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Granular Screen Specifications & UX Flows

### Screen 1: Dashboard Overview (`/overview`)
Provides operational health metrics at a single glance.

*   **KPI Cards (Metric Panels):**
    *   *Today's Gross Sales:* Numeric value in INR, trend indicator showing % change compared to yesterday, subtext showing total count of transaction checkouts.
    *   *Active Subscriptions:* Count of ongoing subscriptions with status `ACTIVE`.
    *   *Lab Verified Ratio:* e.g., `12 / 14 Batches`. Fraction of manufactured batches that have a published purity certificate. Highlight count of unverified batches.
    *   *Active Courier Dispatches:* Count of shipments dispatched with Delhivery waybill status.
*   **Low Stock Warning Banner:** Shows warning if any product stock is $< 50$ units.
*   **Platform Status Logs:** Display panel with simulated microservices telemetry:
    *   API Server: `ONLINE` (green dot)
    *   Prisma PG Database connection pool state: `OK`
    *   Razorpay payment listener status: `LISTENING`
    *   Delhivery API ping status: `ACTIVE`

---

### Screen 2: Products & Stock Management (`/inventory`)
Allows creating new products, updating inventory levels, and managing subscription rules.

*   **UI Components:**
    *   `[+ Add New Product]` CTA button which triggers the Add Product Form Modal.
    *   Product grid/table showing: Thumbnail Image, Name, Category (Dairy/Oils/Honey), Price per unit, Stock level, Batch code, Subscriptions Allowed (Toggle switch), and Action items (Edit, Delete).
*   **Add / Edit Product Modal Details:**
    *   *Inputs:*
        *   Product Name (text, required)
        *   Price (number in INR, required)
        *   Available Inventory Stock (integer, required)
        *   Category selection dropdown (Dairy, Oils, Honey)
        *   Nutrition Table parameters (JSON parser or text inputs for Fat, Protein, Carbohydrates, Energy)
        *   Metadata details (packaging type, volume, shelf life)
        *   Subscription toggle: boolean (if true, customer can set daily/alternate subscriptions)
    *   *Validation Rules:* Price must be positive, Stock cannot be negative, Product name must be unique.
    *   *States:*
        *   `Loading`: Disabled inputs and spinner while saving.
        *   `Success`: Form resets, toast message, modal auto-closes.
        *   `Error`: Red borders highlighting invalid fields.

---

### Screen 3: Laboratory QA & Batch Certification (`/lab-reports`)
Guarantees trust and food transparency by mapping specific product batches to lab certification tests.

*   **UI Components:**
    *   Purity Certificate issuance form.
    *   List of historical published batch certificates.
*   **Purity Certificate Form Details:**
    *   *Fields:*
        *   Target Product select box (pulls list from product inventory)
        *   Batch Code (string input, e.g., `BATCH-2026-MILK02`)
        *   Purity Score % (e.g., `99.8%`)
        *   pH Level (e.g., `6.65`)
        *   Fat % / SNF % (e.g., `4.25%` and `8.8%`)
        *   Adulterant Screening checklist (must pass to confirm certified safety):
            *   Urea Detection (`Negative` / `Positive`)
            *   Starch Detection (`Negative` / `Positive`)
            *   Detergent Detection (`Negative` / `Positive`)
            *   Synthetic Color Detection (`Negative` / `Positive`)
        *   NABL Lab Report File Upload (Simulated file selector, stores file name or generates mock URL)
    *   *Fidelity Rules:* If any adulterant checkbox is marked `Positive`, the certificate block turns red, showing a caution alert: "CANNOT CERTIFY BATCH: Adulterants Detected. Immediate inspection of farm dispatch batch is required."
    *   *Submission Action:* Click `[Publish Lab Certificate]` -> assigns certificate details to the batch. The certified status updates dynamically on the customer website for this specific batch code.

---

### Screen 4: Order Processing Manager (`/orders`)
Allows dispatchers to view, filter, track, and update checkout orders.

*   **UI Components:**
    *   Filter bar: Status (Pending, Confirmed, Shipped, Delivered), Fulfillment (Local Delivery, Courier), search by Order ID or customer phone.
    *   Order Detail Drawer (opens on order row click):
        *   Lists user addresses, phone numbers, items, quantities, and price breakdown.
        *   Order status update dropdown: `PENDING` -> `CONFIRMED` -> `SHIPPED` -> `DELIVERED` / `CANCELLED`.
        *   Invoice generator: Click `[Print Invoice]` opens clean printable browser window with invoice template containing logo, tax totals, and customer details.

---

### Screen 5: Delhivery Courier Logistics (`/logistics`)
Dedicated dispatch dashboard for shipping products nationwide via courier.

*   **UI Components:**
    *   List of orders with fulfillment type `COURIER` and status `CONFIRMED`.
    *   AWB Assignment tracker.
*   **Courier Shipment Booking Flow:**
    *   Dispatcher clicks `[Book Courier Shipment]` next to a pending order.
    *   A drawer slides out requiring package weight (kg) and packaging dimensions (length/width/height in cm).
    *   Dispatcher clicks `[Call Delhivery Dispatch API]`.
    *   *Mock API Integration Action:*
        *   Trigger post request to backend simulator.
        *   Generate standard Delhivery waybill code: `DELHIVERY-XXXXXXXXXX` (10-digit random numeric).
        *   Return tracking status: `SHIPMENT_BOOKED` / `AWB_ASSIGNED`.
        *   Render a downloadable PDF label container showing shipper information, customer address, barcode, AWB tracker.

---

### Screen 6: Local Route Sheets & Runners (`/routes`)
Fulfillment system for local neighborhood subscriptions.

*   **UI Components:**
    *   Route selection dropdown: e.g., `Sector 62, Noida`, `GK-2, South Delhi`.
    *   Runner assignment selector: e.g., `Ramesh Kumar`, `Sunil Yadav`.
    *   Active Route Manifest Table showing:
        *   Customer name, House Address, Subscribed Product (e.g., A2 Cow Milk 2L), Quantity, and Delivery Runner Name.
    *   *Fulfillment Action:*
        *   Dispatcher clicks `[Assign Runner]` -> updates delivery sheet records.
        *   Dispatcher clicks `[Print Route Manifest Sheet]` -> opens a neat print format sheet for the runner to carry on their vehicle.
        *   Mock delivery status update buttons for dispatchers to simulate runner feedback (`Mark Delivered` / `Mark Undelivered`).

---

### Screen 7: Customer Profiles & Wallets (`/customers`)
Management dashboard to handle customer inquiries, wallet balances, and subscriptions.

*   **UI Components:**
    *   Search field: Lookup customer by phone number, name, or email.
    *   Detail Drawer displaying:
        *   Active Subscriptions table.
        *   Historical Orders lists.
        *   Wallet ledger entries.
*   **Wallet Adjustment Flow:**
    *   Admin selects customer profile.
    *   Clicks `[Adjust Wallet Balance]`.
    *   *Inputs:* Amount (positive or negative number), Transaction Type (`CREDIT` / `DEBIT`), Reason/Remarks (e.g., "Recharge refund for skipped delivery").
    *   *Validation:* Debit amount cannot exceed the customer's current wallet balance (no negative balances allowed).
    *   *Result:* Instantly updates the database, writes a record to `WalletTransaction` history table, and triggers updates in the client's account page view.

---

### Screen 8: Reviews Moderation (`/reviews`)
Protects community feedback credibility by moderating submitted ratings and reviews.

*   **UI Components:**
    *   Table listing reviews: Rating (1-5 stars), Comment, Product name, Date, Media attachments, and Approval status badge (`PENDING`, `APPROVED`, `FLAGGED`).
    *   *Actions:*
        *   `[Approve]` -> Review is published and becomes visible on the product detail page, recalculating average product scores.
        *   `[Flag / Reject]` -> Hides review from detail page and sets status to `REJECTED`.

---

## 4. Verification & Testing checklist

| Target | Test Scenario | Expected Outcome |
|---|---|---|
| Inventory CRUD | Add new dairy item | Item displays in inventory table and is added to client page catalog immediately. |
| QA Test Lab | Submit positive adulterant check | Certificate blocked. Red warnings show up. Batch remains unverified. |
| Delhivery AWB | Dispatch courier order | Delhivery mock API registers weight, generates valid waybill tag, sets status to `SHIPPED`. |
| Local Manifest | Print run-sheet | Clean formatted print styles hide sidebar navigation and display a delivery runner roster. |
| Wallet Debit | Attempt user overdraft | Transaction rejected with error code validation. |
