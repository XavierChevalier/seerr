# Subscription Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a manual subscription and payment tracking system to allow admins to monitor user subscription statuses and balances.

**Architecture:** We will add base subscription settings directly to the existing `User` entity, and create two new entities: `SubscriptionPayment` and `SubscriptionGift`. The backend will calculate the computed values (elapsed months, remaining months, balance) dynamically and expose them through API endpoints in `server/routes/user/index.ts` and `server/routes/subscription.ts`. The frontend will feature a new tab in the User Settings and a global overview page.

**Tech Stack:** React, Next.js, TailwindCSS, Express, TypeORM.

---

### Task 1: Database Entities & Migrations

**Files:**
- Modify: `server/entity/User.ts`
- Create: `server/entity/SubscriptionPayment.ts`
- Create: `server/entity/SubscriptionGift.ts`

- [ ] **Step 1: Create `SubscriptionPayment` entity**

```typescript
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class SubscriptionPayment {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'date' })
  public date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  public amount: number;

  @Column({ type: 'varchar' })
  public method: string;

  @ManyToOne(() => User, (user) => user.subscriptionPayments, { onDelete: 'CASCADE' })
  public user: User;
}
```

- [ ] **Step 2: Create `SubscriptionGift` entity**

```typescript
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class SubscriptionGift {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'date' })
  public date: Date;

  @Column({ type: 'int' })
  public months: number;

  @Column({ type: 'varchar' })
  public reason: string;

  @ManyToOne(() => User, (user) => user.subscriptionGifts, { onDelete: 'CASCADE' })
  public user: User;
}
```

- [ ] **Step 3: Modify `server/entity/User.ts`**

At the top of the file, add imports:
```typescript
import { SubscriptionPayment } from './SubscriptionPayment';
import { SubscriptionGift } from './SubscriptionGift';
```

Inside the `User` class add:
```typescript
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  public subscriptionPricePerMonth?: number | null;

  @Column({ type: 'date', nullable: true })
  public subscriptionStartDate?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  public subscriptionPreference?: string | null;

  @OneToMany(() => SubscriptionPayment, (payment) => payment.user)
  public subscriptionPayments: SubscriptionPayment[];

  @OneToMany(() => SubscriptionGift, (gift) => gift.user)
  public subscriptionGifts: SubscriptionGift[];
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm run migration:generate server/migration/SubscriptionTracking`
Expected: Migration generated successfully.

- [ ] **Step 5: Run tests to ensure no compilation errors**
Run: `pnpm typecheck:server`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/entity/User.ts server/entity/SubscriptionPayment.ts server/entity/SubscriptionGift.ts server/migration/
git commit -m "feat: add subscription database entities and migrations"
```

### Task 2: Backend API Interfaces

**Files:**
- Modify: `server/interfaces/api/userInterfaces.ts`

- [ ] **Step 1: Add new interfaces to `server/interfaces/api/userInterfaces.ts`**

```typescript
export interface SubscriptionPaymentResponse {
  id: number;
  date: string;
  amount: number;
  method: string;
}

export interface SubscriptionGiftResponse {
  id: number;
  date: string;
  months: number;
  reason: string;
}

export interface UserSubscriptionResponse {
  pricePerMonth: number | null;
  startDate: string | null;
  preference: string | null;
  totalPaid: number;
  totalDue: number;
  balance: number;
  elapsedMonths: number;
  totalGiftedMonths: number;
  remainingMonths: number;
  status: 'Actif' | 'Inactif';
  payments: SubscriptionPaymentResponse[];
  gifts: SubscriptionGiftResponse[];
}
```

- [ ] **Step 2: Commit**

```bash
git add server/interfaces/api/userInterfaces.ts
git commit -m "feat: add subscription api interfaces"
```

### Task 3: API Helper function

**Files:**
- Create: `server/utils/subscriptionHelpers.ts`

- [ ] **Step 1: Create helper to calculate subscription state**

```typescript
import { User } from '../entity/User';
import { UserSubscriptionResponse } from '../interfaces/api/userInterfaces';

