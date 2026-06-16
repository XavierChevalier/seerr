# Feature Design: Subscription/Payment Tracking

## Overview
This feature introduces a subscription and payment tracking system within Seerr. It is an informational tool designed to help administrators track user contributions and subscription durations manually, without automatically blocking access to the platform or relying on external billing systems (like Stripe).

## Data Model
The system requires tracking the base subscription settings, a history of payments, and a history of gifted/free months.

### Entities
1.  **Subscription Settings (attached to User):**
    *   `pricePerMonth` (Decimal/Float): The monthly cost for the user.
    *   `startDate` (Date): The start date of the subscription/tracking.
    *   `preference` (Enum: Monthly, Annual, Semiannual, Free): The preferred billing cycle.

2.  **Payment History (`SubscriptionPayment`):**
    *   `id`
    *   `userId` (Foreign Key to User)
    *   `date` (Date): Date of the transaction.
    *   `amount` (Decimal/Float): Amount paid.
    *   `method` (String: PayPal, RIB, etc.)

3.  **Gifted Months History (`SubscriptionGift`):**
    *   `id`
    *   `userId` (Foreign Key to User)
    *   `date` (Date): Date the gift was applied.
    *   `months` (Integer): Number of months gifted.
    *   `reason` (String): Reason for the gift (e.g., "1st month free").

## Logic & Automated Calculations
The system dynamically calculates the user's subscription status based on the data points above:

*   **Total Paid:** Sum of all `amount` in `SubscriptionPayment` for the user.
*   **Total Gifted Months:** Sum of all `months` in `SubscriptionGift`.
*   **Elapsed Months:** Number of full months elapsed since the `startDate`.
*   **Remaining Months (Mois restants):** `(Total Paid / pricePerMonth) + Total Gifted Months - Elapsed Months`.
*   **Status:** `Actif` if "Remaining Months" >= 0, else `Inactif`.
*   **Total Due:** `Elapsed Months * pricePerMonth`.
*   **Balance (Total restant):** `Total Paid - Total Due + (Total Gifted Months * pricePerMonth)`.

## User Interface (UI)

### Admin View (Global)
*   **Path:** A new dedicated overview page or a sub-tab in the `/users` directory (e.g., `/users/subscriptions`).
*   **Content:** A data table replicating the provided spreadsheet. Columns include: User Name, Status, Remaining Balance, Total Paid, Total Due, Remaining Months, First Payment Date, Last Payment Date, Preference, Monthly Price.

### User/Admin Detail View (User Profile)
*   **Path:** `/users/[userId]/settings/subscription` (and `/profile/settings/subscription` for the logged-in user).
*   **Integration:** A new tab labeled "Abonnement" (Subscription) alongside General, Permissions, Notifications, etc.
*   **Content:**
    *   **Summary Cards:** Displaying Status, Remaining Months, Total Paid, and Balance.
    *   **Settings (Admin only):** Inputs for Monthly Price, Start Date, Preference.
    *   **History Tables:**
        *   Payments List (with an "Add Payment" button for admins).
        *   Gifted Months List (with an "Add Gift" button for admins).

## API & Backend
*   **Endpoints:**
    *   `GET /api/v1/subscription`: Get overview of all subscriptions (Admin).
    *   `GET /api/v1/user/:id/subscription`: Get user subscription summary, payments, and gifts.
    *   `PUT /api/v1/user/:id/subscription`: Update base subscription settings.
    *   `POST /api/v1/user/:id/subscription/payment`: Add payment.
    *   `DELETE /api/v1/user/:id/subscription/payment/:paymentId`: Remove payment.
    *   `POST /api/v1/user/:id/subscription/gift`: Add gifted month.
    *   `DELETE /api/v1/user/:id/subscription/gift/:giftId`: Remove gifted month.

## Security & Permissions
*   **Viewing:** Users can view their own subscription data. Admins (`MANAGE_USERS` permission) can view everyone's data.
*   **Modifying:** Only admins (`MANAGE_USERS` permission) can add payments, add gifts, or change the base subscription settings (price, start date).
