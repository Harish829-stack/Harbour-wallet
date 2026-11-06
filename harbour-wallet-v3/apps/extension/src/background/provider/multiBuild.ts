// Chain SDK work for the 'multi' provider families: building/simulating/broadcasting Sui and Aptos transactions and TON Connect (wallet v4r2 identity, ton_proof, transfers).
// Imported ONLY by the background (the page bundles never see these SDKs); each SDK is loaded on first use.
import * as suiClientMod from '@mysten/sui/client';
import * as aptosMod from '@aptos-labs/ts-sdk';
import * as tonMod from '@ton/ton';
import * as suiTxMod from '@mysten/sui/transactions';
import * as tonCoreMod from '@ton/core';
import { chainById } from '../../core/chains/index';
import type { MultiBackend } from './service';

const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';
const short = (s: string, n = 14) => (s.length > n ? `${s.slice(0, n - 4)}…${s.slice(-3)}` : s);
const BIG = (v: unknown) => { try { return BigInt(v as any); } catch { return 0n; } };

async function suiClient() { const { SuiClient } = suiClientMod; return new SuiClient({ url: SUI_RPC }); }
async function aptosClient() { const sdk = aptosMod; return { sdk, aptos: new sdk.Aptos(new sdk.AptosConfig({ network: sdk.Network.MAINNET })) }; }

// ---------------------------------------------------------------- TON
const tonEndpoints = () => (chainById('ton')?.endpoints ?? ['https://toncenter.com/api/v2']).map((u) => u.replace(/\/+$/, ''));
async function tonApi(path: string, init?: RequestInit): Promise<any> {
  let last: unknown;
  for (const base of tonEndpoints()) { try { const r = await fetch(base + path, { ...init, signal: AbortSignal.timeout(15_000), credentials: 'omit' }); const j: any = await r.json(); if (j?.ok === false) throw new Error(j.error || 'toncenter error'); return j.result; } catch (e) { last = e; } }
  throw last instanceof Error ? last : new Error('TON network unavailable');
}
// @ton/crypto-primitives' browser build reads `window.crypto`; a service worker only has `self`, so give it a minimal shim.
function tonShim() { const g = globalThis as { window?: unknown }; if (g.window === undefined) g.window = { crypto: globalThis.crypto }; }
async function tonWallet(pub: Uint8Array) { tonShim(); const { WalletContractV4 } = tonMod; return WalletContractV4.create({ workchain: 0, publicKey: Buffer.from(pub) }); }

