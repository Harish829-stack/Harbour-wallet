import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import pkg from '@trustwallet/wallet-core';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './nfts/media'; export * from './nfts/spam'; export * from './nfts/blockscout'; export * from './nfts/solana'; export * from './nfts/service'; export * from './nfts/transfer'; export { decodeFunctionData, parseAbi } from 'viem';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(import.meta.url)});` },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const core = await pkg.initWasm();
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

// ---------------------------------------------------------------- media sanitising
test('media: ipfs/ar rewritten to public gateways; only https and data:image survive', () => {
  assert.equal(M.sanitizeMediaUrl('ipfs://bafyabc/1.png'), 'https://ipfs.io/ipfs/bafyabc/1.png');
  assert.equal(M.sanitizeMediaUrl('ipfs://ipfs/QmHash'), 'https://ipfs.io/ipfs/QmHash');
  assert.equal(M.sanitizeMediaUrl('ar://abc_DEF-1'), 'https://arweave.net/abc_DEF-1');
  assert.equal(M.sanitizeMediaUrl('https://cdn.example/a.png?x=1'), 'https://cdn.example/a.png?x=1');
  assert.equal(M.sanitizeMediaUrl('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(M.sanitizeMediaUrl('data:image/svg+xml;utf8,<svg/>'), '');            // utf8 flag not whitelisted -> must be base64 or plain
  assert.ok(M.sanitizeMediaUrl('data:image/svg+xml;base64,PHN2Zy8+').startsWith('data:image/svg+xml'));
  for (const bad of ['http://insecure.example/a.png', 'javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd', 'blob:https://x/y', 'https://user:pw@evil.example/a.png', 'ipfs://../../etc', 'ipfs://a b', 'ar://a?b', '', '   ', null, undefined, 42, {}, 'https://x.example/a b.png', 'https://x.example/\u0000'])
    assert.equal(M.sanitizeMediaUrl(bad), '', String(bad));
  assert.equal(M.sanitizeMediaUrl('https://x.example/' + 'a'.repeat(3000)), '');
});
test('media: links https-only, text cleaned, attributes mapped from array or object', () => {
  assert.equal(M.sanitizeLink('https://opensea.io/x'), 'https://opensea.io/x'); assert.equal(M.sanitizeLink('http://a.b'), ''); assert.equal(M.sanitizeLink('javascript:1'), '');
  assert.equal(M.cleanText('a\u0000b\u0007c', 10), 'abc'); assert.equal(M.cleanText('x'.repeat(50), 5), 'xxxxx'); assert.equal(M.cleanText({}, 5), '');
  assert.deepEqual(M.mapAttributes([{ trait_type: 'Hat', value: 'Red' }, { trait_type: '', value: 'x' }, { key: 'Lvl', value: 3 }, null]), [{ key: 'Hat', value: 'Red' }, { key: 'Lvl', value: '3' }]);
  assert.deepEqual(M.mapAttributes({ Eyes: 'Blue' }), [{ key: 'Eyes', value: 'Blue' }]); assert.deepEqual(M.mapAttributes('x'), []);
});
test('spam heuristic', () => {
  assert.equal(M.isSuspiciousCollection('Claim your reward at free-eth.xyz', 'VISIT'), true);
  assert.equal(M.isSuspiciousCollection('Bored Ape Yacht Club', 'BAYC'), false);
  assert.equal(M.isSuspiciousCollection('Normal​Name', ''), true);
});

// ---------------------------------------------------------------- blockscout
const OWNER = '0x1111111111111111111111111111111111111111';
const C1 = '0xAbCdEf0000000000000000000000000000000001';
const C2 = '0xAbCdEf0000000000000000000000000000000002';
const inst = (id, over = {}) => ({ id, image_url: `ipfs://img${id}`, animation_url: null, external_app_url: 'https://site.example/' + id, token_type: 'ERC-721', value: '1', metadata: { name: `Ape ${id}`, description: 'desc <b>x</b>', attributes: [{ trait_type: 'Fur', value: 'Gold' }] }, ...over });
test('blockscout: collections mapping, sanitised image, standards, ownership counts, spam flag', () => {
  const cols = M.mapBlockscoutCollections('ethereum', [
    { amount: '2', token: { address_hash: C1, name: 'Apes', symbol: 'APE', type: 'ERC-721', icon_url: 'http://insecure/icon.png' }, token_instances: [inst('1'), inst('2', { image_url: 'javascript:alert(1)' })] },
    { amount: '5', token: { address: C2, name: 'Visit scam.xyz to claim', symbol: 'SCAM', type: 'ERC-1155' }, token_instances: [inst('9', { token_type: 'ERC-1155', value: '5' })] },
    { amount: '1', token: { address_hash: 'nope' }, token_instances: [] },
  ]);
  assert.equal(cols.length, 2);
  assert.equal(cols[0].id, `ethereum:${C1.toLowerCase()}`); assert.equal(cols[0].owned, 2); assert.equal(cols[0].image, 'https://ipfs.io/ipfs/img1'); // icon http rejected -> first item image
  assert.equal(cols[0].items[1].image, '', 'unsafe image dropped'); assert.equal(cols[0].items[0].attributes[0].value, 'Gold'); assert.equal(cols[0].items[0].standard, 'ERC-721');
  assert.equal(cols[1].standard, 'ERC-1155'); assert.equal(cols[1].items[0].balance, '5'); assert.equal(cols[1].suspicious, true); assert.equal(cols[0].suspicious, false);
  assert.equal(cols[0].items[0].transferable, true);
});
test('blockscout: pagination via next_page_params and error surfacing', async () => {
  const urls = [];
  const f = async (u) => { urls.push(u); return String(u).includes('next=1') ? json({ items: [{ amount: '1', token: { address_hash: C2, name: 'B', symbol: 'B', type: 'ERC-721' }, token_instances: [inst('7')] }], next_page_params: null })
    : json({ items: [{ amount: '1', token: { address_hash: C1, name: 'A', symbol: 'A', type: 'ERC-721' }, token_instances: [inst('1')] }], next_page_params: { next: 1, items_count: 50 } }); };
  const cols = await M.fetchBlockscoutCollections('base', OWNER, f);
  assert.equal(cols.length, 2); assert.match(urls[0], /^https:\/\/base\.blockscout\.com\/api\/v2\/addresses\/0x1{40}\/nft\/collections\?type=ERC-721%2CERC-1155$/); assert.match(urls[1], /next=1&items_count=50|items_count=50&next=1/);
  await assert.rejects(M.fetchBlockscoutCollections('bitcoin', OWNER, f), /No public NFT indexer/);
  await assert.rejects(M.fetchBlockscoutCollections('base', 'nope', f), /Invalid address/);
  await assert.rejects(M.fetchBlockscoutCollections('base', OWNER, async () => json({}, 500)), /HTTP 500/);
});
test('blockscout: owned items filter by contract', async () => {
  const f = async () => json({ items: [{ ...inst('1'), token: { address_hash: C1, name: 'A', type: 'ERC-721' } }, { ...inst('2'), token: { address_hash: C2, name: 'B', type: 'ERC-721' } }, { ...inst('3'), token: { address_hash: C1.toLowerCase(), name: 'A', type: 'ERC-721' } }], next_page_params: null });
  const items = await M.fetchBlockscoutOwned('ethereum', OWNER, C1, f);
  assert.deepEqual(items.map((i) => i.id), ['1', '3']);
  assert.equal(M.blockscoutInstanceUrl('ethereum', C1, '5'), `https://eth.blockscout.com/token/${C1}/instance/5`); assert.equal(M.blockscoutInstanceUrl('ethereum', C1, '5x'), '');
});

