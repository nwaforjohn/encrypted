import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({ connectionString: env.databaseUrl });

/** Apply the schema (idempotent) on startup. */
export async function migrate(): Promise<void> {
  const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  public_key: string;
  push_token: string | null;
  display_name: string | null;
  bio: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface PostRow {
  id: string;
  author_id: string;
  image_url: string;
  media_type: string;
  caption: string;
  is_sponsored: boolean;
  promoted_until: string | null;
  created_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface TipRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  post_id: string | null;
  gross_cents: number;
  platform_cut_cents: number;
  creator_net_cents: number;
  sku: string;
  platform: string;
  purchase_token: string;
  created_at: string;
}

export interface CreatorBalanceRow {
  user_id: string;
  balance_cents: number;
  lifetime_cents: number;
  updated_at: string;
}

export interface AdminEarningRow {
  id: string;
  source: string;
  amount_cents: number;
  user_id: string | null;
  ref: string | null;
  note: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_public_key: string;
  ciphertext: string;
  nonce: string;
  delivered: boolean;
  created_at: string;
}

export interface EntitlementRow {
  id: string;
  user_id: string;
  sku: string;
  platform: string;
  purchase_token: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}
