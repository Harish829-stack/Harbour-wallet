// wrapSigner() in background/provider/index.ts re-exposes every method of createSigner() (signer.ts). A method that is missing there is
// invisible to the provider service: the 7715 permission methods answered "Harbour does not support ..." because grantPermission was not forwarded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const names = (src) => new Set([...src.matchAll(/(?:^|[\s,{])([A-Za-z][A-Za-z0-9]*)\s*:\s*(?:\(|async|\w+\s*=>|\w+\s*\()/gm)].map((m) => m[1]));

test('every signer method is forwarded by wrapSigner', () => {
  const signer = read('../src/background/provider/signer.ts');
  const body = signer.slice(signer.indexOf('return {', signer.indexOf('export function createSigner')));
  const keys = [...body.matchAll(/^ {4}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]);
  assert.ok(keys.includes('sendCalls') && keys.includes('grantPermission'), 'parsed the signer methods');
  const idx = read('../src/background/provider/index.ts');
  const wrap = idx.slice(idx.indexOf('function wrapSigner()'));
  const wrapped = names(wrap);
  for (const k of keys) assert.ok(wrapped.has(k) || new RegExp(`\\b${k}\\s*:`).test(wrap), `wrapSigner does not forward ${k}`);
});
