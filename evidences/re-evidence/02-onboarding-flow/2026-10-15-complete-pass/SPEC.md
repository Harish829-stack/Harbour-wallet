# Onboarding implementation specification — 2026-10-15 continuation

Target: supplied 26.41.0 ZIP (identity in `audit/reference-inventory.json`).
REA module evidence: `REA-result.json`, ev_a2540390838a0b76c3d8967a51cd9c93ec6785a076b7db4036bf4c1920b137a8.
Additional exact background call ranges and navigation: `wallet-onboarding-source-ranges.json`,
`call-REA-result.json`, `call-recovery/`. These supplement, not replace, older specs.
Confidence is per statement below. Recovered output has derived provenance;
correspondence is bound by input hashes and original byte ranges, not name quality.

## Observable contract and execution

- [certain, CODE-AND-RUNTIME-CONFIRMED] First wallet: welcome gates Import and
  Create behind a terms checkbox, with Import first. QR is available independently.
  Full-page welcome has a 504px illustration region at xl widths and a 472px
  action region offset 258px from it. At narrower widths the illustration hides.
  Recovered `onboarding-BHcKddMJ.js` 232–319; runtime scenarios below.
- [certain, CODE-AND-RUNTIME-CONFIRMED] First Create: authentication options →
  Password → password form → create → Completed. Password availability is always
  included. Biometrics options depend on an async capability check, with password
  fallback on failure. `authentication-CGHHMXIG.js` 61–220. Only the password-only
  environment was captured; biometrics persistence/lifecycle is not verified.
- [certain, CODE-CONFIRMED] Create submit: await `setupAuthentication` (SavePassword),
  await `createMnemonic(false)`; wipe input fields and go to Completed.
  `CreatePassword-BarNsCnn.js`. `useSetupAuthentication-EZlruew7.js` 51–134:
  GenerateHDWallet → InitiateImportMnemonic → CompleteImportMnemonic with
  `solanaDerivationType: 'phantom'`, `isMnemonicNewlyGenerated: true`; clear temporary
  private data. Seed backup is deferred. Current Harbour's generate-on-welcome
  and forced immediate phrase grid contradict this path.
- [certain, CODE-CONFIRMED] Background `WalletService.create` reads the session
  password and passes it to `WalletCoreService.generateMnemonicWallet`; wrapper
  calls `HDWallet.create(DEFAULT_STRENGTH, derivedPassword)`. The temporary HD
  object uses that argument, not an inferred empty passphrase. Subsequent
  `Default.prototype.import` reconstructs `HDWallet.createWithMnemonic(mnemonic,'')`
  and populates the StoredKey with `accountForCoin` for the entire supplied list.
  Exact input ranges and new recovery are in this directory. Earlier “empty
  passphrase everywhere” wording must not be applied to the temporary generation
  or intermediate WalletService import wrapper.
- [certain, CODE-CONFIRMED] KeyStore import uses AES-128-CTR and the derived
  password encoded as bytes; first coin is `supportedCoins[0]`, then each
  supported coin is added. Default ordered list contains 128 entries; extras are
  config-driven. Do not substitute Ethereum or silently skip exceptions. New
  generated wallets replace the Solana account via `accountForCoinDerivation`
  using `Derivation.solanaSolana`. Existing derived-password crypto decisions
  remain those in #04–#08; this is their onboarding call boundary.
- [certain, CODE-AND-RUNTIME-CONFIRMED] First Import: authentication → password
  form → source selection. At this point the password is held temporarily; vault
  setup is deferred until actual import submission. Source choices: Trust Wallet
  Mobile, Other mobile wallet or extension; Ledger in a hardware section. Trust
  source adds QR/secret-or-key selection. `SelectImportMethod-ClL8FjcB.js` tail
  and onboarding 157–213; runtime import-other/import-trust/import-ledger.
- [certain, CODE-CONFIRMED] Secret/key entry has wallet name, detection/validation,
  network selection for private keys, and source-specific instructions. Name
  collision is rejected. Seed input is normalized to lowercase before import.
  InitiateImportMnemonic → DeriveSolanaAddress → either automatic single variant
  or explicit variant selection → CompleteImportMnemonic. Imported seed sets
  backup-required false. Duplicate checks and per-chain private-key formats must
  be matched before calling this full route complete.
