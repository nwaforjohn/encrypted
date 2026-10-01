import { Platform } from 'react-native';

/**
 * Product catalog — the single source of truth for everything purchasable.
 *
 * These IDs MUST match exactly what you create in:
 *   - Google Play Console → Monetize → Products (subscriptions & in-app products)
 *   - App Store Connect → your app → In-App Purchases / Subscriptions
 *
 * Revenue from every purchase here is paid out to the store payment profile
 * attached to your developer accounts (see docs/MONETIZATION.md).
 */

export type ProductType = 'subs' | 'inapp';

/** Features that can be gated behind a purchase (paid feature unlocks). */
export type Feature =
  | 'no_ads'
  | 'verified'
  | 'large_uploads'
  | 'premium_themes'
  | 'broadcast_channels'
  | 'large_groups';

export interface ProductDef {
  /** Store product id. */
  sku: string;
  type: ProductType;
  title: string;
  description: string;
  /** Features this purchase grants. */
  grants: Feature[];
  /** For UI grouping. */
  category: 'subscription' | 'one_time' | 'feature_unlock' | 'tip' | 'promotion';
  /** Consumable purchases (tips, promotions) are bought repeatedly. */
  consumable?: boolean;
  /** Fallback price label shown when the store catalog isn't available. */
  priceHint?: string;
  /** For promotions: how long the boost lasts, surfaced in the UI. */
  promotionHours?: number;
}

/**
 * Subscriptions renew automatically and grant the full Pro feature set.
 */
export const SUBSCRIPTIONS: ProductDef[] = [
  {
    sku: 'pro_monthly',
    type: 'subs',
    title: 'Pro — Monthly',
    description:
      'Verified badge, no ads, large uploads, premium themes, broadcast & big groups.',
    grants: [
      'no_ads',
      'verified',
      'large_uploads',
      'premium_themes',
      'broadcast_channels',
      'large_groups',
    ],
    category: 'subscription',
    priceHint: '$4.99 / mo',
  },
  {
    sku: 'pro_yearly',
    type: 'subs',
    title: 'Pro — Yearly',
    description: 'Everything in Pro, best value — two months free.',
    grants: [
      'no_ads',
      'verified',
      'large_uploads',
      'premium_themes',
      'broadcast_channels',
      'large_groups',
    ],
    category: 'subscription',
    priceHint: '$39.99 / yr',
  },
];

/**
 * Creator tips — consumable purchases. The buyer taps a tier; the store charges
 * them; the server records the tip, keeps the platform cut (owner revenue) and
 * credits the creator. Revenue stream #4.
 */
export const TIPS: ProductDef[] = [
  {
    sku: 'tip_small',
    type: 'inapp',
    consumable: true,
    title: 'Tip $1.99',
    description: 'Send a small tip to a creator.',
    grants: [],
    category: 'tip',
    priceHint: '$1.99',
  },
  {
    sku: 'tip_medium',
    type: 'inapp',
    consumable: true,
    title: 'Tip $4.99',
    description: 'Show some love.',
    grants: [],
    category: 'tip',
    priceHint: '$4.99',
  },
  {
    sku: 'tip_large',
    type: 'inapp',
    consumable: true,
    title: 'Tip $9.99',
    description: 'Big support for a favorite creator.',
    grants: [],
    category: 'tip',
    priceHint: '$9.99',
  },
];

/**
 * Post promotions — consumable purchases that boost one of your posts into
 * everyone's feed for a window. The whole amount is owner revenue. Stream #1.
 */
export const PROMOTIONS: ProductDef[] = [
  {
    sku: 'promote_24h',
    type: 'inapp',
    consumable: true,
    title: 'Promote 24 hours',
    description: 'Boost this post to the top of feeds for 1 day.',
    grants: [],
    category: 'promotion',
    priceHint: '$4.99',
    promotionHours: 24,
  },
  {
    sku: 'promote_72h',
    type: 'inapp',
    consumable: true,
    title: 'Promote 3 days',
    description: 'Boost this post for 3 days.',
    grants: [],
    category: 'promotion',
    priceHint: '$9.99',
    promotionHours: 72,
  },
  {
    sku: 'promote_7d',
    type: 'inapp',
    consumable: true,
    title: 'Promote 7 days',
    description: 'Maximum reach — boost for a full week.',
    grants: [],
    category: 'promotion',
    priceHint: '$24.99',
    promotionHours: 24 * 7,
  },
];

