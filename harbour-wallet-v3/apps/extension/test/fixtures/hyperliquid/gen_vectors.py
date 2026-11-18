"""Regenerates vectors.json with the OFFICIAL hyperliquid-python-sdk (pinned). The vectors are the reference for test/hyperliquid-golden.test.js.

    python3 -m venv v && ./v/bin/pip install hyperliquid-python-sdk==0.24.0
    ./v/bin/python gen_vectors.py          # writes vectors.json next to this file

The key below is a public test key. Never put a real key here.
"""
import json, os, eth_account
from hyperliquid.utils.signing import (order_request_to_order_wire, order_wires_to_order_action, action_hash, sign_l1_action,
                                       user_signed_payload, sign_inner, WITHDRAW_SIGN_TYPES)

KEY = "0x" + "11" * 32
w = eth_account.Account.from_key(KEY)
N = 1700000000000
out = {"key": KEY, "address": w.address, "l1": [], "user": []}

def ow(px, sz, buy=True, ro=False, tif="Gtc", asset=1):
    return order_request_to_order_wire({"coin": "X", "is_buy": buy, "sz": sz, "limit_px": px, "order_type": {"limit": {"tif": tif}}, "reduce_only": ro}, asset)

BUILDER = {"b": "0xabcdef0123456789abcdef0123456789abcdef01", "f": 10}
cases = [
    ("order_basic", order_wires_to_order_action([ow(2000.5, 0.1234)]), dict(kind="order", asset=1, isBuy=True, price=2000.5, size=0.1234, reduceOnly=False, tif="Gtc", szDec=4, builder=None)),
    ("order_builder", order_wires_to_order_action([ow(2000.5, 0.1234)], BUILDER), dict(kind="order", asset=1, isBuy=True, price=2000.5, size=0.1234, reduceOnly=False, tif="Gtc", szDec=4, builder=BUILDER)),
    ("order_int_px_trailing", order_wires_to_order_action([ow(100.0, 1.0, False, True, "Ioc", 0)]), dict(kind="order", asset=0, isBuy=False, price=100.0, size=1.0, reduceOnly=True, tif="Ioc", szDec=5, builder=None)),
    ("cancel", {"type": "cancel", "cancels": [{"a": 1, "o": 123456}]}, dict(kind="cancel", asset=1, oid=123456)),
    ("leverage", {"type": "updateLeverage", "asset": 1, "isCross": True, "leverage": 5}, dict(kind="leverage", asset=1, isCross=True, leverage=5)),
]
for name, action, spec in cases:
    for mainnet in (True, False):
        out["l1"].append(dict(name=f"{name}_{'main' if mainnet else 'test'}", spec=spec, action=action, nonce=N, mainnet=mainnet,
                              hash="0x" + action_hash(action, None, N, None).hex(), sig=sign_l1_action(w, action, None, N, None, mainnet)))

CH = "0xa4b1"  # Harbour's signatureChainId (the SDK uses 0x66eee; any chain is valid for user-signed actions)
def us(name, primary, types, action):
    a = dict(action); a["signatureChainId"] = CH; a["hyperliquidChain"] = "Mainnet"
    out["user"].append(dict(name=name, type=action["type"], fields={k: v for k, v in action.items() if k != "type"}, sig=sign_inner(w, user_signed_payload(primary, types, a))))
T = lambda *p: [{"name": n, "type": t} for n, t in p]
AGENT = T(("hyperliquidChain", "string"), ("agentAddress", "address"), ("agentName", "string"), ("nonce", "uint64"))
us("agent_named", "HyperliquidTransaction:ApproveAgent", AGENT, {"type": "approveAgent", "agentAddress": "0x2222222222222222222222222222222222222222", "agentName": "harbour", "nonce": N})
us("agent_noname", "HyperliquidTransaction:ApproveAgent", AGENT, {"type": "approveAgent", "agentAddress": "0x2222222222222222222222222222222222222222", "agentName": "", "nonce": N})
us("builder_fee", "HyperliquidTransaction:ApproveBuilderFee", T(("hyperliquidChain", "string"), ("maxFeeRate", "string"), ("builder", "address"), ("nonce", "uint64")),
   {"type": "approveBuilderFee", "maxFeeRate": "0.1%", "builder": BUILDER["b"], "nonce": N})
for nm, dest in (("withdraw_checksum", w.address), ("withdraw_lower", w.address.lower())):
    us(nm, "HyperliquidTransaction:Withdraw", WITHDRAW_SIGN_TYPES, {"type": "withdraw3", "destination": dest, "amount": "12.5", "time": N})
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vectors.json"), "w"), separators=(",", ":"))
