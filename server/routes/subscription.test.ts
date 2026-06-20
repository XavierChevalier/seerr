import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

import { getRepository } from '@server/datasource';
import { SubscriptionGift } from '@server/entity/SubscriptionGift';
import { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import subscriptionOverviewRoutes from './subscription';
import userRoutes from './user';

let app: Express;

function createApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  testApp.use(checkUser);
  testApp.use('/auth', authRoutes);
  testApp.use('/user', isAuthenticated(), userRoutes);
  testApp.use('/subscription', subscriptionOverviewRoutes);
  testApp.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return testApp;
}

before(async () => {
  app = createApp();
});

setupTestDb();

async function loginAs(email: string, password: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(app);
    const res = await agent.post('/auth/local').send({ email, password });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

async function getFriendUserId() {
  const user = await getRepository(User).findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });
  return user.id;
}

describe('GET /user/:id/subscription', () => {
  it('returns 403 when not authenticated', async () => {
    const userId = await getFriendUserId();
    const res = await request(app).get(`/user/${userId}/subscription`);
    assert.strictEqual(res.status, 403);
  });

  it('returns subscription state for an existing user', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const userId = await getFriendUserId();

    const res = await agent.get(`/user/${userId}/subscription`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pricePerMonth, null);
    assert.strictEqual(res.body.status, 'Actif');
    assert.deepStrictEqual(res.body.payments, []);
    assert.deepStrictEqual(res.body.gifts, []);
  });

  it('returns 404 when user does not exist', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.get('/user/99999/subscription');

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.message, 'User not found');
  });
});

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

describe('PUT /user/:id/subscription', () => {
  it('updates subscription settings', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const userId = await getFriendUserId();

    const res = await agent.put(`/user/${userId}/subscription`).send({
      pricePerMonth: 12.5,
      startDate: '2024-03-01',
      preference: 'Mensuel',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pricePerMonth, 12.5);
    assert.strictEqual(res.body.startDate, '2024-03-01');
    assert.strictEqual(res.body.preference, 'Mensuel');
  });
});

describe('subscription payments and gifts', () => {
  let userId: number;

  beforeEach(async () => {
    userId = await getFriendUserId();
    await getRepository(SubscriptionPayment)
      .createQueryBuilder()
      .delete()
      .execute();
    await getRepository(SubscriptionGift)
      .createQueryBuilder()
      .delete()
      .execute();
    await getRepository(User).update(userId, {
      subscriptionPricePerMonth: 10,
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionPreference: 'Mensuel',
    });
  });

  it('adds and deletes a payment scoped to the user', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const createRes = await agent
      .post(`/user/${userId}/subscription/payment`)
      .send({
        date: '2024-06-01',
        amount: 30,
        method: 'PayPal',
      });

    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.payments.length, 1);
    assert.strictEqual(createRes.body.totalPaid, 30);

    const paymentId = createRes.body.payments[0].id;

    const deleteRes = await agent.delete(
      `/user/${userId}/subscription/payment/${paymentId}`
    );

    assert.strictEqual(deleteRes.status, 200);
    assert.deepStrictEqual(deleteRes.body.payments, []);
  });

  it('returns 404 when deleting a payment for another user', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const createRes = await agent
      .post(`/user/${userId}/subscription/payment`)
      .send({
        date: '2024-06-01',
        amount: 30,
        method: 'PayPal',
      });
    const paymentId = createRes.body.payments[0].id;

    const deleteRes = await agent.delete(
      `/user/1/subscription/payment/${paymentId}`
    );

    assert.strictEqual(deleteRes.status, 404);
    assert.strictEqual(deleteRes.body.message, 'Payment not found');
  });

  it('adds and deletes a gift scoped to the user', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const createRes = await agent
      .post(`/user/${userId}/subscription/gift`)
      .send({
        date: '2024-06-01',
        months: 2,
        reason: 'Promo',
      });

    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.gifts.length, 1);
    assert.strictEqual(createRes.body.totalGiftedMonths, 2);

    const giftId = createRes.body.gifts[0].id;

    const deleteRes = await agent.delete(
      `/user/${userId}/subscription/gift/${giftId}`
    );

    assert.strictEqual(deleteRes.status, 200);
    assert.deepStrictEqual(deleteRes.body.gifts, []);
  });
});

describe('GET /subscription/count', () => {
  it('returns pending payment count for admin', async () => {
    const userId = await getFriendUserId();
    await getRepository(SubscriptionPayment)
      .createQueryBuilder()
      .delete()
      .execute();
    await getRepository(User).update(userId, {
      subscriptionPricePerMonth: 10,
      subscriptionStartDate: new Date('2024-01-01'),
    });

    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    await userAgent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-01',
      amount: 15,
      method: 'Virement SEPA',
    });

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await adminAgent.get('/subscription/count');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pending, 1);
  });

  it('returns 403 for users without manage users permission', async () => {
    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    await userRepo.update(friend.id, { permissions: Permission.REQUEST });

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.get('/subscription/count');

    assert.strictEqual(res.status, 403);

    await userRepo.update(friend.id, { permissions: 32 });
  });
});

