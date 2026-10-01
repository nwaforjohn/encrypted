import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Button } from '../components/ui';
import { initIap, purchase, restore, iapAvailable } from '../billing/iap';
import { useAuthStore } from '../store/useAuthStore';

const FEATURES = [
  'All 60+ premium locations',
  'Fastest available speeds',
  'Threat & tracker blocking',
  'Protect up to 10 devices',
  'No activity logs, ever',
];

export default function PaywallScreen({ navigation }: any) {
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [busy, setBusy] = useState(false);
  const refreshEntitlement = useAuthStore((s) => s.refreshEntitlement);

  useEffect(() => {
    initIap();
  }, []);

  const buy = async () => {
    setBusy(true);
    try {
      const ok = await purchase(plan);
      await refreshEntitlement();
      if (ok) {
        Alert.alert('Welcome to Premium!', 'All locations are now unlocked.');
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert(
        'Purchase unavailable',
        iapAvailable
          ? 'Could not complete the purchase. Please try again.'
          : 'In-app purchases need a native build with store products configured. See vpn/docs/REVENUE.md.',
      );
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      const ok = await restore();
      await refreshEntitlement();
      Alert.alert(ok ? 'Purchases restored' : 'Nothing to restore', ok ? 'Premium is active.' : 'No active subscription found.');
      if (ok) navigation.goBack();
    } catch {
      Alert.alert('Restore unavailable', 'Try again from a native build.');
    } finally {
      setBusy(false);
    }
  };

  const PlanCard = ({
    id,
    title,
    price,
    note,
  }: {
    id: 'yearly' | 'monthly';
    title: string;
    price: string;
    note?: string;
  }) => (
    <TouchableOpacity
      style={[styles.plan, plan === id && styles.planActive]}
      onPress={() => setPlan(id)}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.planTitle}>{title}</Text>
        {note ? <Text style={styles.planNote}>{note}</Text> : null}
      </View>
      <Text style={styles.planPrice}>{price}</Text>
      <View style={[styles.radio, plan === id && styles.radioOn]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.badge}>★ PREMIUM</Text>
        <Text style={styles.title}>Unlock everything</Text>
        <Text style={styles.sub}>Full-speed access to every location, on all your devices.</Text>

        <View style={{ marginVertical: spacing(2) }}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.feat}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.featText}>{f}</Text>
            </View>
          ))}
        </View>

        <PlanCard id="yearly" title="Yearly" price="$5.99/mo" note="$71.88/yr · Save 50%" />
        <PlanCard id="monthly" title="Monthly" price="$11.99/mo" />

        <Button title="Start Premium" onPress={buy} loading={busy} style={{ marginTop: spacing(2) }} />
        <TouchableOpacity onPress={doRestore} style={{ marginTop: spacing(2) }}>
          <Text style={styles.restore}>Restore purchases</Text>
        </TouchableOpacity>
        <Text style={styles.fine}>
          Billed through {iapAvailable ? 'your app store' : 'the App Store / Google Play'}. Auto-renews
          until canceled. Cancel anytime in your store account settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  badge: { color: colors.brand2, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 6 },
  sub: { color: colors.muted, fontSize: 16, marginTop: 6 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  check: { color: colors.good, fontWeight: '900', fontSize: 16 },
  featText: { color: colors.text, fontSize: 16 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
  },
  planActive: { borderColor: colors.brand, backgroundColor: colors.panel2 },
  planTitle: { color: colors.text, fontWeight: '800', fontSize: 17 },
  planNote: { color: colors.brand2, fontSize: 13, marginTop: 2 },
  planPrice: { color: colors.text, fontWeight: '800', fontSize: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  radioOn: { borderColor: colors.brand, backgroundColor: colors.brand },
  restore: { color: colors.brand2, textAlign: 'center', fontWeight: '700' },
  fine: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing(2) },
});
