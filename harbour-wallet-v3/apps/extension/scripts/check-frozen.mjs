// The smart-account work must not change the key-handling and boundary code. This fails (and so fails `npm run verify`) when any
// frozen file differs from the base commit. Base: FROZEN_BASE if set, else the first of the pinned branch-point commit and
// `harbour-v3` that exists. (The `harbour-v3` branch predates the apps/ restructure, so its paths differ; the pinned commit is the
// reliable base and `harbour-v3` only a fallback for a clone that lost the commit, where a layout mismatch fails closed.) A missing base or an unreadable file also fails (closed): the check never passes by not being able to look.
//   node scripts/check-frozen.mjs            # check
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FROZEN = [
  'src/core/vaultService.ts', 'src/core/walletService.ts', 'src/core/passworder.ts', 'src/core/passwordService.ts', 'src/core/passwordPolicy.ts',
  'src/core/passkey.ts', 'src/core/passkeyService.ts', 'src/core/secureStore.ts', 'src/core/storage.ts', 'src/core/uiSafe.ts',
  'src/core/provider/evmAccount.ts', 'src/core/provider/protocol.ts',
  'src/background/keys.ts', 'src/background/reauth.ts', 'src/background/secretRender.ts', 'src/background/accessPolicy.ts', 'src/background/clipboard.ts', 'src/background/kernel/port.ts',
  'src/inpage/bridge.ts', 'src/content/content.ts',
];
/** Commit the smart-accounts branch was cut from (documentation/smart-accounts, P0). */
export const BASE_CANDIDATES = ['cd72c53', 'harbour-v3'];

/** Pure: names of files whose working copy differs from the base (or cannot be read). */
export function findChanges(files, readBase, readWork) {
  const bad = [];
  for (const f of files) {
    let a; let b;
    try { a = readBase(f); b = readWork(f); } catch { bad.push(`${f} (unreadable)`); continue; }
    if (a === null || b === null || a === undefined || b === undefined || !Buffer.from(a).equals(Buffer.from(b))) bad.push(f);
  }
  return bad;
}

function outermostRepo(from) {
  let dir = from; let found = null;
  for (;;) { if (existsSync(path.join(dir, '.git'))) found = dir; const up = path.dirname(dir); if (up === dir) break; dir = up; }
  return found;
}
function main() {
  const extRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repo = outermostRepo(extRoot);
  if (!repo) { console.error('FAIL  frozen check: no git repository found'); process.exit(1); }
  const git = (args) => execFileSync('git', ['--git-dir', path.join(repo, '.git'), '--work-tree', repo, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });
  const rel = path.relative(repo, extRoot).split(path.sep).join('/');
  const prefix = rel ? `${rel}/` : '';
  let base = process.env.FROZEN_BASE ? [process.env.FROZEN_BASE] : BASE_CANDIDATES;
  base = base.find((c) => { try { git(['rev-parse', '--verify', `${c}^{commit}`]); return true; } catch { return false; } });
  if (!base) { console.error('FAIL  frozen check: no base commit found (set FROZEN_BASE)'); process.exit(1); }
  const changed = findChanges(FROZEN, (f) => git(['show', `${base}:${prefix}${f}`]), (f) => readFileSync(path.join(extRoot, f)));
  if (changed.length) { console.error(`FAIL  frozen secure code changed since ${base}:\n  ${changed.join('\n  ')}`); process.exit(1); }
  console.log(`PASS  frozen secure code unchanged since ${base} (${FROZEN.length} files)`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
