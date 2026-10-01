import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { social, type UserCard } from '@/api/social';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { users } = await social.search(q);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const toggleFollow = async (user: UserCard) => {
    const next = !user.isFollowing;
    setResults((rs) =>
      rs.map((u) => (u.id === user.id ? { ...u, isFollowing: next } : u))
    );
    try {
      if (next) await social.follow(user.username);
      else await social.unfollow(user.username);
    } catch {
      setResults((rs) =>
        rs.map((u) => (u.id === user.id ? { ...u, isFollowing: !next } : u))
      );
    }
  };

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

      {loading && <ActivityIndicator color={theme.colors.primary} style={{ margin: 12 }} />}

      <FlatList
        data={results}
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
              <Text
                style={[
                  styles.followText,
                  item.isFollowing && styles.followingText,
                ]}
              >
                {item.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          query.trim() && !loading ? (
            <Text style={styles.empty}>No one found for “{query.trim()}”.</Text>
          ) : (
            <Text style={styles.empty}>Search for people to follow.</Text>
          )
        }
      />
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
  empty: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 48,
  },
});
