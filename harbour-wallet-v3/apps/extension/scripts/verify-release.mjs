// Verify a release zip against its .sig and release.json signer:  node scripts/verify-release.mjs releases/harbour-<v>.zip [signerPubB64]
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
const zipPath = process.argv[2]; if (!zipPath) { console.error('usage: verify-release.mjs <zip> [pubkey]'); process.exit(2); }
const zip = readFileSync(zipPath); const sig = Buffer.from(readFileSync(`${zipPath}.sig`, 'utf8').trim(), 'base64');
const meta = JSON.parse(readFileSync(zipPath.replace(/\.zip$/, '.release.json'), 'utf8'));
// The signer must be pinned: argument, HARBOUR_RELEASE_PUBKEY, or release-signer.pub in the repo. release.json is attacker-controllable alongside the zip.
import { existsSync } from 'node:fs';
const pinFile = new URL('../release-signer.pub', import.meta.url);
const pinned = process.argv[3] ?? process.env.HARBOUR_RELEASE_PUBKEY ?? (existsSync(pinFile) ? readFileSync(pinFile, 'utf8').trim() : null);
if (!pinned) { console.error(`No pinned release signer. Put the public key (base64) in release-signer.pub, set HARBOUR_RELEASE_PUBKEY, or pass it as the 2nd argument.\nrelease.json claims: ${meta.signer} (do NOT trust this on its own)`); process.exit(2); }
if (meta.signer && meta.signer !== pinned) { console.error('release.json signer does not match the pinned key'); process.exit(1); }
const pub = pinned;
const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pub, 'base64')]), format: 'der', type: 'spki' });
const okSig = verify(null, zip, key, sig); const okHash = createHash('sha256').update(zip).digest('hex') === meta.sha256;
console.log(`signature ${okSig ? 'OK' : 'BAD'} · sha256 ${okHash ? 'OK' : 'BAD'} · signer ${pub} (pinned)`);
process.exit(okSig && okHash ? 0 : 1);
