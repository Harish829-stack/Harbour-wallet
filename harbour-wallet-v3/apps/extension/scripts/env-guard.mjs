// SEC-2026-11-18-01: the extension's .env files are build inputs that live next to the bundle source. A signing key or any other
// secret there is one config change (a VITE_ prefix, an `envPrefix` tweak, a zipped project folder) away from being shipped or shared.
// The build refuses to run while any .env* file in this folder holds a secret-named or private-key-shaped entry. Keep those keys
// offline (outside the repository) and rotate any key that was ever stored here.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SECRET_NAME = /(PRIVATE|SECRET|MNEMONIC|SEED|PASSWORD|PASSPHRASE)/i;
const PUBLIC_NAME = /(PUBLIC|PUBKEY|PUB_KEY)/i;
const KEY_SHAPE = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(xprv|tprv)[1-9A-HJ-NP-Za-km-z]{100,}/;

/** Returns `file: NAME` for every offending entry in the .env* files of `dir` (values are never returned). */
export function envSecrets(dir) {
  const hits = [];
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^\.env(\..+)?$/.test(f) && f !== '.env.example'); } catch { return hits; }
  for (const f of files) {
    let text = '';
    try { text = readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const name = line.slice(0, eq).trim(); const value = line.slice(eq + 1).trim();
      if (!value) continue;
      if ((SECRET_NAME.test(name) && !PUBLIC_NAME.test(name)) || KEY_SHAPE.test(value)) hits.push(`${f}: ${name}`);
    }
  }
  return hits;
}
