import React, { useMemo, useState } from 'react';
import { Screen, Coin, Row, Empty, Skeleton } from '../ui';
import type { Ctx } from '../screens';
import { allAssets } from '../data';
import { useTokenItems, tokenItem } from '../tokensStore';
import { chainOfAsset, useSendSupport, fmtAmount } from './lib';
import { resetDraft } from './store';
import { networkByChainId } from '../../../core/customTokens';
import { money } from '../../settingsStore';

// One search field everywhere: the shared box draws the focus glow on its rounded edge, never around the bare input.
import { SearchBox } from '../pickers';
export { SearchBox };

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
    }).sort((x, y) => Number(y.a.id === c.networkFilter && y.a.native) - Number(x.a.id === c.networkFilter && x.a.native) || Number(y.ok) - Number(x.ok) || Number(y.bal > 0) - Number(x.bal > 0) || y.bal * (y.a.price || 0) - x.bal * (x.a.price || 0));
  }, [q, c.balances, support, c.hiddenAssets, c.networkFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Send" onBack={c.nav.pop}>
      <SearchBox value={q} onChange={setQ} placeholder="Search assets" testid="asset-search" />
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
