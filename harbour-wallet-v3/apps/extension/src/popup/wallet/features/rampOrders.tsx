// Buy / sell order list (orders Harbour opened with Onramper). Status comes from the Harbour backend, which Onramper updates by
// webhook; the list refreshes every 15 s while an order is still open. Reached from Fund, the checkout "Track order" button and
// the #/ramps/orders page the finished provider tab is turned into.
import React, { useEffect } from 'react';
import { T } from '../../theme';
import type { Ctx } from '../screens';
import { Screen, Row, Empty, Coin } from '../ui';
import { ListSkeleton, ErrorBox, Notice, useAsync, ago, fmtCrypto, fmtFiat } from './rampKit';

interface OrderRow { id: string; type: 'buy' | 'sell'; status: string; statusLabel: string; symbol: string; isNative: boolean; chain: string; chainName: string; providerName: string; fiatCode: string; fiat_amount: number | null; crypto_amount: number | null; status_reason?: string; created_at: number }

const tone = (s: string) => (s === 'completed' ? T.accent : s === 'failed' || s === 'canceled' ? T.error : T.sub);

export const RampOrdersScreen: React.FC<Ctx> = (c) => {
  const r = useAsync(async () => { const x = await c.bg({ type: 'rampsOrders' }); if (!x?.ok) throw new Error(x?.error ?? 'Could not load orders'); return x.orders as OrderRow[]; }, []);
  const open = (r.data ?? []).some((o) => o.status === 'created' || o.status === 'pending');
  useEffect(() => { if (!open) return; const t = setInterval(r.reload, 15_000); return () => clearInterval(t); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Buy and sell orders" onBack={c.nav.pop}>
      {r.loading && !r.data ? <ListSkeleton n={4} /> : r.error ? <ErrorBox message={r.error} onRetry={r.reload} /> : !r.data?.length
        ? <Empty title="No orders yet" sub="Purchases and sales you start in Harbour show up here." icon="history" />
        : <div className="hb-rise">
            {open && <Notice>Providers can take a few minutes to confirm a payment. This list updates on its own.</Notice>}
            {r.data.map((o) => (
              <Row key={o.id} left={<Coin sym={o.symbol} assetId={o.isNative ? o.chain : undefined} size={40} />}
                title={`${o.type === 'buy' ? 'Buy' : 'Sell'} ${o.symbol}`}
                sub={`${o.providerName} · ${o.chainName} · ${ago(o.created_at)}`}
                right={o.type === 'buy' ? (o.crypto_amount ? `${fmtCrypto(o.crypto_amount)} ${o.symbol}` : o.fiat_amount ? fmtFiat(o.fiat_amount, o.fiatCode) : '') : (o.fiat_amount ? fmtFiat(o.fiat_amount, o.fiatCode) : o.crypto_amount ? `${fmtCrypto(o.crypto_amount)} ${o.symbol}` : '')}
                rightSub={<span style={{ color: tone(o.status), fontWeight: 600 }} title={o.status_reason}>{o.statusLabel}</span>} />
            ))}
            <div style={{ fontSize: 11, color: T.sub, textAlign: 'center', margin: '14px 0 4px', lineHeight: 1.5 }}>Payments and identity checks are handled by the provider. For help with an order, contact the provider shown.</div>
          </div>}
    </Screen>);
};
