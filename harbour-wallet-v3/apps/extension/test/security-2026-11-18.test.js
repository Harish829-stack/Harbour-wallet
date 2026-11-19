// Regression tests for the 2026-11-18 security audit (SEC-2026-11-18-*). See documentation/security for the report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
const out = await build({
  stdin: { contents: `export * from './nfts/media';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

// SEC-2026-11-18-05: NFT media from the minter's own server is click-to-load (IP / address linkage).
test('SEC-05: only shared media hosts and inline images load automatically', () => {
  for (const ok of ['https://nft-cdn.alchemy.com/eth-mainnet/abc', 'https://ipfs.io/ipfs/QmHash', 'https://arweave.net/abc', 'data:image/png;base64,AAAA', 'data:image/svg+xml;base64,PHN2Zz4='])
    assert.equal(M.isAutoLoadMedia(ok), true, ok);
  for (const no of ['https://attacker.example/pixel.png?wallet=0xabc', 'https://nft-cdn.alchemy.com.attacker.example/x.png', 'https://evil.ipfs.io.example/x', 'http://ipfs.io/ipfs/x', '', 'javascript:alert(1)', 'https://user:pw@ipfs.io/x'.replace('user:pw@', 'u@x.example/@'), 'ftp://ipfs.io/x'])
    assert.equal(M.isAutoLoadMedia(no), false, no);
  assert.equal(M.mediaHost('https://attacker.example/a.png'), 'attacker.example');
  assert.equal(M.mediaHost('not a url'), '');
});

test('SEC-05: the NFT image component gates third-party hosts behind a click', () => {
  const src = readFileSync(new URL('../src/popup/wallet/features/nfts.tsx', import.meta.url), 'utf8');
  assert.match(src, /isAutoLoadMedia\(src\)/);
  assert.match(src, /data-testid="nft-media-load"/);
  // every NFT picture in the popup goes through NftImage (no direct <img src={...image}>)
  assert.doesNotMatch(src, /<img src=\{(it|c|col|d)\.image/);
});

// SEC-2026-11-18-01: the build refuses .env files that hold secrets (a remote-config signing key was found in .env.production).
test('SEC-01: env guard flags secret-named and key-shaped entries, never public ones', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { envSecrets } = await import('../scripts/env-guard.mjs');
  const d = mkdtempSync(`${tmpdir()}/envguard-`);
  writeFileSync(`${d}/.env.production`, ['# comment', 'VITE_HB_API_URL=https://api.example', 'VITE_HB_CONFIG_PUBKEY=FAKEPUBLICKEYVALUE', 'PRIVATE (keep offline)=FAKE-NOT-A-REAL-KEY', 'VITE_WC_PROJECT_ID=0000', 'EMPTY_SECRET='].join('\n'));
  writeFileSync(`${d}/.env.example`, 'MY_SECRET=placeholder\n');
  writeFileSync(`${d}/.env`, 'SIGNER=-----BEGIN PRIVATE KEY-----FAKE\n');
  assert.deepEqual(envSecrets(d).sort(), ['.env.production: PRIVATE (keep offline)', '.env: SIGNER'].sort());
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(vite, /envSecrets\(process\.cwd\(\)\)/);
});
