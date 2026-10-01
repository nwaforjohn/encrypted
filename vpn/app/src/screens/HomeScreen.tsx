import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Pill, flag } from '../components/ui';
import { useVpnStore } from '../store/useVpnStore';
import { hasNativeTunnel } from '../vpn/nativeTunnel';

export default function HomeScreen({ navigation }: any) {
  const { state, selected, connect, disconnect, elapsedStart, error } = useVpnStore();
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (state !== 'connected' || !elapsedStart) {
      setElapsed('00:00:00');
      return;
    }
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - elapsedStart) / 1000);
      const hh = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setElapsed(`${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(id);
  }, [state, elapsedStart]);

  const onToggle = async () => {
    if (state === 'connected') return disconnect();
    try {
      await connect();
    } catch (e: any) {
      if (e.status === 402 || e.message === 'premium_required') {
        navigation.navigate('Paywall');
      }
    }
  };

  const connected = state === 'connected';
  const connecting = state === 'connecting';
  const label = connected ? 'DISCONNECT' : connecting ? 'CONNECTING…' : 'QUICK CONNECT';
  const statusText = connected
    ? 'You are protected'
    : connecting
    ? 'Securing your connection…'
    : 'You are not protected';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.brand}>AuroraVPN</Text>
        <Pill text={connected ? 'Secure' : 'Unprotected'} tone={connected ? 'good' : 'muted'} />
      </View>

      <View style={styles.center}>
        <TouchableOpacity activeOpacity={0.9} onPress={onToggle} disabled={connecting}>
          <View
            style={[
              styles.orb,
              {
                backgroundColor: connected ? colors.good : colors.brand,
                shadowColor: connected ? colors.good : colors.brand,
              },
            ]}
          >
            <Text style={styles.orbIcon}>{connected ? '🔒' : '⚡'}</Text>
            <Text style={styles.orbLabel}>{label}</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.status, { color: connected ? colors.good : colors.muted }]}>
          {statusText}
        </Text>
        {connected ? <Text style={styles.timer}>{elapsed}</Text> : null}
      </View>

      <TouchableOpacity style={styles.locBar} onPress={() => navigation.navigate('Servers')}>
        <Text style={styles.flag}>{selected ? flag(selected.country) : '🌐'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.locLabel}>{selected ? 'Selected location' : 'Fastest location'}</Text>
          <Text style={styles.locName}>
            {selected ? `${selected.city}, ${selected.countryName}` : 'Auto (recommended)'}
          </Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>

      {error && error !== 'premium_required' ? <Text style={styles.err}>{error}</Text> : null}
      {!hasNativeTunnel ? (
        <Text style={styles.devnote}>
          Dev build note: no native WireGuard module detected — running the connect flow in mock
          mode (traffic not encrypted). See vpn/docs/PUBLISHING.md.
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const ORB = 220;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.text, fontSize: 22, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  orbIcon: { fontSize: 46, marginBottom: 8 },
  orbLabel: { color: '#04122e', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
  status: { marginTop: spacing(3), fontSize: 18, fontWeight: '700' },
  timer: { color: colors.muted, marginTop: 6, fontVariant: ['tabular-nums'], fontSize: 15 },
  locBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
  },
  flag: { fontSize: 30 },
  locLabel: { color: colors.muted, fontSize: 12 },
  locName: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  chev: { color: colors.muted, fontSize: 28 },
  err: { color: '#fecaca', textAlign: 'center', marginTop: spacing(1.5) },
  devnote: { color: colors.warn, fontSize: 12, textAlign: 'center', marginTop: spacing(1.5) },
});
