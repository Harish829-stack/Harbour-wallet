#!/usr/bin/env bash
# Full REA scan of the Trust Wallet 26.41.0 extension, run locally on the Mac (no 60 s bridge limit).
#
#   bash ~/Desktop/REA/tools/run-full-rea.sh            # app + deep + har   (several hours; keeps the Mac awake)
#   bash ~/Desktop/REA/tools/run-full-rea.sh <step>     # js | app | deep | har | record | status
#
#   js      background.js application graph (endpoints, storage, workers)          ~45 min
#   app     whole extension (popup chunks, content scripts, inpage) application graph
#   deep    split background.js into its 4,272 bundled modules, then full REA semantic graphs in ~100 batches (~1 h)
#   har     every network capture through REA (lossless parts under REA's decoder memory) + api-surface view
#   record  open a throwaway Chromium with the extension to record new flows (manual)
#
# Tunables: HEAP_MB=8192 TIMEOUT_MS=7200000 NODES=1000000 BATCH_BYTES=204800 PART_BYTES=10485760 OUT=<dir>
# Results: evidences/re-evidence/43-full-rea/<run>/ ; STATUS.md lists every step and REA evidence id.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REA="$ROOT/tools/toolchain/node_modules/.bin/rea"
EXT="$ROOT/evidences/extension/reference-26.41.0"
NL="$ROOT/evidences/network-logs"
BASE="$ROOT/evidences/re-evidence/43-full-rea"
STEP="${1:-all}"
HEAP_MB="${HEAP_MB:-8192}"
TIMEOUT_MS="${TIMEOUT_MS:-7200000}"
NODES="${NODES:-1000000}"                 # REA's maximum for --max-semantic-nodes
BATCH_BYTES="${BATCH_BYTES:-204800}"      # source bytes per deep batch; keeps each run inside REA's fixed result budget (~150 MB)
export PART_BYTES="${PART_BYTES:-10485760}"  # HAR part size; REA's HAR decoder heap is fixed at 192 MiB
if [ -z "${OUT:-}" ]; then
  if [ "$STEP" = "all" ] || [ ! -d "$BASE" ]; then OUT="$BASE/$(date +%Y-%m-%d_%H%M)"
  else OUT="$(ls -d "$BASE"/*/ 2>/dev/null | sort | tail -1)"; OUT="${OUT%/}"; fi
fi
mkdir -p "$OUT"/{logs,js,deep,har,record}
STATUS="$OUT/STATUS.md"
[ -f "$STATUS" ] || printf '# Full REA run\n\nOutput folder: %s\n\n' "$OUT" > "$STATUS"

if [ -z "${REA_CAFFEINATED:-}" ] && command -v caffeinate >/dev/null && [ "$STEP" != "status" ]; then
  export REA_CAFFEINATED=1 OUT; exec caffeinate -dimsu bash "$0" "$@"
fi

log()    { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$OUT/logs/run.log"; }
status() { printf -- '- %s\n' "$*" >> "$STATUS"; log "$*"; }
evid()   { head -c 300 "$1" 2>/dev/null | grep -o 'ev_[0-9a-f]\{64\}' | head -1; }
size()   { du -h "$1" 2>/dev/null | cut -f1; }

preflight() {
  [ -x "$REA" ] || { echo "REA CLI not found at $REA"; exit 1; }
  local mem_gb free_gb
  mem_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
  free_gb=$(df -g "$ROOT" 2>/dev/null | awk 'NR==2{print $4}')
  printf '\n## Step %s, %s\n\n' "$STEP" "$(date '+%Y-%m-%d %H:%M')" >> "$STATUS"
  status "Machine: ${mem_gb} GB RAM, ${free_gb:-?} GB free disk; node $(node -v); REA $("$REA" --version 2>/dev/null | head -1)"
  [ "${mem_gb:-0}" -gt 0 ] && [ "$HEAP_MB" -gt $(( mem_gb * 1024 * 3 / 4 )) ] && { HEAP_MB=$(( mem_gb * 1024 * 3 / 4 )); status "HEAP_MB lowered to $HEAP_MB to fit RAM"; }
  [ "${free_gb:-99}" -lt 8 ] && { status "STOP: under 8 GB free disk"; exit 1; }
}
common=(--artifact-format directory --integrity-policy record-and-continue --format json)

step_js() {
  log "JS background.js application graph"
  NODE_OPTIONS="--max-old-space-size=$HEAP_MB" "$REA" analyze-javascript-application "$EXT" --source-path background.js \
    --max-heap-mb "$HEAP_MB" --analysis-timeout-ms "$TIMEOUT_MS" "${common[@]}" > "$OUT/js/background.json" 2> "$OUT/logs/js.err"
  status "JS background.js: exit $?, $(size "$OUT/js/background.json"), evidence $(evid "$OUT/js/background.json")"
}

step_app() {
  log "APP whole extension application graph (all inventoried files)"
  NODE_OPTIONS="--max-old-space-size=$HEAP_MB" "$REA" analyze-javascript-application "$EXT" \
    --max-heap-mb "$HEAP_MB" --analysis-timeout-ms "$TIMEOUT_MS" "${common[@]}" > "$OUT/js/extension-all.json" 2> "$OUT/logs/app.err"
  status "APP whole extension: exit $?, $(size "$OUT/js/extension-all.json"), evidence $(evid "$OUT/js/extension-all.json")"
}

step_deep() {
  local split="$OUT/deep/split"
  if [ ! -f "$split/manifest.json" ]; then
    log "DEEP-1 splitting background.js into bundled modules"
    node --max-old-space-size="$HEAP_MB" "$ROOT/tools/split-bundle.mjs" "$EXT/background.js" "$split" "$BATCH_BYTES" > "$OUT/logs/deep-split.out" 2>&1
    status "DEEP-1 split: exit $?, $(cat "$OUT/logs/deep-split.out" | tail -1)"
  fi
  local n i
  n=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['batches']))" "$split/manifest.json")
  for (( i=0; i<n; i++ )); do
    local tag; tag=$(printf 'batch%03d' "$i")
    [ -f "$OUT/deep/$tag.summary.json" ] && continue        # resume: finished batches are skipped
    local args=(); while IFS= read -r f; do args+=(--source-path "$f"); done < <(python3 -c "import json,sys;print('\n'.join(json.load(open(sys.argv[1]))['batches'][int(sys.argv[2])]))" "$split/manifest.json" "$i")
    log "DEEP-2 $tag ($((i+1))/$n, ${#args[@]} args)"
    NODE_OPTIONS="--max-old-space-size=$HEAP_MB" "$REA" analyze-javascript-application "$split" "${args[@]}" \
      --max-heap-mb "$HEAP_MB" --analysis-timeout-ms "$TIMEOUT_MS" --max-semantic-nodes "$NODES" --max-semantic-nodes-per-file 200000 \
      "${common[@]}" > "$OUT/deep/$tag.json" 2> "$OUT/logs/deep-$tag.err"
    local rc=$?
    local line; line=$(python3 "$ROOT/tools/rea_batch_summary.py" "$OUT/deep/$tag.json" "$OUT/deep/$tag.summary.json" 2>&1 | tail -1)
    gzip -f "$OUT/deep/$tag.json"
    status "DEEP-2 $tag: exit $rc; $line; kept $(size "$OUT/deep/$tag.json.gz") gzipped"
  done
}

