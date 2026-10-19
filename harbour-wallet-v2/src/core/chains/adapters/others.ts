// Native-balance adapters for the remaining families. Every adapter: one public endpoint family, never throws, account-not-found => 0.
// Endpoint shapes follow each project's public docs; none were verified live from the build sandbox (egress blocked).
import { simple, getJ, postJ, rpc, unsupported } from './net';
import { toBig, intField, parseDecimal, bech32ToHex20 } from './codec';

const http = (r: { ok: boolean; status: number }) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); };

// Tron: TronGrid POST /wallet/getaccount {address, visible:true} -> {} when the account was never activated, else { balance (SUN) }.
export const tronBalance = simple(async (u, _c, a, f) => {
  const r = await postJ(f, `${u}/wallet/getaccount`, { address: a, visible: true });
  http(r);
  if (!r.body || typeof r.body !== 'object') throw new Error('bad response');
  if (r.body.Error) throw new Error(String(r.body.Error));
  const v = intField(r.text, 'balance');
  return v ?? 0n; // {} (not activated) or an account with no balance field
});

// TON: toncenter v2 GET /getAddressBalance?address= -> { ok, result: "<nanoton>" } (uninitialised wallets answer "0").
export const tonBalance = simple(async (u, _c, a, f) => {
  const r = await getJ(f, `${u}/getAddressBalance?address=${encodeURIComponent(a)}`);
  if (!r.ok || r.body?.ok !== true) throw new Error(r.body?.error ?? `HTTP ${r.status}`);
  return toBig(r.body.result);
});

// Aptos: POST /view 0x1::coin::balance<AptosCoin> (covers coin + paired fungible-asset balances) -> ["<octas>"].
export const aptosBalance = simple(async (u, _c, a, f) => {
  const r = await postJ(f, `${u}/view`, { function: '0x1::coin::balance', type_arguments: ['0x1::aptos_coin::AptosCoin'], arguments: [a] });
  if (r.ok && Array.isArray(r.body)) return toBig(r.body[0]);
  const code = String(r.body?.error_code ?? '');
  if (r.status === 404 || code === 'account_not_found' || code === 'resource_not_found') return 0n;
  throw new Error(r.body?.message ?? `HTTP ${r.status}`);
});

// Sui: JSON-RPC suix_getBalance(owner, "0x2::sui::SUI") -> { totalBalance } (unknown owners report "0").
export const suiBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'suix_getBalance', [a, '0x2::sui::SUI']);
  if (r.error) throw new Error(r.error.message ?? 'RPC error');
  return toBig(r.result?.totalBalance);
});

// NEAR: JSON-RPC query/view_account -> { amount (yoctoNEAR) }; UNKNOWN_ACCOUNT => account does not exist => 0.
export const nearBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'query', { request_type: 'view_account', finality: 'final', account_id: a });
  if (r.error) {
    if (/UNKNOWN_ACCOUNT|does not exist/i.test(JSON.stringify(r.error))) return 0n;
    throw new Error(r.error.message ?? r.error.name ?? 'RPC error');
  }
  if (r.result?.error) { if (/UNKNOWN_ACCOUNT|does not exist/i.test(String(r.result.error))) return 0n; throw new Error(String(r.result.error)); }
  return toBig(r.result?.amount);
}, { last: ['https://free.rpc.fastnear.com'] });

// Algorand: algod-compatible GET /v2/accounts/{addr}?exclude=all -> { amount (microAlgos) }.
export const algorandBalance = simple(async (u, _c, a, f) => {
  const r = await getJ(f, `${u}/v2/accounts/${encodeURIComponent(a)}?exclude=all`);
  if (r.status === 404) return 0n;
  http(r);
  const v = intField(r.text, 'amount');
  if (v === undefined) throw new Error('bad response');
  return v;
});

// XRP Ledger: JSON-RPC account_info -> result.account_data.Balance (drops); error actNotFound => 0.
export const rippleBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'account_info', [{ account: a, ledger_index: 'validated' }]);
  const res = r.result ?? {};
  if (res.status === 'error' || res.error) { if (res.error === 'actNotFound') return 0n; throw new Error(res.error_message ?? res.error ?? 'RPC error'); }
  return toBig(res.account_data?.Balance);
});

// Stellar: Horizon GET /accounts/{id} -> balances[{ asset_type:'native', balance:"12.3456789" }]; 404 => unfunded => 0.
export const stellarBalance = simple(async (u, c, a, f) => {
  const r = await getJ(f, `${u}/accounts/${encodeURIComponent(a)}`);
  if (r.status === 404) return 0n;
  http(r);
  const n = (r.body?.balances ?? []).find((b: any) => b?.asset_type === 'native');
  if (!n) throw new Error('bad response');
  return parseDecimal(n.balance, c.decimals);
});

// Tezos: node RPC GET /chains/main/blocks/head/context/contracts/{addr}/balance -> "<mutez>"; 404 => not allocated => 0.
export const tezosBalance = simple(async (u, _c, a, f) => {
  const r = await getJ(f, `${u}/chains/main/blocks/head/context/contracts/${encodeURIComponent(a)}/balance`);
  if (r.status === 404) return 0n;
  http(r);
  return toBig(typeof r.body === 'string' ? r.body : r.text.replace(/"/g, ''));
});

// Filecoin: Lotus JSON-RPC Filecoin.StateGetActor(addr, null) -> { Balance (attoFIL) }; "actor not found" => 0.
export const filecoinBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'Filecoin.StateGetActor', [a, null]);
  if (r.error) { if (/actor not found/i.test(String(r.error.message))) return 0n; throw new Error(r.error.message ?? 'RPC error'); }
  return toBig(r.result?.Balance);
});

