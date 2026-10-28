// Remote-config signing. `node scripts/config-tool.mjs keygen` prints a new Ed25519 key pair (keep the private key offline).
// `HARBOUR_CONFIG_KEY=<privateKeyB64> node scripts/config-tool.mjs sign config/config.json [days]` (or the key on stdin) prints { config, signature } for the gateway / GitHub Pages.
import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [cmd, file, daysArg] = process.argv.slice(2);
// The private key is never passed on the command line (it would land in shell history and `ps`): environment variable or stdin.
const priv = process.env.HARBOUR_CONFIG_KEY || (cmd === 'sign' && !process.stdin.isTTY ? readFileSync(0, 'utf8').trim() : '');
if (cmd === 'keygen') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  console.log('VITE_HB_CONFIG_PUBKEY=' + publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'));
  console.log('PRIVATE (keep offline)=' + privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64'));
} else if (cmd === 'sign' && file && priv) {
  const days = Number(daysArg ?? 30); if (!(days >= 1 && days <= 90)) { console.error('validity must be 1-90 days'); process.exit(1); }
  const now = Math.floor(Date.now() / 1000);
  const text = JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), issuedAt: now, expiresAt: now + days * 86400 });
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(priv, 'base64')]);
  const key = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  console.log(JSON.stringify({ config: text, signature: sign(null, Buffer.from(text), key).toString('base64') }));
} else { console.error('usage: keygen | HARBOUR_CONFIG_KEY=<b64> sign <config.json> [validDays=30]   (key may also be piped on stdin)'); process.exit(1); }
