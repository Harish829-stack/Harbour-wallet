# Harbour Wallet: UI secret boundary ("dumb UI") audit and fixes

Date 2026-10-27. Branch `security/dumb-ui-secrets`. Scope: every extension page (popup, side panel, onboarding tab, dApp approval
window). Rule audited: **the UI never receives a recovery phrase, private key or password from the worker, and does not keep one
it was given by the user** (no React state, no DOM text or attribute, no accessibility name, no storage, no URL/history, nothing
left in page memory after the action).

## 1. How it was audited
- **Static read** of every popup ↔ worker message that carries key material (`src/popup/**`, `src/background/**`).
- **Runtime audit through REA** on the Mac. REA `capture_process_scenario` launched a disposable headless Chromium with the build
  loaded and CDP on 127.0.0.1:9333 (checked with REA `list_browser_targets`), then a one-off Playwright driver over CDP (not kept in
  the repo). The driver imported **freshly generated throwaway secrets** and at 8 checkpoints checked:
  V8 heap of the extension pages after a forced GC, DOM (attributes, text nodes, shadow DOM), accessibility tree, form-control
  values, URL + `history.state`, Web Storage, `chrome.storage.local/.session` (plaintext). Results hold booleans and SHA-256
  fingerprint prefixes only: `evidences/audit/ui-secrets/{baseline,after,functional}/`.
- REA's web-page tools (`inspect_web_page`, `capture_browser_scenario`) accept only HTTP(S) targets, so the `chrome-extension://`
  pages were inspected over CDP by the driver (REA ran the processes and verified the endpoint).

## 2. Result
| Checkpoint | Before (`dist` of HEAD 70efcaf) | After |
|---|---|---|
| Import: phrase typed, before submit | phrase in **DOM text node** (React mirror), accessibility tree, heap; **password in heap** | only the live field itself (see residual R1); no password |
| Import: phrase submitted | **phrase still in heap** | clean |
| Back up: phrase revealed | **phrase + password in heap** (canvas hid the DOM only) | clean (image only) |
| Back up: verify step | **phrase + password in heap** | clean (tiles are images, ids are opaque) |
| Import: private key typed | key in **DOM text node**, accessibility tree, heap | only the live field itself (R1) |
| Import: private key submitted | **key in heap** | clean |
| Private key revealed | key as **DOM text**, accessibility name, heap; **password in heap** | clean (image only) |
| After lock → unlock | **password in heap for the whole session** | clean |

Functional check of the new flows (same one-off driver, CDP virtual WebAuthn authenticator): biometrics-only
onboarding (worker-generated password sealed by the passkey), biometric unlock, backup by tapping the word tiles in order, private
key import, private key shown as an image and copied through the worker. All 5 passed; the offscreen clipboard document closed
itself after the 60 s clear.

Unit tests: `node --test test/*.test.js` 455 pass, 0 fail (new: `test/ui-secrets.test.js`). `tsc --noEmit` clean, `vite build` OK.

