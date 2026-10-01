import { Router } from 'express';
import { q } from '../db';

const router = Router();

/**
 * Public server-location catalog for the website + app picker.
 * Only exposes what a client needs — never the agent_url/agent_secret.
 */
router.get('/', async (_req, res) => {
  const rows = await q(
    `SELECT code, country, country_name, city, premium, healthy,
            (load::float / NULLIF(capacity,0)) AS load_ratio
       FROM nodes
      WHERE enabled = true
      ORDER BY premium ASC, country_name ASC, city ASC`,
  );
  res.json({
    servers: rows.map((r: any) => ({
      code: r.code,
      country: r.country,
      countryName: r.country_name,
      city: r.city,
      premium: r.premium,
      online: r.healthy,
      load: r.load_ratio == null ? 0 : Math.round(Number(r.load_ratio) * 100),
    })),
  });
});

export default router;
