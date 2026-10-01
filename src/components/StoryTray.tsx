import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from './Avatar';
import { useStoriesStore } from '@/store/useStoriesStore';
import { pickAndUpload } from '@/media/upload';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function StoryTray() {
  const navigation = useNavigation<Nav>();
  const groups = useStoriesStore((s) => s.groups);
  const createStory = useStoriesStore((s) => s.createStory);
  const [adding, setAdding] = useState(false);

  const addStory = async () => {
    try {
      setAdding(true);
      const result = await pickAndUpload('media');
      if (result) await createStory(result.url, result.mediaType);
    } catch (err) {
      Alert.alert('Could not add story', String((err as Error)?.message ?? err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Add your story. */}
        <Pressable style={styles.item} onPress={addStory} disabled={adding}>
          <View style={[styles.ring, styles.addRing]}>
            {adding ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={styles.plus}>＋</Text>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            Your story
          </Text>
        </Pressable>

        {groups.map((group, index) => (
          <Pressable
            key={group.author.id}
            style={styles.item}
            onPress={() => navigation.navigate('StoryViewer', { startIndex: index })}
          >
            <View style={[styles.ring, group.hasUnseen ? styles.unseen : styles.seen]}>
              <Avatar
                username={group.author.username}
                avatarUrl={group.author.avatarUrl}
                size={58}
              />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {group.author.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: theme.spacing(1), paddingVertical: theme.spacing(1) },
  item: { alignItems: 'center', width: 76 },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  unseen: { borderColor: theme.colors.primary },
  seen: { borderColor: theme.colors.border },
  addRing: {
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surface,
  },
  plus: { color: theme.colors.primary, fontSize: 28, fontWeight: '300' },
  label: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 4,
    maxWidth: 70,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
});
