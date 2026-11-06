import type { BalanceAdapter } from './types';
import { fail, okRaw, jsonPost, firstOf } from './types';
import { getRpcUrls } from '../rpcUrls';

/** eth_getBalance over JSON-RPC, falling back through the chain's public RPC list (custom/overridden RPC first). */
export const evmBalance: BalanceAdapter = async (chain, address, f) => {
  const urls = getRpcUrls(chain);
  if (!urls.length) return fail('no RPC endpoint');
  try {
    const hex = await firstOf(urls, async (u) => {
      const j = await jsonPost(f, u, { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });
      if (typeof j?.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(j.result)) throw new Error(j?.error?.message ?? 'bad response');
      return j.result as string;
    });
    return okRaw(BigInt(hex), chain.decimals);
  } catch (e: any) { return fail(e?.message ?? 'RPC failed'); }
};
