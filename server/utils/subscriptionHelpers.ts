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

export const SUBSCRIPTION_PREFERENCE_INTERVALS = {
  Mensuel: 1,
  Semestriel: 6,
  Annuel: 12,
} as const;

export const SUBSCRIPTION_PREFERENCES = [
  ...Object.keys(SUBSCRIPTION_PREFERENCE_INTERVALS),
  'Gratuit',
] as const;

export type SubscriptionPreference = (typeof SUBSCRIPTION_PREFERENCES)[number];

export type PaidSubscriptionPreference =
  keyof typeof SUBSCRIPTION_PREFERENCE_INTERVALS;

export const RECURRING_TRANSFER_MIN_DAY = 1;
export const RECURRING_TRANSFER_MAX_DAY = 28;

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

export function isValidSubscriptionPreference(
  preference: unknown
): preference is SubscriptionPreference {
  return (
    typeof preference === 'string' &&
    (SUBSCRIPTION_PREFERENCES as readonly string[]).includes(preference)
  );
}

export function isValidUserSubscriptionPreference(
  preference: unknown
): preference is PaidSubscriptionPreference {
  return (
    typeof preference === 'string' &&
    preference in SUBSCRIPTION_PREFERENCE_INTERVALS
  );
}

export function getSubscriptionIntervalMonths(
  preference: string | null | undefined
): number | null {
  if (!preference || preference === 'Gratuit') {
    return null;
  }

  return (
    SUBSCRIPTION_PREFERENCE_INTERVALS[
      preference as PaidSubscriptionPreference
    ] ?? null
  );
}

export function getRecurringTransferAmount(user: User): number | null {
  const interval = getSubscriptionIntervalMonths(user.subscriptionPreference);
  const pricePerMonth = user.subscriptionPricePerMonth
    ? Number(user.subscriptionPricePerMonth)
    : null;

  if (!interval || pricePerMonth == null || pricePerMonth <= 0) {
    return null;
  }

  return pricePerMonth * interval;
}

export function canConfigureRecurringTransfer(user: User): boolean {
  return (
    isSubscriptionConfigured(user) && getRecurringTransferAmount(user) != null
  );
}

export function isValidRecurringDayOfMonth(day: unknown): day is number {
  return (
    typeof day === 'number' &&
    Number.isInteger(day) &&
    day >= RECURRING_TRANSFER_MIN_DAY &&
    day <= RECURRING_TRANSFER_MAX_DAY
  );
}

