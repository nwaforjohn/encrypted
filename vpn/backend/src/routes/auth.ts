import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one } from '../db';
import { env } from '../env';
import { signToken } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';
import { ensureSubscription, getEntitlement } from '../billing/entitlements';

const router = Router();

function validEmail(e: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

router.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  if (!validEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password' });

  const existing = await one(`SELECT id FROM users WHERE email=$1`, [email]);
  if (existing) return res.status(409).json({ error: 'email_taken' });

  const hash = await bcrypt.hash(password, 12);
  const role = email === env.adminEmail ? 'admin' : 'user';
  const user = await one<{ id: string; role: string }>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id, role`,
    [email, hash, role],
  );
  await ensureSubscription(user!.id);

  const token = signToken({ sub: user!.id, role: user!.role as any, email });
  res.json({ token, user: { id: user!.id, email, role: user!.role } });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  const user = await one<{ id: string; password_hash: string; role: string }>(
    `SELECT id, password_hash, role FROM users WHERE email=$1`,
    [email],
  );
  if (!user) return res.status(401).json({ error: 'bad_credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'bad_credentials' });

  await one(`UPDATE users SET last_login_at=now() WHERE id=$1`, [user.id]);
  const token = signToken({ sub: user.id, role: user.role as any, email });
  res.json({ token, user: { id: user.id, email, role: user.role } });
});

router.get('/me', requireAuth, async (req, res) => {
  const ent = await getEntitlement(req.user!.sub);
  res.json({
    user: { id: req.user!.sub, email: req.user!.email, role: req.user!.role },
    entitlement: ent,
  });
});

export default router;
