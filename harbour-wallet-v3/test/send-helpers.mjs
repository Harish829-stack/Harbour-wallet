// Shared helpers for the send-engine tests: bundle the pure core once, wallet-core instance, deterministic keys, mock fetch.
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pkg from '@trustwallet/wallet-core';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function loadSend() {
  const out = await build({
    stdin: { contents: `export * from './chains/send/index'; export * from './chains/adapters/tokens'; export { aptosPayload } from './chains/send/aptos'; export { bech32Bytes } from './chains/send/util'; export { evmTransferData, validEvmAddress } from './chains/send/evm'; export { validateXrpTag } from './chains/send/ripple'; export { COSMOS_SPECS } from './chains/send/cosmos'; export { ALL_CHAINS, chainById } from './chains/index'; export { parsePaymentUri, assessRecipient, upsertSent, readSent, nameService, resolveEns, resolveSendChain, sanitizeTokenSpec, receiveNote } from './sendService';`, resolveDir: join(root, 'src/core'), sourcefile: 'entry.ts', loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', external: ['@trustwallet/wallet-core'],
  });
  const file = join(root, 'node_modules/.cache/harbour-send-test/bundle.mjs');
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href + '?t=' + Date.now());
}
export const NOW = 1_700_000_000_000;
export const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
let core;
export async function getCore() { return (core ??= await pkg.initWasm()); }
/** Key + address of the test mnemonic for a registry chain (ChainInfo.ct). */
export async function account(chain, mnemonic = MNEMONIC) {
  const c = await getCore(); const hd = c.HDWallet.createWithMnemonic(mnemonic, ''); const coin = c.CoinType[chain.ct];
  const pk = hd.getKeyForCoin(coin); const address = c.CoinTypeExt.deriveAddress(coin, pk);
  return { key: new Uint8Array(pk.data()), address };
}
/** A second, unrelated valid address on the same chain (the recipient). */
export const otherAddress = async (chain) => (await account(chain, OTHER_MNEMONIC)).address;
/** Mock fetch: handlers are [match(url, body, init) -> boolean, respond(url, body, init) -> any | {__status, body}]. Unmatched calls throw so a test never reaches a network. */
export function mockFetch(handlers, log = []) {
  const f = async (url, init = {}) => {
    const u = String(url); let body = init.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* raw text */ } }
    log.push({ url: u, method: init.method ?? 'GET', body });
    for (const [match, respond] of handlers) {
      if (!match(u, body, init)) continue;
      let r = await respond(u, body, init); let status = 200;
      if (r && typeof r === 'object' && '__status' in r) { status = r.__status; r = r.body; }
      const text = typeof r === 'string' ? r : JSON.stringify(r);
      return { ok: status >= 200 && status < 300, status, json: async () => r, text: async () => text };
    }
    throw new Error('UNMOCKED ' + (init.method ?? 'GET') + ' ' + u + (body ? ' ' + JSON.stringify(body).slice(0, 200) : ''));
  };
  f.log = log; return f;
}
export const rpcHandler = (map) => [(u, b) => b && b.jsonrpc === '2.0' && b.method in map, (u, b) => { const r = map[b.method]; const v = typeof r === 'function' ? r(b.params, u) : r; return { jsonrpc: '2.0', id: b.id, result: v }; }];
export const hexOf = (u8) => Buffer.from(u8).toString('hex');
