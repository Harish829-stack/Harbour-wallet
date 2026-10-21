// Remote-config signing. `node scripts/config-tool.mjs keygen` prints a new Ed25519 key pair (keep the private key offline).
// `node scripts/config-tool.mjs sign config/config.json <privateKeyB64>` prints { config, signature } for the gateway / GitHub Pages.
import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [cmd, file, priv] = process.argv.slice(2);
if (cmd === 'keygen') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  console.log('VITE_HB_CONFIG_PUBKEY=' + publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'));
  console.log('PRIVATE (keep offline)=' + privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64'));
} else if (cmd === 'sign' && file && priv) {
  const text = JSON.stringify(JSON.parse(readFileSync(file, 'utf8')));
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(priv, 'base64')]);
  const key = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  console.log(JSON.stringify({ config: text, signature: sign(null, Buffer.from(text), key).toString('base64') }));
} else { console.error('usage: keygen | sign <config.json> <privateKeyB64>'); process.exit(1); }
