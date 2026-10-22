// Screens for feature "settings": developer settings, faucets, notifications, wallet management, security migration.
import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import type { Ctx } from '../screens';
import { Screen, Skeleton } from '../ui';
import { Group, NavRow, SwitchRow, ErrorLine, Note, SectionLabel } from '../settingsScreens';
import { WALLET_SCREENS } from '../walletScreens';
import { useSettingsState, updateSettings, refreshSettings } from '../../settingsStore';
import { TESTNET_CHAINS } from '../../../core/chains/index';
import { DEVELOPER_FLAGS, FAUCETS, isSafeFaucetUrl, setTestnetsHidden, testnetsEnabled } from '../../../core/settingsExtra';

/** Other workers append sections here (e.g. the ramps worker's API-key fields). Rendered in order below the built-in rows. */
export interface DeveloperSection { id: string; title: string; Component: React.FC<Ctx> }
export const DEVELOPER_SECTIONS: DeveloperSection[] = [];

const TESTNET_IDS = TESTNET_CHAINS.map((c) => c.id);
const openExternal = (url: string) => { if (isSafeFaucetUrl(url)) window.open(url, '_blank', 'noopener,noreferrer'); };

export const DeveloperSettingsScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState();
  const [hidden, setHidden] = useState<string[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    void refreshSettings(c.bg);
    c.bg({ type: 'getUiPrefs' }).then((r) => { if (r?.ok) setHidden(r.hiddenAssets ?? []); else { setHidden([]); setErr(r?.error || 'Could not read preferences'); } }).catch(() => { setHidden([]); setErr('Could not read preferences'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const on = hidden != null && testnetsEnabled(hidden, TESTNET_IDS);
  const toggleTestnets = async () => {
    if (hidden == null || busy) return; setBusy(true); setErr('');
    try {
      const target = setTestnetsHidden(hidden, TESTNET_IDS, !on);
      for (const id of TESTNET_IDS) { const r = await c.bg({ type: 'setAssetHidden', assetId: id, hidden: target.includes(id) }); if (!r?.ok) throw new Error(r?.error || 'Update failed'); }
      setHidden(target); c.refresh?.();
    } catch (e: any) { setErr(e?.message || 'Update failed'); } finally { setBusy(false); }
  };
  const flag = async (key: string, value: boolean) => { setErr(''); const r = await updateSettings(c.bg, { developerSettings: { [key]: value } }); if (!r.ok) setErr(r.error); };
  return (
    <Screen title="Developer settings" onBack={c.nav.pop}>
      {hidden == null ? <div aria-busy="true" style={{ display: 'grid', gap: 10 }}><Skeleton h={56}/><Skeleton h={56}/><Skeleton h={56}/></div> : <>
        <Group>
          <SwitchRow first icon="faucet" label="Show testnets" sub={`Adds ${TESTNET_CHAINS.length} test networks (${TESTNET_CHAINS.slice(0, 3).map((t) => t.name).join(', ')} and more) to Home. Test coins have no value.`} on={on} onToggle={toggleTestnets} testid="dev-testnets"/>
          <NavRow icon="faucet" label="Testnet faucets" onClick={() => c.nav.push('settingsFaucets')} testid="dev-faucets"/>
          <NavRow icon="globe" label="Custom RPC and networks" onClick={() => c.nav.push('customNetworks')} testid="dev-custom-rpc"/>
        </Group>
        <Group>
          {DEVELOPER_FLAGS.map((f, i) => <SwitchRow key={f.key} first={i === 0} label={f.label} sub={f.sub} on={settings.developerSettings[f.key]} onToggle={() => { void flag(f.key, !settings.developerSettings[f.key]); }} testid={`dev-${f.key}`}/>)}
        </Group>
        <ErrorLine msg={err}/>
        {DEVELOPER_SECTIONS.map((s) => <div key={s.id} data-testid={`dev-section-${s.id}`}><SectionLabel>{s.title}</SectionLabel><s.Component {...c}/></div>)}
      </>}
    </Screen>
  );
};

export const FaucetsScreen: React.FC<Ctx> = (c) => (
  <Screen title="Testnet faucets" onBack={c.nav.pop}>
    <Note>Faucets hand out free test coins for development. They have no value, and each site is run by a third party.</Note>
    <Group>{FAUCETS.map((f, i) => <NavRow key={f.chainId} first={i === 0} icon="faucet" label={f.label} external onClick={() => openExternal(f.url)} testid={`faucet-${f.chainId}`}/>)}</Group>
  </Screen>
);

const NotifyStatus: React.FC<{ bg: Ctx['bg']; on: boolean }> = ({ bg, on }) => {
  const [st, setSt] = useState<{ remote: boolean; remoteConfigured: boolean } | null>(null); const [sent, setSent] = useState(false);
  useEffect(() => { bg({ type: 'notifyStatus' }).then((r: any) => { if (r?.ok) setSt(r); }).catch(() => {}); }, [bg, on]);
  return (<>
    <Note>{!on ? 'Notifications are off.' : st?.remote ? 'Push is active: Harbour\'s gateway watches your addresses and notifies incoming transfers, even while the extension is idle.' : 'Harbour checks your main accounts every 5 minutes for incoming transfers (Ethereum, Bitcoin, BNB Chain, Solana, Polygon, Arbitrum, Base, TRON) and shows a system notification.' + (st && !st.remoteConfigured ? ' Server push is not configured in this build.' : '')}</Note>
    {on && <div style={{ padding: '0 16px' }}><button type="button" data-testid="notif-test" onClick={() => { void bg({ type: 'notifyTest' }).then(() => setSent(true)); }} style={{ background: 'none', border: 'none', color: T.accent, fontWeight: 700, cursor: 'pointer', padding: '8px 0' }}>{sent ? 'Test notification sent' : 'Send a test notification'}</button></div>}
  </>);
};
export const NotificationsScreen: React.FC<Ctx> = (c) => {
  const { settings } = useSettingsState(); const p = settings.pushNotifications; const [err, setErr] = useState('');
  const save = async (patch: Record<string, unknown>) => { setErr(''); const r = await updateSettings(c.bg, { pushNotifications: patch }); if (!r.ok) setErr(r.error); };
  return (
    <Screen title="Notifications" onBack={c.nav.pop}>
      <Group>
        <SwitchRow first icon="bell" label="Push notifications" sub="Master switch for everything below." on={p.isPushEnabled} onToggle={() => { void save({ isPushEnabled: !p.isPushEnabled }); }} testid="notif-push"/>
        <SwitchRow label="Sends and receives" sub="Activity on your accounts." on={p.isPushEnabled && p.isSendAndReceiveEnabled} onToggle={() => { void save({ isPushEnabled: !(p.isPushEnabled && p.isSendAndReceiveEnabled) }); }} testid="notif-send-receive"/>
        <SwitchRow label="Product announcements" on={p.isPushEnabled && p.topics.product_announcement !== false} onToggle={() => { void save({ isPushEnabled: true, topics: { product_announcement: p.topics.product_announcement === false } }); }} testid="notif-announcements"/>
      </Group>
      <ErrorLine msg={err}/>
      <NotifyStatus bg={c.bg} on={p.isPushEnabled} />
    </Screen>
  );
};

export const SCREENS_settings: Record<string, React.FC<Ctx>> = {
  settingsDeveloper: DeveloperSettingsScreen, settingsFaucets: FaucetsScreen, settingsNotifications: NotificationsScreen,
  ...WALLET_SCREENS,
};
