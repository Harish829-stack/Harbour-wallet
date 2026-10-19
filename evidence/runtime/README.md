# Runtime evidence (live extension)
Captured by loading the unpacked extension into headful Chromium (Playwright+xvfb)
with a THROWAWAY wallet (random seed, no funds). See trust-wallet-RE.md §6.
- storage-schema-REDACTED.json — exact storage keys + crypto params (secrets redacted)
- dom-onboarding.json — rendered onboarding UI (testids, buttons, inputs)
- harness-create-wallet.mjs — the Playwright script used
Egress note: the container proxy blocks Trust Wallet API/RPC hosts, so server
responses (balances/prices/RPC) were not captured.