export function calculateSubscriptionState(user: User): UserSubscriptionResponse {
  const pricePerMonth = user.subscriptionPricePerMonth ? Number(user.subscriptionPricePerMonth) : 0;
  const payments = user.subscriptionPayments || [];
  const gifts = user.subscriptionGifts || [];

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalGiftedMonths = gifts.reduce((sum, g) => sum + Number(g.months), 0);
  
  let elapsedMonths = 0;
  if (user.subscriptionStartDate) {
    const start = new Date(user.subscriptionStartDate);
    const now = new Date();
    elapsedMonths =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());
    if (elapsedMonths < 0) elapsedMonths = 0;
  }

  const totalDue = elapsedMonths * pricePerMonth;
  const balance = totalPaid - totalDue + (totalGiftedMonths * pricePerMonth);
  const remainingMonths = pricePerMonth > 0 
    ? (totalPaid / pricePerMonth) + totalGiftedMonths - elapsedMonths
    : totalGiftedMonths - elapsedMonths;
    
  const status = remainingMonths >= 0 ? 'Actif' : 'Inactif';

  return {
    pricePerMonth: user.subscriptionPricePerMonth ? Number(user.subscriptionPricePerMonth) : null,
    startDate: user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toISOString().split('T')[0] : null,
    preference: user.subscriptionPreference || null,
    totalPaid,
    totalDue,
    balance,
    elapsedMonths,
    totalGiftedMonths,
    remainingMonths,
    status,
    payments: payments.map(p => ({
      id: p.id,
      date: new Date(p.date).toISOString().split('T')[0],
      amount: Number(p.amount),
      method: p.method
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    gifts: gifts.map(g => ({
      id: g.id,
      date: new Date(g.date).toISOString().split('T')[0],
      months: Number(g.months),
      reason: g.reason
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/subscriptionHelpers.ts
git commit -m "feat: add subscription calculation helper"
```

### Task 4: Backend API Routes (User Subscription Detail)

**Files:**
- Modify: `server/routes/user/index.ts`

- [ ] **Step 1: Add subscription detail endpoints**

In `server/routes/user/index.ts`, add the necessary endpoints for fetching and updating subscriptions:

```typescript
// Import at top
import { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import { SubscriptionGift } from '@server/entity/SubscriptionGift';
import { calculateSubscriptionState } from '@server/utils/subscriptionHelpers';

// Add new endpoints (place these appropriately after existing user endpoints):
userRoutes.get(
  '/:id/subscription',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });

      if (!user) {
        return next({ status: 404, message: 'User not found' });
      }

      return res.status(200).json(calculateSubscriptionState(user));
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userRoutes.put(
  '/:id/subscription',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });

      if (!user) return next({ status: 404, message: 'User not found' });

      user.subscriptionPricePerMonth = req.body.pricePerMonth;
      user.subscriptionStartDate = req.body.startDate ? new Date(req.body.startDate) : null;
      user.subscriptionPreference = req.body.preference;

      await userRepository.save(user);

      return res.status(200).json(calculateSubscriptionState(user));
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userRoutes.post(
  '/:id/subscription/payment',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) }
      });
      if (!user) return next({ status: 404, message: 'User not found' });

      const paymentRepo = getRepository(SubscriptionPayment);
      const payment = new SubscriptionPayment();
      payment.date = new Date(req.body.date);
      payment.amount = req.body.amount;
      payment.method = req.body.method;
      payment.user = user;
      await paymentRepo.save(payment);

      const updatedUser = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });
      return res.status(200).json(calculateSubscriptionState(updatedUser!));
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userRoutes.delete(
  '/:id/subscription/payment/:paymentId',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const paymentRepo = getRepository(SubscriptionPayment);
      await paymentRepo.delete(Number(req.params.paymentId));
      
      const userRepository = getRepository(User);
      const updatedUser = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });
      return res.status(200).json(calculateSubscriptionState(updatedUser!));
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userRoutes.post(
  '/:id/subscription/gift',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) }
      });
      if (!user) return next({ status: 404, message: 'User not found' });

      const giftRepo = getRepository(SubscriptionGift);
      const gift = new SubscriptionGift();
      gift.date = new Date(req.body.date);
      gift.months = req.body.months;
      gift.reason = req.body.reason;
      gift.user = user;
      await giftRepo.save(gift);

      const updatedUser = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });
      return res.status(200).json(calculateSubscriptionState(updatedUser!));
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userRoutes.delete(
  '/:id/subscription/gift/:giftId',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const giftRepo = getRepository(SubscriptionGift);
      await giftRepo.delete(Number(req.params.giftId));

      const userRepository = getRepository(User);
      const updatedUser = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });
      return res.status(200).json(calculateSubscriptionState(updatedUser!));
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/user/index.ts
git commit -m "feat: add user subscription detail routes"
```

### Task 5: Backend API Routes (Overview List)

**Files:**
- Create: `server/routes/subscription.ts`
- Modify: `server/routes/index.ts`

- [ ] **Step 1: Create `server/routes/subscription.ts`**

```typescript
import { Router } from 'express';
import { getRepository } from 'typeorm';
import { User } from '@server/entity/User';
import { isAuthenticated } from '@server/middleware/auth';
import { Permission } from '@server/lib/permissions';
import { calculateSubscriptionState } from '@server/utils/subscriptionHelpers';

