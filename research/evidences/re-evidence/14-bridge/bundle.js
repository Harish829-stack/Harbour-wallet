(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "2b64bd16-ee61-4b24-b10f-d4f4c2058a44";
            e._sentryDebugIdIdentifier = "sentry-dbid-2b64bd16-ee61-4b24-b10f-d4f4c2058a44";
        }
    } catch (e) {}
})();
const content = function() {
    let e;
    let t;
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    const __esmMin = (e, t)=>()=>{
            if (e) {
                t = e(e = 0);
            }
            return t;
        };
    const __commonJSMin = (e, t)=>()=>{
            if (!t) {
                e((t = {
                    exports: {}
                }).exports, t);
                e = null;
            }
            return t.exports;
        };
    const __exportAll = (e, t)=>{
        let n = {};
        for(var o in e){
            Object.defineProperty(n, o, {
                get: e[o],
                enumerable: true
            });
        }
        if (!t) {
            Object.defineProperty(n, Symbol.toStringTag, {
                value: "Module"
            });
        }
        return n;
    };
    const __toESM = (e, t, c)=>{
        c = e != null ? Object.create(Object.getPrototypeOf(e)) : {};
        return ((e, t, n, s)=>{
            if (t && typeof t === "object" || typeof t === "function") {
                var c;
                var l = Object.getOwnPropertyNames(t);
                for(var u = 0, d = l.length; u < d; u++){
                    c = l[u];
                    if (!(hasOwnProperty.call(e, c) || c === n)) {
                        Object.defineProperty(e, c, {
                            get: ((e)=>t[e]).bind(null, c),
                            enumerable: !(s = Object.getOwnPropertyDescriptor(t, c)) || s.enumerable
                        });
                    }
                }
            }
            return e;
        })(!t && e && e.__esModule ? c : Object.defineProperty(c, "default", {
            value: e,
            enumerable: true
        }), e);
    };
    const c = __esmMin(()=>{
        t = (e = [
            "facebook.com",
            "fb.com",
            "messenger.com",
            "instagram.com",
            "threads.net",
            "whatsapp.com",
            "meta.com",
            "workplace.com",
            "twitter.com",
            "x.com",
            "tiktok.com",
            "linkedin.com",
            "snapchat.com",
            "calendar.google.com",
            "mail.google.com",
            "docs.google.com",
            "drive.google.com",
            "meet.google.com",
            "keep.google.com"
        ]).map((e)=>`*://*.${e}/*`);
    });
    c();
    let l;
    let u;
    let d;
    let h;
    let f;
    let writeBlockPromise;
    let m;
    const excludeMatches = [
        "*://*.challenges.cloudflare.com/*",
        "*://*.hcaptcha.com/*",
        "*://www.google.com/recaptcha/*",
        "*://*.recaptcha.net/recaptcha/*",
        "*://*.arkoselabs.com/*",
        "*://*.funcaptcha.com/*",
        "*://*.captcha-delivery.com/*",
        ...t,
        "*://*.magic.link/*",
        "*://*.doubleclick.net/*",
        "*://*.googlesyndication.com/*",
        "*://*.amazon-adsystem.com/*"
    ];
    const v = __esmMin(()=>{
        l = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
    });
    const y = __esmMin(()=>{
        v();
        u = (e = 21)=>{
            let t = "";
            let n = crypto.getRandomValues(new Uint8Array(e |= 0));
            while(e--){
                t += l[63 & n[e]];
            }
            return t;
        };
    });
    const b = __esmMin(()=>{
        y();
        d = (e)=>`${e}_${u()}_callback`;
        h = (e)=>{
            if (e instanceof Error) {
                return e;
            }
            if (typeof e === "string") {
                const t = new Error(e);
                t.stack = "";
                return t;
            }
            if (typeof e !== "object" || e === null || Array.isArray(e)) {
                return e;
            }
            const { message, ...rest } = e;
            const r = Object.assign(new Error(typeof message === "string" ? message : ""), rest);
            r.stack = "";
            return r;
        };
        f = class {
            constructor(){
                this.listeners = {};
            }
            addListener(e, t) {
                const n = this.listeners[e] || [];
                n.push(t);
                this.listeners[e] = n;
            }
            once(e, t) {
                this.addListener(e, (n)=>{
                    delete this.listeners[e];
                    return t(n);
                });
            }
            emit(method, params) {
                return new Promise((resolve, reject)=>{
                    const cbMethod = d(method);
                    this.once(cbMethod, async (e)=>{
                        if (e.data?.error) {
                            reject(h(e.data.error));
                        } else {
                            resolve(e.data.params);
                        }
                    });
                    const failed = (e)=>{
                        delete this.listeners[cbMethod];
                        reject(e);
                    };
                    try {
                        const n = this.send({
                            method,
                            data: {
                                cbMethod,
                                params
                            }
                        });
                        if (typeof n?.then === "function") {
                            Promise.resolve(n).catch(failed);
                        }
                    } catch (error) {
                        failed(error);
                    }
                });
            }
            disconnect() {}
        };
    });
    function sleep$1(e, t) {
        if (!e) {
            e = 0;
        }
        return new Promise((resolve)=>setTimeout(()=>resolve(t), e));
    }
    function randomToken() {
        return Math.random().toString(36).substring(2);
    }
    function microSeconds$4() {
        let e = 1000 * Date.now();
        if (e <= m) {
            e = m + 1;
        }
        m = e;
        return e;
    }
    let E;
    const w = __esmMin(()=>{
        Promise.resolve(false);
        Promise.resolve(true);
        writeBlockPromise = Promise.resolve();
        m = 0;
    });
    function create$3(e) {
        const t = {
            time: microSeconds$4(),
            messagesCallback: null,
            bc: new BroadcastChannel(e),
            subFns: []
        };
        t.bc.onmessage = function(e) {
            if (t.messagesCallback) {
                t.messagesCallback(e.data);
            }
        };
        return t;
    }
    function close$3(e) {
        e.bc.close();
        e.subFns = [];
    }
    function postMessage$3(e, t) {
        try {
            e.bc.postMessage(t, false);
            return writeBlockPromise;
        } catch (error) {
            return Promise.reject(error);
        }
    }
    function onMessage$3(e, t) {
        e.messagesCallback = t;
    }
    function canBeUsed$3() {
        if (typeof globalThis !== "undefined" && globalThis.Deno && globalThis.Deno.args) {
            return true;
        }
        if (typeof window === "undefined" && typeof self === "undefined" || typeof BroadcastChannel !== "function") {
            return false;
        }
        if (BroadcastChannel._pubkey) {
            throw new Error("BroadcastChannel: Do not overwrite window.BroadcastChannel with this module, this is not a polyfill");
        }
        return true;
    }
    function averageResponseTime$3() {
        return 150;
    }
    let L;
    const _ = __esmMin(()=>{
        w();
        E = {
            create: create$3,
            close: close$3,
            onMessage: onMessage$3,
            postMessage: postMessage$3,
            canBeUsed: canBeUsed$3,
            type: "native",
            averageResponseTime: averageResponseTime$3,
            microSeconds: microSeconds$4
        };
    });
    function now() {
        return Date.now();
    }
    const T = __esmMin(()=>{
        L = class {
            ttl;
            map = new Map;
            _to = false;
            constructor(e){
                this.ttl = e;
            }
            has(e) {
                const t = this.map.get(e);
                return t !== undefined && (!(t < now() - this.ttl) || (this.map.delete(e), false));
            }
            add(e) {
                this.map.delete(e);
                this.map.set(e, now());
                if (!this._to) {
                    this._to = true;
                    setTimeout(()=>{
                        this._to = false;
                        (function removeTooOldValues(e) {
                            const t = now() - e.ttl;
                            const n = e.map[Symbol.iterator]();
                            while(true){
                                const r = n.next().value;
                                if (!r) {
                                    break;
                                }
                                const o = r[0];
                                if (!(r[1] < t)) {
                                    break;
                                }
                                e.map.delete(o);
                            }
                        })(this);
                    }, 0);
                }
            }
            clear() {
                this.map.clear();
            }
        };
    });
    function fillOptionsWithDefaults(e = {}) {
        const t = JSON.parse(JSON.stringify(e));
        if (t.webWorkerSupport === undefined) {
            t.webWorkerSupport = true;
        }
        if (!t.idb) {
            t.idb = {};
        }
        if (!t.idb.ttl) {
            t.idb.ttl = 45000;
        }
        if (!t.idb.fallbackInterval) {
            t.idb.fallbackInterval = 150;
        }
        if (e.idb && typeof e.idb.onclose === "function") {
            t.idb.onclose = e.idb.onclose;
        }
        if (!t.localstorage) {
            t.localstorage = {};
        }
        if (!t.localstorage.removeTimeout) {
            t.localstorage.removeTimeout = 60000;
        }
        if (e.methods) {
            t.methods = e.methods;
        }
        if (!t.node) {
            t.node = {};
        }
        if (!t.node.ttl) {
            t.node.ttl = 120000;
        }
        if (!t.node.maxParallelWrites) {
            t.node.maxParallelWrites = 2048;
        }
        if (t.node.useFastPath === undefined) {
            t.node.useFastPath = true;
        }
        return t;
    }
    let C;
    let I;
    let S;
    let A;
    const R = __esmMin(()=>{});
    function getIdb() {
        if (typeof indexedDB !== "undefined") {
            return indexedDB;
        }
        if (typeof window !== "undefined") {
            if (window.mozIndexedDB !== undefined) {
                return window.mozIndexedDB;
            }
            if (window.webkitIndexedDB !== undefined) {
                return window.webkitIndexedDB;
            }
            if (window.msIndexedDB !== undefined) {
                return window.msIndexedDB;
            }
        }
        return false;
    }
    function commitIndexedDBTransaction(e) {
        if (e.commit) {
            e.commit();
        }
    }
    function getMessagesHigherThan(e, lastCursorId) {
        const n = e.transaction(I, "readonly", S);
        const r = n.objectStore(I);
        const o = [];
        let i = IDBKeyRange.bound(lastCursorId + 1, Infinity);
        if (r.getAll) {
            const s = r.getAll(i);
            return new Promise((resolve, reject)=>{
                s.onerror = function(e) {
                    return reject(e);
                };
                s.onsuccess = function(t) {
                    resolve(t.target.result);
                };
            });
        }
        return new Promise((resolve, reject)=>{
            const a = function openCursor() {
                try {
                    i = IDBKeyRange.bound(lastCursorId + 1, Infinity);
                    return r.openCursor(i);
                } catch (e) {
                    return r.openCursor();
                }
            }();
            a.onerror = function(e) {
                return reject(e);
            };
            a.onsuccess = function(r) {
                const result = r.target.result;
                if (result) {
                    if (result.value.id < lastCursorId + 1) {
                        result.continue(lastCursorId + 1);
                    } else {
                        o.push(result.value);
                        result.continue();
                    }
                } else {
                    commitIndexedDBTransaction(n);
                    resolve(o);
                }
            };
        });
    }
    function cleanOldMessages(e) {
        return (function getOldMessages(e, t) {
            const n = Date.now() - t;
            const r = e.transaction(I, "readonly", S);
            const o = r.objectStore(I);
            const i = [];
            return new Promise((resolve)=>{
                o.openCursor().onsuccess = function(t) {
                    const result = t.target.result;
                    if (result) {
                        const s = result.value;
                        if (s.time < n) {
                            i.push(s);
                            result.continue();
                        } else {
                            commitIndexedDBTransaction(r);
                            resolve(i);
                        }
                    } else {
                        resolve(i);
                    }
                };
            });
        })(e.db, e.options.idb.ttl).then((t)=>(function removeMessagesById(e, t) {
                if (e.closed) {
                    return Promise.resolve([]);
                }
                const n = e.db.transaction(I, "readwrite", S).objectStore(I);
                return Promise.all(t.map((e)=>{
                    const t = n.delete(e);
                    return new Promise((resolve)=>{
                        t.onsuccess = function() {
                            return resolve();
                        };
                    });
                }));
            })(e, t.map((e)=>e.id)));
    }
    function create$2(e, options) {
        options = fillOptionsWithDefaults(options);
        return (function createDatabase(e) {
            const t = getIdb();
            const n = C + e;
            const r = t.open(n);
            r.onupgradeneeded = function(e) {
                e.target.result.createObjectStore(I, {
                    keyPath: "id",
                    autoIncrement: true
                });
            };
            return new Promise((resolve, reject)=>{
                r.onerror = function(e) {
                    return reject(e);
                };
                r.onsuccess = function() {
                    resolve(r.result);
                };
            });
        })(e).then((db)=>{
            const r = {
                closed: false,
                lastCursorId: 0,
                channelName: e,
                options,
                uuid: randomToken(),
                eMIs: new L(2 * options.idb.ttl),
                writeBlockPromise,
                messagesCallback: null,
                readQueuePromises: [],
                db
            };
            db.onclose = function() {
                r.closed = true;
                if (options.idb.onclose) {
                    options.idb.onclose();
                }
            };
            _readLoop(r);
            return r;
        });
    }
    function _readLoop(e) {
        if (!e.closed) {
            readNewMessages(e).then(()=>sleep$1(e.options.idb.fallbackInterval)).then(()=>_readLoop(e));
        }
    }
    function readNewMessages(e) {
        if (e.closed) {
            return writeBlockPromise;
        }
        if (e.messagesCallback) {
            return getMessagesHigherThan(e.db, e.lastCursorId).then((t)=>{
                t.filter((e)=>!!e).map((t)=>{
                    if (t.id > e.lastCursorId) {
                        e.lastCursorId = t.id;
                    }
                    return t;
                }).filter((t)=>(function _filterMessage(e, t) {
                        return !(e.uuid === t.uuid || t.eMIs.has(e.id) || e.data.time < t.messagesCallbackTime);
                    })(t, e)).sort((e, t)=>e.time - t.time).forEach((t)=>{
                    if (e.messagesCallback) {
                        e.eMIs.add(t.id);
                        e.messagesCallback(t.data);
                    }
                });
                return writeBlockPromise;
            });
        }
        return writeBlockPromise;
    }
    function close$2(e) {
        e.closed = true;
        e.db.close();
    }
    function postMessage$2(e, t) {
        e.writeBlockPromise = e.writeBlockPromise.then(()=>(function writeMessage(e, uuid, n) {
                const r = {
                    uuid,
                    time: Date.now(),
                    data: n
                };
                const o = e.transaction([
                    I
                ], "readwrite", S);
                return new Promise((resolve, reject)=>{
                    o.oncomplete = function() {
                        return resolve();
                    };
                    o.onerror = function(e) {
                        return reject(e);
                    };
                    o.objectStore(I).add(r);
                    commitIndexedDBTransaction(o);
                });
            })(e.db, e.uuid, t)).then(()=>{
            if (function randomInt() {
                const e = 0;
                const t = 10;
                return Math.floor(Math.random() * (t - e + 1) + e);
            }() === 0) {
                cleanOldMessages(e);
            }
        });
        return e.writeBlockPromise;
    }
    function onMessage$2(e, t, n) {
        e.messagesCallbackTime = n;
        e.messagesCallback = t;
        readNewMessages(e);
    }
    function canBeUsed$2() {
        return !!getIdb();
    }
    function averageResponseTime$2(e) {
        return 2 * e.idb.fallbackInterval;
    }
    let M;
    let P;
    const k = __esmMin(()=>{
        w();
        T();
        R();
        C = "pubkey.broadcast-channel-0-";
        I = "messages";
        S = {
            durability: "relaxed"
        };
        A = {
            create: create$2,
            close: close$2,
            onMessage: onMessage$2,
            postMessage: postMessage$2,
            canBeUsed: canBeUsed$2,
            type: "idb",
            averageResponseTime: averageResponseTime$2,
            microSeconds: microSeconds$4
        };
    });
    function getLocalStorage() {
        let e;
        if (typeof window === "undefined") {
            return null;
        }
        try {
            e = window.localStorage;
            e = window["ie8-eventlistener/storage"] || window.localStorage;
        } catch (t) {}
        return e;
    }
    function storageKey(e) {
        return M + e;
    }
    function postMessage$1(e, t) {
        return new Promise((resolve)=>{
            sleep$1().then(()=>{
                const r = storageKey(e.channelName);
                const o = {
                    token: randomToken(),
                    time: Date.now(),
                    data: t,
                    uuid: e.uuid
                };
                const i = JSON.stringify(o);
                getLocalStorage().setItem(r, i);
                const s = document.createEvent("Event");
                s.initEvent("storage", true, true);
                s.key = r;
                s.newValue = i;
                window.dispatchEvent(s);
                resolve();
            });
        });
    }
    function create$1(e, t) {
        t = fillOptionsWithDefaults(t);
        if (!canBeUsed$1()) {
            throw new Error("BroadcastChannel: localstorage cannot be used");
        }
        const uuid = randomToken();
        const eMIs = new L(t.localstorage.removeTimeout);
        const o = {
            channelName: e,
            uuid,
            eMIs
        };
        o.listener = function addStorageEventListener(e, t) {
            const n = storageKey(e);
            const r = function listener(e) {
                if (e.key === n) {
                    t(JSON.parse(e.newValue));
                }
            };
            window.addEventListener("storage", r);
            return r;
        }(e, (e)=>{
            if (o.messagesCallback && e.uuid !== uuid && e.token && !eMIs.has(e.token)) {
                if (!(e.data.time && e.data.time < o.messagesCallbackTime)) {
                    eMIs.add(e.token);
                    o.messagesCallback(e.data);
                }
            }
        });
        return o;
    }
    function close$1(e) {
        (function removeStorageEventListener(e) {
            window.removeEventListener("storage", e);
        })(e.listener);
    }
    function onMessage$1(e, t, n) {
        e.messagesCallbackTime = n;
        e.messagesCallback = t;
    }
    function canBeUsed$1() {
        const e = getLocalStorage();
        if (!e) {
            return false;
        }
        try {
            const t = "__broadcastchannel_check";
            e.setItem(t, "works");
            e.removeItem(t);
        } catch (n) {
            return false;
        }
        return true;
    }
    function averageResponseTime$1() {
        const e = navigator.userAgent.toLowerCase();
        if (e.includes("safari") && !e.includes("chrome")) {
            return 240;
        }
        return 120;
    }
    let microSeconds;
    let O;
    let B;
    const x = __esmMin(()=>{
        T();
        R();
        w();
        M = "pubkey.broadcastChannel-";
        P = {
            create: create$1,
            close: close$1,
            onMessage: onMessage$1,
            postMessage: postMessage$1,
            canBeUsed: canBeUsed$1,
            type: "localstorage",
            averageResponseTime: averageResponseTime$1,
            microSeconds: microSeconds$4
        };
    });
    function create(name) {
        const t = {
            time: microSeconds(),
            name,
            messagesCallback: null
        };
        O.add(t);
        return t;
    }
    function close(e) {
        O.delete(e);
    }
    function postMessage(e, t) {
        return new Promise((resolve)=>setTimeout(()=>{
                Array.from(O).forEach((n)=>{
                    if (n.name === e.name && n !== e && n.messagesCallback && n.time < t.time) {
                        n.messagesCallback(t);
                    }
                });
                resolve();
            }, 5));
    }
    function onMessage(e, t) {
        e.messagesCallback = t;
    }
    function canBeUsed() {
        return true;
    }
    function averageResponseTime() {
        return 5;
    }
    let D;
    const U = __esmMin(()=>{
        w();
        microSeconds = microSeconds$4;
        O = new Set;
        B = {
            create,
            close,
            onMessage,
            postMessage,
            canBeUsed,
            type: "simulate",
            averageResponseTime,
            microSeconds
        };
    });
    let $;
    let H;
    let F;
    const j = __esmMin(()=>{
        _();
        k();
        x();
        U();
        D = [
            E,
            A,
            P
        ];
    });
    function _post(e, t, n) {
        const r = {
            time: e.method.microSeconds(),
            type: t,
            data: n
        };
        return (e._prepP ? e._prepP : writeBlockPromise).then(()=>{
            const t = e.method.postMessage(e._state, r);
            e._uMP.add(t);
            t.catch().then(()=>e._uMP.delete(t));
            return t;
        });
    }
    function _hasMessageListeners(e) {
        return e._addEL.message.length > 0 || e._addEL.internal.length > 0;
    }
    function _addListenerObject(e, t, n) {
        e._addEL[t].push(n);
        (function _startListening(e) {
            if (!e._iL && _hasMessageListeners(e)) {
                const t = function listenerFn(t) {
                    e._addEL[t.type].forEach((e)=>{
                        if (t.time >= e.time) {
                            e.fn(t.data);
                        }
                    });
                };
                const n = e.method.microSeconds();
                if (e._prepP) {
                    e._prepP.then(()=>{
                        e._iL = true;
                        e.method.onMessage(e._state, t, n);
                    });
                } else {
                    e._iL = true;
                    e.method.onMessage(e._state, t, n);
                }
            }
        })(e);
    }
    function _removeListenerObject(e, t, n) {
        e._addEL[t] = e._addEL[t].filter((e)=>e !== n);
        (function _stopListening(e) {
            if (e._iL && !_hasMessageListeners(e)) {
                e._iL = false;
                const t = e.method.microSeconds();
                e.method.onMessage(e._state, null, t);
            }
        })(e);
    }
    let W;
    let G;
    let V;
    let Y;
    let K;
    let q;
    let z;
    let J;
    let Q;
    let X;
    const Z = __esmMin(()=>{
        w();
        j();
        R();
        $ = new Set;
        H = 0;
        F = function BroadcastChannel(e, t) {
            this.id = H++;
            $.add(this);
            this.name = e;
            this.options = fillOptionsWithDefaults(t);
            this.method = function chooseMethod(e) {
                let t = [].concat(e.methods, D).filter(Boolean);
                if (e.type) {
                    if (e.type === "simulate") {
                        return B;
                    }
                    const n = t.find((t)=>t.type === e.type);
                    if (n) {
                        return n;
                    }
                    throw new Error(`method-type ${e.type} not found`);
                }
                if (!e.webWorkerSupport) {
                    t = t.filter((e)=>e.type !== "idb");
                }
                const r = t.find((e)=>e.canBeUsed());
                if (r) {
                    return r;
                }
                throw new Error(`No usable method found in ${JSON.stringify(D.map((e)=>e.type))}`);
            }(this.options);
            this._iL = false;
            this._onML = null;
            this._addEL = {
                message: [],
                internal: []
            };
            this._uMP = new Set;
            this._befC = [];
            this._prepP = null;
            (function _prepareChannel(e) {
                const t = e.method.create(e.name, e.options);
                if (!function isPromise(e) {
                    return e && typeof e.then === "function";
                }(t)) {
                    e._state = t;
                } else {
                    e._prepP = t;
                    t.then((t)=>{
                        e._state = t;
                    });
                }
            })(this);
        };
        F._pubkey = true;
        F.prototype = {
            postMessage: function postMessage(e) {
                if (this.closed) {
                    throw new Error(`BroadcastChannel.postMessage(): Cannot post message after channel has closed ${JSON.stringify(e)}`);
                }
                return _post(this, "message", e);
            },
            postInternal: function postInternal(e) {
                return _post(this, "internal", e);
            },
            set onmessage (fn_1){
                const t = {
                    time: this.method.microSeconds(),
                    fn: fn_1
                };
                _removeListenerObject(this, "message", this._onML);
                if (fn_1 && typeof fn_1 === "function") {
                    this._onML = t;
                    _addListenerObject(this, "message", t);
                } else {
                    this._onML = null;
                }
            },
            addEventListener: function addEventListener(e, fn_1) {
                _addListenerObject(this, e, {
                    time: this.method.microSeconds(),
                    fn: fn_1
                });
            },
            removeEventListener: function removeEventListener(e, t) {
                _removeListenerObject(this, e, this._addEL[e].find((e)=>e.fn === t));
            },
            close: function close() {
                const e = this;
                if (!this.closed) {
                    $.delete(this);
                    this.closed = true;
                    const t = this._prepP ? this._prepP : writeBlockPromise;
                    this._onML = null;
                    this._addEL.message = [];
                    return t.then(()=>Promise.all(Array.from(e._uMP))).then(()=>Promise.all(e._befC.map((e)=>e()))).then(()=>e.method.close(e._state));
                }
            },
            get type () {
                return this.method.type;
            },
            get isClosed () {
                return this.closed;
            }
        };
    });
    function getDefaultExportFromCjs(e) {
        if (e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default")) {
            return e.default;
        }
        return e;
    }
    function defaultSetTimout() {
        throw new Error("setTimeout has not been defined");
    }
    function defaultClearTimeout() {
        throw new Error("clearTimeout has not been defined");
    }
    function runTimeout(e) {
        if (V === setTimeout) {
            return setTimeout(e, 0);
        }
        if ((V === defaultSetTimout || !V) && setTimeout) {
            V = setTimeout;
            return setTimeout(e, 0);
        }
        try {
            return V(e, 0);
        } catch (t) {
            try {
                return V.call(null, e, 0);
            } catch (t) {
                return V.call(this, e, 0);
            }
        }
    }
    function cleanUpNextTick() {
        if (q && z) {
            q = false;
            if (z.length) {
                K = z.concat(K);
            } else {
                J = -1;
            }
            if (K.length) {
                drainQueue();
            }
        }
    }
    function drainQueue() {
        if (!q) {
            const e = runTimeout(cleanUpNextTick);
            q = true;
            for(let t = K.length; t;){
                z = K;
                for(K = []; ++J < t;){
                    if (z) {
                        z[J].run();
                    }
                }
                J = -1;
                t = K.length;
            }
            z = null;
            q = false;
            (function runClearTimeout(e) {
                if (Y === clearTimeout) {
                    return clearTimeout(e);
                }
                if ((Y === defaultClearTimeout || !Y) && clearTimeout) {
                    Y = clearTimeout;
                    return clearTimeout(e);
                }
                try {
                    return Y(e);
                } catch (t) {
                    try {
                        return Y.call(null, e);
                    } catch (t) {
                        return Y.call(this, e);
                    }
                }
            })(e);
        }
    }
    function Item(e, t) {
        this.fun = e;
        this.array = t;
    }
    function noop() {}
    let ee;
    let te;
    let ne;
    let re;
    const oe = __esmMin(()=>{
        G = (W = {
            exports: {}
        }).exports = {};
        (()=>{
            try {
                V = typeof setTimeout === "function" ? setTimeout : defaultSetTimout;
            } catch (e) {
                V = defaultSetTimout;
            }
            try {
                Y = typeof clearTimeout === "function" ? clearTimeout : defaultClearTimeout;
            } catch (e) {
                Y = defaultClearTimeout;
            }
        })();
        K = [];
        q = false;
        J = -1;
        G.nextTick = function(e) {
            const t = new Array(arguments.length - 1);
            if (arguments.length > 1) {
                for(let n = 1; n < arguments.length; n++){
                    t[n - 1] = arguments[n];
                }
            }
            K.push(new Item(e, t));
            if (!(K.length !== 1 || q)) {
                runTimeout(drainQueue);
            }
        };
        Item.prototype.run = function() {
            this.fun.apply(null, this.array);
        };
        G.title = "browser";
        G.browser = true;
        G.env = {};
        G.argv = [];
        G.version = "";
        G.versions = {};
        G.on = noop;
        G.addListener = noop;
        G.once = noop;
        G.off = noop;
        G.removeListener = noop;
        G.removeAllListeners = noop;
        G.emit = noop;
        G.prependListener = noop;
        G.prependOnceListener = noop;
        G.listeners = function(e) {
            return [];
        };
        G.binding = function(e) {
            throw new Error("process.binding is not supported");
        };
        G.cwd = function() {
            return "/";
        };
        G.chdir = function(e) {
            throw new Error("process.chdir is not supported");
        };
        G.umask = function() {
            return 0;
        };
        Q = W.exports;
        X = getDefaultExportFromCjs(Q);
    });
    const ie = __esmMin(()=>{
        Z();
        w();
        oe();
    });
    const se = __esmMin(()=>{
        ee = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : undefined;
    });
    function anumber(e) {
        if (!Number.isSafeInteger(e) || e < 0) {
            throw new Error(`positive integer expected, got ${e}`);
        }
    }
    function abytes(e, ...t) {
        if (!function isBytes(e) {
            return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array";
        }(e)) {
            throw new Error("Uint8Array expected");
        }
        if (t.length > 0 && !t.includes(e.length)) {
            throw new Error(`Uint8Array expected of length ${t}, got length=${e.length}`);
        }
    }
    function aexists(e, t = true) {
        if (e.destroyed) {
            throw new Error("Hash instance has been destroyed");
        }
        if (t && e.finished) {
            throw new Error("Hash#digest() has already been called");
        }
    }
    function clean(...e) {
        for(let t = 0; t < e.length; t++){
            e[t].fill(0);
        }
    }
    function createView(e) {
        return new DataView(e.buffer, e.byteOffset, e.byteLength);
    }
    function rotr(e, t) {
        return e << 32 - t | e >>> t;
    }
    function bytesToHex(e) {
        abytes(e);
        if (te) {
            return e.toHex();
        }
        let t = "";
        for(let n = 0; n < e.length; n++){
            t += ne[e[n]];
        }
        return t;
    }
    function utf8ToBytes(e) {
        if (typeof e !== "string") {
            throw new Error("string expected");
        }
        return new Uint8Array((new TextEncoder).encode(e));
    }
    function toBytes(e) {
        if (typeof e === "string") {
            e = utf8ToBytes(e);
        }
        abytes(e);
        return e;
    }
    function createHasher(e) {
        const hashC = (t)=>e().update(toBytes(t)).digest();
        const t = e();
        hashC.outputLen = t.outputLen;
        hashC.blockLen = t.blockLen;
        hashC.create = ()=>e();
        return hashC;
    }
    let ae;
    let ce;
    let le;
    let ue;
    const de = __esmMin(()=>{
        se();
        te = typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function";
        ne = Array.from({
            length: 256
        }, (e, t)=>t.toString(16).padStart(2, "0"));
        re = class {
        };
    });
    const he = __esmMin(()=>{
        de();
        ae = class extends re {
            constructor(e, t){
                super();
                this.finished = false;
                this.destroyed = false;
                (function ahash(e) {
                    if (typeof e !== "function" || typeof e.create !== "function") {
                        throw new Error("Hash should be wrapped by utils.createHasher");
                    }
                    anumber(e.outputLen);
                    anumber(e.blockLen);
                })(e);
                const n = toBytes(t);
                this.iHash = e.create();
                if (typeof this.iHash.update !== "function") {
                    throw new Error("Expected instance of class which extends utils.Hash");
                }
                this.blockLen = this.iHash.blockLen;
                this.outputLen = this.iHash.outputLen;
                const r = this.blockLen;
                const o = new Uint8Array(r);
                o.set(n.length > r ? e.create().update(n).digest() : n);
                for(let i = 0; i < o.length; i++){
                    o[i] ^= 54;
                }
                this.iHash.update(o);
                this.oHash = e.create();
                for(let i = 0; i < o.length; i++){
                    o[i] ^= 106;
                }
                this.oHash.update(o);
                clean(o);
            }
            update(e) {
                aexists(this);
                this.iHash.update(e);
                return this;
            }
            digestInto(e) {
                aexists(this);
                abytes(e, this.outputLen);
                this.finished = true;
                this.iHash.digestInto(e);
                this.oHash.update(e);
                this.oHash.digestInto(e);
                this.destroy();
            }
            digest() {
                const e = new Uint8Array(this.oHash.outputLen);
                this.digestInto(e);
                return e;
            }
            _cloneInto(e) {
                if (!e) {
                    e = Object.create(Object.getPrototypeOf(this), {});
                }
                const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
                e.finished = finished;
                e.destroyed = destroyed;
                e.blockLen = blockLen;
                e.outputLen = outputLen;
                e.oHash = oHash._cloneInto(e.oHash);
                e.iHash = iHash._cloneInto(e.iHash);
                return e;
            }
            clone() {
                return this._cloneInto();
            }
            destroy() {
                this.destroyed = true;
                this.oHash.destroy();
                this.iHash.destroy();
            }
        };
        ce = (e, t, n)=>new ae(e, t).update(n).digest();
        ce.create = (e, t)=>new ae(e, t);
    });
    function Chi(e, t, n) {
        return e & t ^ ~e & n;
    }
    function Maj(e, t, n) {
        return e & t ^ e & n ^ t & n;
    }
    let fe;
    let pe;
    let me;
    let ge;
    let ve;
    let ye;
    let be;
    let Ee;
    let we;
    let Le;
    let _e;
    let Te;
    let Ce;
    let Ie;
    let Se;
    let Ae;
    let Re;
    let Me;
    let Pe;
    let ke;
    let Ne;
    let Oe;
    let Be;
    let xe;
    let De;
    let Ue;
    let $e;
    let He;
    let Fe;
    let je;
    let We;
    let ERROR;
    let Ve;
    let WARN;
    let INFO;
    let TRACE;
    let DEBUG;
    let Je;
    let Qe;
    let Xe;
    let Ze;
    let et;
    let tt;
    let nt;
    let rt;
    let ot;
    let it;
    let st;
    let at;
    let ct;
    let lt;
    let ut;
    let dt;
    let ht;
    let ft;
    let pt;
    let mt;
    let gt;
    let vt;
    let yt;
    let bt;
    let Et;
    let wt;
    let Lt;
    let _t;
    let Tt;
    let Ct;
    let It;
    let St;
    const At = __esmMin(()=>{
        de();
        le = class extends re {
            constructor(e, t, n, r){
                super();
                this.finished = false;
                this.length = 0;
                this.pos = 0;
                this.destroyed = false;
                this.blockLen = e;
                this.outputLen = t;
                this.padOffset = n;
                this.isLE = r;
                this.buffer = new Uint8Array(e);
                this.view = createView(this.buffer);
            }
            update(e) {
                aexists(this);
                abytes(e = toBytes(e));
                const { view, buffer, blockLen } = this;
                const e_length = e.length;
                for(let i = 0; i < e_length;){
                    const s = Math.min(blockLen - this.pos, e_length - i);
                    if (s === blockLen) {
                        const t = createView(e);
                        for(; blockLen <= e_length - i; i += blockLen){
                            this.process(t, i);
                        }
                        continue;
                    }
                    buffer.set(e.subarray(i, i + s), this.pos);
                    this.pos += s;
                    i += s;
                    if (this.pos === blockLen) {
                        this.process(view, 0);
                        this.pos = 0;
                    }
                }
                this.length += e.length;
                this.roundClean();
                return this;
            }
            digestInto(e) {
                aexists(this);
                (function aoutput(e, t) {
                    abytes(e);
                    const t_outputLen = t.outputLen;
                    if (e.length < t_outputLen) {
                        throw new Error(`digestInto() expects output buffer of length at least ${t_outputLen}`);
                    }
                })(e, this);
                this.finished = true;
                const { buffer, view, blockLen, isLE } = this;
                let { pos } = this;
                buffer[pos++] = 128;
                clean(this.buffer.subarray(pos));
                if (this.padOffset > blockLen - pos) {
                    this.process(view, 0);
                    pos = 0;
                }
                for(let u = pos; u < blockLen; u++){
                    buffer[u] = 0;
                }
                (function setBigUint64(view_1, t, n, isLE_1) {
                    if (typeof view_1.setBigUint64 === "function") {
                        return view_1.setBigUint64(t, n, isLE_1);
                    }
                    const o = BigInt(32);
                    const i = BigInt(4294967295);
                    const s = Number(n >> o & i);
                    const a = Number(n & i);
                    const c = isLE_1 ? 4 : 0;
                    const l = isLE_1 ? 0 : 4;
                    view_1.setUint32(t + c, s, isLE_1);
                    view_1.setUint32(t + l, a, isLE_1);
                })(view, blockLen - 8, BigInt(8 * this.length), isLE);
                this.process(view, 0);
                const s = createView(e);
                const outputLen = this.outputLen;
                if (outputLen % 4) {
                    throw new Error("_sha2: outputLen should be aligned to 32bit");
                }
                const c = outputLen / 4;
                const l = this.get();
                if (c > l.length) {
                    throw new Error("_sha2: outputLen bigger than state");
                }
                for(let u = 0; u < c; u++){
                    s.setUint32(4 * u, l[u], isLE);
                }
            }
            digest() {
                const { buffer, outputLen } = this;
                this.digestInto(buffer);
                const n = buffer.slice(0, outputLen);
                this.destroy();
                return n;
            }
            _cloneInto(e) {
                if (!e) {
                    e = new this.constructor;
                }
                e.set(...this.get());
                const { blockLen, buffer, length, finished, destroyed, pos } = this;
                e.destroyed = destroyed;
                e.finished = finished;
                e.length = length;
                e.pos = pos;
                if (length % blockLen) {
                    e.buffer.set(buffer);
                }
                return e;
            }
            clone() {
                return this._cloneInto();
            }
        };
        ue = Uint32Array.from([
            1779033703,
            3144134277,
            1013904242,
            2773480762,
            1359893119,
            2600822924,
            528734635,
            1541459225
        ]);
    });
    const Rt = __esmMin(()=>{
        At();
        de();
        fe = Uint32Array.from([
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
        pe = new Uint32Array(64);
        me = class extends le {
            constructor(e = 32){
                super(64, e, 8, false);
                this.A = 0 | ue[0];
                this.B = 0 | ue[1];
                this.C = 0 | ue[2];
                this.D = 0 | ue[3];
                this.E = 0 | ue[4];
                this.F = 0 | ue[5];
                this.G = 0 | ue[6];
                this.H = 0 | ue[7];
            }
            get() {
                const { A, B, C, D, E, F, G, H } = this;
                return [
                    A,
                    B,
                    C,
                    D,
                    E,
                    F,
                    G,
                    H
                ];
            }
            set(e, t, n, r, o, i, s, a) {
                this.A = 0 | e;
                this.B = 0 | t;
                this.C = 0 | n;
                this.D = 0 | r;
                this.E = 0 | o;
                this.F = 0 | i;
                this.G = 0 | s;
                this.H = 0 | a;
            }
            process(e, t) {
                for(let u = 0; u < 16; u++, t += 4){
                    pe[u] = e.getUint32(t, false);
                }
                for(let u = 16; u < 64; u++){
                    const e = pe[u - 15];
                    const t = pe[u - 2];
                    const n = rotr(e, 7) ^ rotr(e, 18) ^ e >>> 3;
                    pe[u] = (rotr(t, 17) ^ rotr(t, 19) ^ t >>> 10) + pe[u - 7] + n + pe[u - 16] | 0;
                }
                let { A, B, C, D, E, F, G, H } = this;
                for(let u = 0; u < 64; u++){
                    const e = H + (rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25)) + Chi(E, F, G) + fe[u] + pe[u] | 0;
                    const t = (rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22)) + Maj(A, B, C) | 0;
                    H = G;
                    G = F;
                    F = E;
                    E = D + e | 0;
                    D = C;
                    C = B;
                    B = A;
                    A = e + t | 0;
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
                clean(pe);
            }
            destroy() {
                this.set(0, 0, 0, 0, 0, 0, 0, 0);
                clean(this.buffer);
            }
        };
        ge = createHasher(()=>new me);
    });
    const Mt = __esmMin(()=>{
        Rt();
        ve = ge;
    });
    const Pt = __commonJSMin((e, t)=>{
        ((e, n)=>{
            "use strict";
            if (typeof define === "function" && define.amd) {
                define(n);
            } else if (typeof t === "object" && t.exports) {
                t.exports = n();
            } else {
                e.log = n();
            }
        })(e, function() {
            "use strict";
            const noop = function() {};
            const e = "undefined";
            const t = typeof window !== e && typeof window.navigator !== e && /Trident\/|MSIE /.test(window.navigator.userAgent);
            const n = [
                "trace",
                "debug",
                "info",
                "warn",
                "error"
            ];
            const r = {};
            let o = null;
            function bindMethod(console, t) {
                const n = console[t];
                if (typeof n.bind === "function") {
                    return n.bind(console);
                }
                try {
                    return Function.prototype.bind.call(n, console);
                } catch (r) {
                    return function() {
                        return Function.prototype.apply.apply(n, [
                            console,
                            arguments
                        ]);
                    };
                }
            }
            function traceForIE() {
                if (console.log) {
                    if (console.log.apply) {
                        console.log(...arguments);
                    } else {
                        Function.prototype.apply.apply(console.log, [
                            console,
                            arguments
                        ]);
                    }
                }
                if (console.trace) {
                    console.trace();
                }
            }
            function replaceLoggingMethods() {
                const t = this.getLevel();
                for(let r = 0; r < n.length; r++){
                    const o = n[r];
                    this[o] = r < t ? noop : this.methodFactory(o, t, this.name);
                }
                this.log = this.debug;
                if (typeof console === e && t < this.levels.SILENT) {
                    return "No console available for logging";
                }
            }
            function enableLoggingWhenConsoleArrives(t) {
                return function() {
                    if (typeof console !== e) {
                        replaceLoggingMethods.call(this);
                        this[t](...arguments);
                    }
                };
            }
            function defaultMethodFactory(n, r, o) {
                return function realMethod(n) {
                    if (n === "debug") {
                        n = "log";
                    }
                    return typeof console !== e && (n === "trace" && t ? traceForIE : console[n] !== undefined ? bindMethod(console, n) : console.log !== undefined ? bindMethod(console, "log") : noop);
                }(n) || enableLoggingWhenConsoleArrives.apply(this, arguments);
            }
            function Logger(t, i) {
                let s;
                let a;
                let c;
                const l = this;
                let u = "loglevel";
                function getPersistedLevel() {
                    let t;
                    if (typeof window !== e && u) {
                        try {
                            t = window.localStorage[u];
                        } catch (i) {}
                        if (typeof t === e) {
                            try {
                                const n = window.document.cookie;
                                const r = encodeURIComponent(u);
                                const o = n.indexOf(`${r}=`);
                                if (o !== -1) {
                                    t = /^([^;]+)/.exec(n.slice(o + r.length + 1))[1];
                                }
                            } catch (i) {}
                        }
                        if (l.levels[t] === undefined) {
                            t = undefined;
                        }
                        return t;
                    }
                }
                function normalizeLevel(e) {
                    let t = e;
                    if (typeof t === "string" && l.levels[t.toUpperCase()] !== undefined) {
                        t = l.levels[t.toUpperCase()];
                    }
                    if (typeof t === "number" && t >= 0 && t <= l.levels.SILENT) {
                        return t;
                    }
                    throw new TypeError(`log.setLevel() called with invalid level: ${e}`);
                }
                if (typeof t === "string") {
                    u += `:${t}`;
                } else if (typeof t === "symbol") {
                    u = undefined;
                }
                l.name = t;
                l.levels = {
                    TRACE: 0,
                    DEBUG: 1,
                    INFO: 2,
                    WARN: 3,
                    ERROR: 4,
                    SILENT: 5
                };
                l.methodFactory = i || defaultMethodFactory;
                l.getLevel = function() {
                    return c ?? a ?? s;
                };
                l.setLevel = function(t, r) {
                    c = normalizeLevel(t);
                    if (r !== false) {
                        (function persistLevelIfPossible(t) {
                            const r = (n[t] || "silent").toUpperCase();
                            if (typeof window !== e && u) {
                                try {
                                    return void (window.localStorage[u] = r);
                                } catch (o) {}
                                try {
                                    window.document.cookie = `${encodeURIComponent(u)}=${r};`;
                                } catch (o) {}
                            }
                        })(c);
                    }
                    return replaceLoggingMethods.call(l);
                };
                l.setDefaultLevel = function(e) {
                    a = normalizeLevel(e);
                    if (!getPersistedLevel()) {
                        l.setLevel(e, false);
                    }
                };
                l.resetLevel = function() {
                    c = null;
                    (function clearPersistedLevel() {
                        if (typeof window !== e && u) {
                            try {
                                window.localStorage.removeItem(u);
                            } catch (t) {}
                            try {
                                window.document.cookie = `${encodeURIComponent(u)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
                            } catch (t) {}
                        }
                    })();
                    replaceLoggingMethods.call(l);
                };
                l.enableAll = function(e) {
                    l.setLevel(l.levels.TRACE, e);
                };
                l.disableAll = function(e) {
                    l.setLevel(l.levels.SILENT, e);
                };
                l.rebuild = function() {
                    if (o !== l) {
                        s = normalizeLevel(o.getLevel());
                    }
                    replaceLoggingMethods.call(l);
                    if (o === l) {
                        for(const e in r){
                            r[e].rebuild();
                        }
                    }
                };
                s = normalizeLevel(o ? o.getLevel() : "WARN");
                const d = getPersistedLevel();
                if (d != null) {
                    c = normalizeLevel(d);
                }
                replaceLoggingMethods.call(l);
            }
            o = new Logger;
            o.getLogger = function getLogger(e) {
                if (typeof e !== "symbol" && typeof e !== "string" || e === "") {
                    throw new TypeError("You must supply a name when creating a logger.");
                }
                let t = r[e];
                if (!t) {
                    t = r[e] = new Logger(e, o.methodFactory);
                }
                return t;
            };
            const i = typeof window !== e ? window.log : undefined;
            o.noConflict = function() {
                if (typeof window !== e && window.log === o) {
                    window.log = i;
                }
                return o;
            };
            o.getLoggers = function getLoggers() {
                return r;
            };
            o.default = o;
            return o;
        });
    });
    const kt = __commonJSMin((e, t)=>{
        var n;
        var r;
        n = e;
        r = function(e) {
            "use strict";
            let t;
            let n;
            const r = {
                template: "[%t] %l:",
                levelFormatter: function(e) {
                    return e.toUpperCase();
                },
                nameFormatter: function(e) {
                    return e || "root";
                },
                timestampFormatter: function(e) {
                    return e.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
                },
                format: undefined
            };
            const o = {};
            const i = {
                reg: function(e) {
                    if (!e || !e.getLogger) {
                        throw new TypeError("Argument is not a root logger");
                    }
                    t = e;
                },
                apply: function(e, n) {
                    if (!e || !e.setLevel) {
                        throw new TypeError("Argument is not a logger");
                    }
                    const e_methodFactory = e.methodFactory;
                    const s = e.name || "";
                    const a = o[s] || o[""] || r;
                    if (!o[s]) {
                        e.methodFactory = function methodFactory(e, t, n) {
                            const r = e_methodFactory(e, t, n);
                            const a = o[n] || o[""];
                            const c = a.template.indexOf("%t") !== -1;
                            const l = a.template.indexOf("%l") !== -1;
                            const u = a.template.indexOf("%n") !== -1;
                            return function(...d) {
                                let t = "";
                                if (s || !o[n]) {
                                    const f = a.timestampFormatter(new Date);
                                    const p = a.levelFormatter(e);
                                    const m = a.nameFormatter(n);
                                    if (a.format) {
                                        t += a.format(p, m, f);
                                    } else {
                                        t += a.template;
                                        if (c) {
                                            t = t.replace(/%t/, f);
                                        }
                                        if (l) {
                                            t = t.replace(/%l/, p);
                                        }
                                        if (u) {
                                            t = t.replace(/%n/, m);
                                        }
                                    }
                                    if (d.length && typeof d[0] === "string") {
                                        d[0] = `${t} ${d[0]}`;
                                    } else {
                                        d.unshift(t);
                                    }
                                }
                                r(...d);
                            };
                        };
                    }
                    if ((n = n || {}).template) {
                        n.format = undefined;
                    }
                    o[s] = function(e) {
                        let t;
                        for(let n = 1, r = arguments.length; n < r; n++){
                            for(t in arguments[n]){
                                if (Object.prototype.hasOwnProperty.call(arguments[n], t)) {
                                    e[t] = arguments[n][t];
                                }
                            }
                        }
                        return e;
                    }({}, a, n);
                    e.setLevel(e.getLevel());
                    if (!t) {
                        e.warn("It is necessary to call the function reg() of loglevel-plugin-prefix before calling apply. From the next release, it will throw an error. See more: https://github.com/kutuluk/loglevel-plugin-prefix/blob/master/README.md");
                    }
                    return e;
                }
            };
            if (e) {
                n = e.prefix;
                i.noConflict = function() {
                    if (e.prefix === i) {
                        e.prefix = n;
                    }
                    return i;
                };
            }
            return i;
        };
        if (typeof define === "function" && define.amd) {
            define(r);
        } else if (typeof t === "object" && t.exports) {
            t.exports = r();
        } else {
            n.prefix = r(n);
        }
    });
    const Nt = __commonJSMin((e)=>{
        e.isatty = function() {
            return false;
        };
        e.ReadStream = function ReadStream() {
            throw new Error("tty.ReadStream is not implemented");
        };
        e.WriteStream = function WriteStream() {
            throw new Error("tty.WriteStream is not implemented");
        };
    });
    const Ot = __esmMin(()=>{
        oe();
        ye = __toESM(Nt(), 1);
        ({ env: be = {}, argv: Ee = [], platform: we = "" } = X === undefined ? {} : X);
        Le = "NO_COLOR" in be || Ee.includes("--no-color");
        _e = "FORCE_COLOR" in be || Ee.includes("--color");
        Te = we === "win32";
        Ce = be.TERM === "dumb";
        Ie = ye && ye.isatty && ye.isatty(1) && be.TERM && !Ce;
        Se = "CI" in be && ("GITHUB_ACTIONS" in be || "GITLAB_CI" in be || "CIRCLECI" in be);
        Ae = !Le && (_e || Te && !Ce || Ie || Se);
        Re = (e, t, n, r, o = t.substring(0, e) + r, i = t.substring(e + n.length), s = i.indexOf(n))=>o + (s < 0 ? i : Re(s, i, n, r));
        Me = (e, t, n, r, o)=>{
            if (e < 0) {
                return n + t + r;
            }
            return n + Re(e, t, r, o) + r;
        };
        Pe = (e, t, n = e, r = e.length + 1)=>(o)=>{
                if (o || o !== "" && o !== undefined) {
                    return Me(`${o}`.indexOf(t, r), o, e, t, n);
                }
                return "";
            };
        ke = (e, t, n)=>Pe(`[${e}m`, `[${t}m`, n);
        Ne = {
            reset: ke(0, 0),
            bold: ke(1, 22, "[22m[1m"),
            dim: ke(2, 22, "[22m[2m"),
            italic: ke(3, 23),
            underline: ke(4, 24),
            inverse: ke(7, 27),
            hidden: ke(8, 28),
            strikethrough: ke(9, 29),
            black: ke(30, 39),
            red: ke(31, 39),
            green: ke(32, 39),
            yellow: ke(33, 39),
            blue: ke(34, 39),
            magenta: ke(35, 39),
            cyan: ke(36, 39),
            white: ke(37, 39),
            gray: ke(90, 39),
            bgBlack: ke(40, 49),
            bgRed: ke(41, 49),
            bgGreen: ke(42, 49),
            bgYellow: ke(43, 49),
            bgBlue: ke(44, 49),
            bgMagenta: ke(45, 49),
            bgCyan: ke(46, 49),
            bgWhite: ke(47, 49),
            blackBright: ke(90, 39),
            redBright: ke(91, 39),
            greenBright: ke(92, 39),
            yellowBright: ke(93, 39),
            blueBright: ke(94, 39),
            magentaBright: ke(95, 39),
            cyanBright: ke(96, 39),
            whiteBright: ke(97, 39),
            bgBlackBright: ke(100, 49),
            bgRedBright: ke(101, 49),
            bgGreenBright: ke(102, 49),
            bgYellowBright: ke(103, 49),
            bgBlueBright: ke(104, 49),
            bgMagentaBright: ke(105, 49),
            bgCyanBright: ke(106, 49),
            bgWhiteBright: ke(107, 49)
        };
        Oe = ({ useColor = Ae } = {})=>{
            if (useColor) {
                return Ne;
            }
            return Object.keys(Ne).reduce((acc, key)=>({
                    ...acc,
                    [key]: String
                }), {});
        };
        ({ reset: Be, bold: xe, dim: De, italic: Ue, underline: $e, inverse: He, hidden: Fe, strikethrough: je, black: We, red: ERROR, green: Ve, yellow: WARN, blue: INFO, magenta: TRACE, cyan: DEBUG, white: Je, gray: Qe, bgBlack: Xe, bgRed: Ze, bgGreen: et, bgYellow: tt, bgBlue: nt, bgMagenta: rt, bgCyan: ot, bgWhite: it, blackBright: st, redBright: at, greenBright: ct, yellowBright: lt, blueBright: ut, magentaBright: dt, cyanBright: ht, whiteBright: ft, bgBlackBright: pt, bgRedBright: mt, bgGreenBright: gt, bgYellowBright: vt, bgBlueBright: yt, bgMagentaBright: bt, bgCyanBright: Et, bgWhiteBright: wt } = Oe());
    });
    const Bt = __esmMin(()=>{});
    let xt;
    let Dt;
    let Ut;
    const $t = __esmMin(()=>{
        Lt = __toESM(Pt(), 1);
        _t = __toESM(kt(), 1);
        Ot();
        Bt();
        Lt.default.setLevel("ERROR");
        Tt = {
            TRACE,
            DEBUG,
            INFO,
            WARN,
            ERROR
        };
        _t.default.reg(Lt.default);
        _t.default.apply(Lt.default, {
            format: (e, t, n)=>`${Qe(`[${n}]`)} ${Tt[e](e)}${t === "root" ? "" : Ve(` [${t}:]`)}`
        });
        Ct = Lt.default.error.bind(Lt.default);
        Lt.default.error = (...e)=>{
            if (It) {
                It(...e);
            }
            return Ct(...e);
        };
        St = Lt.default;
    });
    function lengthPrefixed(e) {
        return `${e.length}:${e}`;
    }
    function computeMac(e, channelName, n, r) {
        return bytesToHex(ce(ve, e, utf8ToBytes(lengthPrefixed(Dt) + lengthPrefixed(channelName) + lengthPrefixed(n) + lengthPrefixed(r))));
    }
    function bigintReplacer(e, t) {
        if (typeof t === "bigint") {
            return t.toString();
        }
        return t;
    }
    function safeInvoke(e, t) {
        try {
            const n = e(t);
            if (typeof n?.then === "function") {
                Promise.resolve(n).catch(St.error);
            }
        } catch (error) {
            St.error(error);
        }
    }
    let Ht;
    let Ft;
    let jt;
    let Wt;
    let Gt;
    let Vt;
    let Yt;
    let Kt;
    let qt;
    let zt;
    let Jt;
    let Qt;
    const Xt = __esmMin(()=>{
        ie();
        he();
        Mt();
        de();
        b();
        $t();
        xt = new WeakMap;
        Dt = "trust-wallet/broadcast-channel/v1";
        Ut = class extends f {
            constructor(e, t){
                super();
                this.taps = [];
                this.seenNonces = new Set;
                this.onWireMessage = (e)=>{
                    const t = e;
                    if (typeof t !== "object" || t === null || typeof t.method !== "string" || typeof t.payload !== "string" || typeof t.__nonce !== "string" || typeof t.__mac !== "string") {
                        return;
                    }
                    const { method, payload, __nonce, __mac } = t;
                    if (payload.length > 1000000) {
                        return;
                    }
                    if (this.taps.length === 0 && !this.listeners[method]) {
                        return;
                    }
                    if (!this.isAuthentic(__nonce, __mac, payload)) {
                        return;
                    }
                    if (this.isReplay(__nonce)) {
                        return;
                    }
                    const s = this.parse(payload, method);
                    if (!s) {
                        return;
                    }
                    const a = this.listeners[method];
                    if (a) {
                        a.forEach((e)=>safeInvoke(e, s));
                    }
                    this.taps.slice().forEach((e)=>safeInvoke(e, s));
                };
                if (typeof t !== "string" || t.length === 0) {
                    throw new Error("BroadcastMessage requires a non-empty channel secret");
                }
                this.channelName = e;
                xt.set(this, utf8ToBytes(t));
                this.port = new F(e);
                this.port.addEventListener("message", this.onWireMessage);
            }
            isAuthentic(e, t, n) {
                const r = xt.get(this);
                return !!r && function timingSafeEqual(e, t) {
                    if (e.length !== t.length) {
                        return false;
                    }
                    let n = 0;
                    for(let r = 0; r < e.length; r += 1){
                        n |= e.charCodeAt(r) ^ t.charCodeAt(r);
                    }
                    return n === 0;
                }(computeMac(r, this.channelName, e, n), t);
            }
            isReplay(e) {
                if (this.seenNonces.has(e)) {
                    return true;
                }
                this.seenNonces.add(e);
                if (this.seenNonces.size > 512) {
                    const e = this.seenNonces.values().next().value;
                    if (e !== undefined) {
                        this.seenNonces.delete(e);
                    }
                }
                return false;
            }
            parse(e, t) {
                let n;
                try {
                    n = JSON.parse(e);
                } catch  {
                    return;
                }
                if (typeof n !== "object" || n === null) {
                    return;
                }
                const r = n;
                if (typeof r.method === "string" && r.method === t) {
                    return r;
                }
            }
            listen(e) {
                this.taps.push(e);
                return ()=>{
                    this.taps = this.taps.filter((t)=>t !== e);
                };
            }
            async send(e) {
                const t = xt.get(this);
                if (!t) {
                    throw new Error("Broadcast channel secret is unavailable");
                }
                if (typeof e?.method !== "string" || e.method.length === 0) {
                    throw new Error("Broadcast message requires a method name");
                }
                const payload = function serializePayload(e) {
                    try {
                        const t = JSON.stringify(e, bigintReplacer);
                        if (typeof t !== "string") {
                            throw new Error("payload is not serializable");
                        }
                        return t;
                    } catch (error) {
                        St.error(error);
                        throw new Error("Broadcast message payload is not serializable (circular reference?)");
                    }
                }(e);
                if (payload.length > 1000000) {
                    throw new Error("Broadcast message exceeds the 1000000 character limit");
                }
                const __nonce = bytesToHex(function randomBytes(e = 32) {
                    if (ee && typeof ee.getRandomValues === "function") {
                        return ee.getRandomValues(new Uint8Array(e));
                    }
                    if (ee && typeof ee.randomBytes === "function") {
                        return Uint8Array.from(ee.randomBytes(e));
                    }
                    throw new Error("crypto.getRandomValues must be defined");
                }(16));
                const __mac = computeMac(t, this.channelName, __nonce, payload);
                await this.port.postMessage({
                    method: e.method,
                    payload,
                    __nonce,
                    __mac
                });
            }
            async disconnect() {
                this.port.removeEventListener("message", this.onWireMessage);
                this.taps = [];
                this.seenNonces.clear();
                await this.port.close();
            }
        };
    });
    const Zt = __commonJSMin((e, t)=>{
        var n;
        var r = typeof Reflect === "object" ? Reflect : null;
        var o = r && typeof r.apply === "function" ? r.apply : function ReflectApply(e, t, n) {
            return Function.prototype.apply.call(e, t, n);
        };
        n = r && typeof r.ownKeys === "function" ? r.ownKeys : Object.getOwnPropertySymbols ? function ReflectOwnKeys(e) {
            return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
        } : function ReflectOwnKeys(e) {
            return Object.getOwnPropertyNames(e);
        };
        var i = Number.isNaN || function NumberIsNaN(e) {
            return e != e;
        };
        function EventEmitter() {
            EventEmitter.init.call(this);
        }
        t.exports = EventEmitter;
        t.exports.once = function once(e, t) {
            return new Promise((resolve, reject)=>{
                function errorListener(n) {
                    e.removeListener(t, resolver);
                    reject(n);
                }
                function resolver() {
                    if (typeof e.removeListener === "function") {
                        e.removeListener("error", errorListener);
                    }
                    resolve(Array.prototype.slice.call(arguments));
                }
                eventTargetAgnosticAddListener(e, t, resolver, {
                    once: true
                });
                if (t !== "error") {
                    (function addErrorHandlerIfEventEmitter(e, errorListener_1, n) {
                        if (typeof e.on === "function") {
                            eventTargetAgnosticAddListener(e, "error", errorListener_1, n);
                        }
                    })(e, errorListener, {
                        once: true
                    });
                }
            });
        };
        EventEmitter.EventEmitter = EventEmitter;
        EventEmitter.prototype._events = undefined;
        EventEmitter.prototype._eventsCount = 0;
        EventEmitter.prototype._maxListeners = undefined;
        var s = 10;
        function checkListener(e) {
            if (typeof e !== "function") {
                throw new TypeError(`The "listener" argument must be of type Function. Received type ${typeof e}`);
            }
        }
        function _getMaxListeners(e) {
            if (e._maxListeners === undefined) {
                return EventEmitter.defaultMaxListeners;
            }
            return e._maxListeners;
        }
        function _addListener(e, t, n, r) {
            let o;
            let i;
            let s;
            checkListener(n);
            if ((i = e._events) === undefined) {
                i = e._events = Object.create(null);
                e._eventsCount = 0;
            } else {
                if (i.newListener !== undefined) {
                    e.emit("newListener", t, n.listener ? n.listener : n);
                    i = e._events;
                }
                s = i[t];
            }
            if (s === undefined) {
                s = i[t] = n;
                ++e._eventsCount;
            } else {
                if (typeof s === "function") {
                    s = i[t] = r ? [
                        n,
                        s
                    ] : [
                        s,
                        n
                    ];
                } else if (r) {
                    s.unshift(n);
                } else {
                    s.push(n);
                }
                if ((o = _getMaxListeners(e)) > 0 && s.length > o && !s.warned) {
                    s.warned = true;
                    const a = new Error(`Possible EventEmitter memory leak detected. ${s.length} ${String(t)} listeners added. Use emitter.setMaxListeners() to increase limit`);
                    a.name = "MaxListenersExceededWarning";
                    a.emitter = e;
                    a.type = t;
                    a.count = s.length;
                    (function ProcessEmitWarning(e) {
                        if (console && console.warn) {
                            console.warn(e);
                        }
                    })(a);
                }
            }
            return e;
        }
        function onceWrapper() {
            if (!this.fired) {
                this.target.removeListener(this.type, this.wrapFn);
                this.fired = true;
                if (arguments.length === 0) {
                    return this.listener.call(this.target);
                }
                return this.listener.apply(this.target, arguments);
            }
        }
        function _onceWrap(target, t, listener) {
            const r = {
                fired: false,
                wrapFn: undefined,
                target,
                type: t,
                listener
            };
            const o = onceWrapper.bind(r);
            o.listener = listener;
            r.wrapFn = o;
            return o;
        }
        function _listeners({ _events }, t, n) {
            if (_events === undefined) {
                return [];
            }
            const o = _events[t];
            if (o === undefined) {
                return [];
            }
            if (typeof o === "function") {
                if (n) {
                    return [
                        o.listener || o
                    ];
                }
                return [
                    o
                ];
            }
            if (n) {
                return function unwrapListeners(e) {
                    for(var t = new Array(e.length), n = 0; n < t.length; ++n){
                        t[n] = e[n].listener || e[n];
                    }
                    return t;
                }(o);
            }
            return arrayClone(o, o.length);
        }
        function listenerCount(e) {
            const _events = this._events;
            if (_events !== undefined) {
                const n = _events[e];
                if (typeof n === "function") {
                    return 1;
                }
                if (n !== undefined) {
                    return n.length;
                }
            }
            return 0;
        }
        function arrayClone(e, t) {
            const n = new Array(t);
            for(let r = 0; r < t; ++r){
                n[r] = e[r];
            }
            return n;
        }
        function eventTargetAgnosticAddListener(e, t, n, r) {
            if (typeof e.on === "function") {
                if (r.once) {
                    e.once(t, n);
                } else {
                    e.on(t, n);
                }
            } else {
                if (typeof e.addEventListener !== "function") {
                    throw new TypeError(`The "emitter" argument must be of type EventEmitter. Received type ${typeof e}`);
                }
                e.addEventListener(t, function wrapListener(o) {
                    if (r.once) {
                        e.removeEventListener(t, wrapListener);
                    }
                    n(o);
                });
            }
        }
        Object.defineProperty(EventEmitter, "defaultMaxListeners", {
            enumerable: true,
            get: function() {
                return s;
            },
            set: function(e) {
                if (typeof e !== "number" || e < 0 || i(e)) {
                    throw new RangeError(`The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ${e}.`);
                }
                s = e;
            }
        });
        EventEmitter.init = function() {
            if (!(this._events !== undefined && this._events !== Object.getPrototypeOf(this)._events)) {
                this._events = Object.create(null);
                this._eventsCount = 0;
            }
            this._maxListeners = this._maxListeners || undefined;
        };
        EventEmitter.prototype.setMaxListeners = function setMaxListeners(e) {
            if (typeof e !== "number" || e < 0 || i(e)) {
                throw new RangeError(`The value of "n" is out of range. It must be a non-negative number. Received ${e}.`);
            }
            this._maxListeners = e;
            return this;
        };
        EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
            return _getMaxListeners(this);
        };
        EventEmitter.prototype.emit = function emit(e) {
            const t = [];
            for(var n = 1; n < arguments.length; n++){
                t.push(arguments[n]);
            }
            let r = e === "error";
            const _events = this._events;
            if (_events !== undefined) {
                r = r && _events.error === undefined;
            } else if (!r) {
                return false;
            }
            if (r) {
                let s;
                if (t.length > 0) {
                    s = t[0];
                }
                if (s instanceof Error) {
                    throw s;
                }
                const a = new Error(`Unhandled error.${s ? ` (${s.message})` : ""}`);
                a.context = s;
                throw a;
            }
            const c = _events[e];
            if (c === undefined) {
                return false;
            }
            if (typeof c === "function") {
                o(c, this, t);
            } else {
                const l = c.length;
                const u = arrayClone(c, l);
                for(n = 0; n < l; ++n){
                    o(u[n], this, t);
                }
            }
            return true;
        };
        EventEmitter.prototype.addListener = function addListener(e, t) {
            return _addListener(this, e, t, false);
        };
        EventEmitter.prototype.on = EventEmitter.prototype.addListener;
        EventEmitter.prototype.prependListener = function prependListener(e, t) {
            return _addListener(this, e, t, true);
        };
        EventEmitter.prototype.once = function once(e, t) {
            checkListener(t);
            this.on(e, _onceWrap(this, e, t));
            return this;
        };
        EventEmitter.prototype.prependOnceListener = function prependOnceListener(e, t) {
            checkListener(t);
            this.prependListener(e, _onceWrap(this, e, t));
            return this;
        };
        EventEmitter.prototype.removeListener = function removeListener(e, t) {
            let n;
            let r;
            let o;
            let i;
            let s;
            checkListener(t);
            if ((r = this._events) === undefined) {
                return this;
            }
            if ((n = r[e]) === undefined) {
                return this;
            }
            if (n === t || n.listener === t) {
                if (--this._eventsCount === 0) {
                    this._events = Object.create(null);
                } else {
                    delete r[e];
                    if (r.removeListener) {
                        this.emit("removeListener", e, n.listener || t);
                    }
                }
            } else if (typeof n !== "function") {
                o = -1;
                for(i = n.length - 1; i >= 0; i--){
                    if (n[i] === t || n[i].listener === t) {
                        s = n[i].listener;
                        o = i;
                        break;
                    }
                }
                if (o < 0) {
                    return this;
                }
                if (o === 0) {
                    n.shift();
                } else {
                    (function spliceOne(e, t) {
                        for(; t + 1 < e.length; t++){
                            e[t] = e[t + 1];
                        }
                        e.pop();
                    })(n, o);
                }
                if (n.length === 1) {
                    r[e] = n[0];
                }
                if (r.removeListener !== undefined) {
                    this.emit("removeListener", e, s || t);
                }
            }
            return this;
        };
        EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
        EventEmitter.prototype.removeAllListeners = function removeAllListeners(e) {
            let t;
            let n;
            const _events = this._events;
            if (_events === undefined) {
                return this;
            }
            if (_events.removeListener === undefined) {
                if (arguments.length === 0) {
                    this._events = Object.create(null);
                    this._eventsCount = 0;
                } else {
                    if (_events[e] !== undefined) {
                        if (--this._eventsCount === 0) {
                            this._events = Object.create(null);
                        } else {
                            delete _events[e];
                        }
                    }
                }
                return this;
            }
            if (arguments.length === 0) {
                let o;
                const i = Object.keys(_events);
                for(n = 0; n < i.length; ++n){
                    if ((o = i[n]) !== "removeListener") {
                        this.removeAllListeners(o);
                    }
                }
                this.removeAllListeners("removeListener");
                this._events = Object.create(null);
                this._eventsCount = 0;
                return this;
            }
            if (typeof (t = _events[e]) === "function") {
                this.removeListener(e, t);
            } else if (t !== undefined) {
                for(n = t.length - 1; n >= 0; n--){
                    this.removeListener(e, t[n]);
                }
            }
            return this;
        };
        EventEmitter.prototype.listeners = function listeners(e) {
            return _listeners(this, e, true);
        };
        EventEmitter.prototype.rawListeners = function rawListeners(e) {
            return _listeners(this, e, false);
        };
        EventEmitter.listenerCount = function(e, t) {
            if (typeof e.listenerCount === "function") {
                return e.listenerCount(t);
            }
            return listenerCount.call(e, t);
        };
        EventEmitter.prototype.listenerCount = listenerCount;
        EventEmitter.prototype.eventNames = function eventNames() {
            if (this._eventsCount > 0) {
                return n(this._events);
            }
            return [];
        };
    });
    const en = __esmMin(()=>{
        __toESM(Zt(), 1);
    });
    const tn = __esmMin(()=>{
        Ht = typeof chrome === "object" && chrome?.runtime?.id ? globalThis.browser ?? chrome : {};
        Ft = Ht;
        Ft.action = Ht.action || Ht.browserAction;
    });
    const nn = __esmMin(()=>{
        tn();
    });
    const rn = __esmMin(()=>{
        tn();
        b();
        jt = class extends f {
            constructor(e){
                super();
                this.port = Ft.runtime?.connect({
                    name: e || "extension-message"
                });
                if (!this.port) {
                    location.reload();
                }
                this.port.onMessage.addListener((e)=>{
                    const t = e;
                    const t_method = t.method;
                    if (t_method && this.listeners[t_method]) {
                        this.listeners[t_method].forEach((e)=>e(t));
                    }
                });
            }
            send(e) {
                try {
                    this.port.postMessage(e);
                } catch (error) {
                    if (error?.message === "Attempting to use a disconnected port object") {
                        return;
                    }
                    throw error;
                }
            }
            listen(e) {
                const handler = (t)=>{
                    e(t);
                };
                const port = this.port;
                port.onMessage.addListener(handler);
                return ()=>port.onMessage.removeListener(handler);
            }
            disconnect() {
                this.port.disconnect();
            }
        };
        Wt = (e)=>{
            const listener = (t, n)=>e(t, n);
            Ft.runtime.onMessage.addListener(listener);
            return ()=>Ft.runtime.onMessage.removeListener(listener);
        };
    });
    const on = __esmMin(()=>{
        b();
        Xt();
        en();
        nn();
        rn();
    });
    const sn = __esmMin(()=>{
        Gt = "in_page_channel";
        Vt = "in-page-channel-node-id";
        Yt = "data-channel-name";
        Kt = "TW_CHANNEL_SECRET_RESPONSE";
    });
    const an = __esmMin(()=>{
        qt = __toESM(Zt(), 1);
        zt = ((e)=>{
            e.READY = "READY";
            e.LOADING = "LOADING";
            e.IDLE = "IDLE";
            e.RESTARTING = "RESTARTING";
            return e;
        })({});
        Jt = class extends qt.default {
            constructor(...e){
                super(...e);
                this.status = "LOADING";
            }
            static{
                this.EVENT = "EVENT";
            }
            static{
                this.REPLACED = "REPLACED";
            }
            emit(e, t) {
                this.status = t;
                return super.emit(e, t);
            }
        };
    });
    const cn = __esmMin(()=>{
        Qt = ((e)=>{
            e.POPUP = "popup";
            e.SIDEPANEL = "sidepanel";
            e.BACKGROUND = "background";
            e.CONTENT = "content";
            e.INPAGE = "inpage";
            return e;
        })({});
    });
    function buildEvent(e, t) {
        return `${t}_${e}`;
    }
    function Internal(e) {
        return buildEvent(e, "INTERNAL");
    }
    function Public(e) {
        return buildEvent(e, "PUBLIC");
    }
    let ln;
    let un;
    const dn = __esmMin(()=>{});
    const hn = __esmMin(()=>{
        dn();
        ln = {
            RESET: Internal("Reset"),
            LOCK: Internal("Lock"),
            LOCK_CALLBACK: Internal("Lock_callback"),
            AUTHENTICATE: Internal("Authenticate"),
            REGISTER_DEVICE: Internal("RegisterDevice"),
            APP_DISPLAYED: Internal("AppDisplayed"),
            WARNING_DISPLAYED: Internal("WarningDisplayed"),
            ICON_THEME_CHANGED: Internal("IconThemeChanged"),
            OPEN_POPUP: Internal("OpenPopup"),
            GET_APP_SETTINGS: Public("GetAppSettings"),
            GET_APP_NODES: Public("GetAppNodes"),
            GET_STORE: Internal("GetStore"),
            GET_REDUX_STATE: Internal("GetReduxState"),
            DISPATCH_REDUX_ACTION: Internal("DispatchReduxAction"),
            PING: Public("Ping"),
            ANNOUNCEMENT_DISPLAYED: Internal("AnnouncementDisplayed"),
            FETCH_ANNOUNCEMENTS: Internal("FetchAnnouncements"),
            FETCH_USER_VIP_TIER_DATA: Internal("FetchUserVipTierData"),
            FETCH_FUNDING_METHODS: Internal("FetchFundingMethods"),
            ROUTE_CHANGED: Internal("RouteChanged"),
            REPORT_ERROR: Public("ReportError")
        };
    });
    let fn;
    const pn = __esmMin(()=>{
        hn();
        un = (context, t)=>({
                context,
                name: t.name || "Error",
                message: (t.message || String(t)).slice(0, 500),
                stack: t.stack ? t.stack.slice(0, 4000) : undefined
            });
    });
    let mn;
    let gn;
    let vn;
    let yn;
    let bn;
    let En;
    const wn = __esmMin(()=>{
        fn = new WeakSet;
    });
    function installLoggerSentryBridge(e) {
        (function setErrorLogCallback(e) {
            It = e;
        })((...t)=>{
            if (vn) {
                return;
            }
            const n = bn(t);
            if (n) {
                queueMicrotask(()=>{
                    if (!function wasErrorExplicitlyCaptured(e) {
                        return fn.has(e);
                    }(n) && En(n)) {
                        vn = true;
                        try {
                            e(n);
                        } catch  {} finally{
                            vn = false;
                        }
                    }
                });
            }
        });
    }
    const Ln = __esmMin(()=>{
        $t();
        wn();
        mn = new Map;
        gn = 0;
        vn = false;
        yn = (e)=>{
            for (const t of e){
                if (t instanceof Error) {
                    return t;
                }
            }
            return null;
        };
        bn = (e)=>yn(e);
        En = (e)=>{
            if (gn >= 50) {
                return false;
            }
            const t = `${e.name}:${(e.message || "").slice(0, 500)}`;
            const n = mn.get(t) ?? 0;
            return !(n >= 3) && (mn.set(t, n + 1), gn += 1, true);
        };
    });
    let _n;
    const Tn = __esmMin(()=>{
        sn();
    });
    const Cn = __esmMin(()=>{
        _n = (e)=>new Promise((resolve)=>setTimeout(resolve, e));
    });
    function testConnection(e) {
        if (!e.portStream) {
            return Promise.resolve(zt.IDLE);
        }
        return Promise.race([
            e.portStream.emit(ln.PING),
            _n(e.FIRST_TIME_WAIT).then(()=>zt.IDLE)
        ]);
    }
    const In = __esmMin(()=>{
        hn();
        an();
        Cn();
    });
    async function startKeepAlive(e) {
        if (!e.checking) {
            e.checking = true;
            try {
                if (await testConnection(e) === zt.IDLE) {
                    e.missCount++;
                } else {
                    e.missCount = 0;
                    e.statusProvider.emit(Jt.EVENT, zt.READY);
                }
                if (e.missCount >= e.MAX_MISS_RECONNECT) {
                    e.statusProvider.emit(Jt.EVENT, zt.LOADING);
                    e.portStream = new jt(e.portName);
                    e.statusProvider.emit(Jt.REPLACED, zt.LOADING);
                    e.missCount = 0;
                }
            } catch (error) {
                St.error("keepAlive tick failed", error);
            } finally{
                e.checking = false;
                setTimeout(()=>startKeepAlive(e), e.THRESHOLD);
            }
        }
    }
    const Sn = __esmMin(()=>{
        an();
        In();
        on();
        $t();
    });
    function initPortStream(e, t = 0) {
        return new Promise((resolve, reject)=>{
            const retryAfterError = (o)=>{
                St.error("initPortStream connection attempt failed", o);
                if (t >= 5) {
                    reject(o instanceof Error ? o : new Error("Failed to initialize port stream"));
                } else {
                    resolve(_n(e.RETRY_THRESHOLD).then(()=>initPortStream(e, t + 1)));
                }
            };
            testConnection(e).then((r)=>{
                if (r === zt.READY) {
                    resolve(e);
                    startKeepAlive(e);
                } else {
                    e.portStream = new jt(e.portName);
                    e.statusProvider.emit(Jt.REPLACED, zt.LOADING);
                    testConnection(e).then((r)=>{
                        if (r === zt.READY) {
                            e.statusProvider.emit(Jt.EVENT, zt.READY);
                            resolve(e);
                            startKeepAlive(e);
                        } else {
                            resolve(_n(e.RETRY_THRESHOLD).then(()=>initPortStream(e, t)));
                        }
                    }).catch(retryAfterError);
                }
            }).catch(retryAfterError);
        });
    }
    const An = __esmMin(()=>{
        Sn();
        an();
        In();
        Cn();
        $t();
        on();
    });
    let Rn;
    const Mn = __esmMin(()=>{
        c();
    });
    const Pn = __esmMin(()=>{
        y();
        sn();
        Rn = 2000;
    });
    const kn = __exportAll({});
    function boot() {
        const portName = `${Gt}_${u(6)}`;
        const t = function createChannelSecret() {
            return u(32);
        }();
        (function serveChannelSecret(secret) {
            let t = false;
            const handler = (t)=>{
                if (t.source !== window) {
                    return;
                }
                const t_data = t.data;
                if (t_data?.type !== "TW_CHANNEL_SECRET_REQUEST") {
                    return;
                }
                const r = t.origin && t.origin !== "null" ? t.origin : "*";
                window.postMessage({
                    type: Kt,
                    requestId: t_data.requestId,
                    secret
                }, r);
                stop();
            };
            const stop = ()=>{
                if (!t) {
                    t = true;
                    window.removeEventListener("message", handler);
                    clearTimeout(n);
                }
            };
            window.addEventListener("message", handler);
            const n = setTimeout(stop, Rn);
            return stop;
        })(t);
        (function injectChannelNameInPage(portName_1) {
            const t = document.head || document.documentElement;
            const n = document.createElement("div");
            n.id = Vt;
            n.setAttribute(Yt, portName_1);
            t.insertBefore(n, t.children[0]);
        })(portName);
        const n = new Ut(portName, t);
        const r = {
            portName,
            checking: false,
            missCount: 0,
            THRESHOLD: 10000,
            FIRST_TIME_WAIT: 200,
            RETRY_THRESHOLD: 400,
            MAX_MISS_RECONNECT: 1,
            statusProvider: new Jt
        };
        const o = new Proxy({}, {
            get: (e, t, n)=>Reflect.get(r.portStream, t, n)
        });
        let i;
        installLoggerSentryBridge((e)=>(function forwardErrorToBackground(e, t, n) {
                try {
                    const r = n(ln.REPORT_ERROR, un(e, t));
                    if (r && typeof r.catch === "function") {
                        r.catch(()=>{});
                    }
                } catch  {}
            })(Qt.CONTENT, e, (e, t)=>o.emit(e, t)));
        (async function init() {
            function enhancedSend(e, t) {
                return new Promise((resolve)=>{
                    if (e.statusProvider.status === zt.READY) {
                        resolve(t());
                    } else {
                        setTimeout(()=>resolve(enhancedSend(e, t)), e.THRESHOLD);
                    }
                });
            }
            r.statusProvider.on(Jt.REPLACED, ()=>{
                if (i) {
                    i();
                }
                i = o.listen((e)=>{
                    if (e.method?.endsWith("_callback")) {
                        n.send(e).catch(St.error);
                    }
                });
            });
            n.listen((e)=>{
                if (!e.method?.endsWith("_callback")) {
                    return enhancedSend(r, ()=>o.send(e));
                }
            });
            Wt((e)=>{
                if (!e.method?.startsWith("INTERNAL_")) {
                    n.send(e).catch(St.error);
                }
            });
            await initPortStream(r);
        })().catch(St.error).then(()=>St.debug("content started"));
    }
    const Nn = __esmMin(()=>{
        y();
        on();
        sn();
        an();
        $t();
        cn();
        pn();
        Ln();
        Tn();
        An();
        Mn();
        Pn();
        if (function getIsDomainBlocked({ hostname = location.hostname }) {
            return e.some((e)=>hostname === e || hostname.endsWith(`.${e}`));
        }({
            hostname: window.location.hostname
        })) {
            St.debug("Injection blocked for this domain");
        } else {
            boot();
        }
    });
    const On = {
        matches: [
            "https://*/*",
            "http://localhost/*",
            "http://127.0.0.1/*"
        ],
        excludeMatches,
        runAt: "document_start",
        allFrames: true,
        main () {
            Promise.resolve().then(()=>{
                Nn();
                return kn;
            }).catch(()=>{});
        }
    };
    const logger$1_debug = (...e)=>{};
    const Bn = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
    const xn = class WxtLocationChangeEvent extends Event {
        static EVENT_NAME = getUniqueEventName("wxt:locationchange");
        constructor(e, t){
            super(WxtLocationChangeEvent.EVENT_NAME, {});
            this.newUrl = e;
            this.oldUrl = t;
        }
    };
    function getUniqueEventName(e) {
        return `${Bn?.runtime?.id}:content:${e}`;
    }
    const Dn = typeof globalThis.navigation?.addEventListener === "function";
    const Un = class ContentScriptContext {
        static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName("wxt:content-script-started");
        id;
        abortController;
        locationWatcher = (function createLocationWatcher(e) {
            let t;
            let n = false;
            return {
                run () {
                    if (!n) {
                        n = true;
                        t = new URL(location.href);
                        if (Dn) {
                            globalThis.navigation.addEventListener("navigate", (e)=>{
                                const n = new URL(e.destination.url);
                                if (n.href !== t.href) {
                                    window.dispatchEvent(new xn(n, t));
                                    t = n;
                                }
                            }, {
                                signal: e.signal
                            });
                        } else {
                            e.setInterval(()=>{
                                const e = new URL(location.href);
                                if (e.href !== t.href) {
                                    window.dispatchEvent(new xn(e, t));
                                    t = e;
                                }
                            }, 1000);
                        }
                    }
                }
            };
        })(this);
        constructor(e, t){
            this.contentScriptName = e;
            this.options = t;
            this.id = Math.random().toString(36).slice(2);
            this.abortController = new AbortController;
            this.stopOldScripts();
            this.listenForNewerScripts();
        }
        get signal() {
            return this.abortController.signal;
        }
        abort(e) {
            return this.abortController.abort(e);
        }
        get isInvalid() {
            if (Bn.runtime?.id == null) {
                this.notifyInvalidated();
            }
            return this.signal.aborted;
        }
        get isValid() {
            return !this.isInvalid;
        }
        onInvalidated(e) {
            this.signal.addEventListener("abort", e);
            return ()=>this.signal.removeEventListener("abort", e);
        }
        block() {
            return new Promise(()=>{});
        }
        setInterval(e, t) {
            const n = setInterval(()=>{
                if (this.isValid) {
                    e();
                }
            }, t);
            this.onInvalidated(()=>clearInterval(n));
            return n;
        }
        setTimeout(e, t) {
            const n = setTimeout(()=>{
                if (this.isValid) {
                    e();
                }
            }, t);
            this.onInvalidated(()=>clearTimeout(n));
            return n;
        }
        requestAnimationFrame(e) {
            const t = requestAnimationFrame((...t)=>{
                if (this.isValid) {
                    e(...t);
                }
            });
            this.onInvalidated(()=>cancelAnimationFrame(t));
            return t;
        }
        requestIdleCallback(e, t) {
            const n = requestIdleCallback((...t)=>{
                if (!this.signal.aborted) {
                    e(...t);
                }
            }, t);
            this.onInvalidated(()=>cancelIdleCallback(n));
            return n;
        }
        addEventListener(e, t, n, r) {
            if (t === "wxt:locationchange" && this.isValid) {
                this.locationWatcher.run();
            }
            e.addEventListener?.(t.startsWith("wxt:") ? getUniqueEventName(t) : t, n, {
                ...r,
                signal: this.signal
            });
        }
        notifyInvalidated() {
            this.abort("Content script context invalidated");
            logger$1_debug(`Content script "${this.contentScriptName}" context invalidated`);
        }
        stopOldScripts() {
            document.dispatchEvent(new CustomEvent(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, {
                detail: {
                    contentScriptName: this.contentScriptName,
                    messageId: this.id
                }
            }));
            if (!this.options?.noScriptStartedPostMessage) {
                window.postMessage({
                    type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
                    contentScriptName: this.contentScriptName,
                    messageId: this.id
                }, "*");
            }
        }
        verifyScriptStartedEvent(e) {
            const t = e.detail?.contentScriptName === this.contentScriptName;
            const n = e.detail?.messageId === this.id;
            return t && !n;
        }
        listenForNewerScripts() {
            const cb = (e)=>{
                if (e instanceof CustomEvent && this.verifyScriptStartedEvent(e)) {
                    this.notifyInvalidated();
                }
            };
            document.addEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb);
            this.onInvalidated(()=>document.removeEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb));
        }
    };
    const logger_error = (...e)=>{};
    return (async ()=>{
        try {
            const { main, ...rest } = On;
            return await main(new Un("content", rest));
        } catch (error) {
            logger_error('The content script "content" crashed on startup!', error);
            throw error;
        }
    })();
}();
