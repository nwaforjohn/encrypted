import { create } from 'zustand';
import { api, setToken, clearToken, getToken, Entitlement } from '../api/client';

interface AuthState {
  ready: boolean;
  loggedIn: boolean;
  email: string | null;
  entitlement: Entitlement | null;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
}

const friendly: Record<string, string> = {
  bad_credentials: 'Wrong email or password.',
  email_taken: 'That email is already registered — try logging in.',
  weak_password: 'Password must be at least 8 characters.',
  invalid_email: 'Enter a valid email address.',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  loggedIn: false,
  email: null,
  entitlement: null,
  error: null,

  init: async () => {
    const t = await getToken();
    if (!t) return set({ ready: true, loggedIn: false });
    try {
      const me = await api.me();
      set({ ready: true, loggedIn: true, email: me.user.email, entitlement: me.entitlement });
    } catch {
      await clearToken();
      set({ ready: true, loggedIn: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const { token } = await api.login(email, password);
      await setToken(token);
      const me = await api.me();
      set({ loggedIn: true, email: me.user.email, entitlement: me.entitlement });
    } catch (e: any) {
      set({ error: friendly[e.message] ?? 'Could not log in. Check your connection.' });
      throw e;
    }
  },

  register: async (email, password) => {
    set({ error: null });
    try {
      const { token } = await api.register(email, password);
      await setToken(token);
      const me = await api.me();
      set({ loggedIn: true, email: me.user.email, entitlement: me.entitlement });
    } catch (e: any) {
      set({ error: friendly[e.message] ?? 'Could not create account.' });
      throw e;
    }
  },

  logout: async () => {
    await clearToken();
    set({ loggedIn: false, email: null, entitlement: null });
  },

  refreshEntitlement: async () => {
    try {
      const { entitlement } = await api.billingStatus();
      set({ entitlement });
    } catch {
      /* ignore */
    }
  },
}));
