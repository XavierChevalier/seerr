import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { UserSubscriptionResponse } from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { type FormEvent, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
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
    paymentsHistory: 'Payments History',
    amountPlaceholder: 'Amount (€)',
    methodPlaceholder: 'Method (e.g. PayPal)',
    addPayment: 'Add Payment',
    giftedMonths: 'Gifted Months',
    monthsPlaceholder: 'Months',
    reasonPlaceholder: 'Reason',
    addGift: 'Add Gift',
    delete: 'Delete',
    preferenceMensuel: 'Mensuel',
    preferenceSemestriel: 'Semestriel',
    preferenceAnnuel: 'Annuel',
    preferenceGratuit: 'Gratuit',
  }
);

const UserSubscriptionSettings = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();
  const { user } = useUser({ id: Number(router.query.userId) });
  const { data, error, mutate } = useSWR<UserSubscriptionResponse>(
    user ? `/api/v1/user/${user.id}/subscription` : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    pricePerMonth: '',
    startDate: '',
    preference: 'Mensuel',
  });

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

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={500} />;
  }

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.put(`/api/v1/user/${user?.id}/subscription`, {
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

  const addPayment = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      await axios.post(`/api/v1/user/${user?.id}/subscription/payment`, {
        date: formData.get('date'),
        amount: Number(formData.get('amount')),
        method: formData.get('method'),
      });
      mutate();
      (e.target as HTMLFormElement).reset();
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
      await axios.post(`/api/v1/user/${user?.id}/subscription/gift`, {
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
      await axios.delete(
        `/api/v1/user/${user?.id}/subscription/payment/${id}`
      );
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
      await axios.delete(`/api/v1/user/${user?.id}/subscription/gift/${id}`);
      mutate();
    } catch {
      addToast(intl.formatMessage(messages.toastDeleteFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">{intl.formatMessage(messages.description)}</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">{intl.formatMessage(messages.status)}</p>
          <p className="text-2xl font-bold">{data.status}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">
            {intl.formatMessage(messages.remainingMonths)}
          </p>
          <p className="text-2xl font-bold">{data.remainingMonths}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">
            {intl.formatMessage(messages.totalPaid)}
          </p>
          <p className="text-2xl font-bold">€{data.totalPaid.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <p className="text-gray-400">
            {intl.formatMessage(messages.balance)}
          </p>
          <p className="text-2xl font-bold">€{data.balance.toFixed(2)}</p>
        </div>
      </div>

      <form
        onSubmit={saveSettings}
        className="mb-8 rounded-lg bg-gray-800 p-4"
      >
        <h4 className="mb-4 text-lg font-bold">
          {intl.formatMessage(messages.baseConfiguration)}
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-gray-400">
              {intl.formatMessage(messages.monthlyPrice)}
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.pricePerMonth}
              onChange={(e) =>
                setSettings({ ...settings, pricePerMonth: e.target.value })
              }
              className="mt-1 w-full rounded bg-gray-700 p-2 text-white"
            />
          </div>
          <div>
            <label className="text-gray-400">
              {intl.formatMessage(messages.startDate)}
            </label>
            <input
              type="date"
              value={settings.startDate}
              onChange={(e) =>
                setSettings({ ...settings, startDate: e.target.value })
              }
              className="mt-1 w-full rounded bg-gray-700 p-2 text-white"
            />
          </div>
          <div>
            <label className="text-gray-400">
              {intl.formatMessage(messages.preference)}
            </label>
            <select
              value={settings.preference}
              onChange={(e) =>
                setSettings({ ...settings, preference: e.target.value })
              }
              className="mt-1 w-full rounded bg-gray-700 p-2 text-white"
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
        <Button buttonType="primary" className="mt-4" disabled={isSaving}>
          {intl.formatMessage(messages.saveSettings)}
        </Button>
      </form>

      <div className="mb-8">
        <h4 className="mb-4 text-lg font-bold">
          {intl.formatMessage(messages.paymentsHistory)}
        </h4>
        <form onSubmit={addPayment} className="mb-4 flex gap-4">
          <input
            type="date"
            name="date"
            required
            className="w-1/4 rounded bg-gray-700 p-2 text-white"
          />
          <input
            type="number"
            step="0.01"
            name="amount"
            required
            placeholder={intl.formatMessage(messages.amountPlaceholder)}
            className="w-1/4 rounded bg-gray-700 p-2 text-white"
          />
          <input
            type="text"
            name="method"
            required
            placeholder={intl.formatMessage(messages.methodPlaceholder)}
            className="w-1/4 rounded bg-gray-700 p-2 text-white"
          />
          <Button buttonType="success" type="submit">
            {intl.formatMessage(messages.addPayment)}
          </Button>
        </form>
        <ul className="rounded-lg bg-gray-800 p-4">
          {data.payments.map((p) => (
            <li
              key={p.id}
              className="flex justify-between border-b border-gray-700 py-2"
            >
              <span>
                {p.date} - €{p.amount.toFixed(2)} ({p.method})
              </span>
              <button
                type="button"
                onClick={() => deletePayment(p.id)}
                className="text-red-500"
              >
                {intl.formatMessage(messages.delete)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-4 text-lg font-bold">
          {intl.formatMessage(messages.giftedMonths)}
        </h4>
        <form onSubmit={addGift} className="mb-4 flex gap-4">
          <input
            type="date"
            name="date"
            required
            className="w-1/4 rounded bg-gray-700 p-2 text-white"
          />
          <input
            type="number"
            name="months"
            required
            placeholder={intl.formatMessage(messages.monthsPlaceholder)}
            className="w-1/4 rounded bg-gray-700 p-2 text-white"
          />
          <input
            type="text"
            name="reason"
            required
            placeholder={intl.formatMessage(messages.reasonPlaceholder)}
            className="w-1/4 rounded bg-gray-700 p-2 text-white"
          />
          <Button buttonType="success" type="submit">
            {intl.formatMessage(messages.addGift)}
          </Button>
        </form>
        <ul className="rounded-lg bg-gray-800 p-4">
          {data.gifts.map((g) => (
            <li
              key={g.id}
              className="flex justify-between border-b border-gray-700 py-2"
            >
              <span>
                {g.date} - {g.months} months ({g.reason})
              </span>
              <button
                type="button"
                onClick={() => deleteGift(g.id)}
                className="text-red-500"
              >
                {intl.formatMessage(messages.delete)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UserSubscriptionSettings;
