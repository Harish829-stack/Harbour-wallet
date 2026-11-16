# Harbour backend

Go services for Harbour Wallet: `api`, `rpc-gateway`, `indexer`, `webhook-ingest`, `price-poller`, `tx-tracker`, `realtime-bridge`, `notifier` and `migrate`, plus the dev tools `hbdevice`, `hbkeys` and `hbverify`. All run from one Docker image.

```bash
./run.sh          # create .env + secrets, build, start everything, wait until healthy
./run.sh smoke    # register a test device and read chains through the gateway
./run.sh help     # status, logs, inspect, verify, send, watch, test, restart, down, reset
make test         # unit, gateway and contract tests (no services needed)
make lint         # golangci-lint (depguard) and the provider-name check
```

The first `./run.sh` stops and asks you to put an `ALCHEMY_API_KEY` and/or `INFURA_API_KEY` in `.env`.

| Folder | Contents |
| --- | --- |
| `cmd/` | one `main` per program |
| `internal/` | service code (never imports a provider SDK) |
| `adapters/` | the only place that knows providers exist (RPC, indexer sources, prices, risk, notify, chains) |
| `config/` | `chains.yaml`, `providers.yaml`, `api.yaml` (no secrets) |
| `migrations/` | SQL applied by `migrate` |
| `deploy/` | Docker Compose and the Postgres, NATS, Centrifugo and cache-Redis images |
| `contracttest/` | the shared adapter contract suite |
| `clients/ts/` | the device-signing client used by scripts |
| `scripts/` | `setup.sh` (secrets), `gen_chains.py`, `pg-certs.sh`, checks |

Documentation: [how to run](../../../documentation/how-to-run.md), [backend services](../../../documentation/backend-services.md), [chains and providers](../../../documentation/chains-and-providers.md), [Railway deployment](../../../documentation/deployment-railway.md).
