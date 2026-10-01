import { create } from 'zustand';
import { social, type MediaType, type StoryGroup } from '@/api/social';

/**
 * Stories state. Holds the grouped, ordered story rail shown atop the feed and
 * consumed by the full-screen viewer.
 */
interface StoriesState {
  groups: StoryGroup[];
  loading: boolean;
  load: () => Promise<void>;
  markSeen: (storyId: string) => void;
  createStory: (imageUrl: string, mediaType: MediaType) => Promise<void>;
}

export const useStoriesStore = create<StoriesState>((set, get) => ({
  groups: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const { groups } = await social.stories();
      set({ groups });
    } catch {
      // Keep whatever we had.
    } finally {
      set({ loading: false });
    }
  },

  markSeen: (storyId) => {
    // Optimistically flag the story seen and recompute the group's ring; also
    // tell the server (fire-and-forget).
    void social.viewStory(storyId);
    set({
      groups: get().groups.map((g) => {
        if (!g.stories.some((s) => s.id === storyId)) return g;
        const stories = g.stories.map((s) =>
          s.id === storyId ? { ...s, seenByMe: true } : s
        );
        return { ...g, stories, hasUnseen: stories.some((s) => !s.seenByMe) };
      }),
    });
  },

  createStory: async (imageUrl, mediaType) => {
    await social.createStory(imageUrl, mediaType);
    await get().load();
  },
}));
