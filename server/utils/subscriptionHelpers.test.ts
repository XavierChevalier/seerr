import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SubscriptionGift } from '@server/entity/SubscriptionGift';
import { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import { User } from '@server/entity/User';
import {
  calculateSubscriptionMissingTotal,
  calculateSubscriptionState,
  getNextRecurringDeclarationDate,
  getRecurringTransferAmount,
  hasRecurringPaymentForPeriod,
  isRecurringDeclarationDay,
  isValidSubscriptionPreference,
  isValidUserSubscriptionPreference,
  shouldCreateRecurringPayment,
} from '@server/utils/subscriptionHelpers';

function createUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 2;
  user.subscriptionPricePerMonth = 10;
  user.subscriptionStartDate = new Date('2024-01-01');
  user.subscriptionPreference = 'Mensuel';
  user.subscriptionRecurringEnabled = false;
  user.subscriptionRecurringDayOfMonth = null;
  user.subscriptionPayments = [];
  user.subscriptionGifts = [];
  Object.assign(user, overrides);
  return user;
}

describe('calculateSubscriptionState', () => {
  it('returns inactive status with zero balance when no payments or gifts', () => {
    const user = createUser({
      subscriptionStartDate: new Date('2020-01-01'),
    });

    const state = calculateSubscriptionState(user);

    assert.strictEqual(state.pricePerMonth, 10);
    assert.strictEqual(state.startDate, '2020-01-01');
    assert.strictEqual(state.preference, 'Mensuel');
    assert.strictEqual(state.totalPaid, 0);
    assert.ok(state.totalDue > 0);
    assert.ok(state.balance < 0);
    assert.strictEqual(state.status, 'Inactif');
    assert.deepStrictEqual(state.payments, []);
    assert.deepStrictEqual(state.gifts, []);
    assert.strictEqual(state.recurringTransfer.enabled, false);
    assert.strictEqual(state.recurringTransfer.amount, 10);
    assert.strictEqual(state.recurringTransfer.intervalMonths, 1);
  });

  it('calculates remaining months from payments and gifted months', () => {
    const payment = new SubscriptionPayment();
    payment.id = 1;
    payment.date = new Date('2024-06-01');
    payment.amount = 60;
    payment.method = 'PayPal';
    payment.status = 'confirmed';
    payment.createdByUserId = 2;

    const gift = new SubscriptionGift();
    gift.id = 1;
    gift.date = new Date('2024-06-01');
    gift.months = 2;
    gift.reason = 'Welcome bonus';

    const user = createUser({
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPayments: [payment],
      subscriptionGifts: [gift],
    });

    const state = calculateSubscriptionState(user);

    assert.strictEqual(state.totalPaid, 60);
    assert.strictEqual(state.totalGiftedMonths, 2);
    assert.ok(['Actif', 'Inactif'].includes(state.status));
    assert.strictEqual(state.payments.length, 1);
    assert.strictEqual(state.gifts.length, 1);
    assert.strictEqual(state.payments[0].method, 'PayPal');
  });

  it('sorts payments and gifts by date descending', () => {
    const older = new SubscriptionPayment();
    older.id = 1;
    older.date = new Date('2024-01-01');
    older.amount = 10;
    older.method = 'Virement SEPA';
    older.status = 'confirmed';
    older.createdByUserId = 2;

    const newer = new SubscriptionPayment();
    newer.id = 2;
    newer.date = new Date('2024-06-01');
    newer.amount = 20;
    newer.method = 'PayPal';
    newer.status = 'confirmed';
    newer.createdByUserId = 2;

    const user = createUser({
      subscriptionPayments: [older, newer],
    });

    const state = calculateSubscriptionState(user);

    assert.strictEqual(state.payments[0].id, 2);
    assert.strictEqual(state.payments[1].id, 1);
  });

  it('excludes rejected payments from totalPaid', () => {
    const confirmed = new SubscriptionPayment();
    confirmed.id = 1;
    confirmed.date = new Date('2024-06-01');
    confirmed.amount = 30;
    confirmed.method = 'Virement SEPA';
    confirmed.status = 'confirmed';
    confirmed.createdByUserId = 2;

    const rejected = new SubscriptionPayment();
    rejected.id = 2;
    rejected.date = new Date('2024-07-01');
    rejected.amount = 50;
    rejected.method = 'Virement SEPA';
    rejected.status = 'rejected';
    rejected.createdByUserId = 2;

    const user = createUser({
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPayments: [confirmed, rejected],
    });

    const state = calculateSubscriptionState(user);
    assert.strictEqual(state.totalPaid, 30);
  });

  it('returns active status with zero balance for free subscriptions', () => {
    const user = createUser({
      subscriptionPricePerMonth: 0,
      subscriptionStartDate: new Date('2023-06-28'),
      subscriptionPreference: 'Gratuit',
    });

    const state = calculateSubscriptionState(user);

    assert.strictEqual(state.totalPaid, 0);
    assert.strictEqual(state.balance, 0);
    assert.strictEqual(state.remainingMonths, 0);
    assert.strictEqual(state.status, 'Actif');
    assert.strictEqual(state.recurringTransfer.amount, null);
  });

  it('includes pending payments in totalPaid', () => {
    const pending = new SubscriptionPayment();
    pending.id = 1;
    pending.date = new Date('2024-06-01');
    pending.amount = 20;
    pending.method = 'Virement SEPA';
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
});

describe('recurring transfer helpers', () => {
  it('calculates recurring amount from preference', () => {
    const monthly = createUser({ subscriptionPreference: 'Mensuel' });
    const semiannual = createUser({ subscriptionPreference: 'Semestriel' });
    const annual = createUser({ subscriptionPreference: 'Annuel' });

    assert.strictEqual(getRecurringTransferAmount(monthly), 10);
    assert.strictEqual(getRecurringTransferAmount(semiannual), 60);
    assert.strictEqual(getRecurringTransferAmount(annual), 120);
  });

  it('validates user-selectable subscription preferences', () => {
    assert.strictEqual(isValidUserSubscriptionPreference('Mensuel'), true);
    assert.strictEqual(isValidUserSubscriptionPreference('Semestriel'), true);
    assert.strictEqual(isValidUserSubscriptionPreference('Annuel'), true);
    assert.strictEqual(isValidUserSubscriptionPreference('Gratuit'), false);
    assert.strictEqual(isValidSubscriptionPreference('Gratuit'), true);
  });

  it('detects declaration days based on preference interval', () => {
    const monthly = createUser({
      subscriptionRecurringEnabled: true,
      subscriptionRecurringDayOfMonth: 5,
      subscriptionPreference: 'Mensuel',
    });
    const semiannual = createUser({
      subscriptionRecurringEnabled: true,
      subscriptionRecurringDayOfMonth: 5,
      subscriptionPreference: 'Semestriel',
    });

    assert.strictEqual(
      isRecurringDeclarationDay(monthly, new Date('2024-03-05')),
      true
    );
    assert.strictEqual(
      isRecurringDeclarationDay(monthly, new Date('2024-03-06')),
      false
    );
    assert.strictEqual(
      isRecurringDeclarationDay(semiannual, new Date('2024-01-05')),
      true
    );
    assert.strictEqual(
      isRecurringDeclarationDay(semiannual, new Date('2024-02-05')),
      false
    );
    assert.strictEqual(
      isRecurringDeclarationDay(semiannual, new Date('2024-07-05')),
      true
    );
  });

  it('skips declaration before subscription start date', () => {
    const user = createUser({
      subscriptionStartDate: new Date('2024-01-15'),
      subscriptionRecurringEnabled: true,
      subscriptionRecurringDayOfMonth: 5,
    });

    assert.strictEqual(
      isRecurringDeclarationDay(user, new Date('2024-01-05')),
      false
    );
  });

  it('avoids duplicate declarations for the same billing period', () => {
    const pending = new SubscriptionPayment();
    pending.id = 1;
    pending.date = new Date('2024-03-05');
    pending.amount = 10;
    pending.method = 'Virement SEPA';
    pending.status = 'pending';
    pending.createdByUserId = 2;

    const user = createUser({
      subscriptionRecurringEnabled: true,
      subscriptionRecurringDayOfMonth: 5,
      subscriptionPayments: [pending],
    });

    assert.strictEqual(
      hasRecurringPaymentForPeriod(user, new Date('2024-03-05')),
      true
    );
    assert.strictEqual(
      shouldCreateRecurringPayment(user, new Date('2024-03-05')),
      false
    );
  });

  it('ignores rejected payments when checking for duplicates', () => {
    const rejected = new SubscriptionPayment();
    rejected.id = 1;
    rejected.date = new Date('2024-03-05');
    rejected.amount = 10;
    rejected.method = 'Virement SEPA';
    rejected.status = 'rejected';
    rejected.createdByUserId = 2;

    const user = createUser({
      subscriptionRecurringEnabled: true,
      subscriptionRecurringDayOfMonth: 5,
      subscriptionPayments: [rejected],
    });

    assert.strictEqual(
      shouldCreateRecurringPayment(user, new Date('2024-03-05')),
      true
    );
  });

  it('returns the next declaration date when recurring is enabled', () => {
    const user = createUser({
      subscriptionRecurringEnabled: true,
      subscriptionRecurringDayOfMonth: 5,
    });

    assert.strictEqual(
      getNextRecurringDeclarationDate(user, new Date('2024-03-01')),
      '2024-03-05'
    );
  });
});

describe('calculateSubscriptionMissingTotal', () => {
  it('sums absolute negative balances for configured users only', () => {
    const behind = createUser({
      id: 2,
      subscriptionStartDate: new Date('2020-01-01'),
    });
    const ahead = createUser({
      id: 3,
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPayments: [
        Object.assign(new SubscriptionPayment(), {
          id: 1,
          date: new Date('2024-06-01'),
          amount: 1000,
          method: 'PayPal',
          status: 'confirmed',
          createdByUserId: 3,
        }),
      ],
    });
    const unconfigured = createUser({
      id: 4,
      subscriptionPricePerMonth: null,
      subscriptionStartDate: null,
    });

    const missing = calculateSubscriptionMissingTotal([
      behind,
      ahead,
      unconfigured,
    ]);

    assert.ok(missing > 0);
    assert.strictEqual(
      missing,
      Math.abs(calculateSubscriptionState(behind).balance)
    );
  });
});
