#!/usr/bin/env bash
# ============================================================================
#  AuroraVPN — turnkey exit-node installer (Ubuntu/Debian).
#
#  Run this on a fresh VPS (any $4–6/mo cloud box works) as root. It:
#    1. installs WireGuard + Node.js
#    2. turns on IP forwarding and NAT (so tunneled traffic reaches the internet)
#    3. generates the server's WireGuard keypair + a wg0 interface
#    4. generates a TLS cert + shared secret for the node agent
#    5. installs the node agent as a systemd service
#    6. prints the exact command to register this node with your control plane
#
#  Usage:
#     sudo ./install-vpn-node.sh \
#        --code us-nyc-1 --country US --country-name "United States" \
#        --city "New York" --endpoint YOUR.SERVER.PUBLIC.IP [--premium]
# ============================================================================
set -euo pipefail

CODE=""; COUNTRY=""; COUNTRY_NAME=""; CITY=""; ENDPOINT=""; PREMIUM="false"
WG_PORT="51820"; AGENT_PORT="8443"; SUBNET="10.7.0.0/24"; WG_ADDR="10.7.0.1/24"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --code) CODE="$2"; shift 2;;
    --country) COUNTRY="$2"; shift 2;;
    --country-name) COUNTRY_NAME="$2"; shift 2;;
    --city) CITY="$2"; shift 2;;
    --endpoint) ENDPOINT="$2"; shift 2;;
    --wg-port) WG_PORT="$2"; shift 2;;
    --agent-port) AGENT_PORT="$2"; shift 2;;
    --premium) PREMIUM="true"; shift;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ $EUID -ne 0 ]]; then echo "Run as root (sudo)."; exit 1; fi
for v in CODE COUNTRY COUNTRY_NAME CITY ENDPOINT; do
  if [[ -z "${!v}" ]]; then echo "Missing --${v,,}"; exit 1; fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo ">> Installing packages (wireguard, nodejs, iproute2)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y wireguard iproute2 curl openssl
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo ">> Enabling IP forwarding…"
cat >/etc/sysctl.d/99-auroravpn.conf <<EOF
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
EOF
sysctl --system >/dev/null

# Detect the egress network interface (the one with the default route).
EGRESS_IF="$(ip route show default | awk '/default/ {print $5; exit}')"
echo ">> Egress interface: ${EGRESS_IF}"

echo ">> Generating WireGuard keys…"
umask 077
mkdir -p /etc/wireguard /etc/auroravpn
SERVER_PRIV="$(wg genkey)"
SERVER_PUB="$(echo "$SERVER_PRIV" | wg pubkey)"

cat >/etc/wireguard/wg0.conf <<EOF
[Interface]
Address = ${WG_ADDR}
ListenPort = ${WG_PORT}
PrivateKey = ${SERVER_PRIV}
# NAT so peers can reach the internet through this box, then clean up on down.
PostUp   = iptables -t nat -A POSTROUTING -s ${SUBNET} -o ${EGRESS_IF} -j MASQUERADE; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -s ${SUBNET} -o ${EGRESS_IF} -j MASQUERADE; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT
EOF

systemctl enable --now wg-quick@wg0
echo ">> WireGuard up on udp/${WG_PORT}"

echo ">> Generating node-agent TLS cert + secret…"
AGENT_SECRET="$(openssl rand -hex 32)"
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout /etc/auroravpn/agent.key -out /etc/auroravpn/agent.crt \
  -subj "/CN=${ENDPOINT}" >/dev/null 2>&1

echo ">> Installing node agent…"
mkdir -p /opt/auroravpn
cp "${SCRIPT_DIR}/wg-node-agent/src/agent.js" /opt/auroravpn/agent.js

cat >/etc/systemd/system/auroravpn-agent.service <<EOF
[Unit]
Description=AuroraVPN node agent
After=network-online.target wg-quick@wg0.service
Wants=network-online.target

[Service]
Environment=AGENT_SECRET=${AGENT_SECRET}
Environment=AGENT_PORT=${AGENT_PORT}
Environment=WG_INTERFACE=wg0
Environment=WG_SERVER_PUBKEY=${SERVER_PUB}
Environment=TLS_CERT=/etc/auroravpn/agent.crt
Environment=TLS_KEY=/etc/auroravpn/agent.key
ExecStart=/usr/bin/node /opt/auroravpn/agent.js
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now auroravpn-agent

# Open firewall if ufw is active.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow ${WG_PORT}/udp || true
  ufw allow ${AGENT_PORT}/tcp || true
fi

cat <<EOF

============================================================================
  ✅  Node ready. Register it with your control plane (admin token required):

  curl -X POST "\$CONTROL_PLANE_URL/admin/nodes" \\
    -H "Authorization: Bearer \$ADMIN_JWT" \\
    -H "content-type: application/json" \\
    -d '{
      "code": "${CODE}",
      "country": "${COUNTRY}",
      "countryName": "${COUNTRY_NAME}",
      "city": "${CITY}",
      "endpointHost": "${ENDPOINT}",
      "endpointPort": ${WG_PORT},
      "publicKey": "${SERVER_PUB}",
      "agentUrl": "https://${ENDPOINT}:${AGENT_PORT}",
      "agentSecret": "${AGENT_SECRET}",
      "subnetCidr": "${SUBNET}",
      "premium": ${PREMIUM}
    }'

  NOTE: the agent uses a self-signed cert. Run the control plane with
  AGENT_INSECURE_TLS=1 (fine for your own infra) or install a real cert.
============================================================================
EOF
