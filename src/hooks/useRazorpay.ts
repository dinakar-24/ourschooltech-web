import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export function useRazorpay() {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const initiatePayment = async ({
    amount,
    schoolName,
    userEmail,
    userName,
    studentCount,
    paymentType = 'renewal',
    onSuccess,
    onError,
  }: {
    subscriptionId?: string;
    amount: number;
    schoolName: string;
    userEmail?: string;
    userName?: string;
    schoolId?: string;
    studentCount?: number;
    paymentType?: 'renewal' | 'topup';
    onSuccess?: () => void;
    onError?: (error: string) => void;
  }) => {
    setIsLoading(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load payment gateway');
      }

      // schoolId/subscriptionId are NOT sent — the backend derives the
      // school from the caller's JWT (same tenant-scoping as every other
      // school-scoped route) and looks up that school's own subscription,
      // rather than trusting a client-supplied id.
      const { data } = await api.post('/subscriptions/checkout/order', {
        paymentType,
        studentCount,
        amount,
      });

      if (!data?.orderId) throw new Error('Failed to create payment order');

      setIsLoading(false);
      setIsProcessing(true);

      const options: RazorpayOptions = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'School ERP',
        description: `Annual Subscription - ${schoolName}`,
        order_id: data.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            const { data: verifyData } = await api.post('/subscriptions/checkout/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (!verifyData?.verified) throw new Error('Payment verification failed');

            toast.success('Payment successful! Subscription activated.');
            onSuccess?.();
          } catch (err: any) {
            const message = err.response?.data?.error || err.message || 'Payment verification failed';
            toast.error(message);
            onError?.(message);
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: userName,
          email: userEmail,
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info('Payment cancelled');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Payment initiation failed';
      toast.error(message);
      onError?.(message);
      setIsLoading(false);
      setIsProcessing(false);
    }
  };

  return {
    initiatePayment,
    isLoading,
    isProcessing,
  };
}
