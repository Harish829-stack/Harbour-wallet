// Feature message handlers: walletconnect. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
import type { HandlerMap } from './types';
import { wc } from '../provider/index';
import { local } from '../../core/storage';
import { PROJECT_ID_KEY } from '../walletconnect/bridge';
import { readProjectId } from '../walletconnect/kit';

const view = (s: any) => ({ topic: s.topic, origin: s.origin, name: s.name, url: s.url, icon: s.icon ?? null, chains: s.chains, methods: s.methods, connectedAt: s.connectedAt, expiry: s.expiry ?? null });
export const handlers: HandlerMap = {
  async wcStatus() { return { ok: true, configured: !!(await readProjectId()), sessions: (await wc.sessions()).map(view) }; },
  // A Reown Cloud project ID (free, https://cloud.reown.com) is required by the relay. It identifies the app, not the user, and is not a secret.
  async wcSetProjectId(m) {
    const id = String(m.projectId ?? '').trim();
    if (id === '') { await local.remove(PROJECT_ID_KEY); return { ok: true, configured: !!(await readProjectId()) }; }
    if (!/^[0-9a-f]{32}$/i.test(id)) return { ok: false, error: 'A project ID is 32 hexadecimal characters.' };
    await local.set(PROJECT_ID_KEY, id.toLowerCase()); return { ok: true, configured: true };
  },
  async wcPair(m) { return wc.pair(String(m.uri ?? '')); },
  async wcDisconnect(m) { await wc.disconnect(String(m.topic ?? '')); return { ok: true }; },
};
