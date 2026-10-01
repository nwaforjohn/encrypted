import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { PurchaseSheet } from '@/components/PurchaseSheet';
import { TIPS } from '@/monetization/products';
import { tipCreator } from '@/monetization/iap';
import { social, type MyProfile, type Post, type Profile } from '@/api/social';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const paramUsername = (route.params as { username?: string } | undefined)?.username;

  const startChat = useChatStore((s) => s.startChat);
  const logout = useAuthStore((s) => s.logout);

  const [profile, setProfile] = useState<Profile | MyProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTip, setShowTip] = useState(false);
  const [busySku, setBusySku] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = paramUsername
        ? await social.profile(paramUsername)
        : await social.me();
      setProfile(res.profile);
      const { posts: userPosts } = await social.userPosts(res.profile.username);
      setPosts(userPosts);
    } catch (err) {
      Alert.alert('Error', String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [paramUsername]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleFollow = async () => {
    if (!profile || profile.isMe) return;
    const next = !profile.isFollowing;
    setProfile({
      ...profile,
      isFollowing: next,
      counts: {
        ...profile.counts,
        followers: profile.counts.followers + (next ? 1 : -1),
      },
    });
    try {
      if (next) await social.follow(profile.username);
      else await social.unfollow(profile.username);
    } catch {
      void load(); // reconcile
    }
  };

  const handleTip = async (sku: string) => {
    if (!profile) return;
    try {
      setBusySku(sku);
      await tipCreator(sku, profile.id);
      setShowTip(false);
      Alert.alert('Thank you!', 'Your tip is on its way. 💸');
    } catch (err) {
      Alert.alert('Tip failed', String((err as Error)?.message ?? err));
    } finally {
      setBusySku(null);
    }
  };

  const message = async () => {
    if (!profile) return;
    try {
      await startChat(profile.username);
      navigation.navigate('ChatRoom', {
        chatId: profile.id,
        title: profile.username,
      });
    } catch (err) {
      Alert.alert('Could not start chat', String((err as Error)?.message ?? err));
    }
  };

  const { width } = useWindowDimensions();
  const cell = width / 3;

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const isMe = profile.isMe;
  const myProfile = isMe ? (profile as MyProfile) : null;

  const Header = (
    <View>
      <View style={styles.top}>
        <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size={84} />
        <View style={styles.statsRow}>
          <Stat label="Posts" value={profile.counts.posts} />
          <Stat
            label="Followers"
            value={profile.counts.followers}
            onPress={() =>
              navigation.navigate('UserList', {
                username: profile.username,
                mode: 'followers',
              })
            }
          />
          <Stat
            label="Following"
            value={profile.counts.following}
            onPress={() =>
              navigation.navigate('UserList', {
                username: profile.username,
                mode: 'following',
              })
            }
          />
        </View>
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        {profile.isVerified && <Text style={styles.verified}>✓</Text>}
      </View>
      <Text style={styles.handle}>@{profile.username}</Text>
      {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      {/* Creator earnings (own profile only). */}
      {myProfile && (
        <View style={styles.earnings}>
          <Text style={styles.earningsLabel}>Creator balance</Text>
          <Text style={styles.earningsValue}>{money(myProfile.balanceCents)}</Text>
          <Text style={styles.earningsSub}>
            {money(myProfile.lifetimeCents)} earned from tips all-time
          </Text>
        </View>
      )}

      {/* Action buttons. */}
      {isMe ? (
        <View style={styles.actionsCol}>
          <View style={styles.actionsRow}>
            <ActionButton
              label="Edit profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <ActionButton label="Go Pro ⭐" onPress={() => navigation.navigate('Store')} />
          </View>
          <View style={styles.actionsRow}>
            {profile.isAdmin && (
              <ActionButton
                label="💰 Revenue"
                highlight
                onPress={() => navigation.navigate('AdminRevenue')}
              />
            )}
            <ActionButton label="Settings" onPress={() => navigation.navigate('Settings')} />
          </View>
          <Pressable onPress={() => logout()}>
            <Text style={styles.logout}>Log out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <ActionButton
            label={profile.isFollowing ? 'Following' : 'Follow'}
            highlight={!profile.isFollowing}
            onPress={toggleFollow}
          />
          <ActionButton label="Message" onPress={message} />
          <ActionButton label="Tip 💸" onPress={() => setShowTip(true)} />
        </View>
      )}

      <View style={styles.gridDivider} />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={3}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: cell, height: cell, backgroundColor: theme.colors.surfaceAlt }}
            />
            {item.mediaType === 'video' && <Text style={styles.videoBadge}>▶</Text>}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.noPosts}>No posts yet.</Text>
        }
      />

      <PurchaseSheet
        visible={showTip}
        title={`Tip @${profile.username}`}
        subtitle="Creators keep the tip minus a small platform fee."
        options={TIPS}
        busySku={busySku}
        onSelect={handleTip}
        onClose={() => setShowTip(false)}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  highlight,
}: {
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      style={[styles.actionBtn, highlight && styles.actionBtnHighlight]}
      onPress={onPress}
    >
      <Text style={[styles.actionText, highlight && styles.actionTextHighlight]}>
        {label}
      </Text>
    </Pressable>
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing(2),
  },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: theme.colors.textMuted, fontSize: 12 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(2),
  },
  displayName: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  verified: { color: theme.colors.link, fontWeight: '900', marginLeft: 6 },
  handle: {
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing(2),
    marginTop: 2,
  },
  bio: {
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(2),
    marginTop: theme.spacing(1),
    lineHeight: 19,
  },
  earnings: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing(2),
    marginBottom: 0,
    borderRadius: theme.radius.md,
    padding: theme.spacing(1.5),
  },
  earningsLabel: { color: theme.colors.textMuted, fontSize: 12 },
  earningsValue: {
    color: theme.colors.gold,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  earningsSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  actionsCol: { padding: theme.spacing(2), gap: theme.spacing(1) },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing(1),
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  actionBtn: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    paddingVertical: theme.spacing(1),
  },
  actionBtnHighlight: { backgroundColor: theme.colors.primary },
  actionText: { color: theme.colors.text, fontWeight: '600' },
  actionTextHighlight: { color: '#fff' },
  logout: {
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: theme.spacing(1),
  },
  gridDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing(2),
  },
  noPosts: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    color: '#fff',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
});
