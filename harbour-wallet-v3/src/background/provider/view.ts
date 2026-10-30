// Builds the JSON "view" of a pending request for the approval window: everything the user needs to decide, computed in the background
// (RPC reads, calldata decoding, simulation, fee estimates, risk checks). The UI only renders it; amounts are strings (JSON-safe).
import { formatUnits } from 'viem';
import { DEFAULT_EVM_CHAIN } from '../../core/harbour/policy';
import type { PendingRequest, PermissionStore, KV } from '../../core/provider/store';
import { decodeCalldata, flattenCalls, decodeString, encodeBalanceCall, isUnlimited, SEL, type DecodedCall } from '../../core/provider/decode';
import { summarizeTypedData } from '../../core/provider/typed';
import { parseSiwe, siweIssues } from '../../core/provider/siwe';
import { parseSiws, siwsIssues } from '../../core/provider/siws';
import { describeSolTx, parseSolTx, resolveLookupTables } from '../../core/provider/solanaTx';
import { simulateSolTx, solAccountData } from '../../core/provider/solSim';
import { MULTI_CHAINS } from '../../core/provider/multi';
import { b64ToBytes } from '../../core/provider/base58';
import { displayHost, hostnameOf, isInsecureOrigin, isPunycodeHost } from '../../core/provider/origin';
import { negotiate, summarizeProposal } from '../../core/walletconnect';
import { siteRisk, addressRisk } from '../../core/provider/phishing';
import { readSimulation, simulateParams, NATIVE_PSEUDO } from '../../core/provider/simulate';
import { checkAddress } from '../../kit/clients/securityClient';
import { bytesToHex, hexToBytes, tryUtf8, type TxRequest } from '../../core/provider/methods';
import { feePresets, maxFeeOf, type FeePresets } from './fees';
import type { EvmNetwork } from './networks';
import type { RpcCall } from './rpc';
import type { Signer } from './service';
import { codeKind } from '../../core/evmCode';

