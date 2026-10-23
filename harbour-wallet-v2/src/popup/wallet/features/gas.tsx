// Feature "gas" — Gas station (TW route /gas-station/:assetId): live fee tiers for an EVM network from its public JSON-RPC.
// Data: background `chainDataGas` (core/gasFees.ts). No static numbers: loading / error / retry states, refreshes while open.
import React, { useEffect, useRef, useState } from 'react';
import type { Ctx } from '../types';
import { T } from '../../theme';
import { Screen, Skeleton, Btn, Coin } from '../ui';
import { evmChains, chainById } from '../../../core/chains/index';
import { gwei, type GasQuote } from '../../../core/gasFees';
import { formatUnits } from '../../../core/chains/adapters/types';
import { money } from '../../settingsStore';

type Res = { ok: true; quote: GasQuote; symbol: string; decimals: number; nativePriceUsd: number | null; testnet: boolean } | { ok: false; error: string };
const REFRESH_MS = 15_000;

export const GasStationScreen: React.FC<Ctx> = (c) => {
  const start = chainById(c.params?.assetId);
  const [id, setId] = useState<string>(start?.kind === 'evm' ? start.id : 'ethereum');
  const [res, setRes] = useState<Res | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    let dead = false; const my = ++seq.current; setRes(null);
    const load = () => c.bg({ type: 'chainDataGas', chainId: id }).then((r: Res) => { if (!dead && my === seq.current) setRes(r?.ok ? r : { ok: false, error: r?.error || 'Could not load fees right now.' }); })
      .catch(() => { if (!dead && my === seq.current) setRes({ ok: false, error: 'Could not load fees right now.' }); });
    void load(); const t = setInterval(load, REFRESH_MS);
    return () => { dead = true; clearInterval(t); };
  }, [id, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const chains = evmChains();
  const ch = chainById(id);
  const cost = (wei: string, r: Extract<Res, { ok: true }>) => {
    const native = Number(formatUnits(BigInt(wei), r.decimals));
    return { native: native < 0.000001 ? '<0.000001' : native.toLocaleString(undefined, { maximumFractionDigits: 6 }), usd: r.nativePriceUsd != null && !r.testnet ? native * r.nativePriceUsd : null };
  };
  return (
    <Screen title="Gas station" onBack={c.nav.pop}>
      <div role="tablist" aria-label="Network" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 12px', margin: '0 -2px' }}>
        {chains.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === id} type="button" className="hb-tap" onClick={() => setId(x.id)}
            style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${x.id === id ? T.accent : T.border}`, background: x.id === id ? T.accentSoft : T.surface, color: x.id === id ? T.accent : T.text, borderRadius: 999, padding: '6px 12px 6px 6px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Coin sym={x.symbol} assetId={x.id} size={22} />{x.name}
          </button>
        ))}
      </div>
      {res == null ? <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={72} r={14} />)}</div>
        : !res.ok ? (
          <div role="alert" style={{ textAlign: 'center', padding: '28px 12px', color: T.sub, fontSize: 14 }}>{res.error}<div style={{ marginTop: 12 }}><Btn variant="ghost" onClick={() => setNonce((n) => n + 1)}>Retry</Btn></div></div>
        ) : <>
          <div style={{ background: T.bgAlt, borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 12 }}>
            <span style={{ color: T.sub }}>{res.quote.eip1559 ? 'Next block base fee' : 'Gas price'}</span>
            <span data-testid="gas-base" style={{ fontWeight: 700 }}>{gwei(res.quote.baseFee ?? res.quote.gasPrice)} Gwei</span>
          </div>
          {res.quote.tiers.map((t) => { const k = cost(t.costWei, res); return (
            <div key={t.id} data-testid={`gas-tier-${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: T.sub }}>Max {gwei(t.maxFeePerGas)} Gwei{res.quote.eip1559 ? ` · tip ${gwei(t.priorityFee)}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{k.native} {res.symbol}</div>
                <div style={{ fontSize: 12, color: T.sub }}>{k.usd != null ? money(k.usd) : res.testnet ? 'Testnet' : 'No price available'}</div>
              </div>
            </div>); })}
          <div style={{ color: T.sub, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
            Cost shown is for a plain {ch?.symbol ?? res.symbol} transfer ({res.quote.transferGas.toLocaleString()} gas) at the maximum fee; you pay the actual base fee plus tip. Source: {ch?.name ?? 'network'} public RPC, refreshed every 15 seconds.
          </div>
        </>}
    </Screen>
  );
};
export const SCREENS_gas: Record<string, React.FC<Ctx>> = { gasStation: GasStationScreen };
