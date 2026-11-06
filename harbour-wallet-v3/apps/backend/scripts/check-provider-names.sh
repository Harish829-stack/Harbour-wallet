#!/usr/bin/env bash
# Fails if service code names a provider. Provider names belong in config/
# and adapters/ only (plus tests).
set -euo pipefail
cd "$(dirname "$0")/.."
pattern='alchemy|infura|quicknode|chainstack|coingecko|goldsky'
hits=$(grep -rniE "$pattern" internal/ cmd/ migrations/ --include='*.go' --include='*.sql' \
  | grep -v '_test.go:' | grep -vE '^cmd/[^:]+:[0-9]+:\s*_ "harbour/backend/adapters/' || true)
if [[ -n "$hits" ]]; then
  echo "provider names outside adapters/ and config/:"; echo "$hits"; exit 1
fi
echo "ok: no provider names in service code"
