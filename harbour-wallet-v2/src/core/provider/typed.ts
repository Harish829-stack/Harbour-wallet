// EIP-712 summary for the approval screen: a readable tree of the message plus detection of token-approval style signatures
// (EIP-2612 permit, DAI permit, Permit2 single/batch/transfer, marketplace orders). Hashing/signing itself is done by viem in the background.
import { isUnlimited } from './decode';

export interface TypedTreeNode { name: string; type: string; value?: string; children?: TypedTreeNode[] }
export type TypedApproval = { token?: string; spender?: string; amount?: string; unlimited: boolean; expires?: string | null; allowed?: boolean; kind: 'permit' | 'daiPermit' | 'permit2' | 'permit2Transfer' | 'order' };
export interface TypedSummary { domain: { name?: string; version?: string; chainId?: string; verifyingContract?: string; salt?: string }; primaryType: string; tree: TypedTreeNode[]; approvals: TypedApproval[]; warnings: Array<'order' | 'unlimited' | 'permit'> }

const MAX_NODES = 500;
const baseType = (t: string) => t.replace(/\[\d*\]$/, '');
function fmt(v: unknown): string { if (v === null || v === undefined) return ''; if (typeof v === 'string') return v.length > 600 ? v.slice(0, 600) + '…' : v; if (typeof v === 'bigint' || typeof v === 'number' || typeof v === 'boolean') return String(v); return JSON.stringify(v).slice(0, 600); }

function build(types: Record<string, Array<{ name: string; type: string }>>, typeName: string, value: any, depth: number, budget: { n: number }): TypedTreeNode[] {
  const fields = types[typeName]; if (!fields || depth > 8) return [];
  const out: TypedTreeNode[] = [];
  for (const f of fields) {
    if (++budget.n > MAX_NODES) break;
    const v = value?.[f.name]; const bt = baseType(f.type); const isArr = /\[\d*\]$/.test(f.type);
    if (isArr && Array.isArray(v)) {
      out.push({ name: f.name, type: f.type, children: v.slice(0, 50).map((x, i) => types[bt] ? { name: `[${i}]`, type: bt, children: build(types, bt, x, depth + 1, budget) } : { name: `[${i}]`, type: bt, value: fmt(x) }) });
    } else if (types[bt] && v && typeof v === 'object') out.push({ name: f.name, type: f.type, children: build(types, bt, v, depth + 1, budget) });
    else out.push({ name: f.name, type: f.type, value: fmt(v) });
  }
  return out;
}
const big = (v: unknown): bigint | null => { try { if (typeof v === 'bigint') return v; if (typeof v === 'number') return BigInt(Math.trunc(v)); if (typeof v === 'string' && /^(0x[0-9a-fA-F]+|\d+)$/.test(v)) return BigInt(v); } catch { /* ignore */ } return null; };
const iso = (v: unknown): string | null => { const n = big(v); if (n === null) return null; if (n === 0n) return null; if (n > 253402300799n) return 'never'; return new Date(Number(n) * 1000).toISOString(); };

export function summarizeTypedData(td: { types: Record<string, Array<{ name: string; type: string }>>; primaryType: string; domain: Record<string, any>; message: Record<string, any> }): TypedSummary {
  const d = td.domain ?? {}; const m = td.message ?? {}; const pt = td.primaryType; const approvals: TypedApproval[] = []; const warnings = new Set<'order' | 'unlimited' | 'permit'>();
  const verifying = typeof d.verifyingContract === 'string' ? d.verifyingContract : undefined;
  if (pt === 'Permit' && 'spender' in m) {
    if ('allowed' in m) approvals.push({ kind: 'daiPermit', token: verifying, spender: String(m.spender), unlimited: m.allowed === true, allowed: m.allowed === true, expires: iso(m.expiry) });
    else { const v = big(m.value); approvals.push({ kind: 'permit', token: verifying, spender: String(m.spender), amount: v?.toString(), unlimited: v !== null && isUnlimited(v), expires: iso(m.deadline) }); }
  } else if (pt === 'PermitSingle' && m.details) {
    const v = big(m.details.amount); approvals.push({ kind: 'permit2', token: String(m.details.token), spender: String(m.spender), amount: v?.toString(), unlimited: v !== null && isUnlimited(v), expires: iso(m.details.expiration) ?? iso(m.sigDeadline) });
  } else if (pt === 'PermitBatch' && Array.isArray(m.details)) {
    for (const x of m.details.slice(0, 20)) { const v = big(x?.amount); approvals.push({ kind: 'permit2', token: String(x?.token), spender: String(m.spender), amount: v?.toString(), unlimited: v !== null && isUnlimited(v), expires: iso(x?.expiration) }); }
  } else if (/^Permit(Batch)?(Witness)?TransferFrom$/.test(pt)) {
    const list = Array.isArray(m.permitted) ? m.permitted : m.permitted ? [m.permitted] : [];
    for (const x of list.slice(0, 20)) { const v = big(x?.amount); approvals.push({ kind: 'permit2Transfer', token: String(x?.token), spender: String(m.spender), amount: v?.toString(), unlimited: v !== null && isUnlimited(v), expires: iso(m.deadline) }); }
  } else if (pt === 'OrderComponents' || pt === 'Order' || /^(Bulk)?Order/.test(pt) && ('offer' in m || 'consideration' in m)) {
    approvals.push({ kind: 'order', unlimited: false }); warnings.add('order');
  }
  if (approvals.some((a) => a.unlimited)) warnings.add('unlimited');
  if (approvals.some((a) => a.kind !== 'order')) warnings.add('permit');
  return {
    domain: { name: d.name === undefined ? undefined : fmt(d.name), version: d.version === undefined ? undefined : fmt(d.version), chainId: d.chainId === undefined ? undefined : fmt(d.chainId), verifyingContract: verifying, salt: d.salt === undefined ? undefined : fmt(d.salt) },
    primaryType: pt, tree: build(td.types, pt, m, 0, { n: 0 }), approvals, warnings: [...warnings],
  };
}
