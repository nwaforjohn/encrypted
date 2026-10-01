import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { MediaView } from '@/components/MediaView';
import { useStoriesStore } from '@/store/useStoriesStore';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'StoryViewer'>;

const IMAGE_MS = 5000;
const VIDEO_MS = 20000;

function timeAgo(iso: string): string {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function StoryViewerScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const groups = useStoriesStore((s) => s.groups);
  const markSeen = useStoriesStore((s) => s.markSeen);

  const [groupIndex, setGroupIndex] = useState(params.startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const { width, height } = useWindowDimensions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const close = () => navigation.goBack();

  const next = () => {
    if (!group) return close();
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      close();
    }
  };

  const prev = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const g = groupIndex - 1;
      setGroupIndex(g);
      setStoryIndex(Math.max(0, groups[g].stories.length - 1));
    }
  };

  // Guard against an empty / out-of-range entry.
  useEffect(() => {
    if (!group || !story) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, story]);

  // Mark seen + arm the auto-advance timer whenever the current story changes.
  useEffect(() => {
    if (!story) return;
    markSeen(story.id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      next,
      story.mediaType === 'video' ? VIDEO_MS : IMAGE_MS
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  if (!group || !story) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <MediaView
        uri={story.imageUrl}
        mediaType={story.mediaType}
        style={{ width, height }}
        resizeMode="contain"
        useControls={false}
        shouldPlay
        isMuted={false}
      />

      {/* Progress segments. */}
      <View style={styles.progressRow} pointerEvents="none">
        {group.stories.map((s, i) => (
          <View key={s.id} style={styles.segment}>
            <View
              style={[
                styles.segmentFill,
                { width: i <= storyIndex ? '100%' : '0%' },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header. */}
      <View style={styles.header} pointerEvents="box-none">
        <Avatar
          username={group.author.username}
          avatarUrl={group.author.avatarUrl}
          size={32}
        />
        <Text style={styles.username}>{group.author.username}</Text>
        <Text style={styles.time}>{timeAgo(story.createdAt)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={close} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {/* Tap zones: left = previous, right = next. */}
      <View style={styles.tapRow} pointerEvents="box-none">
        <Pressable style={styles.tapZone} onPress={prev} />
        <Pressable style={styles.tapZone} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressRow: {
    position: 'absolute',
    top: 44,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  segmentFill: { height: 3, backgroundColor: '#fff' },
  header: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  time: { color: 'rgba(255,255,255,0.7)', marginLeft: 8, fontSize: 12 },
  close: { color: '#fff', fontSize: 22, fontWeight: '600' },
  tapRow: { position: 'absolute', top: 100, bottom: 0, left: 0, right: 0, flexDirection: 'row' },
  tapZone: { flex: 1 },
});
