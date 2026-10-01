# Social layer (Instagram-style) + owner revenue

This app now ships a photo-sharing social network on top of the existing
messenger, with **four revenue streams for the app owner**. This document
covers the data model, the API, the screens, and how each revenue stream
flows end-to-end.

## Features (Core MVP)

- **Photo posts** with captions (`POST /posts`).
- **Home feed** of people you follow + your own posts, with active
  sponsored/promoted posts boosted to the top (`GET /posts/feed`).
- **Likes** (`POST/DELETE /posts/:id/like`) with optimistic UI.
- **Comments** (`GET/POST /posts/:id/comments`).
- **Follow / unfollow**, followers & following lists
  (`/profiles/:username/follow`, `/followers`, `/following`).
- **Profiles**: avatar, display name, bio, post grid, counts, verified badge,
  creator balance. Edit your own (`PUT /profiles/me`).
- **Discover**: search people by username / name (`GET /profiles/search`).

## Revenue streams

All money moves through the app stores (StoreKit / Play Billing) and AdMob.
The server keeps its own **ledger** (`admin_earnings`) so the owner can see
earnings in-app. Reconcile the ledger against your store payout reports for
exact figures (store commission and taxes are applied by the stores).

| # | Stream | How it works | Where booked |
|---|--------|--------------|--------------|
| 1 | **Sponsored / promoted posts** | Owner places sponsored posts (admin dashboard) that appear in every feed. Any user can pay to promote their own post for a window (`promote_24h/72h/7d`). | `admin_earnings.source = 'promotion'` — full amount |
| 2 | **Feed ads** | AdMob ads interleaved in the feed (every 5 posts). Impressions are logged for an in-app estimate; AdMob pays the real revenue. | estimated from `ad_impressions` × `AD_ECPM_CENTS` |
| 3 | **Pro subscription** | `pro_monthly` / `pro_yearly`. Grants verified badge, no ads, large uploads, etc. | `admin_earnings.source = 'subscription'` |
| 4 | **Creator tips** | Users tip creators (`tip_small/medium/large`). Platform keeps `PLATFORM_CUT_PERCENT`; the rest is credited to the creator's payout balance. | `admin_earnings.source = 'tip_cut'` — the platform's cut |

The owner sees all of this in **Profile → 💰 Revenue** (the `AdminRevenue`
screen, `GET /admin/revenue`): total revenue, a per-stream breakdown, headline
counts, recent ledger entries, and a composer to publish sponsored posts.

### Becoming an admin

Set `ADMIN_USERNAMES` in the server env (comma/space separated). Matching
accounts get `is_admin = true` on register/login, which unlocks the `/admin`
endpoints and the in-app Revenue dashboard. The flag self-heals on login, so
adding a username to the env promotes an existing account on its next login.

## Consumable purchase flow (tips & promotions)

Tips and promotions are **consumable** IAP products (bought repeatedly). The
client registers an intent (who to tip / which post to promote) right before
`requestPurchase`, then the global purchase listener forwards the verified
receipt to the backend:

1. UI calls `tipCreator(sku, toUserId, postId?)` or `promotePost(sku, postId)`
   (`src/monetization/iap.ts`), which records a pending intent and requests the
   purchase.
2. The store completes the purchase; the purchase listener sees a consumable
   SKU and POSTs to `/tips` or `/promotions` with the receipt.
3. The server verifies the receipt, dedupes on `purchase_token` (UNIQUE, so a
   replay is a no-op), books revenue, credits the creator (tips), and extends
   the boost window (promotions).
4. The transaction is finished as consumable so it can be bought again.

> In **DEV mode** (no `GOOGLE_SERVICE_ACCOUNT_JSON` / `APPLE_SHARED_SECRET`
> set) the server trusts the client receipt so the whole flow is testable
> end-to-end, and logs a warning. Set the store credentials before taking real
> payments — see [`MONETIZATION.md`](MONETIZATION.md).

## Images

Posts and avatars reference an **image URL** (`image_url`, `avatar_url`). For
the MVP you paste a public link. To add device photo upload, drop an uploader
(e.g. `expo-image-picker` + an S3/Cloudinary/R2 signed-upload endpoint) into
`NewPostScreen` / `EditProfileScreen` and store the returned URL — the rest of
the pipeline is unchanged.

## Pricing

Prices live in two places that must stay in sync:

- **Client**: `src/monetization/products.ts` (display + which SKUs exist).
- **Server**: `server/src/revenue.ts` `PRICE_CENTS` (authoritative amount
  booked to the ledger when a consumable receipt is verified).

They must also match the products you create in Google Play Console / App Store
Connect, keyed by SKU.

## Key files

**Server** (`server/src/`)
- `routes/posts.ts` — posts, feed, likes, comments
- `routes/profiles.ts` — profiles, follow graph, search
- `routes/tips.ts` — creator tips (stream 4)
- `routes/promotions.ts` — user-paid promotions (stream 1)
- `routes/admin.ts` — revenue dashboard + sponsored posts (streams 1 & reporting)
- `routes/ads.ts` — ad impression logging (stream 2)
- `routes/purchases.ts` — subscriptions mark verified + book revenue (stream 3)
- `revenue.ts` — price map, platform-cut math, ledger + creator-balance helpers
- `serialize.ts` — shared wire shapes
- `auth/admin.ts` — admin gate
- `db/schema.sql` — tables (applied idempotently on startup)

**Client** (`src/`)
- `api/social.ts` — typed API wrappers
- `store/useFeedStore.ts` — feed state + optimistic likes
- `screens/` — `FeedScreen`, `DiscoverScreen`, `NewPostScreen`,
  `PostDetailScreen`, `ProfileScreen`, `EditProfileScreen`, `UserListScreen`,
  `AdminRevenueScreen`
- `components/` — `PostCard`, `Avatar`, `FeedAd`, `PurchaseSheet`
- `monetization/iap.ts` — tips & promotions (consumables)