// Waves: node GET /addresses/balance/{addr} -> { balance }
export const wavesBalance = simple(async (u, _c, a, f) => {
  const r = await getJ(f, `${u}/addresses/balance/${encodeURIComponent(a)}`);
  http(r);
  const v = intField(r.text, 'balance');
  if (v === undefined) throw new Error('bad response');
  return v;
});

// VeChain: Thor REST GET /accounts/{addr} -> { balance: "0x…" (wei VET) }
export const vechainBalance = simple(async (u, _c, a, f) => {
  const r = await getJ(f, `${u}/accounts/${encodeURIComponent(a)}`);
  http(r);
  return toBig(r.body?.balance);
});

// eth_getBalance for chains whose public node speaks the Ethereum JSON-RPC dialect but whose addresses are bech32 (Harmony `one1…`, IoTeX `io1…`).
const bech32Eth = (hrp: string) => async (u: string, _c: unknown, a: string, f: any): Promise<bigint> => {
  const r = await rpc(f, u, 'eth_getBalance', ['0x' + bech32ToHex20(a, hrp), 'latest']);
  if (r.error || typeof r.result !== 'string') throw new Error(r.error?.message ?? 'bad response');
  return toBig(r.result);
};
export const harmonyBalance = simple(bech32Eth('one'), { first: ['https://api.harmony.one'] });
export const iotexBalance = simple(bech32Eth('io'), { only: ['https://babel-api.mainnet.iotex.io'] });

// ICON: JSON-RPC icx_getBalance {address} -> "0x…"
export const iconBalance = simple(async (u, _c, a, f) => {
  const r = await postJ(f, u, { jsonrpc: '2.0', id: 1234, method: 'icx_getBalance', params: { address: a } });
  if (!r.ok || typeof r.body?.result !== 'string') throw new Error(r.body?.error?.message ?? `HTTP ${r.status}`);
  return toBig(r.body.result);
});

// Zilliqa: JSON-RPC GetBalance([hex20]) -> { balance (Qa) }; error -5 "Account is not created" => 0. `zil1…` is converted to hex.
export const zilliqaBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'GetBalance', [bech32ToHex20(a, 'zil')]);
  if (r.error) { if (r.error.code === -5 || /not created|not found/i.test(String(r.error.message))) return 0n; throw new Error(r.error.message ?? 'RPC error'); }
  return toBig(r.result?.balance);
});

// MultiversX: gateway GET /address/{erd1…}/balance -> { data: { balance } }
export const multiversxBalance = simple(async (u, _c, a, f) => {
  const r = await getJ(f, `${u}/address/${encodeURIComponent(a)}/balance`);
  http(r);
  if (r.body?.code && r.body.code !== 'successful') throw new Error(r.body.error ?? r.body.code);
  return toBig(r.body?.data?.balance);
});

// Theta: JSON-RPC theta.GetAccount({address, preview:true}) -> { coins: { thetawei, tfuelwei } }; "not found" => 0.
export const thetaBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'theta.GetAccount', [{ address: a, preview: true }]);
  if (r.error) { if (/not found|does not exist/i.test(String(r.error.message))) return 0n; throw new Error(r.error.message ?? 'RPC error'); }
  return toBig(r.result?.coins?.thetawei);
});

// Internet Computer: Rosetta POST /account/balance on the public rosetta host (ledger account identifier = 64-hex string).
export const ROSETTA_ICP = 'https://rosetta-api.internetcomputer.org';
export const icpBalance = simple(async (u, _c, a, f) => {
  const r = await postJ(f, `${u}/account/balance`, { network_identifier: { blockchain: 'Internet Computer', network: '00000000000000020101' }, account_identifier: { address: a } });
  http(r);
  return toBig(r.body?.balances?.[0]?.value);
}, { only: [ROSETTA_ICP] });

// FIO: chain API POST /v1/chain/get_fio_balance {fio_public_key} -> { balance, available (SUF) }; 404 => key unknown => 0.
export const fioBalance = simple(async (u, _c, a, f) => {
  const r = await postJ(f, `${u}/v1/chain/get_fio_balance`, { fio_public_key: a });
  if (r.status === 404) return 0n;
  http(r);
  const v = intField(r.text, 'available') ?? intField(r.text, 'balance');
  if (v === undefined) throw new Error('bad response');
  return v;
});

// Ontology: JSON-RPC getbalance(addr) -> { ont, ong } (ONT is indivisible; registry decimals = 0).
export const ontologyBalance = simple(async (u, _c, a, f) => {
  const r = await rpc(f, u, 'getbalance', [a]);
  if (r.error || typeof r.result !== 'object' || r.result == null) throw new Error(r.error?.message ?? String(r.result ?? 'bad response'));
  return toBig(r.result.ont);
});

export const nimiqBalance = unsupported('no verified public Nimiq (Albatross) JSON-RPC endpoint; nimiq.watch only serves the retired legacy chain');
export const aionBalance = unsupported('Aion mainnet public RPC/explorer endpoints are retired');
