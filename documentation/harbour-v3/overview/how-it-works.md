# How the Harbour backend runs (and why each command exists)

This explains what actually happens when you run `./run.sh`, what Docker, the Cloudflare tunnel and the webhook URL are for, and how a single transfer travels from the blockchain into the wallet's database. Read it top to bottom once; after that, the diagrams are the quick reference.

---

## 1. The one-paragraph version

The extension should never ask a blockchain node for balances or history directly: it would be slow, cost provider credits on every popup open, and expose provider keys. Instead, Harbour runs its own small set of services. They **watch the chain for the addresses users track, write everything into Postgres, and serve the extension from Postgres**. Alchemy tells us about new transfers by calling a URL of ours (a *webhook*). On a laptop that URL doesn't exist on the internet, so a **Cloudflare tunnel** gives your laptop a temporary public HTTPS address. **Docker** runs all the services and databases with one command so you don't install Postgres, Redis or NATS by hand.

---

## 2. The big picture

```mermaid
flowchart LR
    ext["Harbour extension"]
    subgraph mac["Your Mac"]
        cf["cloudflared<br/>(tunnel client)"]
        subgraph docker["Docker Compose stack"]
            api["api :8080"]
            gw["rpc-gateway :8081"]
            wi["webhook-ingest :8082"]
            ix["indexer :8083"]
            pg[("Postgres<br/>facts + balances")]
            rd[("Redis<br/>nonces, quotas")]
            nats{{"NATS JetStream<br/>event bus"}}
            cent["Centrifugo :8000<br/>websocket"]
            tt["tx-tracker"]
            rb["realtime-bridge"]
            nt["notifier"]
            mig["migrate<br/>(runs once)"]
        end
    end
    subgraph internet["Internet"]
        cfe["Cloudflare edge<br/>xxx.trycloudflare.com"]
        alch["Alchemy<br/>webhooks + Transfers API + NFT API"]
        inf["Infura"]
        chain[("Ethereum / Base<br/>blockchains")]
    end

    ext -- "signed HTTPS" --> api
    api --> pg
    api --> rd
    api -- "allow-listed reads" --> gw
    api -- "address.added" --> nats
    gw -- "JSON-RPC" --> alch
    gw -- "JSON-RPC" --> inf
    alch --- chain
    inf --- chain
    alch -- "POST webhook" --> cfe
    cfe -- "tunnel" --> cf
    cf -- "localhost:8082" --> wi
    wi -- "raw delivery" --> nats
    wi --> pg
    nats --> ix
    ix -- "history, holdings" --> alch
    ix -- "balances via Multicall3" --> gw
    ix --> pg
    ix -- "balance.changed, activity.new" --> nats
    tt -- "tx.status" --> nats
    tt -- "receipts" --> gw
    nats --> rb
    rb --> cent
    cent -- "live updates" --> ext
    nats --> nt
    nt -- "Web Push" --> ext
    mig --> pg
```

Two directions of traffic matter:

- **Outbound** (your Mac calls the internet): `rpc-gateway` and `indexer` call Alchemy and Infura. This works from any laptop, no setup needed.
- **Inbound** (the internet calls your Mac): Alchemy pushes webhooks. Your laptop sits behind a home/office router with no public address, so this is the only part that needs the tunnel.

---

## 3. Each piece, in plain words

