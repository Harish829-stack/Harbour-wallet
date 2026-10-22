# Biometric lock / unlock — spec and evidence

Source: Trust Wallet extension 26.41.0 bundle (`chunks/biometrics-CO4_TFG1.js`, `useAvailableBiometricName-lo1nd3PA.js`,
`useAuthenticateWithBiometrics-BLIwCDAo.js`, background `PasskeyService`). Confidence tags: [certain] read from the bundle,
[likely] strong inference, [guessing] fill-in.

## What `lock-unlock-biometric.har` shows
[certain] It contains **no biometric network traffic**. Biometrics are a purely local WebAuthn exchange, so the HAR could not
be used to derive the design. The spec below comes from the bundle; the HAR only confirms that unlock makes no server call.

## TW design
- [certain] WebAuthn resident credential. `rp.id` = page hostname (extension id), `user.id` = 32 random bytes,
  `pubKeyCredParams` ES256 / RS256 / EdDSA, `residentKey: required`, `userVerification: preferred` on create, `required` on get.
- [certain] The 32 random bytes are the secret. The authenticator returns them as `userHandle` after Touch ID / Windows Hello / PIN.
- [certain] Fresh 32-byte challenge per get; `clientDataJSON.challenge` must equal it.
- [certain] Create is followed by an immediate verify (get) that must return the same secret before biometrics are enabled.
- [certain] Background stores the unlock material encrypted under that secret (`passkey:vault`); metadata (credential id) separate.
- [certain] The popup cannot show the OS biometric sheet, so enrol / unlock run in a full extension tab.
- [likely] Auto-trigger of the prompt when the lock screen opens in that tab.

## Harbour implementation
`core/passkey.ts` (WebAuthn wrapper), `core/passkeyService.ts` (seal / unseal), `popup/biometricsUi.tsx`, Security settings switch,
onboarding "Biometrics" option (biometric-only wallet with a generated password), unlock-screen button + "Use password instead".

Deviations (honest): Harbour seals the **derived vault keys** (not the password) under the secret; TW's exact blob format is not
known [guessing]. A wallet created biometric-only cannot disable biometrics (no password to fall back on).

## Verified / not verified
- Verified: 9 unit tests (`test/passkey.test.js`); Chromium E2E with a CDP **virtual** authenticator: enrol, lock, tab unlock,
  password fallback, disable, onboarding biometric-only wallet.
- NOT verified: real Touch ID / Windows Hello hardware; Safari/Firefox; behaviour when the OS credential is deleted outside the wallet.
