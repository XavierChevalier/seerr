import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { User } from '@server/entity/User';
import type {
  SubscriptionPaymentStatus,
  UserSubscriptionResponse,
} from '@server/interfaces/api/userInterfaces';
import {
  SUBSCRIPTION_PAYMENT_METHODS,
  SUBSCRIPTION_PREFERENCE_INTERVALS,
  getNextRecurringDeclarationDate,
} from '@server/utils/subscriptionHelpers';
import axios from 'axios';
import { useRouter } from 'next/router';
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserSubscriptionSettings',
  {
    title: 'Subscription Settings',
    description: 'Manage billing history and dates.',
    status: 'Status',
    remainingMonths: 'Remaining Months',
    totalPaid: 'Total Paid',
    balance: 'Balance',
    planDetails: 'Plan Details',
    baseConfiguration: 'Base Configuration',
    monthlyPrice: 'Monthly Price (€)',
    startDate: 'Start Date',
    preference: 'Preference',
    saveSettings: 'Save Settings',
    toastSettingsSuccess: 'Settings saved successfully!',
    toastSettingsFailure: 'Something went wrong while saving settings.',
    toastPaymentSuccess: 'Payment added successfully!',
    toastPaymentFailure: 'Something went wrong while adding payment.',
    toastGiftSuccess: 'Gift added successfully!',
    toastGiftFailure: 'Something went wrong while adding gift.',
    toastDeleteFailure: 'Something went wrong while deleting entry.',
    toastUpdateFailure: 'Something went wrong while updating payment.',
    toastConfirmFailure: 'Something went wrong while confirming payment.',
    toastRejectFailure: 'Something went wrong while rejecting payment.',
    declareTransfer: 'Declare a Transfer',
    transferHistory: 'Transfer History',
    transferHistoryDescription:
      'Declare bank transfers you have made for your subscription here. Each declaration remains pending until validated by an administrator. Confirmed transfers count toward your balance; rejected transfers remain visible but are not counted.',
    paymentsHistoryDescription:
      'Payments and transfers declared by this user. Pending entries can be confirmed or rejected.',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusRejected: 'Rejected',
    confirm: 'Confirm',
    receivedDate: 'Reception Date',
    reject: 'Reject',
    rejectionReason: 'Rejection Reason',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    notConfigured:
      'Your subscription is not configured yet. Contact an administrator.',
    paymentsHistory: 'Payment History',
    amountPlaceholder: 'Amount (€)',
    methodPlaceholder: 'Select a method',
    methodCash: 'Cash',
    methodPayPal: 'PayPal',
    methodVirementSepa: 'SEPA Transfer',
    addPayment: 'Add',
    giftedMonths: 'Gifted Months',
    monthsPlaceholder: 'Months',
    reasonPlaceholder: 'Reason',
    addGift: 'Add Gift',
    delete: 'Delete',
    giftEntry: '{date} - {months} months ({reason})',
    preferenceMensuel: 'Monthly',
    preferenceSemestriel: 'Semi-annual',
    preferenceAnnuel: 'Annual',
    preferenceGratuit: 'Free',
    loadError: 'Unable to load subscription data.',
    columnDate: 'Date',
    columnMonths: 'Months',
    columnReason: 'Reason',
    paymentDate: 'Payment Date',
    paymentAmount: 'Payment Amount',
    columnAmount: 'Amount',
    columnMethod: 'Method',
    columnStatus: 'Status',
    columnActions: 'Actions',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    statusSummaryActive: 'Your subscription is up to date.',
    statusSummaryInactive:
      'Your subscription is not up to date. You have {months} months to catch up on.',
    monthsRemaining: '{months} months covered',
    monthsBehind: '{months} months behind',
    totalDue: 'Total Due',
    totalDueHint: 'Since {date}',
    totalPaidHint: 'Confirmed and pending transfers',
    balanceHintCredit: 'You have a credit balance',
    balanceHintDue: 'Amount remaining to pay',
    balanceHintEven: 'Account up to date',
    subscriptionRate: '{amount}/month',
    subscriptionMemberSince: 'Member since {date}',
    recurringTransferTitle: 'Automatic Transfer',
    recurringTransferDescription:
      'Enable automatic transfer declarations based on your billing preference. A pending payment will be created on each due date and must be confirmed by an administrator.',
    recurringTransferEnabled: 'Enable automatic transfer',
    recurringTransferDayOfMonth: 'Day of month',
    recurringTransferSummary:
      'SEPA transfer of {amount} every {months, plural, one {# month} other {# months}}, on day {day} of each billing period.',
    recurringTransferNextDeclaration: 'Next automatic declaration: {date}',
    recurringTransferSave: 'Save automatic transfer settings',
    toastRecurringSuccess: 'Automatic transfer settings saved successfully!',
    toastRecurringFailure:
      'Something went wrong while saving automatic transfer settings.',
  }
);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const mapRecurringSettings = (subscription: UserSubscriptionResponse) => ({
  enabled: subscription.recurringTransfer.enabled,
  dayOfMonth: subscription.recurringTransfer.dayOfMonth
    ? String(subscription.recurringTransfer.dayOfMonth)
    : '1',
  preference: subscription.preference ?? 'Mensuel',
});