// ---------------------------------------------------------------- solana
const SOL = '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';
const MINT = 'FiijvR2ibXEHaFqB127CxrL3vSj19K2Kx1jf2RbK4BWS';
const COLL = 'DTwEEF6VSrmTBYkDcj3BKAc52qhvP8CEQUEAMMT1cG3';
const das = (id, extra = {}) => ({ id, interface: 'V1_NFT', content: { metadata: { name: 'Pixel ' + id.slice(0, 3), description: 'd', attributes: [{ trait_type: 'Bg', value: 'Blue' }] }, links: { image: 'https://cdn.example/p.png', external_url: 'https://p.example' }, files: [] }, grouping: [{ group_key: 'collection', group_value: COLL, collection_metadata: { name: 'Pixels', image: 'ar://col' } }], compression: { compressed: false }, ...extra });
test('solana DAS mapping: collection grouping, filters fungible/burnt, transferability', () => {
  const cols = M.groupSolana([das(MINT), das('DTwEEF6VSrmTBYkDcj3BKAc52qhvP8CEQUEAMMT1cG4', { compression: { compressed: true } }), das('Fiijv22222222222222222222222222222222222222', { interface: 'FungibleToken' }), das('Fiijv22222222222222222222222222222222222223', { burnt: true }),
    das('Fiijv22222222222222222222222222222222222224', { grouping: [], interface: 'ProgrammableNFT' })].map(M.mapDasAsset).filter(Boolean));
  assert.equal(cols.length, 2); const c = cols.find((x) => x.id === `solana:${COLL}`); assert.equal(c.name, 'Pixels'); assert.equal(c.owned, 2); assert.equal(c.image, 'https://arweave.net/col');
  assert.equal(c.items[0].transferable, true); assert.equal(c.items[1].transferable, false, 'compressed NFTs are not transferable here');
  const u = cols.find((x) => x.id === 'solana:ungrouped'); assert.equal(u.name, 'Other NFTs'); assert.equal(u.items[0].transferable, false, 'programmable NFT');
});
test('solana: DAS failure falls back to Magic Eden in the service; both failing reports the error', async () => {
  const calls = [];
  const f = async (u, init) => { calls.push(String(u)); if (String(u).includes('magiceden')) return json([{ mintAddress: MINT, name: 'ME NFT', image: 'https://img.example/x.png', collection: 'pixels', collectionName: 'Pixels', attributes: [{ trait_type: 'a', value: 'b' }] }]); return json({ error: { message: 'Method not found' } }); };
  const env = { f, solUrls: () => ['https://api.mainnet-beta.solana.com'] };
  const r = await M.loadCollections(env, (c) => (c === 'solana' ? SOL : ''), ['solana']);
  assert.equal(r.sources.solana, 'Magic Eden'); assert.equal(r.collections[0].items[0].name, 'ME NFT'); assert.equal(r.errors.length, 0);
  const bad = await M.loadCollections({ f: async () => json({}, 500), solUrls: () => ['https://x.example'] }, () => SOL, ['solana']);
  assert.equal(bad.collections.length, 0); assert.equal(bad.errors[0].chainId, 'solana');
  const good = await M.loadCollections({ f: async (u, init) => json({ result: { items: [das(MINT)] } }), solUrls: () => ['https://das.example'] }, () => SOL, ['solana']);
  assert.equal(good.sources.solana, 'Solana DAS'); assert.equal(good.collections[0].owned, 1);
});

