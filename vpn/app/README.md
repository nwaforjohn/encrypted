# AuroraVPN app (iOS & Android)

Expo + React Native + TypeScript. Big connect toggle, server picker, premium
paywall, kill-switch settings. Generates a real WireGuard keypair on-device
(private key stays in the secure keystore).

## Run in development

```bash
npm install
# Android emulator reaches your localhost backend at 10.0.2.2:
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npm run android
# iOS simulator:
EXPO_PUBLIC_API_URL=http://localhost:8080 npm run ios
```

> The real system VPN needs a native WireGuard module (see
> [`../docs/PUBLISHING.md`](../docs/PUBLISHING.md)). Until that's linked, the app
> auto-detects its absence and runs a **mock tunnel** — every screen and the
> connect flow work, but traffic isn't actually encrypted in that mode. A banner
> on the Home screen makes this obvious.

## Layout

```
App.tsx                  entry — auth gate + navigation
src/
  api/client.ts          REST client + token storage (secure store)
  vpn/
    keys.ts              on-device WireGuard keypair (tweetnacl → Curve25519)
    nativeTunnel.ts      AuroraVpn native-module seam (+ mock fallback)
  store/
    useAuthStore.ts      login / register / entitlement
    useVpnStore.ts       servers, selection, connect/disconnect state machine
  billing/iap.ts         App Store / Play in-app purchase + server verify
  screens/               Auth, Home, Servers, Paywall, Account
  navigation/            tabs + modal stack
  components/ui.tsx      Button, Card, Pill, flag()
  theme/                 colors + spacing
```

## Configure before shipping

- `app.config.ts` — set your real `ios.bundleIdentifier` / `android.package`,
  add icon + splash, keep the Network Extension entitlement.
- `eas.json` — fill Apple/Play submit credentials and the production API URL.
- `src/billing/iap.ts` — product IDs must match the store products.
- Implement the `AuroraVpn` native module (iOS NetworkExtension + Android
  VpnService) — see [`../docs/PUBLISHING.md`](../docs/PUBLISHING.md).
