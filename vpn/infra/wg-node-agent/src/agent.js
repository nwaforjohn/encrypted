#!/usr/bin/env node
/**
 * AuroraVPN node agent — runs on each WireGuard exit server.
 *
 * Zero npm dependencies (uses only Node built-ins) so it installs cleanly on a
 * bare VPS. The control plane calls it over HTTPS with a shared bearer secret
 * to add/remove peers; the agent translates those into `wg set` commands.
 *
 * Config via environment (set by the systemd unit the installer writes):
 *   AGENT_SECRET     required  shared bearer token the control plane sends
 *   AGENT_PORT       default 8443
 *   WG_INTERFACE     default wg0
 *   WG_SERVER_PUBKEY required  this node's WireGuard public key
 *   TLS_CERT         path to fullchain/self-signed cert (PEM)
 *   TLS_KEY          path to private key (PEM)
 */
'use strict';

const https = require('https');
const fs = require('fs');
const { execFile } = require('child_process');

const SECRET = process.env.AGENT_SECRET || '';
const PORT = parseInt(process.env.AGENT_PORT || '8443', 10);
const IFACE = process.env.WG_INTERFACE || 'wg0';
const SERVER_PUBKEY = process.env.WG_SERVER_PUBKEY || '';
const TLS_CERT = process.env.TLS_CERT || '/etc/auroravpn/agent.crt';
const TLS_KEY = process.env.TLS_KEY || '/etc/auroravpn/agent.key';

if (!SECRET) {
  console.error('FATAL: AGENT_SECRET not set');
  process.exit(1);
}

/** Validate a base64 WireGuard key (44 chars ending in "="). */
function isWgKey(s) {
  return typeof s === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(s);
}
/** Validate "a.b.c.d/32" (or /128 ipv6-ish) — reject shell metacharacters. */
function isAllowedIp(s) {
  return typeof s === 'string' && /^[0-9a-fA-F:.]+\/\d{1,3}$/.test(s);
}

function wg(args) {
  return new Promise((resolve, reject) => {
    // execFile (not exec) — arguments are passed as an array, never a shell
    // string, so a crafted public key cannot inject commands.
    execFile('wg', args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.toString());
    });
  });
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e5) req.destroy(); // 100kb guard
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

function authed(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  // constant-time-ish compare
  if (token.length !== SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ SECRET.charCodeAt(i);
  return diff === 0;
}

const server = https.createServer(
  { cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) },
  async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
        return send(res, 200, { ok: true, iface: IFACE });
      }

      if (!authed(req)) return send(res, 401, { error: 'unauthorized' });

      if (req.method === 'POST' && req.url === '/peers') {
        const body = await readBody(req);
        if (!body || !isWgKey(body.publicKey) || !isAllowedIp(body.allowedIp)) {
          return send(res, 400, { error: 'bad_request' });
        }
        await wg(['set', IFACE, 'peer', body.publicKey, 'allowed-ips', body.allowedIp]);
        return send(res, 200, { ok: true, serverPublicKey: SERVER_PUBKEY });
      }

      if (req.method === 'POST' && req.url === '/peers/remove') {
        const body = await readBody(req);
        if (!body || !isWgKey(body.publicKey)) return send(res, 400, { error: 'bad_request' });
        await wg(['set', IFACE, 'peer', body.publicKey, 'remove']);
        return send(res, 200, { ok: true });
      }

      if (req.method === 'GET' && req.url === '/stats') {
        const out = await wg(['show', IFACE, 'transfer']);
        return send(res, 200, { transfer: out });
      }

      send(res, 404, { error: 'not_found' });
    } catch (e) {
      send(res, 500, { error: 'agent_error', detail: String(e.message || e) });
    }
  },
);

server.listen(PORT, () => {
  console.log(`[node-agent] listening on :${PORT} iface=${IFACE}`);
});
