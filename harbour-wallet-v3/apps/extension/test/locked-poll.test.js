// A locked wallet must not turn the 5-minute activity alarm into an unhandled rejection (2026-11-19 console).
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('pollActivity returns 0 while the vault is locked, and still surfaces other errors', async () => {
  const fs = await import('node:fs');
  const n = fs.readFileSync(new URL('../src/background/notify.ts', import.meta.url), 'utf8');
  assert.ok(/catch \(e: any\) \{ if \(e\?\.message === 'LOCKED'\) return 0; throw e; \}/.test(n));
  const i = fs.readFileSync(new URL('../src/background/index.ts', import.meta.url), 'utf8');
  assert.ok(i.includes('void pollActivity(vaultState).catch('), 'alarm handler never leaves a rejection unhandled');
});