const buildRecurringPreviewUser = (
  subscription: UserSubscriptionResponse,
  recurringSettings: ReturnType<typeof mapRecurringSettings>
): User =>
  ({
    subscriptionPreference: recurringSettings.preference,
    subscriptionRecurringEnabled: recurringSettings.enabled,
    subscriptionRecurringDayOfMonth: Number(recurringSettings.dayOfMonth),
    subscriptionStartDate: subscription.startDate
      ? new Date(subscription.startDate)
      : null,
    subscriptionPricePerMonth: subscription.pricePerMonth,
    subscriptionPayments: subscription.payments.map(
      (payment: UserSubscriptionResponse['payments'][number]) => ({
        id: payment.id,
        date: new Date(payment.date),
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        rejectionReason: payment.rejectionReason,
        createdByUserId: payment.createdByUserId,
      })
    ),
  }) as User;

interface CurrencyAmountInputProps {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const CurrencyAmountInput = ({
  name,
  value,
  onChange,
  required,
  className,
  placeholder,
}: CurrencyAmountInputProps) => {
  const showSymbol = value.length > 0;

  return (
    <div className="relative w-full">
      {showSymbol && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-300"
        >
          €
        </span>
      )}
      <input
        type="number"
        step="1"
        name={name}
        value={value}
        required={required}
        placeholder={placeholder}
        className={`${showSymbol ? 'pl-7' : ''} ${className ?? ''}`}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
      />
    </div>
  );
};

const formatSubscriptionDate = (intl: IntlShape, date: string) =>
  intl.formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatDisplayDate = (date: string) => {
  const [year, month, day] = date.split('T')[0].split('-');

  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
};

const paymentMethodMessages = {
  Cash: messages.methodCash,
  PayPal: messages.methodPayPal,
  'Virement SEPA': messages.methodVirementSepa,
} as const;

const formatPaymentMethod = (intl: IntlShape, method: string) => {
  const message =
    paymentMethodMessages[method as keyof typeof paymentMethodMessages];

  return message ? intl.formatMessage(message) : method;
};

interface PaymentMethodSelectProps {
  value?: string;
  name?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

const PaymentMethodSelect = ({
  value,
  name,
  required,
  onChange,
}: PaymentMethodSelectProps) => {
  const intl = useIntl();
  const options: string[] = [...SUBSCRIPTION_PAYMENT_METHODS];

  if (value && !options.includes(value)) {
    options.unshift(value);
  }

  const showPlaceholder = !value;

  return (
    <select
      name={name}
      value={onChange ? value : undefined}
      defaultValue={onChange ? undefined : ''}
      required={required}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      {showPlaceholder && (
        <option value="" disabled hidden>
          {intl.formatMessage(messages.methodPlaceholder)}
        </option>
      )}
      {options.map((method) => (
        <option key={method} value={method}>
          {formatPaymentMethod(intl, method)}
        </option>
      ))}
    </select>
  );
};

const UserSubscriptionSettings = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();
  const { user: currentUser, hasPermission } = useUser();
  const profileUserId = Number(router.query.userId);
  const targetUserId = Number.isFinite(profileUserId)
    ? profileUserId
    : currentUser?.id;
  const { user } = useUser({ id: targetUserId });
  const isAdmin = hasPermission(Permission.MANAGE_USERS);
  const isOwnProfile = currentUser?.id === user?.id;

