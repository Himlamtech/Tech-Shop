import { authorizedFetch } from "./auth";
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

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    message?: string;
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || "Admin request failed.");
  }
  return payload.data;
}

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
  return parseResponse<AdminDashboardData>(response);
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
  return parseResponse<AdminUserRecord[]>(response);
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
  return parseResponse<AdminPaymentRecord[]>(response);
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
  return parseResponse<AdminReviewRecord[]>(response);
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
  return parseResponse<AdminUserRecord>(response);
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
  return parseResponse<{ deleted: boolean }>(response);
}
