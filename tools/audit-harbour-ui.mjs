// UI-only extension audit with a disposable profile. No secrets or form values are saved.
import { chromium } from './toolchain/node_modules/playwright/index.mjs';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'audit/ui/2026-10-19');
const profile = await mkdtemp(path.join(tmpdir(), 'harbour-ui-'));
await mkdir(out, { recursive: true });
const results = [];
let ctx;
try {
  ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    viewport: { width: 1365, height: 900 },
    args: [`--disable-extensions-except=${root}/harbour-wallet-v2/dist`, `--load-extension=${root}/harbour-wallet-v2/dist`] });
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.goto(`chrome-extension://${id}/src/popup/index.html#/onboarding`);
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Create new wallet' }).click();
  await page.getByRole('button', { name: 'Password', exact: true }).click();
  const password = randomBytes(24).toString('base64url');
  await page.locator('input[type=password]').nth(0).fill(password);
  await page.locator('input[type=password]').nth(1).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Open my wallet', exact: true }).waitFor({ timeout: 60000 });
  await page.close();
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto(`chrome-extension://${id}/src/popup/index.html`);
  await page.getByRole('button', { name: 'Crypto', exact: true }).waitFor({ timeout: 60000 });
  async function snap(name) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}.png`, mask: [page.locator('input[type=password],textarea')] });
    const geometry = await page.evaluate(() => ({
      viewport: [innerWidth, innerHeight], bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflow: document.body.scrollWidth > innerWidth,
      missingImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src.split('/').slice(-2).join('/')),
      heading: document.querySelector('.hb-screen')?.textContent?.slice(0, 80) ?? document.body.textContent?.slice(0, 80),
    }));
    results.push({ name, ...geometry });
  }
  async function back() { await page.locator('.hb-screen button').first().click(); }
  async function screen(name, open) { await open(); await snap(name); await back(); }
  await snap('home');
  await page.getByRole('button', { name: 'Send', exact: true }).click(); await snap('send');
  await page.getByTestId('send-to').fill('not-an-address'); await snap('send-invalid');
  await page.getByTestId('send-to').fill(''); await page.getByTestId('send-asset').click(); await snap('send-asset-sheet');
  await page.keyboard.press('Escape');
  if (await page.getByRole('dialog', { name: 'Select asset' }).count()) throw new Error('Send asset sheet did not close on Escape');
  await back();
  await screen('buy', () => page.getByRole('button', { name: 'Fund', exact: true }).click());
  await page.getByRole('button', { name: 'Receive', exact: true }).click(); await snap('receive-select');
  await page.getByRole('button', { name: /Ethereum ETH/ }).first().click(); await snap('receive-qr'); await back(); await back();
  await screen('network-selector', () => page.getByRole('button', { name: 'Networks', exact: true }).click());
  await page.getByRole('button', { name: 'Search', exact: true }).click(); await snap('search');
  await page.getByRole('button', { name: 'DApps', exact: true }).click(); await snap('search-dapps'); await back();
  await page.getByTestId('asset-row').first().click(); await snap('asset-detail'); await back();
  await page.getByRole('button', { name: 'Activity', exact: true }).click(); await snap('activity'); await back();
  await page.getByRole('button', { name: 'Collectibles', exact: true }).click(); await snap('nfts'); await back();
  await page.getByRole('button', { name: 'Trending', exact: true }).click(); await snap('trending-loading');
  await page.locator('.hb-skel').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await snap('trending-settled');
  await page.getByRole('button', { name: 'Swap', exact: true }).last().click(); await snap('swap');
  await page.getByRole('button', { name: 'Earn', exact: true }).click(); await snap('earn');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Select wallet', exact: true }).click(); await snap('wallet-selector'); await back();
  await page.getByRole('button', { name: 'Settings', exact: true }).click(); await snap('settings');
  await page.getByTestId('settings-currency').click(); await snap('currency'); await back();
  await page.getByTestId('settings-preferences').click(); await snap('preferences'); await back();
  await page.getByTestId('settings-color-mode').click(); await snap('color-mode');
  await page.getByText('Dark', { exact: true }).click(); await snap('color-mode-dark'); await back();
  await snap('settings-dark'); await back(); await snap('home-dark');
  await page.setViewportSize({ width: 320, height: 600 }); await snap('home-dark-320');
  await page.setViewportSize({ width: 480, height: 800 }); await snap('home-dark-480');
  await writeFile(`${out}/checks.json`, JSON.stringify({ results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ out, captures: results.length, errors }));
} finally {
  await ctx?.close();
  await rm(profile, { recursive: true, force: true });
}