const subscriptionRoutes = Router();

subscriptionRoutes.get(
  '/',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const users = await userRepository.find({
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });

      const results = users.map(user => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        subscription: calculateSubscriptionState(user)
      }));

      return res.status(200).json({ results });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

export default subscriptionRoutes;
```

- [ ] **Step 2: Wire it in `server/routes/index.ts`**

```typescript
// Import
import subscriptionRoutes from './subscription';

// Inside router use
router.use('/subscription', subscriptionRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/subscription.ts server/routes/index.ts
git commit -m "feat: add subscription overview route"
```

### Task 6: Frontend API Hooks

**Files:**
- Modify: `src/hooks/useUser.ts` (if appropriate, or just inline `useSWR` in components). 
Let's just use raw `useSWR` calls in components to avoid modifying extra files, keeping it DRY.

### Task 7: User Profile Settings Tab

**Files:**
- Modify: `src/components/UserProfile/UserSettings/index.tsx`
- Create: `src/components/UserProfile/UserSettings/UserSubscriptionSettings/index.tsx`
- Create: `src/pages/users/[userId]/settings/subscription.tsx`

- [ ] **Step 1: Create `src/pages/users/[userId]/settings/subscription.tsx`**

```tsx
import UserSettings from '@app/components/UserProfile/UserSettings';
import UserSubscriptionSettings from '@app/components/UserProfile/UserSettings/UserSubscriptionSettings';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const UserSettingsSubscriptionPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return (
    <UserSettings>
      <UserSubscriptionSettings />
    </UserSettings>
  );
};

export default UserSettingsSubscriptionPage;
```

- [ ] **Step 2: Create `src/components/UserProfile/UserSettings/UserSubscriptionSettings/index.tsx`**

```tsx
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import { useUser } from '@app/hooks/useUser';
import type { UserSubscriptionResponse } from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import { useToasts } from 'react-hot-toast';

