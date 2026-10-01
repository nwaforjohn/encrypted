import { ExpoConfig } from 'expo/config';

/**
 * Expo config for the AuroraVPN app.
 *
 * NOTE on the real VPN tunnel: a system VPN needs native platform APIs that
 * require special capabilities:
 *   • iOS  — the Network Extension (Packet Tunnel) entitlement
 *            `com.apple.developer.networking.networkextension` (Apple must
 *            approve this on a paid ORGANISATION account, not a personal one).
 *   • Android — the `android.permission.FOREGROUND_SERVICE` + a VpnService.
 * See vpn/docs/PUBLISHING.md. Replace the bundle/package ids with your own.
 */
const config: ExpoConfig = {
  name: 'AuroraVPN',
  slug: 'auroravpn',
  scheme: 'auroravpn',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0a0e1a',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'net.yourcompany.auroravpn',
    supportsTablet: true,
    infoPlist: {
      // The app connects out to your control plane over HTTPS.
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: false },
    },
    // The Network Extension entitlement is added in the native project / EAS
    // credentials once Apple approves it for your account.
    entitlements: {
      'com.apple.developer.networking.networkextension': ['packet-tunnel-provider'],
    },
  },
  android: {
    package: 'net.yourcompany.auroravpn',
    permissions: ['FOREGROUND_SERVICE', 'POST_NOTIFICATIONS'],
  },
  extra: {
    // Point the app at your deployed control plane. For local dev:
    //   Android emulator -> http://10.0.2.2:8080 ; iOS sim -> http://localhost:8080
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080',
  },
  plugins: ['expo-secure-store'],
};

export default config;
