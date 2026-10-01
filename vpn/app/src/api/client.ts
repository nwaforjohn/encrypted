import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API = (
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://10.0.2.2:8080'
).replace(/\/$/, '');

const TOKEN_KEY = 'aurora_token';
let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}
export async function setToken(t: string): Promise<void> {
  cachedToken = t;
  await SecureStore.setItemAsync(TOKEN_KEY, t);
}
export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth) {
    const t = await getToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }
  const res = await fetch(API + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new ApiError(data?.error ?? `http_${res.status}`, res.status);
  return data as T;
}

export interface Entitlement {
  plan: 'free' | 'premium';
  status: string;
  premium: boolean;
  currentPeriodEnd: string | null;
}
export interface ServerLocation {
  code: string;
  country: string;
  countryName: string;
  city: string;
  premium: boolean;
  online: boolean;
  load: number;
}
export interface ConnectResult {
  sessionId: string;
  node: { code: string; country: string; countryName: string; city: string; premium: boolean };
  config: string;
  fields: {
    address: string;
    dns: string;
    mtu: number;
    peer: { publicKey: string; endpoint: string; allowedIps: string[]; persistentKeepalive: number };
  };
}

export const api = {
  API,
  register: (email: string, password: string) =>
    req<{ token: string; user: any }>('/auth/register', { method: 'POST', body: { email, password } }),
  login: (email: string, password: string) =>
    req<{ token: string; user: any }>('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => req<{ user: any; entitlement: Entitlement }>('/auth/me', { auth: true }),
  servers: () => req<{ servers: ServerLocation[] }>('/servers'),
  registerDevice: (publicKey: string, name: string, platform: string) =>
    req<{ deviceId: string }>('/vpn/devices', { method: 'POST', auth: true, body: { publicKey, name, platform } }),
  connect: (deviceId: string, publicKey: string, code?: string, country?: string) =>
    req<ConnectResult>('/vpn/connect', { method: 'POST', auth: true, body: { deviceId, publicKey, code, country } }),
  disconnect: (sessionId: string, publicKey: string) =>
    req<{ ok: boolean }>('/vpn/disconnect', { method: 'POST', auth: true, body: { sessionId, publicKey } }),
  billingStatus: () => req<{ entitlement: Entitlement }>('/billing/status', { auth: true }),
  verifyApple: (receipt: string) =>
    req('/billing/iap/apple', { method: 'POST', auth: true, body: { receipt } }),
  verifyGoogle: (productId: string, purchaseToken: string) =>
    req('/billing/iap/google', { method: 'POST', auth: true, body: { productId, purchaseToken } }),
};
