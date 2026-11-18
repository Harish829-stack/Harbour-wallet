// Run on a machine with RPC access: node scripts/verify-rocketpool-onchain.mjs  (needs viem)
import {createPublicClient,http,keccak256,encodePacked,parseAbi} from 'viem';
import {mainnet} from 'viem/chains';
const c=createPublicClient({chain:mainnet,transport:http(process.env.RPC||'https://ethereum-rpc.publicnode.com')});
const S='0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46';
const abi=parseAbi(['function getAddress(bytes32) view returns (address)','function symbol() view returns (string)','function getMaximumDepositAmount() view returns (uint256)']);
const k=n=>keccak256(encodePacked(['string','string'],['contract.address',n]));
const reth=await c.readContract({address:S,abi,functionName:'getAddress',args:[k('rocketTokenRETH')]});
const dp=await c.readContract({address:S,abi,functionName:'getAddress',args:[k('rocketDepositPool')]});
console.log('rETH',reth,reth.toLowerCase()==='0xae78736cd615f374d3085123a210448e74fc6393'?'OK':'MISMATCH');
console.log('symbol',await c.readContract({address:reth,abi,functionName:'symbol'}));
console.log('depositPool',dp,'max',await c.readContract({address:dp,abi,functionName:'getMaximumDepositAmount'}));