## 3. Findings and fixes
| ID | Sev | Finding (before) | Fix |
|---|---|---|---|
| UI-01 | High | `revealMnemonic` returned the phrase; `BackupFlow`/`BackupScreen` kept it in React state and the verify step shuffled the words in the page. `addWallet` returned a new phrase, passed through the nav stack (`presetMnemonic`). `generateMnemonic` + legacy create screens in `App.tsx` handled the phrase in the page. | `revealMnemonic`, `generateMnemonic` removed. New `backupBegin` (handlers/secrets.ts): the worker decrypts the phrase, paints the grid and one tile per word with OffscreenCanvas (`background/secretRender.ts`) and returns only PNGs + opaque chip ids. `backupCheck`/`backupFinish` verify the tapped id order against the words' equality pattern kept in `storage.session` (`core/backupSession.ts`; no words stored). `addWallet` returns `backupGranted` and sets the one-shot reveal grant instead of the phrase. Legacy screens deleted. |
| UI-02 | High | `revealPrivateKey` returned the key; rendered as DOM text; Copy used `navigator.clipboard` from the page. | Returns an image of the key. `copyPrivateKey` copies inside the worker through a background-owned offscreen document (`background/clipboard.ts`, `src/offscreen/clipboard.ts`, dedicated port, `copy` event, no DOM node) and overwrites the clipboard after 60 s. Copy is allowed only within 60 s of the reveal; `secretViewClosed` ends it. New permission `offscreen` (no install warning). Closes F5. |
| UI-03 | High | Controlled inputs: React mirrors a controlled `<textarea>` into its text node and a controlled `<input>` into its `value` attribute, so the phrase / key / passwords sat in the DOM and in state. | All secret fields are uncontrolled (`popup/secureField.tsx`: `useSecretField` → `take()` reads once and clears). Components keep only derived flags (filled, valid, strength, match). Applies to import textarea, `PasswordField`, unlock (popup, onboarding, approval window), reveal gate. |
| UI-04 | Medium | Password retained: onboarding kept the chosen password in `importPassword` until the import finished; the popup unlock kept `pw` in state for the whole session; the reveal gate kept it after success. | Import/QR flows call `onboardingSecure` at the password step: the worker creates the empty vault immediately (TW order SavePassword → import), the UI drops the password. Unlock/reveal fields are read once and cleared. |
| UI-05 | Medium | Biometrics-only wallets: the random password was generated in the page and held with the passkey secret in a ref until the wallet existed. | The worker generates it (`createWallet`/`onboardingSecure` with `generatedPassword: true` + `passkey`) and seals it right away; refused without a passkey; a failed seal removes the vault so nobody is locked out. |
| UI-06 | Low | Import live validation re-read the secret from React state on every keystroke. | `importCheck` in the worker returns only `{kind, valid}`; the field value is read when the check runs and not kept. |
| UI-07 | Low | QR import: the scanned keystores (encrypted with the 6-character code) stayed in the page while the code was typed. | `qrStage` hands them to the worker right after scanning (`storage.session`, 10 min); `qrVerify`/`qrImportAll`/`qrSyncImport` take a `stageId`. |
| UI-08 | Low | Nothing stopped a handler from returning key material to the UI. | `core/uiSafe.ts`: every UI response passes `uiSafe` in `background/index.ts`; a field named mnemonic / seedPhrase / privateKey / secretKey / password / passwordKey / unlockKey / xprv / storedKeys / keystore turns the response into `SECRET_FIELD_BLOCKED` (logged). `test/ui-secrets.test.js` adds static guards (no handler returns key material; the popup never requests it, renders it as text, binds a secret field to state or copies it). |

## 4. Residual risks (by design or outside a page's control)
- **R1 typing**: while the user types an import secret or a password it exists in the field (browser-internal value, the textarea's
  user-agent shadow text, the accessibility value) and briefly in JS when validated/submitted. It is cleared after a successful
  submit. Masked by default; spellcheck/autocomplete off.
- **R2 passkey**: WebAuthn only runs in a document, so the passkey `userHandle` secret passes through the page once per
  enrol/unlock and is sent straight to the worker.
- **R3 pixels**: a revealed phrase/key is an image in the DOM while shown (mounted only after the explicit reveal, dropped when
  leaving). Code running inside the extension could read the pixels, as it could read the screen.
- **R4 clipboard**: a copied key is on the system clipboard for up to 60 s; the clear overwrites whatever is on the clipboard then.
  The offscreen document shares the extension's V8 isolate while copying.
- **R5 worker**: the worker still holds decrypted material while it operates (F4, unchanged; JS strings cannot be zeroed).
- **Behaviour change**: in the import/QR flows the vault is created when the password is chosen; abandoning the import shows the
  existing "Finish setting up / Start over" screen.

## 5. Re-checking
`test/ui-secrets.test.js` runs with the unit tests and fails on any regression of the source rules. For a new runtime check, repeat
section 1 (headless Chromium with the build and CDP, launched through REA; scan heap, DOM, accessibility tree and storage at the same
checkpoints). The evidence of this run is in `evidences/audit/ui-secrets/`.
