import type { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import type { User } from '@server/entity/User';
import type { UserSubscriptionResponse } from '@server/interfaces/api/userInterfaces';

export const SUBSCRIPTION_PAYMENT_METHODS = [
  'Cash',
  'PayPal',
  'Virement SEPA',
] as const;

export type SubscriptionPaymentMethod =
  (typeof SUBSCRIPTION_PAYMENT_METHODS)[number];

export function isValidSubscriptionPaymentMethod(
  method: unknown
): method is SubscriptionPaymentMethod {
  return (
    typeof method === 'string' &&
    (SUBSCRIPTION_PAYMENT_METHODS as readonly string[]).includes(method)
  );
}

export function isSubscriptionConfigured(user: User): boolean {
  return (
    user.subscriptionPricePerMonth != null && user.subscriptionStartDate != null
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
    pendingPayments: pending.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      date: new Date(p.date).toISOString().split('T')[0],
    })),
  };
}

export function calculateSubscriptionState(
  user: User
): UserSubscriptionResponse {
  const pricePerMonth = user.subscriptionPricePerMonth
    ? Number(user.subscriptionPricePerMonth)
    : 0;
  const payments = user.subscriptionPayments || [];
  const gifts = user.subscriptionGifts || [];

  const eligiblePayments = payments.filter(isEligiblePayment);
  const totalPaid = eligiblePayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
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
  const balance = totalPaid - totalDue + totalGiftedMonths * pricePerMonth;
  const remainingMonths =
    pricePerMonth > 0
      ? totalPaid / pricePerMonth + totalGiftedMonths - elapsedMonths
      : 0;

  const status = balance >= 0 ? 'Actif' : 'Inactif';

  return {
    pricePerMonth: user.subscriptionPricePerMonth
      ? Number(user.subscriptionPricePerMonth)
      : null,
    startDate: user.subscriptionStartDate
      ? new Date(user.subscriptionStartDate).toISOString().split('T')[0]
      : null,
    preference: user.subscriptionPreference || null,
    totalPaid,
    totalDue,
    balance,
    elapsedMonths,
    totalGiftedMonths,
    remainingMonths,
    status,
    payments: payments
      .map((p) => ({
        id: p.id,
        date: new Date(p.date).toISOString().split('T')[0],
        amount: Number(p.amount),
        method: p.method,
        status: p.status ?? 'confirmed',
        rejectionReason: p.rejectionReason ?? null,
        createdByUserId: p.createdByUserId,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    gifts: gifts
      .map((g) => ({
        id: g.id,
        date: new Date(g.date).toISOString().split('T')[0],
        months: Number(g.months),
        reason: g.reason,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}
