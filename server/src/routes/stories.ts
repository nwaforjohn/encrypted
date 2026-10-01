import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../auth/middleware';
import { AUTHOR_COLUMNS, mapAuthor, type AuthorJoin } from '../serialize';

export const storiesRouter = Router();

interface StoryJoin extends AuthorJoin {
  id: string;
  image_url: string;
  media_type: string;
  created_at: string;
  seen_by_me: boolean;
}

const createSchema = z.object({
  imageUrl: z.string().url().max(2048),
  mediaType: z.enum(['image', 'video']).optional(),
});

/** Post a story (image or video; expires 24h later, per the schema default). */
storiesRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid' });
    return;
  }
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO stories (author_id, image_url, media_type) VALUES ($1, $2, $3) RETURNING id`,
    [req.userId, parsed.data.imageUrl, parsed.data.mediaType ?? 'image']
  );
  res.json({ id: rows[0].id });
});

/**
 * Active stories from the viewer and people they follow, grouped by author.
 * Groups are ordered: the viewer's own first, then groups with unseen stories,
 * then by most recent story.
 */
storiesRouter.get('/', requireAuth, async (req, res) => {
  const me = req.userId!;
  const { rows } = await pool.query<StoryJoin>(
    `SELECT s.id, s.author_id, s.image_url, s.media_type, s.created_at, ${AUTHOR_COLUMNS},
            EXISTS(SELECT 1 FROM story_views v
                    WHERE v.story_id = s.id AND v.user_id = $1) AS seen_by_me
       FROM stories s JOIN users u ON u.id = s.author_id
      WHERE s.expires_at > now()
        AND (s.author_id = $1
             OR s.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1))
      ORDER BY s.created_at ASC`,
    [me]
  );

  // Group by author, preserving chronological story order within a group.
  const groupsByAuthor = new Map<
    string,
    {
      author: ReturnType<typeof mapAuthor>;
      stories: Array<{
        id: string;
        imageUrl: string;
        mediaType: 'image' | 'video';
        createdAt: string;
        seenByMe: boolean;
      }>;
      hasUnseen: boolean;
      latest: string;
    }
  >();

  for (const r of rows) {
    let group = groupsByAuthor.get(r.author_id);
    if (!group) {
      group = {
        author: mapAuthor(r),
        stories: [],
        hasUnseen: false,
        latest: r.created_at,
      };
      groupsByAuthor.set(r.author_id, group);
    }
    group.stories.push({
      id: r.id,
      imageUrl: r.image_url,
      mediaType: r.media_type === 'video' ? 'video' : 'image',
      createdAt: r.created_at,
      seenByMe: r.seen_by_me,
    });
    if (!r.seen_by_me) group.hasUnseen = true;
    if (r.created_at > group.latest) group.latest = r.created_at;
  }

  const groups = Array.from(groupsByAuthor.values()).sort((a, b) => {
    const aMine = a.author.id === me ? 1 : 0;
    const bMine = b.author.id === me ? 1 : 0;
    if (aMine !== bMine) return bMine - aMine; // own first
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1; // unseen first
    return a.latest < b.latest ? 1 : -1; // most recent first
  });

  res.json({ groups });
});

/** Mark a story seen. */
storiesRouter.post('/:id/view', requireAuth, async (req, res) => {
  await pool.query(
    `INSERT INTO story_views (story_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [String(req.params.id), req.userId]
  );
  res.json({ ok: true });
});
