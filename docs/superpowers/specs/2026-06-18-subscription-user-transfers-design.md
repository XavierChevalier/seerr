# Feature Design: User-Declared Subscription Transfers

> **Evolution of:** [2026-06-16-subscription-tracking-design.md](./2026-06-16-subscription-tracking-design.md)

## Overview

Extend the existing subscription tracking feature so users can declare their own bank transfers (virements). Each transfer is visible to the user and to admins. Admins confirm or reject transfers and retain full CRUD control. The feature remains informational — it does not block platform access or integrate with external billing.

**UX principle:** Keep the experience very simple and visually consistent with the rest of Seerr. Reuse existing components (`Alert`, `Button`, `Badge`, `PageTitle`, table styles from `SubscriptionList`, form patterns from `UserSubscriptionSettings`). No new visual language.

## Decisions Summary

| Topic | Decision |
|---|---|
| Data model | Extend `SubscriptionPayment` with `status`, `rejectionReason`, `createdByUserId` |
| Calculation | `pending` + `confirmed` count toward all metrics (status, balance, home banner) |
| Rejected transfers | Visible in history but excluded from calculations |
| Menu | New sidebar entry **« Abonnement »** at `/subscription` |
| Menu visibility | Only when `pricePerMonth` and `startDate` are configured |
| Settings tab | Kept — same page as menu entry |
| User permissions | Edit/delete own `pending` transfers only |
| Admin rejection | Optional `rejectionReason` shown to user |
| Admin overview | Column « En attente » + inline confirm/reject on `/subscriptions` |
| Admin-created payments | Created with `status: confirmed` by default |

## Data Model

### `SubscriptionPayment` (extended)

| Field | Type | Description |
|---|---|---|
| `id` | number | Existing |
| `userId` | FK → User | Existing |
| `date` | Date | Date of the transfer |
| `amount` | Decimal | Amount in € |
| `method` | string | e.g. RIB, PayPal |
| `status` | enum | `pending` \| `confirmed` \| `rejected` |
| `rejectionReason` | string? | Optional, visible to user when rejected |
| `createdByUserId` | number | FK → User who created the entry |

**Defaults:**
- User-created → `status: pending`
- Admin-created → `status: confirmed`

### Unchanged entities

- **User** subscription settings: `subscriptionPricePerMonth`, `subscriptionStartDate`, `subscriptionPreference`
- **SubscriptionGift**: unchanged

## Logic & Calculations

Update `calculateSubscriptionState` in `subscriptionHelpers.ts`:

* **Eligible payments:** `status` is `pending` or `confirmed` (excludes `rejected`)
* **Total Paid:** Sum of eligible payment amounts
* **Total Gifted Months:** Unchanged
* **Elapsed Months:** Unchanged
* **Remaining Months:** `(Total Paid / pricePerMonth) + Total Gifted Months - Elapsed Months`
* **Status:** `Actif` if Remaining Months ≥ 0, else `Inactif`
* **Total Due:** `Elapsed Months * pricePerMonth`
* **Balance:** `Total Paid - Total Due + (Total Gifted Months * pricePerMonth)`

Each payment in the API response includes `status`, `rejectionReason`, and `createdByUserId`.

### Menu visibility helper

`isSubscriptionConfigured(user)` → `true` when both `subscriptionPricePerMonth` and `subscriptionStartDate` are set.

## API & Permissions

### Read

| Endpoint | Access |
|---|---|
| `GET /api/v1/user/:id/subscription` | Own profile or admin (`MANAGE_USERS`) |
| `GET /api/v1/subscription` | Admin — overview with `pendingCount` and `pendingAmount` per user |
| `GET /api/v1/subscription/status` | Authenticated user — lightweight status for home banner |

### Payments (`SubscriptionPayment`)

