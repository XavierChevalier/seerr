# User-Declared Subscription Transfers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users declare bank transfers with pending/confirmed/rejected status, allow admins to confirm or reject them, expose an Abonnement menu entry and home-page alert, while keeping UX consistent with existing Seerr components.

**Architecture:** Extend `SubscriptionPayment` with `status`, `rejectionReason`, and `createdByUserId`. Update `calculateSubscriptionState` to count `pending` + `confirmed` payments. Branch API permissions so users manage own pending transfers and admins retain full CRUD plus confirm/reject. Reuse and evolve `UserSubscriptionSettings` for `/subscription`, profile settings, and admin user settings.

**Tech Stack:** React, Next.js, TailwindCSS, Express, TypeORM, node:test, Cypress.

**Spec:** [2026-06-18-subscription-user-transfers-design.md](../specs/2026-06-18-subscription-user-transfers-design.md)

---

## File Map

| File | Responsibility |
|---|---|
| `server/entity/SubscriptionPayment.ts` | Add status, rejectionReason, createdByUserId columns |
| `server/migration/*/1781768000000-SubscriptionPaymentStatus.ts` | DB migration + legacy backfill |
| `server/utils/subscriptionHelpers.ts` | `isSubscriptionConfigured`, eligible payment filter, updated calculations |
| `server/interfaces/api/userInterfaces.ts` | Extended payment + status response types |
| `server/routes/user/index.ts` | Permission-aware subscription/payment routes |
| `server/routes/subscription.ts` | Overview pending stats + `GET /status` |
| `server/routes/subscription.test.ts` | API permission matrix tests |
| `server/utils/subscriptionHelpers.test.ts` | Calculation unit tests |
| `seerr-api.yml` | OpenAPI updates |
| `src/pages/subscription/index.tsx` | Standalone Abonnement page (menu entry) |
| `src/pages/profile/settings/subscription.tsx` | Profile settings tab page |
| `src/components/UserProfile/UserSettings/UserSubscriptionSettings/index.tsx` | Evolved UI (status badges, user declare form, admin actions) |
| `src/components/UserProfile/UserSettings/index.tsx` | Show Abonnement tab for own profile when configured |
| `src/components/Layout/Sidebar/index.tsx` | Abonnement menu entry with visibility |
| `src/components/SubscriptionList/index.tsx` | Admin pending column + confirm/reject |
| `src/components/Discover/SubscriptionAlertBanner/index.tsx` | Home page alert (new small component) |
| `src/components/Discover/index.tsx` | Insert banner above Recently Added |
| `cypress/e2e/user/subscription-settings.cy.ts` | E2E for user declare + admin confirm + banner |

---

### Task 1: Entity & Migration

**Files:**
- Modify: `server/entity/SubscriptionPayment.ts`
- Create: `server/migration/postgres/1781768000000-SubscriptionPaymentStatus.ts`
- Create: `server/migration/sqlite/1781768000000-SubscriptionPaymentStatus.ts`

- [ ] **Step 1: Add enum and columns to entity**

```typescript
// server/entity/SubscriptionPayment.ts — add above the class
export type SubscriptionPaymentStatus = 'pending' | 'confirmed' | 'rejected';

// Inside SubscriptionPayment class, after `method`:
  @Column({ type: 'varchar', default: 'confirmed' })
  public status: SubscriptionPaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  public rejectionReason?: string | null;

  @Column()
  public createdByUserId: number;
```

- [ ] **Step 2: Create postgres migration**

```typescript
// server/migration/postgres/1781768000000-SubscriptionPaymentStatus.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionPaymentStatus1781768000000 implements MigrationInterface {
  name = 'SubscriptionPaymentStatus1781768000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD "status" character varying NOT NULL DEFAULT 'confirmed'`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD "rejectionReason" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD "createdByUserId" integer`
    );
    await queryRunner.query(
      `UPDATE "subscription_payment" SET "createdByUserId" = "userId" WHERE "createdByUserId" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ALTER COLUMN "createdByUserId" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "createdByUserId"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "rejectionReason"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "status"`
    );
  }
}
```

- [ ] **Step 3: Create sqlite migration** (same logic, sqlite syntax)

