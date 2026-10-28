import React from 'react';
import { T } from '../theme';
import { Coin } from './ui';
import { pct } from './data';
import { moneyPrice, moneySigned, money } from '../settingsStore';
import type { TokenLayout } from '../../core/settings';

// The Home asset row in the three layouts Trust Wallet offers (Settings › Preferences › Asset layout).
// Evidence: TW App chunk, token-cell component — `getTitle`, `getSecondaryInfo`, and the right-hand value column:
//   LAYOUT_1: title = name   | left sub = "<amount> <SYMBOL>" | right = fiat balance + fiat 24h value change
//   LAYOUT_2: title = symbol | left sub = "<amount> <name>"   | right = fiat balance + fiat 24h value change
//   LAYOUT_3: title = symbol | left sub = price + 24h %       | right = crypto amount + fiat balance
// where fiat value change = price × balance × change% ÷ 100 and a hidden balance renders as dots.  [certain]
export interface CellData { name: string; sym: string; assetId?: string; color?: string; evm: boolean; amount: string; fiatUsd: number | null; price: number | null; change: number | null }

export const TokenCell: React.FC<{ d: CellData; layout: TokenLayout; hide?: boolean; onClick?: () => void }> = ({ d, layout, hide = false, onClick }) => {
  const mask = (s: React.ReactNode) => (hide ? '••••' : s);
  const fiat = d.evm ? money(d.fiatUsd ?? 0) : '';
  const valueChange = d.evm && d.fiatUsd != null && d.change != null ? d.fiatUsd * (d.change / 100) : null;
  const title = layout === 1 ? d.name : d.sym;
  const secLeft = layout === 3
    ? <>{d.price != null ? moneyPrice(d.price) : '—'} {d.change != null && <span style={{ color: d.change >= 0 ? T.success : T.error }}>{pct(d.change)}</span>}</>
    : <>{mask(d.amount)} {layout === 1 ? d.sym : d.name}</>;
  const rightTop = layout === 3 ? (d.evm ? mask(d.amount) : '—') : mask(fiat || '—');
  const rightSub = layout === 3 ? mask(fiat) : (valueChange != null && !hide ? <span style={{ color: valueChange < 0 ? T.error : T.success }}>{moneySigned(valueChange)}</span> : '');
  return (
    <div className={onClick ? 'hb-tap hb-wallet-token-row' : 'hb-wallet-token-row'} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} onKeyDown={onClick?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClick();}}:undefined} onClick={onClick} data-testid="asset-row" data-layout={layout} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: onClick ? 'pointer' : 'default' }}>
      <Coin sym={d.sym} assetId={d.assetId} size={38} color={d.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 12, color: T.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secLeft}</div>
      </div>
      <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{rightTop}</div><div style={{ fontSize: 12, color: T.sub }}>{rightSub}</div></div>
    </div>
  );
};
