# Standing up VPN exit servers

This is the one step with no shortcut: a VPN needs machines that traffic exits
from. The good news — each one is a single command.

## 1. Rent a VPS

Any cheap Linux VPS works ($4–6/month is plenty to start). Good options:
Hetzner, DigitalOcean, Vultr, Linode, OVH, Contabo. Pick **Ubuntu 22.04/24.04**.
The server's **location = the "server location" your users pick in the app**, so
rent in the cities you want to offer (start with 1–2, add more as you grow).

Make sure these ports are open in the provider's firewall:
- **UDP 51820** — the WireGuard tunnel
- **TCP 8443** — the node agent (the control plane calls this)

## 2. Run the installer

SSH in as root, get the installer onto the box (clone this repo or `scp` the
`vpn/infra` folder), then:

```bash
cd vpn/infra
sudo ./install-vpn-node.sh \
  --code us-nyc-1 \
  --country US --country-name "United States" --city "New York" \
  --endpoint YOUR.SERVER.PUBLIC.IP \
  --premium        # omit for a free-tier location
```

It installs WireGuard + Node, turns on IP forwarding and NAT, generates the
server keys, and runs the node agent as a systemd service. At the end it prints
a ready-to-paste `curl` that **registers the node with your control plane**.

## 3. Register the node

Run the printed command (fill in your control-plane URL + admin JWT):

```bash
curl -X POST "$CONTROL_PLANE_URL/admin/nodes" \
  -H "Authorization: Bearer $ADMIN_JWT" -H "content-type: application/json" \
  -d '{ ...values the installer printed... }'
```

Within ~30s the control plane's health loop pings the node's agent and flips it
to **online**. It now shows up in the app/website and can carry tunnels.

> The agent uses a self-signed TLS cert by default. Run the backend with
> `AGENT_INSECURE_TLS=1` (fine for your own infra) **or** put a real certificate
> on the node and point `TLS_CERT`/`TLS_KEY` at it.

## 4. Verify

```bash
# on the node:
sudo wg show                       # see the interface + any connected peers
systemctl status auroravpn-agent   # agent running?
systemctl status wg-quick@wg0      # tunnel up?
```

From the app, connect to that location — `wg show` should list your device as a
peer with a recent handshake, and your public IP (check whatismyip) should now
be the server's.

## Scaling up

- Add more nodes the same way; the control plane load-balances to the
  least-loaded healthy node in the requested country.
- Mark busy regions `--premium` to drive subscriptions, keep 1–2 free.
- Raise/lower a node's `capacity` via `PATCH /admin/nodes/:code`.
- Retire a node with `DELETE /admin/nodes/:code` (existing sessions just
  reconnect elsewhere).

## Keeping "no-logs" true

The node only needs WireGuard's in-memory peer table. Don't add packet logging,
don't ship `iptables -j LOG` rules, and set your syslog to not retain
connection data. The agent itself logs only peer add/remove, not traffic.