```typescript
// server/migration/sqlite/1781768000000-SubscriptionPaymentStatus.ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionPaymentStatus1781768000000 implements MigrationInterface {
  name = 'SubscriptionPaymentStatus1781768000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD COLUMN "status" varchar NOT NULL DEFAULT 'confirmed'`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD COLUMN "rejectionReason" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" ADD COLUMN "createdByUserId" integer`
    );
    await queryRunner.query(
      `UPDATE "subscription_payment" SET "createdByUserId" = "userId" WHERE "createdByUserId" IS NULL`
    );
    // SQLite cannot ALTER SET NOT NULL easily; TypeORM entity enforces on new rows
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "createdByUserId"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "rejectionReason"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_payment" DROP COLUMN "status"`
    );
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck:server`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/entity/SubscriptionPayment.ts server/migration/
git commit -m "feat: add subscription payment status columns"
```

---

### Task 2: Helpers, Interfaces & Calculation Tests

**Files:**
- Modify: `server/utils/subscriptionHelpers.ts`
- Modify: `server/interfaces/api/userInterfaces.ts`
- Modify: `server/utils/subscriptionHelpers.test.ts`

- [ ] **Step 1: Write failing tests for status-aware calculation**

Add to `server/utils/subscriptionHelpers.test.ts`:

```typescript
  it('excludes rejected payments from totalPaid', () => {
    const confirmed = new SubscriptionPayment();
    confirmed.id = 1;
    confirmed.date = new Date('2024-06-01');
    confirmed.amount = 30;
    confirmed.method = 'RIB';
    confirmed.status = 'confirmed';
    confirmed.createdByUserId = 2;

    const rejected = new SubscriptionPayment();
    rejected.id = 2;
    rejected.date = new Date('2024-07-01');
    rejected.amount = 50;
    rejected.method = 'RIB';
    rejected.status = 'rejected';
    rejected.createdByUserId = 2;

    const user = createUser({
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPayments: [confirmed, rejected],
    });

    const state = calculateSubscriptionState(user);
    assert.strictEqual(state.totalPaid, 30);
  });

  it('includes pending payments in totalPaid', () => {
    const pending = new SubscriptionPayment();
    pending.id = 1;
    pending.date = new Date('2024-06-01');
    pending.amount = 20;
    pending.method = 'RIB';
    pending.status = 'pending';
    pending.createdByUserId = 2;

    const user = createUser({
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPayments: [pending],
    });

    const state = calculateSubscriptionState(user);
    assert.strictEqual(state.totalPaid, 20);
    assert.strictEqual(state.payments[0].status, 'pending');
  });
```

Also add `status` and `createdByUserId` to existing test payment fixtures.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- server/utils/subscriptionHelpers.test.ts`
Expected: FAIL — `status` undefined or not in response

- [ ] **Step 3: Implement helpers and interfaces**

```typescript
// server/interfaces/api/userInterfaces.ts
export type SubscriptionPaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface SubscriptionPaymentResponse {
  id: number;
  date: string;
  amount: number;
  method: string;
  status: SubscriptionPaymentStatus;
  rejectionReason: string | null;
  createdByUserId: number;
}

export interface SubscriptionStatusResponse {
  isConfigured: boolean;
  status: 'Actif' | 'Inactif' | null;
  remainingMonths: number | null;
  hasPendingPayments: boolean;
}

