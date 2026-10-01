-- Schema is applied automatically on server startup (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  public_key    TEXT NOT NULL,
  push_token    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store-and-forward mailbox. The server only ever stores ciphertext; it cannot
-- read message contents (end-to-end encryption).
CREATE TABLE IF NOT EXISTS messages (
  id                BIGSERIAL PRIMARY KEY,
  sender_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_public_key TEXT NOT NULL,
  ciphertext        TEXT NOT NULL,
  nonce             TEXT NOT NULL,
  delivered         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON messages (recipient_id, delivered);

-- Server-verified purchases. This is the source of truth for paid features.
CREATE TABLE IF NOT EXISTS entitlements (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  platform       TEXT NOT NULL,
  purchase_token TEXT NOT NULL,
  expires_at     TIMESTAMPTZ,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sku)
);

-- ===========================================================================
-- Social layer (Instagram-style photo sharing) + owner revenue.
-- Added incrementally with ALTER ... IF NOT EXISTS so existing databases
-- upgrade in place on startup.
-- ===========================================================================

-- Public profile fields layered onto the existing account row.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio          TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
-- is_admin gates the owner-only revenue/admin endpoints.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin     BOOLEAN NOT NULL DEFAULT false;
-- is_verified is the "blue check" perk granted by an active Pro subscription.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified  BOOLEAN NOT NULL DEFAULT false;

-- Photo posts.
CREATE TABLE IF NOT EXISTS posts (
  id             BIGSERIAL PRIMARY KEY,
  author_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url      TEXT NOT NULL,
  caption        TEXT NOT NULL DEFAULT '',
  -- Revenue stream #1: sponsored (owner-placed) / promoted (user-paid) posts.
  is_sponsored   BOOLEAN NOT NULL DEFAULT false,
  promoted_until TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

-- Follow graph.
CREATE TABLE IF NOT EXISTS follows (
  follower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id);

-- Likes (one per user per post).
CREATE TABLE IF NOT EXISTS likes (
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Comments.
CREATE TABLE IF NOT EXISTS comments (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at ASC);

-- Revenue stream #4: creator tips. The platform keeps a configurable cut and
-- the remainder is credited to the creator's payout balance.
CREATE TABLE IF NOT EXISTS tips (
  id                 BIGSERIAL PRIMARY KEY,
  from_user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id            BIGINT REFERENCES posts(id) ON DELETE SET NULL,
  gross_cents        INTEGER NOT NULL,
  platform_cut_cents INTEGER NOT NULL,
  creator_net_cents  INTEGER NOT NULL,
  sku                TEXT NOT NULL,
  platform           TEXT NOT NULL,
  purchase_token     TEXT NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tips_to ON tips (to_user_id, created_at DESC);

-- A creator's accrued (net-of-cut) balance available for payout.
CREATE TABLE IF NOT EXISTS creator_balances (
  user_id        BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_cents  INTEGER NOT NULL DEFAULT 0,
  lifetime_cents INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue stream #1 (user-paid promotions): one row per promotion purchase.
-- purchase_token is UNIQUE so a replayed receipt can't be billed twice.
CREATE TABLE IF NOT EXISTS promotions (
  id             BIGSERIAL PRIMARY KEY,
  post_id        BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  buyer_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  hours          INTEGER NOT NULL,
  platform       TEXT NOT NULL,
  purchase_token TEXT NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue stream #2: feed ad impressions (for an in-app revenue estimate;
-- actual payout is reported by AdMob).
CREATE TABLE IF NOT EXISTS ad_impressions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  placement  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created ON ad_impressions (created_at DESC);

-- Unified owner-revenue ledger spanning every stream. source is one of
-- 'promotion' | 'subscription' | 'tip_cut' | 'ad'.
CREATE TABLE IF NOT EXISTS admin_earnings (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ref          TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_earnings_source ON admin_earnings (source, created_at DESC);
