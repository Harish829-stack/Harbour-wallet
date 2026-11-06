# Backend/API evidence — supplied extension v26.41.0

Date: 2026-10-21. User-requested cross-cutting backend investigation. This does not close chronological feature gates or add implemented wallet coverage.

Main deliverable: [TRUST-WALLET-BACKEND.md](../../../TRUST-WALLET-BACKEND.md).

## Evidence registry

| Source bundle | Evidence ID | Recovered file | Scope |
|---|---|---|---|
| background-00 | `ev_04558a4be1e14b43f88e400bf39865182621df2e1a6e0368775356e570fd68d2` | [recovery/background-00/modules/bundle.js](recovery/background-00/modules/bundle.js) | SDK host/config, endpoint builders and chain clients |
| background-01 | `ev_42666e75c12b0be2250a3313c192e7e8c6d8625579a7621868727f858e13c64c` | [recovery/background-01/modules/bundle.js](recovery/background-01/modules/bundle.js) | Empty after whole-node credential omission; deliberately not substantive proof |
| background-02 | `ev_47d21ae37c7ed001624b05f9c07c8f1f0287883bf47ece0009a3c3b3eb1079ef` | [recovery/background-02/modules/bundle.js](recovery/background-02/modules/bundle.js) | Tronify builders |
| background-03 | `ev_497471caf71a278a9eb143b009e37c74de73560f0799986e0381bed77421e9c8` | [recovery/background-03/modules/bundle.js](recovery/background-03/modules/bundle.js) | SDK client/query/serializer fragments; bundled feature reachability unknown |
| background-04 | `ev_12717f9383e0248dbf27c01f2816b7c43ec7406847dd40f76d1f5d145b4b3cfd` | [recovery/background-04/modules/bundle.js](recovery/background-04/modules/bundle.js) | SQLite schema, migrations, drivers and save/load coroutines |
| background-05 | `ev_0566e17732250b791e8179018b916fe06745da732abf8d50736a0d5bcd2e37fc` | [recovery/background-05/modules/bundle.js](recovery/background-05/modules/bundle.js) | ApiService, gateway auth and transport-adjacent clients |
| background-06 | `ev_09922a806dc2f1e1d1cf1bfd56b07d67f50e1c4c8c28c0dadd82f03c66cb0978` | [recovery/background-06/modules/bundle.js](recovery/background-06/modules/bundle.js) | Other client providers and relay/swap functions; credential-bearing nodes omitted |
| database-0 | `ev_6e2591568b491db7c502fa052d2df11cbadcafff238a7211dbfc769854faf184` | [recovery/database-0/modules/bundle.js](recovery/database-0/modules/bundle.js) | SQL init, deflate/base64 Chrome storage helpers |
| focus-0 | `ev_5c9181e8749cbfa3853ca606c9c9e00cfc49d0e26e03004907e68f95d4b57094` | [recovery/focus-0/modules/bundle.js](recovery/focus-0/modules/bundle.js) | Exact safe expressions recovered from omitted comma-sequences |
| focus-1 | `ev_e14dab1cb94a0d966005a73be71cc8103c40a96200590515d6b2ba50c4cc6817` | [recovery/focus-1/modules/bundle.js](recovery/focus-1/modules/bundle.js) | Auth/transport, SDK boot, ticker and balance services |
| focus-extra-0 | `ev_d6181662c7e4399e84db9eed5ed811d1f94258616cc62d5d1bc593bd97baf99e` | [recovery/focus-extra-0/modules/bundle.js](recovery/focus-extra-0/modules/bundle.js) | Repeat of focus-0 bytes; not independent confirmation |
| focus-extra-1 | `ev_bb2fee8950427b417d5bfcad476096cb3a5a6661a4f9b9c6ae4a4c97f40b52a6` | [recovery/focus-extra-1/modules/bundle.js](recovery/focus-extra-1/modules/bundle.js) | Additional swap, device, balance stream/feed and transport config |
| transport-0 | `ev_738956378b937de1e1bf3f52338c12a967582d91b9e0c2ae15d9ce99d746c6df` | [recovery/transport-0/modules/bundle.js](recovery/transport-0/modules/bundle.js) | Storage adapter, SafeMethod, balance retry config and WebSocket protocol |