export interface SubscriptionOverviewItem {
  id: number;
  displayName: string;
  email: string;
  avatar: string;
  subscription: UserSubscriptionResponse;
  pendingCount: number;
  pendingAmount: number;
}
```

```typescript
// server/utils/subscriptionHelpers.ts
import type { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import type { User } from '@server/entity/User';

export function isSubscriptionConfigured(user: User): boolean {
  return (
    user.subscriptionPricePerMonth != null &&
    user.subscriptionStartDate != null
  );
}

export function isEligiblePayment(payment: SubscriptionPayment): boolean {
  return payment.status === 'pending' || payment.status === 'confirmed';
}

export function getPendingPaymentStats(payments: SubscriptionPayment[] = []) {
  const pending = payments.filter((p) => p.status === 'pending');
  return {
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
  };
}

// In calculateSubscriptionState, replace totalPaid line:
  const eligiblePayments = payments.filter(isEligiblePayment);
  const totalPaid = eligiblePayments.reduce((sum, p) => sum + Number(p.amount), 0);

// In payments map, add status fields:
        status: p.status ?? 'confirmed',
        rejectionReason: p.rejectionReason ?? null,
        createdByUserId: p.createdByUserId,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- server/utils/subscriptionHelpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/subscriptionHelpers.ts server/interfaces/api/userInterfaces.ts server/utils/subscriptionHelpers.test.ts
git commit -m "feat: calculate subscription totals with payment status"
```

---

### Task 3: Read Routes & Status Endpoint

**Files:**
- Modify: `server/routes/user/index.ts`
- Modify: `server/routes/subscription.ts`
- Modify: `server/routes/subscription.test.ts`

- [ ] **Step 1: Write failing test — user reads own subscription**

Add to `server/routes/subscription.test.ts`:

```typescript
describe('GET /user/:id/subscription user access', () => {
  it('allows a user to read their own subscription', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const userId = await getFriendUserId();

    const res = await agent.get(`/user/${userId}/subscription`);

    assert.strictEqual(res.status, 200);
    assert.ok('status' in res.body);
  });

  it('returns 403 when reading another user subscription', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');

    const res = await agent.get('/user/1/subscription');

    assert.strictEqual(res.status, 403);
  });
});

