import { Router } from 'express';
import { q, one } from '../db';
import { requireAuth, requireAdmin } from '../auth/middleware';
import { revenueOverview, revenueByDay, recentPayments, nodeFleet } from '../admin/stats';

const router = Router();
router.use(requireAuth, requireAdmin);

/** Revenue dashboard payload. */
router.get('/overview', async (_req, res) => {
  const [overview, byDay, payments, nodes] = await Promise.all([
    revenueOverview(),
    revenueByDay(30),
    recentPayments(25),
    nodeFleet(),
  ]);
  res.json({
    overview,
    revenueByDay: byDay.map((d) => ({ day: d.day, cents: Number(d.cents) })),
    recentPayments: payments,
    nodes,
  });
});

/** List users (basic). */
router.get('/users', async (_req, res) => {
  const rows = await q(
    `SELECT u.id, u.email, u.role, u.created_at, u.last_login_at,
            s.plan, s.status, s.current_period_end
       FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id
      ORDER BY u.created_at DESC LIMIT 200`,
  );
  res.json({ users: rows });
});

/**
 * Register a real exit node (after you run infra/install-vpn-node.sh, which
 * prints these exact values). Body:
 *   { code, country, countryName, city, endpointHost, endpointPort,
 *     publicKey, agentUrl, agentSecret, subnetCidr?, premium?, capacity? }
 */
router.post('/nodes', async (req, res) => {
  const b = req.body ?? {};
  const required = ['code', 'country', 'countryName', 'city', 'endpointHost', 'publicKey', 'agentUrl', 'agentSecret'];
  for (const f of required) {
    if (!b[f]) return res.status(400).json({ error: `missing_${f}` });
  }
  const row = await one(
    `INSERT INTO nodes
       (code, country, country_name, city, endpoint_host, endpoint_port,
        public_key, agent_url, agent_secret, subnet_cidr, premium, capacity, healthy)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)
     ON CONFLICT (code) DO UPDATE SET
        country=EXCLUDED.country, country_name=EXCLUDED.country_name, city=EXCLUDED.city,
        endpoint_host=EXCLUDED.endpoint_host, endpoint_port=EXCLUDED.endpoint_port,
        public_key=EXCLUDED.public_key, agent_url=EXCLUDED.agent_url,
        agent_secret=EXCLUDED.agent_secret, subnet_cidr=EXCLUDED.subnet_cidr,
        premium=EXCLUDED.premium, capacity=EXCLUDED.capacity
     RETURNING id, code`,
    [
      b.code, String(b.country).toUpperCase(), b.countryName, b.city,
      b.endpointHost, parseInt(b.endpointPort ?? '51820', 10),
      b.publicKey, b.agentUrl, b.agentSecret,
      b.subnetCidr ?? '10.7.0.0/24', Boolean(b.premium), parseInt(b.capacity ?? '250', 10),
    ],
  );
  res.json({ node: row });
});

/** Enable/disable a node or toggle premium. */
router.patch('/nodes/:code', async (req, res) => {
  const fields: string[] = [];
  const params: any[] = [];
  for (const [col, key] of [['enabled', 'enabled'], ['premium', 'premium'], ['capacity', 'capacity']] as const) {
    if (req.body?.[key] !== undefined) {
      params.push(req.body[key]);
      fields.push(`${col}=$${params.length}`);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'nothing_to_update' });
  params.push(req.params.code);
  await q(`UPDATE nodes SET ${fields.join(', ')} WHERE code=$${params.length}`, params);
  res.json({ ok: true });
});

router.delete('/nodes/:code', async (req, res) => {
  await q(`DELETE FROM nodes WHERE code=$1`, [req.params.code]);
  res.json({ ok: true });
});

export default router;
