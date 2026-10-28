import { simple, getJ } from './net';
import { toBig } from './codec';

/** Native bank denom per Cosmos-SDK chain (wallet-core / chain-registry). thorchain's native denom is "rune"; injective/zetachain use 18-decimal a-/inj denoms. */
export const COSMOS_DENOM: Record<string, string> = {
  cosmos: 'uatom', terra: 'uluna', kava: 'ukava', agoric: 'ubld', thorchain: 'rune', nativeinjective: 'inj', osmosis: 'uosmo', zetachain: 'azeta',
  akash: 'uakt', sei: 'usei', juno: 'ujuno', stride: 'ustrd', axelar: 'uaxl', neutron: 'untrn',
};

/** LCD GET /cosmos/bank/v1beta1/balances/{addr}; a missing denom means the account holds none (=> 0). Falls back to .../by_denom when the list is paginated. */
export const cosmosBalance = simple(async (u, chain, a, f) => {
  const denom = COSMOS_DENOM[chain.id]; if (!denom) throw new Error(`no native denom for ${chain.id}`);
  const r = await getJ(f, `${u}/cosmos/bank/v1beta1/balances/${encodeURIComponent(a)}`);
  if (!r.ok || !Array.isArray(r.body?.balances)) throw new Error(`HTTP ${r.status}`);
  const hit = r.body.balances.find((b: any) => b?.denom === denom);
  if (hit) return toBig(hit.amount);
  if (r.body?.pagination?.next_key) {
    const d = await getJ(f, `${u}/cosmos/bank/v1beta1/balances/${encodeURIComponent(a)}/by_denom?denom=${encodeURIComponent(denom)}`);
    if (!d.ok) throw new Error(`HTTP ${d.status}`);
    return toBig(d.body?.balance?.amount ?? 0);
  }
  return 0n;
});
