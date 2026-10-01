import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Parse a comma/space separated list into a lowercased, de-duped array. */
function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  androidPackage: process.env.ANDROID_PACKAGE ?? '',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
  appleSharedSecret: process.env.APPLE_SHARED_SECRET ?? '',
  isProd: process.env.NODE_ENV === 'production',

  // Usernames that are granted owner/admin access (comma or space separated),
  // e.g. ADMIN_USERNAMES="founder, ops". Matching accounts can reach the
  // /admin revenue dashboard and place sponsored posts.
  adminUsernames: list('ADMIN_USERNAMES'),

  // Revenue tuning.
  // Platform's cut of each creator tip, as a percentage (0–100). Default 20%.
  platformCutPercent: Math.min(
    100,
    Math.max(0, Number(process.env.PLATFORM_CUT_PERCENT ?? 20))
  ),
  // Estimated effective CPM (revenue per 1000 ad impressions) in cents, used
  // only for the in-app ad-revenue estimate. Real payout comes from AdMob.
  adEcpmCents: Number(process.env.AD_ECPM_CENTS ?? 300),
};

/** True when real purchase verification is configured. */
export const purchaseVerificationEnabled =
  Boolean(env.googleServiceAccountJson) || Boolean(env.appleSharedSecret);
