-- ============================================================================
--  AuroraVPN — control-plane database schema (PostgreSQL)
--  Auto-applied on boot by src/db.ts. Safe to run repeatedly (idempotent).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
--  Users / accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  -- role: 'user' or 'admin'. The first registered user can be promoted via
  -- the ADMIN_EMAIL env var (see src/auth/routes).
  role            TEXT NOT NULL DEFAULT 'user',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
--  Devices — each install registers a device with its own WireGuard keypair.
--  The PRIVATE key never leaves the device; we only store its PUBLIC key.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'device',
  platform        TEXT NOT NULL DEFAULT 'unknown',   -- ios | android | web
  public_key      TEXT NOT NULL,                     -- WireGuard public key
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ,
  UNIQUE (user_id, public_key)
);

-- ---------------------------------------------------------------------------
--  VPN nodes (exit servers). Each row is one machine running the node agent.
--  premium=true nodes are only offered to paying subscribers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,              -- e.g. 'us-nyc-1'
  country         TEXT NOT NULL,                     -- ISO-3166 alpha-2, e.g. 'US'
  country_name    TEXT NOT NULL,                     -- 'United States'
  city            TEXT NOT NULL,                     -- 'New York'
  -- Public tunnel endpoint the app dials (host:port of the WireGuard listener).
  endpoint_host   TEXT NOT NULL,
  endpoint_port   INTEGER NOT NULL DEFAULT 51820,
  public_key      TEXT NOT NULL,                     -- node's WireGuard public key
  -- Control URL + shared secret the control plane uses to add/remove peers.
  agent_url       TEXT NOT NULL,                     -- https://ip:8443
  agent_secret    TEXT NOT NULL,
  -- IP pool the node hands out to peers, e.g. '10.7.0.0/24'
  subnet_cidr     TEXT NOT NULL DEFAULT '10.7.0.0/24',
  premium         BOOLEAN NOT NULL DEFAULT false,
  capacity        INTEGER NOT NULL DEFAULT 250,      -- max concurrent peers
  load            INTEGER NOT NULL DEFAULT 0,        -- current peer count (updated on provision)
  enabled         BOOLEAN NOT NULL DEFAULT true,
  healthy         BOOLEAN NOT NULL DEFAULT false,
  last_health_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  Sessions — a live or recent tunnel between a device and a node.
--  Holds the peer's assigned tunnel IP so we can release it on disconnect.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vpn_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  node_id         UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  assigned_ip     TEXT NOT NULL,                     -- e.g. '10.7.0.42/32'
  status          TEXT NOT NULL DEFAULT 'active',    -- active | closed
  rx_bytes        BIGINT NOT NULL DEFAULT 0,
  tx_bytes        BIGINT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_active
  ON vpn_sessions (node_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
--  Subscriptions & entitlements — one row per user, the source of truth for
--  "is this account premium right now?". Fed by Stripe webhooks (web) and by
--  Apple/Google purchase verification (mobile IAP).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan                 TEXT NOT NULL DEFAULT 'free',   -- free | premium
  -- where the money came from
  source               TEXT,                           -- stripe | apple | google
  status               TEXT NOT NULL DEFAULT 'inactive',-- active | trialing | past_due | canceled | inactive
  -- external identifiers for reconciliation
  stripe_customer_id   TEXT,
  stripe_subscription_id TEXT,
  store_product_id     TEXT,
  store_txn_id         TEXT,
  current_period_end   TIMESTAMPTZ,                    -- premium is valid until this
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
--  Payments ledger — every money event, for the admin revenue dashboard.
--  amount_cents is in the smallest currency unit (e.g. cents).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  source          TEXT NOT NULL,                     -- stripe | apple | google
  kind            TEXT NOT NULL DEFAULT 'subscription', -- subscription | one_time | refund
  plan            TEXT,                              -- premium_monthly | premium_yearly | ...
  amount_cents    BIGINT NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'usd',
  external_id     TEXT,                              -- stripe invoice id / store txn id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at);
-- Prevent double-counting the same external event.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external
  ON payments (source, external_id) WHERE external_id IS NOT NULL;
