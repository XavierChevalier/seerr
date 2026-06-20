import SubscriptionPaymentsList from '@app/components/SubscriptionPaymentsList';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const SubscriptionsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return <SubscriptionPaymentsList />;
};

export default SubscriptionsPage;
