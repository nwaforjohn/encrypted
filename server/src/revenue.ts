import { pool } from './db';
import { env } from './env';

/**
 * Owner-revenue accounting.
 *
 * Money actually moves through the app stores (StoreKit / Play Billing); this
 * module is the server's own bookkeeping so the owner can see earnings in-app
 * and so creator tip balances are tracked. For exact figures, reconcile the
 * `admin_earnings` ledger against your store payout reports.
 *
 * Prices live here (not just on the client) because the server needs an
 * authoritative amount to record when it verifies a consumable purchase — the
 * receipt confirms the SKU, and we map the SKU to the price we published.
 */

export type EarningSource = 'promotion' | 'subscription' | 'tip_cut' | 'ad';

/** Price, in cents, of every purchasable SKU. Keep in sync with the client. */
export const PRICE_CENTS: Record<string, number> = {
  // Subscriptions (recorded as owner revenue on verification).
  pro_monthly: 499,
  pro_yearly: 3999,
  // Tips (consumable). Platform keeps `platformCutPercent`; rest to creator.
  tip_small: 199,
  tip_medium: 499,
  tip_large: 999,
  // Post promotions (consumable). Whole amount is owner revenue.
  promote_24h: 499,
  promote_72h: 999,
  promote_7d: 2499,
};

/** How many hours a promotion SKU boosts a post for. */
export const PROMOTION_HOURS: Record<string, number> = {
  promote_24h: 24,
  promote_72h: 72,
  promote_7d: 24 * 7,
};

export function priceCents(sku: string): number {
  return PRICE_CENTS[sku] ?? 0;
}

/** The platform's cut of a gross amount, in cents (rounded). */
export function platformCut(grossCents: number): number {
  return Math.round((grossCents * env.platformCutPercent) / 100);
}

/** Append a row to the owner-revenue ledger. */
export async function recordEarning(
  source: EarningSource,
  amountCents: number,
  opts: { userId?: string | null; ref?: string | null; note?: string | null } = {}
): Promise<void> {
  if (amountCents <= 0) return;
  await pool.query(
    `INSERT INTO admin_earnings (source, amount_cents, user_id, ref, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [source, amountCents, opts.userId ?? null, opts.ref ?? null, opts.note ?? null]
  );
}

/** Credit a creator's payout balance by `netCents` (net of the platform cut). */
export async function creditCreator(
  userId: string,
  netCents: number
): Promise<void> {
  if (netCents <= 0) return;
  await pool.query(
    `INSERT INTO creator_balances (user_id, balance_cents, lifetime_cents, updated_at)
     VALUES ($1, $2, $2, now())
     ON CONFLICT (user_id) DO UPDATE
       SET balance_cents  = creator_balances.balance_cents  + EXCLUDED.balance_cents,
           lifetime_cents = creator_balances.lifetime_cents + EXCLUDED.lifetime_cents,
           updated_at     = now()`,
    [userId, netCents]
  );
}
