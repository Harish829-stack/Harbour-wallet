import { userText } from '../../core/errors';
import React, { useEffect, useMemo, useState } from 'react';
import browser from 'webextension-polyfill';
import { T } from '../theme';
import { Screen, Sheet, Btn, IconBtn, Ic, ICON, Row, Spinner, Empty, inputStyle } from './ui';
import { useSettingsState, updateSettings, refreshSettings } from '../settingsStore';
import { AUTO_LOCK_OPTIONS, autoLockLabel, SUPPORTED_LOCALES, localeLabel, COLOR_MODES, TOKEN_LAYOUTS, type ColorMode, type TokenLayout } from '../../core/settings';
import { POPULAR_CURRENCIES, OTHER_CURRENCIES } from '../../core/fiat';
import { ADDRESS_BOOK_COINS, ADDRESS_BOOK_COIN_LABEL, MAX_NAME_LENGTH, type AddressBookEntry, type AddressBookCoin } from '../../core/addressBook';
import { TokenCell } from './tokenCell';
import { AddPassword } from './addPassword';
import { BiometricEnroll, isPopupContext, loadPasskeyStatus, openInTab, useBiometricAvailability, type PasskeyStatus } from '../biometricsUi';
import type { Ctx } from './screens';

// Settings, rebuilt from the Trust Wallet extension's own Settings routes (RE: evidences/re-evidence/26-settings/SETTINGS-SPEC.md).
// Every row here changes real state. Rows TW has that Harbour cannot back with a real feature yet (dApp connections,
// default wallet, developer toggles, push delivery, custom networks, UTXO management, mobile sync) are intentionally absent.

// ---------- shared building blocks ----------
export const Group: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>{children}</div>;

export const IconDot: React.FC<{ icon: string }> = ({ icon }) => <div style={{ width: 36, height: 36, borderRadius: 999, background: T.bgAlt, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic d={ICON[icon] ?? icon} size={18} /></div>;

export const NavRow: React.FC<{ icon: string; label: string; value?: string; onClick: () => void; first?: boolean; external?: boolean; testid?: string }> = ({ icon, label, value, onClick, first, external, testid }) => (
  <div className="hb-tap" role="button" tabIndex={0} data-testid={testid} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderTop: first ? 'none' : `1px solid ${T.border}`, cursor: 'pointer' }}>
    <IconDot icon={icon} />
    <span style={{ flex: 1, fontWeight: 600, minWidth: 0 }}>{label}</span>
    {value && <span style={{ color: T.sub, fontSize: 14, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>}
    <Ic d={external ? ICON.external : ICON.chevron} size={external ? 16 : 18} />
  </div>
);

export const Toggle: React.FC<{ on: boolean; onClick: () => void; label: string; disabled?: boolean }> = ({ on, onClick, label, disabled }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
    style={{ width: 46, height: 28, borderRadius: 999, border: 'none', background: on ? T.accent : T.border, position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background .25s ease', opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
    <span className="hb-switch-knob" style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: 'var(--hb-on-brand)', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
  </button>
);

export const SwitchRow: React.FC<{ icon?: string; label: string; sub?: string; on: boolean; onToggle: () => void; first?: boolean; testid?: string }> = ({ icon, label, sub, on, onToggle, first, testid }) => (
  <div data-testid={testid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderTop: first ? 'none' : `1px solid ${T.border}` }}>
    {icon && <IconDot icon={icon} />}
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{label}</div>{sub && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{sub}</div>}</div>
    <Toggle on={on} onClick={onToggle} label={label} />
  </div>
);

export const SelectionRow: React.FC<{ label: string; selected: boolean; onClick: () => void; busy?: boolean; testid?: string }> = ({ label, selected, onClick, busy, testid }) => (
  <div className="hb-tap" role="radio" aria-checked={selected} tabIndex={0} data-testid={testid} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
    <span style={{ flex: 1, fontWeight: selected ? 700 : 500 }}>{label}</span>
    {busy ? <Spinner size={16} /> : selected ? <span style={{ color: T.accent }}><Ic d={ICON.check} size={18} /></span> : null}
  </div>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontWeight: 700, color: T.sub, fontSize: 13, margin: '14px 2px 2px' }}>{children}</div>;
export const ErrorLine: React.FC<{ msg: string }> = ({ msg }) => msg ? <div role="alert" style={{ color: T.error, fontSize: 13, margin: '10px 2px' }}>{userText(msg)}</div> : null;
export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ background: T.bgAlt, color: T.sub, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, margin: '4px 0 12px' }}>{children}</div>;
const manifestVersion = (): string => { try { return browser.runtime.getManifest().version; } catch { return ''; } };

