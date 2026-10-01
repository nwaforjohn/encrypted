import { Router } from 'express';
import { z } from 'zod';
import { pool, type PostRow } from '../db';
import { requireAuth } from '../auth/middleware';
import { requireAdmin } from '../auth/admin';
import { env } from '../env';
import { recordEarning } from '../revenue';

export const adminRouter = Router();

// Every /admin route requires a valid session AND admin rights.
adminRouter.use(requireAuth, requireAdmin);

/**
 * Owner revenue dashboard: ledger totals by source, headline counts, an ad
 * revenue estimate from logged impressions, and the most recent earnings.
 */
adminRouter.get('/revenue', async (_req, res) => {
  const bySource = (
    await pool.query<{ source: string; cents: number; n: number }>(
      `SELECT source, COALESCE(sum(amount_cents), 0)::int AS cents, count(*)::int AS n
         FROM admin_earnings GROUP BY source`
    )
  ).rows;

  const totals: Record<string, number> = {
    promotion: 0,
    subscription: 0,
    tip_cut: 0,
  };
  for (const r of bySource) totals[r.source] = r.cents;

  const impressions = Number(
    (
      await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ad_impressions`
      )
    ).rows[0]?.n ?? 0
  );
  const estimatedAdCents = Math.round((impressions / 1000) * env.adEcpmCents);

  const ledgerTotal = totals.promotion + totals.subscription + totals.tip_cut;

  const counts = (
    await pool.query<{
      users: number;
      posts: number;
      tips: number;
      active_promotions: number;
      subscribers: number;
    }>(
      `SELECT
         (SELECT count(*) FROM users)::int  AS users,
         (SELECT count(*) FROM posts)::int  AS posts,
         (SELECT count(*) FROM tips)::int   AS tips,
         (SELECT count(*) FROM posts
            WHERE is_sponsored OR (promoted_until IS NOT NULL AND promoted_until > now())
         )::int AS active_promotions,
         (SELECT count(DISTINCT user_id) FROM entitlements
            WHERE sku LIKE 'pro_%' AND active
              AND (expires_at IS NULL OR expires_at > now())
         )::int AS subscribers`
    )
  ).rows[0];

  const recent = (
    await pool.query(
      `SELECT source, amount_cents, ref, note, created_at
         FROM admin_earnings ORDER BY created_at DESC LIMIT 25`
    )
  ).rows;

  res.json({
    currency: 'USD',
    totals: {
      promotionCents: totals.promotion,
      subscriptionCents: totals.subscription,
      tipCutCents: totals.tip_cut,
      estimatedAdCents,
      // Grand total includes the (estimated) ad revenue.
      allCents: ledgerTotal + estimatedAdCents,
    },
    adImpressions: impressions,
    platformCutPercent: env.platformCutPercent,
    counts,
    recent: recent.map((r) => ({
      source: r.source,
      amountCents: r.amount_cents,
      ref: r.ref,
      note: r.note,
      createdAt: r.created_at,
    })),
  });
});

const sponsoredSchema = z.object({
  imageUrl: z.string().url().max(2048),
  caption: z.string().max(2200).optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  hours: z.number().int().positive().max(24 * 365).optional(),
  // Optional revenue booked for a placement sold off-platform.
  amountCents: z.number().int().positive().max(100_000_000).optional(),
});

/**
 * Create a sponsored post (owner-placed). Appears in every user's feed while
 * active. If `amountCents` is given (a placement sold directly), it's booked
 * as promotion revenue.
 */
adminRouter.post('/sponsored', async (req, res) => {
  const parsed = sponsoredSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid' });
    return;
  }
  const { imageUrl, caption, mediaType, hours, amountCents } = parsed.data;

  const post = (
    await pool.query<PostRow>(
      `INSERT INTO posts (author_id, image_url, media_type, caption, is_sponsored, promoted_until)
       VALUES ($1, $2, $3, $4, true,
               CASE WHEN $5::int IS NULL THEN NULL
                    ELSE now() + ($5::text || ' hours')::interval END)
       RETURNING *`,
      [req.userId, imageUrl, mediaType ?? 'image', caption ?? '', hours ?? null]
    )
  ).rows[0];

  if (amountCents) {
    await recordEarning('promotion', amountCents, {
      userId: req.userId,
      ref: post.id,
      note: 'sponsored placement',
    });
  }

  res.json({ ok: true, postId: post.id, promotedUntil: post.promoted_until });
});
