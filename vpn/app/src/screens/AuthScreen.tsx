import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Button } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register, error } = useAuthStore();

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password);
    } catch {
      /* error shown from store */
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.shield}>
          <Text style={{ fontSize: 40 }}>🛡️</Text>
        </View>
        <Text style={styles.title}>AuroraVPN</Text>
        <Text style={styles.subtitle}>Private, device-wide protection in one tap.</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setMode('login')}
            style={[styles.tab, mode === 'login' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('register')}
            style={[styles.tab, mode === 'register' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 chars)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button
          title={mode === 'login' ? 'Log in' : 'Create account'}
          onPress={submit}
          loading={busy}
          style={{ marginTop: spacing(1) }}
        />
        <Text style={styles.fine}>
          By continuing you agree to our Terms and Privacy Policy. No activity logs.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  shield: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: spacing(3) },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing(2),
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.muted, fontWeight: '700' },
  tabTextActive: { color: '#04122e' },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing(1.5),
  },
  error: {
    color: '#fecaca',
    backgroundColor: 'rgba(248,113,113,.12)',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing(1.5),
  },
  fine: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing(2) },
});
