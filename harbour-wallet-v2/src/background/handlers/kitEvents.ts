// Kit-backed events: remote config, security checks, tx simulation, perps/prediction read-only data.
import type { HandlerMap } from './types';
import { refreshConfig, EMPTY_CONFIG } from '../../kit/remoteConfig';
import { checkToken, checkAddress, simulateCall } from '../../kit/clients/securityClient';
import { isKilled } from '../../kit/failover';
const getStore = () => import('../store'); // lazy: keeps the handler map importable outside the extension runtime
import { rpcUrl } from '../../core/rpc';
import { local } from '../../core/storage';
import { notifyAnnouncements } from '../notify';
export const CONFIG_ANNOUNCEMENTS_KEY = 'wallet:config:announcements';

const isHexAddr = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const flagOn = async (name: string) => (await getStore()).store.getState().sdkFeatureSlice.flags[name] === true;
const off = { ok: false, error: 'FEATURE_DISABLED' };

export async function applyRemoteConfig(): Promise<void> {
  const { store, actions } = await getStore();
  const cur = store.getState().sdkFeatureSlice;
  const cfg = await refreshConfig(cur.configVersion);
  if (!cfg) return;
  store.dispatch(actions.sdkFeatureSlice.patch({ flags: cfg.flags, configVersion: cfg.version, killedProviders: cfg.killedProviders }));
  store.dispatch(actions.blockchains.patch({ enabled: Object.entries(cfg.chains).filter(([, on]) => on).map(([id]) => id) }));
  const ann = Array.isArray(cfg.announcements) ? cfg.announcements.slice(0, 30) : [];
  await local.set(CONFIG_ANNOUNCEMENTS_KEY, ann); // shown in Help; new ones are notified once
  void notifyAnnouncements(ann).catch(() => {});
}

export const handlers: HandlerMap = {
  async getRemoteConfig() { const s = (await getStore()).store.getState().sdkFeatureSlice; return { ok: true, ...EMPTY_CONFIG, flags: s.flags, version: s.configVersion, killedProviders: s.killedProviders }; },
  async refreshRemoteConfig() { await applyRemoteConfig(); return { ok: true, version: (await getStore()).store.getState().sdkFeatureSlice.configVersion }; },
  async checkTokenRisk(msg) {
    if (!isHexAddr(msg.address) || !Number.isInteger(msg.chainId)) return { ok: false, error: 'INVALID_REQUEST' };
    return { ok: true, ...(await checkToken(msg.chainId, msg.address)) };
  },
  async checkAddressRisk(msg) {
    if (!isHexAddr(msg.address) || !Number.isInteger(msg.chainId)) return { ok: false, error: 'INVALID_REQUEST' };
    return { ok: true, ...(await checkAddress(msg.chainId, msg.address)) };
  },
  async simulateTx(msg) {
    if (!Number.isInteger(msg.chainId) || !isHexAddr(msg.from) || !isHexAddr(msg.to)) return { ok: false, error: 'INVALID_REQUEST' };
    const url = rpcUrl(msg.chainId);
    const r = url ? await simulateCall(url, { from: msg.from, to: msg.to, data: typeof msg.data === 'string' ? msg.data : undefined, value: typeof msg.value === 'string' ? msg.value : undefined }) : null;
    return { ok: true, supported: r !== null, result: r };
  },
};
