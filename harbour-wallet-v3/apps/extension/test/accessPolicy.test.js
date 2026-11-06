import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/background/accessPolicy.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { isInternalWalletSender } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const id = 'abcdefghijklmnopabcdefghijklmnop';
test('internal popup and onboarding documents can access wallet commands', () => {
  for (const suffix of ['', '#/onboarding']) {
    assert.equal(isInternalWalletSender({ id, url: `chrome-extension://${id}/src/popup/index.html${suffix}` }, id), true);
  }
});
test('content scripts, other extensions and malformed senders cannot access wallet commands', () => {
  for (const sender of [
    { id, url: 'https://example.com', tab: {} },
    { id, url: 'http://localhost/' },
    { id, url: `chrome-extension://${id}/other.html` },
    { id: 'other', url: `chrome-extension://${id}/src/popup/index.html` },
    { id }, {}, { id, url: 'malformed' },
  ]) assert.equal(isInternalWalletSender(sender, id), false);
});
