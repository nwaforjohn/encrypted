import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { env } from './env';

export const pool = new Pool({ connectionString: env.databaseUrl });

/** Thin query helper. */
export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Apply schema.sql (idempotent) and seed the location catalog on first boot.
 * Retries so `docker compose up` works even if Postgres is still coming up.
 */
export async function initDb(): Promise<void> {
  const schema = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const seed = readFileSync(join(__dirname, '..', 'seed', 'servers.sql'), 'utf8');

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await pool.query(schema);
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM nodes');
      if (rows[0].n === 0) {
        await pool.query(seed);
        console.log('[db] seeded placeholder server catalog');
      }
      console.log('[db] schema ready');
      return;
    } catch (err) {
      lastErr = err;
      console.log(`[db] waiting for database (attempt ${attempt})…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}
