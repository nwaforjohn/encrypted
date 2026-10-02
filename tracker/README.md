# 👛 FundTrack

A simple, shared budget and expense tracker for a household — reachable from
every family member's phone or laptop over a **permanent public link**.

## Permanent link (recommended) — Tailscale Funnel

The free Cloudflare quick tunnel rotates its URL and drops often. For a URL
that never changes and survives reboots, use **Tailscale Funnel**:

1. Install Tailscale: <https://tailscale.com/download> (or `brew install --cask tailscale`).
2. Open the Tailscale app and **sign in** (free account).
3. Run:

   ```bash
   cd tracker
   TRACKER_ADMIN_PASSWORD="your-admin-pw" \
   TRACKER_FAMILY_PASSWORD="your-family-pw" \
   ./tailscale-setup.sh
   ```

It runs the app in the background and prints two permanent links off one URL:

```
  ADMIN  link:  https://<your-mac>.<tailnet>.ts.net/admin
  FAMILY link:  https://<your-mac>.<tailnet>.ts.net/
```

Same base URL for everyone; `/admin` shows the admin sign-in, `/` shows the
family sign-in. The link is stable forever. Turn it off with
`tailscale funnel --https=443 off`.

---

### Alternative: Cloudflare quick tunnel (temporary URL)

- **Zero runtime dependencies** — just Node (built-in `http`), data in a JSON file.
- **Admin-managed accounts** — the admin logs in with the admin password and
  creates a secure login (email/username + password) for each family member.
- **Family is view-only** — family members see the whole dashboard but can't
  move money. To add (credit) or subtract (debit), they **send the admin a
  request**; the admin approves it and the balance updates.
- **One public link** — the same link for everyone; who you log in as decides
  what you can do.
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
| Family chat (send & read)                  |  ✅   |   ✅   |
| Export CSV                                  |  ✅   |   ✅   |
| **Request** a credit / debit               |  —    |   ✅   |
| Add / edit / delete transactions           |  ✅   |   —    |
| Approve / decline family requests          |  ✅   |   —    |
| Create / delete family accounts            |  ✅   |   —    |
| Log bill payments, contribute to goals     |  ✅   |   —    |
| Add / remove members (profiles)            |  ✅   |   —    |
| Add / edit / delete categories & budgets   |  ✅   |   —    |
| Create / delete bills & savings goals      |  ✅   |   —    |
| Clear all chat messages                    |  ✅   |   —    |

These are enforced on the server, not just hidden in the UI.

## How family accounts & requests work

1. **Admin signs in** with the admin password (leave the email/username box empty).
2. In **🔐 Family accounts**, the admin creates a login for each member
   (display name, username, optional email, password).
3. **Family signs in** with their email/username + password and gets a
   **view-only** dashboard.
4. When a family member wants money added or removed, they use **✋ Request a
   change** (credit = add, debit = subtract). It also drops a line in the chat.
5. The admin sees it under **📥 Requests** and taps **Approve** (which creates
   the transaction) or **Decline**.

> The old shared `TRACKER_FAMILY_PASSWORD` still works as a generic view-only
> family login. To go accounts-only, set it empty (`TRACKER_FAMILY_PASSWORD=""`)
> and rely on the per-member accounts.

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
