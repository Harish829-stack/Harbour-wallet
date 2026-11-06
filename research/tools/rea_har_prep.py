#!/usr/bin/env python3
"""Prepare HAR captures for REA without losing records.

For each input HAR:
  * truncated files: recover the log header fields that parse and every complete entry (reported in the manifest)
  * minimal schema fix: drop an empty or invalid `serverIPAddress` (REA's HAR schema rejects it); every changed ordinal is listed
  * lossless split into parts under PART_BYTES (default 28 MiB, below REA's 32 MiB input limit), original ordinals kept in the manifest
  * a "surface" copy of each part without `_initiator` stacks and bodies, used only for REA's api-surface grouping view

Usage: rea_har_prep.py OUT_DIR capture1.har [capture2.har ...]
"""
import hashlib, ipaddress, json, os, sys

PART_BYTES = int(os.environ.get("PART_BYTES", 28 * 1024 * 1024))


def load(path):
    raw = open(path, encoding="utf-8", errors="surrogateescape").read()
    try:
        return json.loads(raw), "complete"
    except json.JSONDecodeError:
        pass
    i = raw.find('"entries"')
    j = raw.find("[", i) + 1
    dec = json.JSONDecoder()
    entries = []
    while j < len(raw):
        while j < len(raw) and raw[j] in " \r\n\t,":
            j += 1
        if j >= len(raw) or raw[j] != "{":
            break
        try:
            e, j = dec.raw_decode(raw, j)
        except json.JSONDecodeError:
            break
        entries.append(e)
    log = {"version": "1.2", "creator": {"name": "WebInspector", "version": "537.36"}, "pages": [], "entries": entries}
    return {"log": log}, f"truncated: {len(entries)} complete entries recovered, stopped at byte {j} of {len(raw)}"


def fix_ip(entries):
    changed = []
    for n, e in enumerate(entries):
        if "serverIPAddress" in e:
            v = str(e["serverIPAddress"]).strip("[]")
            try:
                ipaddress.ip_address(v)
                e["serverIPAddress"] = v
            except ValueError:
                del e["serverIPAddress"]
                changed.append(n)
    return changed


def surface(entry):
    e = json.loads(json.dumps(entry))
    e.pop("_initiator", None)
    c = e.get("response", {}).get("content", {})
    if "text" in c:
        c["text"] = ""
        c.pop("encoding", None)
    p = e.get("request", {}).get("postData")
    if p and "text" in p:
        p["text"] = ""
    e.pop("_webSocketMessages", None)
    return e


def main():
    out = sys.argv[1]
    os.makedirs(os.path.join(out, "parts"), exist_ok=True)
    os.makedirs(os.path.join(out, "surface"), exist_ok=True)
    manifest = []
    for src in sys.argv[2:]:
        name = os.path.splitext(os.path.basename(src))[0]
        sha = hashlib.sha256(open(src, "rb").read()).hexdigest()
        d, state = load(src)
        log = d["log"]
        entries = log.get("entries", [])
        changed = fix_ip(entries)
        header = {k: v for k, v in log.items() if k != "entries"}
        parts, cur, size, start = [], [], 0, 0
        for n, e in enumerate(entries):
            s = len(json.dumps(e))
            if cur and size + s > PART_BYTES:
                parts.append((start, cur)); start, cur, size = n, [], 0
            cur.append(e); size += s
        if cur:
            parts.append((start, cur))
        files = []
        for k, (first, chunk) in enumerate(parts):
            fn = f"{name}.part{k:02d}.har"
            json.dump({"log": {**header, "entries": chunk}}, open(os.path.join(out, "parts", fn), "w", encoding="utf-8"))
            json.dump({"log": {**header, "entries": [surface(e) for e in chunk]}}, open(os.path.join(out, "surface", fn), "w", encoding="utf-8"))
            files.append({"file": fn, "first_ordinal": first, "last_ordinal": first + len(chunk) - 1})
        manifest.append({"source": src, "sha256": sha, "state": state, "entries": len(entries),
                         "server_ip_removed_ordinals": changed, "parts": files})
        print(f"{name}: {state}; {len(entries)} entries; {len(changed)} IP fields removed; {len(files)} part(s)")
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