  const { data, error, mutate } = useSWR<UserSubscriptionResponse>(
    user ? `/api/v1/user/${user.id}/subscription` : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [rejectingPaymentId, setRejectingPaymentId] = useState<number | null>(
    null
  );
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(
    null
  );
  const [confirmDate, setConfirmDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [editForm, setEditForm] = useState({
    date: '',
    amount: '',
    method: '',
  });
  const [settings, setSettings] = useState({
    pricePerMonth: '',
    startDate: '',
    preference: 'Mensuel',
  });
  const [recurringSettings, setRecurringSettings] = useState({
    enabled: false,
    dayOfMonth: '1',
    preference: 'Mensuel',
  });
  const [isSavingRecurring, setIsSavingRecurring] = useState(false);
  const [paymentFormAmount, setPaymentFormAmount] = useState('');

  useEffect(() => {
    if (data) {
      setSettings({
        pricePerMonth:
          data.pricePerMonth != null ? String(data.pricePerMonth) : '',
        startDate: data.startDate ?? '',
        preference: data.preference ?? 'Mensuel',
      });
    }
  }, [data]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setRecurringSettings(mapRecurringSettings(data));
    // Only resync when server-side recurring settings change, not on every SWR refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    data?.preference,
    data?.recurringTransfer?.enabled,
    data?.recurringTransfer?.dayOfMonth,
  ]);

  const previewNextDeclarationDate = useMemo(() => {
    if (!data || !recurringSettings.enabled || !data.startDate) {
      return null;
    }

    return getNextRecurringDeclarationDate(
      buildRecurringPreviewUser(data, recurringSettings)
    );
  }, [data, recurringSettings]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Alert title={intl.formatMessage(messages.loadError)} type="error" />
    );
  }

  if (!data || !user) {
    return <ErrorPage statusCode={500} />;
  }

  const isConfigured = data.pricePerMonth != null && data.startDate != null;

