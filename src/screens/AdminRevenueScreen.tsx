import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '@/theme';
import { social, type RevenueSummary } from '@/api/social';

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminRevenueScreen() {
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sponsored-post composer.
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [hours, setHours] = useState('24');
  const [amount, setAmount] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await social.revenue());
    } catch (err) {
      Alert.alert('Error', String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createSponsored = async () => {
    if (!/^https?:\/\/.+/i.test(imageUrl.trim())) {
      Alert.alert('Image URL required', 'Enter a public image link.');
      return;
    }
    try {
      setPosting(true);
      await social.createSponsored({
        imageUrl: imageUrl.trim(),
        caption: caption.trim() || undefined,
        hours: Number(hours) > 0 ? Number(hours) : undefined,
        amountCents: amount.trim()
          ? Math.round(parseFloat(amount) * 100)
          : undefined,
      });
      setImageUrl('');
      setCaption('');
      setAmount('');
      Alert.alert('Live', 'Sponsored post is now in users’ feeds.');
      void load();
    } catch (err) {
      Alert.alert('Could not create', String((err as Error)?.message ?? err));
    } finally {
      setPosting(false);
    }
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const t = data.totals;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: theme.spacing(2) }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      <Text style={styles.totalLabel}>Total revenue</Text>
      <Text style={styles.total}>{money(t.allCents)}</Text>
      <Text style={styles.totalSub}>
        {data.counts.users} users · {data.counts.posts} posts ·{' '}
        {data.counts.subscribers} subscribers
      </Text>

      <View style={styles.grid}>
        <RevenueCard label="Promotions" value={money(t.promotionCents)} hint="Stream 1" />
        <RevenueCard label="Ads (est.)" value={money(t.estimatedAdCents)} hint="Stream 2" />
        <RevenueCard label="Subscriptions" value={money(t.subscriptionCents)} hint="Stream 3" />
        <RevenueCard
          label={`Tip cut (${data.platformCutPercent}%)`}
          value={money(t.tipCutCents)}
          hint="Stream 4"
        />
      </View>

      <Text style={styles.metaLine}>
        {data.adImpressions} ad impressions · {data.counts.active_promotions} active
        promotions · {data.counts.tips} tips
      </Text>

      {/* Sponsored post composer (revenue stream #1, owner-placed). */}
      <Text style={styles.section}>Create sponsored post</Text>
      <TextInput
        style={styles.input}
        placeholder="Image URL (https://…)"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={imageUrl}
        onChangeText={setImageUrl}
      />
      <TextInput
        style={styles.input}
        placeholder="Caption (optional)"
        placeholderTextColor={theme.colors.textMuted}
        value={caption}
        onChangeText={setCaption}
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.half]}
          placeholder="Hours (blank = evergreen)"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
          value={hours}
          onChangeText={setHours}
        />
        <TextInput
          style={[styles.input, styles.half]}
          placeholder="Revenue $ (optional)"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
      </View>
      <Pressable style={styles.button} onPress={createSponsored} disabled={posting}>
        {posting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Publish sponsored post</Text>
        )}
      </Pressable>

      {/* Recent ledger entries. */}
      <Text style={styles.section}>Recent earnings</Text>
      {data.recent.length === 0 ? (
        <Text style={styles.muted}>No earnings recorded yet.</Text>
      ) : (
        data.recent.map((r, i) => (
          <View key={`${r.createdAt}-${i}`} style={styles.ledgerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ledgerSource}>{labelForSource(r.source)}</Text>
              {!!r.note && <Text style={styles.ledgerNote}>{r.note}</Text>}
            </View>
            <Text style={styles.ledgerAmount}>{money(r.amountCents)}</Text>
          </View>
        ))
      )}

      <Text style={styles.footnote}>
        Ad revenue is an estimate from logged impressions; actual payouts are
        reported by AdMob. Store revenue is net of store commission.
      </Text>
    </ScrollView>
  );
}

function labelForSource(source: string): string {
  switch (source) {
    case 'promotion':
      return 'Promotion / sponsored';
    case 'subscription':
      return 'Subscription';
    case 'tip_cut':
      return 'Tip (platform cut)';
    case 'ad':
      return 'Ad';
    default:
      return source;
  }
}

function RevenueCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHint}>{hint}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
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
  totalLabel: { color: theme.colors.textMuted, fontSize: 13 },
  total: { color: theme.colors.gold, fontSize: 40, fontWeight: '800' },
  totalSub: { color: theme.colors.textMuted, marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing(1.5),
  },
  cardHint: { color: theme.colors.textMuted, fontSize: 11 },
  cardValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  cardLabel: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  metaLine: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing(1.5) },
  section: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    fontSize: 15,
    marginBottom: theme.spacing(1),
  },
  row: { flexDirection: 'row', gap: theme.spacing(1) },
  half: { flex: 1 },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing(1.5),
    marginTop: theme.spacing(0.5),
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  ledgerSource: { color: theme.colors.text, fontWeight: '600' },
  ledgerNote: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  ledgerAmount: { color: theme.colors.primary, fontWeight: '700' },
  muted: { color: theme.colors.textMuted },
  footnote: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
    lineHeight: 16,
  },
});
