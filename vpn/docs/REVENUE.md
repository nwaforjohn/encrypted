# How you (the admin) earn money

AuroraVPN has one revenue model done two ways, because the app stores require
it: **Stripe** on the web, **in-app purchase** on mobile. Both feed the same
`subscriptions` + `payments` tables, so the **admin revenue dashboard**
(`/admin.html`) shows everything in one place.

```
Web visitor  ──Stripe Checkout──►  premium  ┐
Phone user   ──App Store / Play──►  premium  ├──►  subscriptions + payments  ──►  Admin dashboard
                                             ┘         (source of truth)
```

Pricing shipped as defaults (edit in `backend/src/routes/subscriptions.ts`,
`website/pricing.html`, and the app paywall): **$11.99/mo** or **$71.88/yr**.

---

## 1. Web payments — Stripe

1. Create a [Stripe](https://stripe.com) account (use **test mode** while building).
2. **Products → add product → "AuroraVPN Premium"**, add two recurring prices
   (monthly + yearly). Copy the `price_...` IDs.
3. In the backend `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_YEARLY=price_...
   ```
4. **Webhook**: Stripe dashboard → Developers → Webhooks → add endpoint
   `https://api.your-domain.com/billing/webhook`, subscribe to
   `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`. Copy
   the signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Done — the "Get Premium" buttons open Stripe Checkout, and the webhook flips
   the account to premium and records the payment.

Payouts land in your Stripe balance and auto-transfer to your bank.

## 2. Mobile payments — App Store & Google Play (required on mobile)

Apple and Google **require** digital subscriptions to be sold through their IAP
(you may not send app users to Stripe). They take **15–30%**. You keep the rest.

**Apple (App Store Connect):**
1. Agreements, Tax & Banking → accept the **Paid Apps** agreement, add bank info.
2. Your app → **Subscriptions** → create a group → add products with IDs
   `auroravpn.premium.monthly` and `auroravpn.premium.yearly` (match
   `app/src/billing/iap.ts`).
3. App Store Connect → App Information → generate an **App-Specific Shared
   Secret** → put it in the backend as `APPLE_SHARED_SECRET`.

**Google (Play Console):**
1. Set up a **merchant account** + banking.
2. Monetize → **Subscriptions** → create the two product IDs above.
3. Create a **service account** with Play Developer API access, download its
   JSON, set `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_PACKAGE_NAME`, and finish
   the Google verify function in `backend/src/billing/iap.ts` (it's stubbed with
   the exact API call to make).

The app buys via `react-native-iap`, sends the receipt to
`/billing/iap/apple|google`, the backend verifies it with the store and marks
the account premium.

## 3. The admin dashboard

Log in with your `ADMIN_EMAIL` account and open `/admin.html`:
- Gross revenue, this-month, last-30-days, active subscriptions
- Total vs paying users, transactions, avg revenue per paying user
- 30-day revenue chart
- Recent payments feed (across Stripe + stores)
- Server fleet health & load

All numbers come from the `payments` ledger, which both Stripe webhooks and the
IAP verification write to (idempotently, so no double counting).

## Ideas to grow revenue later

- Multi-year plans, family plans, a 7-day free trial (Stripe + store trials).
- A cheap "1 extra device" add-on.
- Affiliate / referral codes (Stripe promotion codes are already enabled).
- Business/team plans billed via Stripe invoices.

Keep claims honest and refunds easy — it's cheaper than chargebacks and app
store disputes.
