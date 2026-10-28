#!/usr/bin/env bash
# Harbour backend runner. Works with macOS's bash 3.2.
#
#   ./run.sh            start everything and wait until it is healthy (same as ./run.sh up)
#   ./run.sh smoke      register a test device and read Base + Ethereum through the gateway
#   ./run.sh status     container state, health and per-upstream gateway status
#   ./run.sh logs       follow api + rpc-gateway logs
#   ./run.sh test       unit tests, then the integration test against the running stack
#   ./run.sh restart    rebuild and restart api + rpc-gateway (after code or config changes)
#   ./run.sh down       stop everything (data kept)
#   ./run.sh reset      stop everything and DELETE local database, Redis and NATS data
set -euo pipefail
cd "$(dirname "$0")"

API=http://localhost:8080
GW=http://localhost:8081
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
  # Fill go.sum once if golang.org/x lines are missing (Docker build also does this).
  if command -v go >/dev/null && ! grep -q '^golang.org/x/crypto ' go.sum 2>/dev/null; then
    say "Resolving Go modules (first run only)"
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
  printf '\n'
  ok "Harbour backend is running"
  echo "    API          $API        (extension-facing)"
  echo "    rpc-gateway  $GW        (private; /status and /metrics need the GATEWAY_INTERNAL_TOKEN from .env)"
  echo "    Centrifugo   http://localhost:8000"
  echo "    Postgres     localhost:5432   Redis localhost:6379   NATS localhost:4222"
  echo
  echo "    Next: ./run.sh smoke   |   ./run.sh status   |   ./run.sh logs   |   ./run.sh down"
}

smoke() {
  need_go smoke
  curl -fs -o /dev/null "$API/healthz" || die "API is not running. Start it with ./run.sh"
  say "Registering a test device (proof-of-work + Ed25519 key)"
  go run ./cmd/hbdevice -api "$API" register >/dev/null
  ok "device registered (key in .hbdevice.json)"
  say "Signed call: GET /v1/me"
  go run ./cmd/hbdevice me
  say "Base: eth_blockNumber through the gateway"
  go run ./cmd/hbdevice rpc base '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}'
  say "Ethereum: eth_getBalance through the gateway"
  go run ./cmd/hbdevice rpc ethereum '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","latest"]}'
  ok "smoke test passed"
}

status() {
  check_tools
  "${COMPOSE[@]}" ps
  echo
  printf 'api          '; curl -fs "$API/healthz" || echo "down"; echo
  printf 'rpc-gateway  '; curl -s "$GW/healthz" || echo "down"; echo
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
  logs)      check_tools; "${COMPOSE[@]}" logs -f api rpc-gateway ;;
  test)      run_tests ;;
  restart)   check_tools; "${COMPOSE[@]}" up -d --build api rpc-gateway
             wait_for "rpc-gateway" "$GW/healthz" 90; wait_for "api" "$API/healthz" 90 ;;
  down|stop) check_tools; "${COMPOSE[@]}" down; ok "stopped (data kept)" ;;
  reset)     check_tools
             printf 'This deletes the local database, Redis and NATS data. Type "reset" to continue: '
             read -r answer
             [ "$answer" = "reset" ] || die "cancelled"
             "${COMPOSE[@]}" down -v; ok "stopped and local data deleted" ;;
  -h|--help|help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command '$1' (try ./run.sh help)" ;;
esac
