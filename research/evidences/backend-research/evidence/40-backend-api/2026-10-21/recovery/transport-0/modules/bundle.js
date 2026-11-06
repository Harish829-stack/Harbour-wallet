function getHttpStatus(ae) {
    const pe = ae;
    const ye = pe?.response?.status ?? pe?.status;
    if (typeof ye === "number") {
        return ye;
    }
    const es = ae instanceof Error ? ae.message : typeof ae === "string" ? ae : "";
    const ss = STATUS_CODE_IN_MESSAGE.exec(es);
    if (ss) {
        return Number(ss[1]);
    }
}
;
function isExpectedApiError(error) {
    const pe = getHttpStatus(error);
    return !(pe === undefined || !EXPECTED_HTTP_STATUSES.has(pe)) || isNetworkOrTimeoutError(error);
}
;
const init_storage_service = __esmMin(()=>{
    init_storage();
    init_injectable_decorator();
    import_dist$37 = require_dist$13();
    init_ext_polyfill();
    init_decorate();
    _StorageService = class StorageService {
        getStorageProvider() {
            return this.storage || _StorageService1.DEFAULT_STORAGE_PROVIDER;
        }
        setStorageStrategy(ae) {
            this.storage = ae;
        }
        fetchKeystoreStorage(ae) {
            return new import_dist$37.KeyStore.ExtensionStorage(_StorageService1.walletIdsKey(ae), this.getStorageProvider());
        }
        serialize(ae) {
            return JSON.stringify(ae);
        }
        set(ae, pe) {
            return this.getStorageProvider().set({
                [ae]: typeof pe === "string" ? pe : this.serialize(pe)
            });
        }
        setMany(ae) {
            const pe = Object.fromEntries(Object.entries(ae).map(([ae, pe])=>[
                    ae,
                    typeof pe === "string" ? pe : this.serialize(pe)
                ]));
            return this.getStorageProvider().set(pe);
        }
        async get(ae) {
            const pe = await this.getStorageProvider().get(ae);
            return Object.keys(pe).reduce((acc, key)=>({
                    ...acc,
                    [key]: pe[key] ? JSON.parse(pe[key]) : undefined
                }), {});
        }
        clear() {
            return this.getStorageProvider().clear();
        }
        getLegacyStore() {
            return this.getStorageProvider().get(_StorageService1.LEGACY_STORAGE_KEY);
        }
        setLegacyStore(ae) {
            return this.getStorageProvider().set({
                [_StorageService1.LEGACY_STORAGE_KEY]: ae
            });
        }
    };
    _StorageService1 = _StorageService;
    _StorageService.DEFAULT_STORAGE_PROVIDER = polyfill.storage.local;
    _StorageService.LEGACY_STORAGE_KEY = "store";
    _StorageService.walletIdsKey = (ae)=>`trust:wallets:${ae}`;
    StorageService = _StorageService;
    StorageService = _StorageService1 = __decorate([
        Injectable()
    ], StorageService);
});
const init_naasSessionRecovery = __esmMin(()=>{
    init_logger$1();
    REFRESH_COOLDOWN_MS = 30000;
    refreshHandler = null;
    overridesReapplier = null;
    inFlight = null;
    cooldownUntil = 0;
});
const init_naas_interceptor = __esmMin(()=>{
    init_naasSessionRecovery();
    init_xOrigin_utils();
    NAAS_RECOVERABLE_STATUSES = new Set([
        401,
        502,
        503,
        504
    ]);
    registeredInstances = new WeakSet;
});
const init_naasRpcTimeout = __esmMin(()=>{
    init_xOrigin_utils();
    init_naasSessionRecovery();
    NAAS_RPC_TIMEOUT_MS = 15000;
    installed$2 = false;
});
function SafeMethod({ propagate = false } = {}) {
    return function(pe, ye, es) {
        const es_value = es.value;
        es.value = async function(...es) {
            try {
                return await es_value.apply(this, es);
            } catch (error) {
                const safe_method = `${pe?.constructor?.name}.${ye}`;
                const http_status = getHttpStatus(error);
                if (isExpectedApiError(error)) {
                    if (shouldLogSuppression(`${safe_method}:${http_status}`)) {
                        logger_default.debug(`Suppressed expected failure in ${safe_method}`, http_status);
                    }
                    if (propagate) {
                        throw error;
                    }
                    return;
                }
                logger_default.error(`Error in ${safe_method}`);
                logger_default.error(error);
                captureException(toError(error), {
                    context: "safe-method",
                    tags: {
                        safe_method,
                        ...http_status !== undefined ? {
                            http_status
                        } : {}
                    }
                });
                if (propagate) {
                    throw error;
                }
            }
        };
        return es;
    };
}
;
const init_balanceStreamRetry = __esmMin(()=>{
    init_apiError();
    BALANCE_STREAM_RETRY_BASE_MS = 750;
    BALANCE_STREAM_RETRY_AFTER_CAP_MS = 5000;
    retryAfterHeader$1 = (ae)=>{
        const pe = ae?.response?.headers;
        if (pe) {
            if (typeof pe.get === "function") {
                return pe.get("retry-after");
            }
            return pe["retry-after"] ?? pe["Retry-After"];
        }
    };
    isRetryableBalanceStreamError = (ae)=>{
        const pe = getHttpStatus(ae);
        return isNetworkOrTimeoutError(ae) || pe === 408 || pe === 429 || pe !== undefined && pe >= 500;
    };
    parseBalanceRetryAfterMs = (ae, pe = Date.now())=>{
        if (typeof ae !== "string" && typeof ae !== "number" || ae === "") {
            return;
        }
        const ye = Number(ae);
        if (Number.isFinite(ye)) {
            return Math.max(0, 1000 * ye);
        }
        const es = Date.parse(String(ae));
        if (Number.isNaN(es)) {
            return undefined;
        }
        return Math.max(0, es - pe);
    };
});
const init_realtimeStream_service = __esmMin(()=>{
    init_api_service();
    init_api_constants();
    init_logger$1();
    init_injectable_decorator();
    init_use_decorator();
    init_decorateMetadata();
    init_decorate();
    ERROR_UNKNOWN_CHANNEL = 102;
    ERROR_PERMISSION_DENIED = 103;
    ERROR_ALREADY_SUBSCRIBED = 105;
    ERROR_LIMIT_EXCEEDED = 106;
    UNSUBSCRIBE_RESUBSCRIBE_MIN = 2500;
    _RealtimeStreamService = class RealtimeStreamService {
        static subprotocols(ae) {
            return [
                _RealtimeStreamService1.PROTOCOL,
                ae
            ];
        }
        onApplicationShutdown() {
            this.leases = 0;
            this.teardown();
        }
        setSocketFactory(ae) {
            this.socketFactory = ae;
        }
        get isConnected() {
            return this.connected;
        }
        acquire() {
            this.leases += 1;
            if (this.leases === 1) {
                this.gaveUp = false;
                this.serverRefused = false;
                this.warnedGiveUp = false;
                this.consecutiveFailures = 0;
                this.connect();
            }
        }
        retryNow(ae) {
            if (!(this.leases === 0 || this.socket || this.connecting || this.serverRefused)) {
                logger_default.debug("Realtime stream retrying now", ae);
                this.clearReconnect();
                this.clearGiveUpRetry();
                this.gaveUp = false;
                this.consecutiveFailures = 0;
                this.connect();
            }
        }
        release() {
            if (this.leases !== 0) {
                this.leases -= 1;
                if (this.leases === 0) {
                    this.teardown();
                }
            }
        }
        subscribe(ae, pe) {
            let ye = this.subscribers.get(ae);
            if (!ye) {
                ye = new Set;
                this.subscribers.set(ae, ye);
            }
            ye.add(pe);
            if (this.connected && !this.rejected.has(ae)) {
                this.syncChannel(ae);
            }
            return ()=>this.unsubscribe(ae, pe);
        }
        unsubscribe(ae, pe) {
            const ye = this.subscribers.get(ae);
            if (ye) {
                ye.delete(pe);
                if (ye.size === 0) {
                    this.subscribers.delete(ae);
                    if (this.connected) {
                        this.syncChannel(ae);
                    }
                }
            }
        }
        async connect() {
            if (!(this.leases === 0 || this.socket || this.connecting || this.serverRefused)) {
                this.connecting = true;
                try {
                    await this.openSocket();
                } finally{
                    this.connecting = false;
                }
            }
        }
        async openSocket() {
            logger_default.debug(`[realtime] connect start leases=${this.leases} failures=${this.consecutiveFailures}`);
            const ae = await this.fetchToken();
            logger_default.debug(`[realtime] token ${ae ? "received" : "MISSING"}`);
            if (this.leases === 0 || this.socket) {
                return;
            }
            if (!ae) {
                return void this.onConnectFailed("no realtime token");
            }
            let pe;
            try {
                pe = this.socketFactory(_RealtimeStreamService1.STREAM_URL, _RealtimeStreamService1.subprotocols(ae));
            } catch (error) {
                return void this.onConnectFailed(error);
            }
            this.socket = pe;
            pe.onopen = ()=>{
                this.send([
                    this.command("connect", {
                        token: ae
                    })
                ]);
            };
            pe.onmessage = (ae)=>{
                this.handleFrame(typeof ae.data === "string" ? ae.data : String(ae.data));
            };
            pe.onerror = ()=>{
                logger_default.debug("Realtime stream socket error");
            };
            pe.onclose = (ae)=>{
                const connected = this.connected;
                const ye = this.settleStreak();
                const es = connected ? Date.now() - this.connectedAt : 0;
                this.resetConnectionState();
                if (this.leases !== 0) {
                    logger_default.debug(`Realtime stream socket closed (${ae.code})`);
                    if (ye) {
                        this.scheduleReconnect();
                    } else if (connected) {
                        this.onConnectFailed(`closed ${es}ms after connect (${ae.code})`);
                    } else {
                        this.onConnectFailed(`closed before connect (${ae.code})`);
                    }
                }
            };
        }
        settleStreak() {
            const ae = this.connected && Date.now() - this.connectedAt >= _RealtimeStreamService1.MIN_STABLE_CONNECTION_MS;
            if (ae) {
                this.consecutiveFailures = 0;
            }
            return ae;
        }
        async fetchToken() {
            try {
                const ae = (await this.apiService.getCentrifugoToken())?.data?.token;
                if (typeof ae === "string" && ae.length > 0) {
                    return ae;
                }
                return undefined;
            } catch (error) {
                return void logger_default.debug("Realtime token fetch failed", error);
            }
        }
        onConnectFailed(ae) {
            this.closeSocket();
            this.consecutiveFailures += 1;
            if (this.consecutiveFailures >= _RealtimeStreamService1.MAX_CONSECUTIVE_FAILURES) {
                this.gaveUp = true;
                if (!this.warnedGiveUp) {
                    this.warnedGiveUp = true;
                    logger_default.warn("Realtime stream unavailable after repeated connect failures; consumers fall back", ae);
                }
                return void this.scheduleGiveUpRetry();
            }
            logger_default.debug("Realtime stream connect failed", ae);
            this.scheduleReconnect();
        }
        scheduleGiveUpRetry() {
            if (!(this.leases === 0 || this.giveUpTimer)) {
                this.giveUpTimer = setTimeout(()=>{
                    this.giveUpTimer = null;
                    if (this.leases !== 0 && this.gaveUp && !this.serverRefused) {
                        this.gaveUp = false;
                        this.consecutiveFailures = 0;
                        this.connect();
                    }
                }, _RealtimeStreamService1.GIVE_UP_RETRY_MS);
            }
        }
        clearGiveUpRetry() {
            if (this.giveUpTimer) {
                clearTimeout(this.giveUpTimer);
                this.giveUpTimer = null;
            }
        }
        scheduleReconnect() {
            if (this.leases === 0 || this.reconnectTimer || this.gaveUp || this.serverRefused) {
                return;
            }
            const ae = Math.max(0, this.consecutiveFailures - 1);
            const pe = Math.min(_RealtimeStreamService1.RECONNECT_BASE_MS * 2 ** ae, _RealtimeStreamService1.RECONNECT_MAX_MS);
            const ye = Math.floor(Math.random() * _RealtimeStreamService1.RECONNECT_BASE_MS);
            this.reconnectTimer = setTimeout(()=>{
                this.reconnectTimer = null;
                this.connect();
            }, pe + ye);
        }
        clearReconnect() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        }
        clearRefresh() {
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer);
                this.refreshTimer = null;
            }
        }
        teardown() {
            this.clearReconnect();
            this.clearGiveUpRetry();
            this.closeSocket();
            this.rejected.clear();
        }
        clearSubscribeRetries() {
            for (const ae of this.subscribeRetryTimers.values()){
                clearTimeout(ae);
            }
            this.subscribeRetryTimers.clear();
        }
        closeSocket() {
            const socket = this.socket;
            this.resetConnectionState();
            if (socket) {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                try {
                    socket.close(1000);
                } catch  {}
            }
        }
        resetConnectionState() {
            this.socket = null;
            this.connected = false;
            this.connectedAt = 0;
            this.pending.clear();
            this.subscribed.clear();
            this.clearRefresh();
            this.clearSubscribeRetries();
        }
        command(kind, pe) {
            const id = ++this.commandId;
            this.pending.set(id, {
                kind,
                channel: pe.channel
            });
            return {
                id,
                [kind]: pe
            };
        }
        send(ae) {
            const socket = this.socket;
            if (socket && ae.length !== 0) {
                try {
                    socket.send(ae.map((ae)=>JSON.stringify(ae)).join("\n"));
                } catch (error) {
                    logger_default.debug("Realtime stream send failed", error);
                }
            }
        }
        handleFrame(ae) {
            for (const pe of ae.split("\n")){
                const ae = pe.trim();
                if (!ae) {
                    continue;
                }
                let ye;
                try {
                    ye = JSON.parse(ae);
                } catch  {
                    continue;
                }
                if (!(ye === null || typeof ye !== "object" || Array.isArray(ye))) {
                    this.handleMessage(ye);
                }
            }
        }
        handleMessage(ae) {
            if (Object.keys(ae).length === 0) {
                return void this.send([
                    {}
                ]);
            }
            if (ae.push && typeof ae.push === "object") {
                return void this.handlePush(ae.push);
            }
            if (typeof ae.id !== "number") {
                return;
            }
            const pe = this.pending.get(ae.id);
            this.pending.delete(ae.id);
            if (pe) {
                if (ae.error) {
                    this.handleCommandError(pe, ae.error);
                } else {
                    switch(pe.kind){
                        case "connect":
                            this.onConnected(ae.connect);
                            break;
                        case "refresh":
                            this.scheduleRefresh(ae.refresh);
                            break;
                        case "subscribe":
                            if (pe.channel) {
                                this.subscribed.add(pe.channel);
                                if (!this.subscribers.has(pe.channel)) {
                                    this.syncChannel(pe.channel);
                                }
                            }
                            break;
                        case "unsubscribe":
                            if (pe.channel) {
                                this.subscribed.delete(pe.channel);
                            }
                    }
                }
            }
        }
        handleCommandError(ae, pe) {
            if (ae.kind === "connect") {
                return void this.onConnectFailed(`connect rejected: ${pe.code} ${pe.message ?? ""}`);
            }
            if (ae.kind === "refresh") {
                logger_default.debug(`Realtime token refresh rejected (${pe.code}); reconnecting`);
                this.settleStreak();
                this.closeSocket();
                return void this.scheduleReconnect();
            }
            const { channel } = ae;
            if (channel) {
                if (pe.code !== ERROR_ALREADY_SUBSCRIBED) {
                    if (pe.code !== ERROR_UNKNOWN_CHANNEL && pe.code !== ERROR_PERMISSION_DENIED && pe.code !== ERROR_LIMIT_EXCEEDED) {
                        logger_default.debug(`Realtime command error (${pe.code}) on ${channel}: ${pe.message ?? ""}`);
                        if (ae.kind === "subscribe") {
                            this.scheduleSubscribeRetry(channel);
                        }
                    } else {
                        this.rejected.add(channel);
                        logger_default.debug(`Realtime channel rejected (${pe.code}): ${channel}`);
                        for (const ae of this.subscribers.get(channel) ?? []){
                            ae.onChannelRejected?.(channel, pe.code);
                        }
                    }
                } else {
                    this.subscribed.add(channel);
                }
            }
        }
        scheduleSubscribeRetry(ae) {
            if (!this.subscribeRetryTimers.has(ae)) {
                this.subscribeRetryTimers.set(ae, setTimeout(()=>{
                    this.subscribeRetryTimers.delete(ae);
                    if (this.connected) {
                        this.syncChannel(ae);
                    }
                }, _RealtimeStreamService1.SUBSCRIBE_RETRY_MS));
            }
        }
        onConnected(ae) {
            logger_default.debug("[realtime] connected");
            this.connected = true;
            this.connectedAt = Date.now();
            this.gaveUp = false;
            this.scheduleRefresh(ae);
            this.syncAllChannels();
        }
        scheduleRefresh(ae) {
            this.clearRefresh();
            if (!ae?.expires || typeof ae.ttl !== "number" || ae.ttl <= 0) {
                return;
            }
            const pe = 1000 * ae.ttl;
            const ye = Math.max(pe - _RealtimeStreamService1.REFRESH_LEAD_MS, Math.floor(pe / 2));
            this.refreshTimer = setTimeout(()=>{
                this.refreshTimer = null;
                this.refreshToken();
            }, ye);
        }
        async refreshToken() {
            const socket = this.socket;
            const pe = await this.fetchToken();
            if (this.connected && this.socket === socket) {
                if (pe) {
                    return void this.send([
                        this.command("refresh", {
                            token: pe
                        })
                    ]);
                }
                logger_default.debug("Realtime token refresh failed to fetch a token; reconnecting");
                this.settleStreak();
                this.closeSocket();
                return void this.scheduleReconnect();
            }
        }
        inFlight(ae) {
            return new Set([
                ...this.pending.values()
            ].filter((pe)=>pe.kind === ae).map((ae)=>ae.channel));
        }
        syncChannel(ae) {
            this.send(this.channelDeltaFrames([
                ae
            ]));
        }
        syncAllChannels() {
            this.send(this.channelDeltaFrames([
                ...this.subscribers.keys(),
                ...this.subscribed
            ]));
        }
        channelDeltaFrames(ae) {
            const pe = this.inFlight("subscribe");
            const ye = this.inFlight("unsubscribe");
            const es = [];
            for (const channel of new Set(ae)){
                const ae = this.subscribers.has(channel) && !this.rejected.has(channel);
                if (!ae || this.subscribed.has(channel) || pe.has(channel)) {
                    if (!(ae || !this.subscribed.has(channel) || ye.has(channel))) {
                        es.push(this.command("unsubscribe", {
                            channel
                        }));
                    }
                } else {
                    es.push(this.command("subscribe", {
                        channel
                    }));
                }
            }
            return es;
        }
        handlePush(ae) {
            if (ae.disconnect) {
                return void this.handleDisconnectPush(ae.disconnect);
            }
            const ae_channel = ae.channel;
            if (!ae_channel) {
                return;
            }
            if (ae.unsubscribe) {
                return void this.handleUnsubscribePush(ae_channel, ae.unsubscribe);
            }
            if (!ae.pub) {
                return;
            }
            const ye = this.subscribers.get(ae_channel);
            if (ye) {
                for (const es of ye){
                    try {
                        es.onPublication(ae_channel, ae.pub?.data);
                    } catch (error) {
                        logger_default.debug(`Realtime subscriber failed on ${ae_channel}`, error);
                    }
                }
            }
        }
        handleDisconnectPush(ae) {
            const pe = typeof ae.code === "number" ? ae.code : 0;
            if (isTerminalDisconnectCode(pe)) {
                logger_default.debug(`Realtime stream disconnect push (${pe}): not reconnecting this lease`);
                this.gaveUp = true;
                this.serverRefused = true;
                this.closeSocket();
            } else {
                logger_default.debug(`Realtime stream disconnect push (${pe}); server closing`);
            }
        }
        handleUnsubscribePush(ae, pe) {
            this.subscribed.delete(ae);
            const ye = typeof pe.code === "number" ? pe.code : 0;
            logger_default.debug(`Realtime channel unsubscribed by server (${ye}): ${ae}`);
            if (ye >= UNSUBSCRIBE_RESUBSCRIBE_MIN && this.connected) {
                this.syncChannel(ae);
            }
        }
        constructor(){
            this.socketFactory = (ae, pe)=>new WebSocket(ae, pe);
            this.socket = null;
            this.leases = 0;
            this.connected = false;
            this.commandId = 0;
            this.pending = new Map;
            this.subscribed = new Set;
            this.rejected = new Set;
            this.subscribers = new Map;
            this.consecutiveFailures = 0;
            this.connectedAt = 0;
            this.reconnectTimer = null;
            this.refreshTimer = null;
            this.giveUpTimer = null;
            this.subscribeRetryTimers = new Map;
            this.gaveUp = false;
            this.connecting = false;
            this.serverRefused = false;
            this.warnedGiveUp = false;
        }
    };
    _RealtimeStreamService1 = _RealtimeStreamService;
    _RealtimeStreamService.STREAM_URL = `${API_GATEWAY_BASE_URL.replace(/^https:/, "wss:")}/stream/ws`;
    _RealtimeStreamService.PROTOCOL = "centrifuge-json";
    _RealtimeStreamService.RECONNECT_BASE_MS = 1000;
    _RealtimeStreamService.RECONNECT_MAX_MS = 60000;
    _RealtimeStreamService.MAX_CONSECUTIVE_FAILURES = 5;
    _RealtimeStreamService.GIVE_UP_RETRY_MS = 300000;
    _RealtimeStreamService.MIN_STABLE_CONNECTION_MS = 30000;
    _RealtimeStreamService.SUBSCRIBE_RETRY_MS = 5000;
    _RealtimeStreamService.REFRESH_LEAD_MS = 30000;
    RealtimeStreamService = _RealtimeStreamService;
    __decorate([
        Use(ApiService),
        __decorateMetadata("design:type", ApiService === undefined ? Object : ApiService)
    ], RealtimeStreamService.prototype, "apiService", undefined);
    RealtimeStreamService = _RealtimeStreamService1 = __decorate([
        Injectable()
    ], RealtimeStreamService);
});
