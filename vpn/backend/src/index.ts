import express from 'express';
import cors from 'cors';
import { env } from './env';
import { initDb, q } from './db';
import { health } from './vpn/nodeClient';

import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import vpnRoutes from './routes/vpn';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';
import subscriptionRoutes, { stripeWebhook } from './routes/subscriptions';

async function main() {
  await initDb();

  const app = express();
  app.use(
    cors({
      origin: (origin, cb) => {
        // allow no-origin (curl/native app) and configured website origins
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
    }),
  );

  // Stripe webhook needs the RAW body — mount it before express.json().
  app.post('/billing/webhook', ...stripeWebhook);

  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'auroravpn-control-plane' }));

  app.use('/auth', authRoutes);
  app.use('/servers', serverRoutes);
  app.use('/vpn', vpnRoutes);
  app.use('/account', accountRoutes);
  app.use('/billing', subscriptionRoutes);
  app.use('/admin', adminRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  app.listen(env.port, () => {
    console.log(`[api] AuroraVPN control plane listening on :${env.port}`);
    if (env.adminEmail) console.log(`[api] admin account: ${env.adminEmail}`);
  });

  startHealthLoop();
}

/** Periodically ping every node's agent and update healthy/last_health_at. */
function startHealthLoop() {
  const tick = async () => {
    try {
      const nodes = await q<any>(`SELECT * FROM nodes WHERE enabled=true`);
      await Promise.all(
        nodes.map(async (n) => {
          const ok = await health(n);
          await q(`UPDATE nodes SET healthy=$2, last_health_at=now() WHERE id=$1`, [n.id, ok]);
        }),
      );
    } catch (e) {
      console.warn('[health] loop error:', (e as Error).message);
    }
  };
  tick();
  setInterval(tick, 30_000);
}

main().catch((e) => {
  console.error('[api] fatal:', e);
  process.exit(1);
});
