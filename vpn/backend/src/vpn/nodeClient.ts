/**
 * Talks to a VPN exit node's node-agent (see infra/wg-node-agent).
 *
 * The agent is a small authenticated HTTPS service running next to WireGuard
 * on each exit server. The control plane calls it to add/remove peers and to
 * read live transfer counters — the control plane itself never needs SSH or
 * root on the exit nodes.
 *
 * Dev/mock: if a node's agent_url starts with "mock://", calls are simulated
 * so you can exercise the full connect/disconnect flow with no real server.
 */
import { Agent as HttpsAgent } from 'https';

export interface NodeRow {
  id: string;
  code: string;
  public_key: string;
  endpoint_host: string;
  endpoint_port: number;
  agent_url: string;
  agent_secret: string;
}

export interface AddPeerResult {
  ok: boolean;
  serverPublicKey: string;
}

// Allow self-signed certs between control plane and your own nodes when
// AGENT_INSECURE_TLS=1 (common for private infra). Defaults to verifying.
const insecure = process.env.AGENT_INSECURE_TLS === '1';
const httpsAgent = insecure ? new HttpsAgent({ rejectUnauthorized: false }) : undefined;

function isMock(node: NodeRow): boolean {
  return node.agent_url.startsWith('mock://');
}

async function call(node: NodeRow, path: string, body: unknown): Promise<any> {
  const url = `${node.agent_url.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${node.agent_secret}`,
    },
    body: JSON.stringify(body),
    // @ts-expect-error Node's fetch accepts an undici dispatcher via `agent` shim
    agent: httpsAgent,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`node_agent_error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Register a device's public key as a peer and route `assignedIp` to it. */
export async function addPeer(
  node: NodeRow,
  devicePublicKey: string,
  assignedIp: string,
): Promise<AddPeerResult> {
  if (isMock(node)) {
    return { ok: true, serverPublicKey: node.public_key };
  }
  const out = await call(node, '/peers', {
    publicKey: devicePublicKey,
    allowedIp: `${assignedIp}/32`,
  });
  return { ok: true, serverPublicKey: out.serverPublicKey ?? node.public_key };
}

/** Remove a peer when the device disconnects. */
export async function removePeer(node: NodeRow, devicePublicKey: string): Promise<void> {
  if (isMock(node)) return;
  await call(node, '/peers/remove', { publicKey: devicePublicKey });
}

/** Liveness check used by the health loop. */
export async function health(node: NodeRow): Promise<boolean> {
  if (isMock(node)) return true;
  try {
    const url = `${node.agent_url.replace(/\/$/, '')}/health`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${node.agent_secret}` },
      // @ts-expect-error see above
      agent: httpsAgent,
    });
    return res.ok;
  } catch {
    return false;
  }
}
