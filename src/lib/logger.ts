/**
 * Centralized client-side error logger.
 *
 * Writes to the `error_logs` table via POST /api/logs/client-error.
 * Batches logs (debounced 2s) to avoid spamming the DB on cascading failures
 * -- flush() sends the whole pending batch in a single request rather than
 * one request per entry.
 * Never exposes sensitive data in logs.
 *
 * The endpoint deliberately requires no auth (errors can happen pre-login),
 * but `api`'s request interceptor attaches the current access token when
 * one exists, so the backend can still attribute logs to a real user/school
 * when the caller happens to be logged in -- see logs.controller.js.
 */

import { api } from '@/lib/api';

export type ErrorType = 'edge_function' | 'rpc' | 'auth' | 'frontend_crash' | 'network' | 'mutation';
export type Severity = 'warning' | 'error' | 'critical';

interface LogEntry {
  errorType: ErrorType;
  message: string;
  context: Record<string, any>;
  severity: Severity;
}

// --- Batching ---
let pendingLogs: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 2_000;
const MAX_BATCH_SIZE = 20;

/** Sanitize context to remove sensitive data before logging */
function sanitizeContext(ctx: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'authorization', 'cookie', 'otp', 'api_key']);

  for (const [key, value] of Object.entries(ctx)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = value.slice(0, 500) + '...';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function flush() {
  if (pendingLogs.length === 0) return;
  const batch = pendingLogs.splice(0, MAX_BATCH_SIZE);

  try {
    await api.post('/logs/client-error', { logs: batch });
  } catch {
    // Logging should never throw -- silently discard on failure. Must not
    // call logError() here: that would re-enter this exact flow.
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

// --- Public API ---

/**
 * Log an error to the server. Fire-and-forget -- never throws.
 */
export function logError(
  type: ErrorType,
  message: string,
  context?: Record<string, any>,
  severity: Severity = 'error',
) {
  const entry: LogEntry = {
    errorType: type,
    message: message.slice(0, 1000),
    context: sanitizeContext({
      ...context,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    }),
    severity,
  };

  pendingLogs.push(entry);

  // Cap to prevent memory bloat
  if (pendingLogs.length > 100) {
    pendingLogs = pendingLogs.slice(-50);
  }

  // Immediate flush if batch is full
  if (pendingLogs.length >= MAX_BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}
