# Buy and sell crypto (Onramper)

Harbour lets users buy crypto with a card, bank transfer, Apple Pay, UPI and similar, and sell crypto back to fiat, through
[Onramper](https://docs.onramper.com), an aggregator of licensed providers (MoonPay, Banxa, Transak, Mercuryo, Revolut and
others; the list depends on the user's country). Harbour never holds user money and never sees card or bank details: the
provider does payment and identity checks on its own page. Harbour only passes the wallet's public receiving address.

This follows the same model as MetaMask's in-extension buy flow: quotes in the wallet, checkout on the provider's page in a
browser tab, a background watcher that notices the end of checkout, and order tracking afterwards.

## Flow

1. **Buy crypto** (Fund menu, or the Buy button). The extension asks the backend for the catalog (`GET /v1/ramps/config`) and
   shows the Harbour assets Onramper carries in the user's country.
2. The user picks an asset, a currency and an amount. The extension asks for quotes (`GET /v1/ramps/quotes`); every provider
   and payment method comes back with its price, and the best payout is marked as recommended. No price is ever invented.
3. **Continue**: the service worker reads the receiving address from the vault (never from the UI) and calls
   `POST /v1/ramps/checkout`. The backend creates an order row, signs an Onramper checkout intent and returns the provider's
   checkout URL. The service worker opens it in a new tab, so the popup can close.
4. The user pays on the provider page. When the provider redirects to `RAMPS_RETURN_URL` (the backend's
   `GET /v1/ramps/return` page), the service worker turns that tab into Harbour's order list (`#/ramps/orders`).
5. Onramper sends status webhooks to `webhook-ingest` (`POST /webhooks/onramper`), which updates the order. The extension polls
   `GET /v1/ramps/orders` every minute while an order is open and shows a notification when it completes or fails.

Users see their orders under **Fund > Your buy and sell orders** (also in Help > Buy and sell).

## Security

| Rule | Where |
| --- | --- |
| Onramper API key and Ed25519 signing key live only on the backend (env or `*_FILE` secret). The extension has no provider keys and stores none. | `cmd/api/main.go`, `internal/onramper` |
| Checkout intents are signed with Signature V2 (Ed25519 over an 8-line canonical string, RFC 8785 body). The signature is pinned to a reference vector made with Onramper's own TypeScript example. | `internal/onramper/onramper_test.go` |
| The receiving address comes from the vault. For EVM addresses the backend also checks the address is one this device registered; other families get a strict shape check. | `handlers/ramps.ts`, `internal/api/ramps.go` |
| The checkout session is bound to the user's IP (`endUserIpHash`), so a leaked checkout link cannot be used from another network. | `internal/api/ramps.go` |
| Only `https://*.onramper.com` / `*.onramper.dev` checkout URLs are opened. | `onramper.TrustedCheckoutURL`, `core/ramps/onramper.ts` |
| Webhooks are authenticated with HMAC-SHA256 before parsing; late or duplicate deliveries cannot move an order backwards or out of a final state. | `internal/ingest/onramper.go`, `store.ApplyRampUpdate` |
| No wallet address is stored with an order (device-to-address links stay encrypted). | migration `0011_ramp_orders.sql` |
| At most 20 checkouts per device per hour (`RAMPS_MAX_ORDERS_PER_HOUR`). Upstream error text is logged, never shown raw. | `internal/api/ramps.go` |

## Setup

1. Get an Onramper partner account and API key (`pk_test_...` for staging, `pk_prod_...` for production).
2. Make an Ed25519 key pair and send Onramper the **public** key (one pair per environment):

   ```bash
   openssl genpkey -algorithm ED25519 -out onramper_private.pem
   openssl pkey -in onramper_private.pem -pubout -out onramper_public.pem
   ```

   Also give Onramper what its onboarding asks for: the extension ID, the redirect domain (your API host), and the backend's
   egress IPs.
3. Ask Onramper to enable webhooks for your API key with the URL `https://<webhooks host>/webhooks/onramper`. They issue a
   webhook secret.
4. Set in `apps/backend/.env` (or as secrets):

   | Variable | Value |
   | --- | --- |
   | `ONRAMPER_API_KEY` | your `pk_...` key |
   | `ONRAMPER_SIGNING_KEY_FILE` | path to `onramper_private.pem` (or `ONRAMPER_SIGNING_KEY` with the PEM on one line, `\n` between lines) |
   | `ONRAMPER_ENV` | `staging` or `production` (optional: a `pk_test_` key selects staging) |
   | `ONRAMPER_WEBHOOK_SECRET` | the webhook secret (used by `webhook-ingest`) |
   | `RAMPS_RETURN_URL` | `https://<api host>/v1/ramps/return` |
| `RAMPS_TEST_COUNTRY` | staging only, optional: force a country (e.g. `gb`) so sandbox providers such as Banxa answer from India |

5. Apply migrations (`make migrate` or `api -migrate`) and restart `api` and `webhook-ingest`.
6. The API must see the user's real IP: run it behind your proxy or Cloudflare tunnel with `TRUST_PROXY_HEADERS=1`. A request
   that reaches the API from a loopback or private address is logged with a warning, because Onramper will reject that session.
   With the Cloudflare tunnel the API also reads the user's country from `CF-IPCountry`.

With both keys unset, buy and sell are switched off (the screens say so) and Deposit from exchange and P2P keep working.

## Testing

- Backend: `go test ./internal/onramper ./internal/api ./internal/ingest`, plus `HB_TEST_POSTGRES_URL=... go test ./internal/store -run Ramp`.
- Extension: `npm test` (`test/ramps-onramper.test.js` covers asset matching, quote mapping, quote ids and URL checks).
- End to end in staging: use a `pk_test_` key. Onramper recommends Banxa with EUR or GBP and the provider's test card;
  the sandbox does not settle on-chain.

## Known limits

- The IP binding needs the same public IP for the API call and the provider page. A network that routes IPv4 and IPv6
  differently can make the provider page answer 403; retrying usually works.
- Recurring buy makes the first purchase and downloads a calendar reminder; there is no provider-side schedule.
- Sell opens the provider's flow; the user sends the crypto from Harbour when the provider shows the deposit address.
