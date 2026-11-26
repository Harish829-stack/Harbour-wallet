# Swap and Earn services

Harbour's Swap and Earn tabs get their quotes and transaction plans from two backend services. The providers are reached
through their **official public APIs** (the way MetaMask, Trust Wallet and Rabby do it: the wallet talks to its own backend,
the backend talks to the providers). The backend never holds user keys and never signs: every transaction is checked and
signed in the extension.

| Service | Code | Providers (mainnet) | Testnet |
| --- | --- | --- | --- |
| Swap `/v1/swap` | `apps/backend/internal/swapsvc`, `internal/api/swap.go` | LI.FI, Relay, Jupiter, THORChain | Uniswap API (Ethereum Sepolia) |
| Earn `/v1/earn` | `apps/backend/internal/earnsvc`, `internal/api/earn.go` | Lido and Rocket Pool APR (staking itself is native, built and signed in the extension with wallet-core / official ABIs) | Aave V3 via AaveKit (Base Sepolia) |

Provider SDKs are not bundled: the LI.FI, Relay and Aave JavaScript SDKs are built to send transactions themselves (which would
skip Harbour's review and key handling), and the backend is Go. LI.FI's own docs recommend its REST API for backends.

## Endpoints (all signed with the device key)

| Endpoint | What it does |
| --- | --- |
| `GET /v1/swap/providers` | which swap providers are on |
| `POST /v1/swap/quotes` | asks every eligible provider in parallel (12 s cap each) and returns routes in the extension's `SwapRoute` shape |
| `POST /v1/swap/transaction` | a fresh, unsigned transaction for a confirmed route. LI.FI and Jupiter: the client sends only the route's `quoteRef`; the provider object stays on the server (10 min). Relay / THORChain: a fresh quote |
| `POST /v1/swap/status` | settlement of cross-chain swaps (LI.FI, Relay, THORChain) |
| `GET /v1/swap/token` | token lookup (LI.FI) |
| `POST /v1/swap/uniswap/prepare` | testnet swap: Uniswap quote → check_approval → swap |
| `GET /v1/earn/providers` | which earn providers are on |
| `POST /v1/earn/aave/markets`, `POST /v1/earn/aave/transaction` | AaveKit markets and supply / withdraw plans (fixed queries; clients send structured fields only) |
| `GET /v1/earn/apr?provider=lido|rocketpool` | staking APR (cached 10 min, validated) |

## Safety model

The backend is treated as untrusted by the extension. Before anything is signed:

1. **Route screening** (`core/swap/backend.ts`): a route is kept only if it trades exactly the requested assets and amount,
   in one step, with a minimum not looser than the user's slippage. The user's own asset objects are shown.
2. **Provider checks on the provider's own fresh answer**: LI.FI must target the LI.FI Diamond, the decoded calldata must pay
   the user and a bridge must name the confirmed destination chain; LI.FI routes are EVM → EVM only (non-EVM receivers are not
   decodable). Relay contracts must be on Relay's own list, fetched directly from api.relay.link, and approvals are re-encoded for
   the exact amount; cross-chain Relay orders are verified the way Relay documents ("Input Validation"): the order id is
   recomputed (types from `@relay-protocol/settlement-sdk`), the order must pay exactly the sold amount, deliver the bought token
   on the destination chain to the user's own address, refund only to the user, carry no calls, and the deposit to Relay's
   depository must commit to that id from the user's address. THORChain's vault must be confirmed by two independent THORNodes,
   the memo must swap to exactly the confirmed asset (shorthands normalised) and pay the user, and its LIMIT is rewritten to the
   confirmed minimum. Jupiter transactions must have the user as the only signer, use only allow-listed programs and pass a dry
   run that reads token balances: only the sold token may leave and the bought asset must reach the confirmed minimum. Aave
   plans must match the address book, amount and owner.
3. **The confirmed minimum is the floor** (audit H4): whatever a fresh answer says, the signed transaction must guarantee at
   least the minimum the user confirmed (0.1% rounding). If the price moved, the swap is refused with `price_moved` and the user
   quotes again: slippage is never applied twice.
4. **Simulation ("you send X, you get Y")** (`core/swap/simGuard.ts`): the exact calls (approve + swap) are dry-run with
   `eth_simulateV1`. Only the sold asset (up to the sold amount) and the calls' own native value may leave the wallet; a
   same-chain swap must pay at least the confirmed minimum. The confirm screen shows the result; submit enforces it again on its
   own fresh transaction. Only an RPC that does not offer `eth_simulateV1` falls back to steps 1–3 (the screen says so); any
   other simulation failure blocks the swap (`not_verified`). Bridge fees carried as native value are capped per chain and shown.
5. **Worker-held routes** (`core/swap/routeStore.ts`): quotes stay in the service worker; the popup sends only a route id and the
   one-time confirmation the preview issued. Slippage, unlimited approval (only from the user's swap setting) and expiry come from
   worker state. A route can be sent once, one swap at a time.
6. **Signing stays in the service worker**; keys never reach the backend or the popup. Swap fees above a per-chain ceiling are
   never signed (`fee_too_high`). Slippage is capped at 5% (extension and backend).

## Operations

| Variable | Effect |
| --- | --- |
| `LIFI_API_KEY`, `RELAY_API_KEY`, `JUP_API_KEY`, `UNISWAP_API_KEY` | provider keys (Relay, Jupiter and Uniswap are off without their key; LI.FI works keyless at a lower rate limit) |
| `SWAP_DISABLED_PROVIDERS` | switch swap providers off without an extension release, e.g. `relay,thorchain` |
| `EARN_DISABLED_PROVIDERS` | switch earn providers off, e.g. `aave` |
| `EARN_AAVE_CHAINS` | chain ids Aave may be used on (default `84532`, Base Sepolia) |

Provider errors become stable codes (`no_liquidity`, `amount_too_low`, `timeout`, `rate_limited`, ...); provider text is never
passed to users. Redirects from providers are refused so API keys cannot leak, and response bodies are size-capped.

Upstream protection (`swapsvc/guard.go`, earnsvc): identical quote requests within 8 s share one upstream call (cache +
`golang.org/x/sync/singleflight`); a provider failing 3 times in a row is skipped for 30 s; a quote request is charged to the
device rate limit once per provider asked; Aave markets are cached 60 s and APR fetches are de-duplicated. Quote refs and the
cache are in memory: with more than one API replica, give `/v1/swap` session affinity (a lost ref only means "quote again").

Relay's `POST /quote/v2` is deprecated (rate limits reduced from 2027-01-09, retired 2027-02-23): move the backend to
`/quote/v3` before then and re-run the live test (the order checks above are the same).

The old gateway pass-through routes (`/v1/gw/lifi`, `/jup`, `/relay`, `/uniswap`, `/thornode`) are still served for installed
extensions; remove them once every user runs a build with the swap service.

## Live tests

Quotes and unsigned transactions only; nothing is signed or sent.

```sh
cd harbour-wallet-v3/apps/backend
set -a; . ./.env; set +a
HB_LIVE_OUT=/tmp/live go test -tags live -count=1 -v ./internal/swapsvc ./internal/earnsvc
cd ../extension && node scripts/live-swap-check.mjs /tmp/live   # the extension's pre-sign checks on those real answers
```

Run 2026-11-26: LI.FI (same-chain and Arbitrum→Base bridge), Relay (USDC Ethereum→ETH Base, ETH Base→SOL), Jupiter
(SOL→USDC), Uniswap Sepolia (both directions), AaveKit (markets, native supply), Lido and Rocket Pool APR all answered, and all
16 extension pre-sign checks passed on the real answers. THORChain answered "trading is halted" for every pair at the time
(network-wide halt), so its quote → transaction path is still unverified live. Fixed from this run: THORChain memos too long for
BTC (no refund address any more), and a too-strict slippage rounding tolerance that refused a live LI.FI Layerswap bridge.

## Not done yet (needs a person)

- Signed, broadcast swaps with real funds (small amounts) per provider, and THORChain once trading resumes.
- The Sepolia / Base Sepolia QA checklist in the extension.
- Aave on mainnet: the backend supports it per chain (`EARN_AAVE_CHAINS`), but the mainnet Earn screen and the address-book pins
  per chain are not built.
- Independent review of `swapsvc`, `earnsvc`, `simGuard.ts` and the pre-sign checks.
- Routes no longer offered because their destination cannot be verified (audit H1/H2): LI.FI from Solana, and LI.FI bridges to
  Solana or Bitcoin. EVM → Solana still works through Relay (verified order); BTC through THORChain.
- Simulation uses the same RPC that broadcasts; an independent simulation endpoint would remove that single point (audit M4).
- Rocket Pool's deposit pool is confirmed by two RPC operators that must agree (audit H5), not pinned: Rocket Pool upgrades it
  through RocketStorage. A pinned list with an update path is still an option.
