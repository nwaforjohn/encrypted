# AuroraVPN 🛡️

A full, NordVPN-style VPN product you can run and (after the store/infra steps
below) publish: a **marketing website**, an **iOS + Android app**, a **control-plane
backend**, a **turnkey exit-node installer**, and an **admin revenue dashboard**.

It uses **WireGuard** — the same modern protocol NordVPN's "NordLynx" is built on —
for fast, device-wide encryption.

> **Read this first — what software can and can't do for you.**
> A VPN carries real traffic only if there are real servers to carry it. This
> repo gives you *all the software* plus a one-command installer that turns a
> cheap VPS into a working encrypted exit node. What only **you** can do (and
> what costs money) is: **rent the servers**, **enrol in the Apple/Google
> developer programs**, and **submit the apps**. Those steps are documented
> precisely in [`docs/`](docs). There is no way to make a VPN "work great"
> without exit servers somewhere — but with this, standing them up is one script.

---

## The four pieces

| Folder | What it is | Status |
|---|---|---|
| [`backend/`](backend) | Control plane — accounts, subscriptions (Stripe + App/Play IAP), server catalog, **WireGuard peer auto-provisioning**, admin revenue API. Node + Express + PostgreSQL. | ✅ runs now |
| [`infra/`](infra) | `install-vpn-node.sh` turns a bare VPS into a WireGuard exit node + a secure agent the backend calls to add/remove tunnels. | ✅ run on a VPS |
| [`website/`](website) | Marketing site + account dashboard + **admin revenue dashboard**. Static HTML/CSS/JS that talks to the backend. | ✅ runs now |
| [`app/`](app) | The iOS/Android app: big connect toggle, server picker, premium paywall, kill-switch settings. Expo + React Native. Generates a real WireGuard keypair on-device. | ✅ runs in dev; needs a native tunnel module + store enrolment to ship |

## How it fits together (the NordVPN model)

```
   ┌────────────┐      HTTPS       ┌─────────────────────┐    HTTPS (agent)   ┌──────────────────┐
   │  App / Web │ ───────────────► │   Control plane     │ ─────────────────► │  Exit node (VPS) │
   │  (client)  │  login, pick     │   (backend/)        │  "add this peer"   │  WireGuard + agent│
   │            │  location, pay   │                     │                    │                  │
   │  WireGuard │ ◄─ returns a ──  │  accounts, billing, │                    │  install-vpn-node│
   │   tunnel   │   wg config      │  server catalog,    │                    │  .sh set this up │
   └─────┬──────┘                  │  admin revenue      │                    └────────┬─────────┘
         │                         └─────────────────────┘                             │
         └──────────── encrypted WireGuard tunnel (UDP 51820) ─────────────────────────┘
                              all device traffic exits here
```

- The **device** makes its own WireGuard keypair; the **private key never leaves it**.
- The **control plane** decides which node a user may use (free vs premium =
  their subscription), allocates a tunnel IP, and tells the node's **agent** to
  accept that device's public key.
- The **exit node** is where traffic leaves to the internet — this is what hides
  the user's IP and gives them the "server location".
- **Money**: Stripe on the web, Apple/Google in-app purchase on mobile. Every
  payment lands in the `payments` ledger behind the admin dashboard.

## Quick start (everything local, no servers needed)

```bash
# 1) Backend + Postgres
cd vpn/backend
cp .env.example .env            # set JWT_SECRET and ADMIN_EMAIL (your email!)
docker compose up --build       # API on http://localhost:8080

# 2) Website (new terminal)
cd vpn/website
node serve.js                   # http://localhost:5173

# 3) App (new terminal) — needs Node + the Expo tooling
cd vpn/app
npm install
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 npm run android   # or: npm run ios
```

Register an account on the website or app. Register with the **same email you
set as `ADMIN_EMAIL`** to unlock the admin revenue dashboard at
`http://localhost:5173/admin.html`.

Out of the box there are no live servers, so "Connect" will report no node
available. To test the whole connect flow locally, add a **mock node**:

```bash
# get your admin token first (log in on the site, copy aurora_token from devtools localStorage)
curl -X POST http://localhost:8080/admin/nodes \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "content-type: application/json" \
  -d '{"code":"mock-1","country":"US","countryName":"United States","city":"Test",
       "endpointHost":"127.0.0.1","publicKey":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
       "agentUrl":"mock://local","agentSecret":"x"}'
```

A `mock://` node makes the control plane simulate the node agent, so the app's
connect → config → disconnect flow works end-to-end with no real VPS. The app
itself also falls back to a mock tunnel when no native WireGuard module is
present (traffic is not actually encrypted in that mode — it's for UI testing).

## Going live — the real-world checklist

1. **Rent 1+ VPS** and run [`infra/install-vpn-node.sh`](infra/install-vpn-node.sh)
   on each → see [`docs/SERVERS.md`](docs/SERVERS.md).
2. **Deploy the backend** with a managed Postgres → see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
3. **Turn on payments** (Stripe + store products) → see [`docs/REVENUE.md`](docs/REVENUE.md).
4. **Build & submit the apps** (Apple/Google enrolment, the VPN entitlement, the
   native tunnel module) → see [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Legal & honesty notes

- Running a VPN carries responsibilities (privacy policy, a truthful logging
  policy, abuse handling, local law). The site ships with placeholder legal
  pages — replace them with real, lawyer-reviewed documents before launch.
- "No-logs" must be *true*: the architecture relays packets and does not record
  browsing, but you must make sure your hosting, the agent, and your own
  monitoring don't quietly log traffic.
- Don't claim speeds, jurisdictions, or audits you can't back up.
- "WireGuard" is a registered trademark of Jason A. Donenfeld; the standard
  attribution is already in the site footer.
