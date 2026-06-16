import SubscriptionList from '@app/components/SubscriptionList';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const SubscriptionsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return <SubscriptionList />;
};

export default SubscriptionsPage;
