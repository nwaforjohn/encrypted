import Stripe from 'stripe';
import { env, stripeEnabled } from '../env';
import { one } from '../db';
import { applySubscription, recordPayment } from './entitlements';

export const stripe = stripeEnabled
  ? new Stripe(env.stripe.secretKey, { apiVersion: '2024-06-20' })
  : null;

/** Create a Checkout Session for a plan and return its URL. */
export async function createCheckout(params: {
  userId: string;
  email: string;
  plan: 'monthly' | 'yearly';
}): Promise<string> {
  if (!stripe) throw new Error('stripe_not_configured');
  const price = params.plan === 'yearly' ? env.stripe.priceYearly : env.stripe.priceMonthly;
  if (!price) throw new Error('stripe_price_not_configured');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer_email: params.email,
    // Tie the Stripe objects back to our user for the webhook.
    client_reference_id: params.userId,
    subscription_data: { metadata: { userId: params.userId } },
    metadata: { userId: params.userId },
    success_url: env.stripe.successUrl,
    cancel_url: env.stripe.cancelUrl,
    allow_promotion_codes: true,
  });
  return session.url!;
}

/** Open the Stripe Billing Portal so a user can manage/cancel their plan. */
export async function createPortal(userId: string, returnUrl: string): Promise<string> {
  if (!stripe) throw new Error('stripe_not_configured');
  const sub = await one<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id=$1`,
    [userId],
  );
  if (!sub?.stripe_customer_id) throw new Error('no_customer');
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  });
  return portal.url;
}

/**
 * Handle a verified Stripe webhook event. Keeps subscriptions + payments in
 * sync with Stripe (the source of truth for web billing).
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = (s.metadata?.userId || s.client_reference_id) as string | undefined;
      if (userId && s.subscription) {
        await applySubscription({
          userId,
          source: 'stripe',
          plan: 'premium',
          status: 'active',
          currentPeriodEnd: null, // filled by the subscription.updated event
          stripeCustomerId: (s.customer as string) ?? undefined,
          stripeSubscriptionId: s.subscription as string,
        });
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId as string | undefined;
      if (userId) {
        const active = ['active', 'trialing', 'past_due'].includes(sub.status);
        await applySubscription({
          userId,
          source: 'stripe',
          plan: active ? 'premium' : 'free',
          status: sub.status,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
        });
      }
      break;
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice;
      const userId = (inv.subscription_details?.metadata?.userId ||
        inv.metadata?.userId) as string | undefined;
      await recordPayment({
        userId: userId ?? null,
        source: 'stripe',
        kind: 'subscription',
        plan: inv.lines?.data?.[0]?.price?.nickname ?? undefined,
        amountCents: inv.amount_paid ?? 0,
        currency: inv.currency ?? 'usd',
        externalId: inv.id,
      });
      break;
    }
    default:
      // ignore other events
      break;
  }
}
