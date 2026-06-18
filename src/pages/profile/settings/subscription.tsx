import UserSettings from '@app/components/UserProfile/UserSettings';
import UserSubscriptionSettings from '@app/components/UserProfile/UserSettings/UserSubscriptionSettings';
import type { NextPage } from 'next';

const ProfileSubscriptionSettingsPage: NextPage = () => (
  <UserSettings>
    <UserSubscriptionSettings />
  </UserSettings>
);

export default ProfileSubscriptionSettingsPage;
