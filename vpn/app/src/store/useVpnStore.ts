import { create } from 'zustand';
import { Platform } from 'react-native';
import { api, ServerLocation, ConnectResult } from '../api/client';
import { getOrCreateKeyPair } from '../vpn/keys';
import { buildTunnelConfig, startTunnel, stopTunnel, TunnelState } from '../vpn/nativeTunnel';

interface VpnState {
  state: TunnelState;
  servers: ServerLocation[];
  selected: ServerLocation | null; // null = auto (fastest)
  session: ConnectResult | null;
  deviceId: string | null;
  error: string | null;
  elapsedStart: number | null;

  loadServers: () => Promise<void>;
  select: (s: ServerLocation | null) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/** Ensure the device is registered with the control plane; returns deviceId. */
async function ensureDevice(): Promise<{ deviceId: string; publicKey: string }> {
  const kp = await getOrCreateKeyPair();
  const { deviceId } = await api.registerDevice(
    kp.publicKey,
    Platform.OS === 'ios' ? 'iPhone' : 'Android device',
    Platform.OS,
  );
  return { deviceId, publicKey: kp.publicKey };
}

export const useVpnStore = create<VpnState>((set, get) => ({
  state: 'disconnected',
  servers: [],
  selected: null,
  session: null,
  deviceId: null,
  error: null,
  elapsedStart: null,

  loadServers: async () => {
    try {
      const { servers } = await api.servers();
      set({ servers });
    } catch (e: any) {
      set({ error: 'Could not load server locations.' });
    }
  },

  select: (s) => set({ selected: s }),

  connect: async () => {
    const { selected } = get();
    set({ state: 'connecting', error: null });
    try {
      const { deviceId, publicKey } = await ensureDevice();
      const kp = await getOrCreateKeyPair();
      const res = await api.connect(deviceId, publicKey, selected?.code);
      const cfg = buildTunnelConfig(res, kp.privateKey);
      await startTunnel(cfg);
      set({
        state: 'connected',
        session: res,
        deviceId,
        selected: get().selected ?? {
          code: res.node.code,
          country: res.node.country,
          countryName: res.node.countryName,
          city: res.node.city,
          premium: res.node.premium,
          online: true,
          load: 0,
        },
        elapsedStart: Date.now(),
      });
    } catch (e: any) {
      if (e.status === 402 || e.message === 'premium_required') {
        set({ state: 'disconnected', error: 'premium_required' });
      } else if (e.message === 'no_node_available') {
        set({ state: 'disconnected', error: 'No servers are online yet. Add one in the admin dashboard.' });
      } else {
        set({ state: 'error', error: 'Could not connect. Please try again.' });
      }
      throw e;
    }
  },

  disconnect: async () => {
    const { session } = get();
    try {
      await stopTunnel();
      if (session) {
        const kp = await getOrCreateKeyPair();
        await api.disconnect(session.sessionId, kp.publicKey).catch(() => {});
      }
    } finally {
      set({ state: 'disconnected', session: null, elapsedStart: null });
    }
  },
}));