const COLOR_LABEL: Record<ColorMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

// ---------- Settings (main list; order follows TW's `Settings` component) ----------
export const SettingsScreen: React.FC<Ctx> = (c) => {
  const { settings, sidePanelSupported } = useSettingsState();
  const [wallet, setWallet] = useState<{ label: string; accounts: number } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let dead = false;
    void refreshSettings(c.bg);
    c.bg({ type: 'listWallets' }).then((r) => {
      if (dead || !r?.ok) return;
      const list: any[] = r.wallets ?? [];
      const w = list.find((x) => x.id === r.activeWalletId) ?? list[0];
      if (w) setWallet({ label: w.label, accounts: w.accounts?.length ?? 1 });
    }).catch(() => {});
    return () => { dead = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fullscreen = async () => {
    try { await browser.tabs.create({ url: browser.runtime.getURL('src/popup/index.html') }); } catch { setErr('Could not open Harbour in a tab.'); }
  };
  const syncMobile = async () => { try { await browser.tabs.create({ url: browser.runtime.getURL('src/popup/index.html') + '?sync=1' }); } catch { setErr('Could not open Harbour in a tab.'); } };
  const toggleSidePanel = async () => { setErr(''); const r = await updateSettings(c.bg, { preferSidePanel: !settings.preferSidePanel }); if (!r.ok) setErr(r.error); };
  const n = wallet?.accounts ?? c.accounts?.length ?? 1;
  return (
    <Screen title="Settings" onBack={c.nav.pop}>
      <div className="hb-tap" role="button" tabIndex={0} data-testid="settings-manage-wallets" onClick={() => c.nav.push('manageWallets')} onKeyDown={(e) => { if (e.key === 'Enter') c.nav.push('manageWallets'); }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.bgAlt, borderRadius: 16, padding: 14, margin: '6px 0 16px', cursor: 'pointer' }}>
        <div style={{ width: 42, height: 42, borderRadius: 999, background: T.accent, color: 'var(--hb-on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>H</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>Manage wallets</div><div style={{ fontSize: 12, color: T.sub }}>{wallet?.label ?? (wallet === null ? 'Loading…' : 'Wallet')} · {n} account{n === 1 ? '' : 's'}</div></div>
        <Ic d={ICON.chevron} size={18} />
      </div>
      <Group><NavRow first icon="full" label="Fullscreen" onClick={fullscreen} testid="settings-fullscreen" /></Group>
      <Group>
        <NavRow first icon="shield" label="Security" value={autoLockLabel(settings.lockTimeInMinutes)} onClick={() => c.nav.push('settingsSecurity')} testid="settings-security" />
        <NavRow icon="globe" label="Connections" onClick={() => c.nav.push('connections')} testid="settings-connections" />
        <NavRow icon="globe" label="Custom Networks" onClick={() => c.nav.push('customNetworks')} testid="settings-custom-networks" />
        <NavRow icon="contacts" label="Address Book" onClick={() => c.nav.push('settingsAddressBook')} testid="settings-address-book" />
        <NavRow icon="scan" label="Sync with Mobile" onClick={syncMobile} testid="settings-sync-mobile" />
        <NavRow icon="gear" label="Preferences" onClick={() => c.nav.push('settingsPrefs')} testid="settings-preferences" />
        <NavRow icon="lang" label="Language" value={localeLabel(settings.locale)} onClick={() => c.nav.push('settingsLanguage')} testid="settings-language" />
        <NavRow icon="card" label="Currency" value={settings.baseCurrency} onClick={() => c.nav.push('settingsCurrency')} testid="settings-currency" />
        <NavRow icon="theme" label="Color mode" value={COLOR_LABEL[settings.colorMode]} onClick={() => c.nav.push('settingsColorMode')} testid="settings-color-mode" />
        <NavRow icon="bell" label="Notifications" onClick={() => c.nav.push('settingsNotifications')} testid="settings-notifications" />
        <NavRow icon="faucet" label="Developer settings" onClick={() => c.nav.push('settingsDeveloper')} testid="settings-developer" />
      </Group>
      {sidePanelSupported && <Group><SwitchRow first icon="panel" label="Open in side panel" sub="The toolbar icon opens Harbour in the browser side panel instead of a popup." on={settings.preferSidePanel} onToggle={toggleSidePanel} testid="settings-side-panel" /></Group>}
      <ErrorLine msg={err} />
      <Group><NavRow first icon="support" label="Help" onClick={() => c.nav.push('help')} testid="settings-help" /></Group>
      <Btn variant="ghost" onClick={() => c.nav.lock?.()}>Lock wallet</Btn>
      <div style={{ textAlign: 'center', color: T.sub, fontSize: 12, marginTop: 16 }}>Version {manifestVersion() || '—'}</div>
    </Screen>
  );
};

// ---------- Security + Auto-lock ----------
export const SecurityScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const bio = useBiometricAvailability();
  const [pk, setPk] = useState<PasskeyStatus | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void loadPasskeyStatus(c.bg).then(setPk); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async () => {
    if (!pk || busy) return; setErr('');
    if (pk.enabled) {
      setBusy(true); const r = await c.bg({ type: 'passkeyDisable' }); setBusy(false);
      if (r?.ok) setPk({ enabled: false, credentialId: null, isPasswordGenerated: false }); else setErr(r?.error || 'Could not turn off biometrics');
      return;
    }
    // The OS biometric sheet closes a popup, so enrolment runs in a full tab (same as TW).
    if (await isPopupContext()) { await openInTab('?enroll=1'); window.close(); } else c.nav.push('settingsBiometrics');
  };
  // Like enrolment, the OS biometric sheet closes a popup, so adding the password runs in a full tab.
  const addPassword = async () => { if (await isPopupContext()) { await openInTab('?addpw=1'); window.close(); } else c.nav.push('settingsAddPassword'); };
  return (
    <Screen title="Security" onBack={c.nav.pop}>
      <Group>
        <NavRow first icon="lock" label="Auto-lock timer" value={autoLockLabel(settings.lockTimeInMinutes)} onClick={() => c.nav.push('settingsAutoLock')} testid="security-auto-lock" />
        <NavRow icon="wallet" label="Move assets between wallets" onClick={() => c.nav.push('migrationSelectSource')} testid="security-migration" />
        <NavRow icon="shield" label="Token approvals" onClick={() => c.nav.push('tokenApprovals')} testid="security-approvals" />
        {pk?.enabled && pk.isPasswordGenerated && <NavRow icon="lock" label="Add a password" value="Recommended" onClick={() => { void addPassword(); }} testid="security-add-password" />}
        {bio.available && pk && <SwitchRow icon="shield" label={`Unlock with ${bio.name}`} sub={pk.enabled ? 'On. Your password still works as a fallback.' : 'Use your device biometrics instead of typing your password.'} on={pk.enabled} onToggle={toggle} testid="security-biometrics" />}
      </Group>
      <ErrorLine msg={err} />
      <Note>{`Harbour locks itself after ${autoLockLabel(settings.lockTimeInMinutes)} without activity and asks to unlock again.`}</Note>
    </Screen>
  );
};

export const AddPasswordScreen: React.FC<Ctx> = (c) => {
  const bio = useBiometricAvailability();
  return <Screen title="Add a password" onBack={c.nav.pop}><AddPassword bg={c.bg} name={bio.name} onDone={c.nav.pop} /></Screen>;
};

export const BiometricsEnrollScreen: React.FC<Ctx> = (c) => {
  const bio = useBiometricAvailability();
  return <Screen title="Biometrics" onBack={c.nav.pop}><BiometricEnroll bg={c.bg} name={bio.name} onDone={c.nav.pop} /></Screen>;
};

export const AutoLockScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const [busy, setBusy] = useState<number | null>(null); const [err, setErr] = useState('');
  const pick = async (m: number) => {
    if (busy != null) return; setBusy(m); setErr('');
    const r = await updateSettings(c.bg, { lockTimeInMinutes: m });
    setBusy(null); if (r.ok) c.nav.pop(); else setErr(r.error);
  };
  return (
    <Screen title="Auto-lock timer" onBack={c.nav.pop}>
      {AUTO_LOCK_OPTIONS.map((m) => <SelectionRow key={m} label={autoLockLabel(m)} selected={m === settings.lockTimeInMinutes} busy={busy === m} onClick={() => pick(m)} testid={`auto-lock-${m}`} />)}
      <ErrorLine msg={err} />
    </Screen>
  );
};

