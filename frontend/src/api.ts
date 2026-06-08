import { AuthSession } from "./types";

interface ApiErrorShape {
  message?: string;
  details?: Array<{ field?: string; reason?: string }>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: ApiErrorShape;
  meta?: Record<string, unknown>;
}

export interface PaginatedMeta {
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export async function parseApiResponse<T>(response: Response): Promise<{ data: T; meta?: PaginatedMeta }> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    const details = payload.error?.details?.map((item) => item.reason).filter(Boolean).join(" ");
    throw new Error(details || payload.error?.message || "Request failed.");
  }
  return { data: payload.data, meta: payload.meta as PaginatedMeta | undefined };
}

export function syncSessionSetter(
  setAuthSession: (value: AuthSession | null | ((current: AuthSession | null) => AuthSession | null)) => void,
) {
  return (session: AuthSession | null) => {
    setAuthSession(session);
  };
}
