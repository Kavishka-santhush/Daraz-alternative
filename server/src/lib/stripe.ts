import Stripe from 'stripe';
import { env } from '../config/env';
import logger from '../config/logger';

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(env.stripe.secretKey, { apiVersion: '2024-06-20' });
  }
  return stripe;
}

export interface PaymentIntentResult {
  clientSecret: string;
  id: string;
}

/** Creates a SetupIntent-less PaymentIntent for a card charge. */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>
): Promise<PaymentIntentResult> {
  const intent = await getStripe().paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe works in the smallest currency unit
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  return { clientSecret: intent.client_secret ?? '', id: intent.id };
}

export async function refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
  return getStripe().refunds.create({
    payment_intent: paymentIntentId,
    ...(amount ? { amount: Math.round(amount * 100) } : {}),
  });
}

export function constructWebhookEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}

export async function createCustomer(email: string, name: string, externalId: string): Promise<Stripe.Customer> {
  return getStripe().customers.create({ email, name, metadata: { userId: externalId } });
}

export { Stripe };
export { logger };
