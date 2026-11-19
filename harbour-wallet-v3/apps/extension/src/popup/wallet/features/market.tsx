// Feature "market" — Trending token detail. A Trending row is a market coin (CoinGecko id), not a wallet asset, so it gets its
// own read-only screen: live price, chart and About for THAT coin. It never shows a wallet balance or Send/Receive, because the
// user may hold none of it and Harbour may not support its network. Data: background `tokenChart` / `tokenInfo` with `cg:<id>`.
import React, { useState } from 'react';
import type { Ctx } from '../screens';
import { T } from '../../theme';
import { Screen, Coin, Skeleton, InkTabs } from '../ui';
import { useChart, PriceChart, useInfo, AboutPanel } from '../tokenData';
import { CHART_RANGES, type ChartRange } from '../../../core/marketData';
import { usd, pct } from '../data';

export interface MarketCoin { id: string; symbol: string; name: string; price?: number | null; change?: number | null }
const CG_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const marketAssetId = (cgId: string): string | null => (CG_ID.test(cgId) ? `cg:${cgId}` : null);

export const MarketTokenScreen: React.FC<Ctx> = (c) => {
  const coin = c.params?.coin as MarketCoin | undefined;
  const assetId = coin ? marketAssetId(coin.id) : null;
  if (!coin || !assetId) return <Screen title="Token" onBack={c.nav.pop}><div style={{ color: T.sub, textAlign: 'center', padding: 24 }}>This token is not available.</div></Screen>;
  return <MarketBody c={c} coin={coin} assetId={assetId} />;
};

const MarketBody: React.FC<{ c: Ctx; coin: MarketCoin; assetId: string }> = ({ c, coin, assetId }) => {
  const [range, setRange] = useState<ChartRange>('1D');
  const [tab, setTab] = useState<'about'>('about');
  const [scrub, setScrub] = useState<{ t: number; p: number } | null>(null);
  const chart = useChart(c.bg, assetId, range);
  const info = useInfo(c.bg, assetId, true);
  const sym = coin.symbol.toUpperCase();
  const price: number | null = scrub?.p ?? chart.data?.last ?? info.info?.price ?? coin.price ?? null;
  const change: number | null = chart.data?.changePct ?? coin.change ?? null;
  const up = (change ?? 0) >= 0;
  return (
    <Screen pad={false} onBack={c.nav.pop} title={<div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 16 }}>{coin.name}</div><div style={{ fontSize: 12, color: T.sub }}>{sym}</div></div>}>
      <div style={{ textAlign: 'center', paddingTop: 10 }} className="hb-rise">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Coin sym={sym} size={40} /></div>
        <div data-testid="market-price" style={{ fontSize: 30, fontWeight: 800 }}>{price != null ? usd(price) : '…'}</div>
        {change != null && <div style={{ color: up ? T.success : T.error, fontWeight: 600, fontSize: 14, marginTop: 2 }}>{up ? '▲' : '▼'} {pct(change)}</div>}
      </div>
      <div style={{ margin: '18px 0', minHeight: 130 }}>
        {chart.loading ? <Skeleton h={130} r={0} />
          : chart.data ? <PriceChart points={chart.data.points} up={up} range={range} h={130} onScrub={setScrub} />
          : <div style={{ height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.sub, fontSize: 13, textAlign: 'center', padding: '0 24px' }}>{chart.error}<button type="button" className="hb-tap" onClick={chart.retry} style={{ marginTop: 10, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 999, padding: '6px 16px', fontWeight: 700, cursor: 'pointer' }}>Retry</button></div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
        {CHART_RANGES.map((r) => <button key={r} type="button" onClick={() => { setScrub(null); setRange(r); }} className="hb-tap" style={{ border: 'none', background: range === r ? T.bgAlt : 'transparent', color: range === r ? T.text : T.sub, fontWeight: 600, fontSize: 13, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>{r}</button>)}
      </div>
      <InkTabs tabs={['about'] as const} value={tab} onChange={setTab} label={() => 'About'} gap={22} pad="12px 2px" style={{ padding: '0 16px', marginTop: 8 }} />
      <div style={{ padding: '12px 16px 24px' }}><AboutPanel s={info} sym={sym} name={coin.name} /></div>
    </Screen>
  );
};

export const SCREENS_market: Record<string, React.FC<Ctx>> = { marketToken: MarketTokenScreen };
