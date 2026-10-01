/**
 * Native WireGuard tunnel bridge.
 *
 * A real system VPN cannot be implemented in pure JavaScript — the OS must
 * create the tunnel interface. This module is the single seam between the app's
 * JS and the native WireGuard implementation:
 *
 *   iOS     → a Packet Tunnel Provider app-extension built on Apple's
 *             NetworkExtension framework, driving WireGuardKit.
 *             https://github.com/WireGuard/wireguard-apple
 *   Android → a VpnService + the WireGuard GoBackend / tunnel library.
 *             https://github.com/WireGuard/wireguard-android
 *
 * You expose those to JS as a native module named `AuroraVpn` with two methods:
 *   startTunnel(config: TunnelConfig): Promise<void>
 *   stopTunnel(): Promise<void>
 * and (optionally) emit a `AuroraVpnState` event with { state }.
 *
 * Until that native module is wired up (see vpn/docs/PUBLISHING.md), this file
 * falls back to a MOCK tunnel so the whole app — login, server picker, paywall,
 * connect UI — runs end-to-end in Expo Go / a simulator. The mock clearly does
 * NOT encrypt traffic; it only drives the UI state machine.
 */
import { NativeModules, Platform } from 'react-native';
import type { ConnectResult } from '../api/client';

export interface TunnelConfig {
  privateKey: string;
  address: string; // "10.7.0.42/32"
  dns: string;
  mtu: number;
  peerPublicKey: string;
  endpoint: string; // "host:51820"
  allowedIps: string[]; // ["0.0.0.0/0","::/0"]
  persistentKeepalive: number;
}

export type TunnelState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface NativeVpn {
  startTunnel(config: TunnelConfig): Promise<void>;
  stopTunnel(): Promise<void>;
}

const Native: NativeVpn | undefined = (NativeModules as any).AuroraVpn;
export const hasNativeTunnel = !!Native;

/** Build a TunnelConfig from the server's connect response + the device key. */
export function buildTunnelConfig(res: ConnectResult, privateKey: string): TunnelConfig {
  return {
    privateKey,
    address: res.fields.address,
    dns: res.fields.dns,
    mtu: res.fields.mtu,
    peerPublicKey: res.fields.peer.publicKey,
    endpoint: res.fields.peer.endpoint,
    allowedIps: res.fields.peer.allowedIps,
    persistentKeepalive: res.fields.peer.persistentKeepalive,
  };
}

export async function startTunnel(config: TunnelConfig): Promise<void> {
  if (Native) return Native.startTunnel(config);
  // ---- MOCK (no native module present) ----
  if (__DEV__) {
    console.warn(
      `[AuroraVPN] No native WireGuard module on ${Platform.OS} — using MOCK tunnel. ` +
        'Traffic is NOT encrypted. Implement the AuroraVpn native module for a real tunnel.',
    );
  }
  await new Promise((r) => setTimeout(r, 900));
}

export async function stopTunnel(): Promise<void> {
  if (Native) return Native.stopTunnel();
  await new Promise((r) => setTimeout(r, 400));
}
