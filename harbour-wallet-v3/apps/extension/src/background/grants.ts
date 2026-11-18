// The persistent ERC-7715 grant store, over the extension's local storage. One instance shared by the provider (site reads) and the
// smart account service (Settings list and revoke). Public data only (see core/smartAccount/grantStore.ts).
import { local } from '../core/storage';
import { makeGrantStore } from '../core/smartAccount/grantStore';

export const grantStore = makeGrantStore({ get: <T,>(k: string) => local.get<T>(k), set: (k: string, v: unknown) => local.set(k, v) });