| Piece | What it is | Why Harbour needs it |
| --- | --- | --- |
| **Docker / Docker Compose** | Runs each program in its own isolated container from a recipe (`Dockerfile`), and `deploy/docker-compose.yml` lists all of them, their ports and start order. | One command starts all of them in the right order on any machine, identical to production. Nothing is installed globally on your Mac. |
| **Postgres** | The database. | The source of truth: tracked addresses, every transfer (facts), current balances and NFTs (projections). The extension's screens read from here, not from the chain. |
| **Redis** | Fast in-memory store. | Per-device rate limits and quotas, request nonces (so a signed request can't be replayed), idempotency keys, registration challenges. |
| **NATS JetStream** | A message queue that keeps messages on disk until processed. | Services hand work to each other without waiting: "this address was added", "this webhook arrived", "this balance changed". If the indexer is restarting, messages wait. |
| **migrate** | Runs `migrations/*.sql` once, then exits. | Creates and upgrades tables before any service starts. Runs on every `./run.sh` / `restart`; already-applied migrations are skipped. |
| **api** | The only service the extension talks to. | Registers devices, checks every request's Ed25519 signature, enforces quotas, records which addresses a device tracks, proxies a few safe RPC reads. |
| **rpc-gateway** | The only thing that talks JSON-RPC to Alchemy/Infura. | Spreads load over several keys, fails over when one provider is down, caches finalized results, never lets a provider return 429. |
| **indexer** | The worker. | Backfills history when an address is added, reads balances from chain, syncs NFTs, manages Alchemy webhooks, processes deliveries, gap-fills, repairs reorgs. |
| **price-poller** | A scheduled worker. | Fetches USD prices for tokens someone holds (CoinGecko, then Alchemy), every minute for popular tokens; caches them in Redis; records price history and daily balance snapshots for the chart. The extension never triggers a price call. |
| **webhook-ingest** | A tiny receiver on port 8082. | Accepts Alchemy's webhook POSTs, verifies the signature, saves the raw body, puts it on NATS, answers 200 immediately. |
| **Centrifugo** | Websocket server. | Pushes live balance and transaction updates to the open popup. Clients can only join channels the api signed a token for. |
| **tx-tracker** | A worker. | Watches every transaction sent through Harbour until it is confirmed, failed or dropped, and announces each change. |
| **realtime-bridge** | A relay. | Copies `balance.changed` and `tx.status` events from NATS into Centrifugo channels. The only thing that pushes to clients. |
| **notifier** | A worker. | Sends Web Push notifications ("Received 0.5 ETH", "Transaction confirmed") even when the popup is closed. Payloads are end-to-end encrypted to the browser. |
| **cloudflared** | Runs on your Mac, outside Docker. | Gives port 8082 a public HTTPS address so Alchemy can reach webhook-ingest. Development only. |
| **Alchemy** | Hosted blockchain data provider. | RPC (through the gateway), transfer history (Transfers API), NFT lists, and webhooks that push new activity. |
| **Infura** | Second RPC provider. | Failover: if Alchemy has a bad day, reads keep working. |

### Ports at a glance

```mermaid
flowchart TB
    subgraph host["Your Mac (127.0.0.1 only)"]
        p8080["8080 api"]
        p8081["8081 rpc-gateway (private)"]
        p8082["8082 webhook-ingest"]
        p8083["8083 indexer health"]
        p5432["5432 Postgres"]
        p6379["6379 Redis"]
        p4222["4222 NATS"]
        p8000["8000 Centrifugo"]
    end
    tunnel["cloudflared"] --> p8082
    note["Everything is bound to 127.0.0.1:<br/>nothing is reachable from your network<br/>except through the tunnel, and the tunnel<br/>only forwards to 8082."]
```

---

## 4. Why the tunnel, and how it works

Alchemy needs an `https://` URL to POST to. `localhost:8082` only means something on your Mac. Your router does not let the internet in. The tunnel solves this without opening any port:

```mermaid
sequenceDiagram
    autonumber
    participant CF as cloudflared (your Mac)
    participant Edge as Cloudflare edge
    participant A as Alchemy
    participant WI as webhook-ingest :8082

    CF->>Edge: outbound connection (QUIC/HTTPS), "give me a quick tunnel"
    Edge-->>CF: your URL is https://moral-index-flux-mhz.trycloudflare.com
    Note over CF,Edge: The connection stays open. Nothing inbound is opened on your router.
    A->>Edge: POST https://moral-index-flux-mhz.trycloudflare.com/webhooks/alchemy
    Edge->>CF: forwards the request down the open connection
    CF->>WI: POST http://localhost:8082/webhooks/alchemy
    WI-->>CF: 200
    CF-->>Edge: 200
    Edge-->>A: 200 (delivered)
```

Things that follow from this:

- **The terminal running `cloudflared tunnel --url http://localhost:8082` must stay open.** Close it and Alchemy's deliveries fail.
- **The quick-tunnel URL is random and changes every time cloudflared restarts.** That is why `WEBHOOK_PUBLIC_URL` lives in `.env` and you update it after a restart. The indexer notices the new URL and moves the webhook automatically (see section 7).
- **Nothing breaks if the tunnel is down for a while.** Missed deliveries are recovered by gap-fill (section 8). The tunnel only makes updates *fast*.
- **Production doesn't use a tunnel.** On AWS (phase 7) webhook-ingest sits behind a load balancer with a fixed domain, e.g. `https://hooks.harbour.example/webhooks/alchemy`.

---

## 5. What `./run.sh` actually does

```mermaid
flowchart TD
    start(["./run.sh"]) --> tools{"Docker installed<br/>and running?"}
    tools -- no --> fail1["stop: start Docker Desktop"]
    tools -- yes --> env["scripts/setup.sh<br/>create .env if missing,<br/>generate passwords and secrets"]
    env --> keys{"any provider key<br/>in .env?"}
    keys -- no --> fail2["stop: add ALCHEMY_API_KEY"]
    keys -- yes --> deps["go mod tidy if needed"]
    deps --> up["docker compose up -d --build"]
    up --> order["Compose starts in dependency order:<br/>Postgres, Redis, NATS, Centrifugo<br/>then migrate (runs, exits)<br/>then rpc-gateway, api, indexer, webhook-ingest"]
    order --> wait["poll /healthz of gateway, api,<br/>indexer, webhook-ingest"]
    wait --> done(["Harbour backend is running"])
```

| Command | When you use it | What happens underneath |
| --- | --- | --- |
| `./run.sh` | First start, or after `down` | The flowchart above. |
| `./run.sh restart` | After pulling or changing code/config | Rebuilds the Go images, runs `migrate`, recreates the four Go services. Databases keep their data. |
| `./run.sh status` | "Is everything up?" | Container list, each `/healthz`, per-provider gateway table, and whether your **public tunnel URL reaches webhook-ingest**. |
| `./run.sh logs` | Watching what happens | Follows the logs of api, rpc-gateway, indexer, webhook-ingest. |
| `./run.sh smoke` | Quick sanity check | Registers a test device (like the extension would) and reads a block on Base and a balance on Ethereum through the API and gateway. |
| `./run.sh verify CHAIN ADDR` | "Are stored balances right?" | Tracks the address, waits for its backfill, then compares every stored balance with a fresh single read from chain at the same block. |
| `./run.sh inspect CHAIN ADDR` | "What does Harbour know about this address?" | Prints its tracking state, webhook, last 10 transfers, balances and recent deliveries straight from Postgres. |
| `./run.sh test` | Before committing | Unit tests, then integration tests against the running Postgres/Redis. |
| `./run.sh down` | Done for the day | Stops containers; data is kept in Docker volumes. |
| `./run.sh reset` | Start from zero | Stops and **deletes** local database, Redis and NATS data. |

### Why `.env` and `scripts/setup.sh`

`.env` holds everything secret or machine-specific: provider keys, generated passwords, `ADDRESS_LINK_ENCRYPTION_KEY`, `ALCHEMY_NOTIFY_TOKEN`, `WEBHOOK_PUBLIC_URL`. It is git-ignored. `setup.sh` fills in only the *empty generated* values and never overwrites what you set. Compose passes `.env` into the containers; the Go programs also read it when you run them on the host (`go run ./cmd/...`).

---

## 6. Flow: the extension adds an address

```mermaid
sequenceDiagram
    autonumber
    participant E as Extension
    participant API as api
    participant PG as Postgres
    participant N as NATS
    participant IX as indexer
    participant AL as Alchemy APIs
    participant GW as rpc-gateway

    E->>API: PUT /v1/me/addresses (Ed25519-signed)
    API->>API: verify signature, nonce, quota
    API->>PG: tracked_addresses (pending), encrypted device link, device_count+1
    API->>N: address.added
    API-->>E: 200 {backfill_state: pending}
    N->>IX: address.added (wake up)
    IX->>PG: claim the pending backfill
    loop pages, newest first, max 90 days / 5,000 transfers
        IX->>AL: Transfers API (incoming + outgoing)
        IX->>PG: event_keys + transfers + address_activity (dedupe first)
    end
    IX->>AL: which tokens / NFTs does it hold now?
    IX->>GW: Multicall3: native + every token balanceOf at ONE block
    GW->>AL: eth_call (or Infura if Alchemy is unhealthy)
    IX->>PG: balances (only if newer block), nft_holdings
    IX->>N: balance.changed.base
    Note over IX: within ~15 s the webhook manager subscribes the address (next diagram)
```

Why balances come from the chain and not from adding up transfers: gas fees, L2 fees and rebasing tokens (stETH) change balances without a transfer event. Summing transfers would drift; reading from chain at one block is exact. `./run.sh verify` proves this against the live chain.

---

## 7. Flow: keeping Alchemy webhooks in sync

The indexer owns the webhooks; you never create them by hand. Every 15 seconds (and right after an address is added) it reconciles:

```mermaid
flowchart TD
    tick(["every 15 s, per chain"]) --> enabled{"ALCHEMY_NOTIFY_TOKEN and<br/>WEBHOOK_PUBLIC_URL set?"}
    enabled -- no --> skip["do nothing<br/>(gap-fill alone keeps data current, minutes behind)"]
    enabled -- yes --> lock["take a Postgres advisory lock<br/>(one indexer replica at a time)"]
    lock --> urlcheck{"stored webhook URL ==<br/>WEBHOOK_PUBLIC_URL/webhooks/alchemy?"}
    urlcheck -- "no (new tunnel URL)" --> del["delete old webhook at Alchemy,<br/>its addresses become unsubscribed"]
    del --> unsub
    urlcheck -- yes --> unsub["addresses no device tracks<br/>(device_count = 0) -> remove from webhook"]
    unsub --> pending{"addresses tracked but<br/>not on a webhook?"}
    pending -- no --> done(["done"])
    pending -- yes --> room{"existing webhook with room<br/>(< 100,000 addresses)?"}
    room -- yes --> add["update-webhook-addresses<br/>(batches of 500)"]
    room -- no --> create["create-webhook with these addresses,<br/>store its signing key ENCRYPTED in Postgres"]
    add --> done
    create --> done
```

The **signing key** Alchemy returns on create is what webhook-ingest uses to prove a delivery really came from Alchemy. It is stored encrypted with a key derived from `ADDRESS_LINK_ENCRYPTION_KEY`, never in `.env` or git.

---

## 8. Flow: a live transfer arrives

```mermaid
sequenceDiagram
    autonumber
    participant CH as Base Sepolia
    participant AL as Alchemy
    participant T as Cloudflare tunnel
    participant WI as webhook-ingest
    participant PG as Postgres
    participant N as NATS
    participant IX as indexer
    participant GW as rpc-gateway

    CH->>AL: block with your transfer
    AL->>T: POST /webhooks/alchemy + X-Alchemy-Signature
    T->>WI: forwarded to localhost:8082
    WI->>WI: HMAC-SHA256(signing key, raw body) == signature?
    alt bad or unknown signature
        WI-->>AL: 401 (dropped)
    else valid
        WI->>PG: webhook_deliveries (raw body, kept 7 days)
        WI->>N: chain.base-sepolia.activity.raw
        WI-->>AL: 200 immediately
    end
    N->>IX: delivery
    IX->>IX: convert to ActivityEvent (no Alchemy types past this point)
    IX->>PG: insert event_keys first (conflict means already stored, skip)
    IX->>PG: transfers, transactions, address_activity
    Note over IX: wait 2 s for more events on the same address (debounce)
    IX->>GW: Multicall3 balances at one block
    IX->>PG: balances (guarded by as_of_block)
    IX->>N: balance.changed.base-sepolia
```

**Why replays are harmless:** Alchemy delivers *at least once*, so the same webhook can arrive twice. Each transfer has a key `(chain, tx_hash, event_ref)` such as `log:110`. The key is inserted into `event_keys` first, in the same database transaction as the transfer; if it already exists, nothing else is written. That is exit test #1: replaying every webhook twice changes nothing.

---

## 9. Flow: what if a webhook is missed? (gap-fill)

Alchemy only retries a failed delivery for about 10 minutes. If your laptop slept, the tunnel died or webhook-ingest was stopped longer than that, those deliveries are gone. Gap-fill is the guarantee; webhooks are just the fast path.

```mermaid
flowchart TD
    subgraph regular["Every 3 minutes"]
        r1["addresses active in the last 7 days,<br/>or not on a webhook yet"] --> r2
    end
    subgraph outage["When webhook-ingest starts"]
        o1["read its last heartbeat<br/>(it beats every 15 s)"] --> o2{"older than 1 minute?"}
        o2 -- yes --> o3["publish chain.gapfill"] --> o4["indexer gap-fills EVERY tracked address"]
        o2 -- no --> o5["nothing to do"]
    end
    r2["Transfers API: everything after last_seen_block"] --> ing["ingest with event_keys dedupe<br/>(anything the webhook already wrote is skipped)"]
    o4 --> r2
    ing --> bal["refresh balances of touched addresses"]
    bal --> adv["last_seen_block = chain head - ~2 minutes<br/>(the window Alchemy may not have indexed yet)"]
```

`last_seen_block` means "everything up to here is definitely stored". Only gap-fill moves it, never webhooks, because webhooks don't prove completeness. That is exit test #2: stopping ingest for 30 minutes loses nothing.

---

## 10. Flow: reorgs and finality

A chain can briefly disagree with itself: a block you saw gets replaced (a *reorg*), and its transactions may vanish or move to another block. Until a block is **finalized** (about 15 minutes on Ethereum; on Base, when its batch is final on Ethereum), stored rows are `confirmed`, not `finalized`.

```mermaid
stateDiagram-v2
    [*] --> confirmed: stored from webhook / backfill / gap-fill
    confirmed --> finalized: block <= chain's "finalized" block (checked every minute)
    confirmed --> moved: receipt says the tx is now in another block
    moved --> confirmed: block number and hash updated
    confirmed --> removed: webhook says removed=true
    confirmed --> removed: block hash changed AND no receipt for 3+ blocks
    removed --> [*]: transfer, key and activity deleted, balances re-read
    finalized --> [*]
```

The repair job is cheap: it compares one block hash per distinct recent block and only fetches a transaction receipt when something doesn't match (or when a backfilled row has no hash yet).

---

## 10b. Flow: the extension opens the home screen (phase 5)

```mermaid
sequenceDiagram
    autonumber
    participant E as Extension
    participant API as api
    participant R as Redis
    participant PG as Postgres
    participant PP as price-poller
    participant CG as CoinGecko / Alchemy

    loop every 60 s (popular) / 5 min (rest)
        PP->>PG: which tokens does anyone hold?
        PP->>CG: prices for those only
        PP->>R: hb:price:<asset> {usd, liquidity, flag}
        PP->>PG: price_ticks (5-min history)
    end
    E->>API: GET /v1/me/portfolio (signed)
    API->>R: cached response? (10 s)
    API->>PG: balances + assets (one query)
    API->>R: prices for those assets (one MGET)
    API-->>E: amounts, prices, USD values, as_of_block, synced
    E->>API: GET /v1/me/nfts, then each image via /v1/media/<key>
    Note over E,API: No call reaches a blockchain node or a price provider.
```

## 10c. Flow: sending a transaction (phase 6)

```mermaid
sequenceDiagram
    autonumber
    participant E as Extension
    participant API as api
    participant GW as rpc-gateway
    participant TT as tx-tracker
    participant N as NATS
    participant RB as realtime-bridge
    participant C as Centrifugo
    participant NT as notifier

    E->>API: POST /v1/tx/base/estimate (X-HB-Session)
    API->>GW: nonce, estimateGas, fees (same upstream)
    API-->>E: nonce, gas_limit, slow / normal / fast fees
    E->>API: POST /v1/tx/base/simulate
    API-->>E: predicted asset changes + warnings
    Note over E: The user confirms, then the extension signs locally
    E->>API: POST /v1/tx/base/broadcast {raw} (Idempotency-Key)
    API->>API: chain id ok? sender tracked by this device?
    API->>GW: eth_sendRawTransaction
    API->>N: tx.status pending
    API-->>E: tx_hash + tx channel token
    E->>C: subscribe tx:base.0xhash
    N->>RB: pending
    RB->>C: publish
    C-->>E: status pending
    loop every block time, slowing down
        TT->>GW: receipt?
    end
    TT->>N: tx.status confirmed
    N->>RB: confirmed
    RB->>C: publish
    C-->>E: status confirmed
    N->>NT: confirmed
    NT-->>E: Web Push "Transaction confirmed"
```

Balances follow the same road: the indexer's `balance.changed` goes through `realtime-bridge` to `balances:<chain>.<address>`, and incoming transfers (`activity.new`) become a push from `notifier`.

## 10d. The extension and the backend (harbour-wallet-v3)

The v3 extension (copied from v2, which stays untouched) offers only **Sepolia and Base Sepolia**, and gets everything for them from the Harbour API. The backend serves the same two (`ENABLED_CHAINS=sepolia,base-sepolia` in `backend/.env`).

| In the extension | Comes from |
| --- | --- |
| Home balances and tokens | `GET /v1/me/portfolio` (tokens the indexer found appear automatically; spam is hidden) |
| Activity | `GET /v1/me/history`, merged with your own just-sent transactions |
| NFTs | `GET /v1/me/nfts`, images through Harbour's media proxy |
| Any RPC call (gas, nonce, dApp reads) | `POST /v1/rpc/<chain>` (allow-listed, signed) |
| Sending | signed in the extension, then `POST /v1/tx/<chain>/broadcast` |
| Live updates while the popup is open | Centrifugo websocket, tokens from `POST /v1/realtime/token` |
| Notifications when it's closed | Web Push (`PUT /v1/me/push`) from the notifier |

On first start the service worker creates a device key (non-extractable WebCrypto Ed25519, kept in IndexedDB), solves the proof-of-work and registers. Every wallet address is tracked automatically after you create, import or unlock a wallet. Seeds and private keys never leave the extension.

```mermaid
flowchart LR
    ui["Popup (dumb UI)"] -- "messages" --> sw["Service worker"]
    sw -- "signed HTTPS" --> api["Harbour API :8080"]
    sw -- "websocket" --> cent["Centrifugo :8000"]
    push["Browser push service"] -- "Web Push" --> sw
    sw -. "keys stay here" .- vault[("Encrypted vault")]
```

Run it: start the backend (`cd backend && ./run.sh`), then in `harbour-wallet-v3` run `npm install && npm run build` and load `dist/` in `chrome://extensions` (Developer mode → Load unpacked). Point a non-local build at another API with `VITE_HB_API_URL` in `.env.production`.

## 11. Development vs production

```mermaid
flowchart LR
    subgraph dev["Now: your Mac"]
        d1["docker compose"] --- d2["quick tunnel<br/>random URL, changes on restart"]
        d1 --- d3["one Postgres, one Redis, one NATS"]
    end
    subgraph prod["Phase 7: AWS"]
        p1["ECS Fargate: one container per service,<br/>2+ copies each"] --- p2["load balancer + fixed domain<br/>hooks.harbour.example"]
        p1 --- p3["RDS Postgres + replica,<br/>ElastiCache Redis, NATS cluster"]
        p1 --- p4["keys in AWS Secrets Manager,<br/>not .env"]
    end
    dev -- "same images, same config files" --> prod
```

The code doesn't change between the two: only `.env` values (URLs, secrets) and where the containers run.

---

## 12. Troubleshooting map

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `./run.sh` stops at "Docker is not running" | Docker Desktop closed | Open Docker Desktop, rerun. |
| `status` says public URL **NOT reachable** | cloudflared closed, or URL changed | Restart `cloudflared tunnel --url http://localhost:8082`, put the new URL in `.env`, `./run.sh restart`. |
| `logs` shows `create webhook` errors | `ALCHEMY_NOTIFY_TOKEN` wrong/empty | Copy the Auth token from Alchemy → Webhooks, update `.env`, restart. |
| `logs` shows `rejected delivery ... bad signature` | Delivery from a webhook Harbour doesn't know (e.g. one you created by hand) | Let the indexer manage webhooks, or add `id:key` to `ALCHEMY_WEBHOOK_SIGNING_KEYS`. |
| New transfer shows up only after a few minutes | Webhook path down; gap-fill caught it | Check `status` (tunnel) and `logs` (webhook-ingest). Data is still correct. |
| `verify` says MISMATCH | A balance differs from chain | Rerun once (the chain may have moved between reads); if it persists, send the output. |
| `watch` prints nothing after a send | realtime-bridge or Centrifugo down | `./run.sh status`, then `./run.sh logs` (realtime-bridge errors name the cause). The tx still settles: `GET /v1/tx/<chain>/<hash>`. |
| `send` says `not_tracked` | Sender isn't tracked by this test device | `./run.sh send` tracks it first; with `hbdevice send` add it via `hbdevice addresses`. |
| Containers fail with "permission denied" on config | Host file permissions | Already handled in the Dockerfile; `./run.sh restart`. |

---

## 13. Where things live

```
harbour-wallet-v3/
  HOW-IT-WORKS.md          <- this file
  backend/
    run.sh                 <- the commands above
    .env                   <- your secrets (git-ignored)
    config/                <- chains.yaml, providers.yaml, api.yaml (no secrets)
    deploy/docker-compose.yml
    cmd/                   <- one folder per program: api, rpc-gateway, indexer, webhook-ingest, price-poller,
                              tx-tracker, realtime-bridge, notifier, migrate, hbdevice, hbverify, hbkeys
    internal/              <- service code (never imports a provider SDK)
    adapters/              <- the only place that knows Alchemy/Infura exist
    migrations/            <- SQL applied by migrate
    clients/ts/            <- the extension's device-signing client
```
