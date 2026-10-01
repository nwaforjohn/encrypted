# Social layer (Instagram-style) + owner revenue

This app now ships a photo-sharing social network on top of the existing
messenger, with **four revenue streams for the app owner**. This document
covers the data model, the API, the screens, and how each revenue stream
flows end-to-end.

## Features

- **Photo & video posts** with captions (`POST /posts`; `mediaType` is
  `image` or `video`).
- **Home feed** of people you follow + your own posts, with active
  sponsored/promoted posts boosted to the top (`GET /posts/feed`).
- **Stories** (24h), photo or video, with a seen/unseen ring and a full-screen
  auto-advancing viewer (`POST /stories`, `GET /stories`, `POST /stories/:id/view`).
- **Explore**: a discovery grid of recent public posts, plus people search in
  one tab (`GET /posts/explore`, `GET /profiles/search`).
- **Likes** (`POST/DELETE /posts/:id/like`) with optimistic UI.
- **Comments** (`GET/POST /posts/:id/comments`).
- **Follow / unfollow**, followers & following lists
  (`/profiles/:username/follow`, `/followers`, `/following`).
- **Profiles**: avatar, display name, bio, post grid, counts, verified badge,
  creator balance. Edit your own (`PUT /profiles/me`).
- **Device uploads**: pick a photo or short video from the library and upload
  it (`POST /uploads`, multipart).

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

## Media (photos & videos)

Posts, stories and avatars reference a media **URL** (`image_url`) plus a
`media_type` of `image` or `video`. You can either paste a public link or pick
from the device library and upload.

**Upload pipeline** (`POST /uploads`, `server/src/routes/uploads.ts`):
- The client picks with `expo-image-picker` and uploads via
  `multipart/form-data` (field `file`) — see `src/media/upload.ts`. Videos
  stream up without base64 bloat.
- The server (multer) writes the file to `UPLOADS_DIR` (default
  `<server>/uploads`), serves it statically at `/uploads/<name>`, and returns
  `{ url, mediaType }`. Limits: 100 MB, images + `mp4`/`mov`/`webm` video.
- Videos play via `expo-av` (`src/components/MediaView.tsx`) in the feed, post
  detail and story viewer.

> **Production storage**: local disk is fine for development but is ephemeral
> on hosts like Render (uploads vanish on redeploy). For production, swap the
> `multer` disk write for a stream to **S3 / Cloudinary / R2** and return that
> URL — nothing else in the pipeline changes. Set `PUBLIC_URL` when the server
> is behind a proxy/CDN so absolute URLs are correct.

## Stories

- `POST /stories` creates a 24h story (image or video); expiry is the schema
  default (`now() + 24h`).
- `GET /stories` returns active stories from you + people you follow, grouped
  by author and ordered (yours first, then unseen, then most recent). Each
  group carries `hasUnseen` to drive the ring color.
- `POST /stories/:id/view` marks a story seen.
- Client: `useStoriesStore`, the `StoryTray` rail atop the feed, and the
  full-screen `StoryViewer` (tap right/left to advance, auto-advance on a
  timer, silent-start video).

## Pricing

Prices live in two places that must stay in sync:

- **Client**: `src/monetization/products.ts` (display + which SKUs exist).
- **Server**: `server/src/revenue.ts` `PRICE_CENTS` (authoritative amount
  booked to the ledger when a consumable receipt is verified).

They must also match the products you create in Google Play Console / App Store
Connect, keyed by SKU.

## Key files

**Server** (`server/src/`)
- `routes/posts.ts` — posts, feed, explore, likes, comments
- `routes/stories.ts` — 24h stories
- `routes/profiles.ts` — profiles, follow graph, search
- `routes/uploads.ts` — multipart image/video upload (multer)
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
- `media/upload.ts` — pick (expo-image-picker) + multipart upload
- `store/useFeedStore.ts` — feed state + optimistic likes
- `store/useStoriesStore.ts` — stories rail + seen tracking
- `screens/` — `FeedScreen`, `ExploreScreen`, `NewPostScreen`,
  `PostDetailScreen`, `StoryViewerScreen`, `ProfileScreen`, `EditProfileScreen`,
  `UserListScreen`, `AdminRevenueScreen`
- `components/` — `PostCard`, `MediaView` (image/video), `Avatar`, `FeedAd`,
  `StoryTray`, `PurchaseSheet`
- `monetization/iap.ts` — tips & promotions (consumables)
