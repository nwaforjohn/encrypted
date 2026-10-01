/**
 * WireGuard helper utilities for the control plane.
 *
 * Important: the control plane NEVER sees a device's private key. The device
 * (phone / desktop) generates its own WireGuard keypair and sends only its
 * PUBLIC key. The backend allocates a tunnel IP, tells the exit node to accept
 * that public key as a peer, and returns a ready-to-use client config.
 */

/** Parse an IPv4 "a.b.c.d" into a 32-bit integer. */
function ipToInt(ip: string): number {
  const p = ip.split('.').map((n) => parseInt(n, 10));
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

/**
 * Allocate the lowest free host address in `subnetCidr` not present in
 * `usedIps`. Address .1 is reserved for the node's own tunnel interface.
 * Returns e.g. "10.7.0.42".
 */
export function allocateIp(subnetCidr: string, usedIps: string[]): string {
  const [base, bitsStr] = subnetCidr.split('/');
  const bits = parseInt(bitsStr, 10);
  const baseInt = ipToInt(base) & (bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0);
  const size = 2 ** (32 - bits);
  const used = new Set(usedIps.map((ip) => ipToInt(ip.split('/')[0])));
  // skip network addr (+0), node addr (+1), broadcast (last)
  for (let i = 2; i < size - 1; i++) {
    const candidate = baseInt + i;
    if (!used.has(candidate)) return intToIp(candidate);
  }
  throw new Error('subnet_exhausted');
}

export interface ClientConfigInput {
  deviceTunnelIp: string; // "10.7.0.42"
  dns: string; // "1.1.1.1"
  mtu: number;
  serverPublicKey: string;
  endpointHost: string;
  endpointPort: number;
}

/**
 * Build a standard WireGuard client config. The device fills in its own
 * [Interface] PrivateKey locally; we return the rest. AllowedIPs 0.0.0.0/0 +
 * ::/0 routes ALL traffic through the tunnel (full-device protection), and
 * DNS is pushed to prevent DNS leaks.
 */
export function buildClientConfig(i: ClientConfigInput): {
  config: string;
  fields: Record<string, unknown>;
} {
  const config = [
    '[Interface]',
    '# PrivateKey is filled in on the device and never sent to the server',
    'PrivateKey = <DEVICE_PRIVATE_KEY>',
    `Address = ${i.deviceTunnelIp}/32`,
    `DNS = ${i.dns}`,
    `MTU = ${i.mtu}`,
    '',
    '[Peer]',
    `PublicKey = ${i.serverPublicKey}`,
    `Endpoint = ${i.endpointHost}:${i.endpointPort}`,
    'AllowedIPs = 0.0.0.0/0, ::/0',
    'PersistentKeepalive = 25',
    '',
  ].join('\n');

  // Structured form for the mobile app's native WireGuard bridge.
  const fields = {
    address: `${i.deviceTunnelIp}/32`,
    dns: i.dns,
    mtu: i.mtu,
    peer: {
      publicKey: i.serverPublicKey,
      endpoint: `${i.endpointHost}:${i.endpointPort}`,
      allowedIps: ['0.0.0.0/0', '::/0'],
      persistentKeepalive: 25,
    },
  };

  return { config, fields };
}
