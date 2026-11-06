// Feature message handlers: settingsExtra. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
// walletsDetailed - wallet list incl. kind/blockchain/addresses; walletBalances - native balances for one account (migration screens);
// (revealPrivateKey moved to handlers/secrets.ts: it now returns an image of the key, never the key.)
import type { HandlerMap } from './types';
import { ALL_CHAINS } from '../../core/chains/index';
import { fetchNativeBalance, BALANCE_ADAPTERS } from '../../core/chains/adapters';
import { walletKind } from '../../core/settingsExtra';


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
};
