# qa/tools
- `gen-index.mjs <repo-root> <out-dir>`: extracts INTERNAL message handlers, provider methods, Go functions, HTTP routes and DB objects (with file:line) into TSV files.
- `gen-partc.mjs <out-dir>`: turns those TSVs (plus `ext-exports.txt`, produced by the grep in Phase 1) into Part C of FEATURE_INVENTORY.md.
- `FEATURE_INVENTORY.partAB.md`: the hand-written Parts A and B; FEATURE_INVENTORY.md = partAB + generated Part C.
Re-run after code changes so the inventory never drifts from source.
