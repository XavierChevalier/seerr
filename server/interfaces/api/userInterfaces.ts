import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { User } from '@server/entity/User';
import type { PaginatedResponse } from './common';

export interface UserListItem extends Partial<User> {
  subscriptionBalance?: number | null;
  subscriptionStatus?: 'Actif' | 'Inactif' | null;
}

export interface UserResultsResponse extends PaginatedResponse {
  results: UserListItem[];
}

export interface UserRequestsResponse extends PaginatedResponse {
  results: MediaRequest[];
}

export interface QuotaStatus {
  days?: number;
  limit?: number;
  used: number;
  remaining?: number;
  restricted: boolean;
}

export interface QuotaResponse {
  movie: QuotaStatus;
  tv: QuotaStatus;
}

export interface UserWatchDataResponse {
  recentlyWatched: Media[];
  playCount: number;
}

export type SubscriptionPaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface SubscriptionPaymentResponse {
  id: number;
  date: string;
  amount: number;
  method: string;
  status: SubscriptionPaymentStatus;
  rejectionReason: string | null;
  createdByUserId: number;
}

export interface SubscriptionGiftResponse {
  id: number;
  date: string;
  months: number;
  reason: string;
}

export interface UserSubscriptionResponse {
  pricePerMonth: number | null;
  startDate: string | null;
  preference: string | null;
  totalPaid: number;
  totalDue: number;
  balance: number;
  elapsedMonths: number;
  totalGiftedMonths: number;
  remainingMonths: number;
  status: 'Actif' | 'Inactif';
  payments: SubscriptionPaymentResponse[];
  gifts: SubscriptionGiftResponse[];
}

export interface SubscriptionOverviewItem {
  id: number;
  displayName: string;
  email: string;
  avatar: string;
  subscription: UserSubscriptionResponse;
  pendingCount: number;
  pendingAmount: number;
  pendingPayments: { id: number; amount: number; date: string }[];
}

export interface SubscriptionStatusResponse {
  isConfigured: boolean;
  status: 'Actif' | 'Inactif' | null;
  remainingMonths: number | null;
  hasPendingPayments: boolean;
}

export interface SubscriptionOverviewResponse {
  results: SubscriptionOverviewItem[];
}

export interface SubscriptionCountResponse {
  pending: number;
}

export interface SubscriptionPaymentListItem {
  id: number;
  date: string;
  amount: number;
  method: string;
  status: SubscriptionPaymentStatus;
  rejectionReason: string | null;
  createdByUserId: number;
  user: {
    id: number;
    displayName: string;
    email: string;
    avatar: string;
  };
}

export interface SubscriptionPaymentsResponse {
  results: SubscriptionPaymentListItem[];
  totals: {
    pending: number;
    confirmed: number;
    eligible: number;
  };
}
