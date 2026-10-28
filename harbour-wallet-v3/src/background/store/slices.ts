// The 16 Trust Wallet slice names (doc 08). State here is non-secret by construction: keys, mnemonics and passwords never enter the store.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const set = <S extends object>(name: string, initialState: S) =>
  createSlice({ name, initialState, reducers: { patch: (s: any, a: PayloadAction<Partial<S>>) => { Object.assign(s, a.payload); }, reset: () => initialState } });

export const app = set('app', { booted: false, installedAt: 0, lastActiveAt: 0, version: '' });
export const approvals = set('approvals', { pending: [] as { id: string; origin: string; kind: string; createdAt: number }[] });
export const asset = set('asset', { hidden: [] as string[], customTokens: [] as string[] });
export const blockchains = set('blockchains', { enabled: [] as string[], networkFilter: null as string | null });
export const dapps = set('dapps', { connected: {} as Record<string, string[]>, recent: [] as string[] });
export const fiat = set('fiat', { currency: 'USD', rates: {} as Record<string, number>, ratesAt: 0 });
export const migration = set('migration', { preVersion: 0, postVersion: 0 });
export const migrations = set('migrations', { history: [] as { version: number; phase: 'pre' | 'post'; at: number }[] });
export const nft = set('nft', { hidden: [] as string[], reported: [] as string[] });
export const notification = set('notification', { enabled: true, pushRegistered: false, unread: 0, topics: [] as string[] });
export const sdkFeatureSlice = set('sdkFeatureSlice', { flags: {} as Record<string, boolean>, configVersion: 0, killedProviders: [] as string[] });
export const settings = set('settings', { lockTimeInMinutes: 5, preferSidePanel: false, telemetry: false, language: 'en' });
export const staking = set('staking', { positions: {} as Record<string, unknown>, updatedAt: 0 });
export const swap = set('swap', { slippageBps: 100, lastQuote: null as unknown, history: [] as unknown[] });
export const tx = set('tx', { pending: [] as TxRecord[], recent: [] as TxRecord[] });
// Harbour backend live updates (runtime only): ticks make the popup refetch from the API.
export const live = set('live', { connected: false, balanceTick: 0, txTick: 0, lastTx: null as null | { chain: string; hash: string; status: string } });
export const wallet = set('wallet', { hasVault: false, unlocked: false, activeWalletId: null as string | null, activeAccount: 0 });

export type TxStatus = 'staged' | 'simulated' | 'signed' | 'broadcast' | 'confirmed' | 'failed';
export interface TxRecord { id: string; chainId: string; kind: string; status: TxStatus; hash?: string; error?: string; createdAt: number; meta?: Record<string, unknown> }

export const reducers = { app, approvals, asset, blockchains, dapps, fiat, live, migration, migrations, nft, notification, sdkFeatureSlice, settings, staking, swap, tx, wallet };
export const actions = Object.fromEntries(Object.entries(reducers).map(([k, v]) => [k, v.actions])) as { [K in keyof typeof reducers]: (typeof reducers)[K]['actions'] };
