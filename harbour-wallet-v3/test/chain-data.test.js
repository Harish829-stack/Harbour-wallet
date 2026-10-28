// Multi-chain data adapters (evidences/re-evidence/32-chain-data): balances, tokens, history, gas — all against a mocked fetch.
// Request shapes follow each API's public docs; nothing here proves the live endpoints answer that way (see evidences/re-evidence/32-chain-data/STATUS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `
    export * from './chains/index';
    export { fetchNativeBalance, BALANCE_ADAPTERS } from './chains/adapters/index';
    export * as codec from './chains/adapters/codec';
    export * as sub from './chains/adapters/substrate';
    export * as tok from './chains/adapters/tokens';
    export * as H from './chains/adapters/history';
    export * as TH from './txHistory';
    export * as gas from './gasFees';
    export { COSMOS_DENOM } from './chains/adapters/cosmos';
  `, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const { codec } = M;

// ---------- mock fetch ----------
const mock = (...routes) => {
  const calls = [];
  const f = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), method: init.method ?? 'GET', body });
    for (const r of routes) {
      if (r.url && !String(url).includes(r.url)) continue;
      if (r.rpc && body?.method !== r.rpc) continue;
      if (r.when && !r.when(String(url), body)) continue;
      if (r.throws) throw new Error('network down');
      return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? null), { status: r.status ?? 200 });
    }
    return new Response('{}', { status: 404 });
  };
  f.calls = calls; return f;
};
const bal = (id, address, f) => M.fetchNativeBalance(M.chainById(id), address, f);
const b32chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Encode(hrp, bytes) { // test-only encoder
  const words = []; let acc = 0, bits = 0;
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; words.push((acc >> bits) & 31); } }
  if (bits) words.push((acc << (5 - bits)) & 31);
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const poly = (v) => { let c = 1; for (const x of v) { const t = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((t >>> i) & 1) c ^= G[i]; } return c >>> 0; };
  const exp = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
  const mod = poly([...exp, ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const chk = [0, 1, 2, 3, 4, 5].map((i) => (mod >>> (5 * (5 - i))) & 31);
  return hrp + '1' + [...words, ...chk].map((x) => b32chars[x]).join('');
}
const bytes20 = Uint8Array.from({ length: 20 }, (_, i) => i + 1);
const hex20 = '0102030405060708090a0b0c0d0e0f1011121314';
const tronAddr = (n = 1) => M.codec.base58CheckEncode(Uint8Array.from([0x41, ...Array.from({ length: 20 }, (_, i) => i + n)]));
const ME_TRON = tronAddr(1);

// ---------- codecs ----------
test('codecs: base58 / base58check / bech32 / decimals', () => {
  const b = Uint8Array.from([0, 0, 1, 2, 255]);
  assert.deepEqual([...codec.base58Decode(codec.base58Encode(b))], [...b]);
  assert.deepEqual([...codec.base58CheckDecode(ME_TRON)].slice(0, 2), [0x41, 1]);
  assert.throws(() => codec.base58CheckDecode(ME_TRON.slice(0, -1) + (ME_TRON.endsWith('A') ? 'B' : 'A')));
  const z = bech32Encode('zil', bytes20); assert.equal(codec.bech32ToHex20(z, 'zil'), hex20);
  assert.throws(() => codec.bech32ToHex20(z, 'one'), /bad address/);
  assert.throws(() => codec.bech32ToHex20(z.slice(0, -1) + (z.endsWith('q') ? 'p' : 'q'), 'zil'));
  assert.equal(codec.bech32ToHex20('0x' + hex20.toUpperCase(), 'zil'), hex20);
  assert.equal(codec.parseDecimal('12.3456789', 7), 123456789n); assert.equal(codec.parseDecimal('1', 6), 1000000n);
  assert.throws(() => codec.parseDecimal('-1', 6));
  assert.equal(codec.intField('{"amount":12345678901234567,"x":1}', 'amount'), 12345678901234567n);
  assert.equal(codec.toBig('0x10'), 16n); assert.throws(() => codec.toBig(1.5)); assert.throws(() => codec.toBig('abc'));
});

// ---------- coverage ----------
test('every registry family has a balance adapter; Nimiq/Aion are explicit "unsupported", never a fake zero', async () => {
  for (const c of M.ALL_CHAINS) assert.ok(M.BALANCE_ADAPTERS[c.kind], `adapter for ${c.id} (${c.kind})`);
  for (const id of ['nimiq', 'aion']) { const r = await bal(id, 'x'.repeat(30), mock()); assert.equal(r.ok, false); assert.match(r.error, /^unsupported/); }
});
test('adapters never throw and report failure on network errors / garbage', async () => {
  const dead = mock({ throws: true }); const junk = mock({ body: '<html>', status: 200 });
  for (const c of M.ALL_CHAINS.filter((x) => x.kind !== 'evm')) {
    const addr = c.kind === 'zilliqa' ? bech32Encode('zil', bytes20) : c.kind === 'harmony' ? bech32Encode('one', bytes20) : c.kind === 'iotex' ? bech32Encode('io', bytes20) : c.kind === 'tron' ? ME_TRON : 'Abcdefghijklmnopqrstuvwxyz123456';
    for (const f of [dead, junk]) { const r = await bal(c.id, addr, f); assert.equal(r.ok, false, `${c.id} must fail, not fake a balance`); assert.equal(r.raw, '0'); assert.ok(r.error); }
  }
});

// ---------- UTXO ----------
test('bitcoin: Esplora address stats, mempool included, falls through to the second endpoint', async () => {
  const f = mock({ url: 'mempool.space', status: 500, body: {} }, { url: 'blockstream.info/api/address/bc1qme', body: { chain_stats: { funded_txo_sum: 150000, spent_txo_sum: 50000 }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 10000 } } });
  const r = await bal('bitcoin', 'bc1qme', f);
  assert.deepEqual([r.ok, r.raw, r.formatted], [true, '90000', '0.0009']);
  assert.equal(f.calls[0].url, 'https://mempool.space/api/address/bc1qme');
  assert.equal((await bal('bitcoin', 'bc1qme', mock({ status: 400, body: 'Invalid Bitcoin address' }))).ok, false);
  assert.equal((await bal('bitcoin', 'bc1qme', mock({ body: { nope: 1 } }))).ok, false);
});

// ---------- Cosmos ----------
test('cosmos family: LCD bank balances with the right native denom per chain', async () => {
  const cases = [['cosmos', 'uatom', '1500000', '1.5'], ['terra', 'uluna', '2000000', '2'], ['kava', 'ukava', '3', '0.000003'], ['agoric', 'ubld', '1000000', '1'], ['thorchain', 'rune', '150000000', '1.5'],
    ['nativeinjective', 'inj', '1000000000000000000', '1'], ['osmosis', 'uosmo', '5000000', '5'], ['zetachain', 'azeta', '2500000000000000000', '2.5'], ['akash', 'uakt', '1000000', '1'],
    ['sei', 'usei', '1000000', '1'], ['juno', 'ujuno', '1000000', '1'], ['stride', 'ustrd', '1000000', '1'], ['axelar', 'uaxl', '1000000', '1'], ['neutron', 'untrn', '1000000', '1']];
  for (const [id, denom, raw, formatted] of cases) {
    const f = mock({ url: '/cosmos/bank/v1beta1/balances/addr1', body: { balances: [{ denom: 'ibc/ABC', amount: '99' }, { denom, amount: raw }], pagination: { next_key: null } } });
    const r = await bal(id, 'addr1', f);
    assert.deepEqual([id, r.ok, r.raw, r.formatted], [id, true, raw, formatted]);
    assert.ok(f.calls[0].url.endsWith('/cosmos/bank/v1beta1/balances/addr1'));
  }
  assert.equal(Object.keys(M.COSMOS_DENOM).length, M.ALL_CHAINS.filter((c) => c.kind === 'cosmos').length, 'denom for every cosmos chain');
  const none = await bal('cosmos', 'addr1', mock({ body: { balances: [], pagination: { next_key: null, total: '0' } } }));
  assert.deepEqual([none.ok, none.raw], [true, '0']);
  const paged = mock({ url: 'by_denom?denom=uatom', body: { balance: { denom: 'uatom', amount: '77' } } }, { url: '/balances/addr1', body: { balances: [{ denom: 'x', amount: '1' }], pagination: { next_key: 'abc' } } });
  assert.equal((await bal('cosmos', 'addr1', paged)).raw, '77');
  assert.equal((await bal('cosmos', 'addr1', mock({ status: 500, body: {} }))).ok, false);
});

// ---------- Tron ----------
test('tron: getaccount (visible) -> SUN; empty object means never activated => 0', async () => {
  const f = mock({ url: '/wallet/getaccount', body: { address: ME_TRON, balance: 1234567 } });
  const r = await bal('tron', ME_TRON, f);
  assert.deepEqual([r.ok, r.raw, r.formatted], [true, '1234567', '1.234567']);
  assert.deepEqual(f.calls[0].body, { address: ME_TRON, visible: true });
  assert.deepEqual((({ ok, raw }) => ({ ok, raw }))(await bal('tron', ME_TRON, mock({ url: '/wallet/getaccount', body: {} }))), { ok: true, raw: '0' });
  assert.equal((await bal('tron', ME_TRON, mock({ status: 503, body: {} }))).ok, false);
});

// ---------- others ----------
const ok = (r, raw, formatted) => { assert.equal(r.ok, true, r.error); assert.equal(r.raw, raw); if (formatted) assert.equal(r.formatted, formatted); };
test('ton: toncenter getAddressBalance', async () => {
  const f = mock({ url: '/getAddressBalance?address=EQabc', body: { ok: true, result: '5000000000' } });
  ok(await bal('ton', 'EQabc', f), '5000000000', '5'); assert.equal(f.calls[0].method, 'GET');
  ok(await bal('ton', 'EQabc', mock({ body: { ok: true, result: '0' } })), '0');
  assert.equal((await bal('ton', 'EQabc', mock({ body: { ok: false, error: 'bad address' } }))).ok, false);
});
test('aptos: coin::balance view; account_not_found => 0; other errors fail', async () => {
  const f = mock({ url: '/view', body: ['123456789'] });
  ok(await bal('aptos', '0xabc', f), '123456789', '1.23456789');
  assert.deepEqual(f.calls[0].body, { function: '0x1::coin::balance', type_arguments: ['0x1::aptos_coin::AptosCoin'], arguments: ['0xabc'] });
  ok(await bal('aptos', '0xabc', mock({ status: 404, body: { error_code: 'account_not_found' } })), '0');
  assert.equal((await bal('aptos', '0xabc', mock({ status: 500, body: { message: 'boom' } }))).ok, false);
});
test('sui: suix_getBalance for 0x2::sui::SUI', async () => {
  const f = mock({ rpc: 'suix_getBalance', body: { jsonrpc: '2.0', id: 1, result: { coinType: '0x2::sui::SUI', totalBalance: '2500000000' } } });
  ok(await bal('sui', '0xme', f), '2500000000', '2.5'); assert.deepEqual(f.calls[0].body.params, ['0xme', '0x2::sui::SUI']);
  assert.equal((await bal('sui', '0xme', mock({ rpc: 'suix_getBalance', body: { jsonrpc: '2.0', id: 1, error: { message: 'Invalid params' } } }))).ok, false);
});
test('near: view_account amount; UNKNOWN_ACCOUNT => 0', async () => {
  const f = mock({ rpc: 'query', body: { jsonrpc: '2.0', id: 1, result: { amount: '1000000000000000000000000', locked: '0' } } });
  ok(await bal('near', 'me.near', f), '1000000000000000000000000', '1'); assert.deepEqual(f.calls[0].body.params, { request_type: 'view_account', finality: 'final', account_id: 'me.near' });
  ok(await bal('near', 'me.near', mock({ rpc: 'query', body: { jsonrpc: '2.0', id: 1, error: { name: 'HANDLER_ERROR', cause: { name: 'UNKNOWN_ACCOUNT' } } } })), '0');
  assert.equal((await bal('near', 'me.near', mock({ rpc: 'query', body: { jsonrpc: '2.0', id: 1, error: { message: 'Server error' } } }))).ok, false);
});
test('algorand: /v2/accounts amount keeps full integer precision', async () => {
  const f = mock({ url: '/v2/accounts/ADDR?exclude=all', body: '{"address":"ADDR","amount":12345678901234567,"amount-without-pending-rewards":1}' });
  ok(await bal('algorand', 'ADDR', f), '12345678901234567'); ok(await bal('algorand', 'ADDR', mock({ status: 404, body: { message: 'no accounts found' } })), '0');
  assert.equal((await bal('algorand', 'ADDR', mock({ status: 500, body: {} }))).ok, false);
});
test('ripple: account_info Balance in drops; actNotFound => 0', async () => {
  const f = mock({ rpc: 'account_info', body: { result: { status: 'success', account_data: { Balance: '25000000' } } } });
  ok(await bal('ripple', 'rMe', f), '25000000', '25'); assert.deepEqual(f.calls[0].body.params, [{ account: 'rMe', ledger_index: 'validated' }]);
  ok(await bal('ripple', 'rMe', mock({ rpc: 'account_info', body: { result: { status: 'error', error: 'actNotFound' } } })), '0');
  assert.equal((await bal('ripple', 'rMe', mock({ rpc: 'account_info', body: { result: { status: 'error', error: 'invalidParams' } } }))).ok, false);
});
test('stellar: Horizon native balance parsed exactly; 404 => 0', async () => {
  const f = mock({ url: '/accounts/GME', body: { balances: [{ asset_type: 'credit_alphanum4', balance: '9.0000000' }, { asset_type: 'native', balance: '12.3456789' }] } });
  ok(await bal('stellar', 'GME', f), '123456789', '12.3456789');
  ok(await bal('stellar', 'GME', mock({ status: 404, body: { status: 404 } })), '0');
});
test('tezos: contract balance (JSON string); 404 => 0', async () => {
  const f = mock({ url: '/chains/main/blocks/head/context/contracts/tz1me/balance', body: '"1500000"' });
  ok(await bal('tezos', 'tz1me', f), '1500000', '1.5'); ok(await bal('tezos', 'tz1me', mock({ status: 404, body: 'Contract not found' })), '0');
});
test('filecoin: StateGetActor Balance; actor not found => 0', async () => {
  const f = mock({ rpc: 'Filecoin.StateGetActor', body: { jsonrpc: '2.0', id: 1, result: { Balance: '2000000000000000000', Nonce: 1 } } });
  ok(await bal('filecoin', 'f1me', f), '2000000000000000000', '2'); assert.deepEqual(f.calls[0].body.params, ['f1me', null]);
  ok(await bal('filecoin', 'f1me', mock({ rpc: 'Filecoin.StateGetActor', body: { jsonrpc: '2.0', id: 1, error: { code: 1, message: 'resolution lookup failed (f1me): resolve address f1me: actor not found' } } })), '0');
});
test('waves / vechain / multiversx / icon / theta / ontology / fio / icp', async () => {
  ok(await bal('waves', '3Pme', mock({ url: '/addresses/balance/3Pme', body: { address: '3Pme', confirmations: 0, balance: 150000000 } })), '150000000', '1.5');
  ok(await bal('vechain', '0xme', mock({ url: '/accounts/0xme', body: { balance: '0xde0b6b3a7640000', energy: '0x0', hasCode: false } })), '1000000000000000000', '1');
  ok(await bal('elrond', 'erd1me', mock({ url: '/address/erd1me/balance', body: { data: { balance: '1000000000000000000' }, error: '', code: 'successful' } })), '1000000000000000000', '1');
  const ic = mock({ body: { jsonrpc: '2.0', id: 1234, result: '0xde0b6b3a7640000' } });
  ok(await bal('icon', 'hxme', ic), '1000000000000000000', '1'); assert.deepEqual(ic.calls[0].body, { jsonrpc: '2.0', id: 1234, method: 'icx_getBalance', params: { address: 'hxme' } });
  const th = mock({ rpc: 'theta.GetAccount', body: { jsonrpc: '2.0', id: 1, result: { coins: { thetawei: '3000000000000000000', tfuelwei: '5' } } } });
  ok(await bal('theta', '0xme', th), '3000000000000000000', '3'); assert.deepEqual(th.calls[0].body.params, [{ address: '0xme', preview: true }]);
  ok(await bal('ontology', 'Ame', mock({ rpc: 'getbalance', body: { jsonrpc: '2.0', id: 1, result: { ont: '7', ong: '100' } } })), '7', '7');
  const fio = mock({ url: '/v1/chain/get_fio_balance', body: '{"balance":5000000000,"available":4000000000,"staked":0}' });
  ok(await bal('fio', 'FIOme', fio), '4000000000', '4'); assert.deepEqual(fio.calls[0].body, { fio_public_key: 'FIOme' }); ok(await bal('fio', 'FIOme', mock({ status: 404, body: { message: 'Public key not found' } })), '0');
  const icp = mock({ url: '/account/balance', body: { balances: [{ value: '250000000', currency: { symbol: 'ICP', decimals: 8 } }] } });
  ok(await bal('internet_computer', 'a'.repeat(64), icp), '250000000', '2.5');
  assert.equal(icp.calls[0].url, 'https://rosetta-api.internetcomputer.org/account/balance'); assert.equal(icp.calls[0].body.account_identifier.address, 'a'.repeat(64));
});
test('bech32 chains: zilliqa GetBalance (hex), harmony / iotex eth_getBalance (hex)', async () => {
  const z = mock({ rpc: 'GetBalance', body: { jsonrpc: '2.0', id: 1, result: { balance: '1000000000000', nonce: 3 } } });
  ok(await bal('zilliqa', bech32Encode('zil', bytes20), z), '1000000000000', '1'); assert.deepEqual(z.calls[0].body.params, [hex20]);
  ok(await bal('zilliqa', bech32Encode('zil', bytes20), mock({ rpc: 'GetBalance', body: { jsonrpc: '2.0', id: 1, error: { code: -5, message: 'Account is not created' } } })), '0');
  assert.equal((await bal('zilliqa', 'zil1notvalid', mock({ rpc: 'GetBalance', body: { result: { balance: '1' } } }))).ok, false);
  const h = mock({ rpc: 'eth_getBalance', body: { jsonrpc: '2.0', id: 1, result: '0xde0b6b3a7640000' } });
  ok(await bal('harmony', bech32Encode('one', bytes20), h), '1000000000000000000', '1'); assert.deepEqual(h.calls[0].body.params, ['0x' + hex20, 'latest']); assert.match(h.calls[0].url, /api\.harmony\.one/);
  const i = mock({ rpc: 'eth_getBalance', body: { jsonrpc: '2.0', id: 1, result: '0x0' } });
  ok(await bal('iotex', bech32Encode('io', bytes20), i), '0'); assert.match(i.calls[0].url, /babel-api\.mainnet\.iotex\.io/);
});

// ---------- substrate ----------
test('substrate: SS58 -> System.Account storage key -> free balance from SCALE AccountInfo (Asset Hub)', async () => {
  const alice = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  assert.equal(codec.bytesToHex(M.sub.ss58Decode(alice)), 'd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d');
  assert.throws(() => M.sub.ss58Decode(alice.slice(0, -1) + (alice.endsWith('Y') ? 'Z' : 'Y')));
  const key = M.sub.systemAccountKey(alice);
  assert.ok(key.startsWith('0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9') && key.endsWith('d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d') && key.length === 2 + 64 + 32 + 64);
  const le = (n) => { const b = new Uint8Array(16); let v = BigInt(n); for (let i = 0; i < 16; i++) { b[i] = Number(v & 255n); v >>= 8n; } return codec.bytesToHex(b); };
  const info = '0x' + '01000000' + '00000000' + '01000000' + '00000000' + le(25_000_000_000n) + le(5) + le(0) + le(0);
  const f = mock({ rpc: 'state_getStorage', body: { jsonrpc: '2.0', id: 1, result: info } });
  for (const id of ['polkadot', 'kusama']) { const r = await bal(id, alice, f); assert.equal(r.ok, true, r.error); assert.equal(r.raw, '25000000000'); }
  assert.equal(f.calls[0].body.params[0], key); assert.match(f.calls[0].url, /polkadot-asset-hub-rpc\.polkadot\.io/); assert.match(f.calls[1].url, /kusama-asset-hub/);
  assert.ok(!f.calls.some((c) => /publicnode|kusama-rpc\.polkadot\.io/.test(c.url)), 'relay chain must not be queried (stale zero)');
  ok(await bal('polkadot', alice, mock({ rpc: 'state_getStorage', body: { jsonrpc: '2.0', id: 1, result: null } })), '0');
  assert.equal((await bal('polkadot', 'not-an-address', mock({ body: {} }))).ok, false);
});

// ---------- tokens ----------
const SOL_ME = 'So11111111111111111111111111111111111111112', MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
test('SPL: balance sums token accounts; probe reads decimals on-chain, name/symbol from the index only when id+decimals match', async () => {
  const sol = M.chainById('solana');
  const f = mock({ rpc: 'getTokenAccountsByOwner', body: { jsonrpc: '2.0', id: 1, result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { amount: '1500000', decimals: 6 } } } } } }, { account: { data: { parsed: { info: { tokenAmount: { amount: '500000', decimals: 6 } } } } } }] } } });
  const b = await M.tok.splBalance(sol, SOL_ME, MINT, 6, f);
  assert.deepEqual(b, { ok: true, raw: '2000000', formatted: '2' }); assert.deepEqual(f.calls[0].body.params.slice(0, 2), [SOL_ME, { mint: MINT }]);
  assert.equal((await M.tok.splBalance(sol, SOL_ME, MINT, 6, mock({ throws: true }))).ok, false);
  const mintInfo = { jsonrpc: '2.0', id: 1, result: { value: { owner: M.tok.TOKEN_PROGRAMS[0], data: { parsed: { type: 'mint', info: { decimals: 6 } } } } } };
  const p = await M.tok.probeSpl(sol, MINT, mock({ rpc: 'getAccountInfo', body: mintInfo }, { url: 'jup.ag/tokens/v2/search', body: [{ id: MINT, name: 'USD Coin', symbol: 'USDC', decimals: 6 }] }));
  assert.deepEqual(p, { ok: true, token: { address: MINT, name: 'USD Coin', symbol: 'USDC', decimals: 6, standard: 'SPL' }, needsManual: false });
  const spoof = await M.tok.probeSpl(sol, MINT, mock({ rpc: 'getAccountInfo', body: mintInfo }, { url: 'jup.ag', body: [{ id: MINT, name: 'Evil', symbol: 'EVIL', decimals: 9 }] }));
  assert.equal(spoof.ok, true); assert.equal(spoof.needsManual, true); assert.equal(spoof.token.name, '');
  const nonMint = await M.tok.probeSpl(sol, MINT, mock({ rpc: 'getAccountInfo', body: { jsonrpc: '2.0', id: 1, result: { value: { owner: '11111111111111111111111111111111', data: { parsed: { type: 'account' } } } } } }));
  assert.equal(nonMint.code, 'NOT_A_TOKEN');
  assert.equal((await M.tok.probeSpl(sol, MINT, mock({ rpc: 'getAccountInfo', body: { jsonrpc: '2.0', id: 1, result: { value: null } } }))).code, 'NOT_A_CONTRACT');
  assert.equal((await M.tok.probeSpl(sol, 'nope', mock())).code, 'INVALID_ADDRESS'); assert.equal((await M.tok.probeSpl(sol, MINT, mock({ throws: true }))).code, 'NETWORK_ERROR');
});
const word = (n) => BigInt(n).toString(16).padStart(64, '0'); const strWord = (s) => { const h = Buffer.from(s).toString('hex'); return word(32) + word(s.length) + h.padEnd(64, '0'); };
test('TRC-20: balanceOf / name / symbol / decimals via triggerconstantcontract', async () => {
  const tron = M.chainById('tron'); const CONTRACT = tronAddr(90);
  assert.equal(M.tok.decodeAbiString(strWord('Tether USD')), 'Tether USD'); assert.equal(M.tok.decodeAbiString(Buffer.from('MKR').toString('hex').padEnd(64, '0')), 'MKR');
  const f = mock({ url: '/wallet/triggerconstantcontract', body: { result: { result: true }, constant_result: [word(2500000)] } });
  assert.deepEqual(await M.tok.trc20Balance(tron, ME_TRON, CONTRACT, 6, f), { ok: true, raw: '2500000', formatted: '2.5' });
  const sent = f.calls[0].body;
  assert.deepEqual([sent.owner_address, sent.contract_address, sent.function_selector, sent.visible], [ME_TRON, CONTRACT, 'balanceOf(address)', true]);
  assert.equal(sent.parameter.length, 64); assert.equal(sent.parameter.slice(24), codec.bytesToHex(codec.base58CheckDecode(ME_TRON).slice(1)));
  const probe = mock({ when: (u, b) => b?.function_selector === 'name()', body: { result: { result: true }, constant_result: [strWord('Tether USD')] } }, { when: (u, b) => b?.function_selector === 'symbol()', body: { result: { result: true }, constant_result: [strWord('USDT')] } }, { when: (u, b) => b?.function_selector === 'decimals()', body: { result: { result: true }, constant_result: [word(6)] } });
  assert.deepEqual(await M.tok.probeTrc20(tron, CONTRACT, probe), { ok: true, token: { address: CONTRACT, name: 'Tether USD', symbol: 'USDT', decimals: 6, standard: 'TRC20' } });
  assert.equal((await M.tok.probeTrc20(tron, CONTRACT, mock({ body: { result: { result: false, message: '4e6f74' } } }))).code, 'NOT_A_TOKEN');
  assert.equal((await M.tok.probeTrc20(tron, CONTRACT, mock({ throws: true }))).code, 'NETWORK_ERROR'); assert.equal((await M.tok.probeTrc20(tron, 'Tbad', mock())).code, 'INVALID_ADDRESS');
  assert.equal(M.tok.validTokenAddress('tron', ME_TRON), true); assert.equal(M.tok.validTokenAddress('solana', MINT), true); assert.equal(M.tok.validTokenAddress('solana', ME_TRON), false);
});

// ---------- history mappers ----------
const H = M.H; const C = (id) => M.chainById(id);
test('history: solana parsed transaction -> direction, amount, counterparty, SPL token legs', () => {
  const me = SOL_ME, other = 'Other1111111111111111111111111111111111111';
  const tx = { meta: { err: null, fee: 5000, preBalances: [3_000_000_000, 1_000_000_000], postBalances: [1_999_995_000, 2_000_000_000], preTokenBalances: [], postTokenBalances: [] }, transaction: { message: { accountKeys: [{ pubkey: me }, { pubkey: other }] } } };
  const [a] = H.mapSolanaTx(C('solana'), { signature: 'sig1', blockTime: 1700000000 }, tx, me);
  assert.deepEqual([a.kind, a.amount, a.symbol, a.counterparty, a.status, a.timestamp, a.id], ['send', '1', 'SOL', other, 'confirmed', 1700000000000, 'sig1']);
  const tk = { meta: { err: null, fee: 5000, preBalances: [5_000_000, 5_000_000], postBalances: [5_000_000, 5_000_000], preTokenBalances: [{ owner: me, mint: MINT, uiTokenAmount: { amount: '1000000', decimals: 6 } }], postTokenBalances: [{ owner: me, mint: MINT, uiTokenAmount: { amount: '3500000', decimals: 6 } }] }, transaction: { message: { accountKeys: [other, me] } } };
  const items = H.mapSolanaTx(C('solana'), { signature: 'sig2', blockTime: 1 }, tk, me);
  assert.equal(items.length, 1); assert.deepEqual([items[0].kind, items[0].amount, items[0].symbol, items[0].token.address], ['receive', '2.5', 'USDC', MINT]);
  const failed = H.mapSolanaTx(C('solana'), { signature: 'sig3', err: { x: 1 } }, null, me); assert.deepEqual([failed[0].status, failed[0].kind], ['failed', 'contract']);
});
test('history: tron native + TRC-20', () => {
  const to = tronAddr(50); const hex = (a) => codec.bytesToHex(codec.base58CheckDecode(a));
  const n = H.mapTronTxs(C('tron'), { data: [{ txID: 't1', block_timestamp: 1700000000000, ret: [{ contractRet: 'SUCCESS' }], raw_data: { contract: [{ type: 'TransferContract', parameter: { value: { owner_address: hex(ME_TRON), to_address: hex(to), amount: 2500000 } } }] } },
    { txID: 't2', block_timestamp: 5, ret: [{ contractRet: 'REVERT' }], raw_data: { contract: [{ type: 'TriggerSmartContract', parameter: { value: {} } }] } }] }, ME_TRON);
  assert.deepEqual([n[0].kind, n[0].amount, n[0].counterparty, n[0].status], ['send', '2.5', to, 'confirmed']); assert.deepEqual([n[1].kind, n[1].status, n[1].method], ['contract', 'failed', 'Contract call']);
  const t = H.mapTrc20(C('tron'), { data: [{ transaction_id: 't3', block_timestamp: 9, from: to, to: ME_TRON, value: '1500000', token_info: { symbol: 'USDT', address: 'TXYZ', decimals: 6 } }] }, ME_TRON);
  assert.deepEqual([t[0].kind, t[0].amount, t[0].symbol, t[0].counterparty, t[0].token.address], ['receive', '1.5', 'USDT', to, 'TXYZ']);
});
test('history: cosmos transfer events (native denom only), aptos, sui', () => {
  const ev = (s, r, a) => ({ type: 'transfer', attributes: [{ key: 'recipient', value: r }, { key: 'sender', value: s }, { key: 'amount', value: a }] });
  const c = H.mapCosmosTxs(C('cosmos'), [{ tx_responses: [{ txhash: 'C1', code: 0, timestamp: '2024-01-01T00:00:00Z', events: [ev('cosmos1other', 'cosmos1me', '1500000uatom')] }, { txhash: 'C2', code: 5, timestamp: '2024-01-02T00:00:00Z', events: [ev('cosmos1me', 'cosmos1x', '9ibc/AA,2000000uatom')] }, { txhash: 'C3', code: 0, timestamp: '2024-01-03T00:00:00Z', events: [] }] }, { tx_responses: [{ txhash: 'C1', code: 0, events: [] }] }], 'cosmos1me', 'uatom');
  assert.deepEqual(c.map((x) => [x.id, x.kind, x.amount, x.status]), [['C1', 'receive', '1.5', 'confirmed'], ['C2', 'send', '2', 'failed'], ['C3', 'contract', '', 'confirmed']]); assert.equal(c[0].counterparty, 'cosmos1other');
  const a = H.mapAptos(C('aptos'), [{ type: 'user_transaction', hash: '0xh1', sender: '0xme', success: true, timestamp: '1700000000000000', payload: { function: '0x1::aptos_account::transfer', arguments: ['0xyou', '150000000'] } }, { type: 'user_transaction', hash: '0xh2', sender: '0xme', success: false, timestamp: '1', payload: { function: '0x1::foo::bar', arguments: [] } }], '0xme');
  assert.deepEqual([a[0].kind, a[0].amount, a[0].timestamp, a[0].counterparty, a[1].kind, a[1].status, a[1].method], ['send', '1.5', 1700000000000, '0xyou', 'contract', 'failed', 'bar']);
  const s = H.mapSui(C('sui'), [{ data: [{ digest: 'D1', timestampMs: '1700000000000', effects: { status: { status: 'success' }, gasUsed: { computationCost: '1000', storageCost: '2000000', storageRebate: '1000000' } }, transaction: { data: { sender: '0xme' } }, balanceChanges: [{ owner: { AddressOwner: '0xme' }, coinType: '0x2::sui::SUI', amount: '-1001001000' }, { owner: { AddressOwner: '0xyou' }, coinType: '0x2::sui::SUI', amount: '1000000000' }] },
    { digest: 'D2', timestampMs: '5', effects: { status: { status: 'success' }, gasUsed: {} }, transaction: { data: { sender: '0xyou' } }, balanceChanges: [{ owner: { AddressOwner: '0xme' }, coinType: '0x2::sui::SUI', amount: '5000000000' }] }] }], '0xme');
  assert.deepEqual(s.map((x) => [x.kind, x.amount, x.counterparty]), [['send', '1', '0xyou'], ['receive', '5', '0xyou']]);
});
test('history: ton, algorand, stellar, ripple, near, tezos, filecoin, waves, vechain, multiversx, subscan, rosetta', () => {
  const ton = H.mapTon(C('ton'), { result: [{ utime: 100, transaction_id: { hash: 'AAEC' }, in_msg: { source: 'EQother', value: '2000000000' }, out_msgs: [] }, { utime: 90, transaction_id: { hash: 'AwQF' }, in_msg: { source: '', value: '0' }, out_msgs: [{ destination: 'EQyou', value: '1000000000' }] }] });
  assert.deepEqual(ton.map((x) => [x.kind, x.amount, x.counterparty]), [['receive', '2', 'EQother'], ['send', '1', 'EQyou']]); assert.equal(ton[0].id, '000102');
  const alg = H.mapAlgorand(C('algorand'), { transactions: [{ id: 'A1', 'round-time': 10, sender: 'ME', 'tx-type': 'pay', 'payment-transaction': { receiver: 'YOU', amount: 2500000 } }] }, 'ME'); assert.deepEqual([alg[0].kind, alg[0].amount, alg[0].counterparty], ['send', '2.5', 'YOU']);
  const st = H.mapStellar(C('stellar'), { _embedded: { records: [{ id: 'p1', type: 'payment', asset_type: 'native', transaction_hash: 'S1', created_at: '2024-01-01T00:00:00Z', from: 'GYOU', to: 'GME', amount: '3.5000000', transaction_successful: true }, { id: 'p2', type: 'payment', asset_type: 'credit_alphanum4', transaction_hash: 'S2', from: 'a', to: 'b', amount: '1' }] } }, 'GME');
  assert.equal(st.length, 1); assert.deepEqual([st[0].kind, st[0].amount, st[0].id], ['receive', '3.5', 'S1:p1']);
  const xrp = H.mapRipple(C('ripple'), { result: { transactions: [{ tx: { hash: 'X1', TransactionType: 'Payment', Account: 'rMe', Destination: 'rYou', Amount: '1500000', date: 1000 }, meta: { TransactionResult: 'tesSUCCESS' }, validated: true }, { tx: { hash: 'X2', TransactionType: 'Payment', Account: 'rYou', Destination: 'rMe', Amount: { currency: 'USD', issuer: 'rI', value: '12.5' }, date: 1 }, meta: { TransactionResult: 'tecPATH_DRY' }, validated: true }] } }, 'rMe');
  assert.deepEqual([xrp[0].kind, xrp[0].amount, xrp[0].timestamp, xrp[1].symbol, xrp[1].amount, xrp[1].status], ['send', '1.5', (1000 + 946684800) * 1000, 'USD', '12.5', 'failed']);
  const near = H.mapNear(C('near'), { txns: [{ transaction_hash: 'N1', signer_account_id: 'you.near', receiver_account_id: 'me.near', block_timestamp: '1700000000000000000', outcomes: { status: true }, actions: [{ action: 'TRANSFER' }], actions_agg: { deposit: 2000000000000000000000000 } }] }, 'me.near');
  assert.deepEqual([near[0].kind, near[0].timestamp, near[0].counterparty], ['receive', 1700000000000, 'you.near']);
  const tz = H.mapTezos(C('tezos'), [{ hash: 'oo1', counter: 7, timestamp: '2024-01-01T00:00:00Z', sender: { address: 'tz1me' }, target: { address: 'tz1you' }, amount: 1500000, status: 'applied' }], 'tz1me'); assert.deepEqual([tz[0].kind, tz[0].amount], ['send', '1.5']);
  const fil = H.mapFilecoin(C('filecoin'), { transfers: [{ message: 'bafy1', timestamp: 100, from: 'f1you', to: 'f1me', value: '1500000000000000000', type: 'transfer' }, { message: 'bafy2', type: 'burn', from: 'f1me', to: 'f099', value: '1' }] }, 'f1me'); assert.deepEqual([fil.length, fil[0].kind, fil[0].amount], [1, 'receive', '1.5']);
  const w = H.mapWaves(C('waves'), [[{ id: 'w1', type: 4, timestamp: 5, sender: '3Pme', recipient: '3Pyou', amount: 150000000, assetId: null }, { id: 'w2', type: 4, assetId: 'TOKEN', timestamp: 1 }]], '3Pme'); assert.deepEqual([w[0].kind, w[0].amount, w[1].kind], ['send', '1.5', 'contract']);
  const vet = H.mapVeChain(C('vechain'), [{ sender: '0xYOU', recipient: '0xMe', amount: '0xde0b6b3a7640000', meta: { txID: '0xv1', blockTimestamp: 100 } }], '0xME'); assert.deepEqual([vet[0].kind, vet[0].amount, vet[0].timestamp], ['receive', '1', 100000]);
  const egld = H.mapMultiversx(C('elrond'), [{ txHash: 'e1', type: 'Transaction', timestamp: 10, sender: 'erd1me', receiver: 'erd1you', value: '1000000000000000000', status: 'success' }, { txHash: 'e2', type: 'SmartContractResult', sender: 'a', receiver: 'b', value: '1' }], 'erd1me'); assert.deepEqual([egld.length, egld[0].kind, egld[0].amount], [1, 'send', '1']);
  const dot = H.mapSubscan(C('polkadot'), { code: 0, data: { transfers: [{ hash: '0xd1', from: 'A', to: 'B', amount: '1.2345', block_timestamp: 100, success: true, asset_symbol: 'DOT' }] } }, 'B'); assert.deepEqual([dot[0].kind, dot[0].amount, dot[0].symbol], ['receive', '1.2345', 'DOT']);
  const icp = H.mapRosetta(C('internet_computer'), { transactions: [{ transaction: { transaction_identifier: { hash: 'i1' }, metadata: { timestamp: 1700000000000000000 }, operations: [{ type: 'TRANSACTION', account: { address: 'me' }, amount: { value: '-150000000' } }, { type: 'TRANSACTION', account: { address: 'you' }, amount: { value: '150000000' } }, { type: 'FEE', account: { address: 'me' }, amount: { value: '-10000' } }] } }] }, 'me'); assert.deepEqual([icp[0].kind, icp[0].amount, icp[0].counterparty], ['send', '1.5', 'you']);
});

// ---------- history orchestration ----------
const ME = '0xAbCdEf0000000000000000000000000000000001', OTHER = '0x2222222222222222222222222222222222222222';
test('fetchHistory (EVM): native + ERC-20 transfers merged, token legs replace zero-value contract calls, USD only when the explorer reports it', async () => {
  const f = mock({ url: '/token-transfers?type=ERC-20', body: { items: [{ transaction_hash: '0xswap', log_index: 3, timestamp: '2024-03-01T00:00:00Z', from: { hash: OTHER }, to: { hash: ME }, total: { value: '2500000', decimals: '6' }, token: { symbol: 'USDC', address_hash: '0xa0b8', decimals: '6' } }] } },
    { url: '/api/v2/addresses/', body: { items: [{ hash: '0xswap', timestamp: '2024-03-01T00:00:00Z', from: { hash: ME }, to: { hash: OTHER }, value: '0', status: 'ok', method: 'swap' }, { hash: '0xsend', timestamp: '2024-02-01T00:00:00Z', from: { hash: ME }, to: { hash: OTHER }, value: '1000000000000000000', status: 'ok', historic_exchange_rate: '3000' }] } });
  const r = await M.TH.fetchHistory('optimism', ME, null, f);
  assert.equal(r.ok, true); assert.ok(f.calls.some((c) => c.url.startsWith('https://optimism.blockscout.com/api/v2/addresses/')));
  assert.deepEqual(r.items.map((x) => [x.kind, x.amount, x.symbol]), [['receive', '2.5', 'USDC'], ['send', '1', 'ETH']]);
  assert.equal(r.items[0].token.address, '0xa0b8'); assert.equal(r.items[1].usd, 3000); assert.equal(r.items[0].usd, undefined);
  assert.match(r.items[1].url, /0xsend/);
  const partial = await M.TH.fetchHistory('base', ME, null, mock({ url: 'token-transfers', status: 500, body: {} }, { url: '/api/v2/addresses/', body: { items: [] } })); assert.equal(partial.ok, true);
  const down = await M.TH.fetchHistory('base', ME, null, mock({ status: 500, body: {} })); assert.equal(down.ok, false);
  const bsc = mock({ when: (u) => u.includes('action=tokentx'), body: { status: '1', result: [{ hash: '0xt', timeStamp: '1700000000', from: OTHER, to: ME, value: '5000000000000000000', tokenSymbol: 'CAKE', tokenDecimal: '18', contractAddress: '0xcake' }] } }, { when: (u) => u.includes('action=txlist'), body: { status: '1', result: [] } });
  const b = await M.TH.fetchHistory('smartchain', ME, null, bsc); assert.deepEqual([b.ok, b.items[0].symbol, b.items[0].amount], [true, 'CAKE', '5']);
});
test('fetchHistory: unsupported chains are explicit; bitcoin goes through Esplora on the registry endpoint; non-EVM dispatch', async () => {
  const u = await M.TH.fetchHistory('nimiq', 'NQ07 0000 0000', null, mock()); assert.deepEqual([u.ok, u.unsupported], [false, true]);
  assert.equal((await M.TH.fetchHistory('harmony', 'one1xxxxxxxxxxxxxxxx', null, mock())).unsupported, true);
  assert.equal(M.TH.historySupported('bitcoin') && M.TH.historySupported('tron') && M.TH.historySupported('solana') && M.TH.historySupported('internet_computer'), true);
  const btc = mock({ url: '/address/bc1qme/txs', body: [{ txid: 'aa', vin: [{ prevout: { scriptpubkey_address: 'bc1qother', value: 5000 } }], vout: [{ scriptpubkey_address: 'bc1qme', value: 4000 }], status: { confirmed: true, block_time: 100 } }] });
  const r = await M.TH.fetchHistory(C('bitcoin'), 'bc1qme', null, btc); assert.equal(btc.calls[0].url, 'https://mempool.space/api/address/bc1qme/txs'); assert.deepEqual([r.ok, r.items[0].kind, r.items[0].amount], [true, 'receive', '0.00004']);
  const trx = mock({ url: '/transactions/trc20', body: { data: [] } }, { url: `/v1/accounts/${ME_TRON}/transactions`, body: { data: [] } });
  assert.deepEqual((await M.TH.fetchHistory('tron', ME_TRON, null, trx)).items, []);
  const near = mock({ url: 'api.nearblocks.io/v1/account/me.near/txns', body: { txns: [] } }); assert.equal((await M.TH.fetchHistory('near', 'me.near', null, near)).ok, true);
  assert.equal((await M.TH.fetchHistory('aptos', '0xabc', null, mock({ status: 500, body: {} }))).ok, false);
  for (const id of ['cosmos', 'sui', 'ton', 'algorand', 'stellar', 'tezos', 'filecoin', 'waves', 'elrond', 'ripple', 'vechain', 'polkadot', 'solana']) assert.equal((await M.TH.fetchHistory(id, 'someaddress1234', null, mock({ throws: true }))).ok, false, id);
});

// ---------- gas ----------
test('gas: EIP-1559 tiers from feeHistory percentiles, legacy single tier, RPC wiring', async () => {
  const gw = (n) => '0x' + (BigInt(Math.round(n * 1e9))).toString(16);
  const fh = { baseFeePerGas: [gw(10), gw(11), gw(12), gw(13), gw(14), gw(15)], reward: [[gw(1), gw(2), gw(5)], [gw(1), gw(3), gw(6)], [gw(2), gw(2), gw(7)], [gw(1), gw(2), gw(8)], [gw(1), gw(2), gw(9)]] };
  const q = M.gas.buildQuote('ethereum', { gasPrice: 16n * 10n ** 9n, feeHistory: fh }, 5);
  assert.equal(q.eip1559, true); assert.equal(q.baseFee, String(15n * 10n ** 9n));
  const t = Object.fromEntries(q.tiers.map((x) => [x.id, x]));
  assert.equal(t.slow.priorityFee, String(1n * 10n ** 9n)); assert.equal(t.standard.priorityFee, String(2n * 10n ** 9n)); assert.equal(t.fast.priorityFee, String(7n * 10n ** 9n));
  assert.equal(t.standard.maxFeePerGas, String(30n * 10n ** 9n + 2n * 10n ** 9n)); assert.equal(t.slow.maxFeePerGas, String((15n * 10n ** 9n * 5n) / 4n + 10n ** 9n + 0n));
  assert.equal(t.standard.costWei, String((32n * 10n ** 9n) * 21000n));
  const legacy = M.gas.buildQuote('smartchain', { gasPrice: 3n * 10n ** 9n, feeHistory: { baseFeePerGas: ['0x0', '0x0'], reward: [] } }); assert.deepEqual([legacy.eip1559, legacy.tiers.length, legacy.tiers[0].maxFeePerGas], [false, 1, String(3n * 10n ** 9n)]);
  assert.equal(M.gas.gwei(1500000000n), '1.5'); assert.equal(M.gas.gwei(12345678901n), '12.3'); assert.equal(M.gas.gwei(0n), '0');
  const rpcMock = mock({ rpc: 'eth_gasPrice', body: { jsonrpc: '2.0', id: 1, result: gw(16) } }, { rpc: 'eth_feeHistory', body: { jsonrpc: '2.0', id: 1, result: fh } }, { rpc: 'eth_maxPriorityFeePerGas', body: { jsonrpc: '2.0', id: 1, result: gw(2) } });
  const r = await M.gas.fetchGasQuote(C('ethereum'), rpcMock); assert.equal(r.ok, true); assert.deepEqual(rpcMock.calls.find((c) => c.body.method === 'eth_feeHistory').body.params, [5, 'latest', [10, 50, 90]]);
  assert.equal((await M.gas.fetchGasQuote(C('ethereum'), mock({ throws: true }))).ok, false); assert.equal((await M.gas.fetchGasQuote(C('bitcoin'), rpcMock)).ok, false);
});
