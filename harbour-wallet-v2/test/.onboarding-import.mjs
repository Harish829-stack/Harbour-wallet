var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/importKey.ts
var MAX_WALLETS = 30;
var WALLET_LIMIT_ERROR = "MAX_WALLETS";
var canCreateWallet = (count) => count < MAX_WALLETS;
var PRIVATE_KEY_MIN_LENGTH = 8;
var MAX_WALLET_NAME = 40;
function classifySecret(input) {
  const t = String(input ?? "").trim();
  if (!t) return "empty";
  const tokens = t.split(/\s+/);
  return tokens.length === 1 && t.length > PRIVATE_KEY_MIN_LENGTH ? "privateKey" : "mnemonic";
}
var normalizeMnemonic = (s) => String(s ?? "").trim().split(/\s+/).join(" ").toLowerCase();
var mnemonicWordCount = (s) => String(s ?? "").trim() ? String(s).trim().split(/\s+/).length : 0;
function mnemonicLengthState(s) {
  const n = mnemonicWordCount(s);
  if (n > 24) return "toolong";
  return n === 12 || n === 18 || n === 24 ? "ok" : "short";
}
function defaultWalletName(existing) {
  const used = existing.map((n2) => /^Main wallet(?: (\d+))?$/.exec(n2)).filter((m) => !!m).map((m) => Number(m[1] || 1));
  if (!used.length) return "Main wallet";
  let n = 1;
  while (used.includes(n)) n++;
  return n === 1 ? "Main wallet" : `Main wallet ${n}`;
}
function validateWalletName(name, existing) {
  const t = String(name ?? "").trim();
  if (!t) return { isValid: false, error: "Enter a wallet name" };
  if (t.length > MAX_WALLET_NAME) return { isValid: false, error: `Use at most ${MAX_WALLET_NAME} characters` };
  if (existing.includes(t)) return { isValid: false, error: "Wallet name already exists" };
  return { isValid: true };
}
var isHex = (s) => s.length > 0 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s);
var coreCodec = (core) => ({
  hexToBytes: (h) => core.HexCoding.decode(h),
  base58Decode: (s) => {
    try {
      return core.Base58.decodeNoCheck(s);
    } catch {
      return null;
    }
  },
  bech32Decode: (s) => {
    try {
      return core.Bech32.decode(s);
    } catch {
      return null;
    }
  }
});
function decodePrivateKeyBytes(input, solana, codec) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const s = raw.replace(/^0x/i, "");
  try {
    if (solana) {
      const b2 = codec.base58Decode(s);
      return b2 && (b2.length === 32 || b2.length === 64) ? b2.slice(0, 32) : null;
    }
    if (isHex(s)) return codec.hexToBytes(s);
    const b = codec.bech32Decode(s);
    return b && b.length > 1 ? b.slice(1) : null;
  } catch {
    return null;
  }
}
function validatePrivateKey(core, input, coinName) {
  const none = { isValid: false, bytes: new Uint8Array() };
  const coin = core?.CoinType?.[coinName];
  if (!coin) return none;
  const bytes2 = decodePrivateKeyBytes(input, coinName === "solana", coreCodec(core));
  if (!bytes2) return none;
  try {
    return { isValid: !!core.PrivateKey.isValid(bytes2, core.CoinTypeExt.curve(coin)), bytes: bytes2 };
  } catch {
    return none;
  }
}
var EVM_FAMILY = "Ethereum";
var POPULAR_ORDER = ["smartchain", "ethereum", "solana", "tron", "arbitrum", "base", "bitcoin", "robinhoodchain", "arc"];
var GROUP_ICONS = ["ethereum", "smartchain", "base", "arbitrum"];
var EXCLUDED_IDS = /* @__PURE__ */ new Set(["decred"]);
var nameOf = (c) => c.name;
var matches = (c, q) => nameOf(c).toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
var popularRank = (c) => {
  const i = POPULAR_ORDER.indexOf(c.id);
  return i === -1 ? POPULAR_ORDER.length : i;
};
function privateKeyNetworkOptions(chains, query) {
  const q = query.trim().toLowerCase();
  const usable = chains.filter((c) => !c.testnet && !EXCLUDED_IDS.has(c.id));
  const evm = usable.filter((c) => c.blockchain === EVM_FAMILY);
  const others = usable.filter((c) => c.blockchain !== EVM_FAMILY);
  const out = [];
  const hit = q ? evm.find((c) => matches(c, q)) : void 0;
  if (evm.length && (!q || q.includes("evm") || hit)) {
    out.push(hit ? { kind: "evm-group", id: "evm:group", chainId: "ethereum", label: `${nameOf(hit)} & EVM chains`, iconIds: [hit.id] } : { kind: "evm-group", id: "evm:group", chainId: "ethereum", label: "EVM chains", iconIds: GROUP_ICONS.filter((id) => evm.some((c) => c.id === id)) });
  }
  const list = others.filter((c) => !q || matches(c, q)).sort((a, b) => popularRank(a) - popularRank(b) || nameOf(a).localeCompare(nameOf(b)));
  for (const c of list) out.push({ kind: "chain", id: c.id, chainId: c.id, label: nameOf(c), iconIds: [c.id] });
  return out;
}
var evmFamily = (chains) => chains.filter((c) => c.blockchain === EVM_FAMILY && c.kind === "evm");
var sameAddr = (a, b) => a === b || a.startsWith("0x") && b.startsWith("0x") && a.toLowerCase() === b.toLowerCase();
function hasDuplicateAddress(wallets, coinName, address) {
  if (!address) return false;
  for (const w of Object.values(wallets ?? {})) {
    const accts = Array.isArray(w?.accounts) && w.accounts.length ? w.accounts : [{ addresses: w?.addresses }];
    for (const a of accts) {
      const have = a?.addresses?.[coinName];
      if (have && sameAddr(have, address)) return true;
    }
  }
  return false;
}
function pickSolanaVariants(history) {
  if (!history) return ["default"];
  const [d, p] = history;
  if (d && p) return ["default", "phantom"];
  if (d) return ["default"];
  return ["phantom"];
}
async function solanaHasHistory(addresses, rpcUrls, f = fetch) {
  const ask = async (address) => {
    let last = new Error("no RPC endpoint");
    for (const u of rpcUrls) {
      try {
        const res = await f(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [address, { limit: 1 }] }), signal: AbortSignal.timeout(8e3) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!Array.isArray(j?.result)) throw new Error(j?.error?.message ?? "bad response");
        return j.result.length > 0;
      } catch (e) {
        last = e;
      }
    }
    throw last;
  };
  return Promise.all(addresses.map(ask));
}
var IMPORT_ERRORS = {
  duplicateMnemonic: "This secret phrase is already in Harbour",
  duplicateKey: "Wallet with such account already exists",
  invalidKey: "Invalid private key",
  invalidMnemonic: "Invalid Secret Phrase",
  mnemonicLength: "Secret Phrase must be 12, 18 or 24 words",
  limit: `You can have up to ${MAX_WALLETS} wallets`,
  expired: "Your import session expired. Enter the secret again."
};

// src/core/onboardingRules.ts
var onboardingRules_exports = {};
__export(onboardingRules_exports, {
  CAMERA_MESSAGES: () => CAMERA_MESSAGES,
  ONBOARDING_EVENT_THROTTLE_MS: () => ONBOARDING_EVENT_THROTTLE_MS,
  ONBOARDING_IDLE_MS: () => ONBOARDING_IDLE_MS,
  QR_PARSE_ERROR: () => QR_PARSE_ERROR,
  QR_SCAN_INTERVAL_MS: () => QR_SCAN_INTERVAL_MS,
  STEP_KEY: () => STEP_KEY,
  cameraErrorKind: () => cameraErrorKind,
  createIdleGuard: () => createIdleGuard,
  onboardingMode: () => onboardingMode,
  restoreStep: () => restoreStep,
  serializeStep: () => serializeStep
});
var ONBOARDING_IDLE_MS = 6e5;
var ONBOARDING_EVENT_THROTTLE_MS = 500;
var QR_SCAN_INTERVAL_MS = 80;
function createIdleGuard(o) {
  const timeout = o.timeout ?? ONBOARDING_IDLE_MS;
  const throttle = o.throttle ?? ONBOARDING_EVENT_THROTTLE_MS;
  const now = o.now ?? Date.now;
  const set = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clear = o.clearTimer ?? ((h) => clearTimeout(h));
  let handle = null;
  let last = -Infinity;
  let running = false;
  const arm = () => {
    if (handle != null) clear(handle);
    handle = set(() => {
      handle = null;
      if (running) o.onIdle();
    }, timeout);
  };
  return {
    start() {
      running = true;
      last = now();
      arm();
    },
    activity() {
      if (!running) return;
      const t = now();
      if (t - last < throttle) return;
      last = t;
      arm();
    },
    pause() {
      running = false;
      if (handle != null) {
        clear(handle);
        handle = null;
      }
    },
    get running() {
      return running;
    }
  };
}
function onboardingMode(s) {
  if (!s.hasVault) return "first-wallet";
  if (!s.unlocked) return "locked";
  if (s.walletCount === 0) return "interrupted";
  return canCreateWallet(s.walletCount) ? "additional-wallet" : "blocked";
}
var RESTORABLE = {
  "first-wallet": ["welcome", "authentication"],
  "additional-wallet": ["welcome", "sources", "trust-method", "secret", "qr-mobile", "ledger"],
  interrupted: ["welcome", "sources", "trust-method", "secret", "qr-mobile", "ledger"]
};
var FALLBACK = { "first-wallet": "welcome", "additional-wallet": "welcome", interrupted: "sources" };
var STEP_KEY = "hb:onboarding:step";
var serializeStep = (s, at = Date.now()) => JSON.stringify({ ...s, at });
function restoreStep(raw, mode, now = Date.now()) {
  if (mode !== "first-wallet" && mode !== "additional-wallet" && mode !== "interrupted") return null;
  try {
    const v = JSON.parse(String(raw ?? "null"));
    if (!v || typeof v.at !== "number" || now - v.at > ONBOARDING_IDLE_MS) return null;
    const okFlow = ["create", "import", "qr", "ledger", "passkey"];
    if (!okFlow.includes(v.flow) || v.source !== "trust" && v.source !== "other") return null;
    const allowed = RESTORABLE[mode];
    const step = allowed.includes(v.step) ? v.step : FALLBACK[mode];
    return { step, flow: v.flow, source: v.source };
  } catch {
    return null;
  }
}
function cameraErrorKind(e) {
  const name = String(e?.name ?? "");
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "in-use";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "no-camera";
  if (name === "TypeError") return "unsupported";
  return "other";
}
var CAMERA_MESSAGES = {
  denied: "Camera access denied. Please enable camera permissions.",
  "in-use": "Camera is currently in use or unavailable. Please close other applications using the camera and try again.",
  "no-camera": "No camera was found on this computer.",
  unsupported: "This browser cannot access the camera.",
  other: "The camera could not be started."
};
var QR_PARSE_ERROR = "Scan failed. Ensure you are scanning the correct QR code. Hold still and try again.";

