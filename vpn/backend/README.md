# AuroraVPN backend (control plane)

Node + Express + PostgreSQL. Accounts, subscriptions, server catalog, WireGuard
peer provisioning, admin revenue.

## Run

```bash
cp .env.example .env     # set JWT_SECRET + ADMIN_EMAIL
docker compose up --build
# API on http://localhost:8080  (schema auto-applies, catalog auto-seeds)
```

Or without Docker: `npm install && npm run dev` (needs a Postgres in
`DATABASE_URL`).

## API reference

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{email,password}` | returns `{token,user}`; the `ADMIN_EMAIL` account gets role `admin` |
| POST | `/auth/login` | `{email,password}` | returns `{token,user}` |
| GET | `/auth/me` | — | 🔒 current user + entitlement |

### Servers & VPN (🔒 = Bearer token)
| Method | Path | Notes |
|---|---|---|
| GET | `/servers` | public location catalog |
| POST | `/vpn/devices` 🔒 | register a device public key → `{deviceId}` |
| GET | `/vpn/devices` 🔒 | list caller's devices |
| POST | `/vpn/connect` 🔒 | `{deviceId,publicKey,code?,country?}` → WireGuard config; `402` if a premium node needs premium |
| POST | `/vpn/disconnect` 🔒 | `{sessionId,publicKey}` |
| GET | `/vpn/sessions` 🔒 | recent sessions |

### Billing
| Method | Path | Notes |
|---|---|---|
| GET | `/billing/plans` | plan list |
| POST | `/billing/checkout` 🔒 | `{plan}` → Stripe Checkout URL |
| POST | `/billing/portal` 🔒 | Stripe billing portal URL |
| POST | `/billing/webhook` | Stripe webhook (raw body, signature-verified) |
| POST | `/billing/iap/apple` 🔒 | `{receipt}` verify App Store purchase |
| POST | `/billing/iap/google` 🔒 | `{productId,purchaseToken}` verify Play purchase |
| GET | `/billing/status` 🔒 | current entitlement |

### Account & Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/account` 🔒 | dashboard payload |
| GET | `/admin/overview` 🔑 | revenue + fleet (admin only) |
| GET | `/admin/users` 🔑 | user list |
| POST | `/admin/nodes` 🔑 | register an exit node |
| PATCH | `/admin/nodes/:code` 🔑 | enable/premium/capacity |
| DELETE | `/admin/nodes/:code` 🔑 | remove a node |

## Layout

```
src/
  index.ts              app wiring + node health loop
  db.ts                 pg pool, schema apply, seed
  auth/                 jwt + middleware
  routes/               auth, servers, vpn, account, subscriptions, admin
  vpn/
    wireguard.ts        IP allocation + client config builder
    nodeClient.ts       calls each exit node's agent (supports mock://)
    provisioning.ts     connect/disconnect orchestration
  billing/
    entitlements.ts     subscriptions + payments ledger
    stripe.ts           checkout, portal, webhooks
    iap.ts              Apple/Google receipt verification
  admin/stats.ts        revenue aggregates
db/schema.sql           tables (idempotent)
seed/servers.sql        placeholder location catalog
```
