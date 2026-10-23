import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, EllipsisVertical, Lock, Settings, ShieldCheck, Wallet, FolderCog, ScrollText, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ALL_CHAINS, chainById, chainLogo } from '../../core/chains/index';
import { privateKeyNetworkOptions, type PkNetworkOption } from '../../core/importKey';
import { ThemedImg } from './FlowFrame';
import { INSTRUCTIONS, parseInstruction, type InstructionProduct, type InstructionStep } from './instructions';

export const ChainIcon: React.FC<{ id: string; size?: number }> = ({ id, size = 24 }) => {
  const [bad, setBad] = useState(false); const c = chainById(id);
  if (bad || !c) return <span className="ob-coin" style={{ width: size, height: size }} aria-hidden="true">{(c?.symbol ?? id).slice(0, 3).toUpperCase()}</span>;
  return <img src={chainLogo(id)} width={size} height={size} alt="" onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}/>;
};
const StackedIcons: React.FC<{ ids: string[] }> = ({ ids }) => <span className="ob-stack">{ids.map((id) => <ChainIcon key={id} id={id} size={24}/>)}</span>;

export interface PkNetwork { option: PkNetworkOption }
/** Private-key network picker: "EVM chains" group first, then every other chain; search by name/symbol; empty state. */
export const PkNetworkSelect: React.FC<{ value: PkNetworkOption | null; onSelect: (o: PkNetworkOption) => void; disabled?: boolean }> = ({ value, onSelect, disabled }) => {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const root = useRef<HTMLDivElement>(null);
  const options = useMemo(() => privateKeyNetworkOptions(ALL_CHAINS, q), [q]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (o: PkNetworkOption) => { onSelect(o); setQ(''); setOpen(false); };
  return (
    <div className="ob-select" ref={root} data-testid="pk-network-select">
      <div style={{ fontWeight: 500, marginBottom: 12 }}>Select Network</div>
      <button type="button" className="ob-select-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value ? (value.kind === 'evm-group' ? <StackedIcons ids={value.iconIds}/> : <ChainIcon id={value.id}/>) : <Search size={18} aria-hidden="true"/>}
        <span style={{ flex: 1 }}>{value ? value.label : 'Select Network'}</span><ChevronDown size={18} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}/>
      </button>
      {open && <div className="ob-select-pop" role="listbox" aria-label="Networks">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search networks" data-testid="pk-network-select-search"/>
        {options.length === 0 && <div className="ob-select-empty" data-testid="pk-network-empty">No networks found</div>}
        {options.map((o) => <button type="button" key={o.id} role="option" aria-selected={value?.id === o.id} className="ob-select-opt" onClick={() => pick(o)}>
          {o.kind === 'evm-group' ? <StackedIcons ids={o.iconIds}/> : <ChainIcon id={o.id}/>}<span>{o.label}</span></button>)}
      </div>}
    </div>
  );
};

const STEP_ICON: Record<InstructionStep['icon'], LucideIcon> = { wallet: Wallet, menu: EllipsisVertical, shield: ShieldCheck, settings: Settings, lock: Lock, manage: FolderCog, phrase: ScrollText };
/** Source-specific import instructions (tabs + step carousel). Shown in the sidebar of the secret step. */
export const ImportInstructions: React.FC<{ product: InstructionProduct }> = ({ product }) => {
  const set = INSTRUCTIONS[product]; const [tab, setTab] = useState(0); const [i, setI] = useState(0);
  const steps = set.platforms[tab]?.steps ?? []; const step = steps[i]; const Icon = step ? STEP_ICON[step.icon] : Wallet;
  useEffect(() => { setI(0); }, [tab, product]);
  return (
    <div className="ob-instr" data-testid="import-instructions">
      <div className="ob-instr-head">{set.header}</div>
      {set.platforms.length > 1 && <div className="ob-tabs" role="tablist">{set.platforms.map((p, n) => <button key={p.title} type="button" role="tab" className="ob-tab" aria-selected={n === tab} onClick={() => setTab(n)}>{p.title}</button>)}</div>}
      <div className="ob-instr-art" key={step?.id}>{step ? <ThemedImg name={step.image} alt=""/> : <Icon size={56} strokeWidth={1.3}/>}</div>
      <div className="ob-instr-text" aria-live="polite">{step && parseInstruction(step.text).map((s, n) => s.k === 'bold' ? <b key={n}>{s.v}</b> : s.k === 'menu' ? <EllipsisVertical key={n} size={14} style={{ verticalAlign: 'middle' }} aria-label="menu"/> : s.k === 'gear' ? <Settings key={n} size={12} style={{ verticalAlign: 'middle' }} aria-label="settings"/> : <React.Fragment key={n}>{s.v}</React.Fragment>)}</div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <button type="button" className="ob-arrow" aria-label="Previous step" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={16}/></button>
        <div className="ob-dots">{steps.map((s, n) => <button key={s.id} type="button" aria-label={`Step ${n + 1}`} aria-current={n === i} onClick={() => setI(n)}/>)}</div>
        <button type="button" className="ob-arrow" aria-label="Next step" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}><ChevronRight size={16}/></button>
      </div>
    </div>
  );
};

