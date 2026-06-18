import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import type { SubscriptionStatusResponse } from '@server/interfaces/api/userInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.SubscriptionAlertBanner', {
  title: 'Subscription Overdue',
  description:
    'Your subscription is not up to date. You have {months} months to catch up on.',
  cta: 'View my subscription',
});

const SubscriptionAlertBanner = () => {
  const intl = useIntl();
  const { data } = useSWR<SubscriptionStatusResponse>(
    '/api/v1/subscription/status'
  );

  if (!data?.isConfigured || data.status !== 'Inactif') {
    return null;
  }

  const monthsBehind = Math.abs(Math.ceil(data.remainingMonths ?? 0));

  return (
    <div className="mb-6">
      <Alert title={intl.formatMessage(messages.title)} type="warning">
        <p>
          {intl.formatMessage(messages.description, { months: monthsBehind })}
        </p>
        <div className="mt-3">
          <Link href="/subscription">
            <Button buttonType="primary">
              {intl.formatMessage(messages.cta)}
            </Button>
          </Link>
        </div>
      </Alert>
    </div>
  );
};

export default SubscriptionAlertBanner;
