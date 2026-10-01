import { one, q } from '../db';

export interface Entitlement {
  plan: 'free' | 'premium';
  status: string;
  premium: boolean; // true only if premium AND not expired
  currentPeriodEnd: string | null;
}

/** Ensure a subscriptions row exists for a user (defaults to free). */
export async function ensureSubscription(userId: string): Promise<void> {
  await q(
    `INSERT INTO subscriptions (user_id, plan, status) VALUES ($1,'free','inactive')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

/** Resolve the live entitlement for a user. */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const row = await one<{
    plan: 'free' | 'premium';
    status: string;
    current_period_end: string | null;
  }>(
    `SELECT plan, status, current_period_end FROM subscriptions WHERE user_id=$1`,
    [userId],
  );
  if (!row) return { plan: 'free', status: 'inactive', premium: false, currentPeriodEnd: null };

  const notExpired =
    !row.current_period_end || new Date(row.current_period_end).getTime() > Date.now();
  const premium =
    row.plan === 'premium' && ['active', 'trialing', 'past_due'].includes(row.status) && notExpired;

  return {
    plan: row.plan,
    status: row.status,
    premium,
    currentPeriodEnd: row.current_period_end,
  };
}

/**
 * Upsert a user's subscription from a billing source and record the money in
 * the payments ledger (idempotent on external_id). Used by Stripe webhooks and
 * mobile IAP verification alike.
 */
export async function applySubscription(params: {
  userId: string;
  source: 'stripe' | 'apple' | 'google';
  plan: 'free' | 'premium';
  status: string;
  currentPeriodEnd: Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  storeProductId?: string;
  storeTxnId?: string;
}): Promise<void> {
  await ensureSubscription(params.userId);
  await q(
    `UPDATE subscriptions SET
       plan=$2, source=$3, status=$4, current_period_end=$5,
       stripe_customer_id=COALESCE($6, stripe_customer_id),
       stripe_subscription_id=COALESCE($7, stripe_subscription_id),
       store_product_id=COALESCE($8, store_product_id),
       store_txn_id=COALESCE($9, store_txn_id),
       updated_at=now()
     WHERE user_id=$1`,
    [
      params.userId,
      params.plan,
      params.source,
      params.status,
      params.currentPeriodEnd,
      params.stripeCustomerId ?? null,
      params.stripeSubscriptionId ?? null,
      params.storeProductId ?? null,
      params.storeTxnId ?? null,
    ],
  );
}

/** Record a payment for the admin revenue dashboard (idempotent). */
export async function recordPayment(params: {
  userId: string | null;
  source: 'stripe' | 'apple' | 'google';
  kind?: 'subscription' | 'one_time' | 'refund';
  plan?: string;
  amountCents: number;
  currency?: string;
  externalId?: string;
}): Promise<void> {
  await q(
    `INSERT INTO payments (user_id, source, kind, plan, amount_cents, currency, external_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING`,
    [
      params.userId,
      params.source,
      params.kind ?? 'subscription',
      params.plan ?? null,
      params.amountCents,
      params.currency ?? 'usd',
      params.externalId ?? null,
    ],
  );
}
