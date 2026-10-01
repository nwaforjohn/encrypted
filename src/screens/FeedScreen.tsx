import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { useFeedStore } from '@/store/useFeedStore';
import { useStoriesStore } from '@/store/useStoriesStore';
import { PostCard } from '@/components/PostCard';
import { FeedAd } from '@/components/FeedAd';
import { StoryTray } from '@/components/StoryTray';
import { PurchaseSheet } from '@/components/PurchaseSheet';
import { TIPS } from '@/monetization/products';
import { tipCreator } from '@/monetization/iap';
import type { Post } from '@/api/social';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Show an ad after every N posts.
const AD_INTERVAL = 5;

export function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    error,
    loadFeed,
    loadMore,
    toggleLike,
  } = useFeedStore();

  const loadStories = useStoriesStore((s) => s.load);

  const [tipTarget, setTipTarget] = useState<Post | null>(null);
  const [busySku, setBusySku] = useState<string | null>(null);

  useEffect(() => {
    void loadFeed();
    void loadStories();
  }, [loadFeed, loadStories]);

  const handleTip = async (sku: string) => {
    if (!tipTarget) return;
    try {
      setBusySku(sku);
      await tipCreator(sku, tipTarget.author.id, tipTarget.id);
      setTipTarget(null);
      Alert.alert('Thank you!', 'Your tip is on its way to the creator. 💸');
    } catch (err) {
      Alert.alert('Tip failed', String((err as Error)?.message ?? err));
    } finally {
      setBusySku(null);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={<StoryTray />}
        renderItem={({ item, index }) => (
          <>
            <PostCard
              post={item}
              onOpenProfile={(username) =>
                navigation.navigate('UserProfile', { username })
              }
              onOpenComments={(postId) =>
                navigation.navigate('PostDetail', { postId })
              }
              onToggleLike={toggleLike}
              onTip={setTipTarget}
            />
            {(index + 1) % AD_INTERVAL === 0 && <FeedAd />}
          </>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadFeed(true);
              void loadStories();
            }}
            tintColor={theme.colors.primary}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => loadMore()}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your feed is empty</Text>
            <Text style={styles.emptyText}>
              Follow people from the Discover tab, or share your first post.
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={theme.colors.primary}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
      />

      <PurchaseSheet
        visible={!!tipTarget}
        title={tipTarget ? `Tip @${tipTarget.author.username}` : 'Tip'}
        subtitle="Creators keep the tip minus a small platform fee."
        options={TIPS}
        busySku={busySku}
        onSelect={handleTip}
        onClose={() => setTipTarget(null)}
      />
    </View>
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
  empty: { alignItems: 'center', padding: 32, marginTop: 64 },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  error: { color: theme.colors.danger, marginTop: 12 },
});