step_har() {
  local caps=() f
  for f in "$NL"/*.har "$OUT"/record/*.har; do [ -f "$f" ] && caps+=("$f"); done
  log "HAR preparing ${#caps[@]} captures (parts up to $PART_BYTES bytes)"
  rm -rf "$OUT/har/parts" "$OUT/har/surface" 2>/dev/null
  python3 "$ROOT/tools/rea_har_prep.py" "$OUT/har" "${caps[@]}" | tee -a "$STATUS"
  for f in "$OUT"/har/parts/*.har; do
    local n; n="$(basename "$f" .har)"
    "$REA" inspect-web-network-capture "$f" har --format json > "$OUT/har/$n.capture.json" 2> "$OUT/logs/har-$n.err"
    local rc=$?
    python3 - "$OUT/har/surface/$n.har" "$OUT/har/$n.view-input.json" "$REA" <<'PY' > "$OUT/har/$n.api-surface.json" 2>> "$OUT/logs/har-$n.err"
import json, subprocess, sys
src, view, rea = sys.argv[1:4]
ev = json.loads(subprocess.run([rea, "inspect-web-network-capture", src, "har", "--format", "json"], capture_output=True, text=True).stdout)
json.dump({"source": {"kind": "inline", "evidence": ev},
           "view": {"kind": "api-surface", "offset": 0, "limit": 5000, "include_query_parameter_names": True}}, open(view, "w"))
print(subprocess.run([rea, "inspect-analysis-view", view, "--format", "json"], capture_output=True, text=True).stdout)
PY
    rm -f "$OUT/har/$n.view-input.json" 2>/dev/null
    status "HAR $n: capture exit $rc, evidence $(evid "$OUT/har/$n.capture.json"), $(size "$OUT/har/$n.capture.json"); api-surface $(size "$OUT/har/$n.api-surface.json")"
  done
}

step_record() {
  local chromium
  chromium="$(find "$ROOT/tools/browsers" -path '*Chromium.app/Contents/MacOS/Chromium' 2>/dev/null | head -1)"
  [ -n "$chromium" ] || { status "RECORD skipped: Playwright Chromium not found under tools/browsers"; return; }
  status "RECORD launching Chromium with Trust Wallet 26.41.0 in a throwaway profile ($OUT/record/profile)"
  "$chromium" --user-data-dir="$OUT/record/profile" --load-extension="$EXT" --disable-extensions-except="$EXT" \
    --no-first-run --no-default-browser-check "chrome://extensions" >/dev/null 2>&1 &
  cat <<TXT

  In the Chromium window that just opened:
  1. On chrome://extensions turn on Developer mode, then on Trust Wallet click "service worker" to open its DevTools.
  2. In that DevTools: Settings (gear) > Preferences > Network > tick "Allow to generate HAR with sensitive data".
     Network tab: tick "Preserve log" and "Disable cache".
  3. Use a TEST wallet with a few dollars only. Record one file per flow:
       swap.har        a small swap          receive.har    receive a small transfer and wait for it to appear
       dapp-sign.har   approve a dApp tx     homepage.har   open home, discover, earn and settings
     Save each with right-click > "Save all as HAR (with sensitive data)" into:  $OUT/record/
  4. Then run:  bash "$0" har
  These files contain the test device's credentials. Keep them in the REA folder; never share or commit them.

TXT
}

[ "$STEP" = "status" ] && { cat "$STATUS"; exit 0; }
preflight
case "$STEP" in
  js) step_js ;;
  app) step_app ;;
  deep) step_deep ;;
  har) step_har ;;
  record) step_record ;;
  all) step_app; step_deep; step_har; status "Done." ;;
  *) echo "Unknown step: $STEP (use all | js | app | deep | har | record | status)"; exit 2 ;;
esac
log "Finished step '$STEP'. Summary: $STATUS"
