// Builds dapp-full.lib.js: ONE local file with the libraries dapp-full.html needs (no CDN). It bundles the SAME copies Harbour uses,
// straight from harbour-wallet-v3/apps/extension/node_modules (viem, MetaMask's delegation ABIs and the kit's pure /utils entry, never
// the kit root, which carries default-on analytics). Then it writes the file's SRI hash into dapp-full.html so the page refuses a
// changed bundle.
// Same copies = same versions: whatever harbour-wallet-v3/apps/extension/package-lock.json installed.
//
//   node build-dapp-full.mjs                 # uses the extension's esbuild
//   ESBUILD=/path/to/node_modules/esbuild node build-dapp-full.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const ext = join(here, '../../harbour-wallet-v3/apps/extension');
const req = createRequire(join(ext, 'package.json'));
const { build } = req(process.env.ESBUILD ?? 'esbuild');
const ver = (p) => JSON.parse(readFileSync(join(ext, 'node_modules', p, 'package.json'), 'utf8')).version;
const versions = { viem: ver('viem'), '@metamask/delegation-abis': ver('@metamask/delegation-abis'), '@metamask/delegation-core': ver('@metamask/delegation-core'), '@metamask/smart-accounts-kit': ver('@metamask/smart-accounts-kit') };

const entry = `
export { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits, encodeFunctionData, decodeErrorResult, parseAbi, getAddress, isAddress, isHex, maxUint256, pad, zeroAddress } from 'viem';
export { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
export { sepolia, baseSepolia } from 'viem/chains';
export { DelegationManager as DM_ABI } from '@metamask/delegation-abis';
export { decodeDelegations, hashDelegation } from '@metamask/delegation-core';
export { encodeSingleExecution, decodeRevertReason } from '@metamask/smart-accounts-kit/utils';
export const VERSIONS = ${JSON.stringify(versions)};
`;
const out = await build({
  stdin: { contents: entry, resolveDir: ext, loader: 'js' }, bundle: true, format: 'iife', globalName: 'HB', platform: 'browser', target: 'es2020',
  minify: true, write: false, logLevel: 'warning', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `/* dapp-full.lib.js: built by build-dapp-full.mjs from Harbour's own node_modules. ${Object.entries(versions).map(([k, v]) => k + '@' + v).join(', ')}. Do not edit. */` },
});
const js = out.outputFiles[0].text;
// The kit's /utils entry always carries its analytics client (off by default; Harbour's own bundle has the same code). None of the
// functions used here call it, and dapp-full.html blocks every fetch except the two RPCs and Blockscout before this file loads.
if (/metamask\.io/i.test(js) && !/<script>\s*\/\/ Network guard/.test(readFileSync(join(here, 'dapp-full.html'), 'utf8'))) { console.error('Refusing: dapp-full.html lost its network guard.'); process.exit(1); }
writeFileSync(join(here, 'dapp-full.lib.js'), js);
const sri = 'sha384-' + createHash('sha384').update(js).digest('base64');
const htmlPath = join(here, 'dapp-full.html'); const html = readFileSync(htmlPath, 'utf8');
const next = html.replace(/(<script src="dapp-full\.lib\.js" integrity=")[^"]*(")/, `$1${sri}$2`);
if (next === html && !html.includes(sri)) { console.error('dapp-full.html has no <script src="dapp-full.lib.js" integrity="..."> tag to update.'); process.exit(1); }
writeFileSync(htmlPath, next);
console.log(`dapp-full.lib.js ${(js.length / 1024).toFixed(0)} KB, ${sri}\n${JSON.stringify(versions)}`);
