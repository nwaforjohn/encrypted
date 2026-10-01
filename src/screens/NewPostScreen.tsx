import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { theme } from '@/theme';
import { social, type MediaType } from '@/api/social';
import { useFeedStore } from '@/store/useFeedStore';
import { PurchaseSheet } from '@/components/PurchaseSheet';
import { MediaView } from '@/components/MediaView';
import { PROMOTIONS } from '@/monetization/products';
import { promotePost } from '@/monetization/iap';
import { pickAndUpload } from '@/media/upload';
import type { TabParamList } from '@/navigation/types';

type Nav = BottomTabNavigationProp<TabParamList>;

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/.+/i.test(s.trim());
}

export function NewPostScreen() {
  const navigation = useNavigation<Nav>();
  const prependPost = useFeedStore((s) => s.prependPost);

  const [imageUrl, setImageUrl] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [promotePostId, setPromotePostId] = useState<string | null>(null);
  const [busySku, setBusySku] = useState<string | null>(null);

  const canPost = looksLikeUrl(imageUrl) && !busy && !uploading;

  const reset = () => {
    setImageUrl('');
    setMediaType('image');
    setCaption('');
  };

  const choose = async () => {
    try {
      setUploading(true);
      const result = await pickAndUpload('media');
      if (result) {
        setImageUrl(result.url);
        setMediaType(result.mediaType);
      }
    } catch (err) {
      Alert.alert('Upload failed', String((err as Error)?.message ?? err));
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!canPost) return;
    try {
      setBusy(true);
      const { post } = await social.createPost(imageUrl.trim(), caption.trim(), mediaType);
      prependPost(post);
      reset();
      Alert.alert('Posted!', 'Your photo is live. Want more reach?', [
        { text: 'Not now', style: 'cancel', onPress: () => navigation.navigate('Feed') },
        { text: 'Promote', onPress: () => setPromotePostId(post.id) },
      ]);
    } catch (err) {
      Alert.alert('Could not post', String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async (sku: string) => {
    if (!promotePostId) return;
    try {
      setBusySku(sku);
      await promotePost(sku, promotePostId);
      setPromotePostId(null);
      Alert.alert('Boosting!', 'Your post will be promoted across feeds.');
      navigation.navigate('Feed');
    } catch (err) {
      Alert.alert('Promotion failed', String((err as Error)?.message ?? err));
    } finally {
      setBusySku(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.preview}>
          {looksLikeUrl(imageUrl) ? (
            <MediaView
              uri={imageUrl}
              mediaType={mediaType}
              style={styles.previewImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.previewHint}>Photo / video preview</Text>
          )}
        </View>

        <Pressable style={styles.chooseBtn} onPress={choose} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text style={styles.chooseText}>📷  Choose photo or video</Text>
          )}
        </Pressable>

        <Text style={styles.label}>…or paste a media URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://…"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={imageUrl}
          onChangeText={(t) => {
            setImageUrl(t);
            setMediaType('image');
          }}
        />
        <Text style={styles.note}>
          Pick from your library to upload a photo or a short video, or paste a
          public link.
        </Text>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={[styles.input, styles.caption]}
          placeholder="Write a caption…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          value={caption}
          onChangeText={setCaption}
          maxLength={2200}
        />

        <Pressable
          style={[styles.button, !canPost && styles.buttonDisabled]}
          onPress={handlePost}
          disabled={!canPost}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Share</Text>
          )}
        </Pressable>
      </ScrollView>

      <PurchaseSheet
        visible={!!promotePostId}
        title="Promote your post"
        subtitle="Boost it to the top of everyone's feed."
        options={PROMOTIONS}
        busySku={busySku}
        onSelect={handlePromote}
        onClose={() => {
          setPromotePostId(null);
          navigation.navigate('Feed');
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2) },
  preview: {
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
  },
  previewImg: { width: '100%', height: '100%' },
  previewHint: { color: theme.colors.textMuted },
  chooseBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.primary,
  },
  chooseText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: theme.spacing(1),
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    fontSize: 15,
  },
  caption: { minHeight: 90, textAlignVertical: 'top' },
  note: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing(1.5),
    marginTop: theme.spacing(3),
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
