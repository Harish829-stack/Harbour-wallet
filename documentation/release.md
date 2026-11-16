# Releasing the extension

The extension ships as a signed zip uploaded to the Chrome Web Store. The backend is deployed separately ([deployment-railway.md](deployment-railway.md)); a release build must point at its public **https** API URL.

## Steps

1. In `apps/extension`, set `VITE_HB_API_URL=https://<api domain>` (and the other values from `.env.example`) in `.env.production`.
2. `npm ci`, then `npm run verify`: lint, type-check, tests, build, audit gate and bundle secret scan.
3. `node scripts/repro.mjs`. It builds twice and must report "reproducible".
4. Bump `version` in `package.json` and `manifest.config.ts`, then commit.
5. `node scripts/release.mjs`. It writes to `releases/`: `harbour-<v>.zip`, `.zip.sha256`, `.zip.sig` and `harbour-<v>.release.json`. It refuses a build whose API URL is localhost or `http://`. Signing uses the Ed25519 release key; see below.
6. Verify: `node scripts/verify-release.mjs releases/harbour-<v>.zip <trusted signer key>`. The pinned signer is `release-signer.pub`.
7. Upload the zip to the Chrome Web Store dashboard using the listing details below.
8. Publish `release.json` and the `.sig` with the release notes so anyone can rebuild from the commit and compare hashes.

## The release key

- **Locally:** the first run creates `harbour-release-key.json` at the repository root. Back it up offline and never commit it (it is git-ignored and blocked by the pre-commit hook). Offline signing: `node scripts/release.mjs --key-file <0600 file outside the repo>`.
- **In CI:** pushing a tag `v*` runs `.github/workflows/extension.yml`: the `verify` job, then a `release` job in the protected `release` environment that signs with the secret `HB_RELEASE_KEY_PEM`. Configure two required reviewers (their logins become `HB_RELEASE_APPROVERS`) and branch protection first; see [security.md](security.md).

## Behaviour changes to put in release notes

Receive, Buy and Fund open the backup flow until the recovery phrase is backed up; auto-lock "Never" does not exist (maximum 4 hours); phishing-listed sites are blocked; site-requested network switches ask for approval; `window.trustwallet` and the `isTrust*` flags are gone (dApps see Harbour through EIP-6963 or `window.ethereum`); biometric unlock needs re-enrolment and requires WebAuthn PRF.

## Chrome Web Store listing

**Name:** Harbour Wallet. **Category:** Productivity.
**Short description:** A self-custodial multi-chain crypto wallet: send, swap, stake and connect to dApps across many networks.
**Single purpose:** manage the user's own crypto assets and sign transactions they approve.

**Permission justifications**

| Permission | Why |
| --- | --- |
| `storage` | the encrypted vault and settings, on this device |
| `alarms` | auto-lock timer, remote-config refresh, incoming-transfer check |
| `notifications` | incoming transfers and announcements, when enabled |
| `gcm` | optional server push for incoming transfers |
| `scripting` | registers the wallet provider script that dApps talk to |
| `sidePanel` | optional side-panel mode |
| `clipboardWrite`, `offscreen` | copying addresses and transaction hashes, and clearing the clipboard |
| `idle` | lock the wallet when the operating system locks the screen |
| host `https://*/*` | inject the wallet provider into pages the user visits and read public blockchain data |

**Data use:** no personal data is collected or sold. Public blockchain addresses are sent to the Harbour backend and to public blockchain APIs to read balances and history, and to the push service only if the user enables push. No analytics by default. **Remote code:** none; remote config is signed data (flags), not code.

**Assets to prepare:** 128x128 icon (exists), 1280x800 screenshots (home, swap, dApp approval, staking, NFTs), a 440x280 small tile, and a privacy policy URL.
