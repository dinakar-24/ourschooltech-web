import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }, []);

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported || !user?.id) return;

    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    }).catch(() => {});
  }, [isSupported, user?.id]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user?.id) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') return false;

      // Fetched from the backend rather than hardcoded -- lets the key
      // rotate without a frontend deploy, and the old hardcoded key was
      // Supabase-project-specific (no matching private key exists for it
      // anymore).
      const { data: keyData } = await api.get('/push/vapid-public-key');
      const vapidPublicKey = keyData.publicKey as string;

      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      if (!subscription) return false;

      const subJson = subscription.toJSON();

      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
        deviceInfo: navigator.userAgent.slice(0, 200),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        // Best-effort -- the browser-side unsubscribe above is what
        // actually stops delivery; if this call fails the row is still
        // cleaned up the next time the push worker gets a 410/404 for it.
        await api.delete('/push/subscribe', { data: { endpoint } }).catch(() => {});
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      return false;
    }
  }, [isSupported]);

  return { permission, isSubscribed, isSupported, subscribe, unsubscribe };
}
