import { Router } from 'express';
import { q, one } from '../db';
import { requireAuth } from '../auth/middleware';
import { getEntitlement } from '../billing/entitlements';

const router = Router();
router.use(requireAuth);

/** Everything the account dashboard needs in one call. */
router.get('/', async (req, res) => {
  const ent = await getEntitlement(req.user!.sub);
  const devices = await q(
    `SELECT id, name, platform, created_at, last_seen_at FROM devices
      WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user!.sub],
  );
  const activeSession = await one(
    `SELECT s.id, s.started_at, n.city, n.country_name, n.code
       FROM vpn_sessions s JOIN nodes n ON n.id=s.node_id
      WHERE s.user_id=$1 AND s.status='active'
      ORDER BY s.started_at DESC LIMIT 1`,
    [req.user!.sub],
  );
  res.json({
    user: { id: req.user!.sub, email: req.user!.email, role: req.user!.role },
    entitlement: ent,
    devices,
    activeSession,
  });
});

export default router;
