// Release candidate: production build -> deterministic zip -> SHA-256 -> Ed25519 signature with the release key.
//   node scripts/release.mjs            (key: ../harbour-release-key.json, created on first run; keep it OFF the repo and backed up)
// Outputs releases/harbour-<version>.zip, .zip.sha256, .zip.sig and harbour-<version>.release.json (per-file hashes, commit, signer).
// Verify anywhere with: node scripts/verify-release.mjs releases/harbour-<version>.zip
import { execSync } from 'node:child_process';
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipDir } from './lib-zip.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = process.env.HB_RELEASE_KEY ?? path.join(root, '..', 'harbour-release-key.json');
const sha = (b) => createHash('sha256').update(b).digest('hex');
if (!process.argv.includes('--no-build')) execSync('npm run build', { cwd: root, stdio: 'inherit' });
const dist = path.join(root, 'dist');
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const version = manifest.version;
// Only a bundle that talks to an https backend can be released (local builds use http://localhost; see scripts/api-url.mjs).
const infoFile = path.join(dist, 'build-info.json');
const info = existsSync(infoFile) ? JSON.parse(readFileSync(infoFile, 'utf8')) : null;
if (!info || info.local || !String(info.api).startsWith('https://') || (manifest.host_permissions ?? []).some((h) => h.startsWith('http://'))) {
  console.error(`release refused: dist/ was built for ${info?.api ?? 'an unknown API'}. Set VITE_HB_API_URL=https://... in .env.production and rebuild.`);
  process.exit(1);
}
let key;
if (existsSync(keyFile)) key = JSON.parse(readFileSync(keyFile, 'utf8'));
else {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  key = { pub: publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('base64'), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  writeFileSync(keyFile, JSON.stringify(key, null, 2), { mode: 0o600 }); console.log(`created release signing key ${keyFile} (back it up; never commit it)`);
}
// Pin the release signer in the repo on first use (verify-release.mjs trusts only this file, never release.json).
const pinFile = path.join(root, 'release-signer.pub');
if (!existsSync(pinFile)) { writeFileSync(pinFile, key.pub + '\n'); console.log(`pinned release signer in release-signer.pub (${key.pub}); commit this file`); }
else if (readFileSync(pinFile, 'utf8').trim() !== key.pub) { console.error('release refused: the signing key does not match release-signer.pub'); process.exit(1); }
const { zip, files } = zipDir(dist);
const digest = sha(zip);
const signature = sign(null, zip, createPrivateKey(key.priv)).toString('base64');
let commit = ''; try { commit = execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
const out = path.join(root, 'releases'); mkdirSync(out, { recursive: true });
const name = `harbour-${version}.zip`;
writeFileSync(path.join(out, name), zip);
writeFileSync(path.join(out, `${name}.sha256`), `${digest}  ${name}\n`);
writeFileSync(path.join(out, `${name}.sig`), `${signature}\n`);
writeFileSync(path.join(out, `harbour-${version}.release.json`), JSON.stringify({
  name: manifest.name, version, zip: name, sha256: digest, signature, signer: key.pub, algorithm: 'Ed25519 over the zip bytes', commit, node: process.version,
  files: files.map((f) => ({ path: f, sha256: sha(readFileSync(path.join(dist, f))) })),
}, null, 2) + '\n');
console.log(`\n${name}\nsha256 ${digest}\nsigner ${key.pub}\nfiles  ${files.length}`);
