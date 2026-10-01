import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';
import { AdBanner } from './AdBanner';
import { useEntitlements } from '@/monetization/entitlements';
import { social } from '@/api/social';

/**
 * An ad slot interleaved into the feed (revenue stream #2). Logs one impression
 * for the owner dashboard estimate, then renders the AdBanner — which itself
 * renders nothing for ad-free users, so Pro members never see this.
 */
export function FeedAd() {
  const hasNoAds = useEntitlements((s) => s.hasFeature('no_ads'));

  useEffect(() => {
    if (!hasNoAds) void social.logImpression('feed');
  }, [hasNoAds]);

  if (hasNoAds) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Sponsored</Text>
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing(1),
    marginVertical: theme.spacing(0.5),
    alignItems: 'center',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
});
