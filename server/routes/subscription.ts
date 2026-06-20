import { getRepository } from '@server/datasource';
import { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { isAuthenticated } from '@server/middleware/auth';
import {
  calculateSubscriptionState,
  getPendingPaymentStats,
  isSubscriptionConfigured,
} from '@server/utils/subscriptionHelpers';
import { Router } from 'express';

const subscriptionRoutes = Router();

subscriptionRoutes.get('/status', isAuthenticated(), async (req, res, next) => {
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
});

subscriptionRoutes.get(
  '/',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const userRepository = getRepository(User);
      const users = await userRepository.find({
        relations: ['subscriptionPayments', 'subscriptionGifts'],
      });

      const results = users.map((user) => {
        const { pendingCount, pendingAmount, pendingPayments } =
          getPendingPaymentStats(user.subscriptionPayments);
        return {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          avatar: user.avatar,
          subscription: calculateSubscriptionState(user),
          pendingCount,
          pendingAmount,
          pendingPayments,
        };
      });

      return res.status(200).json({ results });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

const SUBSCRIPTION_PAYMENT_STATUS_FILTERS = [
  'all',
  'pending',
  'confirmed',
  'rejected',
] as const;

type SubscriptionPaymentStatusFilter =
  (typeof SUBSCRIPTION_PAYMENT_STATUS_FILTERS)[number];

subscriptionRoutes.get(
  '/payments',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const rawStatus = req.query.status;
      const statusFilter: SubscriptionPaymentStatusFilter =
        typeof rawStatus === 'string' &&
        (SUBSCRIPTION_PAYMENT_STATUS_FILTERS as readonly string[]).includes(
          rawStatus
        )
          ? (rawStatus as SubscriptionPaymentStatusFilter)
          : 'all';

      const paymentQuery = getRepository(SubscriptionPayment)
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.user', 'user')
        .orderBy('payment.date', 'DESC')
        .addOrderBy('payment.id', 'DESC');

      if (statusFilter !== 'all') {
        paymentQuery.where('payment.status = :status', {
          status: statusFilter,
        });
      }

      const payments = await paymentQuery.getMany();

      const results = payments.map((payment) => ({
        id: payment.id,
        date: new Date(payment.date).toISOString().split('T')[0],
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status ?? 'confirmed',
        rejectionReason: payment.rejectionReason ?? null,
        createdByUserId: payment.createdByUserId,
        user: {
          id: payment.user.id,
          displayName: payment.user.displayName,
          email: payment.user.email,
          avatar: payment.user.avatar,
        },
      }));

      return res.status(200).json({ results });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

subscriptionRoutes.get(
  '/count',
  isAuthenticated(Permission.MANAGE_USERS),
  async (_req, res, next) => {
    try {
      const pendingCount = await getRepository(SubscriptionPayment)
        .createQueryBuilder('payment')
        .where('payment.status = :status', { status: 'pending' })
        .getCount();

      return res.status(200).json({ pending: pendingCount });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

export default subscriptionRoutes;
