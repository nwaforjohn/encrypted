# Deploying the control-plane backend

The backend (`vpn/backend`) is a stateless Node/Express service + PostgreSQL. It
runs anywhere that runs Docker or Node 20.

## Option A — Docker (any VPS/host)

```bash
cd vpn/backend
cp .env.example .env     # fill in real values (see below)
docker compose up --build -d
```

This starts Postgres + the API on `:8080`. The schema auto-applies on first
boot. Put it behind a reverse proxy (Caddy/Nginx) with HTTPS — the app and
website must reach it over `https://`.

Minimal Caddy example:

```
api.your-domain.com {
    reverse_proxy localhost:8080
}
```

## Option B — Managed platform (Render / Railway / Fly.io)

- Create a **PostgreSQL** instance; copy its connection string to `DATABASE_URL`.
- Create a **web service** from `vpn/backend` (it has a Dockerfile).
- Set the env vars from `.env.example` in the dashboard.
- The health check path is `/health`.

## Required environment

| Var | Why |
|---|---|
| `JWT_SECRET` | signs login tokens — long random string (`openssl rand -hex 32`) |
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_EMAIL` | the account registered with this email becomes **admin** (revenue dashboard) |
| `CORS_ORIGINS` | your website origin(s), comma-separated, e.g. `https://your-domain.com` |
| `STRIPE_*` | web payments — see [REVENUE.md](REVENUE.md) |
| `APPLE_SHARED_SECRET`, `GOOGLE_*` | mobile IAP verification — see [REVENUE.md](REVENUE.md) |
| `AGENT_INSECURE_TLS=1` | set if your exit nodes use self-signed agent certs |

## Pointing the clients at it

- **Website**: edit the `<meta name="aurora-api" content="...">` tag on each
  page (or set `window.AURORA_API`) to your API URL.
- **App**: set `EXPO_PUBLIC_API_URL` at build time (see `eas.json`), or
  `extra.apiUrl` in `app.config.ts`.

## After deploy

1. Register your `ADMIN_EMAIL` account → visit `/admin.html` → dashboard loads.
2. Stand up a node ([SERVERS.md](SERVERS.md)) and register it.
3. Turn on payments ([REVENUE.md](REVENUE.md)).
4. Smoke test: register a user, connect from the app, confirm `wg show` on the
   node lists the peer.