describe('GET /subscription/status', () => {
  it('returns isConfigured false when subscription not set up', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');

    const res = await agent.get('/subscription/status');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isConfigured, false);
    assert.strictEqual(res.body.status, null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- server/routes/subscription.test.ts`
Expected: FAIL — 403 on own subscription, 404 on /subscription/status

- [ ] **Step 3: Update GET subscription route**

```typescript
// server/routes/user/index.ts — replace GET /:id/subscription middleware
router.get(
  '/:id/subscription',
  isOwnProfileOrAdmin(),
  async (req, res, next) => {
    // ... existing handler unchanged
  }
);
```

```typescript
// server/routes/subscription.ts — add after existing GET /
subscriptionRoutes.get(
  '/status',
  isAuthenticated(),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.user!.id },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });

      if (!user || !isSubscriptionConfigured(user)) {
        return res.status(200).json({
          isConfigured: false,
          status: null,
          remainingMonths: null,
          hasPendingPayments: false,
        });
      }

      const state = calculateSubscriptionState(user);
      const { pendingCount } = getPendingPaymentStats(user.subscriptionPayments);

      return res.status(200).json({
        isConfigured: true,
        status: state.status,
        remainingMonths: state.remainingMonths,
        hasPendingPayments: pendingCount > 0,
      });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

// Update GET / overview to include pending stats:
      const results = users.map((user) => {
        const { pendingCount, pendingAmount } = getPendingPaymentStats(
          user.subscriptionPayments
        );
        return {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          avatar: user.avatar,
          subscription: calculateSubscriptionState(user),
          pendingCount,
          pendingAmount,
        };
      });
```

Add imports: `isSubscriptionConfigured`, `getPendingPaymentStats` from subscriptionHelpers.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- server/routes/subscription.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/user/index.ts server/routes/subscription.ts server/routes/subscription.test.ts
git commit -m "feat: allow users to read own subscription and add status endpoint"
```

---

### Task 4: Payment CRUD Permissions & Confirm/Reject

**Files:**
- Modify: `server/routes/user/index.ts`
- Modify: `server/routes/subscription.test.ts`

- [ ] **Step 1: Write failing tests for user create pending**

```typescript
describe('user-declared payments', () => {
  let userId: number;

  beforeEach(async () => {
    userId = await getFriendUserId();
    await getRepository(SubscriptionPayment).createQueryBuilder().delete().execute();
    await getRepository(User).update(userId, {
      subscriptionPricePerMonth: 10,
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPreference: 'Mensuel',
    });
  });

  it('lets a user create a pending payment on their own account', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');

    const res = await agent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-01',
      amount: 15,
      method: 'Virement bancaire',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'pending');
    assert.strictEqual(res.body.totalPaid, 15);
  });

  it('returns 403 when user creates payment for another user', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');

    const res = await agent.post('/user/1/subscription/payment').send({
      date: '2024-06-01',
      amount: 15,
      method: 'RIB',
    });

    assert.strictEqual(res.status, 403);
  });

  it('creates confirmed payment when admin adds payment', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-01',
      amount: 15,
      method: 'PayPal',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'confirmed');
  });

  it('lets admin confirm a pending payment', async () => {
    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    const createRes = await userAgent
      .post(`/user/${userId}/subscription/payment`)
      .send({ date: '2024-06-01', amount: 15, method: 'RIB' });
    const paymentId = createRes.body.payments[0].id;

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await adminAgent.post(
      `/user/${userId}/subscription/payment/${paymentId}/confirm`
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'confirmed');
  });

  it('lets admin reject a pending payment with optional reason', async () => {
    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    const createRes = await userAgent
      .post(`/user/${userId}/subscription/payment`)
      .send({ date: '2024-06-01', amount: 15, method: 'RIB' });
    const paymentId = createRes.body.payments[0].id;

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await adminAgent
      .post(`/user/${userId}/subscription/payment/${paymentId}/reject`)
      .send({ rejectionReason: 'Montant incorrect' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'rejected');
    assert.strictEqual(res.body.payments[0].rejectionReason, 'Montant incorrect');
    assert.strictEqual(res.body.totalPaid, 0);
  });

  it('returns 403 when user tries to edit a confirmed payment', async () => {
    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const createRes = await adminAgent
      .post(`/user/${userId}/subscription/payment`)
      .send({ date: '2024-06-01', amount: 15, method: 'PayPal' });
    const paymentId = createRes.body.payments[0].id;

    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await userAgent
      .put(`/user/${userId}/subscription/payment/${paymentId}`)
      .send({ date: '2024-06-02', amount: 20, method: 'PayPal' });

    assert.strictEqual(res.status, 403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- server/routes/subscription.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement payment routes**

Replace POST/DELETE payment routes and add PUT/confirm/reject. Use helper at top of file:

```typescript
function isAdmin(req: Express.Request): boolean {
  return !!req.user?.hasPermission(Permission.MANAGE_USERS);
}

async function loadSubscriptionUser(userId: number) {
  return getRepository(User).findOne({
    where: { id: userId },
    relations: ['subscriptionPayments', 'subscriptionGifts'],
  });
}

async function respondWithSubscriptionState(userId: number, res: Express.Response) {
  const user = await loadSubscriptionUser(userId);
  return res.status(200).json(calculateSubscriptionState(user!));
}
```

**POST `/:id/subscription/payment`** — middleware: `isOwnProfileOrAdmin()`
- 403 if not own profile and not admin
- 403 if user (non-admin) and `!isSubscriptionConfigured(user)`
- Set `status: isAdmin(req) ? 'confirmed' : 'pending'`
- Set `createdByUserId: req.user!.id`

**PUT `/:id/subscription/payment/:paymentId`** — middleware: `isOwnProfileOrAdmin()`
- Load payment, verify belongs to user
- If not admin: 403 unless `payment.status === 'pending'` and own profile
- Update `date`, `amount`, `method` from body

**DELETE `/:id/subscription/payment/:paymentId`** — same permission rules as PUT

**POST `/:id/subscription/payment/:paymentId/confirm`** — `isAuthenticated(Permission.MANAGE_USERS)`
- Set `status = 'confirmed'`, `rejectionReason = null`

**POST `/:id/subscription/payment/:paymentId/reject`** — `isAuthenticated(Permission.MANAGE_USERS)`
- Set `status = 'rejected'`, `rejectionReason = req.body.rejectionReason ?? null`

- [ ] **Step 4: Run tests**

Run: `pnpm test -- server/routes/subscription.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/user/index.ts server/routes/subscription.test.ts
git commit -m "feat: add user-declared payments with confirm and reject"
```

---

### Task 5: OpenAPI Spec

**Files:**
- Modify: `seerr-api.yml`

- [ ] **Step 1: Update schemas and paths**

Add to components/schemas:

```yaml
SubscriptionPaymentStatus:
  type: string
  enum: [pending, confirmed, rejected]

SubscriptionPayment:
  type: object
  properties:
    id: { type: integer }
    date: { type: string, format: date }
    amount: { type: number }
    method: { type: string }
    status: { $ref: '#/components/schemas/SubscriptionPaymentStatus' }
    rejectionReason: { type: string, nullable: true }
    createdByUserId: { type: integer }

SubscriptionStatusResponse:
  type: object
  properties:
    isConfigured: { type: boolean }
    status: { type: string, enum: [Actif, Inactif], nullable: true }
    remainingMonths: { type: number, nullable: true }
    hasPendingPayments: { type: boolean }
```

Add paths:
- `GET /subscription/status`
- `PUT /user/{userId}/subscription/payment/{paymentId}`
- `POST /user/{userId}/subscription/payment/{paymentId}/confirm`
- `POST /user/{userId}/subscription/payment/{paymentId}/reject`

Update `GET /user/{userId}/subscription` security to allow own profile.

- [ ] **Step 2: Run OpenAPI test if present**

Run: `pnpm test -- server/routes/subscription.openapi.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add seerr-api.yml server/routes/subscription.openapi.test.ts
git commit -m "docs: update OpenAPI for subscription transfer status"
```

---

### Task 6: Abonnement Page & Sidebar Menu

**Files:**
- Create: `src/pages/subscription/index.tsx`
- Create: `src/pages/profile/settings/subscription.tsx`
- Modify: `src/components/Layout/Sidebar/index.tsx`
- Modify: `src/pages/users/[userId]/settings/subscription.tsx`
- Modify: `src/components/UserProfile/UserSettings/index.tsx`

- [ ] **Step 1: Create standalone subscription page**

```typescript
// src/pages/subscription/index.tsx
import UserSubscriptionSettings from '@app/components/UserProfile/UserSettings/UserSubscriptionSettings';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { useUser } from '@app/hooks/useUser';
import type { NextPage } from 'next';
import { useIntl } from 'react-intl';

const SubscriptionPage: NextPage = () => {
  const intl = useIntl();
  const { user, loading } = useUser();

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <PageTitle title="Abonnement" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Abonnement</h1>
      </div>
      <UserSubscriptionSettings />
    </>
  );
};

