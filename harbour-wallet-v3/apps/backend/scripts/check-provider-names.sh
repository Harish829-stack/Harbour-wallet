#!/usr/bin/env bash
# Fails if service code names a provider. Provider names belong in config/
# and adapters/ only (plus tests).
# Exception: internal/api/gateway.go is the /v1/gw third-party passthrough that replaced the v2 Cloudflare worker.
# It proxies named services (LI.FI, CoinGecko, Alchemy NFT, ...) by design, so it is the one place in service code
# allowed to name them; server.go only wires it up. Keep every other provider reference behind adapters/.
set -euo pipefail
cd "$(dirname "$0")/.."
pattern='alchemy|infura|quicknode|chainstack|coingecko|goldsky'
hits=$(grep -rniE "$pattern" internal/ cmd/ migrations/ --include='*.go' --include='*.sql' \
  | grep -v '_test.go:' | grep -vE '^cmd/[^:]+:[0-9]+:\s*_ "harbour/backend/adapters/' \
  | grep -v '^internal/api/gateway.go:' | grep -vE '^internal/api/server.go:[0-9]+:\s*s\.gw = newGateway\(' || true)
if [[ -n "$hits" ]]; then
  echo "provider names outside adapters/ and config/:"; echo "$hits"; exit 1
fi
echo "ok: no provider names in service code"
