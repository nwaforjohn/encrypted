import { api } from './client';

/**
 * Typed wrappers over the social + revenue backend. The shapes mirror the
 * server's wire types (server/src/serialize.ts and the route modules).
 */

export interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export type MediaType = 'image' | 'video';

export interface Post {
  id: string;
  imageUrl: string;
  mediaType: MediaType;
  caption: string;
  createdAt: string;
  isSponsored: boolean;
  isPromoted: boolean;
  author: Author;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
}

export interface ProfileCounts {
  posts: number;
  followers: number;
  following: number;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  isMe: boolean;
  isFollowing: boolean;
  counts: ProfileCounts;
}

export interface MyProfile extends Profile {
  balanceCents: number;
  lifetimeCents: number;
}

export interface UserCard extends Author {
  isFollowing: boolean;
}

export interface Story {
  id: string;
  imageUrl: string;
  mediaType: MediaType;
  createdAt: string;
  seenByMe: boolean;
}

export interface StoryGroup {
  author: Author;
  stories: Story[];
  hasUnseen: boolean;
}

export interface RevenueSummary {
  currency: string;
  totals: {
    promotionCents: number;
    subscriptionCents: number;
    tipCutCents: number;
    estimatedAdCents: number;
    allCents: number;
  };
  adImpressions: number;
  platformCutPercent: number;
  counts: {
    users: number;
    posts: number;
    tips: number;
    active_promotions: number;
    subscribers: number;
  };
  recent: Array<{
    source: string;
    amountCents: number;
    ref: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

// --- Posts / feed ----------------------------------------------------------

export const social = {
  feed: (offset = 0, limit = 20) =>
    api.get<{ posts: Post[] }>(`/posts/feed?offset=${offset}&limit=${limit}`),

  explore: (offset = 0, limit = 30) =>
    api.get<{ posts: Post[] }>(`/posts/explore?offset=${offset}&limit=${limit}`),

  userPosts: (username: string, offset = 0, limit = 30) =>
    api.get<{ posts: Post[] }>(
      `/posts/user/${encodeURIComponent(username)}?offset=${offset}&limit=${limit}`
    ),

  getPost: (id: string) => api.get<{ post: Post }>(`/posts/${id}`),

  createPost: (imageUrl: string, caption: string, mediaType: MediaType = 'image') =>
    api.post<{ post: Post }>('/posts', { imageUrl, caption, mediaType }),

  deletePost: (id: string) => api.delete<{ ok: boolean }>(`/posts/${id}`),

  like: (id: string) =>
    api.post<{ likedByMe: boolean; likeCount: number }>(`/posts/${id}/like`),

  unlike: (id: string) =>
    api.delete<{ likedByMe: boolean; likeCount: number }>(`/posts/${id}/like`),

  comments: (id: string) =>
    api.get<{ comments: Comment[] }>(`/posts/${id}/comments`),

  addComment: (id: string, body: string) =>
    api.post<{ comment: Comment }>(`/posts/${id}/comments`, { body }),

  // --- Profiles / follow ---------------------------------------------------

  me: () => api.get<{ profile: MyProfile }>('/profiles/me'),

  profile: (username: string) =>
    api.get<{ profile: Profile }>(`/profiles/${encodeURIComponent(username)}`),

  updateMe: (data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
  }) => api.put<{ ok: boolean }>('/profiles/me', data),

  search: (q: string) =>
    api.get<{ users: UserCard[] }>(`/profiles/search?q=${encodeURIComponent(q)}`),

  follow: (username: string) =>
    api.post<{ ok: boolean; isFollowing: boolean }>(
      `/profiles/${encodeURIComponent(username)}/follow`
    ),

  unfollow: (username: string) =>
    api.delete<{ ok: boolean; isFollowing: boolean }>(
      `/profiles/${encodeURIComponent(username)}/follow`
    ),

  followers: (username: string) =>
    api.get<{ users: UserCard[] }>(
      `/profiles/${encodeURIComponent(username)}/followers`
    ),

  following: (username: string) =>
    api.get<{ users: UserCard[] }>(
      `/profiles/${encodeURIComponent(username)}/following`
    ),

  // --- Stories -------------------------------------------------------------

  stories: () => api.get<{ groups: StoryGroup[] }>('/stories'),

  createStory: (imageUrl: string, mediaType: MediaType = 'image') =>
    api.post<{ id: string }>('/stories', { imageUrl, mediaType }),

  viewStory: (id: string) =>
    api.post<{ ok: boolean }>(`/stories/${id}/view`).catch(() => undefined),

  // --- Ads / admin ---------------------------------------------------------

  logImpression: (placement: string) =>
    api.post<{ ok: boolean }>('/ads/impression', { placement }).catch(() => undefined),

  revenue: () => api.get<RevenueSummary>('/admin/revenue'),

  createSponsored: (data: {
    imageUrl: string;
    caption?: string;
    mediaType?: MediaType;
    hours?: number;
    amountCents?: number;
  }) => api.post<{ ok: boolean; postId: string }>('/admin/sponsored', data),
};