| Action | Endpoint | User | Admin |
|---|---|---|---|
| Create | `POST /api/v1/user/:id/subscription/payment` | `status: pending` | `status: confirmed` |
| Update | `PUT /api/v1/user/:id/subscription/payment/:paymentId` | Own `pending` only | Any |
| Delete | `DELETE /api/v1/user/:id/subscription/payment/:paymentId` | Own `pending` only | Any |
| Confirm | `POST /api/v1/user/:id/subscription/payment/:paymentId/confirm` | — | Yes |
| Reject | `POST /api/v1/user/:id/subscription/payment/:paymentId/reject` | — | Yes (optional `rejectionReason`) |

### Unchanged (admin only)

* `PUT /api/v1/user/:id/subscription` — base settings
* `POST/DELETE /api/v1/user/:id/subscription/gift` — gifted months

### Security rules

* User cannot create transfers if subscription is not configured
* User cannot confirm, reject, or modify `confirmed`/`rejected` transfers
* Admin has full CRUD + confirm/reject on any user's transfers

### `GET /api/v1/subscription/status` response

```typescript
{
  isConfigured: boolean;
  status: 'Actif' | 'Inactif' | null;
  remainingMonths: number | null;
  hasPendingPayments: boolean;
}
```

Returns `isConfigured: false` and null fields when subscription is not set up.

## User Interface

### Navigation

* **Sidebar:** New entry « Abonnement » (`CreditCardIcon` or similar Heroicon) → `/subscription`
* **Visibility:** Shown only when `isSubscriptionConfigured` is true for the logged-in user
* **Settings tab:** `/profile/settings/subscription` and `/users/[userId]/settings/subscription` render the same `UserSubscriptionSettings` component

### Page `/subscription` (user view)

Evolve existing `UserSubscriptionSettings`:

1. **Summary cards** — Status, Remaining Months, Total Paid, Balance (existing layout)
2. **Declare transfer form** — Inline row: amount, date, method + « Ajouter » button (same pattern as current admin add-payment form)
3. **Transfer history table** — Columns: Date, Amount, Method, Status (colored `Badge`), Actions
   * Status badges: amber = En attente, green = Confirmé, red = Rejeté
   * Rejection reason shown as secondary text on rejected rows
   * Edit / Delete buttons only on `pending` rows (user's own)
4. **Admin sections** (when viewing another user's page) — Base configuration, gifted months, confirm/reject buttons on `pending` rows, full CRUD

### Admin overview `/subscriptions`

Extend `SubscriptionList`:

* New column **« En attente »** — count + total amount of pending transfers
* Inline actions: Confirm / Reject (reject opens a simple modal with optional reason field)
* User name links to subscription page (existing)

### Home page banner

* **Location:** `Discover` component, above the « Recently Added » slider
* **Condition:** User logged in, subscription configured, `remainingMonths < 0`
* **Component:** Existing `Alert` (`type="warning"` or `type="error"`) with link button to `/subscription`
* **Message:** « Abonnement en retard » + months to regularize + « Voir mon abonnement »
* **Hidden** when `remainingMonths >= 0` (pending transfers included in calculation)

### UX consistency guidelines

* Reuse `Alert`, `Button`, `Badge`, `LoadingSpinner`, `PageTitle` from `@app/components/Common`
* Match table styling from `SubscriptionList` (`bg-gray-800`, `border-gray-700`, etc.)
* Match form inputs from existing settings pages
* Use `defineMessages` + `react-intl` for all new strings
* Toast notifications on success/error (existing `useToasts` pattern)
* No modals except optional reject-reason dialog for admins
* Mobile: form stacks vertically, table scrolls horizontally (`overflow-x-auto`)

## Testing

* **Unit:** `calculateSubscriptionState` — pending included, rejected excluded, edge cases
* **API:** Permission matrix (user create/edit/delete pending, admin confirm/reject, forbidden cases)
* **OpenAPI:** Update `seerr-api.yml` for new/changed endpoints and response fields
* **Cypress:** User declares transfer, admin confirms from overview, home banner visibility

## Out of Scope

* Email/push notifications on confirm/reject
* Automatic bank import or payment gateway integration
* Blocking user access when subscription is inactive
* Separate « Virements » feature or entity
