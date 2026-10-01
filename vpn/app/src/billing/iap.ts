/**
 * Mobile subscriptions via Apple App Store / Google Play in-app purchase.
 *
 * App-store policy REQUIRES digital subscriptions to be sold through IAP inside
 * the app (you can't redirect mobile users to Stripe). The flow:
 *   1. user taps "Upgrade" → requestSubscription(productId)
 *   2. the store charges them and returns a receipt / purchase token
 *   3. we send that to the backend (/billing/iap/apple|google) which verifies
 *      it with the store and flips the account to premium
 *
 * react-native-iap is a native module, so in Expo Go / a plain simulator it may
 * be absent — this wrapper degrades gracefully and reports that so the paywall
 * still renders. Create the matching product IDs in App Store Connect and the
 * Google Play Console (see vpn/docs/REVENUE.md).
 */
import { Platform } from 'react-native';
import { api } from '../api/client';

export const PRODUCT_IDS = {
  monthly: 'auroravpn.premium.monthly',
  yearly: 'auroravpn.premium.yearly',
};

// Lazy-require so the app doesn't crash if the native module isn't linked yet.
let IAP: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IAP = require('react-native-iap');
} catch {
  IAP = null;
}

export const iapAvailable = !!IAP;

export async function initIap(): Promise<void> {
  if (!IAP) return;
  try {
    await IAP.initConnection();
  } catch {
    /* ignore */
  }
}

export async function getProducts(): Promise<any[]> {
  if (!IAP) return [];
  try {
    return await IAP.getSubscriptions({ skus: Object.values(PRODUCT_IDS) });
  } catch {
    return [];
  }
}

/**
 * Purchase a subscription and verify server-side. Returns true if the account
 * is now premium.
 */
export async function purchase(plan: 'monthly' | 'yearly'): Promise<boolean> {
  if (!IAP) throw new Error('iap_unavailable');
  const sku = PRODUCT_IDS[plan];
  const result = await IAP.requestSubscription({ sku });
  const purchase = Array.isArray(result) ? result[0] : result;

  if (Platform.OS === 'ios') {
    const receipt = purchase?.transactionReceipt;
    const out: any = await api.verifyApple(receipt);
    await IAP.finishTransaction({ purchase, isConsumable: false });
    return !!out?.premium;
  } else {
    const token = purchase?.purchaseToken;
    const out: any = await api.verifyGoogle(sku, token);
    await IAP.finishTransaction({ purchase, isConsumable: false });
    return !!out?.premium;
  }
}

/** Restore purchases (App Store / Play) and re-verify with the backend. */
export async function restore(): Promise<boolean> {
  if (!IAP) throw new Error('iap_unavailable');
  const purchases = await IAP.getAvailablePurchases();
  let premium = false;
  for (const p of purchases) {
    try {
      if (Platform.OS === 'ios') {
        const out: any = await api.verifyApple(p.transactionReceipt);
        premium = premium || !!out?.premium;
      } else {
        const out: any = await api.verifyGoogle(p.productId, p.purchaseToken);
        premium = premium || !!out?.premium;
      }
    } catch {
      /* ignore individual failures */
    }
  }
  return premium;
}