Final HAR projection Evidence: `ev_f111b0cb05bc5e98d8083c8cd20c329dd90da77f812dc080d227210adeb457e3`; parent `ev_3a18dda05b8885ef28c227f014975847c8acb3cf75ba8ef4a21ccd9579e6eedf`; [har-rea-final.json](har-rea-final.json). REA decoded all 5,216 projected records. This validates the derivative container; schema extraction and source attribution remain separate analyst operations.

Manifest-only REA application inventory: [inventory-rea.json](inventory-rea.json). It parsed no JS and leaves 244 inventoried relevant files unselected; it is not whole-source semantic proof. The independent Babel discovery pass parsed all 238 JS files; the bounded REA recoveries above provide readable target-derived code.

## Provenance and correspondence

- Original target: `samples/trustwallet-extension/26.41.0_0/26.41.0_0/`. [provenance.json](provenance.json) records exact file hashes, size, manifest/public-key-derived ID, environment and reference-copy equality. Official CRX signature remains UNKNOWN.
- [discovery.json](discovery.json), [focus-ranges.json](focus-ranges.json), [focus-extra-ranges.json](focus-extra-ranges.json), [transport-ranges.json](transport-ranges.json), [database-ranges.json](database-ranges.json) bind every selected fragment to original SHA-256 and zero-based half-open UTF-8 byte ranges. Variable declarators are prefixed with `var `; fragments end in `;\n`. Comma-sequence expressions may be separated into independent source statements. Wrappers/separators are recorded explicitly.
- `inputs/` retains exact selected input bytes. `recovery/<name>/inputs`, `modules/bundle.js`, source maps, manifest and reports are the actual REA output. Raw `<name>-rea.json` records remain alongside them. `/output/` paths in Docker Evidence map to this directory; no analysis source is left only in a container.
- Recovery standard rewrites and synthetic names are aids; original names and runtime equivalence remain unknown. Disconnected slices can contain unresolved identifiers. Do not execute recovered bundles as application replacements.
- Credential-like literal nodes were omitted entirely, not rewritten as fake source. [credential-omission-audit.json](credential-omission-audit.json) and discovery excludedCredentialNodes track selection limitations. Safe independent expressions from some omitted sequences were recovered with their own exact ranges. No captured device/session/hash-key values are copied.
- Analysis programs are archived under [analysis-scripts/](analysis-scripts/README.md); the workspace originals are under tools/.

## Tools and commands actually used

No tools were installed or upgraded. Node v22.22.3, local REA CLI 6.5.0, Linux Wakaru 1.14.0. Pinned offline Docker image: `sha256:8b8694b18f00e42c6bdf2a26eda3daad9c0ea2ee17c3f98464e0624438152403`. Each recovery manifest records executable SHA-256/options. Existing WABT 1.0.42 audit was consulted for historical SQL WASM context; no new Wallet Core internals were investigated.

Executed orchestration order (initial helper repairs/corrections described below):

```sh
node --max-old-space-size=6144 tools/inventory-backend.mjs
python3 tools/sanitize-backend-inputs.py
node --max-old-space-size=6144 tools/extract-backend-focus.mjs
node --max-old-space-size=6144 tools/extract-backend-extra.mjs
node --max-old-space-size=6144 tools/extract-backend-transport.mjs
node --max-old-space-size=6144 tools/extract-backend-database.mjs
node --max-old-space-size=6144 tools/backend-network-sinks.mjs
python3 tools/backend-har-contracts.py
python3 tools/backend-header-hints.py
node tools/verify-backend-auth.mjs
node tools/build-backend-catalog.mjs
python3 tools/verify-backend-evidence.py
```

Every recovered input passed node --check. For a repeat of one source recovery choose a NEW ABSENT output directory with an existing parent; never overwrite these deposited results:

