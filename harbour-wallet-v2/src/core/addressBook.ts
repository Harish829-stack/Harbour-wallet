// Address book model + validation (pure; address validity is injected so it is unit-testable and the
// wallet-core check lives in the background).
//
// Evidence (TW extension 26.41.0, App chunk `AddressBookModal`): an entry is `{ id: uuid, name, addresses: { [coinId]: address } }`;
// save is enabled only with a non-empty name and >=1 address; edit has a delete action; the Send flow reuses the
// same entries filtered to the asset's coin. [certain]
// Harbour keys addresses by wallet-core CoinType name. Only the chains Harbour can derive/show are offered.
export const ADDRESS_BOOK_COINS = ['ethereum', 'bitcoin', 'solana'] as const;
export type AddressBookCoin = (typeof ADDRESS_BOOK_COINS)[number];
export const ADDRESS_BOOK_COIN_LABEL: Record<AddressBookCoin, string> = { ethereum: 'Ethereum & EVM chains', bitcoin: 'Bitcoin', solana: 'Solana' };
export const MAX_ADDRESS_BOOK_ENTRIES = 200;
export const MAX_NAME_LENGTH = 40;

export interface AddressBookEntry { id: string; name: string; addresses: Partial<Record<AddressBookCoin, string>> }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function cleanName(raw: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type EntryResult = { ok: true; name: string; addresses: Partial<Record<AddressBookCoin, string>> } | { ok: false; error: string };
export function sanitizeEntry(input: unknown, isValid: (coin: AddressBookCoin, address: string) => boolean): EntryResult {
  if (!isObj(input)) return { ok: false, error: 'Invalid entry.' };
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: 'Enter a name.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Name is too long (max ${MAX_NAME_LENGTH}).` };
  if (!isObj(input.addresses)) return { ok: false, error: 'Add at least one address.' };
  const addresses: Partial<Record<AddressBookCoin, string>> = {};
  for (const [coin, raw] of Object.entries(input.addresses)) {
    if (!(ADDRESS_BOOK_COINS as readonly string[]).includes(coin)) return { ok: false, error: 'Unsupported network.' };
    const addr = typeof raw === 'string' ? raw.trim() : '';
    if (!addr) continue; // an emptied field simply means "no address for this network"
    if (addr.length > 128 || !isValid(coin as AddressBookCoin, addr)) return { ok: false, error: `Invalid ${ADDRESS_BOOK_COIN_LABEL[coin as AddressBookCoin]} address.` };
    addresses[coin as AddressBookCoin] = addr;
  }
  if (!Object.keys(addresses).length) return { ok: false, error: 'Add at least one address.' };
  return { ok: true, name, addresses };
}

// Insert or replace by id. `makeId` is injected (crypto.randomUUID in the background).
export function upsertEntry(list: AddressBookEntry[], entry: { id?: string; name: string; addresses: AddressBookEntry['addresses'] }, makeId: () => string): { ok: true; list: AddressBookEntry[]; entry: AddressBookEntry } | { ok: false; error: string } {
  const idx = entry.id ? list.findIndex((e) => e.id === entry.id) : -1;
  if (entry.id && idx < 0) return { ok: false, error: 'Contact not found.' };
  if (idx < 0 && list.length >= MAX_ADDRESS_BOOK_ENTRIES) return { ok: false, error: 'Address book is full.' };
  const saved: AddressBookEntry = { id: idx >= 0 ? list[idx].id : makeId(), name: entry.name, addresses: entry.addresses };
  const next = idx >= 0 ? list.map((e, i) => (i === idx ? saved : e)) : [...list, saved];
  return { ok: true, list: next, entry: saved };
}
export const removeEntry = (list: AddressBookEntry[], id: string): AddressBookEntry[] => list.filter((e) => e.id !== id);
// Entries usable for sending an asset on `coin` (TW filters the picker the same way).
export const entriesForCoin = (list: AddressBookEntry[], coin: AddressBookCoin) => list.filter((e) => !!e.addresses[coin]);
// Stored data is user-controlled via the vault; re-validate shape on read so a bad blob cannot break the UI.
export function readEntries(raw: unknown): AddressBookEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AddressBookEntry[] = [];
  for (const e of raw) {
    if (!isObj(e) || typeof e.id !== 'string' || !isObj(e.addresses)) continue;
    const addresses: AddressBookEntry['addresses'] = {};
    for (const c of ADDRESS_BOOK_COINS) if (typeof e.addresses[c] === 'string' && e.addresses[c]) addresses[c] = e.addresses[c] as string;
    const name = cleanName(e.name);
    if (name && Object.keys(addresses).length) out.push({ id: e.id, name, addresses });
  }
  return out.slice(0, MAX_ADDRESS_BOOK_ENTRIES);
}
