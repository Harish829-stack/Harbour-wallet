// Q7: is the MetaMask Delegation Framework deployed on Sepolia and Base Sepolia? Reads eth_getCode only (no keys, no funds).
// Usage: put the framework's per-chain addresses (from MetaMask's own deployment list for the version you intend to pin) in
// q7-addresses.json as { "sepolia": { "DelegationManager": "0x...", "<Enforcer>": "0x..." }, "baseSepolia": { ... } }, then
//   RPC_SEPOLIA=<url> RPC_BASE_SEPOLIA=<url> node q7.mjs
// Prints whether code exists at each address and its keccak hash, so the addresses and code can be pinned in P5.
import { readFileSync } from 'node:fs';
import { createPublicClient, http, keccak256 } from 'viem';
const addrs = JSON.parse(readFileSync(new URL('./q7-addresses.json', import.meta.url), 'utf8'));
const rpc = { sepolia: process.env.RPC_SEPOLIA, baseSepolia: process.env.RPC_BASE_SEPOLIA };
for (const [chain, list] of Object.entries(addrs)) {
  if (!rpc[chain]) { console.log(`${chain}: set RPC_${chain === 'sepolia' ? 'SEPOLIA' : 'BASE_SEPOLIA'}`); continue; }
  const c = createPublicClient({ transport: http(rpc[chain]) });
  for (const [name, a] of Object.entries(list)) {
    const code = await c.getCode({ address: a });
    console.log(`${chain} ${name} ${a}: ${code && code !== '0x' ? `code ${(code.length - 2) / 2} bytes, keccak ${keccak256(code)}` : 'NO CODE'}`);
  }
}