// src/core/backupVerify.ts
var backupVerify_exports = {};
__export(backupVerify_exports, {
  chipWord: () => chipWord,
  shuffleWords: () => shuffleWords,
  verifySelection: () => verifySelection
});
function shuffleWords(words, rand = Math.random) {
  const a = words.map((w, i) => ({ w, i }));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.map((x) => `${x.i}:${x.w}`);
}
var chipWord = (chip) => chip.slice(chip.indexOf(":") + 1);
function verifySelection(words, selected) {
  let firstWrong = -1;
  for (let i = 0; i < selected.length; i++) if (selected[i] !== words[i]) {
    firstWrong = i;
    break;
  }
  return { complete: selected.length === words.length && firstWrong === -1, valid: firstWrong === -1, firstWrong };
}

// src/core/qrImport.ts
var qrImport_exports = {};
__export(qrImport_exports, {
  decryptStoredKeys: () => decryptStoredKeys
});

// src/core/qrSync.ts
import { URDecoder } from "@ngraveio/bc-ur";

// node_modules/@noble/hashes/esm/_assert.js
function number(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`positive integer expected, not ${n}`);
}
function isBytes(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
function bytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b.length}`);
}
function hash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number(h.outputLen);
  number(h.blockLen);
}
function exists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output(out, instance) {
  bytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}

// node_modules/@noble/hashes/esm/utils.js
var u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
var createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
var rotr = (word, shift) => word << 32 - shift | word >>> shift;
var rotl = (word, shift) => word << shift | word >>> 32 - shift >>> 0;
var isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
var byteSwap = (word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
}
var nextTick = async () => {
};
async function asyncLoop(iters, tick, cb) {
  let ts = Date.now();
  for (let i = 0; i < iters; i++) {
    cb(i);
    const diff = Date.now() - ts;
    if (diff >= 0 && diff < tick)
      continue;
    await nextTick();
    ts += diff;
  }
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  bytes(data);
  return data;
}
var Hash = class {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
};
var toStr = {}.toString;
function checkOpts(defaults, opts) {
  if (opts !== void 0 && toStr.call(opts) !== "[object Object]")
    throw new Error("Options should be object or undefined");
  const merged = Object.assign(defaults, opts);
  return merged;
}
function wrapConstructor(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function wrapXOFConstructorWithOpts(hashCons) {
  const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
  const tmp = hashCons({});
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  return hashC;
}

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
var Chi = (a, b, c) => a & b ^ ~a & c;
var Maj = (a, b, c) => a & b ^ a & c ^ b & c;
var HashMD = class extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    exists(this);
    const { view, buffer, blockLen } = this;
    data = toBytes(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    exists(this);
    output(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    this.buffer.subarray(pos).fill(0);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.length = length;
    to.pos = pos;
    to.finished = finished;
    to.destroyed = destroyed;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
};

// node_modules/@noble/hashes/esm/sha256.js
var SHA256_K = /* @__PURE__ */ new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_IV = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA256 = class extends HashMD {
  constructor() {
    super(64, 32, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    SHA256_W.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.buffer.fill(0);
  }
};
var sha256 = /* @__PURE__ */ wrapConstructor(() => new SHA256());

// node_modules/@noble/hashes/esm/hmac.js
var HMAC = class extends Hash {
  constructor(hash2, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    hash(hash2);
    const key = toBytes(_key);
    this.iHash = hash2.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash2.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    pad.fill(0);
  }
  update(buf) {
    exists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    exists(this);
    bytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = (hash2, key, message) => new HMAC(hash2, key).update(message).digest();
hmac.create = (hash2, key) => new HMAC(hash2, key);

// node_modules/@noble/hashes/esm/pbkdf2.js
function pbkdf2Init(hash2, _password, _salt, _opts) {
  hash(hash2);
  const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
  const { c, dkLen, asyncTick } = opts;
  number(c);
  number(dkLen);
  number(asyncTick);
  if (c < 1)
    throw new Error("PBKDF2: iterations (c) should be >= 1");
  const password = toBytes(_password);
  const salt = toBytes(_salt);
  const DK = new Uint8Array(dkLen);
  const PRF = hmac.create(hash2, password);
  const PRFSalt = PRF._cloneInto().update(salt);
  return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
}
function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
  PRF.destroy();
  PRFSalt.destroy();
  if (prfW)
    prfW.destroy();
  u.fill(0);
  return DK;
}
function pbkdf2(hash2, password, salt, opts) {
  const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash2, password, salt, opts);
  let prfW;
  const arr = new Uint8Array(4);
  const view = createView(arr);
  const u = new Uint8Array(PRF.outputLen);
  for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
    const Ti = DK.subarray(pos, pos + PRF.outputLen);
    view.setInt32(0, ti, false);
    (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
    Ti.set(u.subarray(0, Ti.length));
    for (let ui = 1; ui < c; ui++) {
      PRF._cloneInto(prfW).update(u).digestInto(u);
      for (let i = 0; i < Ti.length; i++)
        Ti[i] ^= u[i];
    }
  }
  return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
}

// node_modules/@noble/hashes/esm/scrypt.js
function XorAndSalsa(prev, pi, input, ii, out, oi) {
  let y00 = prev[pi++] ^ input[ii++], y01 = prev[pi++] ^ input[ii++];
  let y02 = prev[pi++] ^ input[ii++], y03 = prev[pi++] ^ input[ii++];
  let y04 = prev[pi++] ^ input[ii++], y05 = prev[pi++] ^ input[ii++];
  let y06 = prev[pi++] ^ input[ii++], y07 = prev[pi++] ^ input[ii++];
  let y08 = prev[pi++] ^ input[ii++], y09 = prev[pi++] ^ input[ii++];
  let y10 = prev[pi++] ^ input[ii++], y11 = prev[pi++] ^ input[ii++];
  let y12 = prev[pi++] ^ input[ii++], y13 = prev[pi++] ^ input[ii++];
  let y14 = prev[pi++] ^ input[ii++], y15 = prev[pi++] ^ input[ii++];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let i = 0; i < 8; i += 2) {
    x04 ^= rotl(x00 + x12 | 0, 7);
    x08 ^= rotl(x04 + x00 | 0, 9);
    x12 ^= rotl(x08 + x04 | 0, 13);
    x00 ^= rotl(x12 + x08 | 0, 18);
    x09 ^= rotl(x05 + x01 | 0, 7);
    x13 ^= rotl(x09 + x05 | 0, 9);
    x01 ^= rotl(x13 + x09 | 0, 13);
    x05 ^= rotl(x01 + x13 | 0, 18);
    x14 ^= rotl(x10 + x06 | 0, 7);
    x02 ^= rotl(x14 + x10 | 0, 9);
    x06 ^= rotl(x02 + x14 | 0, 13);
    x10 ^= rotl(x06 + x02 | 0, 18);
    x03 ^= rotl(x15 + x11 | 0, 7);
    x07 ^= rotl(x03 + x15 | 0, 9);
    x11 ^= rotl(x07 + x03 | 0, 13);
    x15 ^= rotl(x11 + x07 | 0, 18);
    x01 ^= rotl(x00 + x03 | 0, 7);
    x02 ^= rotl(x01 + x00 | 0, 9);
    x03 ^= rotl(x02 + x01 | 0, 13);
    x00 ^= rotl(x03 + x02 | 0, 18);
    x06 ^= rotl(x05 + x04 | 0, 7);
    x07 ^= rotl(x06 + x05 | 0, 9);
    x04 ^= rotl(x07 + x06 | 0, 13);
    x05 ^= rotl(x04 + x07 | 0, 18);
    x11 ^= rotl(x10 + x09 | 0, 7);
    x08 ^= rotl(x11 + x10 | 0, 9);
    x09 ^= rotl(x08 + x11 | 0, 13);
    x10 ^= rotl(x09 + x08 | 0, 18);
    x12 ^= rotl(x15 + x14 | 0, 7);
    x13 ^= rotl(x12 + x15 | 0, 9);
    x14 ^= rotl(x13 + x12 | 0, 13);
    x15 ^= rotl(x14 + x13 | 0, 18);
  }
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function BlockMix(input, ii, out, oi, r) {
  let head = oi + 0;
  let tail = oi + 16 * r;
  for (let i = 0; i < 16; i++)
    out[tail + i] = input[ii + (2 * r - 1) * 16 + i];
  for (let i = 0; i < r; i++, head += 16, ii += 16) {
    XorAndSalsa(out, tail, input, ii, out, head);
    if (i > 0)
      tail += 16;
    XorAndSalsa(out, head, input, ii += 16, out, tail);
  }
}
function scryptInit(password, salt, _opts) {
  const opts = checkOpts({
    dkLen: 32,
    asyncTick: 10,
    maxmem: 1024 ** 3 + 1024
  }, _opts);
  const { N, r, p, dkLen, asyncTick, maxmem, onProgress } = opts;
  number(N);
  number(r);
  number(p);
  number(dkLen);
  number(asyncTick);
  number(maxmem);
  if (onProgress !== void 0 && typeof onProgress !== "function")
    throw new Error("progressCb should be function");
  const blockSize = 128 * r;
  const blockSize32 = blockSize / 4;
  if (N <= 1 || (N & N - 1) !== 0 || N > 2 ** 32) {
    throw new Error("Scrypt: N must be larger than 1, a power of 2, and less than 2^32");
  }
  if (p < 0 || p > (2 ** 32 - 1) * 32 / blockSize) {
    throw new Error("Scrypt: p must be a positive integer less than or equal to ((2^32 - 1) * 32) / (128 * r)");
  }
  if (dkLen < 0 || dkLen > (2 ** 32 - 1) * 32) {
    throw new Error("Scrypt: dkLen should be positive integer less than or equal to (2^32 - 1) * 32");
  }
  const memUsed = blockSize * (N + p);
  if (memUsed > maxmem) {
    throw new Error(`Scrypt: parameters too large, ${memUsed} (128 * r * (N + p)) > ${maxmem} (maxmem)`);
  }
  const B = pbkdf2(sha256, password, salt, { c: 1, dkLen: blockSize * p });
  const B32 = u32(B);
  const V = u32(new Uint8Array(blockSize * N));
  const tmp = u32(new Uint8Array(blockSize));
  let blockMixCb = () => {
  };
  if (onProgress) {
    const totalBlockMix = 2 * N * p;
    const callbackPer = Math.max(Math.floor(totalBlockMix / 1e4), 1);
    let blockMixCnt = 0;
    blockMixCb = () => {
      blockMixCnt++;
      if (onProgress && (!(blockMixCnt % callbackPer) || blockMixCnt === totalBlockMix))
        onProgress(blockMixCnt / totalBlockMix);
    };
  }
  return { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb, asyncTick };
}
function scryptOutput(password, dkLen, B, V, tmp) {
  const res = pbkdf2(sha256, password, B, { c: 1, dkLen });
  B.fill(0);
  V.fill(0);
  tmp.fill(0);
  return res;
}
async function scryptAsync(password, salt, opts) {
  const { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb, asyncTick } = scryptInit(password, salt, opts);
  if (!isLE)
    byteSwap32(B32);
  for (let pi = 0; pi < p; pi++) {
    const Pi = blockSize32 * pi;
    for (let i = 0; i < blockSize32; i++)
      V[i] = B32[Pi + i];
    let pos = 0;
    await asyncLoop(N - 1, asyncTick, () => {
      BlockMix(V, pos, V, pos += blockSize32, r);
      blockMixCb();
    });
    BlockMix(V, (N - 1) * blockSize32, B32, Pi, r);
    blockMixCb();
    await asyncLoop(N, asyncTick, () => {
      const j = B32[Pi + blockSize32 - 16] % N;
      for (let k = 0; k < blockSize32; k++)
        tmp[k] = B32[Pi + k] ^ V[j * blockSize32 + k];
      BlockMix(tmp, 0, B32, Pi, r);
      blockMixCb();
    });
  }
  if (!isLE)
    byteSwap32(B32);
  return scryptOutput(password, dkLen, B, V, tmp);
}

// node_modules/@noble/hashes/esm/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  let Ah = new Uint32Array(lst.length);
  let Al = new Uint32Array(lst.length);
  for (let i = 0; i < lst.length; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;

// node_modules/@noble/hashes/esm/sha3.js
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _7n = /* @__PURE__ */ BigInt(7);
var _256n = /* @__PURE__ */ BigInt(256);
var _0x71n = /* @__PURE__ */ BigInt(113);
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var [SHA3_IOTA_H, SHA3_IOTA_L] = /* @__PURE__ */ split(_SHA3_IOTA, true);
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  B.fill(0);
}
var Keccak = class _Keccak extends Hash {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    number(outputLen);
    if (0 >= this.blockLen || this.blockLen >= 200)
      throw new Error("Sha3 supports only keccak-f1600 function");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  keccak() {
    if (!isLE)
      byteSwap32(this.state32);
    keccakP(this.state32, this.rounds);
    if (!isLE)
      byteSwap32(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    exists(this);
    const { blockLen, state } = this;
    data = toBytes(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    exists(this, false);
    bytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes2) {
    number(bytes2);
    return this.xofInto(new Uint8Array(bytes2));
  }
  digestInto(out) {
    output(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    this.state.fill(0);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var gen = (suffix, blockLen, outputLen) => wrapConstructor(() => new Keccak(blockLen, suffix, outputLen));
var sha3_224 = /* @__PURE__ */ gen(6, 144, 224 / 8);
var sha3_256 = /* @__PURE__ */ gen(6, 136, 256 / 8);
var sha3_384 = /* @__PURE__ */ gen(6, 104, 384 / 8);
var sha3_512 = /* @__PURE__ */ gen(6, 72, 512 / 8);
var keccak_224 = /* @__PURE__ */ gen(1, 144, 224 / 8);
var keccak_256 = /* @__PURE__ */ gen(1, 136, 256 / 8);
var keccak_384 = /* @__PURE__ */ gen(1, 104, 384 / 8);
var keccak_512 = /* @__PURE__ */ gen(1, 72, 512 / 8);
var genShake = (suffix, blockLen, outputLen) => wrapXOFConstructorWithOpts((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true));
var shake128 = /* @__PURE__ */ genShake(31, 168, 128 / 8);
var shake256 = /* @__PURE__ */ genShake(31, 136, 256 / 8);

// src/core/qrSync.ts
var ONE_TIME_CODE = /^[A-Za-z0-9]{6}$/;
var hex = (h) => {
  if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error("bad hex");
  return Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
};
async function codeMatchesKey(key, code) {
  const c = key?.crypto;
  const kp = c?.kdfparams;
  if (!c || !kp || c.kdf !== "scrypt") return false;
  const { n, r, p, dklen } = kp;
  const bounded = (v, max) => Number.isInteger(v) && v >= 1 && v <= max;
  if (!bounded(n, 1 << 20) || (n & n - 1) !== 0 || !bounded(r, 16) || !bounded(p, 8) || !bounded(dklen, 64) || dklen < 32) return false;
  try {
    const dk = await scryptAsync(new TextEncoder().encode(code), hex(kp.salt), { N: n, r, p, dkLen: dklen });
    const ct = hex(c.ciphertext);
    const buf = new Uint8Array(16 + ct.length);
    buf.set(dk.subarray(16, 32));
    buf.set(ct, 16);
    const mac = keccak_256(buf);
    const want = hex(c.mac);
    if (mac.length !== want.length) return false;
    let diff = 0;
    for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ want[i];
    return diff === 0;
  } catch {
    return false;
  }
}
var isHex2 = (v, max = 8192) => typeof v === "string" && v.length <= max && /^([0-9a-f]{2})*$/i.test(v);
function isWellFormedKey(k) {
  const c = k?.crypto;
  const kp = c?.kdfparams;
  return !!c && !!kp && typeof k.type === "string" && /^(aes-128-ctr|aes-192-ctr|aes-256-ctr)$/.test(c.cipher) && c.kdf === "scrypt" && isHex2(c.cipherparams?.iv, 64) && isHex2(c.ciphertext) && isHex2(c.mac, 128) && isHex2(kp.salt, 256) && [kp.n, kp.r, kp.p, kp.dklen].every((x) => Number.isInteger(x));
}

// src/core/qrImport.ts
async function decryptStoredKeys(core, keys, code) {
  const out = { secrets: [], skipped: 0, wrong: 0 };
  if (!ONE_TIME_CODE.test(code)) {
    out.wrong = keys.length;
    return out;
  }
  const pw = new TextEncoder().encode(code);
  for (const k of keys) {
    if (!isWellFormedKey(k)) {
      out.skipped++;
      continue;
    }
    if (!await codeMatchesKey(k, code)) {
      out.wrong++;
      continue;
    }
    let sk;
    try {
      sk = core.StoredKey.importJSON(new TextEncoder().encode(JSON.stringify(k)));
    } catch {
      out.skipped++;
      continue;
    }
    try {
      const name = typeof k.name === "string" && k.name ? k.name : "";
      if (sk.isMnemonic()) out.secrets.push({ kind: "mnemonic", mnemonic: sk.decryptMnemonic(pw), name });
      else {
        const acct = sk.accountCount?.() > 0 ? sk.account(0) : null;
        const coin = acct?.coin?.();
        const ct = coin != null ? Object.entries(core.CoinType).find(([, v]) => v?.value === (coin.value ?? coin))?.[0] : void 0;
        if (!ct) {
          out.skipped++;
          continue;
        }
        out.secrets.push({ kind: "privateKey", bytes: sk.decryptPrivateKey(pw), coin: ct, name });
      }
    } catch {
      out.wrong++;
    } finally {
      try {
        sk.delete();
      } catch {
      }
    }
  }
  return out;
}

// src/core/settingsExtra.ts
var settingsExtra_exports = {};
__export(settingsExtra_exports, {
  DEVELOPER_FLAGS: () => DEVELOPER_FLAGS,
  FAUCETS: () => FAUCETS,
  WALLET_KIND_LABEL: () => WALLET_KIND_LABEL,
  canAddAccount: () => canAddAccount,
  canBackupPhrase: () => canBackupPhrase,
  canContinueFromDestination: () => canContinueFromDestination,
  canContinueFromSource: () => canContinueFromSource,
  canMigrate: () => canMigrate,
  canRevealPrivateKey: () => canRevealPrivateKey,
  destinationOptions: () => destinationOptions,
  emptyMigration: () => emptyMigration,
  groupWallets: () => groupWallets,
  hasPositiveBalance: () => hasPositiveBalance,
  isSafeFaucetUrl: () => isSafeFaucetUrl,
  migratableAssets: () => migratableAssets,
  migrationQueue: () => migrationQueue,
  pickDestination: () => pickDestination,
  pickSource: () => pickSource,
  selectAllAssets: () => selectAllAssets,
  setTestnetsHidden: () => setTestnetsHidden,
  shortAddress: () => shortAddress,
  testnetsEnabled: () => testnetsEnabled,
  toggleAsset: () => toggleAsset,
  walletKind: () => walletKind
});
var walletKind = (w) => {
  const t = String(w.type ?? "mnemonic").toLowerCase();
  if (t === "privatekey") return "privateKey";
  if (t === "ledger" || t === "hardware" || t === "trezor") return "hardware";
  return "mnemonic";
};
var WALLET_KIND_LABEL = { mnemonic: "Secret phrase", privateKey: "Private key", hardware: "Hardware wallet" };
var canAddAccount = (w) => walletKind(w) === "mnemonic";
var canBackupPhrase = (w) => walletKind(w) === "mnemonic";
var canRevealPrivateKey = (w) => walletKind(w) === "privateKey";
function groupWallets(wallets) {
  return ["mnemonic", "privateKey", "hardware"].map((kind) => ({ kind, title: WALLET_KIND_LABEL[kind], wallets: wallets.filter((w) => walletKind(w) === kind) })).filter((g) => g.wallets.length > 0);
}
var shortAddress = (a, head = 6, tail = 4) => a && a.length > head + tail + 3 ? `${a.slice(0, head)}...${a.slice(-tail)}` : a || "";
var DEVELOPER_FLAGS = [
  { key: "isCustomNonceEnabled", label: "Customize transaction nonce", sub: "Adds a nonce field to the send review screen." },
  { key: "isAdvancedGasControlsEnabled", label: "Advanced gas controls", sub: "Edit gas price and limit before sending." },
  { key: "isAdvancedTransactionDataEnabled", label: "Advanced transaction data", sub: "Show the raw call data of a transaction." },
  { key: "isEthSignEnabled", label: "Allow eth_sign requests", sub: "Unsafe: lets a site ask you to sign an arbitrary hash." }
];
var testnetsEnabled = (hidden, testnetIds) => testnetIds.length > 0 && testnetIds.every((id) => !hidden.includes(id));
function setTestnetsHidden(hidden, testnetIds, enabled) {
  const rest = hidden.filter((id) => !testnetIds.includes(id));
  return enabled ? rest : [...rest, ...testnetIds];
}
var FAUCETS = [
  { chainId: "sepolia", label: "Ethereum Sepolia", url: "https://sepolia-faucet.pk910.de/" },
  { chainId: "smartchain-testnet", label: "BNB Smart Chain testnet", url: "https://testnet.bnbchain.org/faucet-smart" },
  { chainId: "arbitrum-sepolia", label: "Arbitrum Sepolia", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
  { chainId: "optimism-sepolia", label: "Optimism Sepolia", url: "https://www.alchemy.com/faucets/optimism-sepolia" },
  { chainId: "avalanche-fuji", label: "Avalanche Fuji", url: "https://faucet.avax.network/" },
  { chainId: "polygon-amoy", label: "Polygon Amoy", url: "https://faucet.polygon.technology/" },
  { chainId: "fantom-testnet", label: "Fantom Testnet", url: "https://faucet.fantom.network/" },
  { chainId: "moonbase-alpha", label: "Moonbase Alpha", url: "https://apps.moonbeam.network/moonbase-alpha/faucet/" }
];
var isSafeFaucetUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !x.username && !x.password;
  } catch {
    return false;
  }
};
var emptyMigration = () => ({ selected: [] });
function pickSource(s, id) {
  return { source: id, destination: s.destination === id ? void 0 : s.destination, selected: [] };
}
var destinationOptions = (wallets, source) => wallets.filter((w) => w.id !== source && walletKind(w) !== "hardware");
function pickDestination(s, id) {
  return id === s.source ? s : { ...s, destination: id };
}
function toggleAsset(s, id) {
  return { ...s, selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] };
}
function selectAllAssets(s, assets) {
  const all = assets.map((a) => a.id);
  return { ...s, selected: s.selected.length === all.length ? [] : all };
}
var hasPositiveBalance = (a) => /[1-9]/.test(a.balance.replace(/e.*$/i, ""));
var migratableAssets = (assets) => assets.filter(hasPositiveBalance);
var canContinueFromSource = (s) => !!s.source;
var canContinueFromDestination = (s) => !!s.source && !!s.destination && s.source !== s.destination;
var canMigrate = (s) => canContinueFromDestination(s) && s.selected.length > 0;
var migrationQueue = (s, assets) => assets.filter((a) => s.selected.includes(a.id));

// src/core/settings.ts
var AUTO_LOCK_OPTIONS = [1, 5, 10, 15, 30, 60, 0];
var DEFAULT_LOCK_MINUTES = 10;
var SUPPORTED_LOCALES = ["ar", "bg-BG", "my-MM", "zh-CN", "zh-TC", "cs-CZ", "da-DK", "en", "fr", "de", "el-GR", "id", "it", "ja", "kk-KZ", "ko", "lv-LV", "lo-LA", "pl-PL", "pt", "pt-BR", "ro-RO", "ru", "si-LK", "es-ES", "es-LA", "sv-SE", "tr", "uk-UA", "vi"];
function pickLocale(navigatorLanguage) {
  const nl = navigatorLanguage ?? "en";
  const all = SUPPORTED_LOCALES;
  return all.find((l) => l === nl) ?? all.find((l) => l.split("-")[0] === nl.split("-")[0]) ?? "en";
}
var DEFAULT_SETTINGS = (navigatorLanguage) => ({
  version: 1,
  locale: pickLocale(navigatorLanguage),
  baseCurrency: "USD",
  colorMode: "system",
  lockTimeInMinutes: DEFAULT_LOCK_MINUTES,
  preferSidePanel: false,
  isDefaultWallet: false,
  layout: { tokenCellLayout: 3, hideNFTs: false, hideLowBalanceAssets: false },
  privacy: { hideBalancesOnDashboard: false },
  developerSettings: { isCustomNonceEnabled: false, isAdvancedGasControlsEnabled: false, isAdvancedTransactionDataEnabled: false, isEthSignEnabled: false },
  pushNotifications: { isPushEnabled: true, isSendAndReceiveEnabled: true, topics: { product_announcement: true } }
});
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var bool = (v, d) => typeof v === "boolean" ? v : d;
function applyPatch(cur, patch, currencies = null) {
  if (!isObj(patch)) return cur;
  const next = JSON.parse(JSON.stringify(cur));
  if (typeof patch.locale === "string" && SUPPORTED_LOCALES.includes(patch.locale)) next.locale = patch.locale;
  if (typeof patch.baseCurrency === "string" && (!currencies || currencies.has(patch.baseCurrency))) next.baseCurrency = patch.baseCurrency;
  if (patch.colorMode === "light" || patch.colorMode === "dark" || patch.colorMode === "system") next.colorMode = patch.colorMode;
  if ("lockTimeInMinutes" in patch) next.lockTimeInMinutes = AUTO_LOCK_OPTIONS.includes(patch.lockTimeInMinutes) ? patch.lockTimeInMinutes : next.lockTimeInMinutes;
  next.preferSidePanel = bool(patch.preferSidePanel, next.preferSidePanel);
  next.isDefaultWallet = bool(patch.isDefaultWallet, next.isDefaultWallet);
  if (isObj(patch.layout)) {
    const l = patch.layout;
    if (l.tokenCellLayout === 1 || l.tokenCellLayout === 2 || l.tokenCellLayout === 3) next.layout.tokenCellLayout = l.tokenCellLayout;
    next.layout.hideNFTs = bool(l.hideNFTs, next.layout.hideNFTs);
    next.layout.hideLowBalanceAssets = bool(l.hideLowBalanceAssets, next.layout.hideLowBalanceAssets);
  }
  if (isObj(patch.privacy)) next.privacy.hideBalancesOnDashboard = bool(patch.privacy.hideBalancesOnDashboard, next.privacy.hideBalancesOnDashboard);
  if (isObj(patch.developerSettings)) {
    const d = patch.developerSettings;
    const t = next.developerSettings;
    t.isCustomNonceEnabled = bool(d.isCustomNonceEnabled, t.isCustomNonceEnabled);
    t.isAdvancedGasControlsEnabled = bool(d.isAdvancedGasControlsEnabled, t.isAdvancedGasControlsEnabled);
    t.isAdvancedTransactionDataEnabled = bool(d.isAdvancedTransactionDataEnabled, t.isAdvancedTransactionDataEnabled);
    t.isEthSignEnabled = bool(d.isEthSignEnabled, t.isEthSignEnabled);
  }
  if (isObj(patch.pushNotifications)) {
    const p = patch.pushNotifications;
    const t = next.pushNotifications;
    if (typeof p.isPushEnabled === "boolean") {
      t.isPushEnabled = p.isPushEnabled;
      t.isSendAndReceiveEnabled = p.isPushEnabled;
    }
    if (isObj(p.topics)) {
      for (const [k, v] of Object.entries(p.topics)) if (/^[a-z_]{1,40}$/.test(k) && typeof v === "boolean") t.topics[k] = v;
    }
  }
  return next;
}

// src/core/chains/registry.json
var registry_default = [
  {
    twId: 0,
    id: "bitcoin",
    name: "Bitcoin",
    wcId: "bitcoin",
    ct: "bitcoin",
    kind: "utxo",
    blockchain: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    endpoints: [
      "https://mempool.space/api",
      "https://blockstream.info/api"
    ],
    explorer: "https://mempool.space",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/84'/0'/0'/0/0",
    cg: "bitcoin",
    hrp: "bc",
    dbLookup: false,
    ws: false
  },
  {
    twId: 60,
    id: "ethereum",
    name: "Ethereum",
    wcId: "ethereum",
    ct: "ethereum",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 1,
    rpcs: [
      "https://ethereum-rpc.publicnode.com",
      "https://ethereum.reth.rs/rpc"
    ],
    explorer: "https://etherscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 61,
    id: "classic",
    name: "Ethereum Classic",
    wcId: "classic",
    ct: "ethereumClassic",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETC",
    decimals: 18,
    evmChainId: 61,
    rpcs: [
      "https://etc.rivet.link"
    ],
    explorer: "https://blockscout.com/etc/mainnet",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/61'/0'/0/0",
    cg: "ethereum-classic",
    dbLookup: true,
    ws: true
  },
  {
    twId: 74,
    id: "icon",
    name: "ICON",
    wcId: "icon",
    ct: "icon",
    kind: "icon",
    blockchain: "Icon",
    symbol: "ICX",
    decimals: 18,
    endpoints: [
      "https://ctz.solidwallet.io/api/v3"
    ],
    explorer: "https://tracker.icon.foundation",
    txPath: "/transaction/",
    accountPath: "/address/",
    path: "m/44'/74'/0'/0/0",
    cg: "icon",
    dbLookup: false,
    ws: false
  },
  {
    twId: 118,
    id: "cosmos",
    name: "Cosmos",
    wcId: "cosmos",
    ct: "cosmos",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "ATOM",
    decimals: 6,
    endpoints: [
      "https://cosmos-rest.publicnode.com"
    ],
    explorer: "https://mintscan.io/cosmos",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "cosmos",
    hrp: "cosmos",
    dbLookup: true,
    ws: true
  },
  {
    twId: 144,
    id: "ripple",
    name: "Ripple",
    wcId: "ripple",
    ct: "xrp",
    kind: "ripple",
    blockchain: "Ripple",
    symbol: "XRP",
    decimals: 6,
    endpoints: [
      "https://s1.ripple.com:51234"
    ],
    explorer: "https://bithomp.com",
    txPath: "/explorer/",
    accountPath: "/explorer/",
    path: "m/44'/144'/0'/0/0",
    cg: "ripple",
    dbLookup: true,
    ws: true
  },
  {
    twId: 148,
    id: "stellar",
    name: "Stellar",
    wcId: "stellar",
    ct: "stellar",
    kind: "stellar",
    blockchain: "Stellar",
    symbol: "XLM",
    decimals: 7,
    endpoints: [
      "https://horizon.stellar.org"
    ],
    explorer: "https://blockchair.com/stellar",
    txPath: "/transaction/",
    accountPath: "/account/",
    path: "m/44'/148'/0'",
    cg: "stellar",
    dbLookup: false,
    ws: false
  },
  {
    twId: 169,
    id: "manta",
    name: "Manta Pacific",
    wcId: "manta",
    ct: "mantaPacific",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 169,
    rpcs: [
      "https://pacific-rpc.manta.network/http"
    ],
    explorer: "https://pacific-explorer.manta.network",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: false,
    ws: false
  },
  {
    twId: 195,
    id: "tron",
    name: "Tron",
    wcId: "tron",
    ct: "tron",
    kind: "tron",
    blockchain: "Tron",
    symbol: "TRX",
    decimals: 6,
    endpoints: [
      "https://api.trongrid.io"
    ],
    explorer: "https://tronscan.org",
    txPath: "/#/transaction/",
    accountPath: "/#/address/",
    path: "m/44'/195'/0'/0/0",
    cg: "tron",
    dbLookup: true,
    ws: true
  },
  {
    twId: 204,
    id: "opbnb",
    name: "OpBNB",
    wcId: "opbnb",
    ct: "opBNB",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "BNB",
    decimals: 18,
    evmChainId: 204,
    rpcs: [
      "https://opbnb-mainnet-rpc.bnbchain.org"
    ],
    explorer: "https://opbnbscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "binancecoin",
    dbLookup: true,
    ws: true
  },
  {
    twId: 223,
    id: "internet_computer",
    name: "Internet Computer",
    wcId: "internet_computer",
    ct: "internetComputer",
    kind: "icp",
    blockchain: "InternetComputer",
    symbol: "ICP",
    decimals: 8,
    endpoints: [
      "https://ic0.app"
    ],
    explorer: "https://dashboard.internetcomputer.org",
    txPath: "/transaction/",
    accountPath: "/account/",
    path: "m/44'/223'/0'/0/0",
    cg: "internet-computer",
    dbLookup: false,
    ws: false
  },
  {
    twId: 235,
    id: "fio",
    name: "FIO",
    wcId: "fio",
    ct: "fio",
    kind: "fio",
    blockchain: "FIO",
    symbol: "FIO",
    decimals: 9,
    endpoints: [
      "https://fio.eosusa.io"
    ],
    explorer: "https://explorer.fioprotocol.io",
    txPath: "/transaction/",
    accountPath: "/account/",
    path: "m/44'/235'/0'/0/0",
    cg: "fio-protocol",
    dbLookup: false,
    ws: false
  },
  {
    twId: 242,
    id: "nimiq",
    name: "Nimiq",
    wcId: "nimiq",
    ct: "nimiq",
    kind: "nimiq",
    blockchain: "Nimiq",
    symbol: "NIM",
    decimals: 5,
    explorer: "https://nimiq.watch",
    txPath: "/#",
    accountPath: "/#",
    path: "m/44'/242'/0'/0'",
    cg: "nimiq-2",
    dbLookup: false,
    ws: false
  },
  {
    twId: 283,
    id: "algorand",
    name: "Algorand",
    wcId: "algorand",
    ct: "algorand",
    kind: "algorand",
    blockchain: "Algorand",
    symbol: "ALGO",
    decimals: 6,
    endpoints: [
      "https://mainnet-api.algonode.cloud"
    ],
    explorer: "https://allo.info",
    txPath: "/tx/",
    accountPath: "/account/",
    path: "m/44'/283'/0'/0'/0'",
    cg: "algorand",
    dbLookup: true,
    ws: true
  },
  {
    twId: 304,
    id: "iotex",
    name: "IoTeX",
    wcId: "iotex",
    ct: "ioTeX",
    kind: "iotex",
    blockchain: "IoTeX",
    symbol: "IOTX",
    decimals: 18,
    endpoints: [
      "https://api.iotex.one:443"
    ],
    explorer: "https://iotexscan.io",
    txPath: "/action/",
    accountPath: "/address/",
    path: "m/44'/304'/0'/0/0",
    cg: "iotex",
    hrp: "io",
    dbLookup: false,
    ws: false
  },
  {
    twId: 313,
    id: "zilliqa",
    name: "Zilliqa",
    wcId: "zilliqa",
    ct: "zilliqa",
    kind: "zilliqa",
    blockchain: "Zilliqa",
    symbol: "ZIL",
    decimals: 12,
    endpoints: [
      "https://api.zilliqa.com"
    ],
    explorer: "https://viewblock.io",
    txPath: "/zilliqa/tx/",
    accountPath: "/zilliqa/address/",
    path: "m/44'/313'/0'/0/0",
    cg: "zilliqa",
    hrp: "zil",
    dbLookup: false,
    ws: false
  },
  {
    twId: 330,
    id: "terra",
    name: "Terra Classic",
    wcId: "terra",
    ct: "terra",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "LUNC",
    decimals: 6,
    endpoints: [
      "https://terra-classic-lcd.publicnode.com"
    ],
    explorer: "https://finder.terra.money/classic",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/330'/0'/0/0",
    cg: "terra-luna",
    hrp: "terra",
    dbLookup: false,
    ws: false
  },
  {
    twId: 354,
    id: "polkadot",
    name: "Polkadot",
    wcId: "polkadot",
    ct: "polkadot",
    kind: "substrate",
    blockchain: "Polkadot",
    symbol: "DOT",
    decimals: 10,
    endpoints: [
      "https://polkadot-rpc.publicnode.com"
    ],
    explorer: "https://assethub-polkadot.subscan.io",
    txPath: "/extrinsic/",
    accountPath: "/account/",
    path: "m/44'/354'/0'/0'/0'",
    cg: "polkadot",
    dbLookup: true,
    ws: true
  },
  {
    twId: 397,
    id: "near",
    name: "NEAR",
    wcId: "near",
    ct: "near",
    kind: "near",
    blockchain: "NEAR",
    symbol: "NEAR",
    decimals: 24,
    endpoints: [
      "https://rpc.mainnet.near.org"
    ],
    explorer: "https://nearblocks.io",
    txPath: "/txns/",
    accountPath: "/address/",
    path: "m/44'/397'/0'",
    cg: "near",
    dbLookup: false,
    ws: false
  },
  {
    twId: 425,
    id: "aion",
    name: "Aion",
    wcId: "aion",
    ct: "aion",
    kind: "aion",
    blockchain: "Aion",
    symbol: "AION",
    decimals: 18,
    explorer: "https://mainnet.aion.network",
    txPath: "/#/transaction/",
    accountPath: "/#/account/",
    path: "m/44'/425'/0'/0'/0'",
    cg: "aion",
    dbLookup: false,
    ws: false
  },
  {
    twId: 434,
    id: "kusama",
    name: "Kusama",
    wcId: "kusama",
    ct: "kusama",
    kind: "substrate",
    blockchain: "Kusama",
    symbol: "KSM",
    decimals: 12,
    endpoints: [
      "https://kusama-rpc.polkadot.io"
    ],
    explorer: "https://assethub-kusama.subscan.io",
    txPath: "/extrinsic/",
    accountPath: "/account/",
    path: "m/44'/434'/0'/0'/0'",
    cg: "kusama",
    dbLookup: true,
    ws: true
  },
  {
    twId: 459,
    id: "kava",
    name: "Kava",
    wcId: "kava",
    ct: "kava",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "KAVA",
    decimals: 6,
    endpoints: [
      "https://kava-rest.publicnode.com"
    ],
    explorer: "https://mintscan.io/kava",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/459'/0'/0/0",
    cg: "kava",
    hrp: "kava",
    dbLookup: true,
    ws: true
  },
  {
    twId: 461,
    id: "filecoin",
    name: "Filecoin",
    wcId: "filecoin",
    ct: "filecoin",
    kind: "filecoin",
    blockchain: "Filecoin",
    symbol: "FIL",
    decimals: 18,
    endpoints: [
      "https://api.node.glif.io/rpc/v1"
    ],
    explorer: "https://filfox.info/en",
    txPath: "/message/",
    accountPath: "/address/",
    path: "m/44'/461'/0'/0/0",
    cg: "filecoin",
    dbLookup: false,
    ws: false
  },
  {
    twId: 500,
    id: "theta",
    name: "Theta",
    wcId: "theta",
    ct: "theta",
    kind: "theta",
    blockchain: "Theta",
    symbol: "THETA",
    decimals: 18,
    endpoints: [
      "https://theta-node-rpc.thetatoken.org/rpc"
    ],
    explorer: "https://explorer.thetatoken.org",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/500'/0'/0/0",
    cg: "theta-token",
    dbLookup: false,
    ws: false
  },
  {
    twId: 501,
    id: "solana",
    name: "Solana",
    wcId: "solana",
    ct: "solana",
    kind: "solana",
    blockchain: "Solana",
    symbol: "SOL",
    decimals: 9,
    endpoints: [
      "https://solana-rpc.publicnode.com",
      "https://api.mainnet-beta.solana.com"
    ],
    explorer: "https://solscan.io",
    txPath: "/tx/",
    accountPath: "/account/",
    path: "m/44'/501'/0'",
    cg: "solana",
    dbLookup: true,
    ws: true
  },
  {
    twId: 508,
    id: "elrond",
    name: "Elrond",
    wcId: "elrond",
    ct: "multiversX",
    kind: "multiversx",
    blockchain: "MultiversX",
    symbol: "EGLD",
    decimals: 18,
    endpoints: [
      "https://gateway.multiversx.com"
    ],
    explorer: "https://explorer.multiversx.com",
    txPath: "/transactions/",
    accountPath: "/accounts/",
    path: "m/44'/508'/0'/0'/0'",
    cg: "elrond-erd-2",
    hrp: "erd",
    dbLookup: true,
    ws: true
  },
  {
    twId: 564,
    id: "agoric",
    name: "Agoric",
    wcId: "agoric",
    ct: "agoric",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "BLD",
    decimals: 6,
    endpoints: [
      "https://agoric-api.polkachu.com"
    ],
    explorer: "https://atomscan.com/agoric",
    txPath: "/transactions/",
    accountPath: "/accounts/",
    path: "m/44'/564'/0'/0/0",
    cg: "agoric",
    hrp: "agoric",
    dbLookup: false,
    ws: false
  },
  {
    twId: 607,
    id: "ton",
    name: "TON",
    wcId: "ton",
    ct: "ton",
    kind: "ton",
    blockchain: "TheOpenNetwork",
    symbol: "TON",
    decimals: 9,
    endpoints: [
      "https://toncenter.com/api/v2"
    ],
    explorer: "https://tonviewer.com",
    txPath: "/transaction/",
    accountPath: "/",
    path: "m/44'/607'/0'",
    cg: "the-open-network",
    dbLookup: true,
    ws: true
  },
  {
    twId: 637,
    id: "aptos",
    name: "Aptos",
    wcId: "aptos",
    ct: "aptos",
    kind: "aptos",
    blockchain: "Aptos",
    symbol: "APT",
    decimals: 8,
    endpoints: [
      "https://fullnode.mainnet.aptoslabs.com/v1"
    ],
    explorer: "https://explorer.aptoslabs.com",
    txPath: "/txn/",
    accountPath: "/account/",
    path: "m/44'/637'/0'/0'/0'",
    cg: "aptos",
    dbLookup: true,
    ws: true
  },
  {
    twId: 784,
    id: "sui",
    name: "Sui",
    wcId: "sui",
    ct: "sui",
    kind: "sui",
    blockchain: "Sui",
    symbol: "SUI",
    decimals: 9,
    endpoints: [
      "https://fullnode.mainnet.sui.io"
    ],
    explorer: "https://suiscan.xyz/mainnet",
    txPath: "/tx/",
    accountPath: "/account/",
    path: "m/44'/784'/0'/0'/0'",
    cg: "sui",
    dbLookup: true,
    ws: true
  },
  {
    twId: 818,
    id: "vechain",
    name: "VeChain Token",
    wcId: "vechain",
    ct: "veChain",
    kind: "vechain",
    blockchain: "Vechain",
    symbol: "VET",
    decimals: 18,
    endpoints: [
      "https://mainnet.vechain.org"
    ],
    explorer: "https://explore.vechain.org",
    txPath: "/transactions/",
    accountPath: "/accounts/",
    path: "m/44'/818'/0'/0/0",
    cg: "vechain",
    dbLookup: false,
    ws: false
  },
  {
    twId: 889,
    id: "tomochain",
    name: "TOMO",
    wcId: "viction",
    ct: "viction",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "VIC",
    decimals: 18,
    evmChainId: 88,
    rpcs: [
      "https://rpc.viction.xyz"
    ],
    explorer: "https://www.vicscan.xyz",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/889'/0'/0/0",
    cg: "viction",
    dbLookup: false,
    ws: false
  },
  {
    twId: 931,
    id: "thorchain",
    name: "THORChain",
    wcId: "thorchain",
    ct: "thorchain",
    kind: "cosmos",
    blockchain: "Thorchain",
    symbol: "RUNE",
    decimals: 8,
    endpoints: [
      "https://thornode.ninerealms.com"
    ],
    explorer: "https://viewblock.io/thorchain",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/931'/0'/0/0",
    cg: "thorchain",
    hrp: "thor",
    dbLookup: true,
    ws: true
  },
  {
    twId: 966,
    id: "polygon",
    name: "POL (ex-MATIC)",
    wcId: "polygon",
    ct: "polygon",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "POL",
    decimals: 18,
    evmChainId: 137,
    rpcs: [
      "https://polygon-rpc.com",
      "https://polygon.drpc.org"
    ],
    explorer: "https://polygonscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "polygon-ecosystem-token",
    dbLookup: true,
    ws: true
  },
  {
    twId: 1001,
    id: "thundertoken",
    name: "ThunderCore",
    wcId: "thundertoken",
    ct: "thunderCore",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "TT",
    decimals: 18,
    evmChainId: 108,
    rpcs: [
      "https://mainnet-rpc.thundercore.com"
    ],
    explorer: "https://scan.thundercore.com",
    txPath: "/transactions/",
    accountPath: "/address/",
    path: "m/44'/1001'/0'/0/0",
    cg: "thunder-token",
    dbLookup: false,
    ws: false
  },
  {
    twId: 1023,
    id: "harmony",
    name: "Harmony",
    wcId: "harmony",
    ct: "harmony",
    kind: "harmony",
    blockchain: "Harmony",
    symbol: "ONE",
    decimals: 18,
    endpoints: [
      "https://api.harmony.one"
    ],
    explorer: "https://explorer.harmony.one",
    txPath: "/#/tx/",
    accountPath: "/#/address/",
    path: "m/44'/1023'/0'/0/0",
    cg: "harmony",
    hrp: "one",
    dbLookup: false,
    ws: false
  },
  {
    twId: 1024,
    id: "ontology",
    name: "Ontology",
    wcId: "ontology",
    ct: "ontology",
    kind: "ontology",
    blockchain: "Ontology",
    symbol: "ONT",
    decimals: 0,
    endpoints: [
      "https://dappnode1.ont.io:10336"
    ],
    explorer: "https://explorer.ont.io",
    txPath: "/transaction/",
    accountPath: "/address/",
    path: "m/44'/1024'/0'/0/0",
    cg: "ontology",
    dbLookup: false,
    ws: false
  },
  {
    twId: 1030,
    id: "cfxevm",
    name: "Conflux eSpace",
    wcId: "cfxevm",
    ct: "confluxeSpace",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "CFX",
    decimals: 18,
    evmChainId: 1030,
    rpcs: [
      "https://evm.confluxrpc.com"
    ],
    explorer: "https://evm.confluxscan.net",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "conflux-token",
    dbLookup: true,
    ws: true
  },
  {
    twId: 1729,
    id: "tezos",
    name: "Tezos",
    wcId: "tezos",
    ct: "tezos",
    kind: "tezos",
    blockchain: "Tezos",
    symbol: "XTZ",
    decimals: 6,
    endpoints: [
      "https://mainnet.api.tez.ie"
    ],
    explorer: "https://tzstats.com",
    txPath: "/",
    accountPath: "/",
    path: "m/44'/1729'/0'/0'",
    cg: "tezos",
    dbLookup: true,
    ws: true
  },
  {
    twId: 4200,
    id: "merlin",
    name: "Merlin",
    wcId: "merlin",
    ct: "merlin",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "BTC",
    decimals: 18,
    evmChainId: 4200,
    rpcs: [
      "https://rpc.merlinchain.io"
    ],
    explorer: "https://scan.merlinchain.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "bitcoin",
    dbLookup: false,
    ws: false
  },
  {
    twId: 4326,
    id: "megaeth",
    name: "MegaETH",
    wcId: "megaeth",
    ct: "megaETH",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 4326,
    rpcs: [
      "https://mainnet.megaeth.com/rpc"
    ],
    explorer: "https://megaeth.blockscout.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 5e3,
    id: "mantle",
    name: "Mantle",
    wcId: "mantle",
    ct: "mantle",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "MNT",
    decimals: 18,
    evmChainId: 5e3,
    rpcs: [
      "https://rpc.mantle.xyz"
    ],
    explorer: "https://explorer.mantle.xyz",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "mantle",
    dbLookup: false,
    ws: false
  },
  {
    twId: 6001,
    id: "bouncebit",
    name: "BounceBit",
    wcId: "bouncebit",
    ct: "bounceBit",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "BB",
    decimals: 18,
    evmChainId: 6001,
    rpcs: [
      "https://fullnode-mainnet.bouncebitapi.com"
    ],
    explorer: "https://bbscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "bouncebit",
    dbLookup: false,
    ws: false
  },
  {
    twId: 6060,
    id: "gochain",
    name: "GoChain GO",
    wcId: "gochain",
    ct: "goChain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "GO",
    decimals: 18,
    evmChainId: 60,
    rpcs: [
      "https://rpc.gochain.io"
    ],
    explorer: "https://explorer.gochain.io",
    txPath: "/tx/",
    accountPath: "/addr/",
    path: "m/44'/6060'/0'/0/0",
    cg: "gochain",
    dbLookup: false,
    ws: false
  },
  {
    twId: 8453,
    id: "base",
    name: "Base",
    wcId: "base",
    ct: "base",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 8453,
    rpcs: [
      "https://mainnet-preconf.base.org"
    ],
    explorer: "https://basescan.org",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 9745,
    id: "plasma",
    name: "Plasma",
    wcId: "plasma",
    ct: "plasma",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "XPL",
    decimals: 18,
    evmChainId: 9745,
    rpcs: [
      "https://rpc.plasma.to"
    ],
    explorer: "https://plasmascan.to",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "plasma",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10143,
    id: "monad",
    name: "Monad",
    wcId: "monad",
    ct: "monad",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "MON",
    decimals: 18,
    evmChainId: 143,
    rpcs: [
      "https://rpc.monad.xyz",
      "https://rpc1.monad.xyz"
    ],
    explorer: "https://monvision.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "monad",
    dbLookup: true,
    ws: true
  },
  {
    twId: 52752,
    id: "celo",
    name: "Celo",
    wcId: "celo",
    ct: "celo",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "CELO",
    decimals: 18,
    evmChainId: 42220,
    rpcs: [
      "https://forno.celo.org"
    ],
    explorer: "https://explorer.celo.org",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "celo",
    dbLookup: true,
    ws: true
  },
  {
    twId: 59144,
    id: "linea",
    name: "Linea",
    wcId: "linea",
    ct: "linea",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 59144,
    rpcs: [
      "https://rpc.linea.build"
    ],
    explorer: "https://lineascan.build",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 81457,
    id: "blast",
    name: "Blast",
    wcId: "blast",
    ct: "blast",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 81457,
    rpcs: [
      "https://rpc.blast.io"
    ],
    explorer: "https://blastscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 534352,
    id: "scroll",
    name: "Scroll",
    wcId: "scroll",
    ct: "scroll",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 534352,
    rpcs: [
      "https://rpc.scroll.io"
    ],
    explorer: "https://scrollscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 810180,
    id: "zklinknova",
    name: "zkLink Nova",
    wcId: "zklinknova",
    ct: "zkLinkNova",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 810180,
    rpcs: [
      "https://rpc.zklink.io"
    ],
    explorer: "https://explorer.zklink.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: false,
    ws: false
  },
  {
    twId: 5718350,
    id: "wanchain",
    name: "Wanchain",
    wcId: "wanchain",
    ct: "wanchain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "WAN",
    decimals: 18,
    evmChainId: 888,
    rpcs: [
      "https://gwan-ssl.wandevs.org:56891",
      "https://gwan2-ssl.wandevs.org"
    ],
    explorer: "https://www.wanscan.org",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/5718350'/0'/0/0",
    cg: "wanchain",
    dbLookup: true,
    ws: true
  },
  {
    twId: 5741564,
    id: "waves",
    name: "WAVES",
    wcId: "waves",
    ct: "waves",
    kind: "waves",
    blockchain: "Waves",
    symbol: "WAVES",
    decimals: 8,
    endpoints: [
      "https://nodes.wavesnodes.com"
    ],
    explorer: "https://wavesexplorer.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/5741564'/0'/0'/0'",
    cg: "waves",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10000025,
    id: "cronos",
    name: "Cronos",
    wcId: "cronos",
    ct: "cronosChain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "CRO",
    decimals: 18,
    evmChainId: 25,
    rpcs: [
      "https://evm.cronos.org"
    ],
    explorer: "https://cronoscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "crypto-com-chain",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000060,
    id: "nativeinjective",
    name: "NativeInjective",
    wcId: "nativeinjective",
    ct: "nativeInjective",
    kind: "cosmos",
    blockchain: "NativeInjective",
    symbol: "INJ",
    decimals: 18,
    endpoints: [
      "https://injective-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/injective",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/60'/0'/0/0",
    cg: "injective-protocol",
    hrp: "inj",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000070,
    id: "optimism",
    name: "Optimism Ethereum",
    wcId: "optimism",
    ct: "optimism",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 10,
    rpcs: [
      "https://mainnet.optimism.io",
      "https://optimism-rpc.publicnode.com"
    ],
    explorer: "https://optimistic.etherscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000100,
    id: "xdai",
    name: "xDai",
    wcId: "xdai",
    ct: "xdai",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "xDAI",
    decimals: 18,
    evmChainId: 100,
    rpcs: [
      "https://rpc.gnosischain.com"
    ],
    explorer: "https://blockscout.com/xdai/mainnet",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "xdai",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000118,
    id: "osmosis",
    name: "Osmosis",
    wcId: "osmosis",
    ct: "osmosis",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "OSMO",
    decimals: 6,
    endpoints: [
      "https://osmosis-rest.publicnode.com"
    ],
    explorer: "https://mintscan.io/osmosis",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "osmosis",
    hrp: "osmo",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000146,
    id: "sonic",
    name: "Sonic",
    wcId: "sonic",
    ct: "sonic",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "S",
    decimals: 18,
    evmChainId: 146,
    rpcs: [
      "https://rpc.soniclabs.com"
    ],
    explorer: "https://sonicscan.org",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "sonic-3",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000250,
    id: "fantom",
    name: "Fantom",
    wcId: "fantom",
    ct: "fantom",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "FTM",
    decimals: 18,
    evmChainId: 250,
    rpcs: [
      "https://fantom-rpc.publicnode.com"
    ],
    explorer: "https://ftmscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "fantom",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000288,
    id: "boba",
    name: "Boba",
    wcId: "boba",
    ct: "boba",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "BOBAETH",
    decimals: 18,
    evmChainId: 288,
    rpcs: [
      "https://mainnet.boba.network"
    ],
    explorer: "https://eth.bobascan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000321,
    id: "kcc",
    name: "KuCoin Community Chain",
    wcId: "kcc",
    ct: "kuCoinCommunityChain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "KCS",
    decimals: 18,
    evmChainId: 321,
    rpcs: [
      "https://kcc-rpc.com"
    ],
    explorer: "https://scan.kcc.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "kucoin-shares",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000324,
    id: "zksync",
    name: "Zksync",
    wcId: "zksync",
    ct: "zksync",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 324,
    rpcs: [
      "https://mainnet.era.zksync.io"
    ],
    explorer: "https://explorer.zksync.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10000999,
    id: "hyperevm",
    name: "HyperEVM",
    wcId: "hyperevm",
    ct: "hyperEVM",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "HYPE",
    decimals: 18,
    evmChainId: 999,
    rpcs: [
      "https://rpc.hyperliquid.xyz/evm"
    ],
    explorer: "https://hyperevmscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "hyperliquid",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10001088,
    id: "metis",
    name: "Metis",
    wcId: "metis",
    ct: "metis",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "METIS",
    decimals: 18,
    evmChainId: 1088,
    rpcs: [
      "https://metis-pokt.nodies.app",
      "https://api.blockeden.xyz/metis/67nCBdZQSH9z3YqDDjdm",
      "https://metis-andromeda.gateway.tenderly.co",
      "https://metis.api.onfinality.io/public",
      "https://metis-mainnet.public.blastapi.io"
    ],
    explorer: "https://andromeda-explorer.metis.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "metis-token",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10001284,
    id: "moonbeam",
    name: "Moonbeam",
    wcId: "moonbeam",
    ct: "moonbeam",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "GLMR",
    decimals: 18,
    evmChainId: 1284,
    rpcs: [
      "https://rpc.api.moonbeam.network"
    ],
    explorer: "https://moonscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "moonbeam",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10001285,
    id: "moonriver",
    name: "Moonriver",
    wcId: "moonriver",
    ct: "moonriver",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "MOVR",
    decimals: 18,
    evmChainId: 1285,
    rpcs: [
      "https://rpc.api.moonriver.moonbeam.network"
    ],
    explorer: "https://moonriver.moonscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "moonriver",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10002020,
    id: "ronin",
    name: "Ronin",
    wcId: "ronin",
    ct: "ronin",
    kind: "evm",
    blockchain: "Ronin",
    symbol: "RON",
    decimals: 18,
    evmChainId: 2020,
    rpcs: [
      "https://api.roninchain.com/rpc"
    ],
    explorer: "https://explorer.roninchain.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ronin",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10002222,
    id: "kavaevm",
    name: "KavaEvm",
    wcId: "kavaevm",
    ct: "kavaEvm",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "KAVA",
    decimals: 18,
    evmChainId: 2222,
    rpcs: [
      "https://evm.kava.io"
    ],
    explorer: "https://explorer.kava.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "kava",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10004663,
    id: "robinhoodchain",
    name: "Robinhood Chain",
    wcId: "robinhoodchain",
    ct: "robinhoodChain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 4663,
    rpcs: [
      "https://rpc.mainnet.chain.robinhood.com",
      "https://rpc.ordofi.network"
    ],
    explorer: "https://robin.etherscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10004689,
    id: "iotexevm",
    name: "IoTeX Network Mainnet",
    wcId: "iotexevm",
    ct: "ioTeXEVM",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "IOTX",
    decimals: 18,
    evmChainId: 4689,
    rpcs: [
      "https://babel-api.mainnet.iotex.io"
    ],
    explorer: "https://iotexscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/304'/0'/0/0",
    cg: "iotex",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10005042,
    id: "arc",
    name: "Arc",
    wcId: "arc",
    ct: "arc",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "USDC",
    decimals: 18,
    evmChainId: 5042,
    rpcs: [
      "https://rpc.mainnet.arc.io",
      "https://rpc.blockdaemon.mainnet.arc.io",
      "https://rpc.drpc.mainnet.arc.io",
      "https://rpc.quicknode.mainnet.arc.io"
    ],
    explorer: "https://explorer.arc.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "usd-coin",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10007e3,
    id: "zetachain",
    name: "NativeZetaChain",
    wcId: "zetachain",
    ct: "nativeZetaChain",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "ZETA",
    decimals: 18,
    endpoints: [
      "https://zetachain-rest.publicnode.com"
    ],
    explorer: "https://explorer.zetachain.com",
    txPath: "/cosmos/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "zetachain",
    hrp: "zeta",
    dbLookup: false,
    ws: false
  },
  {
    twId: 10008217,
    id: "klaytn",
    name: "Kaia",
    wcId: "kaia",
    ct: "kaia",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "KAIA",
    decimals: 18,
    evmChainId: 8217,
    rpcs: [
      "https://public-en-cypress.klaytn.net"
    ],
    explorer: "https://kaiascan.io",
    txPath: "/tx/",
    accountPath: "/account/",
    path: "m/44'/60'/0'/0/0",
    cg: "kaia",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10009e3,
    id: "avalanchec",
    name: "Avalanche C-Chain",
    wcId: "avalanchec",
    ct: "avalancheCChain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "AVAX",
    decimals: 18,
    evmChainId: 43114,
    rpcs: [
      "https://api.avax.network/ext/bc/C/rpc"
    ],
    explorer: "https://snowtrace.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "avalanche-2",
    dbLookup: true,
    ws: true
  },
  {
    twId: 10042221,
    id: "arbitrum",
    name: "Arbitrum",
    wcId: "arbitrum",
    ct: "arbitrum",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 42161,
    rpcs: [
      "https://arb1.arbitrum.io/rpc"
    ],
    explorer: "https://arbiscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: true,
    ws: true
  },
  {
    twId: 17000118,
    id: "akash",
    name: "Akash",
    wcId: "akash",
    ct: "akash",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "AKT",
    decimals: 6,
    endpoints: [
      "https://akash-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/akash",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "akash-network",
    hrp: "akash",
    dbLookup: false,
    ws: false
  },
  {
    twId: 19000118,
    id: "sei",
    name: "Sei",
    wcId: "sei",
    ct: "sei",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "SEI",
    decimals: 6,
    endpoints: [
      "https://sei-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/sei",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "sei-network",
    hrp: "sei",
    dbLookup: false,
    ws: false
  },
  {
    twId: 20000714,
    id: "smartchain",
    name: "Smart Chain",
    wcId: "smartchain",
    ct: "smartChain",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "BNB",
    decimals: 18,
    evmChainId: 56,
    rpcs: [
      "https://bsc-dataseed.binance.org"
    ],
    explorer: "https://bscscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "binancecoin",
    dbLookup: true,
    ws: true
  },
  {
    twId: 30000118,
    id: "juno",
    name: "Juno",
    wcId: "juno",
    ct: "juno",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "JUNO",
    decimals: 6,
    endpoints: [
      "https://juno-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/juno",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "juno-network",
    hrp: "juno",
    dbLookup: true,
    ws: true
  },
  {
    twId: 40000118,
    id: "stride",
    name: "Stride",
    wcId: "stride",
    ct: "stride",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "STRD",
    decimals: 6,
    endpoints: [
      "https://stride-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/stride",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "stride",
    hrp: "stride",
    dbLookup: false,
    ws: false
  },
  {
    twId: 50000118,
    id: "axelar",
    name: "Axelar",
    wcId: "axelar",
    ct: "axelar",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "AXL",
    decimals: 6,
    endpoints: [
      "https://axelar-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/axelar",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "axelar",
    hrp: "axelar",
    dbLookup: true,
    ws: true
  },
  {
    twId: 90000118,
    id: "neutron",
    name: "Neutron",
    wcId: "neutron",
    ct: "neutron",
    kind: "cosmos",
    blockchain: "Cosmos",
    symbol: "NTRN",
    decimals: 6,
    endpoints: [
      "https://neutron-rest.publicnode.com"
    ],
    explorer: "https://www.mintscan.io/neutron",
    txPath: "/txs/",
    accountPath: "/account/",
    path: "m/44'/118'/0'/0/0",
    cg: "neutron-3",
    hrp: "neutron",
    dbLookup: true,
    ws: true
  },
  {
    twId: 245022934,
    id: "neon",
    name: "Neon",
    wcId: "neon",
    ct: "neon",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "NEON",
    decimals: 18,
    evmChainId: 245022934,
    rpcs: [
      "https://neon-proxy-mainnet.solana.p2p.org"
    ],
    explorer: "https://neonscan.org",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "neon",
    dbLookup: false,
    ws: false
  },
  {
    twId: 1323161554,
    id: "aurora",
    name: "Aurora",
    wcId: "aurora",
    ct: "aurora",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 1313161554,
    rpcs: [
      "https://mainnet.aurora.dev"
    ],
    explorer: "https://aurorascan.dev",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    dbLookup: false,
    ws: false
  }
];

// src/core/chains/registry.extra.json
var registry_extra_default = [
  {
    twId: 137,
    id: "rootstock",
    name: "Rootstock",
    wcId: "rootstock",
    ct: "rootstock",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "RBTC",
    decimals: 18,
    evmChainId: 30,
    rpcs: [
      "https://public-node.rsk.co"
    ],
    explorer: "https://explorer.rsk.co",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/137'/0'/0/0",
    cg: "rootstock",
    extra: true
  },
  {
    twId: 361,
    id: "tfuelevm",
    name: "Theta Fuel",
    wcId: "tfuelevm",
    ct: "thetaFuel",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "TFUEL",
    decimals: 18,
    evmChainId: 361,
    rpcs: [
      "https://eth-rpc-api.thetatoken.org/rpc"
    ],
    explorer: "https://explorer.thetatoken.org",
    txPath: "/tx/",
    accountPath: "/account/",
    path: "m/44'/500'/0'/0/0",
    cg: "theta-fuel",
    extra: true
  },
  {
    twId: 820,
    id: "callisto",
    name: "Callisto",
    wcId: "callisto",
    ct: "callisto",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "CLO",
    decimals: 18,
    evmChainId: 820,
    rpcs: [
      "https://rpc.callisto.network"
    ],
    explorer: "https://explorer.callistodao.org",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/820'/0'/0/0",
    cg: "callisto",
    extra: true
  },
  {
    twId: 1329,
    id: "seievm",
    name: "Sei EVM",
    wcId: "seievm",
    ct: "seiEVM",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "SEI",
    decimals: 18,
    evmChainId: 1329,
    rpcs: [
      "https://evm-rpc.sei-apis.com"
    ],
    explorer: "https://seiscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "sei-network",
    extra: true
  },
  {
    twId: 1890,
    id: "lightlink",
    name: "Lightlink",
    wcId: "lightlink",
    ct: "lightlink",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 1890,
    rpcs: [
      "https://replicator.phoenix.lightlink.io/rpc/v1"
    ],
    explorer: "https://phoenix.lightlink.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    extra: true
  },
  {
    twId: 18e3,
    id: "meter",
    name: "Meter",
    wcId: "meter",
    ct: "meter",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "MTR",
    decimals: 18,
    evmChainId: 82,
    rpcs: [
      "https://rpc.meter.io"
    ],
    explorer: "https://scan.meter.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "meter",
    extra: true
  },
  {
    twId: 10000787,
    id: "acalaevm",
    name: "Acala EVM",
    wcId: "acalaevm",
    ct: "acalaEVM",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ACA",
    decimals: 18,
    evmChainId: 787,
    rpcs: [
      "https://eth-rpc-acala.aca-api.network"
    ],
    explorer: "https://blockscout.acala.network",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "acala",
    extra: true
  },
  {
    twId: 10001101,
    id: "polygonzkevm",
    name: "Polygon zkEVM",
    wcId: "polygonzkevm",
    ct: "polygonzkEVM",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 1101,
    rpcs: [
      "https://zkevm-rpc.com"
    ],
    explorer: "https://zkevm.polygonscan.com",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    extra: true
  },
  {
    twId: 10042170,
    id: "arbitrumnova",
    name: "Arbitrum Nova",
    wcId: "arbitrumnova",
    ct: "arbitrumNova",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    evmChainId: 42170,
    rpcs: [
      "https://nova.arbitrum.io/rpc"
    ],
    explorer: "https://nova.arbiscan.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "ethereum",
    extra: true
  },
  {
    twId: 20007e3,
    id: "zetaevm",
    name: "Zeta EVM",
    wcId: "zetaevm",
    ct: "zetaEVM",
    kind: "evm",
    blockchain: "Ethereum",
    symbol: "ZETA",
    decimals: 18,
    evmChainId: 7e3,
    rpcs: [
      "https://zetachain-evm.blockpi.network/v1/rpc/public"
    ],
    explorer: "https://explorer.zetachain.com",
    txPath: "/evm/tx/",
    accountPath: "/address/",
    path: "m/44'/60'/0'/0/0",
    cg: "zetachain",
    extra: true
  },
  {
    twId: 2,
    id: "litecoin",
    name: "Litecoin",
    wcId: "litecoin",
    ct: "litecoin",
    kind: "utxo",
    api: "blockbook",
    blockchain: "Bitcoin",
    symbol: "LTC",
    decimals: 8,
    endpoints: [
      "https://ltc1.trezor.io"
    ],
    explorer: "https://ltc1.trezor.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/84'/2'/0'/0/0",
    cg: "litecoin",
    hrp: "ltc",
    extra: true
  },
  {
    twId: 3,
    id: "dogecoin",
    name: "Dogecoin",
    wcId: "doge",
    ct: "dogecoin",
    kind: "utxo",
    api: "blockbook",
    blockchain: "Bitcoin",
    symbol: "DOGE",
    decimals: 8,
    endpoints: [
      "https://doge1.trezor.io"
    ],
    explorer: "https://doge1.trezor.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/3'/0'/0/0",
    cg: "dogecoin",
    extra: true
  },
  {
    twId: 5,
    id: "dash",
    name: "Dash",
    wcId: "dash",
    ct: "dash",
    kind: "utxo",
    api: "blockbook",
    blockchain: "Bitcoin",
    symbol: "DASH",
    decimals: 8,
    endpoints: [
      "https://dash1.trezor.io"
    ],
    explorer: "https://dash1.trezor.io",
    txPath: "/tx/",
    accountPath: "/address/",
    path: "m/44'/5'/0'/0/0",
    cg: "dash",
    extra: true
  },
  {
    twId: 1815,
    id: "cardano",
    name: "Cardano",
    wcId: "cardano",
    ct: "cardano",
    kind: "cardano",
    blockchain: "Cardano",
    symbol: "ADA",
    decimals: 6,
    endpoints: [
      "https://api.koios.rest/api/v1"
    ],
    explorer: "https://cardanoscan.io",
    txPath: "/transaction/",
    accountPath: "/address/",
    path: "m/1852'/1815'/0'/0/0",
    cg: "cardano",
    extra: true
  }
];

// src/core/chains/extra-enabled.json
var extra_enabled_default = [
  "rootstock",
  "tfuelevm",
  "seievm",
  "lightlink",
  "meter",
  "acalaevm",
  "polygonzkevm",
  "arbitrumnova",
  "zetaevm"
];

// src/core/chains/testnets.ts
var ROWS = [
  ["sepolia", "Sepolia", 11155111, "ETH", ["https://ethereum-sepolia-rpc.publicnode.com"], "https://sepolia.etherscan.io"],
  ["hoodi", "Ethereum Hoodi", 560048, "ETH", ["https://ethereum-hoodi-rpc.publicnode.com", "https://rpc.hoodi.ethpandaops.io"], "https://hoodi.etherscan.io"],
  ["base-sepolia", "Base Sepolia", 84532, "ETH", ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"], "https://sepolia.basescan.org"],
  ["arbitrum-sepolia", "Arbitrum Sepolia", 421614, "ETH", ["https://sepolia-rollup.arbitrum.io/rpc", "https://arbitrum-sepolia-rpc.publicnode.com"], "https://sepolia.arbiscan.io"],
  ["optimism-sepolia", "Optimism Sepolia", 11155420, "ETH", ["https://sepolia.optimism.io", "https://optimism-sepolia-rpc.publicnode.com"], "https://sepolia-optimism.etherscan.io"],
  ["polygon-amoy", "Polygon Amoy", 80002, "POL", ["https://rpc-amoy.polygon.technology", "https://polygon-amoy-bor-rpc.publicnode.com"], "https://amoy.polygonscan.com"],
  ["smartchain-testnet", "BNB Smart Chain Testnet", 97, "BNB", ["https://bsc-testnet-rpc.publicnode.com", "https://data-seed-prebsc-1-s1.bnbchain.org:8545"], "https://testnet.bscscan.com"],
  ["opbnb-testnet", "opBNB Testnet", 5611, "BNB", ["https://opbnb-testnet-rpc.bnbchain.org"], "https://opbnb-testnet.bscscan.com"],
  ["avalanche-fuji", "Avalanche Fuji", 43113, "AVAX", ["https://api.avax-test.network/ext/bc/C/rpc", "https://avalanche-fuji-c-chain-rpc.publicnode.com"], "https://testnet.snowtrace.io"],
  ["linea-sepolia", "Linea Sepolia", 59141, "ETH", ["https://rpc.sepolia.linea.build", "https://linea-sepolia-rpc.publicnode.com"], "https://sepolia.lineascan.build"],
  ["scroll-sepolia", "Scroll Sepolia", 534351, "ETH", ["https://sepolia-rpc.scroll.io", "https://scroll-sepolia-rpc.publicnode.com"], "https://sepolia.scrollscan.com"],
  ["zksync-sepolia", "zkSync Sepolia", 300, "ETH", ["https://sepolia.era.zksync.dev"], "https://sepolia.explorer.zksync.io"],
  ["mantle-sepolia", "Mantle Sepolia", 5003, "MNT", ["https://rpc.sepolia.mantle.xyz"], "https://explorer.sepolia.mantle.xyz"],
  ["blast-sepolia", "Blast Sepolia", 168587773, "ETH", ["https://sepolia.blast.io", "https://blast-sepolia.drpc.org"], "https://sepolia.blastscan.io"],
  ["unichain-sepolia", "Unichain Sepolia", 1301, "ETH", ["https://sepolia.unichain.org"], "https://sepolia.uniscan.xyz"],
  ["ink-sepolia", "Ink Sepolia", 763373, "ETH", ["https://rpc-gel-sepolia.inkonchain.com"], "https://explorer-sepolia.inkonchain.com"],
  ["worldchain-sepolia", "World Chain Sepolia", 4801, "ETH", ["https://worldchain-sepolia.g.alchemy.com/public"], "https://sepolia.worldscan.org"],
  ["polygon-zkevm-cardona", "Polygon zkEVM Cardona", 2442, "ETH", ["https://rpc.cardona.zkevm-rpc.com"], "https://cardona-zkevm.polygonscan.com"],
  ["gnosis-chiado", "Gnosis Chiado", 10200, "xDAI", ["https://rpc.chiadochain.net", "https://gnosis-chiado-rpc.publicnode.com"], "https://gnosis-chiado.blockscout.com"],
  ["monad-testnet", "Monad Testnet", 10143, "MON", ["https://testnet-rpc.monad.xyz"], "https://testnet.monadexplorer.com"],
  ["berachain-bepolia", "Berachain Bepolia", 80069, "BERA", ["https://bepolia.rpc.berachain.com"], "https://testnet.berascan.com"],
  ["moonbase-alpha", "Moonbase Alpha", 1287, "DEV", ["https://rpc.api.moonbase.moonbeam.network"], "https://moonbase.moonscan.io"]
];
var TESTNET_CHAINS = ROWS.map(([id, name, evmChainId, symbol, rpcs, explorer]) => ({
  twId: 60,
  id,
  name,
  wcId: "ethereum",
  ct: "ethereum",
  kind: "evm",
  blockchain: "Ethereum",
  symbol,
  decimals: 18,
  evmChainId,
  rpcs,
  explorer,
  txPath: "/tx/{id}",
  accountPath: "/address/{address}",
  testnet: true,
  // Sepolia keeps its historical native price id; every other test coin is unpriced.
  ...id === "sepolia" ? { cg: "ethereum" } : {}
}));

// src/core/chains/index.ts
var EXTRA_CHAINS = registry_extra_default;
var ALL_CHAINS = [...registry_default, ...EXTRA_CHAINS.filter((c) => extra_enabled_default.includes(c.id))];
var byId = new Map([...ALL_CHAINS, ...TESTNET_CHAINS].map((c) => [c.id, c]));
var byTw = new Map(ALL_CHAINS.map((c) => [c.twId, c]));
var byEvm = new Map([...ALL_CHAINS, ...TESTNET_CHAINS].filter((c) => c.evmChainId).map((c) => [c.evmChainId, c]));
export {
  ALL_CHAINS,
  DEFAULT_SETTINGS,
  IMPORT_ERRORS,
  MAX_WALLETS,
  MAX_WALLET_NAME,
  PRIVATE_KEY_MIN_LENGTH,
  WALLET_LIMIT_ERROR,
  applyPatch,
  backupVerify_exports as backup,
  canCreateWallet,
  classifySecret,
  coreCodec,
  decodePrivateKeyBytes,
  defaultWalletName,
  evmFamily,
  hasDuplicateAddress,
  mnemonicLengthState,
  mnemonicWordCount,
  normalizeMnemonic,
  pickSolanaVariants,
  privateKeyNetworkOptions,
  qrImport_exports as qr,
  onboardingRules_exports as rules,
  solanaHasHistory,
  settingsExtra_exports as sx,
  validatePrivateKey,
  validateWalletName
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
