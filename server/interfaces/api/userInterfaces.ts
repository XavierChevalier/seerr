import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { User } from '@server/entity/User';
import type { PaginatedResponse } from './common';

export interface UserResultsResponse extends PaginatedResponse {
  results: User[];
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

export interface SubscriptionPaymentResponse {
  id: number;
  date: string;
  amount: number;
  method: string;
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
}

export interface SubscriptionOverviewResponse {
  results: SubscriptionOverviewItem[];
}