/**
 * One-time (non-consumable) purchases — bought once, owned forever.
 */
export const ONE_TIME: ProductDef[] = [
  {
    sku: 'theme_pack_premium',
    type: 'inapp',
    title: 'Premium Theme Pack',
    description: 'Unlock all premium chat themes and wallpapers.',
    grants: ['premium_themes'],
    category: 'one_time',
  },
  {
    sku: 'remove_ads_forever',
    type: 'inapp',
    title: 'Remove Ads Forever',
    description: 'One payment, no ads ever again.',
    grants: ['no_ads'],
    category: 'one_time',
  },
];

/**
 * Individual feature unlocks — freemium à la carte.
 */
export const FEATURE_UNLOCKS: ProductDef[] = [
  {
    sku: 'unlock_broadcast',
    type: 'inapp',
    title: 'Broadcast Channels',
    description: 'Create channels and broadcast to unlimited subscribers.',
    grants: ['broadcast_channels'],
    category: 'feature_unlock',
  },
  {
    sku: 'unlock_large_groups',
    type: 'inapp',
    title: 'Large Groups',
    description: 'Create groups with up to 100,000 members.',
    grants: ['large_groups'],
    category: 'feature_unlock',
  },
  {
    sku: 'unlock_large_uploads',
    type: 'inapp',
    title: 'Large File Uploads',
    description: 'Send files up to 2 GB.',
    grants: ['large_uploads'],
    category: 'feature_unlock',
  },
];

export const ALL_PRODUCTS: ProductDef[] = [
  ...SUBSCRIPTIONS,
  ...ONE_TIME,
  ...FEATURE_UNLOCKS,
  ...TIPS,
  ...PROMOTIONS,
];

export const SUBSCRIPTION_SKUS = SUBSCRIPTIONS.map((p) => p.sku);
/** Non-consumable in-app products (owned forever). */
export const INAPP_SKUS = [...ONE_TIME, ...FEATURE_UNLOCKS].map((p) => p.sku);
/** Consumable products (tips + promotions) — bought repeatedly. */
export const CONSUMABLE_SKUS = [...TIPS, ...PROMOTIONS].map((p) => p.sku);
export const TIP_SKUS = TIPS.map((p) => p.sku);
export const PROMOTION_SKUS = PROMOTIONS.map((p) => p.sku);

export function findProduct(sku: string): ProductDef | undefined {
  return ALL_PRODUCTS.find((p) => p.sku === sku);
}

export function isConsumable(sku: string): boolean {
  return CONSUMABLE_SKUS.includes(sku);
}

/**
 * AdMob ad unit IDs. The values below are Google's official TEST unit IDs and
 * are safe to develop against. Swap in your real unit IDs (from your AdMob
 * account) for production — those are what generate revenue. Clicking your own
 * live ads violates AdMob policy, so keep test IDs until release.
 */
export const AD_UNITS = {
  banner: Platform.select({
    ios: process.env.IOS_BANNER_AD_UNIT ?? 'ca-app-pub-3940256099942544/2934735716',
    android:
      process.env.ANDROID_BANNER_AD_UNIT ?? 'ca-app-pub-3940256099942544/6300978111',
    default: 'ca-app-pub-3940256099942544/6300978111',
  }) as string,
  interstitial: Platform.select({
    ios:
      process.env.IOS_INTERSTITIAL_AD_UNIT ??
      'ca-app-pub-3940256099942544/4411468910',
    android:
      process.env.ANDROID_INTERSTITIAL_AD_UNIT ??
      'ca-app-pub-3940256099942544/1033173712',
    default: 'ca-app-pub-3940256099942544/1033173712',
  }) as string,
  rewarded: Platform.select({
    ios:
      process.env.IOS_REWARDED_AD_UNIT ?? 'ca-app-pub-3940256099942544/1712485313',
    android:
      process.env.ANDROID_REWARDED_AD_UNIT ??
      'ca-app-pub-3940256099942544/5224354917',
    default: 'ca-app-pub-3940256099942544/5224354917',
  }) as string,
};
