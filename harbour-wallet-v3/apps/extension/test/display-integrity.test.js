// Display integrity: text a site controls must not be able to hide or reorder what the approval screen shows
// (bidirectional overrides, zero-width and control characters). Same class as MetaMask's right-to-left-override fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const load = async (contents) => {
  const out = await build({ stdin: { contents, resolveDir: src, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const { visibleText, visibleDeep, hasHiddenChars } = await load(`export * from './core/provider/displayText';`);
const { buildView } = await load(`export { buildView } from './background/provider/view';`);
const { normalizePersonalSign, normalizeTypedData } = await load(`export { normalizePersonalSign, normalizeTypedData } from './core/provider/methods';`);

const RLO = '\u202E', LRI = '\u2066', PDI = '\u2069', ZWSP = '\u200B';
const ME = '0x1111111111111111111111111111111111111111';
const hex = (s) => '0x' + Buffer.from(s, 'utf8').toString('hex');

test('visibleText: reordering and invisible characters become visible escapes; ordinary text is untouched', () => {
  assert.equal(visibleText(`pay ${RLO}moc.live`), 'pay \\u{202E}moc.live');
  assert.equal(visibleText(`a${ZWSP}b${LRI}c${PDI}`), 'a\\u{200B}b\\u{2066}c\\u{2069}');
  assert.equal(visibleText('line1\r\nline2\u0000'), 'line1\\u{000D}\nline2\\u{0000}');
  assert.equal(visibleText('\u{E0041}'), '\\u{E0041}'); // invisible "tag" characters
  for (const ok of ['Sign in to app.example\n\tNonce: 1', 'مرحبا بالعالم', 'שלום', '日本語', 'family 👨‍👩‍👧 ok', '0xdeadBEEF']) {
    assert.equal(visibleText(ok), ok); assert.equal(hasHiddenChars(ok), false);
  }
  assert.equal(hasHiddenChars(`x${RLO}`), true);
  assert.equal(hasHiddenChars(`x${RLO}`), true, 'no state is kept between calls');
});

test('visibleDeep: every string and key of a view is covered, other values are kept, the input is not changed', () => {
  const input = { a: `x${RLO}`, n: 5, b: true, z: null, list: [`y${ZWSP}`, { [`k${RLO}`]: 'v' }] };
  const out = visibleDeep(input);
  assert.deepEqual(out, { a: 'x\\u{202E}', n: 5, b: true, z: null, list: ['y\\u{200B}', { 'k\\u{202E}': 'v' }] });
  assert.equal(input.a, `x${RLO}`);
});

const net = { chainId: 1, name: 'Ethereum', symbol: 'ETH', decimals: 18, testnet: false, custom: false, explorer: null, rpcUrls: [] };
const deps = () => ({
  perms: { get: async () => ({ chainId: 1, accountName: 'A', evmAddress: ME, others: {} }) },
  networks: { list: () => [net], get: () => net }, signer: { accounts: async () => null },
  kv: { get: async () => undefined, set: async () => {} },
  fetch: async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' }),
  tokenMeta: async () => null, probeChainId: async () => 1, rpc: async () => { throw new Error('unavailable'); },
});
const pending = (kind, method, params, extra = {}) => ({ id: 'r1', kind, ns: 'evm', method, origin: 'https://evil.example', topOrigin: 'https://evil.example', isTopFrame: true, params, ...extra });

test('personal_sign: a right-to-left override in the message is shown, flagged, and the signed bytes are unchanged', async () => {
  // Drawn by a browser, the raw text would show "Transfer to" followed by the reversed tail.
  const text = `I agree to the terms of ${RLO}elpmaxe.ppa`;
  const n = normalizePersonalSign([hex(text), ME], ME);
  const before = n.bytesHex;
  const v = await buildView(pending('sign', 'personal_sign', n), deps());
  assert.equal(v.message.utf8, 'I agree to the terms of \\u{202E}elpmaxe.ppa');
  assert.equal(v.message.hidden, true);
  assert.equal(v.message.hex, hex(text), 'the hex view is the real message');
  assert.equal(n.bytesHex, before, 'the stored request (what gets signed) is not modified by building the view');
  assert.equal(n.utf8, text);
});

test('personal_sign: an ordinary message is shown exactly as sent and is not flagged', async () => {
  const text = 'Welcome!\nClick to sign in.\nNonce: 42';
  const v = await buildView(pending('sign', 'personal_sign', normalizePersonalSign([hex(text), ME], ME)), deps());
  assert.equal(v.message.utf8, text); assert.equal(v.message.hidden, false);
});

test('sign-in card: a domain disguised with hidden characters is escaped and still reported as a mismatch', async () => {
  const msg = `evil.example${ZWSP} wants you to sign in with your Ethereum account:\n${ME}\n\nHello\n\nURI: https://evil.example\nVersion: 1\nChain ID: 1\nNonce: abcdefgh\nIssued At: 2026-01-01T00:00:00Z`;
  const v = await buildView(pending('sign', 'personal_sign', normalizePersonalSign([hex(msg), ME], ME)), deps());
  assert.equal(v.siwe.domain, 'evil.example\\u{200B}');
  assert.ok(v.siwe.issues.includes('domain'));
});

test('typed data: hidden characters in values, the domain name and field names are escaped; the stored typed data is untouched', async () => {
  const td = { types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }], Mail: [{ name: `to${ZWSP}`, type: 'string' }, { name: 'contents', type: 'string' }] },
    primaryType: 'Mail', domain: { name: `Safe${RLO}App`, chainId: 1 }, message: { [`to${ZWSP}`]: 'bob', contents: `send ${RLO}001 to alice` } };
  const n = normalizeTypedData('eth_signTypedData_v4', [ME, JSON.stringify(td)], ME);
  const snapshot = JSON.stringify(n.typedData);
  const v = await buildView(pending('typed', 'eth_signTypedData_v4', n), deps());
  assert.equal(v.typed.domain.name, 'Safe\\u{202E}App');
  const flat = JSON.stringify(v.typed.tree);
  assert.ok(flat.includes('send \\\\u{202E}001 to alice'));
  assert.ok(flat.includes('to\\\\u{200B}'));
  assert.ok(!/[\u202E\u200B]/.test(JSON.stringify(v)), 'no hidden character reaches the approval screen');
  assert.equal(JSON.stringify(n.typedData), snapshot, 'what gets hashed and signed is unchanged');
});

test('page title and network name set by a site are escaped on the approval screen', async () => {
  const v = await buildView(pending('addChain', 'wallet_addEthereumChain', { chainId: 4242, known: false, network: { name: `Ether${RLO}muem`, rpcUrl: 'https://rpc.example', symbol: 'ETH', explorerUrl: '' } }, { title: `Uniswap${RLO}` }),
    { ...deps(), networks: { list: () => [net], get: (id) => (id === 1 ? net : undefined) } });
  assert.equal(v.title, 'Uniswap\\u{202E}');
  assert.equal(v.network.name, 'Ether\\u{202E}muem');
});
