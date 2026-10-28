// Run on your own machine:  node scripts/deploy-gateway.mjs [path/to/harbour-keys.env]
// Deploys gateway/worker.ts to Cloudflare Workers, stores the provider keys as Worker secrets, and publishes a signed remote config.
// Needs Node 20+ and network access. Key values are passed to wrangler on stdin and never printed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sub = (args.find((a) => a.startsWith('--subdomain=')) ?? '').split('=')[1];
const envFile = args.find((a) => !a.startsWith('--')) ?? path.join(root, '..', 'harbour-keys.env');
const env = Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
for (const k of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) if (!env[k]) { console.error(`${k} is empty in ${envFile}`); process.exit(1); }

const wrangler = (args, input) => spawnSync('npx', ['--yes', 'wrangler@4.151.2', ...args], { cwd: path.join(root, 'gateway'), input, encoding: 'utf8',
  env: { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID } });

// 1. Config signing key (created once, kept next to the env file; never committed).
const keyFile = path.join(root, '..', 'harbour-config-key.json');
let keys;
if (existsSync(keyFile)) keys = JSON.parse(readFileSync(keyFile, 'utf8'));
else {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  keys = { pub: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'), priv: privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64') };
  writeFileSync(keyFile, JSON.stringify(keys), { mode: 0o600 });
  console.log(`Created config signing key: ${keyFile} (keep it private; add to .gitignore)`);
}
const text = JSON.stringify(JSON.parse(readFileSync(path.join(root, 'config', 'config.json'), 'utf8')));
const pk = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(keys.priv, 'base64')]), format: 'der', type: 'pkcs8' });
const signature = sign(null, Buffer.from(text), pk).toString('base64');

// 1b. workers.dev needs a one-time account subdomain. Register it through the API when --subdomain=<name> is given.
if (sub) {
  const api = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/subdomain`;
  const h = { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
  const cur = await (await fetch(api, { headers: h })).json();
  if (cur?.result?.subdomain) console.log(`workers.dev subdomain already set: ${cur.result.subdomain}`);
  else {
    const put = await (await fetch(api, { method: 'PUT', headers: h, body: JSON.stringify({ subdomain: sub }) })).json();
    console.log(put.success ? `Registered workers.dev subdomain: ${sub}` : `Subdomain registration failed: ${JSON.stringify(put.errors)}`);
    if (!put.success) process.exit(1);
  }
}

// 1b. KV namespace CACHE (price/market cache + push registrations): create once, then bind it in wrangler.toml.
{
  const toml = path.join(root, 'gateway', 'wrangler.toml');
  let t = readFileSync(toml, 'utf8');
  if (!/^kv_namespaces\s*=/m.test(t)) {
    const list = wrangler(['kv', 'namespace', 'list']);
    let id = '';
    try { id = (JSON.parse(list.stdout).find((n) => /CACHE$/.test(n.title)) ?? {}).id ?? ''; } catch { /* not JSON */ }
    if (!id) { const c = wrangler(['kv', 'namespace', 'create', 'CACHE']); id = (c.stdout.match(/[0-9a-f]{32}/) ?? [''])[0]; }
    if (id) { t = t.replace(/^# kv_namespaces = .*$/m, `kv_namespaces = [{ binding = "CACHE", id = "${id}" }]`); writeFileSync(toml, t); console.log(`KV namespace CACHE bound (${id})`); }
    else console.log('KV namespace CACHE could not be created: caching and push stay off');
  }
}

// 2. Deploy, then set secrets (a secret can only be set once the worker exists).
let r = wrangler(['deploy']);
process.stdout.write(r.stdout.replace(/(api[-_]?key=)[^\s&]+/gi, '$1***'));
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const url = (r.stdout.match(/https:\/\/[^\s]+\.workers\.dev/) ?? [])[0];

const secrets = { LIFI_API_KEY: env.LIFI_API_KEY, JUP_API_KEY: env.JUP_API_KEY, COINGECKO_KEY: env.COINGECKO_KEY, HELIUS_API_KEY: env.HELIUS_API_KEY, ALCHEMY_API_KEY: env.ALCHEMY_API_KEY,
  ETHERSCAN_API_KEY: env.ETHERSCAN_API_KEY, TRONGRID_API_KEY: env.TRONGRID_API_KEY, TONCENTER_API_KEY: env.TONCENTER_API_KEY, RELAY_API_KEY: env.RELAY_API_KEY, PIMLICO_API_KEY: env.PIMLICO_API_KEY, FCM_SERVICE_ACCOUNT: env.FCM_SERVICE_ACCOUNT || (env.FCM_SERVICE_ACCOUNT_FILE && existsSync(env.FCM_SERVICE_ACCOUNT_FILE) ? JSON.stringify(JSON.parse(readFileSync(env.FCM_SERVICE_ACCOUNT_FILE, 'utf8'))) : undefined), CONFIG_JSON: text, CONFIG_SIG: signature };
for (const [name, value] of Object.entries(secrets)) {
  if (!value) { console.log(`skip   ${name} (empty)`); continue; }
  const s = wrangler(['secret', 'put', name], value);
  console.log(`${s.status === 0 ? 'secret ' : 'FAILED '} ${name}`);
  if (s.status !== 0) console.error(s.stderr.replace(value, '***'));
}
console.log(`\nGateway: ${url ?? '(see wrangler output above)'}\nAdd to harbour-wallet-v2/.env.production:\nVITE_HB_GATEWAY_URL=${url ?? '<url>'}\nVITE_HB_CONFIG_PUBKEY=${keys.pub}\nVITE_WC_PROJECT_ID=${env.VITE_WC_PROJECT_ID ?? ''}\nVITE_HB_FCM_SENDER_ID=${env.FCM_SENDER_ID ?? ''}\n\nThen check it:  curl ${url ?? '<url>'}/v1/health`);
