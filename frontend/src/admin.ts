import { authorizedFetch } from "./auth";
import { parseApiResponse } from "./api";
import {
  AdminDashboardData,
  AdminPaymentRecord,
  AdminReviewRecord,
  AdminUserRecord,
  AuthSession,
  AuthTokens,
} from "./types";

const ADMIN_BASE_URL = import.meta.env.VITE_ADMIN_BASE_URL || "/api/admin";
const PAYMENT_BASE_URL = import.meta.env.VITE_PAYMENT_BASE_URL || "/api/payments";
const REVIEW_BASE_URL = import.meta.env.VITE_REVIEW_BASE_URL || "/api/reviews";

export async function fetchAdminDashboard(
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${ADMIN_BASE_URL}/dashboard`,
    {},
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<AdminDashboardData>(response)).data;
}

export async function fetchAdminUsers(
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${ADMIN_BASE_URL}/users?page_size=12`,
    {},
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<AdminUserRecord[]>(response)).data;
}

export async function fetchAdminPayments(
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${PAYMENT_BASE_URL}/admin/list/?page_size=12`,
    {},
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<AdminPaymentRecord[]>(response)).data;
}

export async function fetchAdminReviews(
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${REVIEW_BASE_URL}/admin/list?page_size=12`,
    {},
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<AdminReviewRecord[]>(response)).data;
}

export async function updateAdminUser(
  userId: string,
  body: Record<string, unknown>,
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${ADMIN_BASE_URL}/users/${userId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<AdminUserRecord>(response)).data;
}

export async function fetchAdminUserDetail(
  userId: string,
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${ADMIN_BASE_URL}/users/${userId}`,
    {},
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<AdminUserRecord>(response)).data;
}

export async function deleteAdminReview(
  reviewId: string,
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const response = await authorizedFetch(
    `${REVIEW_BASE_URL}/admin/${reviewId}`,
    { method: "DELETE" },
    tokens,
    onSessionRefresh,
  );
  return (await parseApiResponse<{ deleted: boolean }>(response)).data;
}
