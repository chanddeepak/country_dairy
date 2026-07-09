# Logistics & Delivery Systems Integration - Country Dairy

This document explains the technical details, API workflows, and configurations required to support **Local Subscriptions** (Dairy runner app/sheets) and **Nationwide shipping** (Delhivery API integration) for the Country Dairy platform.

---

## 1. Local Hyperlocal Subscriptions (Fresh Milk / Curd)

Fresh milk and curd are highly perishable and require custom local runners delivering on specialized routes early in the morning (5:00 AM - 8:00 AM).

### Execution Workflow
1.  **Subscription Generation**: Every night at 11:30 PM, a Cron job runs on the NestJS backend via a BullMQ task queue.
2.  **Daily Verification**: It matches all `Subscription` records where `nextDelivery == Tomorrow` and checks if `User.walletBalance >= required_charge`.
3.  **Sheet Creation**: On success, it creates a `SubscriptionDelivery` record marked `PENDING` and deducts funds.
4.  **Route Assembly**: It queries all `SubscriptionDelivery` entries for tomorrow and groups them by:
    *   `Address.postalCode`
    *   `Address.city`
5.  **Admin Export**: The admin can export a PDF delivery manifest for each runner. The document contains:
    *   Runner Name / Route Code
    *   Sequential stop-by-stop addresses
    *   Quantity of milk, paneer, curd per customer
    *   A column to scan or mark as "Delivered".

---

## 2. Nationwide Delivery Service (Delhivery API Integration)

For long-shelf-life products (ghee, cold-pressed oils, honey, etc.), we interface with **Delhivery** logistics APIs.

### A. Pre-Checkout Serviceability API
Before allowing checkout, we check if Delhivery can deliver to the user's PIN code.
*   **Method**: `GET`
*   **Delhivery Endpoint**: `https://track.delhivery.com/c/api/pin-codes/json/`
*   **Parameters**: `?filter_codes={pincode}`
*   **Authorization Header**: `Token {API_KEY}`
*   **Response check**: Ensure `delivery_codes.pincode.is_serviceable` is `true`. If not, checkout shows a warning block "Not Serviceable in your Area".

### B. Shipment Booking API (Manifest Creation)
Once the payment is validated (`Order` status `CONFIRMED`), the admin triggers the shipping request:
*   **Method**: `POST`
*   **Delhivery Endpoint**: `https://track.delhivery.com/api/v1/packages/json/`
*   **Payload structure**:
    ```json
    {
      "shipments": [
        {
          "name": "Arjun Kumar",
          "add": "Flat 304, Green Meadows, Sector 45",
          "pin": "122003",
          "phone": "+919876543210",
          "order": "ord-4927-4a0b",
          "payment_mode": "Prepaid",
          "amount": 1250.00,
          "cod_amount": 0.0,
          "weight": 1200,
          "products_desc": "1x A2 Cow Ghee 1L, 1x Mustard Oil 1L",
          "hsn_code": "04059030"
        }
      ],
      "pickup_location": {
        "name": "Country Dairy Central Warehouse",
        "add": "Plot 12, Industrial Area, Sector 5",
        "city": "Gurugram",
        "pin": "122001",
        "phone": "+919999988888"
      }
    }
    ```
*   **Response from Delhivery**:
    ```json
    {
      "cash_pickups": 0,
      "package_count": 1,
      "success": true,
      "packages": [
        {
          "awb": "4819283749",
          "status": "Success",
          "refnum": "ord-4927-4a0b",
          "label": "https://delhivery-labels.s3.amazonaws.com/label_4819283749.pdf"
        }
      ]
    }
    ```
*   **Action**: Store the `awb` in `Order.trackingNumber` and the `label` URL in `Order.shippingLabelUrl`. Set `Order.shippingStatus` to `BOOKED` and update the status to `PROCESSING`.

### C. Automated Tracking Update (Webhooks)
Delhivery fires tracking update webhooks to our public backend route `/api/payments/webhook/delhivery`.

We map the webhook payload to our database models:

| Delhivery Scan Status | Local ShippingStatus | Local OrderStatus | Customer Message Alert |
| :--- | :--- | :--- | :--- |
| `Manifested` / `Pending` | `BOOKED` | `PROCESSING` | "Your package is prepared for dispatch." |
| `In Transit` / `Dispatched` | `IN_TRANSIT` | `SHIPPED` | "Your order has been shipped and is in transit." |
| `Out for Delivery` | `IN_TRANSIT` | `SHIPPED` | "Your order is out for delivery today!" |
| `Delivered` | `DELIVERED` | `DELIVERED` | "Delivered! Hope you enjoy your Country Dairy items." |
| `Returned` / `RTO` | `RTO` | `CANCELLED` | "Delivery failed. Shipment is returning to warehouse." |
