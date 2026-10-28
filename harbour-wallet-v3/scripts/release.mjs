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
let key;
if (existsSync(keyFile)) key = JSON.parse(readFileSync(keyFile, 'utf8'));
else {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  key = { pub: publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('base64'), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  writeFileSync(keyFile, JSON.stringify(key, null, 2), { mode: 0o600 }); console.log(`created release signing key ${keyFile} (back it up; never commit it)`);
}
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
