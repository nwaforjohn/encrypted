import { Router } from 'express';
import { z } from 'zod';
import { pool, type UserRow } from '../db';
import { requireAuth } from '../auth/middleware';
import { sendPush } from '../push/expo';
import {
  AUTHOR_COLUMNS,
  mapAuthor,
  mapPost,
  type AuthorJoin,
  type PostJoin,
} from '../serialize';

export const postsRouter = Router();

/**
 * A post counts as "boosted" (eligible to appear in anyone's feed) when it is
 * a sponsored house post that hasn't expired, or a user-promoted post whose
 * promotion window is still open.
 */
const BOOST_EXPR = `(
  (p.is_sponsored AND (p.promoted_until IS NULL OR p.promoted_until > now()))
  OR (p.promoted_until IS NOT NULL AND p.promoted_until > now())
)`;

/** Build the standard post SELECT. `viewer` is the $n placeholder for the
 *  current user (used for likedByMe). */
function postSelect(viewer: string): string {
  return `
    SELECT p.id, p.author_id, p.image_url, p.caption, p.is_sponsored, p.created_at,
           ${AUTHOR_COLUMNS},
           (SELECT count(*) FROM likes l WHERE l.post_id = p.id)       AS like_count,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)    AS comment_count,
           EXISTS(SELECT 1 FROM likes l
                   WHERE l.post_id = p.id AND l.user_id = ${viewer})   AS liked_by_me,
           ${BOOST_EXPR}                                               AS is_promoted
      FROM posts p JOIN users u ON u.id = p.author_id`;
}

async function fetchPost(id: string, viewerId: string): Promise<PostJoin | null> {
  const { rows } = await pool.query<PostJoin>(
    `${postSelect('$2')} WHERE p.id = $1`,
    [id, viewerId]
  );
  return rows[0] ?? null;
}

const createSchema = z.object({
  imageUrl: z.string().url().max(2048),
  caption: z.string().max(2200).optional(),
});

/** Create a photo post. */
postsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid' });
    return;
  }
  const { imageUrl, caption } = parsed.data;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO posts (author_id, image_url, caption)
     VALUES ($1, $2, $3) RETURNING id`,
    [req.userId, imageUrl, caption ?? '']
  );
  const post = await fetchPost(rows[0].id, req.userId!);
  res.json({ post: post ? mapPost(post) : null });
});

/**
 * The home feed: posts from people the viewer follows, their own posts, and
 * any active sponsored/promoted posts. Boosted posts float to the top.
 */
postsRouter.get('/feed', requireAuth, async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));

  const { rows } = await pool.query<PostJoin>(
    `${postSelect('$1')}
      WHERE p.author_id = $1
         OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
         OR ${BOOST_EXPR}
      ORDER BY ${BOOST_EXPR} DESC, p.created_at DESC
      LIMIT $2 OFFSET $3`,
    [req.userId, limit, offset]
  );
  res.json({ posts: rows.map(mapPost) });
});

/** A single user's posts (their profile grid), newest first. */
postsRouter.get('/user/:username', requireAuth, async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 30)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));
  const username = String(req.params.username).toLowerCase();

  const { rows } = await pool.query<PostJoin>(
    `${postSelect('$1')}
      WHERE u.username = $2
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4`,
    [req.userId, username, limit, offset]
  );
  res.json({ posts: rows.map(mapPost) });
});

/** A single post. */
postsRouter.get('/:id', requireAuth, async (req, res) => {
  const post = await fetchPost(String(req.params.id), req.userId!);
  if (!post) {
    res.status(404).json({ error: 'post not found' });
    return;
  }
  res.json({ post: mapPost(post) });
});

/** Delete a post. Allowed for the author (admins can delete any post too). */
postsRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const me = (
    await pool.query<UserRow>(`SELECT is_admin FROM users WHERE id = $1`, [
      req.userId,
    ])
  ).rows[0];
  const result = await pool.query(
    `DELETE FROM posts WHERE id = $1 AND (author_id = $2 OR $3 = true)`,
    [id, req.userId, me?.is_admin ?? false]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: 'not found or not yours' });
    return;
  }
  res.json({ ok: true });
});

// --- Likes -----------------------------------------------------------------

async function likeCount(postId: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::int AS n FROM likes WHERE post_id = $1`,
    [postId]
  );
  return Number(rows[0]?.n ?? 0);
}