describe('GET /subscription/payments', () => {
  let userId: number;

  beforeEach(async () => {
    userId = await getFriendUserId();
    await getRepository(SubscriptionPayment)
      .createQueryBuilder()
      .delete()
      .execute();
    await getRepository(User).update(userId, {
      subscriptionPricePerMonth: 10,
      subscriptionStartDate: new Date('2024-01-01'),
    });
  });

  it('returns all payments for admin', async () => {
    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    await userAgent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-01',
      amount: 15,
      method: 'Virement SEPA',
    });

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    await adminAgent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-02',
      amount: 20,
      method: 'PayPal',
    });

    const res = await adminAgent.get('/subscription/payments');

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.strictEqual(res.body.results.length, 2);
    assert.ok(
      res.body.results.every(
        (item: { user: { id: number } }) => item.user.id === userId
      )
    );
  });

  it('filters payments by status', async () => {
    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    const createRes = await userAgent
      .post(`/user/${userId}/subscription/payment`)
      .send({ date: '2024-06-01', amount: 15, method: 'Virement SEPA' });
    const paymentId = createRes.body.payments[0].id;

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    await adminAgent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-02',
      amount: 20,
      method: 'PayPal',
    });

    const pendingRes = await adminAgent.get(
      '/subscription/payments?status=pending'
    );
    assert.strictEqual(pendingRes.status, 200);
    assert.strictEqual(pendingRes.body.results.length, 1);
    assert.strictEqual(pendingRes.body.results[0].status, 'pending');

    const rejectRes = await adminAgent.post(
      `/user/${userId}/subscription/payment/${paymentId}/reject`
    );
    assert.strictEqual(rejectRes.status, 200);
    const rejectedPayment = rejectRes.body.payments.find(
      (payment: { id: number }) => payment.id === paymentId
    );
    assert.strictEqual(rejectedPayment.status, 'rejected');

    const allRes = await adminAgent.get('/subscription/payments');
    assert.strictEqual(allRes.status, 200);
    assert.strictEqual(allRes.body.results.length, 2);

    const rejectedRes = await adminAgent.get(
      '/subscription/payments?status=rejected'
    );
    assert.strictEqual(rejectedRes.status, 200);
    assert.strictEqual(rejectedRes.body.results.length, 1);
    assert.strictEqual(rejectedRes.body.results[0].status, 'rejected');

    const confirmedRes = await adminAgent.get(
      '/subscription/payments?status=confirmed'
    );
    assert.strictEqual(confirmedRes.status, 200);
    assert.strictEqual(confirmedRes.body.results.length, 1);
    assert.strictEqual(confirmedRes.body.results[0].status, 'confirmed');
  });

  it('returns 403 for users without manage users permission', async () => {
    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    await userRepo.update(friend.id, { permissions: Permission.REQUEST });

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.get('/subscription/payments');

    assert.strictEqual(res.status, 403);

    await userRepo.update(friend.id, { permissions: 32 });
  });
});

describe('GET /subscription', () => {
  it('returns overview for all users when admin', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent.get('/subscription');

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.ok(res.body.results.length >= 2);
    assert.ok(
      res.body.results.every(
        (item: { subscription: { status: string } }) =>
          item.subscription.status === 'Actif' ||
          item.subscription.status === 'Inactif'
      )
    );
  });

  it('returns 403 for users without manage users permission', async () => {
    const userRepo = getRepository(User);
    const friend = await userRepo.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    await userRepo.update(friend.id, { permissions: Permission.REQUEST });

    const agent = await loginAs('friend@seerr.dev', 'test1234');
    const res = await agent.get('/subscription');

    assert.strictEqual(res.status, 403);

    await userRepo.update(friend.id, { permissions: 32 });
  });
});

describe('user-declared payments', () => {
  let userId: number;

  beforeEach(async () => {
    userId = await getFriendUserId();
    await getRepository(SubscriptionPayment)
      .createQueryBuilder()
      .delete()
      .execute();
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
      method: 'Virement SEPA',
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
      method: 'Virement SEPA',
    });

    assert.strictEqual(res.status, 403);
  });

  it('returns 400 for an invalid payment method', async () => {
    const agent = await loginAs('friend@seerr.dev', 'test1234');

    const res = await agent.post(`/user/${userId}/subscription/payment`).send({
      date: '2024-06-01',
      amount: 15,
      method: 'RIB',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'Invalid payment method.');
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
      .send({ date: '2024-06-01', amount: 15, method: 'Virement SEPA' });
    const paymentId = createRes.body.payments[0].id;

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await adminAgent.post(
      `/user/${userId}/subscription/payment/${paymentId}/confirm`
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'confirmed');
    assert.strictEqual(res.body.payments[0].date, '2024-06-01');
  });

  it('lets admin confirm a pending payment with a custom reception date', async () => {
    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    const createRes = await userAgent
      .post(`/user/${userId}/subscription/payment`)
      .send({ date: '2024-06-01', amount: 15, method: 'Virement SEPA' });
    const paymentId = createRes.body.payments[0].id;

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await adminAgent
      .post(`/user/${userId}/subscription/payment/${paymentId}/confirm`)
      .send({ date: '2024-06-05' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'confirmed');
    assert.strictEqual(res.body.payments[0].date, '2024-06-05');
  });

  it('lets admin reject a pending payment with optional reason', async () => {
    const userAgent = await loginAs('friend@seerr.dev', 'test1234');
    const createRes = await userAgent
      .post(`/user/${userId}/subscription/payment`)
      .send({ date: '2024-06-01', amount: 15, method: 'Virement SEPA' });
    const paymentId = createRes.body.payments[0].id;

    const adminAgent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await adminAgent
      .post(`/user/${userId}/subscription/payment/${paymentId}/reject`)
      .send({ rejectionReason: 'Montant incorrect' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.payments[0].status, 'rejected');
    assert.strictEqual(
      res.body.payments[0].rejectionReason,
      'Montant incorrect'
    );
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
