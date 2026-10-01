import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../auth/middleware';

export const adsRouter = Router();

const impressionSchema = z.object({
  placement: z.string().min(1).max(64),
});

/**
 * Log a feed ad impression. Used only to estimate ad revenue in the owner
 * dashboard — the real payout is reported by AdMob. Failures are swallowed so
 * ad logging never affects the user experience.
 */
adsRouter.post('/impression', requireAuth, async (req, res) => {
  const parsed = impressionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.json({ ok: false });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO ad_impressions (user_id, placement) VALUES ($1, $2)`,
      [req.userId, parsed.data.placement]
    );
  } catch {
    // Non-fatal.
  }
  res.json({ ok: true });
});