export type SecretCheck = { state: 'idle' | 'checking' | 'valid' | 'invalid'; error?: string };
/** Wallet name + secret (phrase or private key) + network picker, exactly the field set of TW's import page. */
export const SecretForm: React.FC<{
  name: string; onName: (v: string) => void; nameError?: string; product: InstructionProduct;
  secret: string; onSecret: (v: string) => void; kind: 'empty' | 'mnemonic' | 'privateKey'; check: SecretCheck;
  network: PkNetworkOption | null; onNetwork: (o: PkNetworkOption) => void;
  error: string; busy: boolean; canSubmit: boolean; onSubmit: (e: React.FormEvent) => void;
}> = (p) => {
  const [visible, setVisible] = useState(false);
  const hint = INSTRUCTIONS[p.product].inputHint.split('\n');
  const detected = p.kind === 'mnemonic' ? 'Secret Phrase detected' : p.kind === 'privateKey' ? 'Private Key detected' : null;
  return (
    <form className="ob-import-form" onSubmit={p.onSubmit}>
      <label className={`ob-field ${p.nameError ? 'has-error' : ''}`}><span>Wallet Name</span>
        <input data-testid="wallet-name-input" value={p.name} onChange={(e) => p.onName(e.target.value)} disabled={p.busy} maxLength={40} aria-invalid={!!p.nameError}/>
        <small className={p.nameError ? '' : 'ob-muted'}>{p.nameError ?? 'You can edit this later'}</small>
      </label>
      <label className={`ob-field ${p.check.state === 'invalid' && p.check.error ? 'has-error' : ''}`}><span>{INSTRUCTIONS[p.product].inputLabel}</span>
        <textarea data-testid="secret-input" autoFocus value={p.secret} onChange={(e) => p.onSecret(e.target.value)} disabled={p.busy} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off" className={visible ? '' : 'ob-secret-masked'} aria-invalid={p.check.state === 'invalid'}/>
        {/* eslint-disable-next-line no-constant-condition -- secret toggle is always offered */}
        {p.kind !== 'mnemonic' || true ? <button type="button" className="ob-link ob-secret-toggle" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? <EyeOff size={14}/> : <Eye size={14}/>}{visible ? 'Hide' : 'Show'}</button> : null}
        {p.check.state === 'invalid' && p.check.error ? <small role="alert">{p.check.error}</small> : <small className="ob-muted" data-testid="secret-caption">{detected ?? hint.map((h, n) => <React.Fragment key={n}>{h}{n < hint.length - 1 && <br/>}</React.Fragment>)}</small>}
      </label>
      {p.kind === 'privateKey' && <PkNetworkSelect value={p.network} onSelect={p.onNetwork} disabled={p.busy}/>}
      {p.error && <div className="ob-notice warn" role="alert" data-testid="import-error">{p.error}</div>}
      <button className="ob-primary ob-half" data-testid="import-wallet-submit" disabled={!p.canSubmit || p.busy}>{p.busy ? 'Importing...' : 'Import'}</button>
    </form>
  );
};
