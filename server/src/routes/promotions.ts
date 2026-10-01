import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../auth/middleware';
import { verifyPurchase } from '../purchases';
import {
  PRICE_CENTS,
  PROMOTION_HOURS,
  priceCents,
  recordEarning,
} from '../revenue';

export const promotionsRouter = Router();

const promoteSchema = z.object({
  postId: z.string().min(1),
  sku: z.string().refine((s) => s.startsWith('promote_') && s in PRICE_CENTS, {
    message: 'unknown promotion product',
  }),
  platform: z.enum(['android', 'ios']),
  token: z.string().min(1).max(100_000),
});

/**
 * Promote one of the caller's posts for a paid window. The whole purchase is
 * owner revenue (recorded in the ledger). purchase_token is unique so a
 * replayed receipt can't extend the boost twice.
 */
promotionsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = promoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid' });
    return;
  }
  const buyerId = req.userId!;
  const { postId, sku, platform, token } = parsed.data;

  const post = (
    await pool.query<{ author_id: string }>(
      `SELECT author_id FROM posts WHERE id = $1`,
      [postId]
    )
  ).rows[0];
  if (!post) {
    res.status(404).json({ error: 'post not found' });
    return;
  }
  if (post.author_id !== buyerId) {
    res.status(403).json({ error: 'you can only promote your own posts' });
    return;
  }

  let result;
  try {
    result = await verifyPurchase(platform, sku, token);
  } catch (err) {
    console.warn('[promotions] verification error', err);
    res.status(502).json({ error: 'verification failed' });
    return;
  }
  if (!result.valid) {
    res.status(402).json({ error: 'purchase not valid' });
    return;
  }

  const amount = priceCents(sku);
  const hours = PROMOTION_HOURS[sku] ?? 24;

  const inserted = await pool.query(
    `INSERT INTO promotions
       (post_id, buyer_id, sku, amount_cents, hours, platform, purchase_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (purchase_token) DO NOTHING
     RETURNING id`,
    [postId, buyerId, sku, amount, hours, platform, token]
  );
  if (inserted.rowCount === 0) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  // Extend the boost window from the later of now / its current expiry.
  const { rows } = await pool.query<{ promoted_until: string }>(
    `UPDATE posts
        SET promoted_until = GREATEST(COALESCE(promoted_until, now()), now())
                             + ($2 || ' hours')::interval
      WHERE id = $1
      RETURNING promoted_until`,
    [postId, String(hours)]
  );

  await recordEarning('promotion', amount, {
    userId: buyerId,
    ref: postId,
    note: `promotion ${sku} (${hours}h)`,
  });

  res.json({ ok: true, promotedUntil: rows[0]?.promoted_until, amountCents: amount });
});
