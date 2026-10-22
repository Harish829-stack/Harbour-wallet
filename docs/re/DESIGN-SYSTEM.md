# Harbour design system — 2026-10-16

Implementation: `harbour-wallet-v2/src/popup/design/system.css`, `components.tsx`, and the existing wallet UI kit in `src/popup/wallet/ui.tsx`. The development-only preview is `src/popup/design/Preview.tsx` and is loaded only under `import.meta.env.DEV` with `?design-preview`.

Tokens: ink `#182c30`, deep teal `#145e50`, warm paper `#f6f7f3`, muted text `#5a6e72`, line `#dce4e1`; spacing 4/8/12/16/20/24/32 px; 10–16 px control radii; 140 ms feedback and 220 ms entry. Inter is bundled locally. Financial numbers use tabular numerals. Dark theme overrides and reduced-motion rules live in the same stylesheet.

Shared controls include Brand, Button, labeled PasswordField, Notice, Header, native Dialog, wallet icon buttons, form fields, token rows, sheets, skeletons, and neutral asset fallback. Keyboard focus uses a 3 px visible outline. Buttons expose disabled and busy states. Native Dialog handles Escape. Logos are bundled by a strict known-symbol map; a visual logo never authenticates a token contract.

Validation captured on 2026-10-16: `audit/design/2026-10-16/` has rendered portfolio, send, approval, control, and welcome fixtures, plus 375×600 captures and `checks.json` for validation, dialog dismissal, rejection feedback, overflow, and browser errors. `audit/onboarding-v2/create-complete/` contains captures from the built MV3 extension. Fixture data is explicitly labeled and isolated from production. Production wallet visual and interaction sign-off remains tracked in `UI-PARITY.md`.

## Current theme as found 2026-10-19 (user-updated; read before UI work)

Found by inspecting `src/popup/design/system.css`, `src/popup/theme.ts`, `src/popup/onboarding/onboarding.css`, `ui.tsx`.

- **Popup/wallet palette = Harbour teal** (CSS variables on `:root`, switched by `<html data-theme="light|dark">`):
  light `--hb-ink #182c30`, `--hb-muted #5a6e72`, `--hb-brand #145e50`, `--hb-brand-hover #0e4a40`, `--hb-brand-soft #e9f3ee`,
  `--hb-paper #f6f7f3`, `--hb-surface #fff`, `--hb-line #dce4e1`, `--hb-error #ae3442`, `--hb-success #28734f`.
  Dark overrides: ink `#e6efed`, brand `#2f9d86`, surface `#0f1517`, paper `#182124`, line `#26343a`, error `#f0707d`, success `#47b983`.
  Radius 14px, shadow `0 8px 28px #163c3210`, motion 140ms/220ms, spacing 4/8/12/16/20/24/32, Inter bundled (400–700).
- `src/popup/theme.ts` exports `T` which maps legacy names (`bg, bgAlt, surface, border, text, sub, accent, accentSoft,
  success, error`) onto those variables, so all older screens inherit the theme. New screens must use `T`/`--hb-*`, never hex.
- The colour mode (Light/Dark/System) is a real setting (`settings.colorMode`), applied in `settingsStore.ts`; **onboarding is
  forced to `light`** (`#/onboarding`).
- **Conflict #1 (found):** onboarding has its own palette in `onboarding.css` (`--brand #0500ff` blue, `--ink #0f111a`,
  `--muted #85889d`, `--line #dedee5`, `--surface #fcfcfc`, blue→green gradient shield mark `.ob-brand-mark`). It does not
  use the teal `--hb-*` tokens (only a few `--hb-paper/--hb-brand-soft` references). Onboarding therefore looks different
  from the popup. Decision pending: unify onboarding on the teal tokens (recommended) — tracked as a gap-fill task.
- **Conflict #2 (found):** hard-coded colours remain outside the tokens: backup banner (`#FEF3C7/#FCD34D/#92400E`) in
  `Wallet.tsx`, overlay `rgba(16,17,20,0.4)` in `ui.tsx` sheets, `#fff` text on accent buttons, `#d3e7db/#b8d8c9` borders on
  `.hb-wallet-balance`. These do not follow dark mode fully.
- **Layout facts:** `.hb-root` is fluid, `max-width 480px`, centred; screens are absolutely-positioned overlays
  (`.hb-screen` slide-in 260ms); bottom tabs Home·Trending·Swap·Earn; same HTML entry (`src/popup/index.html`) is used by popup,
  side panel and the full-tab onboarding.
- **Home header shows the literal text "Seed Phrase 1"** (not the active wallet name) — bug to fix.
- `demo/harbour-demo.mp4` (2026-10-16 15:17) is a recorded demo of the current UI; not inspected by tooling.
- Assets: local CC0 crypto/fiat marks + Lucide icons + Lottie JSON/banner extracted from the reference extension in
  `public/reference/` (user said copyright is not a concern); remaining public-asset sources: `trustwallet/assets` logos.

## 2026-10-19 — UI-only verification and corrections

The "Conflict #1" description above was based on the first, legacy rules in `onboarding.css`. Later rules in that same file already remap `--ink`, `--muted`, `--brand`, `--line`, and `--surface` to `--hb-*`. Rendered onboarding is Harbour teal; the earlier blue declarations are dead cascade values, not the active palette. The wallet header also already loaded the active wallet label before this UI pass. Both remain historical findings, not current open defects.

The production asset path was the real icon defect: Vite bundles `public-production/`, while the 82 network images had been downloaded to `public/`. They are now packaged and rendered. `Coin` receives the chain ID on existing selector/detail rows, while unknown assets retain a neutral fallback. The account avatar now uses the same Lucide/teal system. The shared empty state uses a restrained glyph tile, and unconnected financial/dApp surfaces show an honest unavailable state rather than invented quotes, APRs, or holdings. Popup captures at 320, 375, and 480 px and full-page onboarding captures are linked from `UI-PARITY.md`; the user-owned Harbour palette was preserved.
