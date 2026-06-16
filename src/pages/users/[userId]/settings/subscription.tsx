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
