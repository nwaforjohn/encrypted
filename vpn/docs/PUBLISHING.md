# Publishing the apps to the App Store & Google Play

This is the longest road and the one with real gatekeepers. Budget a few weeks
including review. Here's the honest, complete picture.

## 0. What's done vs what you must add

**Done in this repo:** the whole app UI and logic — login, server picker,
paywall/IAP, kill-switch settings, on-device WireGuard keypair generation, and a
clean `AuroraVpn` native-module seam (`app/src/vpn/nativeTunnel.ts`). In
development it runs against a **mock tunnel** so you can see everything work.

**What you must add to carry real traffic:** the native WireGuard tunnel for
each platform, behind that same `AuroraVpn` seam. There is no pure-JS way to
create a system VPN — the OS must do it. This is the one substantial piece of
native code to write (or hire out).

## 1. Accounts & enrolment

- **Apple Developer Program** — $99/yr. VPN apps using the Network Extension
  entitlement must be published under an **Organization** account (not an
  individual) in most cases, and you request the entitlement from Apple.
- **Google Play Developer** — $25 one-time. Declare that the app uses
  `VpnService` in the Play Console's app content / data-safety sections.

## 2. The native tunnel module

Implement a React Native native module named **`AuroraVpn`** exposing:

```ts
startTunnel(config): Promise<void>   // bring the WireGuard interface up
stopTunnel(): Promise<void>          // tear it down
```

`config` is the `TunnelConfig` in `app/src/vpn/nativeTunnel.ts` (private key,
address, DNS, MTU, peer public key, endpoint, allowedIPs). Build it on top of
the official WireGuard libraries:

- **iOS** — a **Packet Tunnel Provider** app extension using
  [`wireguard-apple` / WireGuardKit](https://github.com/WireGuard/wireguard-apple).
  Add the entitlement `com.apple.developer.networking.networkextension` =
  `packet-tunnel-provider` (already declared in `app.config.ts`).
- **Android** — a `VpnService` using
  [`wireguard-android` (GoBackend / tunnel)](https://github.com/WireGuard/wireguard-android).

Because this needs custom native code, build with an **Expo config plugin** +
`expo prebuild` (or eject to bare). The app already uses a dev-client flow
(`npm run android` / `npm run ios`) that compiles native code.

Until the module is linked, `nativeTunnel.ts` detects its absence and uses the
mock so the rest of the app keeps working.

## 3. In-app purchase

Create the subscription products and credentials per [REVENUE.md](REVENUE.md).
The product IDs in `app/src/billing/iap.ts` must match the store exactly.

## 4. Assets & metadata

- App icon (1024×1024) and splash — drop into `app/assets` and reference in
  `app.config.ts` (`icon`, `splash`).
- Screenshots for each required device size.
- A **Privacy Policy URL** and **Terms URL** (required). Fill the placeholder
  legal pages on the website and link them.
- App Store: fill the **Privacy "Nutrition Label"** (what you collect — for a
  no-logs VPN, be precise and minimal).
- Play: complete the **Data safety** form and the **VPN/`VpnService`**
  declaration.

## 5. Build & submit

```bash
cd vpn/app
# one-time: npm i -g eas-cli && eas login && eas build:configure
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --profile production      # fill eas.json first
eas submit --platform android --profile production
```

Fill the real IDs in `eas.json` (`appleId`, `ascAppId`, `appleTeamId`, and the
Play service-account path).

## 6. Review notes (save yourself a rejection)

Both stores scrutinise VPNs. In the review notes:
- State clearly that it's a consumer privacy VPN using WireGuard, that you (the
  developer) operate the servers, and your no-logs policy.
- Provide a **demo account** with premium enabled so reviewers can test every
  location without paying.
- iOS: VPN apps must use the Network Extension API (you're compliant) and must
  not collect data beyond what's declared. Subscriptions must use IAP (you're
  compliant).
- Android: ensure the `VpnService` declaration and a visible foreground-service
  notification while connected.

## 7. Common rejection reasons

- Using a non-Apple payment flow in-app for the subscription → must be IAP.
- Missing/incorrect privacy disclosures.
- No demo credentials → reviewer can't test premium.
- Background VPN without a persistent notification (Android).
