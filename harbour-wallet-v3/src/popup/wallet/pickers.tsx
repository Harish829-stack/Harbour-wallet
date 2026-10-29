import React, { useMemo, useState } from 'react';
import { T } from '../theme';
import { Coin, Empty, Ic, ICON, Row, Sheet } from './ui';

// Shared network picker: one searchable, grouped list used wherever the user must choose a network
// (Add custom token, Import NFT). Long flat lists made people scroll through ~100 chains; here the
// search box is pinned, popular networks come first and testnets are kept apart.
export interface PickNetwork { key: string; id: string; name: string; sym?: string; sub?: string; testnet?: boolean; custom?: boolean }

const POPULAR = ['ethereum', 'base', 'smartchain', 'polygon', 'arbitrum', 'optimism', 'avalanchec', 'solana', 'tron'];
const byName = (a: PickNetwork, b: PickNetwork) => a.name.localeCompare(b.name);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; label?: string }> = ({ value, onChange, placeholder, autoFocus, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgAlt, borderRadius: 14, padding: '0 14px', minHeight: 46 }}>
    <span style={{ color: T.sub, display: 'inline-flex' }}><Ic d={ICON.search} size={18} /></span>
    <input type="text" inputMode="search" aria-label={label ?? placeholder} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} autoComplete="off"
      style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: T.text, padding: '12px 0' }} />
    {value && <button type="button" className="hb-tap" aria-label="Clear search" onClick={() => onChange('')} style={{ background: 'none', border: 'none', color: T.sub, cursor: 'pointer', display: 'inline-flex', padding: 4 }}><Ic d={ICON.close} size={16} /></button>}
  </div>
);

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: T.sub, margin: '16px 0 2px' }}>{children}</div>
);

export const NetworkPicker: React.FC<{ items: PickNetwork[]; onPick: (n: PickNetwork) => void; selectedId?: string; autoFocus?: boolean }> = ({ items, onPick, selectedId, autoFocus = true }) => {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const groups = useMemo(() => {
    if (query) {
      const hit = items.filter((n) => n.name.toLowerCase().includes(query) || (n.sym ?? '').toLowerCase().includes(query) || n.id.toLowerCase().includes(query));
      // names that start with the query come first
      hit.sort((a, b) => Number(b.name.toLowerCase().startsWith(query)) - Number(a.name.toLowerCase().startsWith(query)) || byName(a, b));
      return [{ title: '', list: hit }];
    }
    const popular = POPULAR.map((id) => items.find((n) => n.id === id)).filter((n): n is PickNetwork => !!n);
    const rest = items.filter((n) => !popular.includes(n));
    return [
      { title: 'Popular', list: popular },
      { title: 'Custom networks', list: rest.filter((n) => n.custom).sort(byName) },
      { title: 'All networks', list: rest.filter((n) => !n.custom && !n.testnet).sort(byName) },
      { title: 'Testnets', list: rest.filter((n) => !n.custom && n.testnet).sort(byName) },
    ].filter((g) => g.list.length);
  }, [items, query]);
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  return <div>
    <div style={{ position: 'sticky', top: 0, zIndex: 3, background: T.bg, padding: '2px 0 8px' }}>
      <SearchBox value={q} onChange={setQ} placeholder="Search networks" autoFocus={autoFocus} />
      <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{query ? `${total} networks found` : ''}</div>
    </div>
    {total === 0 ? <Empty title="No network found" sub="Check the spelling, or try the network's ticker." icon="search" /> : groups.map((g) => <div key={g.title || 'results'}>
      {g.title && <Heading>{g.title}</Heading>}
      {g.list.map((n) => <Row key={n.key} onClick={() => onPick(n)} left={<Coin sym={n.sym ?? n.name.slice(0, 3)} assetId={n.id} size={36} />} title={n.name} sub={n.sub ?? (n.testnet ? 'Testnet' : undefined)}
        right={n.id === selectedId ? <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span> : <span style={{ color: T.sub }}><Ic d={ICON.chevron} size={18} /></span>} />)}
    </div>)}
  </div>;
};

/** Field-style button showing the chosen network; opens the picker in a sheet (replaces native <select> with 100+ options). */
export const NetworkField: React.FC<{ items: PickNetwork[]; value: string; onChange: (id: string) => void; id?: string; testid?: string }> = ({ items, value, onChange, id, testid }) => {
  const [open, setOpen] = useState(false);
  const cur = items.find((n) => n.id === value);
  return <>
    <button type="button" id={id} data-testid={testid} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="hb-tap"
      style={{ width: '100%', marginTop: 6, minHeight: 48, padding: '8px 14px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.text, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, textAlign: 'left' }}>
      {cur ? <Coin sym={cur.sym ?? cur.name.slice(0, 3)} assetId={cur.id} size={26} /> : null}
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur?.name ?? 'Select network'}</span>
      <span style={{ color: T.sub, display: 'inline-flex' }}><Ic d={ICON.down} size={18} /></span>
    </button>
    {open && <Sheet title="Select network" onClose={() => setOpen(false)}>
      <NetworkPicker items={items} selectedId={value} autoFocus onPick={(n) => { onChange(n.id); setOpen(false); }} />
    </Sheet>}
  </>;
};
