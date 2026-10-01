# AuroraVPN website

Static marketing site + account dashboard + admin revenue dashboard. No build
step — plain HTML/CSS/JS that calls the backend API.

## Run

```bash
node serve.js            # http://localhost:5173  (zero dependencies)
# or: python3 -m http.server 5173
```

## Pages

| File | Purpose |
|---|---|
| `index.html` | Marketing landing — hero, features, live locations, CTA |
| `pricing.html` | Plans + Stripe checkout |
| `download.html` | App download links (placeholder store URLs) |
| `account.html` | Log in / sign up + account dashboard (subscription, devices) |
| `admin.html` | **Admin revenue dashboard** (admin accounts only) |
| `assets/` | `styles.css`, `api.js` (API client), `layout.js` (shared nav/footer) |

## Point it at your backend

Each page has `<meta name="aurora-api" content="http://localhost:8080">`. Change
it to your deployed API URL before publishing (or set `window.AURORA_API`).
Make sure that origin is in the backend's `CORS_ORIGINS`.

## Deploy

Any static host works (Netlify, Vercel, Cloudflare Pages, S3, GitHub Pages):
upload the `website/` folder. Serve over HTTPS so it can call your HTTPS API.
