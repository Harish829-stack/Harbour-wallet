// Captures only public first-run screens. Never creates a wallet or records secrets.
import { chromium } from './toolchain/node_modules/playwright/index.mjs';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, 'tools/browsers');
const kind = process.argv[2] || 'reference';
const extension = path.join(root, kind === 'reference' ? 'evidences/extension/reference-26.41.0' : 'harbour-wallet-v2/dist');
const output = path.join(root, 'evidences/audit/screens', kind);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'rea-public-ui-'));
let ctx;
try {
  ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1365, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  const expected = `chrome-extension://${id}/${kind === 'reference' ? 'home.html' : 'src/popup/index.html'}#/onboarding`;
  // Observe the install-created tab before opening or navigating anything ourselves.
  const deadline = Date.now() + 15000;
  let installedPages = [];
  while (Date.now() < deadline) {
    installedPages = ctx.pages().filter(p => p.url() === expected);
    if (installedPages.length) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (installedPages.length !== 1) throw new Error(`Expected one install-created onboarding tab, found ${installedPages.length}`);
  const page = installedPages[0];
  await writeFile(path.join(output, '00-install.json'), JSON.stringify({
    expected_url: expected, automatic_onboarding_tabs: installedPages.length,
    chromium: ctx.browser()?.version(), profile: 'new disposable profile',
    manual_navigation: false, wallet_created: false,
  }, null, 2) + '\n');
  await page.getByRole('checkbox').first().waitFor({ timeout: 30000 });
  async function capture(name) {
    await page.screenshot({ path: path.join(output, name + '.png') });
    const state = await page.evaluate(() => ({
      text: document.body.innerText,
      buttons: [...document.querySelectorAll('button')].map(b => ({ text: b.innerText, disabled: b.disabled })),
      inputs: [...document.querySelectorAll('input')].map(i => ({ type: i.type, placeholder: i.placeholder })),
      viewport: { width: innerWidth, height: innerHeight },
    }));
    await writeFile(path.join(output, name + '.json'), JSON.stringify(state, null, 2) + '\n');
  }
  await capture('01-welcome');
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Create( a)? new wallet/i }).click();
  await page.getByRole('heading').first().waitFor();
  await capture('02-create-entry');
  const passwordOption = page.getByRole('button', { name: 'Password', exact: true });
  if (await passwordOption.count()) await passwordOption.click();
  const createPassword = page.getByText('Create password', { exact: true });
  if (await createPassword.count() && await createPassword.first().isVisible()) {
    if (await page.locator('input[type=password]').count() === 0) {
      await createPassword.first().click();
    }
  }
  await page.locator('input[type=password]').first().waitFor({ timeout: 15000 });
  await capture('03-password');
  console.log(JSON.stringify({ kind, output, chromium: ctx.browser()?.version(), wallet_created: false }));
} finally {
  await ctx?.close();
  await rm(profile, { recursive: true, force: true });
}
