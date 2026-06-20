import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import defineMessages from '@app/utils/defineMessages';
import type { SubscriptionOverviewResponse } from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { useSWRConfig } from 'swr';

const messages = defineMessages('components.SubscriptionList', {
  title: 'Subscriptions',
  loadError: 'Unable to load subscriptions overview.',
  columnUser: 'User',
  columnStatus: 'Status',
  columnBalance: 'Balance',
  columnRemainingMonths: 'Remaining Months',
  columnTotalPaid: 'Total Paid',
  columnMonthlyPrice: 'Monthly Price',
  columnPreference: 'Preference',
  columnPending: 'Pending',
  columnActions: 'Actions',
  confirm: 'Confirm',
  reject: 'Reject',
  cancel: 'Cancel',
  receivedDate: 'Reception Date',
  statusActive: 'Active',
  statusInactive: 'Inactive',
  totalMissing: 'Total Outstanding',
});

const SubscriptionList = () => {
  const intl = useIntl();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, mutate } = useSWR<SubscriptionOverviewResponse>(
    '/api/v1/subscription'
  );
  const [confirmingPayment, setConfirmingPayment] = useState<{
    userId: number;
    paymentId: number;
    date: string;
  } | null>(null);

  const confirmPayment = async (
    userId: number,
    paymentId: number,
    date: string
  ) => {
    await axios.post(
      `/api/v1/user/${userId}/subscription/payment/${paymentId}/confirm`,
      { date }
    );
    setConfirmingPayment(null);
    mutate();
    globalMutate('/api/v1/subscription/count');
  };

  const rejectPayment = async (userId: number, paymentId: number) => {
    await axios.post(
      `/api/v1/user/${userId}/subscription/payment/${paymentId}/reject`
    );
    mutate();
    globalMutate('/api/v1/subscription/count');
  };

  if (!data && !error) return <LoadingSpinner />;

  if (error) {
    return (
      <>
        <PageTitle title={intl.formatMessage(messages.title)} />
        <Alert title={intl.formatMessage(messages.loadError)} type="error" />
      </>
    );
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="mb-4">
        <Header>{intl.formatMessage(messages.title)}</Header>
      </div>

      <div className="mb-6 overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {intl.formatMessage(messages.totalMissing)}
          </p>
          <p className="mt-1 text-2xl font-bold text-red-400">
            €{(data?.totals?.missing ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnUser)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnStatus)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnBalance)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnRemainingMonths)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnTotalPaid)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnMonthlyPrice)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnPreference)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnPending)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnActions)}
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-700 bg-gray-800 hover:bg-gray-700"
              >
                <td className="px-6 py-4 font-medium text-white">
                  <Link
                    href={`/users/${user.id}/settings/subscription`}
                    className="hover:underline"
                  >
                    {user.displayName}
                  </Link>
                </td>
                <td
                  className={`px-6 py-4 font-bold ${user.subscription.status === 'Actif' ? 'text-green-500' : 'text-red-500'}`}
                >
                  {user.subscription.status === 'Actif'
                    ? intl.formatMessage(messages.statusActive)
                    : intl.formatMessage(messages.statusInactive)}
                </td>
                <td className="px-6 py-4">
                  €{user.subscription.balance.toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  {user.subscription.remainingMonths}
                </td>
                <td className="px-6 py-4">
                  €{user.subscription.totalPaid.toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  {user.subscription.pricePerMonth
                    ? `€${user.subscription.pricePerMonth.toFixed(2)}`
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  {user.subscription.preference || '-'}
                </td>
                <td className="px-6 py-4">
                  {user.pendingCount > 0
                    ? `${user.pendingCount} (€${user.pendingAmount.toFixed(2)})`
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  {user.pendingPayments?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {user.pendingPayments.map((payment) => {
                        const isConfirming =
                          confirmingPayment?.paymentId === payment.id &&
                          confirmingPayment.userId === user.id;

                        return (
                          <div key={payment.id} className="flex flex-col gap-1">
                            {isConfirming && confirmingPayment ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="date"
                                  value={confirmingPayment.date}
                                  onChange={(e) =>
                                    setConfirmingPayment({
                                      userId: confirmingPayment.userId,
                                      paymentId: confirmingPayment.paymentId,
                                      date: e.target.value,
                                    })
                                  }
                                  className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white"
                                  aria-label={intl.formatMessage(
                                    messages.receivedDate
                                  )}
                                  required
                                />
                                <Button
                                  buttonType="success"
                                  onClick={() =>
                                    confirmPayment(
                                      user.id,
                                      payment.id,
                                      confirmingPayment.date
                                    )
                                  }
                                >
                                  {intl.formatMessage(messages.confirm)}
                                </Button>
                                <Button
                                  buttonType="default"
                                  onClick={() => setConfirmingPayment(null)}
                                >
                                  {intl.formatMessage(messages.cancel)}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  buttonType="success"
                                  onClick={() =>
                                    setConfirmingPayment({
                                      userId: user.id,
                                      paymentId: payment.id,
                                      date: payment.date,
                                    })
                                  }
                                >
                                  {intl.formatMessage(messages.confirm)} €
                                  {payment.amount.toFixed(2)}
                                </Button>
                                <Button
                                  buttonType="danger"
                                  onClick={() =>
                                    rejectPayment(user.id, payment.id)
                                  }
                                >
                                  {intl.formatMessage(messages.reject)}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default SubscriptionList;
