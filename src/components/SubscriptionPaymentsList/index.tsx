import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { FunnelIcon } from '@heroicons/react/24/outline';
import type {
  SubscriptionPaymentListItem,
  SubscriptionPaymentStatus,
  SubscriptionPaymentsResponse,
} from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { useSWRConfig } from 'swr';

const messages = defineMessages('components.SubscriptionPaymentsList', {
  title: 'Subscription',
  description: 'Review and manage subscription payment transactions.',
  loadError: 'Unable to load subscription payments.',
  columnUser: 'User',
  columnDate: 'Date',
  columnAmount: 'Amount',
  columnMethod: 'Method',
  columnStatus: 'Status',
  columnActions: 'Actions',
  statusPending: 'Pending',
  statusConfirmed: 'Confirmed',
  statusRejected: 'Rejected',
  confirm: 'Confirm',
  reject: 'Reject',
  cancel: 'Cancel',
  receivedDate: 'Reception Date',
  rejectionReason: 'Rejection Reason',
  methodCash: 'Cash',
  methodPayPal: 'PayPal',
  methodVirementSepa: 'SEPA Transfer',
  noPayments: 'No payments match the selected filter.',
  totalPending: 'Total Pending',
  totalConfirmed: 'Total Confirmed',
  totalEligible: 'Total Pending + Confirmed',
});

type PaymentStatusFilter = 'all' | SubscriptionPaymentStatus;

const paymentMethodMessages = {
  Cash: messages.methodCash,
  PayPal: messages.methodPayPal,
  'Virement SEPA': messages.methodVirementSepa,
} as const;

const formatDisplayDate = (date: string) => {
  const [year, month, day] = date.split('T')[0].split('-');

  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
};

