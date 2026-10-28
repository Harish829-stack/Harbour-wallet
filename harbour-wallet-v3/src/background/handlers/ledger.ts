// Feature message handlers: ledger. Every message here is UI-only (the router enforces isInternalWalletSender before dispatch).
// A Ledger wallet holds no key material in Harbour: only the public addresses the device reported and their derivation paths.
// Signing happens on the device (popup, WebHID); see chainSend.ledgerSendPrepare / ledgerSendSubmit.
import type { HandlerMap } from './types';
import { local, KEYS } from '../../core/storage';
import { canCreateWallet, WALLET_LIMIT_ERROR } from '../../core/importKey';

const PATH = /^m?\/?(\d+'?\/){2,5}\d+'?$/;
const norm = (p: string) => p.replace(/^m\//, '');
export const LEDGER_DEFAULT_PATHS = { ethereum: "44'/60'/0'/0/0", bitcoin: "84'/0'/0'/0/0", solana: "44'/501'/0'" };

export const handlers: HandlerMap = {
  /** Add a Ledger wallet from addresses the device reported: { accounts: { ethereum?, bitcoin?, solana? : { address, path } }, model? } */
  async ledgerAddWallet(msg, ctx) {
    try {
      const core = ctx.core; const acc = msg.accounts ?? {};
      const addresses: Record<string, string> = {}; const hw: Record<string, string> = {};
      const checks: Array<[string, any]> = [['ethereum', core.CoinType.ethereum], ['bitcoin', core.CoinType.bitcoin], ['solana', core.CoinType.solana]];
      for (const [ct, coin] of checks) {
        const a = acc[ct]; if (!a) continue;
        const address = String(a.address ?? ''); const path = String(a.path ?? '');
        if (!core.AnyAddress.isValid(address, coin) || !PATH.test(path)) return { ok: false, error: `Invalid ${ct} account from the device` };
        addresses[ct] = address; hw[ct] = norm(path);
      }
      if (!addresses.ethereum && !addresses.bitcoin) return { ok: false, error: 'Open the Ethereum or Bitcoin app on your Ledger and try again' };
      const state: any = await ctx.vault.getState(); state.wallets = state.wallets ?? {};
      if (!canCreateWallet(Object.keys(state.wallets).length)) return { ok: false, error: WALLET_LIMIT_ERROR };
      const id = `ledger-${(addresses.ethereum ?? addresses.bitcoin).toLowerCase()}`;
      if (state.wallets[id]) return { ok: false, error: 'This Ledger account is already added' };
      const n = Object.values(state.wallets).filter((w: any) => w?.type === 'ledger').length + 1;
      const label = `Ledger ${n}`;
      state.wallets[id] = { name: label, label, type: 'ledger', model: typeof msg.model === 'string' ? msg.model.slice(0, 40) : undefined, addresses, accounts: [{ derivationIndex: 0, name: 'Account 1', addresses, hw }], activeAccount: 0 };
      state.activeWalletId = id;
      const vaultId = state.vaultId ?? (await local.get<{ vaultId: string }>(KEYS.VAULT_ID))?.vaultId;
      if (vaultId) { const list = (await local.get<string[]>(KEYS.wallets(vaultId))) ?? []; if (!list.includes(id)) { list.push(id); await local.set(KEYS.wallets(vaultId), list); } }
      await ctx.vault.persist(state);
      return { ok: true, walletId: id, label, addresses };
    } catch (e: any) { return { ok: false, error: String(e?.message ?? 'Could not add the Ledger').slice(0, 200) }; }
  },
};
