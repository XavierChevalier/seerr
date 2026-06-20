import { getRepository } from '@server/datasource';
import { SubscriptionPayment } from '@server/entity/SubscriptionPayment';
import { User } from '@server/entity/User';
import logger from '@server/logger';
import {
  formatSubscriptionDateOnly,
  getRecurringTransferAmount,
  normalizeSubscriptionDate,
  shouldCreateRecurringPayment,
} from '@server/utils/subscriptionHelpers';

export async function processRecurringSubscriptionTransfers(
  refDate: Date = new Date()
): Promise<number> {
  const users = await getRepository(User).find({
    where: { subscriptionRecurringEnabled: true },
    relations: ['subscriptionPayments'],
  });

  let created = 0;

  for (const user of users) {
    if (!shouldCreateRecurringPayment(user, refDate)) {
      continue;
    }

    const amount = getRecurringTransferAmount(user);
    if (amount == null) {
      continue;
    }

    const payment = new SubscriptionPayment();
    payment.date = normalizeSubscriptionDate(refDate);
    payment.amount = amount;
    payment.method = 'Virement SEPA';
    payment.status = 'pending';
    payment.createdByUserId = user.id;
    payment.user = user;

    await getRepository(SubscriptionPayment).save(payment);
    created++;

    logger.info('Created recurring subscription payment declaration', {
      label: 'Subscription Recurring Transfers',
      userId: user.id,
      amount,
      date: formatSubscriptionDateOnly(payment.date),
    });
  }

  return created;
}

export default {
  run: processRecurringSubscriptionTransfers,
};