- [certain, CODE-AND-RUNTIME-CONFIRMED] QR entry: authentication/password →
  “Connect to mobile”, fixed public QR URL `https://link.trustwallet.com/extension_sync`,
  “I completed the scan”. This is a static deep link, not a captured auth token.
  Next page uses desktop camera to scan the mobile-generated payload, with
  permission checks, cleanup and manual import fallback. `import-qr` tail and
  ImportWithQr function. Payload parsing/decryption and password step remain
  UNKNOWN until their dependency paths are traced; do not invent a payload format.
- [certain, CODE-CONFIRMED] Onboarding idle timer: 600000ms, event throttle 500ms,
  starts on mount, resets on cleanup, pauses when `flowCompleted` becomes true.
  `onboarding` Page function. Background auto-lock is a separate later feature.
- [certain, CODE-AND-RUNTIME-CONFIRMED] Completed is a carousel with Start exploring,
  PancakeSwap, side-panel guidance and toolbar pin guidance; Open my wallet invokes
  `openSidePanel`, not forced backup or an invented same-page redirect. Source:
  Completed tail and recovered `window-COx4dq7s.js`. Browser pin/side-panel behavior
  beyond the observed completion screen still needs an integration fixture.

## Presentation, data and boundaries

- [certain] Runtime captures measure Inter, background #fcfcfc, text #0f111a,
  heading 28px/39px bold, form title 24px/34px bold, controls 56px tall. Exact
  rects/styles are recorded in each sanitized runtime JSON. Shared onboarding
  sidebar is 1/3 width with minimum 400px, 305px inner column; main max-width
  716px/min-width 480px and margin-top 130px. Original `OnboardingBoxContent` is
  preserved under recovery/modules. Visual assertions must use these captures.
- [certain] Illustrations are literal Lottie data in target chunks; local
  extraction serializes AST literals without evaluating any target code. Source
  hashes, original byte offsets and output hashes: `asset-provenance.json`.
  The `A/D/H` Completed mappings were checked against EmptyWalletAnimation,
  ConfettiAnimation and WalletCreation. Fonts/banner are byte-identical assets.
  Harbour name/logo are intentional substitutions; animation data and layout
  must not be replaced by generic cards or gradients.
- [certain] Password-policy data is literal target data, not credentials. Shared
  UI defaults are min 8, max 64, case-sensitive common-password list, with error
  precedence short → long → common. Input confirmation must match exactly.
  This is a required dependency of onboarding, not a claim #03 is now fully closed.
- [certain] UI messages in Harbour remain internal implementation interfaces;
  they are not asserted to have Trust's event names. Public inputs must reach
  background-only crypto/storage orchestration through authorized extension UI.
  No real seed/password/private key may be saved in fixtures or logged.

## Verification fixtures and remaining acceptance

`../2026-10-15-runtime/`: create-complete, import-other, import-trust,
import-ledger and qr. Each uses fresh isolated Chromium 141.0.7390.37 at 1365×900.
Entered passwords are generated only in RAM. The create scenario creates one
disposable unfunded wallet and captures Completed; no recovery phrase or password
is captured. Profiles are removed after closing the browser. Inputs' values
are omitted from JSON; textarea/canvas content is masked in current captures.
Earlier import-menu probe timed out due to a harness label error; corrected label
was verified in the successful import-other run. It proves nothing about product failure.

**Build readiness: Partial.** Password-based first-create and public source-routing
UI can be implemented from the evidence above. Full #02 acceptance still requires
secret/key-import differential fixtures including duplicates and Solana selection;
biometrics environments; additional-wallet/max-wallet states; all backup branches;
QR payload/decryption and camera errors; Ledger transport/device boundaries; and
visual comparisons across supported surfaces/themes/viewports. These remain
explicit gaps. Do not advance to #03 or mark #02 Established on the basis of
only the public screens or the first-create path.
