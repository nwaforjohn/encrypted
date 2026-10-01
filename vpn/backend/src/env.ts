import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  jwtSecret: required('JWT_SECRET', 'dev-insecure-change-me'),
  databaseUrl: required('DATABASE_URL', 'postgres://aurora:aurora@localhost:5432/aurora'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  adminEmail: (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim(),

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    priceMonthly: process.env.STRIPE_PRICE_MONTHLY ?? '',
    priceYearly: process.env.STRIPE_PRICE_YEARLY ?? '',
    successUrl: process.env.CHECKOUT_SUCCESS_URL ?? 'http://localhost:5173/account.html?checkout=success',
    cancelUrl: process.env.CHECKOUT_CANCEL_URL ?? 'http://localhost:5173/pricing.html?checkout=cancel',
  },

  iap: {
    appleSharedSecret: process.env.APPLE_SHARED_SECRET ?? '',
    googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
    googlePackageName: process.env.GOOGLE_PACKAGE_NAME ?? '',
  },

  tunnel: {
    dns: process.env.TUNNEL_DNS ?? '1.1.1.1',
    mtu: parseInt(process.env.TUNNEL_MTU ?? '1420', 10),
  },
};

export const stripeEnabled = Boolean(env.stripe.secretKey);