// ---------- Colour mode ----------
export const ColorModeScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const [err, setErr] = useState('');
  const pick = async (m: ColorMode) => { setErr(''); const r = await updateSettings(c.bg, { colorMode: m }); if (!r.ok) setErr(r.error); };
  return (
    <Screen title="Color mode" onBack={c.nav.pop}>
      {COLOR_MODES.map((m) => <SelectionRow key={m} label={COLOR_LABEL[m]} selected={m === settings.colorMode} onClick={() => { void pick(m); }} testid={`color-mode-${m}`} />)}
      <ErrorLine msg={err} />
      <Note>System follows your browser or operating-system appearance.</Note>
    </Screen>
  );
};

// ---------- Language ----------
export const LanguageScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const labels = useMemo(() => SUPPORTED_LOCALES.map((l) => ({ l, label: localeLabel(l) })), []);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  const pick = async (l: string) => { if (busy) return; setBusy(l); setErr(''); const r = await updateSettings(c.bg, { locale: l }); setBusy(null); if (!r.ok) setErr(r.error); };
  return (
    <Screen title="Language" onBack={c.nav.pop}>
      <Note>Harbour's screens are English-only for now. The language you pick controls how numbers, currencies and dates are formatted.</Note>
      {labels.map(({ l, label }) => <SelectionRow key={l} label={label} selected={l === settings.locale} busy={busy === l} onClick={() => { void pick(l); }} testid={`language-${l}`} />)}
      <ErrorLine msg={err} />
    </Screen>
  );
};

