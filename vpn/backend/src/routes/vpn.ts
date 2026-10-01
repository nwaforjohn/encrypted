import { Router } from 'express';
import { one, q } from '../db';
import { requireAuth } from '../auth/middleware';
import { connect, disconnect } from '../vpn/provisioning';

const router = Router();
router.use(requireAuth);

/** Register (or update) a device + its WireGuard public key. */
router.post('/devices', async (req, res) => {
  const publicKey = String(req.body?.publicKey ?? '').trim();
  const name = String(req.body?.name ?? 'device').slice(0, 64);
  const platform = ['ios', 'android', 'web'].includes(req.body?.platform)
    ? req.body.platform
    : 'unknown';
  if (!publicKey) return res.status(400).json({ error: 'missing_public_key' });

  const device = await one<{ id: string }>(
    `INSERT INTO devices (user_id, name, platform, public_key)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, public_key)
     DO UPDATE SET name=EXCLUDED.name, platform=EXCLUDED.platform, last_seen_at=now()
     RETURNING id`,
    [req.user!.sub, name, platform, publicKey],
  );
  res.json({ deviceId: device!.id });
});

/** List the caller's devices. */
router.get('/devices', async (req, res) => {
  const rows = await q(
    `SELECT id, name, platform, public_key, created_at, last_seen_at
       FROM devices WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user!.sub],
  );
  res.json({ devices: rows });
});

/**
 * Connect: provision a tunnel to a chosen location (or auto-pick the fastest).
 * Body: { deviceId, publicKey, code?, country? }
 * Returns a ready WireGuard client config (device fills in its private key).
 */
router.post('/connect', async (req, res) => {
  const deviceId = String(req.body?.deviceId ?? '');
  const publicKey = String(req.body?.publicKey ?? '');
  if (!deviceId || !publicKey) return res.status(400).json({ error: 'missing_device' });

  // Verify the device belongs to the caller.
  const device = await one<{ id: string }>(
    `SELECT id FROM devices WHERE id=$1 AND user_id=$2 AND public_key=$3`,
    [deviceId, req.user!.sub, publicKey],
  );
  if (!device) return res.status(403).json({ error: 'unknown_device' });

  try {
    const result = await connect({
      userId: req.user!.sub,
      deviceId,
      devicePublicKey: publicKey,
      nodeCode: req.body?.code ? String(req.body.code) : undefined,
      country: req.body?.country ? String(req.body.country) : undefined,
    });
    res.json(result);
  } catch (e: any) {
    if (e.code === 'premium_required' || e.message === 'premium_required') {
      return res.status(402).json({ error: 'premium_required' });
    }
    if (e.message === 'no_node_available') {
      return res.status(503).json({ error: 'no_node_available' });
    }
    console.error('[vpn] connect failed:', e);
    res.status(500).json({ error: 'connect_failed' });
  }
});

/** Disconnect a session. Body: { sessionId, publicKey } */
router.post('/disconnect', async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? '');
  const publicKey = String(req.body?.publicKey ?? '');
  if (!sessionId) return res.status(400).json({ error: 'missing_session' });
  await disconnect({ userId: req.user!.sub, sessionId, devicePublicKey: publicKey });
  res.json({ ok: true });
});

/** Current + recent sessions for the caller. */
router.get('/sessions', async (req, res) => {
  const rows = await q(
    `SELECT s.id, s.status, s.started_at, s.ended_at, s.assigned_ip,
            n.code, n.city, n.country_name
       FROM vpn_sessions s JOIN nodes n ON n.id=s.node_id
      WHERE s.user_id=$1 ORDER BY s.started_at DESC LIMIT 20`,
    [req.user!.sub],
  );
  res.json({ sessions: rows });
});

export default router;
