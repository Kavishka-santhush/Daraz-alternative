'use client';

import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

const stripePromise = env.stripe_publishable_key
  ? loadStripe(env.stripe_publishable_key)
  : null;

/**
 * Completes a card / installment payment whose Intent was created during
 * checkout. Settlement is finalised server-side by the Stripe webhook; on
 * success we just tell the parent so it refetches the order.
 */
function CardConfirmInner({ clientSecret, onDone }: { clientSecret: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    const cardElement = elements.getElement(CardElement);
    const { error } = cardElement
      ? await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: { name: 'MarketPlace buyer' },
          },
        })
      : { error: { message: 'Card form not ready' } };
    setBusy(false);
    if (error) {
      toast.error('Payment failed', { description: error.message ?? 'Please try another card.' });
      return;
    }
    toast.success('Payment received — thank you!');
    onDone();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); pay(); }} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="h-4 w-4 text-brand" /> Complete your card payment
      </div>
      <CardElement
        options={{
          style: {
            base: { fontSize: '15px', color: '#111827', '::placeholder': { color: '#9ca3af' } },
            invalid: { color: '#dc2626' },
          },
        }}
      />
      <Button type="submit" variant="brand" className="w-full" disabled={!stripe || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? 'Processing…' : 'Pay now'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Secured by Stripe. 3-D Secure may ask your bank to verify you.
      </p>
    </form>
  );
}

export function CardConfirm({ clientSecret, onDone }: { clientSecret: string; onDone: () => void }) {
  if (!stripePromise || !env.stripe_publishable_key) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Card payment is not configured on this deployment (missing publishable key).
      </p>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardConfirmInner clientSecret={clientSecret} onDone={onDone} />
    </Elements>
  );
}
