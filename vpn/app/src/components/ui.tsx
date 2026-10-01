import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radius } from '../theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary' ? colors.brand : variant === 'danger' ? 'transparent' : 'transparent';
  const border = variant === 'ghost' ? colors.border : variant === 'danger' ? colors.bad : 'transparent';
  const fg = variant === 'primary' ? '#04122e' : variant === 'danger' ? colors.bad : colors.text;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ text, tone = 'brand' }: { text: string; tone?: 'brand' | 'muted' | 'good' }) {
  const map = {
    brand: { bg: 'rgba(79,124,255,.18)', fg: colors.brand2 },
    muted: { bg: 'rgba(148,163,196,.18)', fg: colors.muted },
    good: { bg: 'rgba(52,211,153,.16)', fg: colors.good },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      <Text style={{ color: map.fg, fontWeight: '700', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/** ISO country code -> emoji flag. */
export function flag(cc: string): string {
  if (!cc || cc.length !== 2) return '🌐';
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  btnText: { fontWeight: '800', fontSize: 16 } as TextStyle,
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
  } as ViewStyle,
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
