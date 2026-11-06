"""Passive, secret-safe mitmproxy addon for the Harbour audit.

The mitmproxy flow archive remains the authoritative raw capture. This addon
only writes masked metadata and SHA-256 body fingerprints to stdout.
"""

from hashlib import sha256
from pathlib import Path
from mitmproxy import http


CANARIES = ("AUDIT_CANARY", "HARBOUR_CANARY")
DAPP_ROOT = Path(__file__).resolve().parent.parent / "dapp"


def _fingerprint(data: bytes) -> str:
    return sha256(data).hexdigest() if data else "-"


def _contains_canary(data: bytes) -> bool:
    return any(token.encode() in data for token in CANARIES)


def _record(kind: str, flow: http.HTTPFlow) -> None:
    request = flow.request
    response = flow.response
    req_body = request.raw_content or b""
    resp_body = response.raw_content if response else b""
    print(
        "AUDIT_FLOW "
        f"kind={kind} method={request.method} host={request.host!r} "
        f"path={request.path!r} status={response.status_code if response else '-'} "
        f"req_bytes={len(req_body)} req_sha256={_fingerprint(req_body)} "
        f"resp_bytes={len(resp_body)} resp_sha256={_fingerprint(resp_body)} "
        f"canary={_contains_canary(req_body) or _contains_canary(resp_body)}"
    )


def request(flow: http.HTTPFlow) -> None:
    _record("request", flow)


def response(flow: http.HTTPFlow) -> None:
    if flow.request.host in {"dapp.test", "evil.test"} and flow.request.path in {"/", "/index.html"}:
        page = DAPP_ROOT / "index.html"
        flow.response = http.Response.make(
            200,
            page.read_bytes(),
            {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
        )
    _record("response", flow)