  if (isOwnProfile && !isAdmin && !isConfigured) {
    return (
      <Alert
        title={intl.formatMessage(messages.notConfigured)}
        type="warning"
      />
    );
  }

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.put(`/api/v1/user/${user.id}/subscription`, {
        pricePerMonth: settings.pricePerMonth
          ? Number(settings.pricePerMonth)
          : null,
        startDate: settings.startDate || null,
        preference: settings.preference,
      });
      mutate();
      addToast(intl.formatMessage(messages.toastSettingsSuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch {
      addToast(intl.formatMessage(messages.toastSettingsFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveRecurringSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingRecurring(true);
    try {
      const payload: {
        recurringEnabled: boolean;
        recurringDayOfMonth: number | null;
        preference?: string;
      } = {
        recurringEnabled: recurringSettings.enabled,
        recurringDayOfMonth: recurringSettings.enabled
          ? Number(recurringSettings.dayOfMonth)
          : null,
      };

      if (recurringSettings.enabled) {
        payload.preference = recurringSettings.preference;
      }

      const { data: updated } = await axios.patch<UserSubscriptionResponse>(
        `/api/v1/user/${user.id}/subscription/recurring`,
        payload
      );
      setRecurringSettings(mapRecurringSettings(updated));
      await mutate(updated, { revalidate: false });
      addToast(intl.formatMessage(messages.toastRecurringSuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch {
      addToast(intl.formatMessage(messages.toastRecurringFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setIsSavingRecurring(false);
    }
  };

  const addPayment = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      await axios.post(`/api/v1/user/${user.id}/subscription/payment`, {
        date: formData.get('date'),
        amount: Number(paymentFormAmount),
        method: formData.get('method'),
      });
      mutate();
      (e.target as HTMLFormElement).reset();
      setPaymentFormAmount('');
      addToast(intl.formatMessage(messages.toastPaymentSuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch {
      addToast(intl.formatMessage(messages.toastPaymentFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const addGift = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      await axios.post(`/api/v1/user/${user.id}/subscription/gift`, {
        date: formData.get('date'),
        months: Number(formData.get('months')),
        reason: formData.get('reason'),
      });
      mutate();
      (e.target as HTMLFormElement).reset();
      addToast(intl.formatMessage(messages.toastGiftSuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch {
      addToast(intl.formatMessage(messages.toastGiftFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const deletePayment = async (id: number) => {
    try {
      await axios.delete(`/api/v1/user/${user.id}/subscription/payment/${id}`);
      mutate();
    } catch {
      addToast(intl.formatMessage(messages.toastDeleteFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const deleteGift = async (id: number) => {
    try {
      await axios.delete(`/api/v1/user/${user.id}/subscription/gift/${id}`);
      mutate();
    } catch {
      addToast(intl.formatMessage(messages.toastDeleteFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const confirmPayment = async (paymentId: number, date: string) => {
    try {
      await axios.post(
        `/api/v1/user/${user.id}/subscription/payment/${paymentId}/confirm`,
        { date }
      );
      mutate();
      setConfirmingPaymentId(null);
      setConfirmDate('');
    } catch {
      addToast(intl.formatMessage(messages.toastConfirmFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const rejectPayment = async (paymentId: number, reason?: string) => {
    try {
      await axios.post(
        `/api/v1/user/${user.id}/subscription/payment/${paymentId}/reject`,
        { rejectionReason: reason || undefined }
      );
      mutate();
      setRejectingPaymentId(null);
      setRejectionReason('');
    } catch {
      addToast(intl.formatMessage(messages.toastRejectFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const updatePayment = async (paymentId: number) => {
    try {
      await axios.put(
        `/api/v1/user/${user.id}/subscription/payment/${paymentId}`,
        {
          date: editForm.date,
          amount: Number(editForm.amount),
          method: editForm.method,
        }
      );
      mutate();
      setEditingPaymentId(null);
    } catch {
      addToast(intl.formatMessage(messages.toastUpdateFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const startEditing = (payment: UserSubscriptionResponse['payments'][0]) => {
    setEditingPaymentId(payment.id);
    setEditForm({
      date: payment.date,
      amount: String(payment.amount),
      method: payment.method,
    });
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

  const showBaseConfig = isAdmin && !isOwnProfile;
  const showGiftSection = isAdmin && !isOwnProfile;
  const showDeclareForm = isOwnProfile || isAdmin;
  const showRecurringSection =
    isConfigured &&
    data.preference !== 'Gratuit' &&
    data.recurringTransfer.amount != null &&
    (isOwnProfile || isAdmin);
  const selectedPreferenceInterval =
    SUBSCRIPTION_PREFERENCE_INTERVALS[
      recurringSettings.preference as keyof typeof SUBSCRIPTION_PREFERENCE_INTERVALS
    ] ?? null;
  const previewRecurringAmount =
    data.pricePerMonth != null && selectedPreferenceInterval != null
      ? data.pricePerMonth * selectedPreferenceInterval
      : null;
  const isStandalonePage = router.pathname === '/subscription';
  const isActive = data.status === 'Actif';
  const monthsBehind = Math.max(
    0,
    Math.ceil(Math.abs(Math.min(0, data.remainingMonths)))
  );
  const balanceClassName =
    data.balance > 0
      ? 'text-green-400'
      : data.balance < 0
        ? 'text-red-400'
        : 'text-white';
  const balanceDisplayAmount =
    data.balance < 0 ? Math.abs(data.balance) : data.balance;
  const balanceHint =
    data.balance > 0
      ? intl.formatMessage(messages.balanceHintCredit)
      : data.balance < 0
        ? intl.formatMessage(messages.balanceHintDue)
        : intl.formatMessage(messages.balanceHintEven);

  return (
    <div className="text-white">
      {!isStandalonePage && (
        <div className="mb-6">
          <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
          <p className="description">
            {intl.formatMessage(messages.description)}
          </p>
        </div>
      )}

      <div className="mb-8 space-y-3">
        {/* Status banner — focused solely on the alert message */}
        <div
          className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
            isActive
              ? 'border-green-500/20 bg-green-500/10'
              : 'border-red-500/20 bg-red-500/10'
          }`}
        >
          <Badge badgeType={isActive ? 'success' : 'danger'}>
            {isActive
              ? intl.formatMessage(messages.statusActive)
              : intl.formatMessage(messages.statusInactive)}
          </Badge>
          <p className="text-sm text-gray-200">
            {isActive
              ? intl.formatMessage(messages.statusSummaryActive)
              : intl.formatMessage(messages.statusSummaryInactive, {
                  months: monthsBehind,
                })}
          </p>
        </div>

        {/* Financial summary cards */}
        {isConfigured && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Plan details */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {intl.formatMessage(messages.planDetails)}
              </p>
              {data.pricePerMonth != null && (
                <p className="mt-2 text-2xl font-bold text-white">
                  {intl.formatMessage(messages.subscriptionRate, {
                    amount: formatCurrency(data.pricePerMonth),
                  })}
                </p>
              )}
              {data.startDate && (
                <p className="mt-1 text-xs text-gray-400">
                  {intl.formatMessage(messages.subscriptionMemberSince, {
                    date: formatSubscriptionDate(intl, data.startDate),
                  })}
                </p>
              )}
            </div>

            {/* Balance — tinted to draw attention */}
            <div
              className={`rounded-lg border px-5 py-4 ${
                data.balance > 0
                  ? 'border-green-500/20 bg-green-500/5'
                  : data.balance < 0
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-gray-700 bg-gray-800'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {intl.formatMessage(messages.balance)}
              </p>
              <p className={`mt-2 text-2xl font-bold ${balanceClassName}`}>
                {formatCurrency(balanceDisplayAmount)}
              </p>
              <p className="mt-1 text-xs text-gray-400">{balanceHint}</p>
            </div>
          </div>
        )}
      </div>

      {showBaseConfig && (
        <form
          onSubmit={saveSettings}
          className="mb-8 rounded-lg bg-gray-800 p-4"
        >
          <h4 className="mb-4 text-lg font-bold text-gray-100">
            {intl.formatMessage(messages.baseConfiguration)}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.monthlyPrice)}
              </label>
              <div className="form-input-field mt-1">
                <input
                  type="number"
                  step="0.01"
                  value={settings.pricePerMonth}
                  onChange={(e) =>
                    setSettings({ ...settings, pricePerMonth: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.startDate)}
              </label>
              <div className="form-input-field mt-1">
                <input
                  type="date"
                  value={settings.startDate}
                  onChange={(e) =>
                    setSettings({ ...settings, startDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.preference)}
              </label>
              <div className="form-input-field mt-1">
                <select
                  value={settings.preference}
                  onChange={(e) =>
                    setSettings({ ...settings, preference: e.target.value })
                  }
                >
                  <option value="Mensuel">
                    {intl.formatMessage(messages.preferenceMensuel)}
                  </option>
                  <option value="Semestriel">
                    {intl.formatMessage(messages.preferenceSemestriel)}
                  </option>
                  <option value="Annuel">
                    {intl.formatMessage(messages.preferenceAnnuel)}
                  </option>
                  <option value="Gratuit">
                    {intl.formatMessage(messages.preferenceGratuit)}
                  </option>
                </select>
              </div>
            </div>
          </div>
          <Button buttonType="primary" className="mt-4" disabled={isSaving}>
            {intl.formatMessage(messages.saveSettings)}
          </Button>
        </form>
      )}

      {showRecurringSection && (
        <form
          onSubmit={saveRecurringSettings}
          className="mb-8 rounded-lg bg-gray-800 p-4"
        >
          <h4 className="mb-1 text-lg font-bold text-gray-100">
            {intl.formatMessage(messages.recurringTransferTitle)}
          </h4>
          <p className="description mb-4 max-w-none">
            {intl.formatMessage(messages.recurringTransferDescription)}
          </p>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={recurringSettings.enabled}
              onChange={(e) =>
                setRecurringSettings({
                  ...recurringSettings,
                  enabled: e.target.checked,
                })
              }
            />
            <span>{intl.formatMessage(messages.recurringTransferEnabled)}</span>
          </label>

          {recurringSettings.enabled && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
              {isOwnProfile && (
                <div>
                  <label className="text-label">
                    {intl.formatMessage(messages.preference)}
                  </label>
                  <div className="form-input-field mt-1">
                    <select
                      value={recurringSettings.preference}
                      onChange={(e) =>
                        setRecurringSettings({
                          ...recurringSettings,
                          preference: e.target.value,
                        })
                      }
                    >
                      <option value="Mensuel">
                        {intl.formatMessage(messages.preferenceMensuel)}
                      </option>
                      <option value="Semestriel">
                        {intl.formatMessage(messages.preferenceSemestriel)}
                      </option>
                      <option value="Annuel">
                        {intl.formatMessage(messages.preferenceAnnuel)}
                      </option>
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="text-label">
                  {intl.formatMessage(messages.recurringTransferDayOfMonth)}
                </label>
                <div className="form-input-field mt-1">
                  <select
                    value={recurringSettings.dayOfMonth}
                    onChange={(e) =>
                      setRecurringSettings({
                        ...recurringSettings,
                        dayOfMonth: e.target.value,
                      })
                    }
                  >
                    {Array.from({ length: 28 }, (_, index) => {
                      const day = String(index + 1);
                      return (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          )}

          {recurringSettings.enabled && previewRecurringAmount != null && (
            <div className="mt-4 space-y-2 text-sm text-gray-300">
              <p>
                {intl.formatMessage(messages.recurringTransferSummary, {
                  amount: formatCurrency(previewRecurringAmount),
                  months: selectedPreferenceInterval ?? 1,
                  day: recurringSettings.dayOfMonth,
                })}
              </p>
              {previewNextDeclarationDate && (
                <p className="text-gray-400">
                  {intl.formatMessage(
                    messages.recurringTransferNextDeclaration,
                    {
                      date: formatSubscriptionDate(
                        intl,
                        previewNextDeclarationDate
                      ),
                    }
                  )}
                </p>
              )}
            </div>
          )}

          <Button
            buttonType="primary"
            className="mt-4"
            disabled={isSavingRecurring}
          >
            {intl.formatMessage(messages.recurringTransferSave)}
          </Button>
        </form>
      )}

      <div className="mb-8">
        <h4 className="mb-1 text-lg font-bold text-gray-100">
          {isOwnProfile
            ? intl.formatMessage(messages.transferHistory)
            : intl.formatMessage(messages.paymentsHistory)}
        </h4>
        <p className="description mb-4 max-w-none">
          {isOwnProfile
            ? intl.formatMessage(messages.transferHistoryDescription)
            : intl.formatMessage(messages.paymentsHistoryDescription)}
        </p>

        {showDeclareForm && (
          <form
            onSubmit={addPayment}
            className="mb-4 flex flex-wrap items-end gap-4"
          >
            <div className="w-full sm:w-auto sm:min-w-[10rem]">
              <label className="text-label">
                {intl.formatMessage(messages.paymentDate)}
              </label>
              <div className="form-input-field mt-1">
                <input type="date" name="date" required />
              </div>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[10rem]">
              <label className="text-label">
                {intl.formatMessage(messages.paymentAmount)}
              </label>
              <div className="form-input-field mt-1">
                <CurrencyAmountInput
                  value={paymentFormAmount}
                  onChange={setPaymentFormAmount}
                  required
                  placeholder={intl.formatMessage(messages.amountPlaceholder)}
                />
              </div>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[12rem]">
              <label className="text-label">
                {intl.formatMessage(messages.columnMethod)}
              </label>
              <div className="form-input-field mt-1">
                <PaymentMethodSelect name="method" required />
              </div>
            </div>
            <Button buttonType="success" type="submit">
              {isOwnProfile
                ? intl.formatMessage(messages.declareTransfer)
                : intl.formatMessage(messages.addPayment)}
            </Button>
          </form>
        )}

        {data.payments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-800 text-xs uppercase text-gray-400">
                <tr>
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
                {data.payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-gray-700 bg-gray-800"
                  >
                    {editingPaymentId === payment.id ? (
                      <>
                        <td className="px-6 py-4">
                          <div className="form-input-field">
                            <input
                              type="date"
                              value={editForm.date}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  date: e.target.value,
                                })
                              }
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="form-input-field">
                            <CurrencyAmountInput
                              value={editForm.amount}
                              onChange={(amount) =>
                                setEditForm({
                                  ...editForm,
                                  amount,
                                })
                              }
                              className="short"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="form-input-field">
                            <PaymentMethodSelect
                              value={editForm.method}
                              onChange={(method) =>
                                setEditForm({
                                  ...editForm,
                                  method,
                                })
                              }
                              required
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {statusBadge(payment.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              buttonType="primary"
                              onClick={() => updatePayment(payment.id)}
                            >
                              {intl.formatMessage(messages.save)}
                            </Button>
                            <Button
                              buttonType="default"
                              onClick={() => setEditingPaymentId(null)}
                            >
                              {intl.formatMessage(messages.cancel)}
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-white">
                          {formatDisplayDate(payment.date)}
                        </td>
                        <td className="px-6 py-4 text-gray-100">
                          €{payment.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gray-100">
                          {formatPaymentMethod(intl, payment.method)}
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
                          <div className="flex flex-wrap gap-2">
                            {isAdmin && payment.status === 'pending' && (
                              <>
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
                              </>
                            )}
                            {isOwnProfile &&
                              !isAdmin &&
                              payment.status === 'pending' && (
                                <>
                                  <Button
                                    buttonType="default"
                                    onClick={() => startEditing(payment)}
                                  >
                                    {intl.formatMessage(messages.edit)}
                                  </Button>
                                  <Button
                                    buttonType="danger"
                                    onClick={() => deletePayment(payment.id)}
                                  >
                                    {intl.formatMessage(messages.delete)}
                                  </Button>
                                </>
                              )}
                            {isAdmin && (
                              <Button
                                buttonType="danger"
                                onClick={() => deletePayment(payment.id)}
                              >
                                {intl.formatMessage(messages.delete)}
                              </Button>
                            )}
                          </div>
                          {confirmingPaymentId === payment.id && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <div className="form-input-field min-w-[12rem]">
                                <input
                                  type="date"
                                  value={confirmDate}
                                  onChange={(e) =>
                                    setConfirmDate(e.target.value)
                                  }
                                  aria-label={intl.formatMessage(
                                    messages.receivedDate
                                  )}
                                  required
                                />
                              </div>
                              <Button
                                buttonType="success"
                                onClick={() =>
                                  confirmPayment(payment.id, confirmDate)
                                }
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
                          )}
                          {rejectingPaymentId === payment.id && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <div className="form-input-field min-w-[12rem]">
                                <input
                                  type="text"
                                  value={rejectionReason}
                                  onChange={(e) =>
                                    setRejectionReason(e.target.value)
                                  }
                                  placeholder={intl.formatMessage(
                                    messages.rejectionReason
                                  )}
                                />
                              </div>
                              <Button
                                buttonType="danger"
                                onClick={() =>
                                  rejectPayment(payment.id, rejectionReason)
                                }
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
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGiftSection && (
        <div>
          <h4 className="mb-4 text-lg font-bold text-gray-100">
            {intl.formatMessage(messages.giftedMonths)}
          </h4>
          <form
            onSubmit={addGift}
            className="mb-4 flex flex-wrap items-end gap-4"
          >
            <div className="form-input-field w-full sm:w-auto sm:min-w-[10rem]">
              <input type="date" name="date" required />
            </div>
            <div className="form-input-field w-full sm:w-auto sm:min-w-[6rem]">
              <input
                type="number"
                name="months"
                required
                placeholder={intl.formatMessage(messages.monthsPlaceholder)}
                className="short"
              />
            </div>
            <div className="form-input-field w-full sm:w-auto sm:min-w-[12rem]">
              <input
                type="text"
                name="reason"
                required
                placeholder={intl.formatMessage(messages.reasonPlaceholder)}
              />
            </div>
            <Button buttonType="success" type="submit">
              {intl.formatMessage(messages.addGift)}
            </Button>
          </form>
          {data.gifts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-800 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-3">
                      {intl.formatMessage(messages.columnDate)}
                    </th>
                    <th className="px-6 py-3">
                      {intl.formatMessage(messages.columnMonths)}
                    </th>
                    <th className="px-6 py-3">
                      {intl.formatMessage(messages.columnAmount)}
                    </th>
                    <th className="px-6 py-3">
                      {intl.formatMessage(messages.columnReason)}
                    </th>
                    <th className="px-6 py-3">
                      {intl.formatMessage(messages.columnActions)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.gifts.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-gray-700 bg-gray-800"
                    >
                      <td className="px-6 py-4 text-white">
                        {formatDisplayDate(g.date)}
                      </td>
                      <td className="px-6 py-4 text-gray-100">{g.months}</td>
                      <td className="px-6 py-4 text-gray-100">
                        {data.pricePerMonth != null
                          ? formatCurrency(g.months * data.pricePerMonth)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-100">{g.reason}</td>
                      <td className="px-6 py-4">
                        <Button
                          buttonType="danger"
                          onClick={() => deleteGift(g.id)}
                        >
                          {intl.formatMessage(messages.delete)}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSubscriptionSettings;
