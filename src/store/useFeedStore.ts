import { create } from 'zustand';
import { social, type Post } from '@/api/social';

/**
 * Home-feed state. Keeps the post list, handles pagination, and applies
 * optimistic like toggles so the heart responds instantly (reconciled with the
 * server's authoritative count on response).
 */

const PAGE = 20;

interface FeedState {
  posts: Post[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  reachedEnd: boolean;
  error: string | null;

  loadFeed: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  prependPost: (post: Post) => void;
  patchPost: (postId: string, patch: Partial<Post>) => void;
  removePost: (postId: string) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  reachedEnd: false,
  error: null,

  loadFeed: async (refresh = false) => {
    set(refresh ? { refreshing: true } : { loading: true });
    try {
      const { posts } = await social.feed(0, PAGE);
      set({
        posts,
        reachedEnd: posts.length < PAGE,
        error: null,
      });
    } catch (err) {
      set({ error: (err as Error)?.message ?? 'Could not load feed' });
    } finally {
      set({ loading: false, refreshing: false });
    }
  },

  loadMore: async () => {
    const { loadingMore, reachedEnd, posts } = get();
    if (loadingMore || reachedEnd) return;
    set({ loadingMore: true });
    try {
      const { posts: next } = await social.feed(posts.length, PAGE);
      // Keep only posts we don't already have (sponsored posts can repeat).
      const seen = new Set(posts.map((p) => p.id));
      const fresh = next.filter((p) => !seen.has(p.id));
      set({
        posts: [...posts, ...fresh],
        reachedEnd: next.length < PAGE,
      });
    } catch {
      // Keep what we have; the user can pull to refresh.
    } finally {
      set({ loadingMore: false });
    }
  },

  toggleLike: async (postId) => {
    const current = get().posts.find((p) => p.id === postId);
    if (!current) return;
    const nextLiked = !current.likedByMe;

    // Optimistic update.
    get().patchPost(postId, {
      likedByMe: nextLiked,
      likeCount: current.likeCount + (nextLiked ? 1 : -1),
    });

    try {
      const res = nextLiked
        ? await social.like(postId)
        : await social.unlike(postId);
      get().patchPost(postId, {
        likedByMe: res.likedByMe,
        likeCount: res.likeCount,
      });
    } catch {
      // Roll back on failure.
      get().patchPost(postId, {
        likedByMe: current.likedByMe,
        likeCount: current.likeCount,
      });
    }
  },

  prependPost: (post) => set({ posts: [post, ...get().posts] }),

  patchPost: (postId, patch) =>
    set({
      posts: get().posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    }),

  removePost: (postId) =>
    set({ posts: get().posts.filter((p) => p.id !== postId) }),
}));
