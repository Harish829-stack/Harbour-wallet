// Feature message handlers: provider. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
// Website-originated requests never reach this file: they arrive on the `harbour-provider` port and are handled by background/provider/service.ts.
import { formatUnits } from 'viem';
import type { HandlerMap } from './types';
import { announceChain, disconnectOrigin, getProvider, pending, perms, rpc, viewDeps, wrapSigner } from '../provider/index';
import { buildView } from '../provider/view';
import { evmNetwork } from '../provider/networks';
import { normalizeOrigin, displayHost } from '../../core/provider/origin';
import { decodeString, encodeAllowanceCall, encodeApprove, isUnlimited, SEL } from '../../core/provider/decode';
import { ERR, serializeError, ProviderError } from '../../core/provider/errors';
import { passkeyMeta, verifyPasskeySecret } from '../../core/passkeyService';
import { session } from '../../core/storage';

// Biometric approval: a verified proof is bound to ONE pending request and expires in 60 s; connect-type requests never need it.
const BIO_KEY = 'wallet:provider:bioProof'; const BIO_TTL = 60_000;
const NEEDS_BIO = new Set(['sign', 'typed', 'tx', 'solSignMessage', 'solSignTx', 'solSignAll', 'solSignSend', 'multiSign', 'tonSend', 'tonProof']);
async function bioRequirement(kind: string, params?: any): Promise<{ required: boolean; credentialId: string | null }> {
  const needs = NEEDS_BIO.has(kind) || (kind === 'multiConnect' && typeof params?.proofPayload === 'string'); // a TON ton_proof is a signature
  if (!needs || !(await perms.prefs()).biometricApproval) return { required: false, credentialId: null };
  const meta = await passkeyMeta(); return { required: !!meta && !meta.legacy, credentialId: meta && !meta.legacy ? meta.credentialId : null }; // HW-001: legacy seals cannot gate approvals
}

const conView = (c: any) => ({ id: c.id, origin: c.origin, host: displayHost(c.origin), title: c.title, icon: c.icon ?? null, walletName: c.walletName, accountName: c.accountName, accountIndex: c.accountIndex, walletId: c.walletId, evmAddress: c.evmAddress ?? null, solanaAddress: c.solanaAddress ?? null, chainId: c.chainId, chainName: evmNetwork(c.chainId)?.name ?? `Chain ${c.chainId}`, namespaces: c.namespaces, connectedAt: c.connectedAt, lastUsedAt: c.lastUsedAt });
const bad = (error: string) => ({ ok: false, error });

