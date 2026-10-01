import { one, q } from '../db';
import { env } from '../env';
import { getEntitlement } from '../billing/entitlements';
import { allocateIp, buildClientConfig } from './wireguard';
import { addPeer, removePeer, NodeRow } from './nodeClient';

export interface ConnectResult {
  sessionId: string;
  node: {
    code: string;
    country: string;
    countryName: string;
    city: string;
    premium: boolean;
  };
  config: string;
  fields: Record<string, unknown>;
}

/**
 * Pick the best node for a connection.
 *  - honours an explicit `code` if given (and permitted)
 *  - otherwise picks the least-loaded healthy node in the requested country
 *  - premium nodes are only offered to premium accounts
 */
async function selectNode(opts: {
  premiumAllowed: boolean;
  code?: string;
  country?: string;
}): Promise<NodeRow & { premium: boolean; country: string; country_name: string; city: string; subnet_cidr: string }> {
  // Explicit location: look it up regardless of premium/health so the caller
  // can return a precise error (402 premium_required vs 503 offline/full),
  // which is what lets the app show the paywall instead of a generic failure.
  if (opts.code) {
    const row = await one<any>(`SELECT * FROM nodes WHERE enabled = true AND code = $1`, [opts.code]);
    if (!row) throw new Error('no_node_available');
    if (row.premium && !opts.premiumAllowed) {
      const err: any = new Error('premium_required');
      err.code = 'premium_required';
      throw err;
    }
    if (!row.healthy || row.load >= row.capacity) throw new Error('no_node_available');
    return row;
  }

  // Auto-select: least-loaded healthy node, premium only for premium accounts.
  const filters: string[] = ['enabled = true', 'healthy = true', 'load < capacity'];
  const params: any[] = [];
  if (!opts.premiumAllowed) filters.push('premium = false');
  if (opts.country) {
    params.push(opts.country.toUpperCase());
    filters.push(`country = $${params.length}`);
  }
  const row = await one<any>(
    `SELECT * FROM nodes WHERE ${filters.join(' AND ')}
     ORDER BY (load::float / NULLIF(capacity,0)) ASC, load ASC
     LIMIT 1`,
    params,
  );
  if (!row) throw new Error('no_node_available');
  return row;
}

/** Establish a tunnel: allocate IP, register the peer on the node, open a session. */
export async function connect(params: {
  userId: string;
  deviceId: string;
  devicePublicKey: string;
  nodeCode?: string;
  country?: string;
}): Promise<ConnectResult> {
  const ent = await getEntitlement(params.userId);
  const node = await selectNode({
    premiumAllowed: ent.premium,
    code: params.nodeCode,
    country: params.country,
  });

  // Guard: if the user explicitly asked for a premium node without entitlement.
  if (node.premium && !ent.premium) {
    const err: any = new Error('premium_required');
    err.code = 'premium_required';
    throw err;
  }

  // Allocate a free tunnel IP on this node.
  const used = await q<{ assigned_ip: string }>(
    `SELECT assigned_ip FROM vpn_sessions WHERE node_id=$1 AND status='active'`,
    [node.id],
  );
  const ip = allocateIp(node.subnet_cidr, used.map((r) => r.assigned_ip));

  // Register the peer on the exit node.
  const peer = await addPeer(node, params.devicePublicKey, ip);

  // Open the session + bump node load atomically-ish.
  const session = await one<{ id: string }>(
    `INSERT INTO vpn_sessions (user_id, device_id, node_id, assigned_ip, status)
     VALUES ($1,$2,$3,$4,'active') RETURNING id`,
    [params.userId, params.deviceId, node.id, `${ip}/32`],
  );
  await q(`UPDATE nodes SET load = load + 1 WHERE id=$1`, [node.id]);
  await q(`UPDATE devices SET last_seen_at=now() WHERE id=$1`, [params.deviceId]);

  const { config, fields } = buildClientConfig({
    deviceTunnelIp: ip,
    dns: env.tunnel.dns,
    mtu: env.tunnel.mtu,
    serverPublicKey: peer.serverPublicKey,
    endpointHost: node.endpoint_host,
    endpointPort: node.endpoint_port,
  });

  return {
    sessionId: session!.id,
    node: {
      code: node.code,
      country: node.country,
      countryName: node.country_name,
      city: node.city,
      premium: node.premium,
    },
    config,
    fields,
  };
}

/** Tear down a tunnel session. */
export async function disconnect(params: {
  userId: string;
  sessionId: string;
  devicePublicKey: string;
}): Promise<void> {
  const session = await one<any>(
    `SELECT s.*, n.agent_url, n.agent_secret, n.public_key, n.endpoint_host, n.endpoint_port, n.code
       FROM vpn_sessions s JOIN nodes n ON n.id = s.node_id
      WHERE s.id=$1 AND s.user_id=$2 AND s.status='active'`,
    [params.sessionId, params.userId],
  );
  if (!session) return; // already closed / not found — idempotent

  try {
    await removePeer(
      {
        id: session.node_id,
        code: session.code,
        public_key: session.public_key,
        endpoint_host: session.endpoint_host,
        endpoint_port: session.endpoint_port,
        agent_url: session.agent_url,
        agent_secret: session.agent_secret,
      },
      params.devicePublicKey,
    );
  } catch (e) {
    // Even if the node is unreachable, we still close our record and free the IP.
    console.warn('[vpn] removePeer failed (closing session anyway):', (e as Error).message);
  }

  await q(`UPDATE vpn_sessions SET status='closed', ended_at=now() WHERE id=$1`, [params.sessionId]);
  await q(`UPDATE nodes SET load = GREATEST(load - 1, 0) WHERE id=$1`, [session.node_id]);
}
