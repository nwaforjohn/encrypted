import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { social, type Post, type UserCard } from '@/api/social';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const cell = width / 3;

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(true);

  // Explore grid.
  useEffect(() => {
    social
      .explore()
      .then((r) => setPosts(r.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoadingGrid(false));
  }, []);

  // Debounced people search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setUsers([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const { users: found } = await social.search(q);
        setUsers(found);
      } catch {
        setUsers([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const toggleFollow = async (user: UserCard) => {
    const next = !user.isFollowing;
    setUsers((rs) => rs.map((u) => (u.id === user.id ? { ...u, isFollowing: next } : u)));
    try {
      if (next) await social.follow(user.username);
      else await social.unfollow(user.username);
    } catch {
      setUsers((rs) =>
        rs.map((u) => (u.id === user.id ? { ...u, isFollowing: !next } : u))
      );
    }
  };

  const searchActive = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search people"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {searchActive ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={styles.rowUser}
                onPress={() =>
                  navigation.navigate('UserProfile', { username: item.username })
                }
              >
                <Avatar username={item.username} avatarUrl={item.avatarUrl} size={44} />
                <View style={styles.rowText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.username}>{item.username}</Text>
                    {item.isVerified && <Text style={styles.verified}>✓</Text>}
                  </View>
                  <Text style={styles.displayName}>{item.displayName}</Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
                onPress={() => toggleFollow(item)}
              >
                <Text style={[styles.followText, item.isFollowing && styles.followingText]}>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            !searching ? (
              <Text style={styles.empty}>No one found for “{query.trim()}”.</Text>
            ) : null
          }
        />
      ) : loadingGrid ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          numColumns={3}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: cell, height: cell, backgroundColor: theme.colors.surfaceAlt }}
              />
              {item.mediaType === 'video' && (
                <Text style={styles.videoBadge}>▶</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing to explore yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  searchWrap: { padding: theme.spacing(1.5) },
  search: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  rowUser: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowText: { marginLeft: theme.spacing(1.5) },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { color: theme.colors.text, fontWeight: '600', fontSize: 15 },
  verified: { color: theme.colors.link, fontWeight: '900', marginLeft: 4 },
  displayName: { color: theme.colors.textMuted, fontSize: 13, marginTop: 1 },
  followBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(0.75),
  },
  followingBtn: { backgroundColor: theme.colors.surfaceAlt },
  followText: { color: '#fff', fontWeight: '700' },
  followingText: { color: theme.colors.text },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    color: '#fff',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 48 },
});
