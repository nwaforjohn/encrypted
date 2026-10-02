# 👛 Family Money Tracker

A simple, shared budget and expense tracker for a household — reachable from
every family member's phone or laptop over a **public Cloudflare tunnel**.

- **Zero runtime dependencies** — just Node (built-in `http`), data in a JSON file.
- **Shared-password login** — sensible since the link is public.
- **Track** income and expenses per family member, by category.
- **Budgets** — set a monthly limit per category and watch the bars fill up.
- **Dashboard** — income, spending, net, per-member and per-category breakdowns,
  month-by-month.

## Quick start

```bash
cd tracker
TRACKER_PASSWORD="choose-a-family-password" ./start.sh
```

This will:
1. start the app on `http://localhost:4000`, and
2. open a public Cloudflare quick tunnel and print a link like
   `https://brave-river-1234.trycloudflare.com`.

Share that link **and** the password with your family. Press `Ctrl+C` to stop.

> `start.sh` downloads the `cloudflared` binary automatically if it isn't
> already installed.

### Run locally only (no public link)

```bash
NO_TUNNEL=1 ./start.sh        # or:  npm start
```

## Configuration

| Env var            | Default   | Purpose                                   |
| ------------------ | --------- | ----------------------------------------- |
| `TRACKER_PASSWORD` | `family`  | Shared login password — **change this**.  |
| `PORT`             | `4000`    | Local port.                               |
| `TRACKER_CURRENCY` | `$`       | Currency symbol shown in the UI.          |
| `TRACKER_SECRET`   | random    | Session-cookie signing key (persisted by `start.sh` in `data/.secret`). |
| `NO_TUNNEL`        | `0`       | Set to `1` to skip the public tunnel.     |

## Data & privacy

All data lives in `tracker/data/db.json` on the machine running the server —
nothing is sent anywhere except between the browser and your server (relayed by
Cloudflare's edge over HTTPS). The `data/` directory is git-ignored so family
finances are never committed.

Quick (account-less) `trycloudflare.com` tunnels have no uptime guarantee and
get a new random URL each run. For a stable address, create a free
[named Cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
and point it at `http://localhost:4000`.

## Running from a restricted/cloud network

A public tunnel needs outbound access to Cloudflare. If you see
`quick tunnel provisioning failed with status 403`, the network is blocking
`api.trycloudflare.com` (and the tunnel edge hosts). Allow those hosts — or run
`./start.sh` from a machine with normal internet access (e.g. your own laptop).
