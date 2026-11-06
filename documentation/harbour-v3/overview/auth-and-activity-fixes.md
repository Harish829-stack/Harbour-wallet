# Harbour v3: biometric + password unlock, and single-network Activity (2026-10-30)

Branch `harbour-v3`, extension in `harbour-wallet-v3/`. Two findings, both fixed.

## Finding 1. A biometrics-only wallet cannot unlock for a dApp request

**What happened.** Onboarding offered "Touch ID / Windows Hello" as an alternative to a password. Choosing it made the worker generate a random password and seal it under the passkey; the user never saw or knew a password. When the wallet auto-locked and a dApp asked to connect or sign, the approval window (`features/provider.tsx`) showed only a password field. A biometric-only user had nothing to type, so they could not unlock and could not sign.

**Root causes.**

1. The approval window's lock screen had no biometric option (the main popup lock screen did).
2. Biometrics were allowed to be the *only* credential. If the authenticator is unavailable (different browser profile, OS prompt dismissed, device change), the wallet is unrecoverable except by the recovery phrase.

**Industry standard.** Mainstream self-custody wallets make a password mandatory and offer biometrics as an optional convenience on top of it. NIST SP 800-63B also says a biometric is not a standalone authenticator. So the rule adopted is: a wallet always has a user-chosen password; biometrics are an optional second way to unlock; every surface that asks for the password also offers biometrics when they are set up.

**Fix.**

| Area | Change |
| --- | --- |
| Onboarding (`popup/onboarding/Onboarding.tsx`) | The "Select an option" step is gone. Every new wallet creates a password. When the device supports biometrics, the password step shows a checkbox "Also unlock with Touch ID. Your password always works too" (on by default). Biometrics are registered first, then the wallet is created with `{ password, passkey }`; cancelling the OS prompt keeps the user on the form with a clear message. |
| Worker (`background/modules/wallet.ts`, `handlers/onboardingExtra.ts`) | `generatedPassword` is refused for new wallets. Every `enrollPasskey` call records `isPasswordGenerated: false`. |
| dApp approval window (`features/provider.tsx`) | The locked screen offers "Unlock with biometrics" and the password field. After unlocking, the request is shown for review as before; unlocking does not approve it. |
| Existing biometric-only wallets | New worker message `passkeyAddPassword` and `VaultService.setPassword()` (`core/vaultService.ts`). The user picks a password; the biometric prompt proves identity and supplies the passkey secret. Every password-encrypted blob (vault, keystores, perps agent keys, prediction credentials) is re-keyed under the new Argon2id keys and the biometric blob is re-sealed under the new keys, all in one storage write, so biometrics keep working and any failure leaves the wallet unchanged. UI entry points: Settings > Security > "Add a password" and a banner on Home. Both open a full tab because the OS biometric sheet closes a popup. |
| Shared code | `migrateToV2` and `setPassword` share one `rekeyAll()` so the re-key rules live in one place. |

**Not changed / out of scope.** There is still no general "change password" feature; `setPassword` only upgrades a password-less (biometric-only) wallet. Turning biometrics off is allowed once the wallet has a password.

**Tests.** `test/key-schedule.test.js` gained a case: add a password to a biometric-only wallet, then check keystores and agent keys open only with the new key, the biometric blob is re-sealed and no longer marked password-less, the new password unlocks, the old one does not, and a locked wallet is refused.

## Finding 2. Activity mixed every network

**What happened.** The Activity screen fetched the history of every visible network at once (up to 150 requests, 8 at a time) and merged them into one feed with filter chips. It was slow, noisy and mixed chains.

**Fix (`popup/wallet/screens.tsx`, `core/activityFeed.ts`).**

- History shows **one selected network**. It starts on the network chosen on Home.
- With no network chosen (Home on "All networks"), the screen shows a large **search icon** and "Choose a network". Tapping it opens the same searchable, grouped network picker used elsewhere (Popular / Custom / All / Testnets).
- Once a network is chosen, a header search icon and the network chip change it.
- Only that network is queried (one request per open or per backend push), stale answers for a network the user already left are ignored, and failures show a retry.
- Product rule unchanged: rows are still limited by the background filter (native coin, own swaps and contract calls, transfers of added tokens and NFTs).
- New pure helper `resolveActivityChain()`; the old merge, chips and ordering helpers stay in `core/activityFeed.ts` and keep their tests.

## Verification

`tsc --noEmit` and `eslint` (max warnings 0) pass on all changed files. Node tests for key schedule, activity feed, passkey, re-auth gate, multi-wallet, provider, vault throttle, onboarding rules and UI secrets pass. Two test files report a cleanup error only (`EPERM` deleting their own temp file on the sandboxed mount); their assertions pass. Chrome was not driven by hand, so run through these flows once before release:

1. New install, password + Touch ID checkbox on, then lock and unlock with each.
2. dApp connect while locked: biometrics button and password both work.
3. A wallet created before this change: "Add a password" banner, then unlock with the password after a lock.
4. Activity with Home on "All networks" shows the search prompt; picking a network shows only its history.