export const handlers: HandlerMap = {
  // ---- approval window
  async providerSession(_m, ctx) {
    const items = await pending.list();
    return { ok: true, hasVault: await ctx.vault.exists(), unlocked: await ctx.vault.isUnlocked(), pending: items.filter((p) => !p.internal).length };
  },
  async providerPending() {
    const items = (await pending.list()).filter((p) => !p.internal);
    return { ok: true, items: items.map((p) => ({ id: p.id, kind: p.kind, stage: p.stage, origin: p.origin, host: displayHost(p.origin), title: p.title ?? displayHost(p.origin), createdAt: p.createdAt })) };
  },
  async providerView(m, ctx) {
    const p = await pending.get(String(m.id ?? '')); if (!p) return { ok: false, gone: true, error: 'This request is no longer pending.' };
    if (!(await ctx.vault.isUnlocked())) return { ok: true, locked: true, summary: { id: p.id, kind: p.kind, host: displayHost(p.origin), title: p.title ?? displayHost(p.origin), icon: p.icon ?? null } };
    try { return { ok: true, view: { ...(await buildView(p, viewDeps())), bio: await bioRequirement(p.kind, p.params) } }; } catch (e) { return { ok: false, error: serializeError(e).message }; }
  },
  async providerResolve(m) {
    const d = m.decision ?? {};
    const decision = { approve: d.approve === true, accountIndex: Number.isInteger(d.accountIndex) ? d.accountIndex : undefined, chainId: Number.isSafeInteger(d.chainId) ? d.chainId : undefined,
      gasLimit: typeof d.gasLimit === 'string' && /^\d{1,20}$/.test(d.gasLimit) ? d.gasLimit : undefined, feeLevel: ['safe', 'average', 'fast'].includes(d.feeLevel) ? d.feeLevel : undefined,
      fee: d.fee && typeof d.fee === 'object' ? Object.fromEntries(['maxFeePerGas', 'maxPriorityFeePerGas', 'gasPrice'].filter((k) => typeof d.fee[k] === 'string' && /^\d{1,30}$/.test(d.fee[k])).map((k) => [k, d.fee[k]])) : undefined };
    const id = String(m.id ?? '');
    if (decision.approve) {
      const p = await pending.get(id);
      if (p && (await bioRequirement(p.kind, p.params)).required) {
        const proof = await session.get<{ id: string; until: number }>(BIO_KEY);
        if (!proof || proof.id !== id || proof.until < Date.now()) return { ok: false, needsBio: true, error: 'Biometric confirmation is required.' };
        await session.remove(BIO_KEY); // single use
      }
    }
    return getProvider().resolve(id, decision);
  },
  /** The approval window ran the OS biometric prompt and sends the secret it unsealed; only a secret that opens the sealed vault key counts. */
  async providerBioProof(m) {
    const id = String(m.id ?? ''); if (!(await pending.get(id))) return bad('This request is no longer pending.');
    try { await verifyPasskeySecret(String(m.secret ?? '')); } catch (e: any) { return bad(e?.message === 'INVALID_PASSKEY_SECRET' ? 'Biometric verification failed' : String(e?.message ?? 'Biometric verification failed')); }
    await session.set(BIO_KEY, { id, until: Date.now() + BIO_TTL }); return { ok: true };
  },

  // ---- Settings > Connections (TW: /settings/connections, /settings/connection/:id)
  async providerConnections() { return { ok: true, items: (await perms.all()).map(conView) }; },
  async providerConnection(m, ctx) {
    const c = await perms.getById(String(m.id ?? '')); if (!c) return bad('NOT_FOUND');
    let activeAccount: number | null = null, activeWalletId: string | null = null;
    try { const st: any = await ctx.vault.getState(); activeWalletId = st.activeWalletId ?? null; const w = st.wallets?.[st.activeWalletId]; activeAccount = typeof w?.activeAccount === 'number' ? w.activeAccount : 0; } catch { /* locked */ }
    const networks = viewDeps().networks.list().map((n) => ({ chainId: n.chainId, name: n.name, testnet: n.testnet }));
    return { ok: true, networks, item: conView(c), isActiveAccount: activeWalletId === c.walletId && activeAccount === c.accountIndex, canUseAccount: activeAccount !== null && activeWalletId === c.walletId };
  },
  // Home header: the connection (if any) of the site in the active browser tab, TW-style "connected dApp" indicator.
  async providerCurrentSite() {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const url = tabs.find((t) => t.url && /^https?:/i.test(t.url))?.url; const origin = url ? normalizeOrigin(url) : null; if (!origin) return { ok: true, item: null };
      const c = await perms.get(origin); if (!c) return { ok: true, item: null };
      const net = viewDeps().networks.get(c.chainId);
      return { ok: true, item: { ...conView(c), chainId: c.chainId, networkName: net?.name ?? `Chain ${c.chainId}`, tabId: tabs[0]?.id ?? null } };
    } catch { return { ok: true, item: null }; }
  },
  // Connection details: move a site to another network (injected pages get chainChanged; WalletConnect sessions get updateSession + chainChanged).
  async providerSetChain(m) {
    const c = await perms.getById(String(m.id ?? '')); if (!c) return bad('NOT_FOUND');
    const chainId = Number(m.chainId); if (!Number.isSafeInteger(chainId) || !evmNetwork(chainId)) return bad('This network is not available in Harbour.');
    if (!c.namespaces.includes('evm')) return bad('This site is not connected with an Ethereum account.');
    if (c.chainId !== chainId) await perms.update(c.origin, { chainId });
    announceChain(c.origin, chainId); return { ok: true };
  },
  async providerDisconnect(m) { const c = await perms.getById(String(m.id ?? '')); if (!c) return bad('NOT_FOUND'); await disconnectOrigin(c.origin); return { ok: true }; },
  async providerDisconnectAll() { const all = await perms.all(); for (const c of all) await disconnectOrigin(c.origin); return { ok: true, count: all.length }; },
  async providerBlacklist() { return { ok: true, items: (await perms.blacklist()).map((b) => ({ id: b.id, origin: b.origin, host: displayHost(b.origin), title: b.title ?? displayHost(b.origin), icon: b.icon ?? null, addedAt: b.addedAt })) }; },
  async providerBlacklistAdd(m) {
    let raw = String(m.origin ?? '').trim(); if (!raw) return bad('Enter a site address.'); if (!/^[a-z]+:\/\//i.test(raw)) raw = 'https://' + raw;
    const origin = normalizeOrigin(raw); if (!origin) return bad('Enter a valid https:// site address.');
    const connected = await perms.get(origin); const item = await perms.addBlacklist(origin, { title: connected?.title, icon: connected?.icon }); if (!item) return bad('Could not add this site.');
    await getProvider().rejectWhere((p) => p.origin === origin, new ProviderError(ERR.UNAUTHORIZED, 'This site is on your blacklist.'));
    if (connected) await disconnectOrigin(origin);
    return { ok: true };
  },
  async providerBlacklistRemove(m) { return { ok: await perms.removeBlacklist(String(m.id ?? '')) }; },
  async providerPrefs(m) { const prefs = typeof m.defaultWallet === 'boolean' || typeof m.biometricApproval === 'boolean' ? await perms.setPrefs({ ...(typeof m.defaultWallet === 'boolean' ? { defaultWallet: m.defaultWallet } : {}), ...(typeof m.biometricApproval === 'boolean' ? { biometricApproval: m.biometricApproval } : {}) }) : await perms.prefs(); return { ok: true, prefs }; },

  // ---- Home > Approvals (token allowances granted through Harbour, re-verified on chain)
  async providerApprovals() {
    const list = (await perms.approvals()).slice(0, 40); const out: any[] = [];
    await Promise.all(list.map(async (a) => {
      try {
        const net = evmNetwork(a.chainId); if (!net) return;
        const raw = await rpc(a.chainId, 'eth_call', [{ to: a.token, data: encodeAllowanceCall(a.owner, a.spender) }, 'latest']); const allowance = BigInt(raw);
        if (allowance === 0n) { await perms.untrackApproval(a.id); return; }
        let symbol = '', decimals = 18; try { symbol = decodeString(await rpc(a.chainId, 'eth_call', [{ to: a.token, data: SEL.symbol }, 'latest'])); decimals = Number(BigInt(await rpc(a.chainId, 'eth_call', [{ to: a.token, data: SEL.decimals }, 'latest']))); } catch { /* label unavailable */ }
        out.push({ id: a.id, chainId: a.chainId, chainName: net.name, nativeSymbol: net.symbol, token: a.token, symbol: symbol || 'Unknown token', decimals, spender: a.spender, owner: a.owner, origin: a.origin, host: a.origin ? displayHost(a.origin) : '', allowance: allowance.toString(), formatted: formatUnits(allowance, decimals), unlimited: isUnlimited(allowance), at: a.at });
      } catch { out.push({ id: a.id, chainId: a.chainId, chainName: evmNetwork(a.chainId)?.name ?? '', token: a.token, symbol: 'Unknown token', spender: a.spender, owner: a.owner, unavailable: true, at: a.at, host: '' }); }
    }));
    return { ok: true, items: out.sort((x, y) => y.at - x.at) };
  },
  async providerRevoke(m, ctx) {
    const a = (await perms.approvals()).find((x) => x.id === String(m.id ?? '')); if (!a) return bad('This approval is no longer tracked.');
    if (!(await ctx.vault.isUnlocked())) return { ok: false, locked: true, error: 'LOCKED' };
    try {
      const net = evmNetwork(a.chainId); if (!net) return bad('Unsupported network');
      const sg = wrapSigner(); const accts = await sg.accounts(); const acc = accts?.accounts.find((x) => x.evm?.toLowerCase() === a.owner.toLowerCase());
      if (!accts || !acc) return bad('The wallet that granted this approval is not the active wallet.');
      const hash = await sg.sendTransaction({ walletId: accts.walletId, accountIndex: acc.index, evmAddress: acc.evm }, net, { from: a.owner, to: a.token, value: '0x0', data: encodeApprove(a.spender, 0n) }, {});
      await perms.untrackApproval(a.id); return { ok: true, hash };
    } catch (e) { return bad(serializeError(e).message); }
  },
};