export const multiBackend: MultiBackend = {
  sui: {
    async build(json, sender) {
      const { Transaction } = suiTxMod; const client = await suiClient();
      const tx = Transaction.from(json); tx.setSenderIfNotSet(sender); const bytes = await tx.build({ client });
      const detail: Record<string, string> = { Network: 'Sui mainnet' };
      try {
        const sim = await client.dryRunTransactionBlock({ transactionBlock: bytes });
        detail.Simulation = sim.effects.status.status === 'success' ? 'Succeeds' : `Fails: ${String(sim.effects.status.error ?? '').slice(0, 120)}`;
        const mine = (sim.balanceChanges ?? []).filter((b: any) => b.owner?.AddressOwner === sender);
        if (mine.length) detail['Your balance changes'] = mine.map((b: any) => `${b.amount} ${short(b.coinType, 30)}`).join('; ');
      } catch { detail.Simulation = 'Unavailable'; }
      return { bytes, detail };
    },
    async execute(bytes, signature) {
      const client = await suiClient(); const r = await client.executeTransactionBlock({ transactionBlock: bytes, signature, options: { showEffects: true } });
      return { digest: r.digest, effects: r.effects ?? null };
    },
  },
  aptos: {
    async build(payload, sender, pub) {
      const { sdk, aptos } = await aptosClient();
      const fn = payload.function; if (typeof fn !== 'string' || !/^0x[0-9a-fA-F]+::[A-Za-z0-9_]+::[A-Za-z0-9_]+$/.test(fn)) throw new Error('Unsupported transaction payload.');
      const txn = await aptos.transaction.build.simple({ sender, data: { function: fn as any, typeArguments: payload.type_arguments ?? payload.typeArguments ?? [], functionArguments: payload.arguments ?? payload.functionArguments ?? [] } });
      const detail: Record<string, string> = { Network: 'Aptos mainnet', Function: fn, 'Max gas': String(txn.rawTransaction.max_gas_amount) };
      try { const [sim] = await aptos.transaction.simulate.simple({ signerPublicKey: new sdk.Ed25519PublicKey(pub), transaction: txn }); detail.Simulation = sim.success ? `Succeeds (gas ${sim.gas_used})` : `Fails: ${String(sim.vm_status).slice(0, 120)}`; } catch { detail.Simulation = 'Unavailable'; }
      return { bytes: txn.rawTransaction.bcsToBytes(), detail };
    },
    async submit(raw, pub, sig) {
      const { sdk, aptos } = await aptosClient();
      const transaction = new sdk.SimpleTransaction(sdk.RawTransaction.deserialize(new sdk.Deserializer(raw)));
      const r = await aptos.transaction.submit.simple({ transaction, senderAuthenticator: new sdk.AccountAuthenticatorEd25519(new sdk.Ed25519PublicKey(pub), new sdk.Ed25519Signature(sig)) });
      return { hash: r.hash };
    },
  },
  ton: {
    /** Wallet v4r2 identity for TON Connect: friendly + raw address and the base64 stateInit BOC. The caller checks it against the account's stored address. */
    async identity(pub) {
      tonShim(); const { beginCell, storeStateInit } = tonCoreMod; const w = await tonWallet(pub);
      const stateInit = beginCell().store(storeStateInit(w.init)).endCell().toBoc().toString('base64');
      return { friendly: w.address.toString({ bounceable: false }), raw: w.address.toRawString(), hash: Uint8Array.from(w.address.hash), workchain: w.address.workChain, stateInit };
    },
    sameAddress: async (a, b) => { tonShim(); const { Address } = tonCoreMod; try { return Address.parse(a).equals(Address.parse(b)); } catch { return false; } },
    /** Validate + normalise the dApp's sendTransaction payload. Amounts are nanoton strings; addresses become friendly bounceable-as-given strings. */
    async normalize(raw) {
      tonShim(); const { Address, Cell } = tonCoreMod;
      let p: any; try { p = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('Invalid transaction request.'); }
      if (!p || !Array.isArray(p.messages) || p.messages.length < 1 || p.messages.length > 4) throw new Error('Between 1 and 4 messages are required.');
      const now = Math.floor(Date.now() / 1000); const validUntil = Number(p.valid_until ?? now + 300);
      if (!Number.isFinite(validUntil) || validUntil < now) throw new Error('This request has expired.');
      const messages = p.messages.map((m: any) => {
        let addr; try { addr = Address.parse(String(m.address)); } catch { throw new Error('Invalid recipient address.'); }
        if (!/^\d{1,20}$/.test(String(m.amount))) throw new Error('Invalid amount.');
        for (const k of ['payload', 'stateInit'] as const) if (m[k] !== undefined) { try { Cell.fromBase64(String(m[k])); } catch { throw new Error(`Invalid ${k}.`); } }
        return { address: String(m.address), friendly: addr.toString(), amount: String(m.amount), payload: m.payload as string | undefined, stateInit: m.stateInit as string | undefined, bounce: !/^UQ|^0Q/.test(String(m.address)) };
      });
      return { messages, validUntil: Math.min(validUntil, now + 600) };
    },
    async send(pub, messages, validUntil, signHash) {
      tonShim(); const { Cell, internal, external, beginCell, storeMessage, SendMode, loadStateInit } = tonCoreMod; const w = await tonWallet(pub);
      const info = await tonApi(`/getWalletInformation?address=${encodeURIComponent(w.address.toString())}`); const seqno = Number(info.seqno ?? 0);
      const total = messages.reduce((s, m) => s + BIG(m.amount), 0n); if (BIG(info.balance) < total) throw new Error('Insufficient balance for this request.');
      const transfer = w.createTransfer({
        seqno, timeout: validUntil, sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
        signer: async (cell: any) => Buffer.from(await signHash(Uint8Array.from(cell.hash()))),
        messages: messages.map((m) => internal({ to: m.address, value: BIG(m.amount), bounce: m.bounce, ...(m.payload ? { body: Cell.fromBase64(m.payload) } : {}), ...(m.stateInit ? { init: loadStateInit(Cell.fromBase64(m.stateInit).beginParse()) } : {}) })),
      } as any);
      const msg = external({ to: w.address, init: seqno === 0 ? w.init : undefined, body: await transfer });
      const boc = beginCell().store(storeMessage(msg)).endCell().toBoc().toString('base64');
      await tonApi('/sendBoc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ boc }) });
      return boc;
    },
  },
};
