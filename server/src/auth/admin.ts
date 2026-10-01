import type { NextFunction, Request, Response } from 'express';
import { pool, type UserRow } from '../db';
import { env } from '../env';

/**
 * Gate owner-only endpoints. Runs AFTER requireAuth (which sets req.userId).
 *
 * A caller is an admin if their account row has is_admin = true, OR their
 * username is in the ADMIN_USERNAMES allowlist. The allowlist is also applied
 * on registration/login so the flag self-heals, but checking it here too means
 * adding a username to the env takes effect immediately for existing accounts.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { rows } = await pool.query<UserRow>(
    `SELECT username, is_admin FROM users WHERE id = $1`,
    [req.userId]
  );
  const user = rows[0];
  const allowed =
    !!user &&
    (user.is_admin || env.adminUsernames.includes(user.username.toLowerCase()));
  if (!allowed) {
    res.status(403).json({ error: 'admin only' });
    return;
  }
  next();
}
