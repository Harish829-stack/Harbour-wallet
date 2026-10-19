import React, { useMemo, useState } from 'react';
import { T } from '../../theme';
import { Screen, Coin, Row, Empty, Skeleton, Ic, ICON } from '../ui';
import type { Ctx } from '../screens';
import { allAssets } from '../data';
import { useTokenItems, tokenItem } from '../tokensStore';
import { chainOfAsset, useSendSupport, fmtAmount } from './lib';
import { resetDraft } from './store';
import { networkByChainId } from '../../../core/customTokens';
import { money } from '../../settingsStore';

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, background: T.bgAlt, border: `1px solid ${T.border}`, margin: '4px 0 10px' }}>
    <Ic d={ICON.search} size={18} />
    <input data-testid="asset-search" aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: T.text, outline: 'none', fontSize: 15 }} />
  </div>
);

/** `/send`: choose the asset to send. Rows whose network cannot sign yet stay tappable and explain why on the next screen. */
export const SendSelect: React.FC<Ctx> = (c) => {
  useTokenItems(); const support = useSendSupport(c.bg); const [q, setQ] = useState('');
  const hidden = new Set(c.hiddenAssets ?? []);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allAssets().filter((a) => !hidden.has(a.id)).filter((a) => !term || a.name.toLowerCase().includes(term) || a.sym.toLowerCase().includes(term)).map((a) => {
      const bal = a.token ? Number(tokenItem(a.id)?.formatted ?? 0) : Number(c.balances[a.id]?.formatted ?? 0);
      const chain = chainOfAsset(a); const sup = chain ? support?.[chain.id] : undefined; const ok = !support || (!!sup?.supported && (!a.token || sup.tokens || chain?.kind === 'evm'));
      return { a, bal, ok, chain };
    }).sort((x, y) => Number(y.ok) - Number(x.ok) || Number(y.bal > 0) - Number(x.bal > 0) || y.bal * (y.a.price || 0) - x.bal * (x.a.price || 0));
  }, [q, c.balances, support, c.hiddenAssets]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Send" onBack={c.nav.pop}>
      <div style={{ color: T.sub, fontSize: 13, margin: '4px 0 8px' }}>Select asset to send</div>
      <SearchBox value={q} onChange={setQ} placeholder="Search assets" />
      {!support && rows.length === 0 ? <Skeleton h={56} /> : rows.length === 0 ? <Empty title="No assets found" sub={q ? 'Try a different name or symbol.' : 'Add a network or token from the home screen.'} icon="search" />
        : rows.map(({ a, bal, ok, chain }) => {
          const usdv = bal * (a.token ? tokenItem(a.id)?.price ?? 0 : c.balances[a.id]?.price ?? 0);
          return <Row key={a.id} onClick={() => { resetDraft(a.id); c.nav.push('sendPrepare', { assetId: a.id }); }}
            left={<Coin sym={a.sym} assetId={a.id} color={a.color} />} title={<span style={{ opacity: ok ? 1 : 0.55 }}>{a.name}</span>}
            sub={!ok ? 'Not supported yet' : a.token ? `${a.sym} · ${networkByChainId(a.chainId)?.name ?? chain?.name ?? ''}` : a.sym}
            right={bal > 0 ? `${Number(bal.toFixed(6))} ${a.sym}` : undefined} rightSub={usdv > 0 ? money(usdv) : undefined} />;
        })}
    </Screen>
  );
};
export { fmtAmount };
