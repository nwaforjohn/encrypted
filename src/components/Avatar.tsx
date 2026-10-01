import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

const PALETTE = ['#00A884', '#6A5ACD', '#E0794B', '#4FA8E0', '#C0617D', '#5AA469'];

export function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/** Circular avatar: shows the image if present, else a colored initial. */
export function Avatar({
  username,
  avatarUrl,
  size = 40,
}: {
  username: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const radius = size / 2;
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: theme.colors.surfaceAlt }}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: colorFor(username) },
      ]}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>
        {username[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
