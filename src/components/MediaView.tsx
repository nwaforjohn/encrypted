import React from 'react';
import { Image, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import type { MediaType } from '@/api/social';

/**
 * Renders a post/story's media: a plain Image for photos, or an expo-av Video
 * for videos. For videos, `useControls` shows native playback controls;
 * `shouldPlay` + `isMuted` enable silent autoplay (e.g. in the story viewer).
 */
export function MediaView({
  uri,
  mediaType,
  style,
  resizeMode = 'cover',
  useControls = true,
  shouldPlay = false,
  isMuted = false,
  isLooping = false,
}: {
  uri: string;
  mediaType: MediaType;
  style: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  useControls?: boolean;
  shouldPlay?: boolean;
  isMuted?: boolean;
  isLooping?: boolean;
}) {
  if (mediaType === 'video') {
    return (
      <Video
        source={{ uri }}
        style={style}
        resizeMode={resizeMode === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
        useNativeControls={useControls}
        shouldPlay={shouldPlay}
        isMuted={isMuted}
        isLooping={isLooping}
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style as StyleProp<ImageStyle>}
      resizeMode={resizeMode}
    />
  );
}
