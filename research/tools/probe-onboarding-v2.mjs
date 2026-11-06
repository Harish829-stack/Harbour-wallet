// Isolated, disposable reference scenarios. Never serialize input values or secrets.
import { chromium } from './toolchain/node_modules/playwright/index.mjs';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, 'tools/browsers');
const scenario = process.argv[2] || 'import-menu';
const kind = process.argv[3] || 'reference';
const profile = await mkdtemp(path.join(tmpdir(), 'rea-onboarding-'));
const output = path.join(root, kind === 'reference' ? 'evidences/re-evidence/02-onboarding-flow/2026-10-16-runtime' : 'evidences/audit/onboarding-v2', scenario);
await mkdir(output, { recursive: true });
let ctx;
try {
  const extension = path.join(root, kind === 'reference' ? 'evidences/extension/reference-26.41.0' : 'harbour-wallet-v2/dist');
  ctx = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    viewport: { width: 1365, height: 900 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  let page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/${kind === 'reference' ? 'home.html' : 'src/popup/index.html'}#/onboarding`);
  await page.getByRole('checkbox').first().waitFor();
  async function capture(name) {
    // Allow the popup's transition to finish; snapshots made immediately after
    // a click captured intermediate opacity/slide frames, not settled UI.
    await page.waitForTimeout(750);
    // All screens reached here are public UI; canvas/textarea are additionally
    // masked to avoid recording a future QR token or an import-field value.
    const hasSecretInput = await page.locator('textarea').evaluateAll(elements => elements.some(e => e.value.length > 0));
    await page.screenshot({ path: path.join(output, name + '.png'), mask: hasSecretInput ? [page.locator('textarea')] : [] });
    const state = await page.evaluate(() => {
      const style = el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, fontFamily: s.fontFamily,
          fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
          color: s.color, background: s.backgroundColor, radius: s.borderRadius };
      };
      return { title: document.title, headings: [...document.querySelectorAll('h1,h2,h3,[data-testid="onboarding-step-title"]')].map(e => ({ text: e.textContent, ...style(e) })),
        buttons: [...document.querySelectorAll('button')].map(e => ({ text: e.innerText, disabled: e.disabled, testid: e.dataset.testid, ...style(e) })),
        inputs: [...document.querySelectorAll('input,textarea')].map(e => ({ type: e.type, placeholder: e.placeholder, testid: e.dataset.testid, ...style(e) })),
        bodyStyle: style(document.body), viewport: { width: innerWidth, height: innerHeight } };
    });
    await writeFile(path.join(output, name + '.json'), JSON.stringify(state, null, 2) + '\n');
  }
  await capture('01-welcome');
  if (scenario === 'qr') {
    await page.getByRole('button', { name: 'Scan QR to sync', exact: true }).click();
    await page.getByRole('button', { name: 'Password', exact: true }).waitFor();
    await capture('02-qr-authentication');
  } else {
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: scenario === 'create-complete' ? 'Create new wallet' : 'I already have a wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Password', exact: true }).waitFor();
    await capture('02-authentication');
  }
  await page.getByRole('button', { name: 'Password', exact: true }).click();
  await page.locator('input[type=password]').first().waitFor();
  await capture('03-password');
  // Valid password is generated solely in RAM, never emitted or saved by this harness.
  const password = randomBytes(24).toString('base64url');
  await page.locator('input[type=password]').nth(0).fill(password);
  await page.locator('input[type=password]').nth(1).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  if (scenario === 'create-complete') {
    await page.getByRole('button', { name: 'Open my wallet', exact: true }).waitFor({ timeout: 60000 });
    await capture('04-completed');
    if (kind === 'harbour') {
      page = await ctx.newPage();
      await page.setViewportSize({width:375,height:600});
      await page.goto(`chrome-extension://${id}/src/popup/index.html`);
      await page.getByRole('button', {name:'Crypto',exact:true}).waitFor({timeout:60000});
      await page.waitForTimeout(9000); // Public balance/market requests either resolve or time out.
      await capture('05-wallet-popup');
      await page.getByRole('button', {name:'Settings',exact:true}).click();
      await capture('06-settings-popup');
      await page.getByTestId('settings-currency').click();
      await capture('07-currency-popup');
    }
  } else if (scenario === 'qr') {
    await page.getByText('Step 2 of 4', { exact: true }).waitFor({ timeout: 15000 });
    await capture('04-qr-instructions');
  } else {
    await page.getByText('Select your existing wallet', { exact: true }).waitFor({ timeout: 15000 });
    await capture('04-import-menu');
    if (scenario !== 'import-menu') {
      const name = scenario === 'import-trust' ? 'Trust Wallet Mobile' : scenario === 'import-ledger' ? 'Ledger' : 'Other mobile wallet or extension';
      await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
      await capture('05-import-choice');
    }
  }
  console.log(JSON.stringify({ scenario, kind, output, captured: true, secrets_recorded: false }));
} finally {
  await ctx?.close();
  await rm(profile, { recursive: true, force: true });
}
