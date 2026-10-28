import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { encodeAbiParameters } from 'viem';

// On-chain NFT metadata fallback (indexer returned no image): tokenURI over RPC, then https / ipfs / data: JSON.
const out = await build({ stdin: { contents: `export * from './onchain';`, resolveDir: fileURLToPath(new URL('../src/core/nfts/', import.meta.url)), sourcefile: 'e.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('token URI resolution: ipfs, https, inline JSON, ERC-1155 {id}, rejects http', () => {
  assert.deepEqual(M.resolveTokenUri('ipfs://QmX/1.json', '1'), { url: 'https://ipfs.io/ipfs/QmX/1.json' });
  assert.deepEqual(M.resolveTokenUri('https://a.example/{id}.json', '10'), { url: `https://a.example/${'0'.repeat(63)}a.json` });
  assert.equal(M.resolveTokenUri(`data:application/json;base64,${btoa('{"name":"x"}')}`, '1').inline, '{"name":"x"}');
  assert.deepEqual(M.resolveTokenUri('http://insecure.example/1', '1'), {});
});

test('fills a missing image and generic name from tokenURI metadata; leaves indexer data alone', async () => {
  const uriHex = encodeAbiParameters([{ type: 'string' }], ['ipfs://QmMeta/1']);
  const f = async (url, init) => {
    if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: uriHex }) };
    assert.equal(url, 'https://ipfs.io/ipfs/QmMeta/1');
    return { ok: true, status: 200, text: async () => JSON.stringify({ name: 'Harbour Genesis', image: 'ipfs://QmImg/1.png', attributes: [{ trait_type: 'Tier', value: 'Gold' }] }) };
  };
  const item = (id, image = '') => ({ id, collectionId: 'sepolia:0xc', chainId: 'sepolia', contract: '0x' + '1'.repeat(40), name: `HarbourNFT #${id}`, description: '', image, animationUrl: '', attributes: [], standard: 'ERC-721', balance: '1', externalUrl: '', transferable: true });
  const col = { id: 'sepolia:0xc', chainId: 'sepolia', contract: '0x' + '1'.repeat(40), name: 'HarbourNFT', symbol: 'HNFT', image: '', owned: 2, standard: 'ERC-721', suspicious: false, items: [item('1'), item('2', 'https://cdn.example/2.png')] };
  await M.fillMissingMetadata([col], ['https://rpc.example'], f);
  assert.equal(col.items[0].image, 'https://ipfs.io/ipfs/QmImg/1.png'); assert.equal(col.items[0].name, 'Harbour Genesis'); assert.deepEqual(col.items[0].attributes, [{ key: 'Tier', value: 'Gold' }]);
  assert.equal(col.items[1].image, 'https://cdn.example/2.png'); assert.equal(col.image, 'https://ipfs.io/ipfs/QmImg/1.png');
});
