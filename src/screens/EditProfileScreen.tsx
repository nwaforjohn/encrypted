import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { social } from '@/api/social';
import { pickAndUpload } from '@/media/upload';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function EditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { profile } = await social.me();
        setUsername(profile.username);
        setDisplayName(profile.displayName);
        setBio(profile.bio);
        setAvatarUrl(profile.avatarUrl ?? '');
      } catch (err) {
        Alert.alert('Error', String((err as Error)?.message ?? err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const chooseAvatar = async () => {
    try {
      setUploading(true);
      const result = await pickAndUpload('image', { square: true });
      if (result) setAvatarUrl(result.url);
    } catch (err) {
      Alert.alert('Upload failed', String((err as Error)?.message ?? err));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      await social.updateMe({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(2) }}>
      <View style={styles.avatarWrap}>
        <Avatar username={username} avatarUrl={avatarUrl || null} size={88} />
        <Pressable style={styles.changePhoto} onPress={chooseAvatar} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text style={styles.changePhotoText}>Change photo</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.label}>Avatar URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://…"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={avatarUrl}
        onChangeText={setAvatarUrl}
      />

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor={theme.colors.textMuted}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={50}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bio]}
        placeholder="Tell people about yourself"
        placeholderTextColor={theme.colors.textMuted}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={300}
      />

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </Pressable>
    </ScrollView>
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
  avatarWrap: { alignItems: 'center', marginBottom: theme.spacing(2) },
  changePhoto: { marginTop: theme.spacing(1) },
  changePhotoText: { color: theme.colors.primary, fontWeight: '700' },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: theme.spacing(1.5),
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    fontSize: 15,
  },
  bio: { minHeight: 90, textAlignVertical: 'top' },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing(1.5),
    marginTop: theme.spacing(3),
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
