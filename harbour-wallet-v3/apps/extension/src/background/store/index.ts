// Worker-side Redux store (plan A3). Hydrated from `wallet:store` state, persisted debounced, mirrored to UI ports.
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { local, KEYS } from '../../core/storage';
import { reducers, actions } from './slices';
import { readStore, type StoreTuple } from './migrations';

const rootReducer = combineReducers(Object.fromEntries(Object.entries(reducers).map(([k, v]) => [k, v.reducer])) as { [K in keyof typeof reducers]: (typeof reducers)[K]['reducer'] });
export type RootState = ReturnType<typeof rootReducer>;
const HYDRATE = 'store/hydrate';

export const store = configureStore({
  reducer: (s: RootState | undefined, a: any) => (a.type === HYDRATE ? rootReducer(a.payload, { type: '@@hydrated' }) : rootReducer(s, a)),
  middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
});
export { actions };

let hydrated = false;
/** Merges the persisted slice state over the defaults. Unknown slices are dropped; missing ones keep their defaults. */
export async function hydrateStore(): Promise<void> {
  const [, , saved] = await readStore();
  const base = store.getState() as Record<string, any>;
  const merged: Record<string, any> = {};
  for (const k of Object.keys(base)) merged[k] = { ...base[k], ...(saved.slices?.[k] ?? {}) };
  store.dispatch({ type: HYDRATE, payload: merged });
  hydrated = true;
}

/** Slices that are runtime-only and must not be persisted (re-derived on boot). */
const TRANSIENT = new Set(['wallet', 'approvals', 'app', 'live']);
let timer: ReturnType<typeof setTimeout> | undefined;
async function persist() {
  const tuple = await readStore();
  const slices: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(store.getState())) if (!TRANSIENT.has(k)) slices[k] = v;
  const next: StoreTuple = [tuple[0], tuple[1], { ...tuple[2], slices }];
  await local.set(KEYS.STORE, next);
}
store.subscribe(() => {
  if (!hydrated) return;
  clearTimeout(timer);
  timer = setTimeout(() => { void persist().catch(() => {}); }, 250);
});
