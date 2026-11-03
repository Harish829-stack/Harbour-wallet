# Harbour v3 layout audit — 2026-11-03

Actual production components rendered with an isolated mock transport: 41 screen fixtures at 320, 380, and 480 × 760 pixels. This is layout evidence, not live service or transaction verification. No wallet, credential, secret, or signing operation is used.

- `screens/`: 123 screen captures plus 6 open token-picker captures.
- `combined-results.json`: final geometry results after targeted corrections; 123/123 within viewport, no blank/unknown screens or oversized controls.
- `results.json`: original broad run. Three collectibles fixtures failed because the mock omitted the `errors` list; this was an audit-fixture issue.
- `targeted-results.json`: all 9 rechecks passed after fixing the mock and removing nested padding from password/biometric forms.

Production build and TypeScript validation passed. Representative settings, security, preferences, contact editor, network form, migration, WalletConnect, Home, Earn and token-picker captures were visually inspected. Screenshots of other routes are available for further review; not every state or interaction has been exercised. Dark mode is used for the fixtures, matching the supplied screenshots.

Reproduce from `harbour-wallet-v3`: `node audit/ui-layout/run.mjs`. The harness needs the existing `tools/toolchain` Playwright install and permission to open a localhost listener and isolated browser. Optionally set `HB_LAYOUT_SCREENS` to a comma-separated subset. It bundles into a temporary directory and is excluded from production entry points.

Note: these captures were taken before the later 2026-11-03 consistency,
dropdown, transition and focus pass (see `docs/re/UI-PARITY.md`). The harness
now expects the anchored dropdown (`listbox` / `option` roles) instead of the
earlier picker dialog; re-run it to refresh the screenshots.
