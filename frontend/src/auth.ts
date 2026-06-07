import { AuthSession, AuthTokens, AuthUser } from "./types";

const AUTH_STORAGE_KEY = "techshop_auth_session";
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || "/api/auth";

type AuthMode = "login" | "register";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field?: string; reason?: string }>;
  };
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

function buildUrl(path: string) {
  return `${AUTH_BASE_URL}${path}`;
}

function normalizeSession(payload: AuthResponse): AuthSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    user: payload.user,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    const details = payload.error?.details?.map((item) => item.reason).filter(Boolean).join(" ");
    throw new Error(details || payload.error?.message || "Authentication request failed.");
  }
  return payload.data;
}

export function loadStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: AuthSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function authenticate(mode: AuthMode, credentials: { email: string; password: string }) {
  const endpoint = mode === "login" ? "/login" : "/register";
  const response = await fetch(buildUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await parseResponse<AuthResponse>(response);
  return normalizeSession(data);
}

export async function fetchCurrentUser(accessToken: string) {
  const response = await fetch(buildUrl("/me"), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseResponse<AuthUser>(response);
}

export async function refreshSession(refreshToken: string) {
  const response = await fetch(buildUrl("/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await parseResponse<AuthResponse>(response);
  return normalizeSession(data);
}

export async function logoutSession(refreshToken: string) {
  const response = await fetch(buildUrl("/logout"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  await parseResponse<{ message: string }>(response);
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  tokens: AuthTokens | null,
  onSessionRefresh: (session: AuthSession | null) => void,
) {
  const headers = new Headers(init.headers || {});
  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  let response = await fetch(input, { ...init, headers });
  if (response.status !== 401 || !tokens?.refreshToken) {
    return response;
  }

  try {
    const nextSession = await refreshSession(tokens.refreshToken);
    persistSession(nextSession);
    onSessionRefresh(nextSession);

    const retriedHeaders = new Headers(init.headers || {});
    retriedHeaders.set("Authorization", `Bearer ${nextSession.accessToken}`);
    response = await fetch(input, { ...init, headers: retriedHeaders });
    return response;
  } catch {
    persistSession(null);
    onSessionRefresh(null);
    return response;
  }
}
