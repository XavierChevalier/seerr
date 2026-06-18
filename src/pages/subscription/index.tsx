import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { menuMessages } from '@app/components/Layout/Sidebar';
import UserSubscriptionSettings from '@app/components/UserProfile/UserSettings/UserSubscriptionSettings';
import { useUser } from '@app/hooks/useUser';
import type { NextPage } from 'next';
import { useIntl } from 'react-intl';

const SubscriptionPage: NextPage = () => {
  const intl = useIntl();
  const { loading } = useUser();
  const title = intl.formatMessage(menuMessages.subscription);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-4">
        <Header>{title}</Header>
      </div>
      <div className="text-white">
        <UserSubscriptionSettings />
      </div>
    </>
  );
};

export default SubscriptionPage;
