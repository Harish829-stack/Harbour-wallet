// Extension-origin IndexedDB for key material (PT-11). chrome.storage.local is readable by the extension's content scripts, which run
// inside EVERY https page's renderer process: a renderer exploit on any site could read the encrypted vault and keystores there and
// brute-force the password offline. IndexedDB belongs to the origin of the context that opens it, so only extension pages and the
// service worker (chrome-extension://<id>) can reach this database; a content script opening "harbour-secure" gets the PAGE's empty DB.
// Values are the same encrypted blobs as before (AES-GCM / wallet-core keystores); this only moves where they live.
const DB = 'harbour-secure', STORE = 'kv', VERSION = 1;
let dbp: Promise<IDBDatabase> | null = null;

export const secureStoreAvailable = (): boolean => typeof indexedDB !== 'undefined';
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; resolve(d); };
    r.onerror = () => { dbp = null; reject(r.error ?? new Error('SECURE_STORE_UNAVAILABLE')); };
  }));
}
const done = (t: IDBTransaction) => new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error ?? new Error('SECURE_STORE_ABORTED')); });
const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const secureStore = {
  async get<T = unknown>(k: string): Promise<T | undefined> { const t = (await db()).transaction(STORE, 'readonly'); return (await req(t.objectStore(STORE).get(k))) as T | undefined; },
  /** All-or-nothing: either every key is written (and every `undefined` value deleted) or none is. */
  async setMany(o: Record<string, unknown>): Promise<void> {
    const t = (await db()).transaction(STORE, 'readwrite'); const s = t.objectStore(STORE);
    for (const [k, v] of Object.entries(o)) { if (v === undefined) s.delete(k); else s.put(v, k); }
    await done(t);
  },
  async set(k: string, v: unknown): Promise<void> { await this.setMany({ [k]: v }); },
  async remove(k: string): Promise<void> { const t = (await db()).transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); await done(t); },
  async keys(): Promise<string[]> { const t = (await db()).transaction(STORE, 'readonly'); return ((await req(t.objectStore(STORE).getAllKeys())) as IDBValidKey[]).map(String); },
};