export default SubscriptionPage;
```

- [ ] **Step 2: Create profile settings subscription page**

```typescript
// src/pages/profile/settings/subscription.tsx
import UserSettings from '@app/components/UserProfile/UserSettings';
import UserSubscriptionSettings from '@app/components/UserProfile/UserSettings/UserSubscriptionSettings';
import type { NextPage } from 'next';

const ProfileSubscriptionSettingsPage: NextPage = () => (
  <UserSettings>
    <UserSubscriptionSettings />
  </UserSettings>
);

export default ProfileSubscriptionSettingsPage;
```

- [ ] **Step 3: Update users settings page — remove admin-only guard**

```typescript
// src/pages/users/[userId]/settings/subscription.tsx — remove useRouteGuard(Permission.MANAGE_USERS)
// UserSettings component already handles permissions via tabs
```

- [ ] **Step 4: Show Abonnement tab for own profile when configured**

In `UserSettings/index.tsx`, change subscription tab:

```typescript
    {
      text: intl.formatMessage(messages.menuSubscription),
      route: '/settings/subscription',
      regex: /\/settings\/subscription/,
      hidden:
        currentUser?.id !== user.id &&
        !hasPermission(Permission.MANAGE_USERS, currentUser?.permissions ?? 0),
    },
```

Fetch subscription status for tab visibility on own profile — use SWR on `/api/v1/subscription/status` and hide tab when `!isConfigured` for non-admin viewing own profile. Admins always see tab on other users.

- [ ] **Step 5: Add sidebar menu entry**

In `Sidebar/index.tsx`:

```typescript
import { CreditCardIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import type { SubscriptionStatusResponse } from '@server/interfaces/api/userInterfaces';

// Add to menuMessages:
  subscription: 'Abonnement',

// Add link after requests block:
  {
    href: '/subscription',
    messagesKey: 'subscription',
    svgIcon: <CreditCardIcon className="mr-3 h-6 w-6" />,
    activeRegExp: /^\/subscription/,
    dataTestId: 'sidebar-menu-subscription',
  },

// Inside Sidebar component, fetch status:
  const { data: subscriptionStatus } = useSWR<SubscriptionStatusResponse>(
    '/api/v1/subscription/status'
  );

// Filter subscription link:
  const visibleLinks = SidebarLinks.filter((link) => {
    if (link.messagesKey === 'subscription') {
      return subscriptionStatus?.isConfigured === true;
    }
    // ... existing permission filter
  });
```

- [ ] **Step 6: Fix UserSubscriptionSettings user resolution**

```typescript
// UserSubscriptionSettings — resolve target user for all routes
const { user: currentUser, hasPermission } = useUser();
const router = useRouter();
const profileUserId = Number(router.query.userId);
const targetUserId = Number.isFinite(profileUserId) ? profileUserId : currentUser?.id;
const { user } = useUser({ id: targetUserId });
const isAdmin = hasPermission(Permission.MANAGE_USERS);
const isOwnProfile = currentUser?.id === user?.id;
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/subscription/index.tsx src/pages/profile/settings/subscription.tsx src/components/Layout/Sidebar/index.tsx src/components/UserProfile/UserSettings/index.tsx src/pages/users/[userId]/settings/subscription.tsx
git commit -m "feat: add Abonnement menu entry and subscription pages"
```

---

### Task 7: Evolve UserSubscriptionSettings UI

**Files:**
- Modify: `src/components/UserProfile/UserSettings/UserSubscriptionSettings/index.tsx`

- [ ] **Step 1: Add i18n messages**

```typescript
    declareTransfer: 'Déclarer un virement',
    transferHistory: 'Historique des virements',
    statusPending: 'En attente',
    statusConfirmed: 'Confirmé',
    statusRejected: 'Rejeté',
    confirm: 'Confirmer',
    reject: 'Rejeter',
    rejectionReason: 'Motif du rejet',
    edit: 'Modifier',
    notConfigured: 'Votre abonnement n\'est pas encore configuré. Contactez un administrateur.',
```

- [ ] **Step 2: Conditional admin sections**

- Show base configuration form only when `isAdmin && !isOwnProfile` (admin editing another user)
- Show gift section only for admin on another user's page
- Show declare transfer form when `isOwnProfile` OR `isAdmin`
- Change admin button label from « Add Payment » to « Ajouter » (admin creates confirmed)

- [ ] **Step 3: Replace payments list with table**

Use same table classes as `SubscriptionList`. Columns: Date, Amount, Method, Status (Badge), Actions.

```tsx
import Badge from '@app/components/Common/Badge';

const statusBadge = (status: SubscriptionPaymentStatus) => {
  if (status === 'pending') return <Badge badgeType="warning">{intl.formatMessage(messages.statusPending)}</Badge>;
  if (status === 'confirmed') return <Badge badgeType="success">{intl.formatMessage(messages.statusConfirmed)}</Badge>;
  return <Badge badgeType="danger">{intl.formatMessage(messages.statusRejected)}</Badge>;
};
```

Actions per row:
- User own pending: Edit (inline or small form toggle) + Delete
- Admin on pending: Confirm + Reject buttons
- Admin always: Delete on any row

Reject opens minimal inline input for optional reason before POST.

- [ ] **Step 4: Wire API calls**

```typescript
const confirmPayment = async (paymentId: number) => {
  await axios.post(`/api/v1/user/${user?.id}/subscription/payment/${paymentId}/confirm`);
  mutate();
};

const rejectPayment = async (paymentId: number, rejectionReason?: string) => {
  await axios.post(`/api/v1/user/${user?.id}/subscription/payment/${paymentId}/reject`, {
    rejectionReason: rejectionReason || undefined,
  });
  mutate();
};

const updatePayment = async (paymentId: number, payload: { date: string; amount: number; method: string }) => {
  await axios.put(`/api/v1/user/${user?.id}/subscription/payment/${paymentId}`, payload);
  mutate();
};
```

- [ ] **Step 5: Manual smoke test**

Run: `pnpm dev`
Visit `/subscription` as a user with configured subscription — verify form + table render.

- [ ] **Step 6: Commit**

```bash
git add src/components/UserProfile/UserSettings/UserSubscriptionSettings/index.tsx
git commit -m "feat: evolve subscription settings for user-declared transfers"
```

---

### Task 8: Admin Overview Pending Column

**Files:**
- Modify: `src/components/SubscriptionList/index.tsx`

- [ ] **Step 1: Add pending column and actions**

```tsx
<th className="px-6 py-3">En attente</th>

// In row:
<td className="px-6 py-4">
  {user.pendingCount > 0
    ? `${user.pendingCount} (€${user.pendingAmount.toFixed(2)})`
    : '-'}
</td>

// Add confirm/reject buttons when pendingCount > 0
// Fetch full subscription to get pending payment IDs, or extend overview API with pendingPaymentIds[]
```

Extend overview API response with `pendingPayments: { id: number; amount: number }[]` per user for inline actions without extra round-trip.

- [ ] **Step 2: Commit**

```bash
git add src/components/SubscriptionList/index.tsx server/routes/subscription.ts server/interfaces/api/userInterfaces.ts
git commit -m "feat: show pending transfers in admin subscription overview"
```

---

### Task 9: Home Page Alert Banner

**Files:**
- Create: `src/components/Discover/SubscriptionAlertBanner/index.tsx`
- Modify: `src/components/Discover/index.tsx`

- [ ] **Step 1: Create banner component**

```tsx
// src/components/Discover/SubscriptionAlertBanner/index.tsx
import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import type { SubscriptionStatusResponse } from '@server/interfaces/api/userInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.SubscriptionAlertBanner', {
  title: 'Abonnement en retard',
  description:
    'Votre abonnement n\'est pas à jour. Il vous reste {months} mois à régulariser.',
  cta: 'Voir mon abonnement',
});

