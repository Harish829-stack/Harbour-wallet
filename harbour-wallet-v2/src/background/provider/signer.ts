// Real signer: opens the connected account's key inside one operation, signs with viem (EVM) or wallet-core (ed25519), and disposes the key.
import type { VaultService } from '../../core/vaultService';
import type { WalletService } from '../../core/walletService';
import { getCore } from '../../core/walletCore';
import { ERR, ProviderError } from '../../core/provider/errors';
import { evmSignMessage, evmSignTypedData, evmSendTransaction } from '../../core/provider/evmSign';
import { openConnectionKeys, readAccountOf, readWalletAccounts } from './wallet';
import type { Signer } from './service';

export function createSigner(mk: () => { vault: VaultService; wallet: WalletService }): Signer {
  const locked = <T,>(p: Promise<T>): Promise<T> => p.catch((e) => { if (String(e?.message) === 'LOCKED') throw new ProviderError(ERR.UNAUTHORIZED, 'Wallet is locked.'); throw e; });
  async function withKeys<T>(c: any, fn: (k: Awaited<ReturnType<typeof openConnectionKeys>>, core: any) => Promise<T>): Promise<T> {
    const core = await getCore(); const { vault, wallet } = mk();
    const keys = await locked(openConnectionKeys(core, vault, wallet, c));
    try { return await fn(keys, core); } finally { keys.dispose(); }
  }
  return {
    accounts: () => locked(readWalletAccounts(mk().vault)),
    accountOf: (walletId, index) => locked(readAccountOf(mk().vault, walletId, index)),
    signMessage: (c, bytesHex, mode) => withKeys(c, async (k) => evmSignMessage(k.evmPrivateKey(), bytesHex, mode)),
    signTypedData: (c, td) => withKeys(c, async (k) => evmSignTypedData(k.evmPrivateKey(), td)),
    sendTransaction: (c, net, tx, opts) => withKeys(c, async (k) => evmSendTransaction(k.evmPrivateKey(), tx, { urls: net.rpcs, chainId: net.chainId, name: net.name, symbol: net.symbol, gas: opts.gas, fee: opts.fee })),
    solSign: (c, messages) => withKeys(c, async (k, core) => { const { key } = k.solanaKey(); return messages.map((m) => Uint8Array.from(key.sign(m, core.Curve.ed25519) as Uint8Array)); }),
  };
}