// ---------------------------------------------------------------- service: hide / report state
test('report state: user report, suspected spam default-hidden, unhide override, sanitising', () => {
  const mk = (id, suspicious) => ({ id, suspicious, chainId: 'ethereum', contract: '', name: id, symbol: '', image: '', owned: 1, standard: 'ERC-721', items: [] });
  const all = [mk('a', false), mk('b', true), mk('c', false)];
  let s = { hidden: [], shown: [] };
  let sp = M.splitCollections(all, s); assert.deepEqual(sp.active.map((c) => c.id), ['a', 'c']); assert.deepEqual(sp.hidden.map((c) => [c.id, c.reason]), [['b', 'suspected']]);
  s = M.setReported(s, 'a', true); sp = M.splitCollections(all, s); assert.deepEqual(sp.hidden.map((c) => [c.id, c.reason]), [['a', 'reported'], ['b', 'suspected']]);
  s = M.setReported(s, 'b', false); sp = M.splitCollections(all, s); assert.deepEqual(sp.active.map((c) => c.id), ['b', 'c']);
  s = M.setReported(s, 'a', false); assert.ok(!s.hidden.includes('a') && s.shown.includes('a'));
  assert.deepEqual(M.sanitizeReportState({ hidden: ['x', 5, null, 'y'], shown: 'nope' }), { hidden: ['x', 'y'], shown: [] });
  assert.deepEqual(M.sanitizeReportState(null), { hidden: [], shown: [] });
});
test('loadCollections: partial failures are reported per chain; results sorted non-suspicious first', async () => {
  const f = async (u) => {
    if (String(u).includes('explorer.kava.io')) return json({ items: [{ amount: '1', token: { address_hash: C1, name: 'Claim free airdrop', symbol: 'X', type: 'ERC-721' }, token_instances: [] }] });
    if (String(u).includes('neon.blockscout')) return json({ items: [{ amount: '3', token: { address_hash: C2, name: 'Good', symbol: 'G', type: 'ERC-721' }, token_instances: [] }] });
    return json({}, 503);
  };
  const r = await M.loadCollections({ f, solUrls: () => [] }, () => OWNER, ['kavaevm', 'neon', 'megaeth']);
  assert.deepEqual(r.collections.map((c) => c.name), ['Good', 'Claim free airdrop']); assert.deepEqual(r.errors.map((e) => e.chainId), ['megaeth']);
});