const UserSubscriptionSettings = () => {
  const router = useRouter();
  const { user } = useUser({ id: Number(router.query.userId) });
  const { data, error, mutate } = useSWR<UserSubscriptionResponse>(
    user ? `/api/v1/user/${user.id}/subscription` : null
  );
  const { addToast } = useToasts();
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    pricePerMonth: '',
    startDate: '',
    preference: 'Mensuel'
  });

  if (!data && !error) return <LoadingSpinner />;
  if (error) return <div>Error loading subscriptions.</div>;

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.put(`/api/v1/user/${user?.id}/subscription`, {
        pricePerMonth: settings.pricePerMonth ? Number(settings.pricePerMonth) : null,
        startDate: settings.startDate || null,
        preference: settings.preference,
      });
      mutate();
      addToast('Settings saved successfully', { appearance: 'success' });
    } catch (e) {
      addToast('Failed to save settings', { appearance: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const addPayment = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      await axios.post(`/api/v1/user/${user?.id}/subscription/payment`, {
        date: formData.get('date'),
        amount: Number(formData.get('amount')),
        method: formData.get('method')
      });
      mutate();
      (e.target as HTMLFormElement).reset();
    } catch (e) {}
  };

  const addGift = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      await axios.post(`/api/v1/user/${user?.id}/subscription/gift`, {
        date: formData.get('date'),
        months: Number(formData.get('months')),
        reason: formData.get('reason')
      });
      mutate();
      (e.target as HTMLFormElement).reset();
    } catch (e) {}
  };

  const deletePayment = async (id: number) => {
    try {
      await axios.delete(`/api/v1/user/${user?.id}/subscription/payment/${id}`);
      mutate();
    } catch (e) {}
  };

  const deleteGift = async (id: number) => {
    try {
      await axios.delete(`/api/v1/user/${user?.id}/subscription/gift/${id}`);
      mutate();
    } catch (e) {}
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="heading">Subscription Settings</h3>
        <p className="description">Manage billing history and dates.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">Status</p>
          <p className="text-2xl font-bold">{data?.status}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">Remaining Months</p>
          <p className="text-2xl font-bold">{data?.remainingMonths}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">Total Paid</p>
          <p className="text-2xl font-bold">€{data?.totalPaid.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">Balance</p>
          <p className="text-2xl font-bold">€{data?.balance.toFixed(2)}</p>
        </div>
      </div>

      <form onSubmit={saveSettings} className="mb-8 rounded-lg bg-gray-800 p-4">
        <h4 className="mb-4 text-lg font-bold">Base Configuration</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-gray-400">Monthly Price (€)</label>
            <input type="number" step="0.01" value={settings.pricePerMonth} onChange={e => setSettings({...settings, pricePerMonth: e.target.value})} className="mt-1 w-full rounded bg-gray-700 p-2 text-white" placeholder={data?.pricePerMonth?.toString()} />
          </div>
          <div>
            <label className="text-gray-400">Start Date</label>
            <input type="date" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} className="mt-1 w-full rounded bg-gray-700 p-2 text-white" />
          </div>
          <div>
            <label className="text-gray-400">Preference</label>
            <select value={settings.preference} onChange={e => setSettings({...settings, preference: e.target.value})} className="mt-1 w-full rounded bg-gray-700 p-2 text-white">
              <option>Mensuel</option>
              <option>Semestriel</option>
              <option>Annuel</option>
              <option>Gratuit</option>
            </select>
          </div>
        </div>
        <Button buttonType="primary" className="mt-4" disabled={isSaving}>Save Settings</Button>
      </form>

      <div className="mb-8">
        <h4 className="mb-4 text-lg font-bold">Payments History</h4>
        <form onSubmit={addPayment} className="mb-4 flex gap-4">
          <input type="date" name="date" required className="w-1/4 rounded bg-gray-700 p-2" />
          <input type="number" step="0.01" name="amount" required placeholder="Amount (€)" className="w-1/4 rounded bg-gray-700 p-2" />
          <input type="text" name="method" required placeholder="Method (e.g. PayPal)" className="w-1/4 rounded bg-gray-700 p-2" />
          <Button buttonType="success" type="submit">Add Payment</Button>
        </form>
        <ul className="rounded-lg bg-gray-800 p-4">
          {data?.payments.map(p => (
            <li key={p.id} className="flex justify-between border-b border-gray-700 py-2">
              <span>{p.date} - €{p.amount.toFixed(2)} ({p.method})</span>
              <button onClick={() => deletePayment(p.id)} className="text-red-500">Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-4 text-lg font-bold">Gifted Months</h4>
        <form onSubmit={addGift} className="mb-4 flex gap-4">
          <input type="date" name="date" required className="w-1/4 rounded bg-gray-700 p-2" />
          <input type="number" name="months" required placeholder="Months" className="w-1/4 rounded bg-gray-700 p-2" />
          <input type="text" name="reason" required placeholder="Reason" className="w-1/4 rounded bg-gray-700 p-2" />
          <Button buttonType="success" type="submit">Add Gift</Button>
        </form>
        <ul className="rounded-lg bg-gray-800 p-4">
          {data?.gifts.map(g => (
            <li key={g.id} className="flex justify-between border-b border-gray-700 py-2">
              <span>{g.date} - {g.months} months ({g.reason})</span>
              <button onClick={() => deleteGift(g.id)} className="text-red-500">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UserSubscriptionSettings;
```

- [ ] **Step 3: Wire into settings menu `src/components/UserProfile/UserSettings/index.tsx`**

Add the link for the subscription tab inside the `settingsRoutes` definition so it shows up on the sidebar.

```tsx
// Inside src/components/UserProfile/UserSettings/index.tsx
// Add this entry to `settingsRoutes` array:
  {
    text: 'Abonnement',
    route: `/users/${user?.id}/settings/subscription`,
    regex: /^\/users\/[0-9]+\/settings\/subscription/,
    requiredPermission: Permission.MANAGE_USERS,
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/users/[userId]/settings/subscription.tsx src/components/UserProfile/UserSettings/UserSubscriptionSettings/index.tsx src/components/UserProfile/UserSettings/index.tsx
git commit -m "feat: add user subscription settings tab"
```

### Task 8: Frontend Global Dashboard View

**Files:**
- Create: `src/pages/subscriptions/index.tsx`
- Create: `src/components/SubscriptionList/index.tsx`

- [ ] **Step 1: Create global list component `src/components/SubscriptionList/index.tsx`**

```tsx
import PageTitle from '@app/components/Common/PageTitle';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import type { SubscriptionOverviewResponse } from '@server/interfaces/api/userInterfaces';
import useSWR from 'swr';
import Link from 'next/link';

const SubscriptionList = () => {
  const { data, error } = useSWR<SubscriptionOverviewResponse>('/api/v1/subscription');

  if (!data && !error) return <LoadingSpinner />;

  return (
    <>
      <PageTitle title="Subscriptions Overview" />
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Subscriptions Overview</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Balance</th>
              <th className="px-6 py-3">Remaining Months</th>
              <th className="px-6 py-3">Total Paid</th>
              <th className="px-6 py-3">Monthly Price</th>
              <th className="px-6 py-3">Preference</th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map((user) => (
              <tr key={user.id} className="border-b border-gray-700 bg-gray-800 hover:bg-gray-700">
                <td className="px-6 py-4 font-medium text-white">
                  <Link href={`/users/${user.id}/settings/subscription`} className="hover:underline">
                    {user.displayName}
                  </Link>
                </td>
                <td className={`px-6 py-4 font-bold ${user.subscription.status === 'Actif' ? 'text-green-500' : 'text-red-500'}`}>
                  {user.subscription.status}
                </td>
                <td className="px-6 py-4">€{user.subscription.balance.toFixed(2)}</td>
                <td className="px-6 py-4">{user.subscription.remainingMonths}</td>
                <td className="px-6 py-4">€{user.subscription.totalPaid.toFixed(2)}</td>
                <td className="px-6 py-4">{user.subscription.pricePerMonth ? `€${user.subscription.pricePerMonth.toFixed(2)}` : '-'}</td>
                <td className="px-6 py-4">{user.subscription.preference || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default SubscriptionList;
```

- [ ] **Step 2: Create the page `src/pages/subscriptions/index.tsx`**

```tsx
import SubscriptionList from '@app/components/SubscriptionList';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const SubscriptionsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return <SubscriptionList />;
};

export default SubscriptionsPage;
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/subscriptions/index.tsx src/components/SubscriptionList/index.tsx
git commit -m "feat: add global subscriptions overview page"
```
