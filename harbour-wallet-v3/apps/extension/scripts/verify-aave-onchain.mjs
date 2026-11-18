// Run where RPC works: node scripts/verify-aave-onchain.mjs   (needs viem). Decodes Harbour's data-provider ABI against the live markets.
import {createPublicClient,http} from 'viem';
import {sepolia,baseSepolia} from 'viem/chains';
import {pathToFileURL} from 'node:url';
const dataAbi=[
 {type:'function',name:'getReserveTokensAddresses',stateMutability:'view',inputs:[{type:'address'}],outputs:[{name:'aTokenAddress',type:'address'},{name:'stableDebtTokenAddress',type:'address'},{name:'variableDebtTokenAddress',type:'address'}]},
 {type:'function',name:'getReserveData',stateMutability:'view',inputs:[{type:'address'}],outputs:['unbacked','accruedToTreasuryScaled','totalAToken','totalStableDebt','totalVariableDebt','liquidityRate','variableBorrowRate','stableBorrowRate','averageStableBorrowRate','liquidityIndex','variableBorrowIndex'].map(n=>({name:n,type:'uint256'})).concat([{name:'lastUpdateTimestamp',type:'uint40'}])}];
const poolAbi=[{type:'function',name:'getReservesList',stateMutability:'view',inputs:[],outputs:[{type:'address[]'}]}];
const M=[['Sepolia',sepolia,'0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951','0x3e9708d80f7B3e43118013075F7e95CE3AB31F31',process.env.RPC_SEPOLIA||'https://ethereum-sepolia-rpc.publicnode.com'],
 ['Base Sepolia',baseSepolia,'0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27','0xBc9f5b7E248451CdD7cA54e717a2BFe1F32b566b',process.env.RPC_BASE_SEPOLIA||'https://sepolia.base.org']];
for(const [n,chain,pool,dp,rpc] of M){
 const c=createPublicClient({chain,transport:http(rpc)});
 try{const list=await c.readContract({address:pool,abi:poolAbi,functionName:'getReservesList'});
  const a=list[0];const t=await c.readContract({address:dp,abi:dataAbi,functionName:'getReserveTokensAddresses',args:[a]});
  const d=await c.readContract({address:dp,abi:dataAbi,functionName:'getReserveData',args:[a]});
  console.log(n,'OK reserves',list.length,'| tokens',t,'| getReserveData decoded',d.length,'fields; stableDebt',d[3],'rate',d[7]);
 }catch(e){console.log(n,'FAIL',e.shortMessage||e.message.slice(0,200))}
}
