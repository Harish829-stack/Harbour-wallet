#!/usr/bin/env bash
# Harbour backend runner. Works with macOS's bash 3.2.
#
#   ./run.sh            start everything and wait until it is healthy (same as ./run.sh up)
#   ./run.sh smoke      register a test device and read Base + Ethereum through the gateway
#   ./run.sh verify [chain address]  phase 3 check: track an address, wait for its backfill,
#                       compare every stored balance with the chain at the same block
#   ./run.sh inspect CHAIN ADDRESS   tracking state, webhook, latest transfers and balances
#   ./run.sh status     container state, health and per-upstream gateway status
#   ./run.sh logs       follow api, rpc-gateway, indexer, webhook-ingest and price-poller logs
#   ./run.sh test       unit tests, then the integration tests against the running stack
#   ./run.sh restart    rebuild, migrate and restart the Go services (after code or config changes)
#   ./run.sh down       stop everything (data kept)
#   ./run.sh reset      stop everything and DELETE local database, Redis and NATS data
set -euo pipefail
cd "$(dirname "$0")"

API=http://localhost:8080
GW=http://localhost:8081
IX=http://localhost:8083
WH=http://localhost:8082
COMPOSE=(docker compose --env-file .env -f deploy/docker-compose.yml)

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m ✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m ✗ %s\033[0m\n' "$*" >&2; exit 1; }
envval() { ./scripts/envval.sh "$1"; }

check_tools() {
  command -v docker >/dev/null || die "Docker is not installed. Install Docker Desktop, then rerun."
  docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop, then rerun."
  docker compose version >/dev/null 2>&1 || die "'docker compose' is missing. Update Docker Desktop."
  command -v curl >/dev/null || die "curl is missing."
}

need_go() {
  command -v go >/dev/null || die "Go is not installed (needed for '$1'). Install it with: brew install go"
}

ensure_env() {
  if [ ! -f .env ]; then
    say "No .env yet; creating it and generating local secrets"
  fi
  ./scripts/setup.sh >/dev/null
  if [ -z "$(envval ALCHEMY_API_KEY)" ] && [ -z "$(envval INFURA_API_KEY)" ] \
     && [ -z "$(envval QUICKNODE_ETH_URL)" ] && [ -z "$(envval QUICKNODE_BASE_URL)" ]; then
    die "No RPC provider key in .env. Set ALCHEMY_API_KEY and/or INFURA_API_KEY, then rerun."
  fi
  ok ".env ready"
}

ensure_deps() {
  # Fill go.sum when new modules arrived with an update (Docker build does this too).
  if command -v go >/dev/null && ! go build ./... >/dev/null 2>&1; then
    say "Resolving Go modules"
    go mod tidy
  fi
}

wait_for() { # name url seconds
  local name=$1 url=$2 secs=$3 i=0
  while [ $i -lt "$secs" ]; do
    if curl -fs -o /dev/null "$url"; then ok "$name is healthy"; return 0; fi
    sleep 1; i=$((i + 1))
  done
  printf '\n'
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail 40 migrate api rpc-gateway || true
  die "$name did not become healthy in ${secs}s (logs above)"
}

up() {
  check_tools
  ensure_env
  ensure_deps
  say "Building and starting Postgres, Redis, NATS, Centrifugo, migrate, rpc-gateway, api"
  "${COMPOSE[@]}" up -d --build
  wait_for "rpc-gateway" "$GW/healthz" 90
  wait_for "api" "$API/healthz" 90
  wait_for "indexer" "$IX/healthz" 90
  wait_for "webhook-ingest" "$WH/healthz" 90
  printf '\n'
  ok "Harbour backend is running"
  echo "    API          $API        (extension-facing)"
  echo "    rpc-gateway  $GW        (private; /status and /metrics need the GATEWAY_INTERNAL_TOKEN from .env)"
  echo "    indexer      $IX/healthz"
  echo "    webhooks     $WH/webhooks/alchemy  (public: $(envval WEBHOOK_PUBLIC_URL)/webhooks/alchemy)"
  echo "    Centrifugo   http://localhost:8000"
  echo "    Postgres     localhost:5432   Redis localhost:6379   NATS localhost:4222"
  echo
  echo "    Next: ./run.sh smoke   |   ./run.sh verify   |   ./run.sh status   |   ./run.sh logs   |   ./run.sh down"
}

smoke() {
  need_go smoke
  ensure_deps
  curl -fs -o /dev/null "$API/healthz" || die "API is not running. Start it with ./run.sh"
  # Reuse the saved test device so addresses it tracks stay visible;
  # register a new one only if there is none or the server no longer knows it.
  if [ -f .hbdevice.json ] && go run ./cmd/hbdevice me >/dev/null 2>&1; then
    ok "using the saved test device (.hbdevice.json)"
  else
    say "Registering a test device (proof-of-work + Ed25519 key)"
    go run ./cmd/hbdevice -api "$API" register >/dev/null
    ok "device registered (key in .hbdevice.json)"
  fi
  say "Signed call: GET /v1/me"
  go run ./cmd/hbdevice me
  say "Base: eth_blockNumber through the gateway"
  go run ./cmd/hbdevice rpc base '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}'
  say "Portfolio from Postgres + Redis (no RPC)"
  go run ./cmd/hbdevice get /v1/me/portfolio
  say "Ethereum: eth_getBalance through the gateway"
  go run ./cmd/hbdevice rpc ethereum '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","latest"]}'
  ok "smoke test passed"
}

# verify_one CHAIN ADDRESS: track it from the test device, wait, compare with chain.
verify_one() {
  local chain=$1 addr=$2
  say "Tracking $addr on $chain"
  go run ./cmd/hbdevice addresses "{\"add\":[{\"chain\":\"$chain\",\"address\":\"$addr\"}]}" >/dev/null
  say "Waiting for the backfill, then comparing stored balances with the chain"
  go run ./cmd/hbverify -chain "$chain" -address "$addr" -wait 10m
}

verify() {
  need_go verify
  ensure_deps
  curl -fs -o /dev/null "$API/healthz" || die "API is not running. Start it with ./run.sh"
  curl -fs -o /dev/null "$IX/healthz" || die "Indexer is not running. Start it with ./run.sh"
  [ -f .hbdevice.json ] || go run ./cmd/hbdevice -api "$API" register >/dev/null
  if [ $# -ge 2 ]; then
    verify_one "$1" "$2"
  else
    # Native balance after gas, plus many tokens:
    verify_one ethereum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
    # Rebasing token: the wstETH contract holds stETH, whose balance changes daily.
    verify_one ethereum 0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0
  fi
  ok "phase 3 verification passed"
}

inspect() {
  check_tools
  [ $# -ge 2 ] || die "usage: ./run.sh inspect CHAIN ADDRESS"
  local chain=$1 addr
  addr=$(printf '%s' "$2" | tr 'A-F' 'a-f')
  local q="\\pset footer off
SELECT id, backfill_state, device_count, webhook_id, synced_to_block, last_seen_block, last_activity_at
  FROM tracked_addresses WHERE chain_id='$chain' AND address='$addr';
SELECT t.block_number, left(t.tx_hash, 14) AS tx, t.event_ref, t.kind, COALESCE(a.symbol, a.asset_ref) AS asset,
       t.amount_raw, t.finality, CASE WHEN t.block_hash = '' THEN '-' ELSE left(t.block_hash, 10) END AS block_hash
  FROM transfers t JOIN assets a ON a.id = t.asset_id
 WHERE t.chain_id='$chain' AND ('$addr' IN (t.\"from\", t.\"to\")) ORDER BY t.block_number DESC LIMIT 10;
SELECT COALESCE(a.symbol, a.asset_ref) AS asset, b.amount_raw, a.decimals, b.as_of_block, b.updated_at
  FROM balances b JOIN assets a ON a.id = b.asset_id JOIN tracked_addresses ta ON ta.id = b.tracked_address_id
 WHERE ta.chain_id='$chain' AND ta.address='$addr' AND (b.amount_raw > 0 OR a.kind = 'native');
SELECT id AS webhook, chain_id, address_count, url FROM webhooks WHERE chain_id='$chain';
SELECT count(*) AS deliveries_last_hour, max(received_at) AS last_delivery
  FROM webhook_deliveries WHERE chain_id='$chain' AND received_at > now() - interval '1 hour';"
  printf '%s\n' "$q" | "${COMPOSE[@]}" exec -T postgres psql -q -U harbour -d harbour
}

status() {
  check_tools
  "${COMPOSE[@]}" ps
  echo
  printf 'api          '; curl -fs "$API/healthz" || echo "down"; echo
  printf 'rpc-gateway  '; curl -s "$GW/healthz" || echo "down"; echo
  printf 'indexer      '; curl -fs "$IX/healthz" || echo "down"; echo
  printf 'webhooks     '; curl -fs "$WH/healthz" || echo "down"; echo
  local pub; pub=$(envval WEBHOOK_PUBLIC_URL)
  if [ -n "$pub" ]; then
    printf 'public URL   %s -> ' "$pub"
    if curl -fs -o /dev/null -m 5 "$pub/healthz"; then echo "reachable"; else echo "NOT reachable (is cloudflared running? URL changed?)"; fi
  fi
  local tok; tok=$(envval GATEWAY_INTERNAL_TOKEN)
  if curl -fs -o /dev/null "$GW/healthz"; then
    echo
    say "Upstreams (chain  upstream  state  latest  lag  p90ms  errors)"
    curl -s -H "Authorization: Bearer $tok" "$GW/status" | python3 -c '
import json, sys
for chain, ups in sorted(json.load(sys.stdin).items()):
    for u in ups:
        print("  %-13s %-12s %-9s %10d %4d %7.0f %6.1f%%" % (chain, u["id"].split("/")[1], u["state"],
              u["latest"], u["block_lag"], u["p90_ms"], 100 * u["error_rate"]))
' 2>/dev/null || curl -s -H "Authorization: Bearer $tok" "$GW/status"
  fi
}

run_tests() {
  need_go test
  ensure_deps
  say "Unit, gateway and contract tests"
  go test ./...
  if curl -fs -o /dev/null "$API/healthz"; then
    say "Integration test against the running Postgres and Redis"
    make -s test-integration
  else
    echo "    (stack not running: skipped the integration test; start it with ./run.sh)"
  fi
}

case "${1:-up}" in
  up|start)  up ;;
  smoke)     smoke ;;
  status)    status ;;
  verify)    shift; verify "$@" ;;
  inspect)   shift; inspect "$@" ;;
  logs)      check_tools; "${COMPOSE[@]}" logs -f api rpc-gateway indexer webhook-ingest price-poller ;;
  test)      run_tests ;;
  restart)   check_tools; "${COMPOSE[@]}" up -d --build migrate api rpc-gateway indexer webhook-ingest price-poller
             wait_for "rpc-gateway" "$GW/healthz" 90; wait_for "api" "$API/healthz" 90; wait_for "indexer" "$IX/healthz" 90
             wait_for "webhook-ingest" "$WH/healthz" 90 ;;
  down|stop) check_tools; "${COMPOSE[@]}" down; ok "stopped (data kept)" ;;
  reset)     check_tools
             printf 'This deletes the local database, Redis and NATS data. Type "reset" to continue: '
             read -r answer
             [ "$answer" = "reset" ] || die "cancelled"
             "${COMPOSE[@]}" down -v; ok "stopped and local data deleted" ;;
  -h|--help|help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command '$1' (try ./run.sh help)" ;;
esac
