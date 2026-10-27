#!/usr/bin/env python3
"""Condense one REA analyze-javascript-application result into a small summary (the full result is kept gzipped).

Keeps: evidence id, statistics, coverage, application-graph endpoints/storage/workers, semantic node and relation
counts, and every semantic node whose text mentions a network, storage, socket or messaging boundary.
Usage: rea_batch_summary.py result.json summary.json
"""
import collections, json, re, sys

HINT = re.compile(r"https?:|wss?:|/v[0-9]+(\.[0-9]+)?/|fetch|storage\.|indexedDB|WebSocket|postMessage|runtime\.(connect|sendMessage)|chrome\.|naas|gateway|centrifugo|sql|CREATE TABLE", re.I)

d = json.load(open(sys.argv[1]))
if "normalized_result" not in d:
    json.dump({"error": d}, open(sys.argv[2], "w"))
    sys.exit(0)
nr = d["normalized_result"]
sg = nr.get("semantic_graph", {})
out = {
    "evidence_id": d.get("evidence_id"),
    "selected": nr.get("source_selection", {}).get("requested_paths", []),
    "statistics": nr.get("statistics"),
    "graph_coverage": nr.get("graph", {}).get("coverage"),
    "semantic_coverage": {k: v for k, v in sg.get("coverage", {}).items() if k in ("status", "truncated", "omitted_nodes", "omitted_relations")},
    "app_nodes": [],
    "semantic_node_kinds": collections.Counter(n.get("kind") for n in sg.get("nodes", [])),
    "relation_kinds": collections.Counter(r.get("relation") for r in sg.get("relations", [])),
    "boundary_nodes": [],
    "unknowns": len(sg.get("unknowns", [])),
}
for n in nr.get("graph", {}).get("nodes", []):
    if n.get("kind") in ("endpoint", "storage", "worker", "channel", "route"):
        obs = (n.get("observations") or [{}])[0]
        out["app_nodes"].append({"kind": n["kind"], "key": n.get("identity", {}).get("key"), "properties": obs.get("properties")})
for n in sg.get("nodes", []):
    if n.get("kind") == "module":
        continue
    if n.get("kind") in ("boundary", "event", "listener", "timer", "literal") or HINT.search(json.dumps(n.get("label")) + json.dumps(n.get("properties"))):
        ident = n.get("identity", {})
        out["boundary_nodes"].append({"kind": n.get("kind"), "module": ident.get("module_path"), "label": n.get("label"),
                                      "properties": json.dumps(n.get("properties"))[:400]})
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(f'{out["evidence_id"]} files={out["statistics"] and out["statistics"].get("parsed_javascript_files")} '
      f'nodes={sum(out["semantic_node_kinds"].values())} relations={sum(out["relation_kinds"].values())} '
      f'truncated={out["semantic_coverage"].get("truncated")} boundary={len(out["boundary_nodes"])}')
