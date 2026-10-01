/**
 * Mobile in-app purchase verification (Apple App Store + Google Play).
 *
 * Both app stores REQUIRE you to sell subscriptions through their IAP system
 * inside the app (you cannot send mobile users to a Stripe page — Apple/Google
 * take a 15–30% cut). The app buys the product via the store, then sends the
 * receipt/token here; we verify it with the store and flip the account to
 * premium.
 *
 * This file verifies receipts and updates entitlements. Fill the store
 * credentials in .env to go live. The Apple path is implemented against the
 * verifyReceipt endpoint; the Google path is stubbed with the exact call to
 * make (needs the googleapis client + a service account) and is clearly marked.
 */
import { env } from '../env';
import { applySubscription, recordPayment } from './entitlements';

export interface VerifyResult {
  premium: boolean;
  expiresAt: Date | null;
  productId: string | null;
  txnId: string | null;
}

/** Verify an Apple App Store receipt (StoreKit). */
export async function verifyApple(userId: string, receipt: string): Promise<VerifyResult> {
  if (!env.iap.appleSharedSecret) throw new Error('apple_not_configured');

  const body = {
    'receipt-data': receipt,
    password: env.iap.appleSharedSecret,
    'exclude-old-transactions': true,
  };
  // Apple says: always hit production first, and if status 21007, retry sandbox.
  const prod = await appleCall('https://buy.itunes.apple.com/verifyReceipt', body);
  const data = prod.status === 21007
    ? await appleCall('https://sandbox.itunes.apple.com/verifyReceipt', body)
    : prod;

  if (data.status !== 0) {
    throw new Error(`apple_verify_failed status=${data.status}`);
  }

  const latest = (data.latest_receipt_info ?? []).sort(
    (a: any, b: any) => Number(b.expires_date_ms) - Number(a.expires_date_ms),
  )[0];
  if (!latest) return { premium: false, expiresAt: null, productId: null, txnId: null };

  const expiresAt = new Date(Number(latest.expires_date_ms));
  const premium = expiresAt.getTime() > Date.now();

  await applySubscription({
    userId,
    source: 'apple',
    plan: premium ? 'premium' : 'free',
    status: premium ? 'active' : 'canceled',
    currentPeriodEnd: expiresAt,
    storeProductId: latest.product_id,
    storeTxnId: latest.original_transaction_id,
  });
  await recordPayment({
    userId,
    source: 'apple',
    plan: latest.product_id,
    // Apple's verifyReceipt does not return price; record 0 and reconcile with
    // App Store Connect financial reports, or use StoreKit 2 server notifications.
    amountCents: 0,
    externalId: latest.transaction_id,
  });

  return { premium, expiresAt, productId: latest.product_id, txnId: latest.original_transaction_id };
}

async function appleCall(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Verify a Google Play purchase token.
 *
 * TODO(go-live): implement with the Google Play Developer API:
 *   androidpublisher.purchases.subscriptionsv2.get({ packageName, token })
 * using a service account (env.iap.googleServiceAccountJson). Add the
 * `googleapis` dependency and uncomment. The shape below mirrors what the real
 * call returns so the route + entitlement plumbing is already correct.
 */
export async function verifyGoogle(
  userId: string,
  productId: string,
  purchaseToken: string,
): Promise<VerifyResult> {
  if (!env.iap.googleServiceAccountJson || !env.iap.googlePackageName) {
    throw new Error('google_not_configured');
  }
  throw new Error(
    'google_verify_not_implemented: add googleapis + service account, then call ' +
      'androidpublisher.purchases.subscriptionsv2.get and feed the result into ' +
      'applySubscription()/recordPayment() exactly like verifyApple does.',
  );
}