export function normalizeSubscriptionDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function formatSubscriptionDateOnly(date: Date): string {
  const normalized = normalizeSubscriptionDate(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthsSinceSubscriptionStart(
  startDate: Date,
  refDate: Date
): number {
  const start = normalizeSubscriptionDate(startDate);
  const ref = normalizeSubscriptionDate(refDate);

  return (
    (ref.getFullYear() - start.getFullYear()) * 12 +
    (ref.getMonth() - start.getMonth())
  );
}

export function getBillingPeriodStart(
  subscriptionStartDate: Date,
  intervalMonths: number,
  refDate: Date
): Date {
  const start = normalizeSubscriptionDate(subscriptionStartDate);
  const monthsSince = getMonthsSinceSubscriptionStart(start, refDate);
  const periodIndex = Math.floor(monthsSince / intervalMonths);
  const periodStart = new Date(start);
  periodStart.setMonth(periodStart.getMonth() + periodIndex * intervalMonths);
  return normalizeSubscriptionDate(periodStart);
}

export function getBillingPeriodEnd(
  periodStart: Date,
  intervalMonths: number
): Date {
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + intervalMonths);
  periodEnd.setDate(periodEnd.getDate() - 1);
  return normalizeSubscriptionDate(periodEnd);
}

export function isDateInBillingPeriod(
  date: Date,
  periodStart: Date,
  periodEnd: Date
): boolean {
  const normalizedDate = normalizeSubscriptionDate(date);
  return normalizedDate >= periodStart && normalizedDate <= periodEnd;
}

export function isRecurringDeclarationDay(
  user: User,
  refDate: Date = new Date()
): boolean {
  if (
    !user.subscriptionRecurringEnabled ||
    !user.subscriptionRecurringDayOfMonth
  ) {
    return false;
  }

  if (!canConfigureRecurringTransfer(user) || !user.subscriptionStartDate) {
    return false;
  }

  const today = normalizeSubscriptionDate(refDate);
  const start = normalizeSubscriptionDate(user.subscriptionStartDate);

  if (today < start) {
    return false;
  }

  if (today.getDate() !== user.subscriptionRecurringDayOfMonth) {
    return false;
  }

  const interval = getSubscriptionIntervalMonths(user.subscriptionPreference);
  if (!interval) {
    return false;
  }

  const monthsSince = getMonthsSinceSubscriptionStart(start, today);
  return monthsSince % interval === 0;
}

export function hasRecurringPaymentForPeriod(
  user: User,
  refDate: Date = new Date()
): boolean {
  const interval = getSubscriptionIntervalMonths(user.subscriptionPreference);
  const expectedAmount = getRecurringTransferAmount(user);

  if (!interval || expectedAmount == null || !user.subscriptionStartDate) {
    return false;
  }

  const periodStart = getBillingPeriodStart(
    user.subscriptionStartDate,
    interval,
    refDate
  );
  const periodEnd = getBillingPeriodEnd(periodStart, interval);
  const payments = user.subscriptionPayments || [];

  return payments.some((payment) =>
    isEligibleRecurringPaymentForPeriod(
      payment,
      expectedAmount,
      periodStart,
      periodEnd
    )
  );
}

export function isEligibleRecurringPaymentForPeriod(
  payment: SubscriptionPayment,
  expectedAmount: number,
  periodStart: Date,
  periodEnd: Date
): boolean {
  if (payment.status !== 'pending' && payment.status !== 'confirmed') {
    return false;
  }

  if (Number(payment.amount) !== expectedAmount) {
    return false;
  }

  return isDateInBillingPeriod(new Date(payment.date), periodStart, periodEnd);
}

export function shouldCreateRecurringPayment(
  user: User,
  refDate: Date = new Date()
): boolean {
  return (
    isRecurringDeclarationDay(user, refDate) &&
    !hasRecurringPaymentForPeriod(user, refDate)
  );
}

export function getNextRecurringDeclarationDate(
  user: User,
  fromDate: Date = new Date()
): string | null {
  if (
    !user.subscriptionRecurringEnabled ||
    !canConfigureRecurringTransfer(user)
  ) {
    return null;
  }

  const cursor = normalizeSubscriptionDate(fromDate);

  for (let dayOffset = 0; dayOffset < 800; dayOffset++) {
    if (
      isRecurringDeclarationDay(user, cursor) &&
      !hasRecurringPaymentForPeriod(user, cursor)
    ) {
      return formatSubscriptionDateOnly(cursor);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}

export function buildRecurringTransferState(user: User) {
  return {
    enabled: !!user.subscriptionRecurringEnabled,
    dayOfMonth: user.subscriptionRecurringDayOfMonth ?? null,
    nextDeclarationDate: user.subscriptionRecurringEnabled
      ? getNextRecurringDeclarationDate(user)
      : null,
    amount: getRecurringTransferAmount(user),
    intervalMonths: getSubscriptionIntervalMonths(user.subscriptionPreference),
  };
}

export function isEligiblePayment(payment: SubscriptionPayment): boolean {
  return payment.status === 'pending' || payment.status === 'confirmed';
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
    recurringTransfer: buildRecurringTransferState(user),
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

export function calculateSubscriptionMissingTotal(users: User[]): number {
  return users.reduce((sum, user) => {
    if (!isSubscriptionConfigured(user)) {
      return sum;
    }

    const { balance } = calculateSubscriptionState(user);
    return balance < 0 ? sum + Math.abs(balance) : sum;
  }, 0);
}
