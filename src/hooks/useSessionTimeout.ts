import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { UserRole } from '@/contexts/AuthContext';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];
const LAST_ACTIVITY_KEY = 'ost_last_activity';
const CHECK_INTERVAL_MS = 30_000; // check every 30s for smoother countdown
const WARNING_MINUTES = 5;

export interface SessionTimeoutState {
  showWarning: boolean;
  remainingSeconds: number;
  extendSession: () => void;
}

export function useSessionTimeout(
  role: UserRole | undefined,
  onTimeout: () => void,
): SessionTimeoutState {
  const timeoutMinutesRef = useRef<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const warningShownRef = useRef(false);

  // Fetch the timeout for the current role from system_settings
  useEffect(() => {
    if (!role) return;

    const defaults: Record<string, number> = {
      super_admin: 30, school_admin: 60, teacher: 480, parent: 4320, student: 4320,
    };

    const fetchTimeout = async () => {
      try {
        const { data } = await api.get('/settings/session-timeout');
        timeoutMinutesRef.current = Number(data.timeoutMinutes) || defaults[role] || 60;
      } catch {
        timeoutMinutesRef.current = defaults[role] ?? 60;
      }
    };

    fetchTimeout();
  }, [role]);

  // Track activity
  const recordActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  const extendSession = useCallback(() => {
    recordActivity();
    setShowWarning(false);
    setRemainingSeconds(0);
    warningShownRef.current = false;
  }, [recordActivity]);

  useEffect(() => {
    if (!role) return;

    recordActivity();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );

    const interval = setInterval(() => {
      const timeoutMin = timeoutMinutesRef.current;
      if (!timeoutMin) return;

      const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
      const elapsedMs = Date.now() - lastActivity;
      const timeoutMs = timeoutMin * 60 * 1000;
      const remainingMs = timeoutMs - elapsedMs;
      const warningMs = WARNING_MINUTES * 60 * 1000;

      if (remainingMs <= 0) {
        setShowWarning(false);
        warningShownRef.current = false;
        onTimeout();
      } else if (remainingMs <= warningMs && timeoutMin > WARNING_MINUTES) {
        // Only show warning if the timeout is longer than the warning window
        setShowWarning(true);
        setRemainingSeconds(Math.ceil(remainingMs / 1000));
        warningShownRef.current = true;
      } else {
        if (warningShownRef.current) {
          // Activity happened, dismiss warning
          setShowWarning(false);
          warningShownRef.current = false;
        }
      }
    }, CHECK_INTERVAL_MS);

    // Also run a fast ticker when warning is shown for live countdown
    const countdownInterval = setInterval(() => {
      if (!warningShownRef.current) return;
      const timeoutMin = timeoutMinutesRef.current;
      if (!timeoutMin) return;
      const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
      const remainingMs = timeoutMin * 60 * 1000 - (Date.now() - lastActivity);
      if (remainingMs <= 0) {
        setShowWarning(false);
        onTimeout();
      } else {
        setRemainingSeconds(Math.ceil(remainingMs / 1000));
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity));
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, [role, recordActivity, onTimeout]);

  return { showWarning, remainingSeconds, extendSession };
}
