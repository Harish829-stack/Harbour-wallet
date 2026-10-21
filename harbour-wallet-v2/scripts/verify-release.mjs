// Verify a release zip against its .sig and release.json signer:  node scripts/verify-release.mjs releases/harbour-<v>.zip [signerPubB64]
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
const zipPath = process.argv[2]; if (!zipPath) { console.error('usage: verify-release.mjs <zip> [pubkey]'); process.exit(2); }
const zip = readFileSync(zipPath); const sig = Buffer.from(readFileSync(`${zipPath}.sig`, 'utf8').trim(), 'base64');
const meta = JSON.parse(readFileSync(zipPath.replace(/\.zip$/, '.release.json'), 'utf8'));
const pub = process.argv[3] ?? meta.signer;
const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pub, 'base64')]), format: 'der', type: 'spki' });
const okSig = verify(null, zip, key, sig); const okHash = createHash('sha256').update(zip).digest('hex') === meta.sha256;
console.log(`signature ${okSig ? 'OK' : 'BAD'} · sha256 ${okHash ? 'OK' : 'BAD'} · signer ${pub}${process.argv[3] ? '' : ' (from release.json: compare it with the key you trust)'}`);
process.exit(okSig && okHash ? 0 : 1);
