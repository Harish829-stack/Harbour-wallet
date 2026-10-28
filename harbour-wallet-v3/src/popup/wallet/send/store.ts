// Shared Send flow draft (survives Prepare -> Confirm -> back navigation). The nav stack passes params only by name, so the draft lives here.
import { useSyncExternalStore } from 'react';
import type { FeeTierId } from '../../../core/chains/send/types';
export interface Draft { assetId: string; to: string; resolvedName?: string; memo: string; amount: string; fiat: boolean; isMax: boolean; tier: FeeTierId }
const EMPTY: Draft = { assetId: '', to: '', memo: '', amount: '', fiat: false, isMax: false, tier: 'average' };
let draft: Draft = { ...EMPTY };
const listeners = new Set<() => void>();
export const getDraft = () => draft;
export const setDraft = (patch: Partial<Draft>) => { draft = { ...draft, ...patch }; listeners.forEach((l) => l()); };
export const resetDraft = (assetId = '') => { draft = { ...EMPTY, assetId }; listeners.forEach((l) => l()); };
export const useDraft = (): Draft => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, getDraft, getDraft);
