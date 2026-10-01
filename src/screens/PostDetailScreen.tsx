import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { PostCard } from '@/components/PostCard';
import { PurchaseSheet } from '@/components/PurchaseSheet';
import { TIPS } from '@/monetization/products';
import { tipCreator } from '@/monetization/iap';
import { social, type Comment, type Post } from '@/api/social';
import { useFeedStore } from '@/store/useFeedStore';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const patchFeedPost = useFeedStore((s) => s.patchPost);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [busySku, setBusySku] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          social.getPost(params.postId),
          social.comments(params.postId),
        ]);
        if (!active) return;
        setPost(p.post);
        setComments(c.comments);
      } catch (err) {
        Alert.alert('Error', String((err as Error)?.message ?? err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.postId]);

  const toggleLike = async (postId: string) => {
    if (!post) return;
    const nextLiked = !post.likedByMe;
    const optimistic = {
      ...post,
      likedByMe: nextLiked,
      likeCount: post.likeCount + (nextLiked ? 1 : -1),
    };
    setPost(optimistic);
    try {
      const res = nextLiked ? await social.like(postId) : await social.unlike(postId);
      const patched = { likedByMe: res.likedByMe, likeCount: res.likeCount };
      setPost((cur) => (cur ? { ...cur, ...patched } : cur));
      patchFeedPost(postId, patched);
    } catch {
      setPost(post); // roll back
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !post) return;
    try {
      setSending(true);
      const { comment } = await social.addComment(post.id, body);
      setComments((c) => [...c, comment]);
      setDraft('');
      const patched = { commentCount: post.commentCount + 1 };
      setPost({ ...post, ...patched });
      patchFeedPost(post.id, patched);
    } catch (err) {
      Alert.alert('Could not comment', String((err as Error)?.message ?? err));
    } finally {
      setSending(false);
    }
  };

  const handleTip = async (sku: string) => {
    if (!post) return;
    try {
      setBusySku(sku);
      await tipCreator(sku, post.author.id, post.id);
      setShowTip(false);
      Alert.alert('Thank you!', 'Your tip is on its way. 💸');
    } catch (err) {
      Alert.alert('Tip failed', String((err as Error)?.message ?? err));
    } finally {
      setBusySku(null);
    }
  };

  if (loading || !post) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <PostCard
            post={post}
            onOpenProfile={(username) =>
              navigation.navigate('UserProfile', { username })
            }
            onOpenComments={() => {}}
            onToggleLike={toggleLike}
            onTip={() => setShowTip(true)}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Pressable
              onPress={() =>
                navigation.navigate('UserProfile', { username: item.author.username })
              }
            >
              <Avatar
                username={item.author.username}
                avatarUrl={item.author.avatarUrl}
                size={32}
              />
            </Pressable>
            <View style={styles.commentBody}>
              <Text style={styles.commentText}>
                <Text style={styles.commentUser}>{item.author.username}</Text>{' '}
                {item.body}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.noComments}>No comments yet. Be the first.</Text>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment…"
          placeholderTextColor={theme.colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable onPress={send} disabled={!draft.trim() || sending}>
          <Text
            style={[styles.post, (!draft.trim() || sending) && styles.postDisabled]}
          >
            Post
          </Text>
        </Pressable>
      </View>

      <PurchaseSheet
        visible={showTip}
        title={`Tip @${post.author.username}`}
        subtitle="Creators keep the tip minus a small platform fee."
        options={TIPS}
        busySku={busySku}
        onSelect={handleTip}
        onClose={() => setShowTip(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comment: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1),
  },
  commentBody: { flex: 1, marginLeft: theme.spacing(1) },
  commentText: { color: theme.colors.text, lineHeight: 19 },
  commentUser: { fontWeight: '700' },
  noComments: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing(1),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(1),
    maxHeight: 100,
    fontSize: 15,
  },
  post: {
    color: theme.colors.primary,
    fontWeight: '700',
    paddingHorizontal: theme.spacing(1),
    fontSize: 15,
  },
  postDisabled: { opacity: 0.4 },
});
