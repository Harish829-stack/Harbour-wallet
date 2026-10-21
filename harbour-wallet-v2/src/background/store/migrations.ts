// Versioned store migrations (plan A4). `wallet:store` = [preVersion, postVersion, state]. Secrets never live here.
import { local, KEYS } from '../../core/storage';

export type Migration = (state: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>;
export type StoreTuple = [number, number, Record<string, any>];

// Pre-boot migrations run before any event is served; post-boot ones run once the core is ready.
export const PRE_MIGRATIONS: Migration[] = [
  // 0: adopt the legacy `wallet:*` keys. They stay where they are; the store only records that the import happened.
  (s) => ({ ...s, legacyImported: true }),
];
export const POST_MIGRATIONS: Migration[] = [];

export async function readStore(): Promise<StoreTuple> {
  const raw = await local.get<StoreTuple>(KEYS.STORE);
  return Array.isArray(raw) && raw.length === 3 ? raw : [0, 0, {}];
}

/** Applies the pending migrations of one phase. The version is persisted after every step, so a crash resumes mid-way. */
export async function runMigrations(phase: 'pre' | 'post', pre = PRE_MIGRATIONS, post = POST_MIGRATIONS): Promise<StoreTuple> {
  const list = phase === 'pre' ? pre : post;
  const idx = phase === 'pre' ? 0 : 1;
  let tuple = await readStore();
  for (let v = tuple[idx]; v < list.length; v++) {
    const next = await list[v](tuple[2]);
    tuple = idx === 0 ? [v + 1, tuple[1], next] : [tuple[0], v + 1, next];
    await local.set(KEYS.STORE, tuple);
  }
  return tuple;
}
