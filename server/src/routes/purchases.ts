import { Router } from 'express';
import { z } from 'zod';
import { pool, type EntitlementRow } from '../db';
import { requireAuth } from '../auth/middleware';
import { verifyPurchase } from '../purchases';
import { priceCents, recordEarning } from '../revenue';

export const purchasesRouter = Router();

const verifySchema = z.object({
  platform: z.enum(['android', 'ios']),
  sku: z.string().min(1).max(100),
  token: z.string().min(1).max(100_000), // purchaseToken (Android) / receipt (iOS)
});

async function listEntitlements(userId: string): Promise<string[]> {
  const { rows } = await pool.query<EntitlementRow>(
    `SELECT sku FROM entitlements
      WHERE user_id = $1 AND active = true
        AND (expires_at IS NULL OR expires_at > now())`,
    [userId]
  );
  return rows.map((r) => r.sku);
}

/** Verify a purchase server-side and persist the entitlement. */
purchasesRouter.post('/verify', requireAuth, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid purchase' });
    return;
  }
  const userId = req.userId!;
  const { platform, sku, token } = parsed.data;

  let result;
  try {
    result = await verifyPurchase(platform, sku, token);
  } catch (err) {
    console.warn('[purchases] verification error', err);
    res.status(502).json({ error: 'verification failed' });
    return;
  }

  if (!result.valid) {
    res.status(402).json({ error: 'purchase not valid', entitlements: await listEntitlements(userId) });
    return;
  }

  const { rowCount } = await pool.query(
    `INSERT INTO entitlements (user_id, sku, platform, purchase_token, expires_at, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (user_id, sku)
     DO UPDATE SET purchase_token = EXCLUDED.purchase_token,
                   expires_at = EXCLUDED.expires_at,
                   active = true
     -- only count a *new* purchase_token toward revenue (not a re-sync)
     WHERE entitlements.purchase_token IS DISTINCT FROM EXCLUDED.purchase_token`,
    [userId, sku, platform, token, result.expiresAt]
  );

  // A Pro subscription grants the verified badge and is owner revenue.
  if (sku.startsWith('pro_')) {
    await pool.query(`UPDATE users SET is_verified = true WHERE id = $1`, [userId]);
    if ((rowCount ?? 0) > 0) {
      await recordEarning('subscription', priceCents(sku), {
        userId,
        ref: sku,
        note: `${platform} subscription`,
      });
    }
  }

  res.json({ ok: true, entitlements: await listEntitlements(userId) });
});

/** Current active entitlements for the caller. */
purchasesRouter.get('/entitlements', requireAuth, async (req, res) => {
  res.json({ entitlements: await listEntitlements(req.userId!) });
});
