import { Router } from 'express';
import { z } from 'zod';
import { pool, type UserRow } from '../db';
import { requireAuth } from '../auth/middleware';
import { verifyPurchase } from '../purchases';
import { sendPush } from '../push/expo';
import {
  PRICE_CENTS,
  creditCreator,
  platformCut,
  priceCents,
  recordEarning,
} from '../revenue';

export const tipsRouter = Router();

const tipSchema = z.object({
  toUserId: z.string().min(1),
  postId: z.string().min(1).optional(),
  sku: z.string().refine((s) => s.startsWith('tip_') && s in PRICE_CENTS, {
    message: 'unknown tip product',
  }),
  platform: z.enum(['android', 'ios']),
  token: z.string().min(1).max(100_000),
});

/**
 * Record a creator tip from a verified consumable purchase. The platform keeps
 * its configured cut (owner revenue) and credits the rest to the creator's
 * payout balance. purchase_token is unique, so a replayed receipt is a no-op.
 */
tipsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = tipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid' });
    return;
  }
  const fromUserId = req.userId!;
  const { toUserId, postId, sku, platform, token } = parsed.data;

  if (toUserId === fromUserId) {
    res.status(400).json({ error: "you can't tip yourself" });
    return;
  }

  const creator = (
    await pool.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [toUserId])
  ).rows[0];
  if (!creator) {
    res.status(404).json({ error: 'creator not found' });
    return;
  }

  let result;
  try {
    result = await verifyPurchase(platform, sku, token);
  } catch (err) {
    console.warn('[tips] verification error', err);
    res.status(502).json({ error: 'verification failed' });
    return;
  }
  if (!result.valid) {
    res.status(402).json({ error: 'purchase not valid' });
    return;
  }

  const gross = priceCents(sku);
  const cut = platformCut(gross);
  const net = gross - cut;

  const inserted = await pool.query(
    `INSERT INTO tips
       (from_user_id, to_user_id, post_id, gross_cents, platform_cut_cents,
        creator_net_cents, sku, platform, purchase_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (purchase_token) DO NOTHING
     RETURNING id`,
    [fromUserId, toUserId, postId ?? null, gross, cut, net, sku, platform, token]
  );

  // Replayed receipt (already processed) — succeed idempotently.
  if (inserted.rowCount === 0) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  await creditCreator(toUserId, net);
  await recordEarning('tip_cut', cut, {
    userId: toUserId,
    ref: inserted.rows[0].id,
    note: `tip ${sku} from ${fromUserId}`,
  });

  const me = (
    await pool.query<UserRow>(`SELECT username FROM users WHERE id = $1`, [
      fromUserId,
    ])
  ).rows[0];
  await sendPush(
    creator.push_token,
    `${me?.username} sent you a tip`,
    `You received $${(net / 100).toFixed(2)} 💸`,
    { type: 'tip' }
  );

  res.json({ ok: true, grossCents: gross, creatorNetCents: net, platformCutCents: cut });
});
