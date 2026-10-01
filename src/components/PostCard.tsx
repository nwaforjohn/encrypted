import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { theme } from '@/theme';
import { Avatar } from './Avatar';
import type { Post } from '@/api/social';

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export interface PostCardProps {
  post: Post;
  onOpenProfile: (username: string) => void;
  onOpenComments: (postId: string) => void;
  onToggleLike: (postId: string) => void;
  onTip: (post: Post) => void;
}

export function PostCard({
  post,
  onOpenProfile,
  onOpenComments,
  onToggleLike,
  onTip,
}: PostCardProps) {
  const { width } = useWindowDimensions();
  const { author } = post;
  const boosted = post.isSponsored || post.isPromoted;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerUser}
          onPress={() => onOpenProfile(author.username)}
        >
          <Avatar username={author.username} avatarUrl={author.avatarUrl} size={36} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>{author.username}</Text>
              {author.isVerified && <Text style={styles.verified}>✓</Text>}
            </View>
            {boosted && (
              <Text style={styles.sponsored}>
                {post.isSponsored ? 'Sponsored' : 'Promoted'}
              </Text>
            )}
          </View>
        </Pressable>
      </View>

      <Image
        source={{ uri: post.imageUrl }}
        style={{ width, height: width, backgroundColor: theme.colors.surfaceAlt }}
        resizeMode="cover"
      />

      <View style={styles.actions}>
        <Pressable onPress={() => onToggleLike(post.id)} hitSlop={8}>
          <Text style={[styles.icon, post.likedByMe && styles.iconLiked]}>
            {post.likedByMe ? '♥' : '♡'}
          </Text>
        </Pressable>
        <Pressable onPress={() => onOpenComments(post.id)} hitSlop={8}>
          <Text style={styles.icon}>💬</Text>
        </Pressable>
        <Pressable onPress={() => onTip(post)} hitSlop={8}>
          <Text style={styles.icon}>💸</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {post.likeCount > 0 && (
          <Text style={styles.likes}>
            {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
          </Text>
        )}
        {!!post.caption && (
          <Text style={styles.caption}>
            <Text
              style={styles.captionUser}
              onPress={() => onOpenProfile(author.username)}
            >
              {author.username}
            </Text>{' '}
            {post.caption}
          </Text>
        )}
        {post.commentCount > 0 && (
          <Pressable onPress={() => onOpenComments(post.id)}>
            <Text style={styles.viewComments}>
              View {post.commentCount === 1 ? '1 comment' : `all ${post.commentCount} comments`}
            </Text>
          </Pressable>
        )}
        <Text style={styles.time}>{timeAgo(post.createdAt)} ago</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.bg, marginBottom: theme.spacing(1) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1),
  },
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerText: { marginLeft: theme.spacing(1) },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  verified: {
    color: theme.colors.link,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 4,
  },
  sponsored: { color: theme.colors.sponsor, fontSize: 11, marginTop: 1 },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(1),
  },
  icon: { fontSize: 24, color: theme.colors.text },
  iconLiked: { color: theme.colors.like },
  body: { paddingHorizontal: theme.spacing(1.5), paddingTop: theme.spacing(0.5) },
  likes: { color: theme.colors.text, fontWeight: '700', marginTop: 4 },
  caption: { color: theme.colors.text, marginTop: 4, lineHeight: 19 },
  captionUser: { fontWeight: '700' },
  viewComments: { color: theme.colors.textMuted, marginTop: 4 },
  time: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
});
