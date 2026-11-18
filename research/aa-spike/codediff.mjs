// P7 pre-mainnet check: are the contracts Harbour pins the SAME code on every chain it will run on?
// Reads eth_getCode only (no keys, no funds). The pinned addresses are the same on every chain (q7-addresses.json "sepolia" list, plus the
// EntryPoint and the Pimlico paymaster). Run with an RPC for each chain you want to compare; chains without an RPC are skipped:
//   RPC_SEPOLIA=<url> RPC_BASE_SEPOLIA=<url> RPC_MAINNET=<url> RPC_BASE=<url> node research/aa-spike/codediff.mjs
// For each contract it prints size + keccak per chain and, when the code differs, the differing byte ranges. A difference is
// ACCEPTABLE only when it is confined to the immutables the contract bakes in at deployment (the chain id and the EIP-712 domain
// separator, i.e. two short ranges of at most 40 bytes, one of them holding the chain id). Anything else is printed as REVIEW.
import { readFileSync } from 'node:fs';
import { createPublicClient, http, keccak256 } from 'viem';

const addrs = JSON.parse(readFileSync(new URL('./q7-addresses.json', import.meta.url), 'utf8')).sepolia;
const contracts = { ...addrs, EntryPointV07: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', PimlicoVerifyingPaymaster: '0x777777777777AeC03fd955926DbF81597e66834C' };
const chains = [
  { name: 'sepolia', id: 11155111, rpc: process.env.RPC_SEPOLIA }, { name: 'baseSepolia', id: 84532, rpc: process.env.RPC_BASE_SEPOLIA },
  { name: 'mainnet', id: 1, rpc: process.env.RPC_MAINNET }, { name: 'base', id: 8453, rpc: process.env.RPC_BASE },
].filter((c) => { if (!c.rpc) console.log(`skip ${c.name}: set RPC_${c.name.replace(/[A-Z]/g, (m) => '_' + m).toUpperCase()}`); return !!c.rpc; });
if (chains.length < 2) { console.error('Need at least two chains to compare.'); process.exit(2); }

const code = {};
for (const ch of chains) {
  const client = createPublicClient({ transport: http(ch.rpc) });
  const got = await client.getChainId(); if (got !== ch.id) { console.error(`${ch.name}: RPC answered chain ${got}, expected ${ch.id}`); process.exit(2); }
  for (const [name, a] of Object.entries(contracts)) code[`${ch.name}:${name}`] = (await client.getCode({ address: a })) ?? '0x';
}
const bytes = (h) => Buffer.from(h.slice(2), 'hex');
const be = (n) => { let h = n.toString(16); if (h.length % 2) h = '0' + h; return Buffer.from(h, 'hex'); };
function ranges(a, b) {
  const out = []; let start = -1; let last = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (start >= 0 && i - last > 8) { out.push([start, last]); start = i; } else if (start < 0) start = i; last = i; }
  if (start >= 0) out.push([start, last]); return out;
}
let review = 0; let missing = 0;
for (const name of Object.keys(contracts)) {
  console.log(`\n${name} ${contracts[name]}`);
  const base = chains[0]; const baseCode = code[`${base.name}:${name}`];
  for (const ch of chains) {
    const c = code[`${ch.name}:${name}`];
    if (c === '0x') { console.log(`  ${ch.name}: NO CODE`); missing++; continue; }
    console.log(`  ${ch.name}: ${(c.length - 2) / 2} bytes  ${keccak256(c)}`);
  }
  for (const ch of chains.slice(1)) {
    const c = code[`${ch.name}:${name}`]; if (c === '0x' || baseCode === '0x') continue;
    if (c === baseCode) { console.log(`  ${base.name} vs ${ch.name}: IDENTICAL`); continue; }
    const a = bytes(baseCode); const b = bytes(c);
    if (a.length !== b.length) { console.log(`  ${base.name} vs ${ch.name}: REVIEW, different sizes (${a.length} vs ${b.length})`); review++; continue; }
    const rs = ranges(a, b); const total = rs.reduce((n, [s, e]) => n + (e - s + 1), 0);
    const holdsId = rs.some(([s, e]) => [base.id, ch.id].some((id) => { const needle = be(id); const seg = (a.subarray(s, e + 1).includes(needle) || b.subarray(s, e + 1).includes(needle)); return seg; }));
    const ok = rs.length <= 2 && rs.every(([s, e]) => e - s + 1 <= 40) && total <= 64 && holdsId;
    console.log(`  ${base.name} vs ${ch.name}: ${ok ? 'DIFFERS ONLY IN CHAIN-ID / DOMAIN-SEPARATOR IMMUTABLES (acceptable)' : 'REVIEW'}  ranges ${rs.map(([s, e]) => `${s}-${e}`).join(', ')}  (${total} of ${a.length} bytes)`);
    if (!ok) review++;
  }
}
console.log(`\n${missing ? `${missing} contract(s) have NO CODE on a chain: do not pin that chain.` : 'Every pinned contract has code on every chain checked.'}`);
console.log(review ? `${review} comparison(s) need a human look before that chain is pinned.` : 'No unexplained code differences.');
process.exit(missing || review ? 1 : 0);
