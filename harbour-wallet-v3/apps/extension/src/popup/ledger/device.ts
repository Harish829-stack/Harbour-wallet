// Ledger over WebHID (extension pages only: WebHID is not available in the service worker). Loaded lazily by the screens that need it.
// The device shows and confirms every transaction; Harbour only passes it the unsigned transaction and reads back the signature.
import './bufferShim'; // Buffer global for the Ledger libraries (must evaluate first)
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import Eth, { ledgerService } from '@ledgerhq/hw-app-eth';
import Btc from '@ledgerhq/hw-app-btc';
import Solana from '@ledgerhq/hw-app-solana';

type Transport = Awaited<ReturnType<typeof TransportWebHID.create>>;
export const supported = () => typeof navigator !== 'undefined' && !!(navigator as any).hid;
/** Reuse a device the user already granted; otherwise show Chrome's device chooser (needs a click). */
export async function open(request = false): Promise<Transport> {
  if (!supported()) throw new Error('This browser does not support WebHID. Use Chrome or Edge on desktop.');
  if (!request) { const t = await TransportWebHID.openConnected().catch(() => null); if (t) return t; }
  return TransportWebHID.request();
}
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes: Uint8Array): string {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
  return s;
}
/** Friendly text for the usual device states (locked, wrong app, user rejected). */
export function ledgerError(e: any): string {
  const code = e?.statusCode ?? e?.status;
  if (code === 0x6985 || /denied|rejected/i.test(e?.message ?? '')) return 'You rejected the request on your Ledger.';
  if (code === 0x6e00 || code === 0x6d00 || code === 0x6511 || /CLA_NOT_SUPPORTED|INS_NOT_SUPPORTED|app/i.test(e?.message ?? '')) return 'Open the right app on your Ledger (Ethereum or Bitcoin) and try again.';
  if (code === 0x5515 || /locked/i.test(e?.message ?? '')) return 'Unlock your Ledger with its PIN and try again.';
  if (/blind signing|0x6a80/i.test(e?.message ?? '') || code === 0x6a80) return 'Enable blind signing in the Ethereum app settings on your Ledger for this transaction.';
  if (e?.name === 'NotFoundError' || /No device selected/i.test(e?.message ?? '')) return 'No Ledger selected.';
  return String(e?.message ?? 'Ledger error').slice(0, 200);
}

export async function ethAddress(t: Transport, path: string): Promise<string> { return (await new Eth(t).getAddress(path, false)).address; }
export async function btcAddress(t: Transport, path: string): Promise<string> { return (await new Btc({ transport: t, currency: 'bitcoin' }).getWalletPublicKey(path, { format: 'bech32', verify: false })).bitcoinAddress; }
export async function solAddress(t: Transport, path: string): Promise<string> { return base58(new Uint8Array((await new Solana(t).getAddress(path)).address)); }

/** Signs a serialized unsigned EVM tx (0x...). Clear-signing metadata (tokens, plugins) comes from Ledger's service when available. */
export async function ethSign(t: Transport, path: string, unsignedTx: string): Promise<{ r: string; s: string; v: string }> {
  const raw = unsignedTx.replace(/^0x/, '');
  const resolution = await ledgerService.resolveTransaction(raw, {}, { externalPlugins: true, erc20: true, nft: false }).catch(() => null);
  return new Eth(t).signTransaction(path, raw, resolution);
}
/** Signs a native-segwit spend: inputs are previous transactions + output index; outputs are exactly the prepared ones. */
export async function btcSign(t: Transport, path: string, inputs: Array<{ prevHex: string; vout: number }>, outputs: Array<{ value: string; script: string }>): Promise<string> {
  const btc = new Btc({ transport: t, currency: 'bitcoin' });
  const le8 = (v: string) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); };
  const varint = (n: number) => (n < 0xfd ? n.toString(16).padStart(2, '0') : 'fd' + (n & 0xff).toString(16).padStart(2, '0') + (n >> 8).toString(16).padStart(2, '0'));
  const outputScriptHex = varint(outputs.length) + outputs.map((o) => le8(o.value) + varint(o.script.length / 2) + o.script).join('');
  return btc.createPaymentTransaction({
    inputs: inputs.map((i) => [btc.splitTransaction(i.prevHex, true), i.vout, null, 0xffffffff] as any),
    associatedKeysets: inputs.map(() => path), changePath: path, outputScriptHex, segwit: true, additionals: ['bech32'], sigHashType: 1,
  });
}
export async function close(t: Transport | null | undefined) { try { await t?.close(); } catch { /* already closed */ } }
