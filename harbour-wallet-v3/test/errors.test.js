// Raw failures must never reach the screen; internal codes and short human sentences must survive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const out = await build({ entryPoints: [fileURLToPath(new URL('../src/core/errors.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const { userText, friendlyMessage, sanitizeResult } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('HTTP status failures become plain sentences', () => {
  for (const [raw, re] of [['HTTP 404', /isn’t available/], ['HTTP 403', /isn’t available for this request/], ['HTTP 429', /Too many requests/], ['HTTP 503', /temporarily unavailable/], ['Approval scan failed (HTTP 502)', /temporarily unavailable/], ['The RPC answered with HTTP 500.', /temporarily unavailable/]]) {
    const t = userText(raw); assert.match(t, re, raw); assert.ok(!/HTTP|\d{3}/.test(t), t);
  }
});

test('network and technical failures are hidden', () => {
  for (const raw of ['TypeError: Failed to fetch', 'fetch failed', 'circuit open: api.example.com', 'all RPC endpoints failed', "Unexpected token '<', \"<!DOCTYPE\" is not valid JSON", 'Cannot read properties of undefined (reading "x")', 'GET https://api.example.com/v1?key=abc failed']) {
    const t = userText(raw); assert.ok(!/TypeError|fetch failed|circuit|https?:|Unexpected token|undefined|DOCTYPE/.test(t), `${raw} -> ${t}`);
  }
});

test('codes and readable sentences pass through', () => {
  for (const ok of ['LOCKED', 'TOO_MANY_ATTEMPTS', 'needs_key', 'Incorrect password', 'The wallet is locked.', 'Insufficient balance to cover the network fee.']) assert.equal(userText(ok), ok);
  assert.ok(!/^[A-Z_]+$/.test(friendlyMessage('LOCKED')));
});

test('background responses are sanitized, including nested errors, without touching other fields', () => {
  const r = sanitizeResult({ ok: false, error: 'HTTP 404', items: [1], errors: [{ chain: 'eth', error: 'HTTP 403' }], nested: { error: 'LOCKED' } });
  assert.match(r.error, /isn’t available/); assert.match(r.errors[0].error, /isn’t available for this request/);
  assert.equal(r.nested.error, 'LOCKED'); assert.deepEqual(r.items, [1]); assert.equal(r.ok, false);
});
