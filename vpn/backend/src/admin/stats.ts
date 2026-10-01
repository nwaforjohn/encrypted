import { one, q } from '../db';

/** Headline numbers for the admin revenue dashboard. */
export async function revenueOverview() {
  const totals = await one<{
    gross_cents: string;
    txns: string;
    paying_users: string;
  }>(`
    SELECT
      COALESCE(SUM(amount_cents),0)::bigint AS gross_cents,
      COUNT(*)::int AS txns,
      COUNT(DISTINCT user_id)::int AS paying_users
    FROM payments WHERE kind <> 'refund'
  `);

  const month = await one<{ gross_cents: string }>(`
    SELECT COALESCE(SUM(amount_cents),0)::bigint AS gross_cents
    FROM payments
    WHERE kind <> 'refund' AND created_at >= date_trunc('month', now())
  `);

  const activeSubs = await one<{ n: string }>(`
    SELECT COUNT(*)::int AS n FROM subscriptions
    WHERE plan='premium' AND status IN ('active','trialing','past_due')
      AND (current_period_end IS NULL OR current_period_end > now())
  `);

  const users = await one<{ n: string }>(`SELECT COUNT(*)::int AS n FROM users`);

  // Rough MRR: active subs * a nominal monthly figure derived from the last 30
  // days of subscription revenue / active subs (best-effort until you wire the
  // exact plan prices). The dashboard shows gross as the hard number.
  const mrr = await one<{ cents: string }>(`
    SELECT COALESCE(SUM(amount_cents),0)::bigint AS cents
    FROM payments
    WHERE kind='subscription' AND created_at >= now() - interval '30 days'
  `);

  return {
    grossCents: Number(totals?.gross_cents ?? 0),
    thisMonthCents: Number(month?.gross_cents ?? 0),
    last30dCents: Number(mrr?.cents ?? 0),
    transactions: Number(totals?.txns ?? 0),
    payingUsers: Number(totals?.paying_users ?? 0),
    activeSubscriptions: Number(activeSubs?.n ?? 0),
    totalUsers: Number(users?.n ?? 0),
  };
}

/** Daily revenue for the last `days` days (for the chart). */
export async function revenueByDay(days = 30) {
  return q<{ day: string; cents: string }>(
    `SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day,
            COALESCE(SUM(amount_cents),0)::bigint AS cents
       FROM payments
      WHERE kind <> 'refund' AND created_at >= now() - ($1 || ' days')::interval
      GROUP BY 1 ORDER BY 1`,
    [days],
  );
}

/** Recent payments feed. */
export async function recentPayments(limit = 25) {
  return q(
    `SELECT p.created_at, p.source, p.kind, p.plan, p.amount_cents, p.currency, u.email
       FROM payments p LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC LIMIT $1`,
    [limit],
  );
}

/** Node fleet health + load, for the ops side of the dashboard. */
export async function nodeFleet() {
  return q(
    `SELECT code, country, country_name, city, premium, enabled, healthy,
            load, capacity, last_health_at, endpoint_host, endpoint_port
       FROM nodes ORDER BY country, city`,
  );
}
