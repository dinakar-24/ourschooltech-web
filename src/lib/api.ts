/**
 * Axios instance against the Express backend. JWT request interceptor +
 * refresh-on-401.
 *
 * Used to also export `invokeEdgeFunction`, a Supabase Edge Function
 * wrapper, for the tail end of the Supabase migration where a handful of
 * call sites hadn't been ported yet. The last real caller
 * (StudentsPage.tsx's delete-all-students) was replaced by a real Express
 * endpoint; removed along with the Supabase client itself once that
 * closed out.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { logError } from '@/lib/logger';
import { useAuthStore, getAccessToken, getRefreshToken } from '@/stores/authStore';

// ── Express REST client ──────────────────────────────────────────────
// Set VITE_API_URL in .env (e.g. the Railway URL + /api). The localhost
// default matches the backend's `PORT || 5000`.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: concurrent 401s wait on one /auth/refresh call
// instead of each firing their own and racing to overwrite the token.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  // Bare axios on purpose — going through `api` would re-enter these
  // interceptors and recurse if the refresh itself 401s.
  const { data } = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );

  // /auth/refresh now rotates the refresh token on every call (real
  // rotation, not a 30-day-reusable one) — both tokens must be stored
  // together, or the next refresh would present a refresh token the
  // backend already deleted and get rejected.
  const accessToken = data.accessToken as string;
  const newRefreshToken = data.refreshToken as string;
  useAuthStore.getState().setTokens(accessToken, newRefreshToken);
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const isAuthEndpoint =
      original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login');

    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const accessToken = await refreshPromise;

      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      // Refresh token missing/expired/revoked — the session is genuinely over.
      useAuthStore.getState().clearAuth();

      // Deliberately does NOT navigate. A hard redirect here reloads the
      // document, which (a) wipes the Network panel so the underlying 401 is
      // invisible, and (b) while AuthContext is still Supabase-backed, lands
      // on /login, which sees the live Supabase session and bounces to the
      // role dashboard — making an auth failure look like a routing bug.
      // Reject instead and let the calling hook surface a normal error/toast.
      // Restore a redirect only once login actually populates authStore.
      logError(
        'auth',
        'Access token refresh failed; rejecting request',
        { url: original.url, reason: (refreshError as Error)?.message },
        'warning',
      );

      // Reject with the ORIGINAL 401, not the refresh error, so callers keep
      // `error.response.status`/`.data.error` and can branch on it as usual.
      return Promise.reject(error);
    }
  },
);

export default api;
