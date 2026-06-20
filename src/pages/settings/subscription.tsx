import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsSubscription from '@app/components/Settings/SettingsSubscription';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const SettingsSubscriptionPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsSubscription />
    </SettingsLayout>
  );
};

export default SettingsSubscriptionPage;