const SubscriptionPaymentsList = () => {
  const intl = useIntl();
  const { mutate: globalMutate } = useSWRConfig();
  const [statusFilter, setStatusFilter] =
    useState<PaymentStatusFilter>('pending');
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(
    null
  );
  const [confirmDate, setConfirmDate] = useState('');
  const [rejectingPaymentId, setRejectingPaymentId] = useState<number | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, error, mutate } = useSWR<SubscriptionPaymentsResponse>(
    `/api/v1/subscription/payments?status=${statusFilter}`
  );

  const formatAmount = (amount: number) =>
    intl.formatNumber(amount, {
      style: 'currency',
      currency: 'EUR',
    });

  const formatPaymentMethod = (method: string) => {
    const message =
      paymentMethodMessages[method as keyof typeof paymentMethodMessages];

    return message ? intl.formatMessage(message) : method;
  };

  const statusBadge = (status: SubscriptionPaymentStatus) => {
    if (status === 'pending') {
      return (
        <Badge badgeType="warning">
          {intl.formatMessage(messages.statusPending)}
        </Badge>
      );
    }
    if (status === 'confirmed') {
      return (
        <Badge badgeType="success">
          {intl.formatMessage(messages.statusConfirmed)}
        </Badge>
      );
    }
    return (
      <Badge badgeType="danger">
        {intl.formatMessage(messages.statusRejected)}
      </Badge>
    );
  };

  const refreshData = () => {
    mutate();
    globalMutate('/api/v1/subscription/count');
    globalMutate('/api/v1/subscription');
  };

  const confirmPayment = async (payment: SubscriptionPaymentListItem) => {
    await axios.post(
      `/api/v1/user/${payment.user.id}/subscription/payment/${payment.id}/confirm`,
      { date: confirmDate }
    );
    setConfirmingPaymentId(null);
    setConfirmDate('');
    refreshData();
  };

  const rejectPayment = async (payment: SubscriptionPaymentListItem) => {
    await axios.post(
      `/api/v1/user/${payment.user.id}/subscription/payment/${payment.id}/reject`,
      { rejectionReason: rejectionReason || undefined }
    );
    setRejectingPaymentId(null);
    setRejectionReason('');
    refreshData();
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (error || !data) {
    if (error) {
      return (
        <>
          <PageTitle title={intl.formatMessage(messages.title)} />
          <Alert title={intl.formatMessage(messages.loadError)} type="error" />
        </>
      );
    }

    return <LoadingSpinner />;
  }

  const totals = data.totals ?? { pending: 0, confirmed: 0, eligible: 0 };

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(messages.title)}</Header>
        <div className="mt-2 flex flex-grow sm:flex-grow-0">
          <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
            <FunnelIcon className="h-6 w-6" />
          </span>
          <select
            id="payment-status-filter"
            name="payment-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as PaymentStatusFilter)
            }
            className="rounded-r-only"
          >
            <option value="all">
              {intl.formatMessage(globalMessages.all)}
            </option>
            <option value="pending">
              {intl.formatMessage(messages.statusPending)}
            </option>
            <option value="confirmed">
              {intl.formatMessage(messages.statusConfirmed)}
            </option>
            <option value="rejected">
              {intl.formatMessage(messages.statusRejected)}
            </option>
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 divide-y divide-gray-700 overflow-hidden rounded-lg border border-gray-700 bg-gray-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {intl.formatMessage(messages.totalPending)}
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {formatAmount(totals.pending)}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {intl.formatMessage(messages.totalConfirmed)}
          </p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {formatAmount(totals.confirmed)}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {intl.formatMessage(messages.totalEligible)}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {formatAmount(totals.eligible)}
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
                {intl.formatMessage(messages.columnDate)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnAmount)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnMethod)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnStatus)}
              </th>
              <th className="px-6 py-3">
                {intl.formatMessage(messages.columnActions)}
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.results.length === 0 && (
              <tr className="border-b border-gray-700 bg-gray-800">
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  {intl.formatMessage(messages.noPayments)}
                </td>
              </tr>
            )}
            {data?.results.map((payment) => (
              <tr
                key={payment.id}
                className="border-b border-gray-700 bg-gray-800 hover:bg-gray-700"
              >
                <td className="px-6 py-4 font-medium text-white">
                  <Link
                    href={`/users/${payment.user.id}/settings/subscription`}
                    className="hover:underline"
                  >
                    {payment.user.displayName}
                  </Link>
                </td>
                <td className="px-6 py-4 text-white">
                  {formatDisplayDate(payment.date)}
                </td>
                <td className="px-6 py-4 text-gray-100">
                  {formatAmount(payment.amount)}
                </td>
                <td className="px-6 py-4 text-gray-100">
                  {formatPaymentMethod(payment.method)}
                </td>
                <td className="px-6 py-4">
                  {statusBadge(payment.status)}
                  {payment.rejectionReason && (
                    <p className="mt-1 text-xs text-red-400">
                      {payment.rejectionReason}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4">
                  {payment.status === 'pending' && (
                    <div className="flex flex-col gap-2">
                      {confirmingPaymentId === payment.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={confirmDate}
                            onChange={(e) => setConfirmDate(e.target.value)}
                            className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white"
                            aria-label={intl.formatMessage(
                              messages.receivedDate
                            )}
                            required
                          />
                          <Button
                            buttonType="success"
                            onClick={() => confirmPayment(payment)}
                          >
                            {intl.formatMessage(messages.confirm)}
                          </Button>
                          <Button
                            buttonType="default"
                            onClick={() => {
                              setConfirmingPaymentId(null);
                              setConfirmDate('');
                            }}
                          >
                            {intl.formatMessage(messages.cancel)}
                          </Button>
                        </div>
                      ) : rejectingPaymentId === payment.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white"
                            placeholder={intl.formatMessage(
                              messages.rejectionReason
                            )}
                          />
                          <Button
                            buttonType="danger"
                            onClick={() => rejectPayment(payment)}
                          >
                            {intl.formatMessage(messages.reject)}
                          </Button>
                          <Button
                            buttonType="default"
                            onClick={() => {
                              setRejectingPaymentId(null);
                              setRejectionReason('');
                            }}
                          >
                            {intl.formatMessage(messages.cancel)}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            buttonType="success"
                            onClick={() => {
                              setConfirmingPaymentId(payment.id);
                              setConfirmDate(payment.date);
                              setRejectingPaymentId(null);
                            }}
                          >
                            {intl.formatMessage(messages.confirm)}
                          </Button>
                          <Button
                            buttonType="danger"
                            onClick={() => {
                              setRejectingPaymentId(payment.id);
                              setConfirmingPaymentId(null);
                            }}
                          >
                            {intl.formatMessage(messages.reject)}
                          </Button>
                        </div>
                      )}
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

export default SubscriptionPaymentsList;
