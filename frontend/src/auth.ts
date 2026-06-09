import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { AuthSession, AuthTokens, AuthUser } from "./types";

const AUTH_STORAGE_KEY = "techshop_auth_session";
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || "/api/auth";
const FIREBASE_PHONE_RECAPTCHA_ID = "firebase-phone-recaptcha";

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

let recaptchaVerifier: RecaptchaVerifier | null = null;

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

async function synchronizeSessionUser(session: AuthSession) {
  try {
    const user = await fetchCurrentUser(session.accessToken);
    return {
      ...session,
      user: {
        ...session.user,
        ...user,
      },
    } satisfies AuthSession;
  } catch {
    return session;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    const details = payload.error?.details?.map((item) => item.reason).filter(Boolean).join(" ");
    throw new Error(details || payload.error?.message || "Authentication request failed.");
  }
  return payload.data;
}

async function authenticateWithFirebaseIdToken(idToken: string) {
  const response = await fetch(buildUrl("/firebase"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id_token: idToken }),
  });

  const data = await parseResponse<AuthResponse>(response);
  return synchronizeSessionUser(normalizeSession(data));
}

function getRecaptchaVerifier(containerId = FIREBASE_PHONE_RECAPTCHA_ID) {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: "invisible",
  });

  return recaptchaVerifier;
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
  return synchronizeSessionUser(normalizeSession(data));
}

export async function authenticateWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(firebaseAuth, provider);
  const idToken = await credential.user.getIdToken(true);
  return authenticateWithFirebaseIdToken(idToken);
}

export async function startPhoneSignIn(phoneNumber: string) {
  const verifier = getRecaptchaVerifier();
  await verifier.render();
  return signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier);
}

export async function completePhoneSignIn(confirmation: ConfirmationResult, code: string) {
  const result = await confirmation.confirm(code);
  const idToken = await result.user.getIdToken(true);
  return authenticateWithFirebaseIdToken(idToken);
}

export async function clearFirebaseClientSession() {
  try {
    await signOut(firebaseAuth);
  } catch {
    // Ignore client-side Firebase sign-out failures; local session is the source of truth.
  }
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
  return synchronizeSessionUser(normalizeSession(data));
}

export async function restoreSession(session: AuthSession) {
  const user = await fetchCurrentUser(session.accessToken);
  return {
    ...session,
    user: {
      ...session.user,
      ...user,
    },
  } satisfies AuthSession;
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
