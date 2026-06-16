import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import type { SubscriptionOverviewResponse } from '@server/interfaces/api/userInterfaces';
import Link from 'next/link';
import useSWR from 'swr';

const SubscriptionList = () => {
  const { data, error } = useSWR<SubscriptionOverviewResponse>(
    '/api/v1/subscription'
  );

  if (!data && !error) return <LoadingSpinner />;

  return (
    <>
      <PageTitle title="Subscriptions Overview" />
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Subscriptions Overview</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Balance</th>
              <th className="px-6 py-3">Remaining Months</th>
              <th className="px-6 py-3">Total Paid</th>
              <th className="px-6 py-3">Monthly Price</th>
              <th className="px-6 py-3">Preference</th>
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
                  {user.subscription.status}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default SubscriptionList;
