// chainData* background handlers (read-only multi-chain data + non-EVM custom assets) with a fake vault and a mocked global fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/', import.meta.url));
const out = await build({ stdin: { contents: `export { handlers, readChainTokens } from './background/handlers/chainData';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', SOL = 'So11111111111111111111111111111111111111112';
const mkCtx = () => { const st = { wallets: { w1: { activeAccount: 0, accounts: [{ derivationIndex: 0, name: 'Account 1', addresses: { solana: SOL, ethereum: '0xabc' } }] } }, active: 'w1' }; let persisted = 0;
  return { st, persisted: () => persisted, ctx: { vault: { getState: async () => st, persist: async () => { persisted++; } } } }; };
const realFetch = globalThis.fetch;
const routeFetch = () => { globalThis.fetch = async (url, init = {}) => { const b = init.body ? JSON.parse(init.body) : null; const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (b?.method === 'getAccountInfo') return j({ jsonrpc: '2.0', id: 1, result: { value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', data: { parsed: { type: 'mint', info: { decimals: 6 } } } } } });
  if (b?.method === 'getTokenAccountsByOwner') return j({ jsonrpc: '2.0', id: 1, result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { amount: '2500000', decimals: 6 } } } } } }] } });
  if (String(url).includes('jup.ag')) return j([{ id: MINT, name: 'USD Coin', symbol: 'USDC', decimals: 6 }]);
  return j({}, 404); }; };
test('chainDataCapabilities reports honest per-chain support', () => {
  const r = M.handlers.chainDataCapabilities({}, {});
  // Harbour v3 offers the backend-served networks: the indexed ones (history, tokens) and the RPC-only ones.
  const ids = Object.keys(r.chains);
  assert.equal(r.ok, true); assert.ok(ids.length >= 50 && ids.includes('ethereum') && ids.includes('classic') && ids.includes('sepolia'), ids.length);
  for (const id of ['ethereum', 'polygon', 'sepolia', 'base-sepolia']) assert.deepEqual([r.chains[id].balance, r.chains[id].history, r.chains[id].tokens, r.chains[id].gas], [true, true, true, true], id);
  assert.equal(r.chains.classic.balance, true); assert.equal(r.chains.classic.gas, true);
});
test('non-EVM custom token: probe -> add (chain-verified decimals, name from index) -> balances -> remove', async () => {
  routeFetch(); try {
    const { ctx, st, persisted } = mkCtx();
    // entry shape comes from walletState.activeEntry; make the fake state satisfy it
    const probe = await M.handlers.chainDataTokenProbe({ chain: 'solana', address: MINT }, ctx);
    assert.deepEqual([probe.ok, probe.token.symbol, probe.token.decimals], [true, 'USDC', 6]);
    assert.equal((await M.handlers.chainDataTokenProbe({ chain: 'bitcoin', address: MINT }, ctx)).code, 'UNSUPPORTED_NETWORK');
    const bad = await M.handlers.chainDataTokenAdd({ chain: 'solana', address: 'nope' }, ctx); assert.equal(bad.ok, false);
    const add = await M.handlers.chainDataTokenAdd({ chain: 'solana', address: MINT, name: 'Hostile', symbol: 'EVIL', decimals: 18 }, ctx);
    assert.equal(add.ok, true, add.error); assert.deepEqual([add.token.name, add.token.symbol, add.token.decimals, add.token.standard, add.token.id], ['USD Coin', 'USDC', 6, 'SPL', `solana_t${MINT}`]);
    assert.equal(persisted(), 1);
    const again = await M.handlers.chainDataTokenAdd({ chain: 'solana', address: MINT }, ctx); assert.equal(again.existed, true);
    const b = await M.handlers.chainDataTokenBalances({}, ctx); assert.deepEqual([b.ok, b.items.length, b.items[0].ok, b.items[0].formatted], [true, 1, true, '2.5']);
    const rm = await M.handlers.chainDataTokenRemove({ id: `solana_t${MINT}` }, ctx); assert.equal(rm.ok, true);
    assert.equal((await M.handlers.chainDataTokenBalances({}, ctx)).items.length, 0);
    assert.equal(M.readChainTokens([{ id: 'x', chain: 'bitcoin', address: 'a', decimals: 1 }, null, 5]).length, 0);
  } finally { globalThis.fetch = realFetch; }
});
test('chainDataHistory / chainDataBalance validate input and use the active account address', async () => {
  const { ctx } = mkCtx();
  assert.equal((await M.handlers.chainDataHistory({ chainId: 'mars' }, ctx)).ok, false);
  assert.equal((await M.handlers.chainDataBalance({ chainId: 'tron' }, ctx)).error, 'No address for this network');
  globalThis.fetch = async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: 1500000000 } }), { status: 200 });
  try { const b = await M.handlers.chainDataBalance({ chainId: 'solana' }, ctx); assert.deepEqual([b.ok, b.formatted, b.symbol], [true, '1.5', 'SOL']); } finally { globalThis.fetch = realFetch; }
  assert.equal((await M.handlers.chainDataGas({ chainId: 'bitcoin' }, ctx)).ok, false);
});
