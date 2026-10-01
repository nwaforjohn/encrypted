import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Pill, flag } from '../components/ui';
import { useVpnStore } from '../store/useVpnStore';
import { useAuthStore } from '../store/useAuthStore';
import { ServerLocation } from '../api/client';

export default function ServersScreen({ navigation }: any) {
  const { servers, loadServers, select, selected } = useVpnStore();
  const premium = useAuthStore((s) => s.entitlement?.premium);

  useEffect(() => {
    loadServers();
  }, []);

  const pick = (s: ServerLocation | null) => {
    if (s?.premium && !premium) {
      navigation.navigate('Paywall');
      return;
    }
    select(s);
    navigation.goBack();
  };

  const renderItem = ({ item }: { item: ServerLocation }) => {
    const locked = item.premium && !premium;
    const active = selected?.code === item.code;
    return (
      <TouchableOpacity style={[styles.row, active && styles.rowActive]} onPress={() => pick(item)}>
        <Text style={styles.flag}>{flag(item.country)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.country}>{item.countryName}</Text>
          <Text style={styles.city}>
            {item.city} · {item.online ? `${item.load}% load` : 'offline'}
          </Text>
        </View>
        {item.premium ? <Pill text={locked ? '🔒 Premium' : 'Premium'} tone="brand" /> : <Pill text="Free" tone="muted" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={[styles.row, styles.auto]} onPress={() => pick(null)}>
        <Text style={styles.flag}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.country}>Fastest location</Text>
          <Text style={styles.city}>Auto-select the best server for you</Text>
        </View>
        {!selected ? <Pill text="Selected" tone="good" /> : null}
      </TouchableOpacity>

      <FlatList
        data={servers}
        keyExtractor={(s) => s.code}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: spacing(4) }}
        ListEmptyComponent={
          <Text style={styles.empty}>No locations yet. Add a server in the admin dashboard.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  rowActive: { borderColor: colors.brand },
  auto: { backgroundColor: colors.panel2 },
  flag: { fontSize: 26 },
  country: { color: colors.text, fontWeight: '700', fontSize: 16 },
  city: { color: colors.muted, fontSize: 13, marginTop: 2 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing(4) },
});