// ---------------------------------------------------------------- transfers
test('EVM NFT transfer plans: ERC-721 safeTransferFrom(address,address,uint256) and ERC-1155 with amount', () => {
  const to = '0x2222222222222222222222222222222222222222';
  const t = M.evmNftTransfer({ contract: C1, id: '42', standard: 'ERC-721', transferable: true }, OWNER, to);
  assert.equal(t.to.toLowerCase(), C1.toLowerCase()); assert.equal(t.data.slice(0, 10), '0x42842e0e'); assert.equal(t.value, 0n);
  const d = M.decodeFunctionData({ abi: M.parseAbi(['function safeTransferFrom(address from, address to, uint256 tokenId)']), data: t.data }); assert.equal(d.args[2], 42n); assert.equal(d.args[1], to);
  const m = M.evmNftTransfer({ contract: C1, id: '7', standard: 'ERC-1155', transferable: true }, OWNER, to, 3n);
  assert.equal(m.data.slice(0, 10), '0xf242432a');
  assert.throws(() => M.evmNftTransfer({ contract: C1, id: '1', standard: 'ERC-721', transferable: true }, OWNER, '0x0000000000000000000000000000000000000000'), /zero address/);
  assert.throws(() => M.evmNftTransfer({ contract: C1, id: '1', standard: 'ERC-721', transferable: true }, OWNER, 'bob'), /Invalid address/);
  assert.throws(() => M.evmNftTransfer({ contract: C1, id: '1', standard: 'ERC-721', transferable: false }, OWNER, to), /cannot be transferred/);
  assert.throws(() => M.evmNftTransfer({ contract: C1, id: '1', standard: 'ERC-1155', transferable: true }, OWNER, to, 0n), /Quantity/);
});
test('solana NFT transfer signs (existing recipient token account vs create-and-transfer)', () => {
  const KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const me = core.CoinTypeExt.deriveAddress(core.CoinType.solana, core.PrivateKey.createWithData(KEY));
  const base = { sender: me, recipient: COLL, mint: MINT, senderTokenAddress: SOL, recipientTokenAddress: '4jpwTqt1qZoR7u6u639z2AngYFGN3nakvKhowcnRZDEC', token2022: false, blockhash: '11111111111111111111111111111111', privateKey: KEY };
  const a = M.signSolanaNft(core, { ...base, recipientHasAccount: true }); const b = M.signSolanaNft(core, { ...base, recipientHasAccount: false });
  assert.ok(a.length > 100 && b.length > a.length, 'create-and-transfer carries an extra instruction');
  assert.throws(() => M.signSolanaNft(core, { ...base, recipient: me, recipientHasAccount: true }), /yourself/);
  assert.throws(() => M.signSolanaNft(core, { ...base, mint: 'bad', recipientHasAccount: true }), /Invalid Solana address/);
});
