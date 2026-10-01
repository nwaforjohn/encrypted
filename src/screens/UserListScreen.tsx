import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { social, type UserCard } from '@/api/social';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'UserList'>;

export function UserListScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [users, setUsers] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: params.mode === 'followers' ? 'Followers' : 'Following',
    });
  }, [navigation, params.mode]);

  useEffect(() => {
    (async () => {
      try {
        const res =
          params.mode === 'followers'
            ? await social.followers(params.username)
            : await social.following(params.username);
        setUsers(res.users);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.username, params.mode]);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
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
              <Text style={styles.username}>{item.username}</Text>
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
      ListEmptyComponent={<Text style={styles.empty}>Nobody here yet.</Text>}
    />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  rowUser: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowText: { marginLeft: theme.spacing(1.5) },
  username: { color: theme.colors.text, fontWeight: '600', fontSize: 15 },
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
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 48 },
});