export interface ViewDeps { perms: PermissionStore; rpc: RpcCall; networks: { list(): EvmNetwork[]; get(id: number): EvmNetwork | undefined }; signer: Signer; kv: KV; fetch?: typeof fetch; tokenMeta(chainId: number, addr: string): Promise<{ symbol: string; name: string; decimals: number } | null>; probeChainId(url: string): Promise<number>; solRpc?: (method: string, params: unknown[]) => Promise<any> }
const netView = (n: EvmNetwork) => ({ chainId: n.chainId, id: n.id, name: n.name, symbol: n.symbol, testnet: n.testnet, custom: n.custom, explorer: n.explorer ?? null });
const callView = (c: DecodedCall): any => JSON.parse(JSON.stringify(c, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
const MAX_UINT = (1n << 256n) - 1n;

export async function buildView(p: PendingRequest, d: ViewDeps): Promise<any> {
  const host = displayHost(p.origin);
  const risk = await siteRisk(p.origin, d.kv, d.fetch ?? fetch).catch(() => ({ level: 'unavailable' as const }));
  const base: any = {
    id: p.id, kind: p.kind, ns: p.ns, method: p.method, origin: p.origin, host, title: p.title || host, icon: p.icon ?? null, topOrigin: p.topOrigin, embedded: !p.isTopFrame, createdAt: p.createdAt,
    site: { risk: risk.level, insecure: isInsecureOrigin(p.origin), lookalike: isPunycodeHost(hostnameOf(p.origin)) },
  };
  const conn = await d.perms.get(p.origin); const chainId = conn?.chainId ?? DEFAULT_EVM_CHAIN; const net = d.networks.get(chainId);
  base.chain = net ? netView(net) : { chainId, name: `Chain ${chainId}`, symbol: '', testnet: false, custom: false, explorer: null };
  // The site moved the wallet to this request's network just before asking (HW-2026-005): say so on the approval screen.
  const sf = p.params?.switchedFrom; if (typeof sf === 'number') { const from = d.networks.get(sf); base.switchedFrom = from ? netView(from) : { chainId: sf, name: `Chain ${sf}` }; }
  base.account = conn ? { name: conn.accountName, evm: conn.evmAddress ?? null, solana: conn.solanaAddress ?? null, multi: Object.fromEntries(Object.entries(conn.others ?? {}).map(([k, v]) => [k, v.address])), walletName: conn.walletName } : null;
  if (p.ns === 'multi') { const cid = p.params?.chain as string; base.chain = { id: cid, chainId: cid, name: MULTI_CHAINS[cid]?.name ?? cid, symbol: '', testnet: false, custom: false, explorer: null }; }
  switch (p.kind) {
    case 'connect': case 'permissions': case 'solConnect': case 'multiConnect': {
      const w = await d.signer.accounts();
      return { ...base, multiChain: p.kind === 'multiConnect' ? p.params.chain : undefined, walletName: w?.walletName ?? '', accounts: (w?.accounts ?? []).map((a) => ({ index: a.index, name: a.name, evm: a.evm ?? null, solana: a.solana ?? null, multi: a.multi ?? {} })), activeAccount: w?.activeAccount ?? 0,
        lockedIndex: conn && w && conn.walletId === w.walletId ? conn.accountIndex : null, networks: d.networks.list().map(netView), selectedChainId: chainId, requested: p.ns };
    }
    case 'wcSession': {
      const w = await d.signer.accounts(); const active = w?.accounts[conn && w && conn.walletId === w.walletId ? conn.accountIndex : w.activeAccount ?? 0] ?? w?.accounts[0];
      const nets = d.networks.list(); const proposal = p.params.proposal ?? {};
      // Preview for each account: which of the requested networks/methods Harbour would grant (the decision is re-negotiated on approval).
      const preview = (w?.accounts ?? []).map((a) => { const r = negotiate(proposal, { evm: a.evm, solana: a.solana }, nets.map((n) => n.chainId)); return { index: a.index, ok: r.ok, error: r.ok ? null : r.message, chains: r.ok ? Object.values(r.namespaces).flatMap((n) => n.chains) : [], methods: r.ok ? Array.from(new Set(Object.values(r.namespaces).flatMap((n) => n.methods))) : [] }; });
      void active;
      return { ...base, walletName: w?.walletName ?? '', accounts: (w?.accounts ?? []).map((a) => ({ index: a.index, name: a.name, evm: a.evm ?? null, solana: a.solana ?? null })), activeAccount: w?.activeAccount ?? 0,
        lockedIndex: conn && w && conn.walletId === w.walletId ? conn.accountIndex : null, networks: [], selectedChainId: chainId, requested: 'walletconnect',
        wc: { declaredUrl: p.params.declaredUrl ?? null, description: p.params.description ?? null, requested: summarizeProposal(proposal), verify: p.params.verify ?? null, preview, networkNames: Object.fromEntries(nets.map((n) => [`eip155:${n.chainId}`, n.name])) } };
    }
    case 'sign': {
      const n = p.params; const siwe = n.utf8 ? parseSiwe(n.utf8) : null;
      return { ...base, message: { utf8: n.utf8, hex: n.bytesHex, bytes: (n.bytesHex.length - 2) / 2, rawHash: n.rawHash, ethSign: n.method === 'eth_sign' },
        siwe: siwe ? { ...siwe, issues: siweIssues(siwe, { host, address: n.address, chainId }) } : null };
    }
    case 'typed': { const td = p.params.typedData; return { ...base, typed: summarizeTypedData(td), typedData: td, signer: p.params.address }; }
    case 'switchChain': { const to = d.networks.get(p.params.chainId); return { ...base, from: base.chain, to: to ? netView(to) : { chainId: p.params.chainId, name: `Chain ${p.params.chainId}`, symbol: '' } }; }
    case 'addChain': {
      const { chainId: id, network } = p.params;
      const existing = d.networks.get(id);
      if (existing) return { ...base, alreadyAdded: true, network: netView(existing) };
      // The site picked this RPC URL: do not contact it until the user approves (the check runs in the approve step).
      const check = { ok: true, deferred: true };
      return { ...base, known: false, network: { chainId: id, ...network }, rpcCheck: check };
    }
    case 'watchAsset': {
      const { asset, chainId: cid } = p.params; const meta = await d.tokenMeta(cid, asset.address);
      return { ...base, chain: d.networks.get(cid) ? netView(d.networks.get(cid)!) : base.chain, token: { address: asset.address, ...(meta ?? { symbol: '', name: '', decimals: 0 }), verified: !!meta, requestedSymbol: asset.symbol ?? null, requestedDecimals: asset.decimals ?? null, image: asset.image ?? null } };
    }
    case 'tx': return { ...base, ...(await txView(p, d)) };
    case 'multiSign': { const s = p.params.summary; return { ...base, multi: s, ...(s.kind === 'message' ? { message: { utf8: s.text ?? null, hex: s.hex, bytes: (s.hex.length - 2) / 2 } } : {}) }; }
    case 'solSignMessage': {
      const bytes = b64ToBytes(p.params.messageB64); const text = tryUtf8(bytes);
      const siws = text ? parseSiws(text) : null;
      return { ...base, message: { utf8: text, hex: bytesToHex(bytes), bytes: bytes.length }, siwe: siws ? { ...siws, issues: siwsIssues(siws, { host, address: conn?.solanaAddress ?? '' }) } : null };
    }
    case 'solSignTx': case 'solSignAll': case 'solSignSend': {
      const me = conn?.solanaAddress ?? '';
      const txs = await Promise.all((p.params.transactions as string[]).map(async (t) => {
        try {
          const bytes = b64ToBytes(t); let tx = parseSolTx(bytes); const rpc = d.solRpc;
          if (rpc) tx = await resolveLookupTables(tx, (a) => solAccountData(rpc, a));
          const v: any = { ok: true, ...describeSolTx(bytes, me, tx) };
          if (rpc && me) {
            const sim = await simulateSolTx(rpc, bytes, me);
            v.simulation = { ok: sim.ok, error: sim.error ?? null, solDelta: sim.solDelta === undefined ? null : sim.solDelta.toString() };
            if (!sim.ok && !v.warnings.includes('simulationFailed')) v.warnings = [...v.warnings, 'simulationFailed'];
          }
          return v;
        } catch { return { ok: false }; }
      }));
      return { ...base, solTransactions: txs, send: p.kind === 'solSignSend' };
    }
  }
  return base;
}

async function txView(p: PendingRequest, d: ViewDeps) {
  const { tx, chainId } = p.params as { tx: TxRequest; chainId: number }; const net = d.networks.get(chainId)!; const warnings = new Set<string>();
  const decoded = decodeCalldata(tx.data); const value = BigInt(tx.value);
  const out: any = { from: tx.from, to: tx.to ?? null, value: value.toString(), valueFormatted: formatUnits(value, net.decimals), symbol: net.symbol, data: tx.data, dataBytes: (tx.data.length - 2) / 2, call: callView(decoded), dappGas: tx.gas ?? null, nonce: tx.nonce ? Number(BigInt(tx.nonce)).toString() : null, network: netView(net) };
  if (!tx.to) warnings.add('contractCreation');
  if (tx.to && /^0x0{40}$/i.test(tx.to)) warnings.add('zeroAddress');
  if (tx.nonce) warnings.add('customNonce');
  // contract?
  // EIP-7702 smart accounts are wallets: not "a contract", but calling them with data is legitimate (no data-to-wallet warning).
  let isContract: boolean | null = null; let delegated = false;
  if (tx.to) { try { const k = codeKind(await d.rpc(chainId, 'eth_getCode', [tx.to, 'latest'])); isContract = k === 'unknown' ? null : k === 'contract'; delegated = k === 'delegated'; } catch { isContract = null; } }
  out.toIsContract = isContract;
  // lending pool calls (Aave-style): show the asset and amount, and warn when the position belongs to someone else
  if (decoded.kind === 'lend') {
    const meta = await d.tokenMeta(chainId, decoded.asset).catch(() => null);
    out.token = meta ? { address: decoded.asset, ...meta } : { address: decoded.asset, symbol: '', name: '', decimals: 0, unknown: true };
    out.tokenAmount = { raw: decoded.amount.toString(), formatted: meta ? formatUnits(decoded.amount, meta.decimals) : null, unlimited: decoded.amount >= (1n << 255n) };
    if (decoded.beneficiary.toLowerCase() !== tx.from.toLowerCase()) warnings.add('lendOtherAccount');
  }
  // token context for ERC-20 style calls
  if (tx.to && (decoded.kind === 'transfer' || decoded.kind === 'approve' || decoded.kind === 'transferFrom' || decoded.kind === 'permit')) {
    const meta = await d.tokenMeta(chainId, tx.to); out.token = meta ? { address: tx.to, ...meta } : { address: tx.to, symbol: '', name: '', decimals: 0, unknown: true };
    const amt = decoded.kind === 'transfer' ? decoded.amount : decoded.kind === 'approve' ? decoded.amount : decoded.kind === 'permit' ? decoded.value : decoded.amountOrId;
    out.tokenAmount = { raw: amt.toString(), formatted: meta ? formatUnits(amt, meta.decimals) : null, unlimited: isUnlimited(amt) };
    if (decoded.kind === 'approve' && !decoded.decrease && !decoded.increase && meta) {
      out.limitEditable = true;
      try { out.tokenBalance = BigInt(await d.rpc(chainId, 'eth_call', [{ to: tx.to, data: encodeBalanceCall(tx.from) }, 'latest'])).toString(); } catch { /* balance unavailable */ }
    }
    if (decoded.kind === 'approve' && !decoded.decrease) {
      if (isUnlimited(amt)) warnings.add('unlimitedApproval');
      else if (meta) { try { const bal = BigInt(await d.rpc(chainId, 'eth_call', [{ to: tx.to, data: encodeBalanceCall(tx.from) }, 'latest'])); if (amt > bal * 10n && amt > 0n) warnings.add('excessiveApproval'); } catch { /* balance unavailable */ } }
      if (decoded.increase) warnings.add('increaseAllowance');
      if (value > 0n) warnings.add('approvalNativeValue');
    }
    if (decoded.kind === 'transfer' || decoded.kind === 'transferFrom') warnings.add('tokenTransfer');
    if (decoded.kind === 'transfer' && tx.to.toLowerCase() === decoded.to.toLowerCase()) warnings.add('toTokenContract');
  }
  { const inner = flattenCalls(decoded);
    if (decoded.kind === 'multicall') { if (decoded.truncated || inner.some((x) => x.kind === 'unknown')) warnings.add('unknownInner'); }
    for (const x of inner) {
      if (x.kind === 'permit2Approve') { warnings.add('permit2Approve'); if (isUnlimited(x.amount)) warnings.add('unlimitedAllowance'); }
      if (decoded.kind === 'multicall' && (x.kind === 'approve' || x.kind === 'permit') && !(x as any).decrease) warnings.add('hiddenApproval');
      if (decoded.kind === 'multicall' && x.kind === 'setApprovalForAll' && x.approved) warnings.add('hiddenApproval');
    } }
  if (decoded.kind === 'setApprovalForAll') warnings.add(decoded.approved ? 'setApprovalForAll' : 'revokeApprovalForAll');
  if (decoded.kind === 'unknown' && isContract === false && !delegated) warnings.add('dataToEoa');
  // balance, gas, fees
  let balance: bigint | null = null; try { balance = BigInt(await d.rpc(chainId, 'eth_getBalance', [tx.from, 'latest'])); } catch { /* unavailable */ }
  out.balance = balance === null ? null : balance.toString();
  let gas: bigint | null = tx.gas ? BigInt(tx.gas) : null; let sim: { ok: boolean; error?: string } = { ok: true };
  try { const est = BigInt(await d.rpc(chainId, 'eth_estimateGas', [{ from: tx.from, ...(tx.to ? { to: tx.to } : {}), value: tx.value, data: tx.data }])); out.gasEstimate = est.toString(); if (gas === null) gas = est + est / 5n; }
  catch (e: any) { sim = { ok: false, error: String(e?.message ?? 'Simulation failed').slice(0, 200) }; warnings.add('simulationFailed'); }
  out.simulation = sim; out.gasLimit = gas === null ? null : gas.toString();
  // asset-change preview (eth_simulateV1 + traceTransfers) and address reputation (GoPlus) for the target and any approval spender
  const [simV1, toRisk, spenderRisk] = await Promise.all([
    d.rpc(chainId, 'eth_simulateV1', simulateParams({ from: tx.from, to: tx.to ?? undefined, value: tx.value, data: tx.data, gas: tx.gas })).then((r) => readSimulation(r, tx.from)).catch(() => null),
    tx.to ? checkAddress(chainId, tx.to).catch(() => null) : Promise.resolve(null),
    (decoded.kind === 'approve' || decoded.kind === 'setApprovalForAll' || decoded.kind === 'permit') && (decoded as any).spender ? checkAddress(chainId, (decoded as any).spender).catch(() => null)
      : decoded.kind === 'setApprovalForAll' && (decoded as any).operator ? checkAddress(chainId, (decoded as any).operator).catch(() => null) : Promise.resolve(null),
  ]);
  if (simV1) {
    out.assetChanges = await Promise.all(simV1.changes.slice(0, 12).map(async (ch) => {
      if (ch.kind === 'native' || ch.token === NATIVE_PSEUDO) return { ...ch, symbol: net.symbol, decimals: net.decimals, formatted: formatUnits(BigInt(ch.amount), net.decimals) };
      const meta = ch.kind === 'erc20' ? await d.tokenMeta(chainId, ch.token).catch(() => null) : null;
      return { ...ch, symbol: meta?.symbol ?? (ch.kind === 'nft' ? 'NFT' : ''), decimals: meta?.decimals ?? 0, formatted: meta ? formatUnits(BigInt(ch.amount), meta.decimals) : ch.amount };
    }));
    if (!simV1.ok) warnings.add('simulationFailed');
  } else if (tx.data && tx.data !== '0x') out.simulationUnavailable = true;
  if (toRisk?.risky || (tx.to && (await addressRisk(tx.to, d.kv, d.fetch ?? fetch)) === 'scam')) { warnings.add('maliciousAddress'); out.addressFlags = toRisk?.flags ?? ['scamsniffer']; }
  if (spenderRisk?.risky) { warnings.add('maliciousSpender'); out.spenderFlags = spenderRisk.flags; }
  let fees: FeePresets | null = null; try { fees = await feePresets(chainId, d.rpc); } catch { fees = null; }
  out.fees = fees && { eip1559: fees.eip1559, presets: Object.fromEntries(Object.entries(fees.presets).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, (b as bigint).toString()]))])) };
  if (fees && gas !== null) {
    const level = tx.maxFeePerGas || tx.gasPrice ? null : 'average';
    const dappFee = BigInt(tx.maxFeePerGas ?? tx.gasPrice ?? '0x0');
    const per = level ? maxFeeOf(fees.presets.average) : dappFee;
    out.defaultFeeLevel = level; out.estimatedFee = (gas * per).toString(); out.estimatedFeeFormatted = formatUnits(gas * per, net.decimals);
    if (balance !== null && value + gas * per > balance) warnings.add('insufficientFunds');
  } else if (balance !== null && value > balance) warnings.add('insufficientFunds');
  out.warnings = [...warnings];
  void SEL; void decodeString; void MAX_UINT; void hexToBytes;
  return out;
}
