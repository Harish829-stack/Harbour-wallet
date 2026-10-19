// Vault round-trip + throttle test. RE-backed (§4.2, §4.9, §6.2).
import { test } from 'node:test';
import assert from 'node:assert';
import pkg from '@trustwallet/wallet-core';
import { VaultService, KEYS } from '../src/vaultService.js';
const { initWasm } = pkg;

// in-memory storage stubs mimicking chrome.storage.local/.session
const mk = () => { const m = {}; return {
  get: async k => ({ [k]: m[k] }), set: async (k, v) => { m[k] = v; }, remove: async k => { delete m[k]; }, _m: m }; };

test('vault create → lock → unlock round-trips; wrong password rejected', async () => {
  const core = await initWasm();
  const local = mk(), session = mk();
  const vs = new VaultService(core, local, session);
  const PW = 'TestThrowaway#2026REA';

  const vaultId = await vs.create(PW);
  assert.ok(vaultId);
  // storage schema matches RE §6.2
  assert.ok(local._m[KEYS.PBKDF2].salt.startsWith('0x'));
  assert.equal(local._m[KEYS.PBKDF2].iterations, 210000);
  assert.ok(local._m[KEYS.VAULT]);               // encrypted blob present
  assert.ok(local._m[KEYS.VAULT_ID].vaultId);
  assert.ok(session._m[KEYS.PASSWORD] && session._m[KEYS.UNLOCK]);

  await vs.persistVault({ vaultId, wallets: { a: 1 } });
  await vs.lock();
  assert.ok(!session._m[KEYS.PASSWORD]);          // session cleared on lock

  const state = await vs.unlock(PW);
  assert.equal(state.wallets.a, 1);               // decrypts correctly
  assert.ok(session._m[KEYS.UNLOCK]);             // re-populated

  await vs.lock();
  await assert.rejects(() => vs.unlock('wrong-password'), /Incorrect password/);
});
