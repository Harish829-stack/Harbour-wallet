import type { BalanceAdapter } from './types';
import { fail, okRaw, jsonPost, firstOf } from './types';
import { solanaRpcUrl } from '../../rpc';
export const solanaBalance: BalanceAdapter = async (chain, address, f) => {
  const urls = [solanaRpcUrl(), ...(chain.endpoints ?? [])].filter((u, i, a) => u && a.indexOf(u) === i);
  try {
    const lamports = await firstOf(urls, async (u) => {
      const j = await jsonPost(f, u, { jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address, { commitment: 'confirmed' }] });
      const v = j?.result?.value; if (typeof v !== 'number') throw new Error(j?.error?.message ?? 'bad response');
      return v;
    });
    return okRaw(BigInt(lamports), chain.decimals);
  } catch (e: any) { return fail(e?.message ?? 'RPC failed'); }
};
