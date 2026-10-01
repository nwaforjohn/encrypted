/**
 * Shared wire shapes for the social API, plus mappers from joined DB rows.
 * Keeping these in one place means posts, comments and profiles all describe
 * an author the same way.
 */

export interface WireAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

/** A row that carries the joined author columns (aliased as below). */
export interface AuthorJoin {
  author_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

export function mapAuthor(row: AuthorJoin): WireAuthor {
  return {
    id: row.author_id,
    username: row.username,
    displayName: row.display_name ?? row.username,
    avatarUrl: row.avatar_url,
    isVerified: row.is_verified,
  };
}

export type MediaType = 'image' | 'video';

export interface WirePost {
  id: string;
  imageUrl: string;
  mediaType: MediaType;
  caption: string;
  createdAt: string;
  isSponsored: boolean;
  isPromoted: boolean;
  author: WireAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

/** The SELECT list of author columns every post/comment query joins in. */
export const AUTHOR_COLUMNS = `
  u.username, u.display_name, u.avatar_url, u.is_verified`;

export interface PostJoin extends AuthorJoin {
  id: string;
  image_url: string;
  media_type: string;
  caption: string;
  is_sponsored: boolean;
  created_at: string;
  like_count: string | number;
  comment_count: string | number;
  liked_by_me: boolean;
  is_promoted: boolean;
}

export function mapPost(row: PostJoin): WirePost {
  return {
    id: row.id,
    imageUrl: row.image_url,
    mediaType: row.media_type === 'video' ? 'video' : 'image',
    caption: row.caption,
    createdAt: row.created_at,
    isSponsored: row.is_sponsored,
    isPromoted: row.is_promoted,
    author: mapAuthor(row),
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    likedByMe: row.liked_by_me,
  };
}
