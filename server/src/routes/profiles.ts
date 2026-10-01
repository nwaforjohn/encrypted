import { Router } from 'express';
import { z } from 'zod';
import { pool, type UserRow } from '../db';
import { requireAuth } from '../auth/middleware';
import { sendPush } from '../push/expo';
import { env } from '../env';
import { mapAuthor, type AuthorJoin } from '../serialize';

export const profilesRouter = Router();

interface ProfileRow extends UserRow {
  post_count: string | number;
  follower_count: string | number;
  following_count: string | number;
  is_following: boolean;
}

function mapProfile(row: ProfileRow, viewerId: string) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? row.username,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url,
    isVerified: row.is_verified,
    isAdmin: row.is_admin || env.adminUsernames.includes(row.username),
    isMe: row.id === viewerId,
    isFollowing: row.is_following,
    counts: {
      posts: Number(row.post_count),
      followers: Number(row.follower_count),
      following: Number(row.following_count),
    },
  };
}

const PROFILE_SELECT = `
  SELECT u.*,
         (SELECT count(*) FROM posts   p WHERE p.author_id = u.id)   AS post_count,
         (SELECT count(*) FROM follows f WHERE f.followee_id = u.id)  AS follower_count,
         (SELECT count(*) FROM follows f WHERE f.follower_id = u.id)  AS following_count,
         EXISTS(SELECT 1 FROM follows f
                 WHERE f.followee_id = u.id AND f.follower_id = $1)   AS is_following
    FROM users u`;

/** The caller's own profile (plus payout balance). */
profilesRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query<ProfileRow>(
    `${PROFILE_SELECT} WHERE u.id = $1`,
    [req.userId]
  );
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const balance = (
    await pool.query<{ balance_cents: number; lifetime_cents: number }>(
      `SELECT balance_cents, lifetime_cents FROM creator_balances WHERE user_id = $1`,
      [req.userId]
    )
  ).rows[0];
  res.json({
    profile: {
      ...mapProfile(row, req.userId!),
      balanceCents: balance?.balance_cents ?? 0,
      lifetimeCents: balance?.lifetime_cents ?? 0,
    },
  });
});

/** Search users by username / display name (for Discover). */
profilesRouter.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (q.length < 1) {
    res.json({ users: [] });
    return;
  }
  const { rows } = await pool.query<AuthorJoin & { is_following: boolean }>(
    `SELECT u.id AS author_id, u.username, u.display_name, u.avatar_url, u.is_verified,
            EXISTS(SELECT 1 FROM follows f
                    WHERE f.followee_id = u.id AND f.follower_id = $1) AS is_following
       FROM users u
      WHERE u.id <> $1
        AND (u.username LIKE $2 OR lower(u.display_name) LIKE $2)
      ORDER BY u.username ASC
      LIMIT 30`,
    [req.userId, `%${q}%`]
  );
  res.json({
    users: rows.map((r) => ({ ...mapAuthor(r), isFollowing: r.is_following })),
  });
});

const updateSchema = z.object({
  displayName: z.string().trim().max(50).optional(),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});

/** Update the caller's own profile. */
profilesRouter.put('/me', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid' });
    return;
  }
  const { displayName, bio, avatarUrl } = parsed.data;
  await pool.query(
    `UPDATE users SET
       display_name = COALESCE($2, display_name),
       bio          = COALESCE($3, bio),
       avatar_url   = CASE WHEN $4::boolean THEN $5 ELSE avatar_url END
     WHERE id = $1`,
    [
      req.userId,
      displayName ?? null,
      bio ?? null,
      avatarUrl !== undefined, // whether the client intends to set avatar
      avatarUrl ?? null,
    ]
  );
  res.json({ ok: true });
});

/** A user's public profile. Must come after the literal routes above. */
profilesRouter.get('/:username', requireAuth, async (req, res) => {
  const username = String(req.params.username).toLowerCase();
  const { rows } = await pool.query<ProfileRow>(
    `${PROFILE_SELECT} WHERE u.username = $2`,
    [req.userId, username]
  );
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.json({ profile: mapProfile(row, req.userId!) });
});

// --- Follow graph ----------------------------------------------------------

async function userByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users WHERE username = $1`,
    [username.toLowerCase()]
  );
  return rows[0] ?? null;
}

profilesRouter.post('/:username/follow', requireAuth, async (req, res) => {
  const target = await userByUsername(String(req.params.username));
  if (!target) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  if (target.id === req.userId) {
    res.status(400).json({ error: "can't follow yourself" });
    return;
  }
  const inserted = await pool.query(
    `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [req.userId, target.id]
  );
  if ((inserted.rowCount ?? 0) > 0) {
    const me = (
      await pool.query<UserRow>(`SELECT username FROM users WHERE id = $1`, [
        req.userId,
      ])
    ).rows[0];
    await sendPush(target.push_token, `${me?.username} followed you`, '👤', {
      type: 'follow',
    });
  }
  res.json({ ok: true, isFollowing: true });
});

profilesRouter.delete('/:username/follow', requireAuth, async (req, res) => {
  const target = await userByUsername(String(req.params.username));
  if (!target) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  await pool.query(
    `DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`,
    [req.userId, target.id]
  );
  res.json({ ok: true, isFollowing: false });
});

/** Followers / following lists (brief user cards). */
async function relatedUsers(
  username: string,
  direction: 'followers' | 'following',
  viewerId: string
) {
  // followers: u is the follower, target is the followee.
  // following: u is the followee, target is the follower.
  const edge =
    direction === 'followers'
      ? { listed: 'f.follower_id', target: 'f.followee_id' }
      : { listed: 'f.followee_id', target: 'f.follower_id' };
  const { rows } = await pool.query<AuthorJoin & { is_following: boolean }>(
    `SELECT u.id AS author_id, u.username, u.display_name, u.avatar_url, u.is_verified,
            EXISTS(SELECT 1 FROM follows ff
                    WHERE ff.followee_id = u.id AND ff.follower_id = $2) AS is_following
       FROM follows f
       JOIN users u ON u.id = ${edge.listed}
      WHERE ${edge.target} = (SELECT id FROM users WHERE username = $1)
      ORDER BY u.username ASC
      LIMIT 200`,
    [username.toLowerCase(), viewerId]
  );
  return rows.map((r) => ({ ...mapAuthor(r), isFollowing: r.is_following }));
}

profilesRouter.get('/:username/followers', requireAuth, async (req, res) => {
  res.json({
    users: await relatedUsers(String(req.params.username), 'followers', req.userId!),
  });
});

profilesRouter.get('/:username/following', requireAuth, async (req, res) => {
  res.json({
    users: await relatedUsers(String(req.params.username), 'following', req.userId!),
  });
});
