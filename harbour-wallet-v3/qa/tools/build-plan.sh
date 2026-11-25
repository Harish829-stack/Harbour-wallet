#!/bin/sh
# Rebuild TEST_PLAN.md from plan/*.md (matrix regenerated first).
set -e
cd "$(dirname "$0")/.."
node tools/gen-matrix.mjs
cat plan/00-header.md plan/10-key.md plan/20-sig-dapp.md plan/30-ext-ux-sa-ch-defi-data.md plan/40-backend.md plan/50-x-param-reg.md plan/60-closure.md plan/90-matrix.generated.md plan/95-ledger.md > TEST_PLAN.md
wc -l TEST_PLAN.md
