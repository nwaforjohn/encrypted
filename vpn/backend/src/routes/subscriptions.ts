import { Router, raw, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware';
import { env, stripeEnabled } from '../env';
import { stripe, createCheckout, createPortal, handleStripeEvent } from '../billing/stripe';
import { verifyApple, verifyGoogle } from '../billing/iap';
import { getEntitlement } from '../billing/entitlements';

const router = Router();

/** Prices the UI shows. Keep in sync with Stripe + the store products. */
router.get('/plans', (_req, res) => {
  res.json({
    stripeEnabled,
    plans: [
      { id: 'monthly', name: 'Premium Monthly', priceUsd: 11.99, interval: 'month' },
      { id: 'yearly', name: 'Premium Yearly', priceUsd: 71.88, interval: 'year', note: 'Save 50%' },
    ],
  });
});

/** Start web checkout. Body: { plan: 'monthly'|'yearly' } */
router.post('/checkout', requireAuth, async (req, res) => {
  if (!stripeEnabled) return res.status(503).json({ error: 'stripe_not_configured' });
  const plan = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
  try {
    const url = await createCheckout({ userId: req.user!.sub, email: req.user!.email, plan });
    res.json({ url });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Open the Stripe billing portal to manage/cancel. */
router.post('/portal', requireAuth, async (req, res) => {
  if (!stripeEnabled) return res.status(503).json({ error: 'stripe_not_configured' });
  try {
    const url = await createPortal(req.user!.sub, env.stripe.successUrl);
    res.json({ url });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Mobile IAP: verify an Apple receipt. Body: { receipt } */
router.post('/iap/apple', requireAuth, async (req, res) => {
  try {
    const out = await verifyApple(req.user!.sub, String(req.body?.receipt ?? ''));
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Mobile IAP: verify a Google Play purchase. Body: { productId, purchaseToken } */
router.post('/iap/google', requireAuth, async (req, res) => {
  try {
    const out = await verifyGoogle(
      req.user!.sub,
      String(req.body?.productId ?? ''),
      String(req.body?.purchaseToken ?? ''),
    );
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Let the app re-sync entitlement after a purchase/restore. */
router.get('/status', requireAuth, async (req, res) => {
  res.json({ entitlement: await getEntitlement(req.user!.sub) });
});

/**
 * Stripe webhook. MUST receive the raw body to verify the signature, so it is
 * exported separately and mounted with express.raw() BEFORE express.json() in
 * index.ts.
 */
export const stripeWebhook = [
  raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    if (!stripe) return res.status(503).end();
    const sig = req.headers['stripe-signature'] as string;
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, env.stripe.webhookSecret);
    } catch (err: any) {
      console.error('[stripe] bad signature:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
      await handleStripeEvent(event);
    } catch (e) {
      console.error('[stripe] handler error:', e);
    }
    res.json({ received: true });
  },
] as const;

export default router;
