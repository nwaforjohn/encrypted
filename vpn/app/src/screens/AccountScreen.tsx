import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Button, Card, Pill } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { useVpnStore } from '../store/useVpnStore';

export default function AccountScreen({ navigation }: any) {
  const { email, entitlement, logout } = useAuthStore();
  const disconnect = useVpnStore((s) => s.disconnect);
  const [killSwitch, setKillSwitch] = React.useState(true);
  const [autoConnect, setAutoConnect] = React.useState(false);

  const premium = entitlement?.premium;

  const SettingRow = ({
    label,
    desc,
    value,
    onChange,
  }: {
    label: string;
    desc: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <View style={styles.settingRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={{ marginTop: 10, flexDirection: 'row' }}>
            <Pill text={premium ? '★ Premium' : 'Free plan'} tone={premium ? 'brand' : 'muted'} />
          </View>
          {!premium ? (
            <Button
              title="Upgrade to Premium"
              onPress={() => navigation.navigate('Paywall')}
              style={{ marginTop: 14 }}
            />
          ) : (
            <Text style={styles.premiumNote}>
              Premium is active{entitlement?.currentPeriodEnd
                ? ` until ${new Date(entitlement.currentPeriodEnd).toLocaleDateString()}`
                : ''}
              . Manage or cancel in your app store subscription settings.
            </Text>
          )}
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>Protection</Text>
          <SettingRow
            label="Kill switch"
            desc="Block all internet if the VPN drops, so your IP never leaks."
            value={killSwitch}
            onChange={setKillSwitch}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Auto-connect on untrusted Wi-Fi"
            desc="Connect automatically when you join a public network."
            value={autoConnect}
            onChange={setAutoConnect}
          />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>Protocol: WireGuard® (NordLynx-style)</Text>
          <Text style={styles.aboutText}>Encryption: Curve25519 · ChaCha20-Poly1305</Text>
          <Text style={styles.aboutText}>No-logs: traffic is relayed, not recorded</Text>
          <Text style={styles.aboutText}>Version 1.0.0</Text>
        </Card>

        <Button
          title="Log out"
          variant="danger"
          onPress={async () => {
            await disconnect();
            await logout();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  label: { color: colors.muted, fontSize: 13 },
  email: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  premiumNote: { color: colors.muted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  settingLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  settingDesc: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  aboutText: { color: colors.muted, fontSize: 14, paddingVertical: 3 },
});
