/**
 * Two API clients live in this file during the Supabase → Express migration:
 *
 *  1. `api` (default + named export) — axios instance against the Express
 *     backend. JWT request interceptor + refresh-on-401. Use this for all
 *     new/migrated code.
 *  2. `invokeEdgeFunction` — the original Supabase Edge Function wrapper.
 *     Only StudentsPage.tsx's handleDeleteAll ('delete-all-students') still
 *     calls it -- blocked pending a decision on cascade behavior (deleting
 *     Payment rows), see the memory note on this batch. useManageUser,
 *     useCreateSchoolUser, useTeachers, useSchools, useCashfree,
 *     ForgotPasswordDialog and SuperAdminOTPLogin are already migrated;
 *     the previous version of this comment listing all 8 was stale. Do not
 *     add new callers; delete this once delete-all-students is resolved.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { extractEdgeFunctionError, friendlyErrorMessage } from '@/lib/error-utils';
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

  const accessToken = data.accessToken as string;
  useAuthStore.getState().setAccessToken(accessToken);
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

// ── Supabase Edge Function wrapper (legacy — see header note) ─────────

const DEFAULT_TIMEOUT_MS = 12_000;
const SLOW_THRESHOLD_MS = 5_000;

// ── Request deduplication ────────────────────────────────────────────
const inflightRequests = new Map<string, Promise<any>>();

function getDedupeKey(fn: string, body: Record<string, any>): string {
  try {
    return `${fn}:${JSON.stringify(body)}`;
  } catch {
    return `${fn}:${Date.now()}`;
  }
}

// ── Retry helpers ────────────────────────────────────────────────────
const RETRYABLE_PATTERNS = /timeout|network|fetch|econnreset|socket hang up|5\d{2}|service unavailable/i;
const NON_RETRYABLE_PATTERNS = /40[0-3]|unauthorized|forbidden|not found|validation|invalid|already exists/i;

function isRetryable(error: Error): boolean {
  const msg = error.message || '';
  if (NON_RETRYABLE_PATTERNS.test(msg)) return false;
  if (RETRYABLE_PATTERNS.test(msg)) return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface InvokeOptions {
  timeoutMs?: number;
  /** Max retries for transient failures (default 2) */
  maxRetries?: number;
  /** Skip deduplication (for mutations) */
  skipDedupe?: boolean;
}

/**
 * Invoke a Supabase Edge Function with automatic error extraction, timeout,
 * performance tracking, exponential backoff retry, and request deduplication.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, any>,
  options?: InvokeOptions,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = 2, skipDedupe = false } = options ?? {};

  // Deduplication: if an identical request is already in flight, reuse it
  const dedupeKey = skipDedupe ? null : getDedupeKey(functionName, body);
  if (dedupeKey && inflightRequests.has(dedupeKey)) {
    return inflightRequests.get(dedupeKey)!;
  }

  const execute = async (): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1500ms
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        await sleep(delay + Math.random() * 200); // jitter
      }

      const start = performance.now();
      try {
        const result = await Promise.race([
          supabase.functions.invoke(functionName, { body }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs),
          ),
        ]);

        const duration = Math.round(performance.now() - start);

        // Log slow calls as warnings
        if (duration > SLOW_THRESHOLD_MS) {
          logError('edge_function', `Slow edge function: ${functionName} (${duration}ms)`, {
            functionName, duration_ms: duration, attempt,
          }, 'warning');
        }

        const errorMsg = await extractEdgeFunctionError(result);
        if (errorMsg) {
          const err = new Error(errorMsg);
          if (attempt < maxRetries && isRetryable(err)) {
            lastError = err;
            continue;
          }
          logError('edge_function', errorMsg, { functionName, duration_ms: duration }, 'error');
          throw err;
        }

        return result.data as T;
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        lastError = err as Error;

        if (attempt < maxRetries && isRetryable(lastError)) {
          logError('edge_function', `Retrying ${functionName} (attempt ${attempt + 1}): ${lastError.message}`, {
            functionName, duration_ms: duration, attempt,
          }, 'warning');
          continue;
        }

        logError('edge_function', lastError.message, { functionName, duration_ms: duration, attempt }, 'error');
        throw lastError;
      }
    }

    throw lastError ?? new Error('Unknown error');
  };

  const promise = execute().finally(() => {
    if (dedupeKey) inflightRequests.delete(dedupeKey);
  });

  if (dedupeKey) inflightRequests.set(dedupeKey, promise);
  return promise;
}
