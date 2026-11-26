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
| `POST /v1/swap/transaction` | a fresh, unsigned transaction for a confirmed route (LI.FI step transaction, a fresh Relay / THORChain quote, a Jupiter swap transaction) |
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
2. **Provider checks on the provider's own fresh answer** (unchanged): LI.FI must target the LI.FI Diamond and the decoded
   calldata must pay the user with the quoted minimum; Relay contracts must be on Relay's own list, fetched directly from
   api.relay.link, and approvals are re-encoded for the exact amount; THORChain's vault must be confirmed by two independent
   THORNodes and the memo must pay the user; Jupiter / LI.FI Solana transactions must have the user as the only signer and pass
   the program allowlist and a dry run; Aave plans must match the address book, amount and owner.
3. **Simulation ("you send X, you get Y")** (`core/swap/simGuard.ts`): the exact calls (approve + swap) are dry-run with
   `eth_simulateV1`. Only the sold asset (up to the sold amount) and the calls' own native value may leave the wallet; a
   same-chain swap must pay at least the confirmed minimum. The confirm screen shows the result; submit enforces it again on its
   own fresh transaction. Networks whose RPC cannot simulate fall back to steps 1–2 and the screen says so.
4. **Signing stays in the service worker**; keys never reach the backend or the popup.

## Operations

| Variable | Effect |
| --- | --- |
| `LIFI_API_KEY`, `RELAY_API_KEY`, `JUP_API_KEY`, `UNISWAP_API_KEY` | provider keys (Relay, Jupiter and Uniswap are off without their key; LI.FI works keyless at a lower rate limit) |
| `SWAP_DISABLED_PROVIDERS` | switch swap providers off without an extension release, e.g. `relay,thorchain` |
| `EARN_DISABLED_PROVIDERS` | switch earn providers off, e.g. `aave` |
| `EARN_AAVE_CHAINS` | chain ids Aave may be used on (default `84532`, Base Sepolia) |

Provider errors become stable codes (`no_liquidity`, `amount_too_low`, `timeout`, ...); provider text is never passed to users.
Redirects from providers are refused so API keys cannot leak, and response bodies are size-capped.

The old gateway pass-through routes (`/v1/gw/lifi`, `/jup`, `/relay`, `/uniswap`, `/thornode`) are still served for installed
extensions; remove them once every user runs a build with the swap service.

## Not done yet (needs a person)

- Live runs: small mainnet swaps per provider (LI.FI on an EVM chain, Relay EVM → Solana, THORChain BTC ↔ ETH, Jupiter) and the
  Sepolia / Base Sepolia QA checklist. The adapters are tested against recorded and synthetic responses only.
- Aave on mainnet: the backend supports it per chain (`EARN_AAVE_CHAINS`), but the mainnet Earn screen and the address-book pins
  per chain are not built.
- Independent review of `swapsvc`, `earnsvc`, `simGuard.ts` and the pre-sign checks.
