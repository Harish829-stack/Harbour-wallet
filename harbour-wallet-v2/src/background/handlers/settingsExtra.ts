// Feature message handlers: settingsExtra. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
// walletsDetailed - wallet list incl. kind/blockchain/addresses; walletBalances - native balances for one account (migration screens);
// revealPrivateKey - the single key of an imported private-key wallet, behind the same one-shot re-authentication grant as the phrase.
import type { HandlerMap } from './types';
import { local, session, KEYS } from '../../core/storage';
import { ALL_CHAINS, chainById } from '../../core/chains/index';
import { fetchNativeBalance, BALANCE_ADAPTERS } from '../../core/chains/adapters';
import { walletKind } from '../../core/settingsExtra';

const pwBytes = (s: string) => new TextEncoder().encode(s);

export const handlers: HandlerMap = {
  async walletsDetailed(_m, ctx) {
    try {
      if (!(await ctx.vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
      const st: any = await ctx.vault.getState();
      const wallets = Object.entries(st.wallets ?? {}).map(([id, w]: [string, any]) => ({
        id, label: w.label ?? w.name ?? 'Wallet', type: w.type ?? 'mnemonic', kind: walletKind(w), blockchain: w.blockchain ?? null,
        activeAccount: w.activeAccount ?? 0, backupRequired: !!w.seedPhraseBackupRequired, importedAt: w.importedAt ?? null,
        accounts: (Array.isArray(w.accounts) && w.accounts.length ? w.accounts : [{ derivationIndex: 0, name: 'Account 1', addresses: w.addresses ?? {} }])
          .map((a: any, i: number) => ({ index: i, derivationIndex: a.derivationIndex ?? i, name: a.name ?? `Account ${i + 1}`, addresses: a.addresses ?? {} })),
      }));
      return { ok: true, wallets, activeWalletId: st.activeWalletId ?? wallets[0]?.id ?? null };
    } catch (e: any) { return { ok: false, error: e?.message || 'List failed' }; }
  },

  // Native balances of one account on every chain it has an address for. Public RPCs only; a failing chain is reported, not hidden.
  async walletBalances(m, ctx) {
    try {
      if (!(await ctx.vault.isUnlocked())) return { ok: false, error: 'LOCKED' };
      const st: any = await ctx.vault.getState(); const w = st.wallets?.[String(m.walletId ?? '')];
      if (!w) return { ok: false, error: 'Wallet not found' };
      const idx = Number.isInteger(m.index) ? Number(m.index) : (w.activeAccount ?? 0);
      const acct = (w.accounts ?? [{ addresses: w.addresses }])[idx]; if (!acct) return { ok: false, error: 'Invalid account' };
      const jobs = ALL_CHAINS.filter((c) => !!BALANCE_ADAPTERS[c.kind] && acct.addresses?.[c.ct]);
      const rows = await Promise.all(jobs.map(async (c) => {
        const address = acct.addresses[c.ct]; const b = await fetchNativeBalance(c, address);
        return { id: c.id, symbol: c.symbol, name: c.name, address, balance: b.ok ? b.formatted : '0', error: b.ok ? undefined : (b.error || 'Balance unavailable') };
      }));
      return { ok: true, assets: rows };
    } catch (e: any) { return { ok: false, error: e?.message || 'Balance lookup failed' }; }
  },

  async revealPrivateKey(m, ctx) {
    try {
      const passwordKey = await session.get<string>(KEYS.PASSWORD); if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
      const grant = await session.get<number>(KEYS.REVEAL); await session.remove(KEYS.REVEAL); // one-shot
      if (!grant || grant < Date.now()) return { ok: false, error: 'AUTH_REQUIRED' };
      const st: any = await ctx.vault.getState(); const id = String(m.walletId ?? '');
      const w = st.wallets?.[id]; if (!w) return { ok: false, error: 'Wallet not found' };
      if (walletKind(w) !== 'privateKey') return { ok: false, error: 'This wallet has no private key to show' };
      const ks = await local.get<any>(id); if (!ks) return { ok: false, error: 'Wallet not found' };
      const { core } = ctx; const ct = (w.blockchain && w.blockchain !== 'evm' ? w.blockchain : 'ethereum');
      const chain = ALL_CHAINS.find((c) => c.ct === ct) ?? chainById('ethereum')!;
      const sk = core.StoredKey.importJSON(pwBytes(JSON.stringify(ks)));
      try {
        const pk = sk.privateKey(core.CoinType[chain.ct], pwBytes(passwordKey));
        try {
          const data: Uint8Array = pk.data();
          // Solana keys are shown as base58 (what Solana wallets import); everything else as hex.
          const key = chain.kind === 'solana' ? core.Base58.encodeNoCheck(data) : core.HexCoding.encode(data).replace(/^0x/, '');
          return { ok: true, key, format: chain.kind === 'solana' ? 'base58' : 'hex', network: chain.name };
        } finally { pk.delete(); }
      } finally { sk.delete(); }
    } catch (e: any) { return { ok: false, error: e?.message || 'Reveal failed' }; }
  },
};
