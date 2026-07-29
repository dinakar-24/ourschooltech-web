import { api } from '@/lib/api';

interface SendNotificationParams {
  userIds: string[];
  title: string;
  body: string;
  type?: string;
  referenceId?: string;
  schoolId?: string;
}

/**
 * Send in-app notifications via POST /api/notifications.
 *
 * Migrated from the Supabase job queue. The queue is gone rather than ported:
 * `process-jobs` was never scheduled (no cron.schedule anywhere in the repo),
 * so enqueued jobs sat unprocessed forever and the only path that ever ran was
 * the "enqueue failed" fallback. Sending is now a direct, synchronous call.
 *
 * Signature is unchanged so the existing call sites need no edits.
 *
 * ⚠️ Recipients must be **Express** User ids. The remaining callers
 * (useAttendance, useAnnouncements, useHomework, useFees, useExams,
 * SendReminderDialog) still derive ids from Supabase `profiles`, which are
 * different ids — the backend rejects those with a 400 / UNKNOWN_RECIPIENTS
 * rather than failing on a foreign key. Each call site starts working once its
 * own hook migrates.
 *
 * Web Push is not sent; this is in-app only. See the plan for why.
 *
 * Fire-and-forget — never throws, so a notification failure can't roll back
 * the action that triggered it.
 */
export async function sendNotification({
  userIds,
  title,
  body,
  type = 'general',
  referenceId,
  schoolId,
}: SendNotificationParams) {
  if (!userIds.length) return;

  try {
    await api.post('/notifications', {
      userIds,
      title,
      body,
      type,
      referenceId: referenceId || null,
      schoolId: schoolId || null,
    });
  } catch (err: any) {
    // Logged, not surfaced: the caller's primary action (marking attendance,
    // publishing homework) has already succeeded by this point.
    console.error(
      'sendNotification failed:',
      err?.response?.data?.error || err?.message,
      err?.response?.data?.code === 'UNKNOWN_RECIPIENTS'
        ? '— recipient ids are not Express User ids; the calling hook is still on Supabase'
        : '',
    );
  }
}