const SubscriptionAlertBanner = () => {
  const intl = useIntl();
  const { data } = useSWR<SubscriptionStatusResponse>('/api/v1/subscription/status');

  if (!data?.isConfigured || data.status !== 'Inactif') {
    return null;
  }

  const monthsBehind = Math.abs(Math.ceil(data.remainingMonths ?? 0));

  return (
    <Alert
      title={intl.formatMessage(messages.title)}
      type="error"
      className="mb-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {intl.formatMessage(messages.description, { months: monthsBehind })}
        </p>
        <Link href="/subscription">
          <Button buttonType="primary">{intl.formatMessage(messages.cta)}</Button>
        </Link>
      </div>
    </Alert>
  );
};

export default SubscriptionAlertBanner;
```

- [ ] **Step 2: Insert in Discover above Recently Added**

In `src/components/Discover/index.tsx`, import and render `<SubscriptionAlertBanner />` at the top of the non-editing slider list (before the first slider renders). Place it outside the slider loop so it always shows at the top of the page content.

- [ ] **Step 3: Commit**

```bash
git add src/components/Discover/SubscriptionAlertBanner/index.tsx src/components/Discover/index.tsx
git commit -m "feat: add subscription overdue alert on discover page"
```

---

### Task 10: Cypress E2E Tests

**Files:**
- Modify: `cypress/e2e/user/subscription-settings.cy.ts`

- [ ] **Step 1: Add user transfer flow test**

```typescript
  it('shows Abonnement menu when subscription is configured', () => {
    cy.loginAsAdmin();
    // configure friend user subscription via API
    cy.request('PUT', `/api/v1/user/${Cypress.env('USER_ID')}/subscription`, {
      pricePerMonth: 10,
      startDate: '2024-01-01',
      preference: 'Mensuel',
    });

    cy.loginAsUser();
    cy.get('[data-testid=sidebar-menu-subscription]').should('be.visible');
    cy.visit('/subscription');
    cy.contains('Déclarer un virement').should('be.visible');
  });

  it('shows overdue banner on discover when behind', () => {
    // setup user with inactive subscription (old start date, no payments)
    cy.loginAsUser();
    cy.visit('/');
    cy.contains('Abonnement en retard').should('be.visible');
  });
```

- [ ] **Step 2: Run Cypress**

Run: `pnpm cypress:run --spec cypress/e2e/user/subscription-settings.cy.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add cypress/e2e/user/subscription-settings.cy.ts
git commit -m "test: add e2e coverage for subscription transfers"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Extend SubscriptionPayment with status fields | Task 1 |
| pending + confirmed in calculations | Task 2 |
| rejected excluded | Task 2 |
| User read own subscription | Task 3 |
| GET /subscription/status | Task 3 |
| User create pending / admin create confirmed | Task 4 |
| User edit/delete own pending | Task 4 |
| Admin confirm/reject | Task 4 |
| Optional rejection reason | Task 4 |
| Overview pending column | Task 8 |
| Menu Abonnement when configured | Task 6 |
| Settings tab same page | Task 6 |
| UserSubscriptionSettings evolution | Task 7 |
| Home banner above Recently Added | Task 9 |
| UX consistency (Alert, Button, Badge, tables) | Tasks 7, 8, 9 |
| OpenAPI | Task 5 |
| Tests | Tasks 2, 3, 4, 10 |