// ---------- Currency ----------
export const CurrencyScreen: React.FC<Ctx> = (c) => {
  const { settings, rateStale } = useSettingsState() as ReturnType<typeof useSettingsState>;
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState('');
  const pick = async (code: string) => {
    if (busy) return;
    if (code === settings.baseCurrency) { c.nav.pop(); return; }
    setBusy(code); setErr('');
    const r = await updateSettings(c.bg, { baseCurrency: code });
    setBusy(null); if (r.ok) c.nav.pop(); else setErr(r.error);
  };
  const rows = (list: typeof POPULAR_CURRENCIES) => list.map((x) => <SelectionRow key={x.code} label={`${x.code} - ${x.name}`} selected={x.code === settings.baseCurrency} busy={busy === x.code} onClick={() => pick(x.code)} testid={`currency-${x.code}`} />);
  return (
    <Screen title="Currency" onBack={c.nav.pop}>
      <ErrorLine msg={err} />
      {rateStale && <Note>Showing the last saved exchange rate; Harbour couldn't refresh it just now.</Note>}
      <SectionLabel>Popular</SectionLabel>
      {rows(POPULAR_CURRENCIES)}
      <SectionLabel>Other</SectionLabel>
      {rows(OTHER_CURRENCIES)}
      <Note>Prices are fetched in US dollars and converted with public exchange rates (open.er-api.com for fiat, CoinGecko for BTC, ETH and BNB).</Note>
    </Screen>
  );
};

// ---------- Preferences (asset layout, hide small balances, hide NFTs) ----------
export const PreferencesScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const L = settings.layout;
  const [err, setErr] = useState('');
  const save = async (patch: Record<string, unknown>) => { setErr(''); const r = await updateSettings(c.bg, patch); if (!r.ok) setErr(r.error); };
  const set = (layout: Record<string, unknown>) => { void save({ layout }); };
  return (
    <Screen title="Preferences" onBack={c.nav.pop}>
      <SectionLabel>Asset layout</SectionLabel>
      <div style={{ background: T.bgAlt, borderRadius: 16, padding: '4px 14px 14px', marginBottom: 14 }}>
        <TokenCell layout={L.tokenCellLayout} d={{ name: 'Bitcoin', sym: 'BTC', evm: true, amount: '0.05', fiatUsd: 5410, price: 108200, change: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          {TOKEN_LAYOUTS.map((n: TokenLayout) => (
            <button key={n} type="button" data-testid={`layout-button-${n}`} aria-pressed={L.tokenCellLayout === n} aria-label={`Layout ${n}`} onClick={() => set({ tokenCellLayout: n })}
              style={{ width: 38, height: 38, borderRadius: 999, background: T.surface, border: `2px solid ${L.tokenCellLayout === n ? T.accent : 'transparent'}`, color: T.text, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
          ))}
        </div>
      </div>
      <Group><NavRow first icon="search" label="Manage crypto" onClick={() => c.nav.push('search')} testid="prefs-manage-crypto" /></Group>
      <Group>
        <SwitchRow first label="Hide assets worth less than $0.01" sub="Assets with an unknown value are never hidden." on={L.hideLowBalanceAssets} onToggle={() => set({ hideLowBalanceAssets: !L.hideLowBalanceAssets })} testid="prefs-hide-low-balance" />
        <SwitchRow label="Hide NFTs" sub="Removes the collectibles shortcut from Home." on={L.hideNFTs} onToggle={() => set({ hideNFTs: !L.hideNFTs })} testid="prefs-hide-nfts" />
        <SwitchRow label="Hide balances on Home" sub="Shows asterisks instead of your portfolio value." on={settings.privacy.hideBalancesOnDashboard} onToggle={() => { void save({ privacy: { hideBalancesOnDashboard: !settings.privacy.hideBalancesOnDashboard } }); }} testid="prefs-hide-balances" />
      </Group>
      <ErrorLine msg={err} />
    </Screen>
  );
};

// ---------- Address book ----------
const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
export const AddressBookScreen: React.FC<Ctx> = (c) => {
  const [items, setItems] = useState<AddressBookEntry[] | null>(null); const [err, setErr] = useState('');
  const load = () => c.bg({ type: 'addressBookList' }).then((r) => { if (r?.ok) { setItems(r.items ?? []); setErr(''); } else { setItems([]); setErr(r?.error || 'Address book unavailable'); } }).catch(() => { setItems([]); setErr('Address book unavailable'); });
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Reload when returning from the edit screen (this screen stays mounted underneath it).
  useEffect(() => { const t = setInterval(() => { void load(); }, 1500); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen title="Address Book" onBack={c.nav.pop} right={<IconBtn icon="plus" title="Add contact" onClick={() => c.nav.push('settingsAddressBookEdit')} />}>
      <ErrorLine msg={err} />
      {items === null ? <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
        : items.length === 0 ? <><Empty title="No contacts yet" sub="Save addresses you send to often and pick them in Send." icon="contacts" /><Btn variant="ghost" onClick={() => c.nav.push('settingsAddressBookEdit')}>Add contact</Btn></>
        : items.map((e) => (
          <Row key={e.id} onClick={() => c.nav.push('settingsAddressBookEdit', { entry: e })} left={<IconDot icon="contacts" />} title={e.name}
            sub={ADDRESS_BOOK_COINS.filter((k) => e.addresses[k]).map((k) => `${k === 'ethereum' ? 'EVM' : ADDRESS_BOOK_COIN_LABEL[k]} ${shortAddr(e.addresses[k]!)}`).join(' · ')} right={<Ic d={ICON.chevron} size={18} />} />
        ))}
    </Screen>
  );
};

export const AddressBookEditScreen: React.FC<Ctx> = (c) => {
  const entry: AddressBookEntry | undefined = c.params?.entry;
  const [name, setName] = useState(entry?.name ?? '');
  const [addrs, setAddrs] = useState<Record<string, string>>({ ethereum: '', bitcoin: '', solana: '', ...(entry?.addresses ?? {}) });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [confirm, setConfirm] = useState(false);
  const canSave = name.trim().length > 0 && Object.values(addrs).some((v) => v.trim()) && !busy;
  const save = async () => {
    setBusy(true); setErr('');
    const r = await c.bg({ type: 'addressBookSave', id: entry?.id, name, addresses: addrs });
    setBusy(false); if (r?.ok) c.nav.pop(); else setErr(r?.error || 'Could not save contact');
  };
  const remove = async () => {
    setBusy(true); const r = await c.bg({ type: 'addressBookRemove', id: entry!.id });
    setBusy(false); if (r?.ok) c.nav.pop(); else { setConfirm(false); setErr(r?.error || 'Could not remove contact'); }
  };
  const input = inputStyle;
  return (
    <Screen title={entry ? 'Edit contact' : 'New contact'} onBack={c.nav.pop} right={entry ? <IconBtn icon="trash" title="Delete contact" onClick={() => setConfirm(true)} /> : undefined}>
      <label style={{ fontSize: 12, color: T.sub }} htmlFor="ab-name">Name</label>
      <input id="ab-name" data-testid="ab-name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alice" style={input} />
      {ADDRESS_BOOK_COINS.map((coin: AddressBookCoin) => (
        <div key={coin} style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: T.sub }} htmlFor={`ab-${coin}`}>{ADDRESS_BOOK_COIN_LABEL[coin]} address</label>
          <input id={`ab-${coin}`} data-testid={`ab-${coin}`} value={addrs[coin] ?? ''} onChange={(e) => setAddrs({ ...addrs, [coin]: e.target.value })} placeholder="Optional" spellCheck={false} autoComplete="off" style={{ ...input, fontFamily: 'monospace' }} />
        </div>
      ))}
      <ErrorLine msg={err} />
      <div style={{ marginTop: 22 }}><Btn disabled={!canSave} onClick={save}>{busy ? 'Saving…' : 'Save'}</Btn></div>
      {confirm && <Sheet title="Delete contact?" onClose={() => setConfirm(false)}>
        <div style={{ color: T.sub, marginBottom: 14 }}>{entry?.name} will be removed from your address book. This can't be undone.</div>
        <Btn onClick={remove} disabled={busy} style={{ background: T.error }}>Delete</Btn>
        <div style={{ height: 10 }} /><Btn variant="ghost" onClick={() => setConfirm(false)}>Cancel</Btn>
      </Sheet>}
    </Screen>
  );
};

// ---------- Help & about ----------
export const AboutScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const tips: Array<[string, string]> = [
    ['Back up your secret phrase', 'Settings › Manage wallets › Back up your Secret Phrase. Anyone with the phrase controls your funds; Harbour cannot recover it for you.'],
    ['Auto-lock', `Harbour locks after ${autoLockLabel(settings.lockTimeInMinutes)} without activity. Change it in Settings › Security.`],
    ['Where data comes from', 'Prices and charts come from CoinGecko, transaction history from public block explorers, exchange rates from open.er-api.com. Harbour has no account and sends no analytics.'],
  ];
  return (
    <Screen title="Help" onBack={c.nav.pop}>
      <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <div style={{ width: 64, height: 64, margin: '0 auto', borderRadius: 18, background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})`, color: 'var(--hb-on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 30 }}>H</div>
        <h2 style={{ margin: '12px 0 2px' }}>Harbour Wallet</h2>
        <div style={{ color: T.sub }}>Version {manifestVersion() || '—'}</div>
      </div>
      {tips.map(([t, body]) => <div key={t} style={{ background: T.bgAlt, borderRadius: 14, padding: '12px 14px', marginTop: 10 }}><div style={{ fontWeight: 700, marginBottom: 4 }}>{t}</div><div style={{ color: T.sub, fontSize: 13, lineHeight: 1.5 }}>{body}</div></div>)}
    </Screen>
  );
};

export const SETTINGS_SCREENS: Record<string, React.FC<Ctx>> = {
  settings: SettingsScreen, settingsSecurity: SecurityScreen, settingsBiometrics: BiometricsEnrollScreen, settingsAddPassword: AddPasswordScreen, settingsAutoLock: AutoLockScreen, settingsColorMode: ColorModeScreen,
  settingsLanguage: LanguageScreen, settingsCurrency: CurrencyScreen, settingsPrefs: PreferencesScreen,
  settingsAddressBook: AddressBookScreen, settingsAddressBookEdit: AddressBookEditScreen, about: AboutScreen,
};
