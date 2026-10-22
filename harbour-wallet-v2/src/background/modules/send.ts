import { evmTransport } from '../../kit/evmTransport';
import { local, session, KEYS } from '../../core/storage';
import { createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcUrl } from '../../core/rpc';
import { clientFor } from '../../core/erc20';
import { readTokens, networkByChainId, type CustomToken } from '../../core/customTokens';
import { estimateSend, buildTransfer, validRecipient } from '../../core/sendService';
import { nativeSymbol } from '../../core/balanceService';
import { ensureAccounts, activeEntry } from '../walletState';
import type { HandlerMap } from '../handlers/types';

export const handlers: HandlerMap = {
  sendTx: async (msg, ctx) => {
    const { core, vault, wallet } = ctx as any;
 {
      // Native or ERC-20 transfer, signed with the active account's wallet-core key via viem. Requires an unlocked session.
      try {
        const chainId = Number(msg.chainId); const url = rpcUrl(chainId);
        if (!url || !networkByChainId(chainId)) return { ok: false, error: 'Unsupported network' };
        const to = String(msg.to ?? ''); const amount = String(msg.amount ?? '');
        if (!validRecipient(to)) return { ok: false, error: 'Invalid recipient address' };
        if (!(Number(amount) > 0)) return { ok: false, error: 'Enter a valid amount' };
        const passwordKey = await session.get<string>(KEYS.PASSWORD);
        if (!passwordKey) return { ok: false, error: 'Wallet is locked' };
        // Resolve the ACTIVE wallet + active account's derivation index (never always wallet[0]/index 0).
        let derivationIndex = 0, walletId: string | undefined, token: CustomToken | undefined, walletType = 'mnemonic', hasEvm = true;
        try {
          const st: any = await vault.getState();
          const e = activeEntry(st);
          if (e) { walletId = e[0]; const w = e[1]; walletType = w.type ?? 'mnemonic'; hasEvm = !!(w.addresses?.ethereum ?? w.accounts?.[0]?.addresses?.ethereum); const accounts = ensureAccounts(w); derivationIndex = accounts[w.activeAccount]?.derivationIndex ?? 0;
            if (msg.tokenId) token = readTokens(w.customTokens).find((t) => t.id === msg.tokenId && t.chainId === chainId); }
        } catch {}
        if (msg.tokenId && !token) return { ok: false, error: 'Token not found in your wallet' };
        const ks = walletId ? await local.get<any>(walletId) : undefined;
        if (!ks) return { ok: false, error: 'No wallet found' };
        const sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(ks)));
        let pk: any; let hd: any = null;
        if (walletType === 'privateKey') {
          // Imported private-key wallet: one key, no HD wallet (only usable on EVM chains when imported as an EVM key).
          if (!hasEvm) { sk.delete(); return { ok: false, error: 'This wallet has no EVM account' }; }
          pk = sk.privateKey(core.CoinType.ethereum, new TextEncoder().encode(passwordKey));
        } else {
          hd = sk.wallet(new TextEncoder().encode(passwordKey));
          pk = derivationIndex === 0
            ? hd.getKeyForCoin(core.CoinType.ethereum)
            : hd.getKey(core.CoinType.ethereum, wallet.accountPath(core.CoinType.ethereum, derivationIndex));
        }
        const pkHex = core.HexCoding.encode(pk.data()) as `0x${string}`;
        pk.delete(); hd?.delete(); sk.delete();
        const account = privateKeyToAccount(pkHex);
        const input = { from: account.address, to, amount, token: token ? { address: token.address, decimals: token.decimals } : undefined };
        if (msg.type === 'estimateSend') {
          const est = await estimateSend(clientFor(chainId)!, input);
          return { ok: true, estimate: est, symbol: nativeSymbol(chainId) };
        }
        const sym = nativeSymbol(chainId);
        const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: sym, symbol: sym, decimals: 18 }, rpcUrls: { default: { http: [url] } } });
        const client = createWalletClient({ account, chain, transport: rpcUrl(chainId) === url ? evmTransport(chainId) : http(url) });
        const hash = await client.sendTransaction(buildTransfer(input));
        return { ok: true, hash };
      } catch (e: any) { return { ok: false, error: e?.shortMessage || e?.message || 'Transaction failed' }; }
    }
  },
  estimateSend: (msg, ctx) => handlers['sendTx'](msg, ctx),
};