```sh
docker run --rm --platform linux/amd64 --network none --cap-drop ALL --security-opt no-new-privileges \
  --mount type=bind,source=/Users/jatinsharma/Desktop/REA/evidence/40-backend-api/2026-10-21,target=/output \
  sha256:8b8694b18f00e42c6bdf2a26eda3daad9c0ea2ee17c3f98464e0624438152403 \
  recover-javascript-sources /output/inputs/transport-0.js /output/recovery/transport-repeat --format json
```

REA MCP `inspect_web_network_capture` used capture_path=the absolute network-projection.har path, format=har, detail=summary. `analyze_javascript_application` used the supplied target directory, source_paths=[manifest.json], detail=summary. No remote URL was fetched.

## Captures, transformations and limits

- [har-contracts.json](har-contracts.json) records all six original capture paths, SHA-256, sizes and accepted record counts. Captures are local historical inputs; their extension version and action attribution were not independently authenticated.
- network-log.har is malformed/truncated at character 151300000. Complete-prefix parsing accepted 3467 entries and stopped at character 151289122, excluding 10878 trailing characters. No original bytes were repaired or changed.
- network-projection.har retains source filename/ordinal, HTTP method, templated URL, query key names, status, MIME type and safe RPC method names. Headers/cookies/query values/body values/binary content are omitted. URLs percent-encode template braces so the HAR URI schema remains valid.
- JSON shapes retain types/keys, array lengths and up to 20 distinct item shapes per array, with omitted counts. NDJSON lines are grouped into an ANALYSIS array; this is not their wire format. Non-JSON bodies and unparseable data have no inferred schema. [HAR-SCHEMAS.md](HAR-SCHEMAS.md) collapses equivalent human-readable shapes; machine variants are preserved in JSON.
- [chain-capabilities.json](chain-capabilities.json) is a separate allowlisted extraction of public fields from E2E capture ordinal 18: 108 chain rows; stats total=108, enabled=86, db_lookup_enabled=49, ws_supported=49. No account or credential fields are retained.
- Static inventory comprises 795 first-pass path occurrences plus 7 supplementary occurrences (including v2.1 and relative Tron event paths), for 802 original locations. [static-supplement.json](static-supplement.json) and [network-sinks.json](network-sinks.json) are inert discovery aids, not proof of reachable HTTP calls. Dynamic Ktor/minified DSL calls, remote config and unsampled runtime paths remain incomplete.

Allowlisted server/cache/x-powered-by hints are in [server-header-hints.json](server-header-hints.json). These are historical header observations only; proxy names or an Express header on a chain node do not establish the gateway origin stack or DB.

## Failures and dated corrections

1. Initial Docker socket access was sandbox-denied. Scoped escalated access to the existing pinned image succeeded; no Docker or MCP configuration was changed.
2. First recovery failed with output parent unavailable. Created recovery/ and repeated the identical operation successfully. An empty background-01 after node omission is retained and explicitly has no substantive findings.
3. First HAR adapter attempt rejected unencoded template braces as invalid URI. Percent-encoded them and retried successfully. [har-rea-summary.json](har-rea-summary.json) preserves the failure.
4. A path-normalization rule initially conflated the literal fingerprint endpoint with a device-ID placeholder. Corrected the reserved literal before final catalogues. The earlier sanitized projection is archived in network-projection-before-fingerprint-correction.har with the digest in har-rea-success.json; it is superseded by network-projection.har and har-rea-final.json.
5. Expanded literal-credential omission to include provider defaults whose variable names contain dollar signs and project-ID literals. Regenerated affected bounded recoveries. The final source/range verifier checks current manifests only; these omissions do not imply the provider code was absent in the original.

## Verification and honest readiness

[verification.json](verification.json) records source/hash/link checks; [auth-fixtures.json](auth-fixtures.json) records six controlled exact-function checks with public synthetic inputs and explicit Node-crypto substitution. No complete extension wallet was started, no real wallet data used, no private key/seed/password captured, no live gateway/RPC test performed and no server deployed. There is no observed successful live API or complete-server-equivalence claim.

Build readiness: Partial for the overall backend specification. Server DB/framework/topology, issuance/authorization rules, risk/routing algorithms, all populated responses, WebSocket channel policy and all enabled feature paths require further authorized evidence. See the main document for the implementer-facing gap list.