postsRouter.post('/:id/like', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const post = (
    await pool.query<{ author_id: string }>(
      `SELECT author_id FROM posts WHERE id = $1`,
      [id]
    )
  ).rows[0];
  if (!post) {
    res.status(404).json({ error: 'post not found' });
    return;
  }

  const inserted = await pool.query(
    `INSERT INTO likes (post_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [id, req.userId]
  );

  // Notify the author on a new like (not self-likes).
  if ((inserted.rowCount ?? 0) > 0 && post.author_id !== req.userId) {
    const author = (
      await pool.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [
        post.author_id,
      ])
    ).rows[0];
    const me = (
      await pool.query<UserRow>(`SELECT username FROM users WHERE id = $1`, [
        req.userId,
      ])
    ).rows[0];
    await sendPush(author?.push_token ?? null, `${me?.username} liked your post`, '❤️', {
      type: 'like',
      postId: id,
    });
  }

  res.json({ likedByMe: true, likeCount: await likeCount(id) });
});

postsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  await pool.query(`DELETE FROM likes WHERE post_id = $1 AND user_id = $2`, [
    id,
    req.userId,
  ]);
  res.json({ likedByMe: false, likeCount: await likeCount(id) });
});

// --- Comments --------------------------------------------------------------

interface CommentJoin extends AuthorJoin {
  id: string;
  body: string;
  created_at: string;
}

function mapComment(row: CommentJoin) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: mapAuthor(row),
  };
}

postsRouter.get('/:id/comments', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const { rows } = await pool.query<CommentJoin>(
    `SELECT c.id, c.author_id, c.body, c.created_at, ${AUTHOR_COLUMNS}
       FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC`,
    [id]
  );
  res.json({ comments: rows.map(mapComment) });
});

const commentSchema = z.object({ body: z.string().trim().min(1).max(1000) });

postsRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid comment' });
    return;
  }
  const id = String(req.params.id);
  const post = (
    await pool.query<{ author_id: string }>(
      `SELECT author_id FROM posts WHERE id = $1`,
      [id]
    )
  ).rows[0];
  if (!post) {
    res.status(404).json({ error: 'post not found' });
    return;
  }

  const inserted = (
    await pool.query<{ id: string }>(
      `INSERT INTO comments (post_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING id`,
      [id, req.userId, parsed.data.body]
    )
  ).rows[0];

  const row = (
    await pool.query<CommentJoin>(
      `SELECT c.id, c.author_id, c.body, c.created_at, ${AUTHOR_COLUMNS}
         FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.id = $1`,
      [inserted.id]
    )
  ).rows[0];

  if (post.author_id !== req.userId) {
    const author = (
      await pool.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [
        post.author_id,
      ])
    ).rows[0];
    await sendPush(
      author?.push_token ?? null,
      `${row.username} commented`,
      parsed.data.body.slice(0, 120),
      { type: 'comment', postId: id }
    );
  }

  res.json({ comment: mapComment(row) });
});

postsRouter.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  const { id, commentId } = req.params;
  // The comment's author or the post's author may delete it.
  const result = await pool.query(
    `DELETE FROM comments c
       USING posts p
      WHERE c.id = $1 AND c.post_id = $2 AND p.id = c.post_id
        AND (c.author_id = $3 OR p.author_id = $3)`,
    [commentId, id, req.userId]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: 'not found or not yours' });
    return;
  }
  res.json({ ok: true });
});
