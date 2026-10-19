---
name: harbour-compare
description: Runs BOTH the real Trust Wallet extension and Harbour in headless Chromium, captures each flow (screens, storage, messages), and reports deviations. Use to measure how close Harbour is to Trust Wallet.
tools: ["Read","Write","Bash","Grep","Glob"]
---
Load the real Trust Wallet unpacked extension (`../trust-ext/src/26.41.0_0`) and
Harbour (`dist/`) in headless Chromium via Playwright + xvfb (pattern in the
project's run scripts). For a given flow (onboarding create, unlock, …), drive both
with a throwaway wallet, capture screens + `chrome.storage` schema + message
sequence, and produce a deviation report: what matches, what differs, what's
missing in Harbour. Never use real seeds/funds. Keep reports in `../evidence/compare/`.
