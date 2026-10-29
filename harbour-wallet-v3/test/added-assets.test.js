import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({ stdin: { contents: `export * from './activity/filter'; export * from './nfts/added';`, resolveDir: dir, sourcefile: 'x.ts', loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

const USDC = '0xAbC0000000000000000000000000000000000001'; const SPAM = '0x0000000000000000000000000000000000000dad'; const NFT = '0x00000000000000000000000000000000000000f1';
const row = (o) => ({ id: 'h:0', assetId: 'sepolia', kind: 'receive', status: 'confirmed', timestamp: 1, amount: '1', symbol: 'ETH', ...o });

test('history shows the native coin and added tokens/NFTs only; airdrops and unknown tokens never appear', () => {
  const allow = M.allowFromWallet({ customTokens: [{ networkId: 'sepolia', address: USDC }], customChainTokens: [{ chain: 'solana', address: 'MintAbc' }] }, [M.nftKey('sepolia', NFT, '7')]);
  const items = [
    row({ id: 'native' }),
    row({ id: 'usdc', symbol: 'USDC', token: { symbol: 'USDC', address: USDC.toLowerCase() } }),
    row({ id: 'spam', symbol: 'FREE', token: { symbol: 'FREE', address: SPAM } }),
    row({ id: 'noaddr', symbol: '???', token: { symbol: '???' } }),
    row({ id: 'nft7', symbol: 'NFT', token: { symbol: 'NFT', address: NFT }, tokenId: '7' }),
    row({ id: 'nft8', symbol: 'NFT', token: { symbol: 'NFT', address: NFT }, tokenId: '8' }),
    row({ id: 'swap', kind: 'swap', swap: { sent: { symbol: 'ETH', amount: '1' }, received: { symbol: 'UNK', amount: '5', address: SPAM } } }),
    row({ id: 'sol', assetId: 'solana', token: { symbol: 'X', address: 'MintAbc' } }),
    row({ id: 'sol-other', assetId: 'solana', token: { symbol: 'Y', address: 'MintOther' } }),
  ];
  assert.deepEqual(M.filterByAddedAssets(items, allow).map((i) => i.id), ['native', 'usdc', 'nft7', 'swap', 'sol']);
  // removing the token from the wallet removes its history again
  assert.deepEqual(M.filterByAddedAssets(items, M.allowFromWallet({}, [])).map((i) => i.id), ['native', 'swap']);
});

test('NFT import validation and keepAdded', () => {
  assert.equal(M.sanitizeAdded({ chainId: 'sepolia', contract: 'nope', tokenId: '1' }).ok, false);
  assert.equal(M.sanitizeAdded({ chainId: 'sepolia', contract: NFT, tokenId: '1.5' }).ok, false);
  const ok = M.sanitizeAdded({ chainId: 'sepolia', contract: NFT.toUpperCase().replace('0X', '0x'), tokenId: '0007' });
  assert.equal(ok.ok, true); assert.equal(ok.nft.tokenId, '7'); assert.equal(ok.nft.contract, NFT);
  const item = (id) => ({ id, collectionId: 'c', chainId: 'sepolia', contract: NFT, name: id, description: '', image: '', animationUrl: '', attributes: [], standard: 'ERC-721', balance: '1', externalUrl: '', transferable: true });
  const col = { id: `sepolia:${NFT}`, chainId: 'sepolia', contract: NFT, name: 'C', symbol: '', image: '', owned: 3, standard: 'ERC-721', suspicious: false, items: [item('7'), item('8'), item('9')] };
  const kept = M.keepAdded([col, { ...col, id: 'other', contract: SPAM, items: [{ ...item('1'), contract: SPAM }] }], M.addedKeys([ok.nft]));
  assert.equal(kept.length, 1); assert.deepEqual(kept[0].items.map((i) => i.id), ['7']); assert.equal(kept[0].owned, 1);
});

test('checkOwnership reads ownerOf, then ERC-1155 balanceOf', async () => {
  const ME = '0x1111111111111111111111111111111111111111';
  const pad = (a) => '0x' + a.replace(/^0x/, '').padStart(64, '0');
  const mk = (handler) => async (_u, init) => ({ ok: true, status: 200, json: async () => handler(JSON.parse(init.body).params[0].data) });
  const owns721 = mk((d) => (d.startsWith('0x6352211e') ? { result: pad(ME) } : { error: { message: 'revert' } }));
  assert.deepEqual(await M.checkOwnership(owns721, ['http://x'], { contract: NFT, tokenId: '7' }, ME), { owned: true, standard: 'ERC-721', balance: '1' });
  const other721 = mk((d) => (d.startsWith('0x6352211e') ? { result: pad(SPAM) } : { error: { message: 'revert' } }));
  assert.deepEqual(await M.checkOwnership(other721, ['http://x'], { contract: NFT, tokenId: '7' }, ME), { owned: false, readable: true });
  const sem1155 = mk((d) => (d.startsWith('0x00fdd58e') ? { result: pad('0x3') } : { error: { message: 'revert' } }));
  assert.deepEqual(await M.checkOwnership(sem1155, ['http://x'], { contract: NFT, tokenId: '7' }, ME), { owned: true, standard: 'ERC-1155', balance: '3' });
  const broken = mk(() => ({ error: { message: 'revert' } }));
  assert.deepEqual(await M.checkOwnership(broken, ['http://x'], { contract: NFT, tokenId: '7' }, ME), { owned: false, readable: false });
});
