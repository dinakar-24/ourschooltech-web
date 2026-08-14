/**
 * Centralized error handling utilities.
 *
 * – friendlyErrorMessage()      → maps raw backend strings to user-friendly text
 * – validateEmail / validatePassword / validateOTP  → client-side validation
 */

// ── Error mapping ──────────────────────────────────────────────────────────────

const ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: 'Incorrect email or password. Please try again.' },
  { pattern: /invalid credentials/i, message: 'Incorrect email or password. Please try again.' },
  { pattern: /invalid or expired otp/i, message: 'The OTP you entered is incorrect or has expired. Please request a new one.' },
  { pattern: /rate limit exceeded|too many attempts|too many requests/i, message: 'Too many attempts. Please wait a few minutes and try again.' },
  { pattern: /email not confirmed/i, message: 'Please verify your email address before signing in.' },
  { pattern: /user not found|no account found/i, message: 'No account found with this email address.' },
  { pattern: /not registered as a super admin/i, message: 'This email is not authorized for Super Admin access.' },
  { pattern: /email service not configured/i, message: 'Unable to send OTP. Please try again later or contact support.' },
  { pattern: /already been registered|email_exists|already exists/i, message: 'A user with this email already exists.' },
  { pattern: /TIMEOUT/i, message: 'Taking too long. Please check your connection and try again.' },
  { pattern: /failed to fetch|networkerror|network error|fetch error|load failed/i, message: 'Unable to connect. Please check your internet connection.' },
  { pattern: /password must be at least/i, message: 'Password must be at least 8 characters long.' },
];

const FALLBACK_MESSAGE = 'Something went wrong. Please try again or contact support.';

/**
 * Convert a raw backend / Supabase error string to a user-friendly message.
 */
export function friendlyErrorMessage(raw: unknown): string {
  if (!raw) return FALLBACK_MESSAGE;

  const str = typeof raw === 'string' ? raw : String(raw);

  // Reject stringified objects that leaked through
  if (str.startsWith('[object') || str === 'undefined' || str === 'null' || str.trim() === '') {
    return FALLBACK_MESSAGE;
  }

  for (const { pattern, message } of ERROR_MAP) {
    if (pattern.test(str)) return message;
  }

  // If the raw message looks reasonably human-readable (no stack traces, short), pass it through
  if (str.length < 200 && !str.includes('\n') && !str.includes('at ')) {
    return str;
  }

  return FALLBACK_MESSAGE;
}

// ── Client-side validation helpers ─────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error string or `null` if valid. */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Please enter your email address.';
  if (!EMAIL_RE.test(trimmed)) return 'Please enter a valid email address.';
  return null;
}

/** Returns an error string or `null` if valid. */
export function validatePassword(password: string): string | null {
  if (!password) return 'Please enter your password.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

/** Returns an error string or `null` if valid. Expects a 6-digit code. */
export function validateOTP(otp: string): string | null {
  if (!otp.trim()) return 'Please enter the OTP.';
  if (otp.length !== 6) return 'Please enter the complete 6-digit OTP.';
  if (!/^\d{6}$/.test(otp)) return 'OTP must contain only digits.';
  return null;
}
