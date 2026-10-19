// Repeatable, offline import of a pinned CC0 icon source. No artifact is executed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const revision = '1a63530be6e374711a8554f31b17e4cb92c25fa5';
const archive = '/private/tmp/harbour-cryptocurrency-icons-1a63530.tar.gz';
const archiveHash = 'eea5e6aa5b6350db16bb67ec2bc059fd3fc8efbcb375f7be1ea87812f522943c';
const symbols = ['aave', 'ada', 'avax', 'bnb', 'btc', 'dai', 'doge', 'eth', 'eur', 'gbp', 'link', 'ltc', 'matic', 'sol', 'trx', 'uni', 'usd', 'usdc', 'usdt', 'xrp'];
const base = `cryptocurrency-icons-${revision}`;
const output = path.join(root, 'harbour-wallet-v2/public-production/asset-logos');
await mkdir(output, { recursive: true });
const packed = await import('node:fs/promises').then(fs => fs.readFile(archive));
if (createHash('sha256').update(packed).digest('hex') !== archiveHash) throw new Error('Pinned archive checksum mismatch');
const rows = [];
for (const symbol of symbols) {
  const source = `${base}/svg/color/${symbol}.svg`;
  const svg = execFileSync('tar', ['-xOf', archive, source], { encoding: 'utf8' });
  if (!/^<svg\b[\s\S]*<\/svg>\s*$/.test(svg) || /<script|<foreignObject|\bon(?:load|click|error)=|(?:href|xlink:href)="(?!#)|url\((?!#)/i.test(svg)) throw new Error(`Unexpected SVG content: ${symbol}`);
  const local = path.join(output, `${symbol}.svg`);
  await writeFile(local, svg);
  rows.push({ symbol, source: `https://github.com/spothq/cryptocurrency-icons/blob/${revision}/svg/color/${symbol}.svg`, local: path.relative(root, local), sha256: createHash('sha256').update(svg).digest('hex') });
}
const license = execFileSync('tar', ['-xOf', archive, `${base}/LICENSE.md`], { encoding: 'utf8' });
await writeFile(path.join(root, 'harbour-wallet-v2/public-production/licenses/CRYPTOCURRENCY-ICONS-CC0.txt'), license);
await writeFile(path.join(root, 'evidence/00-screen-structure/2026-10-16/asset-logo-import.json'), JSON.stringify({ source: 'https://github.com/spothq/cryptocurrency-icons', revision, archiveHash, license: 'CC0 1.0', checked: new Date().toISOString(), rows }, null, 2) + '\n');
console.log(`Imported ${rows.length} pinned icons into ${output}`);
