# 👛 Family Money Tracker

A simple, shared budget and expense tracker for a household — reachable from
every family member's phone or laptop over a **public Cloudflare tunnel**.

- **Zero runtime dependencies** — just Node (built-in `http`), data in a JSON file.
- **Two roles, one public link** — an **admin** password (full control) and a
  **family** password (add/view + chat only). The link is the same for everyone;
  the password decides the role.
- **Built-in chat** — admin and family can message each other live inside the app;
  admin can clear the whole chat.
- **Track** income and expenses per family member, by category. All amounts in **USD**.
- **Budgets** — set a monthly limit per category and watch the bars fill up.
- **Recurring bills** — save bills once, then log each payment with one tap.
- **Savings goals** — set a target and watch progress as the family contributes.
- **Charts** — spending by category and a 6-month income-vs-spending trend.
- **CSV export** — download every transaction for a spreadsheet or taxes.
- **Dashboard** — income, spending, net, per-member and per-category breakdowns,
  month-by-month.
- **Autostart** — optional macOS login item so it runs without touching a terminal.

## Quick start

```bash
cd tracker
TRACKER_ADMIN_PASSWORD="your-admin-secret" \
TRACKER_FAMILY_PASSWORD="your-family-secret" \
./start.sh
```

This will:
1. start the app on `http://localhost:4000`, and
2. open a public Cloudflare quick tunnel and print a link like
   `https://brave-river-1234.trycloudflare.com`.

It then prints something like:

```
  ADMIN  link:  https://brave-river-1234.trycloudflare.com
         password:  your-admin-secret   (full control)

  FAMILY link:  https://brave-river-1234.trycloudflare.com
         password:  your-family-secret  (add + view + chat)
```

**The link is the same for both** — share the *admin* password only with
yourself and the *family* password with the rest of the household. Press
`Ctrl+C` to stop.

> `start.sh` downloads the `cloudflared` binary automatically if it isn't
> already installed.

### Run locally only (no public link)

```bash
NO_TUNNEL=1 ./start.sh        # or:  npm start
```

## Configuration

| Env var                   | Default  | Purpose                                             |
| ------------------------- | -------- | --------------------------------------------------- |
| `TRACKER_ADMIN_PASSWORD`  | `admin`  | Admin login (full control) — **change this**.       |
| `TRACKER_FAMILY_PASSWORD` | `family` | Family login (add/view + chat) — **change this**.   |
| `TRACKER_PASSWORD`        | —        | Fallback used for the admin password if the specific one is unset. |
| `PORT`                    | `4000`   | Local port.                                         |
| `TRACKER_CURRENCY`        | `$`      | Currency symbol (USD by default).                   |
| `TRACKER_SECRET`          | random   | Session-cookie signing key (persisted by `start.sh` in `data/.secret`). |
| `NO_TUNNEL`               | `0`      | Set to `1` to skip the public tunnel.               |

## Roles

| Capability                                | Admin | Family |
| ----------------------------------------- | :---: | :----: |
| View dashboard, charts, budgets, history   |  ✅   |   ✅   |
| Add income / expense                       |  ✅   |   ✅   |
| Family chat (send & read)                  |  ✅   |   ✅   |
| Log a recurring-bill payment               |  ✅   |   ✅   |
| Contribute to a savings goal               |  ✅   |   ✅   |
| Export CSV                                  |  ✅   |   ✅   |
| Delete transactions                        |  ✅   |   —    |
| Add / remove members (profiles)            |  ✅   |   —    |
| Add / edit / delete categories & budgets   |  ✅   |   —    |
| Create / delete recurring bills            |  ✅   |   —    |
| Create / delete savings goals              |  ✅   |   —    |
| Clear all chat messages                    |  ✅   |   —    |

These are enforced on the server, not just hidden in the UI.

## Autostart (macOS)

Run it once as a login item so you never need a terminal again:

```bash
cd tracker
TRACKER_ADMIN_PASSWORD="your-admin-secret" \
TRACKER_FAMILY_PASSWORD="your-family-secret" \
./install-autostart.sh
```

It installs a `launchd` LaunchAgent that starts the app + tunnel at login and
restarts them if they crash. Because the free tunnel URL changes on each
restart, the current link is always written to:

```
tracker/data/public-url.txt      # cat this to get today's link
tracker/data/autostart.log       # logs
```

Remove it with `./install-autostart.sh --uninstall`. For a link that never
changes, ask about a named Cloudflare tunnel (free, needs a Cloudflare account).

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
