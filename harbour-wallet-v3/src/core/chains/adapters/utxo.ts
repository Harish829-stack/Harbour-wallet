import { simple, getJ } from './net';
import { toBig } from './codec';

/** Esplora-compatible (mempool.space / Blockstream): GET /address/{addr} -> chain_stats / mempool_stats funded & spent sums. */
export const utxoBalance = simple(async (u, ci, a, f) => {
  if (ci.api === 'blockbook') { // Blockbook v2: { balance, unconfirmedBalance } as decimal strings in base units
    const r = await getJ(f, `${u}/api/v2/address/${encodeURIComponent(a)}?details=basic`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (r.body?.balance == null) throw new Error('bad response');
    const v = toBig(r.body.balance) + toBig(r.body.unconfirmedBalance ?? 0);
    return v < 0n ? 0n : v;
  }
  const r = await getJ(f, `${u}/address/${encodeURIComponent(a)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const c = r.body?.chain_stats; const m = r.body?.mempool_stats;
  if (!c) throw new Error('bad response');
  const v = toBig(c.funded_txo_sum) - toBig(c.spent_txo_sum) + toBig(m?.funded_txo_sum ?? 0) - toBig(m?.spent_txo_sum ?? 0);
  return v < 0n ? 0n : v;
});
