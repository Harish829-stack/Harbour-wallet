const init_cloudflare_provider = __esmMin(()=>{
    init_url_json_rpc_provider();
    init_lib_esm$30();
    init__version$3();
    __awaiter$2 = function(ae, pe, ye, es) {
        return new (ye || (ye = Promise))(function(ss, ns) {
            function fulfilled(ae) {
                try {
                    step(es.next(ae));
                } catch (error) {
                    ns(error);
                }
            }
            function rejected(ae) {
                try {
                    step(es.throw(ae));
                } catch (error) {
                    ns(error);
                }
            }
            function step(ae) {
                if (ae.done) {
                    ss(ae.value);
                } else {
                    (function adopt(ae) {
                        if (ae instanceof ye) {
                            return ae;
                        }
                        return new ye(function(pe) {
                            pe(ae);
                        });
                    })(ae.value).then(fulfilled, rejected);
                }
            }
            step((es = es.apply(ae, pe || [])).next());
        });
    };
    logger$12 = new Logger(version$4);
    CloudflareProvider = class extends UrlJsonRpcProvider {
        static getApiKey(ae) {
            if (ae != null) {
                logger$12.throwArgumentError("apiKey not supported for cloudflare", "apiKey", ae);
            }
            return null;
        }
        static getUrl(ae, pe) {
            let ye = null;
            if (ae.name === "homestead") {
                ye = "https://cloudflare-eth.com/";
            } else {
                logger$12.throwArgumentError("unsupported network", "network", arguments[0]);
            }
            return ye;
        }
        perform(ae, pe) {
            const ye = Object.create(null, {
                perform: {
                    get: ()=>super.perform
                }
            });
            return __awaiter$2(this, undefined, undefined, function*() {
                if (ae === "getBlockNumber") {
                    return (yield ye.perform.call(this, "getBlock", {
                        blockTag: "latest"
                    })).number;
                }
                return ye.perform.call(this, ae, pe);
            });
        }
    };
});
const init_etherscan_provider = __esmMin(()=>{
    init_lib_esm$29();
    init_lib_esm$24();
    init_lib_esm$15();
    init_lib_esm$4();
    init_formatter();
    init_lib_esm$30();
    init__version$3();
    init_base_provider();
    __awaiter$1 = function(ae, pe, ye, es) {
        return new (ye || (ye = Promise))(function(ss, ns) {
            function fulfilled(ae) {
                try {
                    step(es.next(ae));
                } catch (error) {
                    ns(error);
                }
            }
            function rejected(ae) {
                try {
                    step(es.throw(ae));
                } catch (error) {
                    ns(error);
                }
            }
            function step(ae) {
                if (ae.done) {
                    ss(ae.value);
                } else {
                    (function adopt(ae) {
                        if (ae instanceof ye) {
                            return ae;
                        }
                        return new ye(function(pe) {
                            pe(ae);
                        });
                    })(ae.value).then(fulfilled, rejected);
                }
            }
            step((es = es.apply(ae, pe || [])).next());
        });
    };
    logger$11 = new Logger(version$4);
    EtherscanProvider = class extends BaseProvider {
        constructor(ae, pe){
            super(ae);
            defineReadOnly(this, "baseUrl", this.getBaseUrl());
            defineReadOnly(this, "apiKey", pe || null);
        }
        getBaseUrl() {
            switch(this.network ? this.network.name : "invalid"){
                case "homestead":
                    return "https://api.etherscan.io";
                case "goerli":
                    return "https://api-goerli.etherscan.io";
                case "sepolia":
                    return "https://api-sepolia.etherscan.io";
                case "matic":
                    return "https://api.polygonscan.com";
                case "maticmum":
                    return "https://api-testnet.polygonscan.com";
                case "arbitrum":
                    return "https://api.arbiscan.io";
                case "arbitrum-goerli":
                    return "https://api-goerli.arbiscan.io";
                case "optimism":
                    return "https://api-optimistic.etherscan.io";
                case "optimism-goerli":
                    return "https://api-goerli-optimistic.etherscan.io";
            }
            return logger$11.throwArgumentError("unsupported network", "network", this.network.name);
        }
        getUrl(ae, pe) {
            const ye = Object.keys(pe).reduce((acc, key)=>{
                const es = pe[key];
                if (es != null) {
                    acc += `&${key}=${es}`;
                }
                return acc;
            }, "");
            const es = this.apiKey ? `&apikey=${this.apiKey}` : "";
            return `${this.baseUrl}/api?module=${ae}${ye}${es}`;
        }
        getPostUrl() {
            return `${this.baseUrl}/api`;
        }
        getPostData(ae, pe) {
            pe.module = ae;
            pe.apikey = this.apiKey;
            return pe;
        }
        fetch(ae, pe, ye) {
            return __awaiter$1(this, undefined, undefined, function*() {
                const es = ye ? this.getPostUrl() : this.getUrl(ae, pe);
                const ss = ye ? this.getPostData(ae, pe) : null;
                const ns = ae === "proxy" ? getJsonResult : getResult;
                this.emit("debug", {
                    action: "request",
                    request: es,
                    provider: this
                });
                const ts = {
                    url: es,
                    throttleSlotInterval: 1000,
                    throttleCallback: (ae, pe)=>{
                        if (this.isCommunityResource()) {
                            showThrottleMessage();
                        }
                        return Promise.resolve(true);
                    }
                };
                let rs = null;
                if (ss) {
                    ts.headers = {
                        "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
                    };
                    rs = Object.keys(ss).map((ae)=>`${ae}=${ss[ae]}`).join("&");
                }
                const os = yield fetchJson(ts, rs, ns || getJsonResult);
                this.emit("debug", {
                    action: "response",
                    request: es,
                    response: deepCopy(os),
                    provider: this
                });
                return os;
            });
        }
        detectNetwork() {
            return __awaiter$1(this, undefined, undefined, function*() {
                return this.network;
            });
        }
        perform(ae, pe) {
            const ye = Object.create(null, {
                perform: {
                    get: ()=>super.perform
                }
            });
            return __awaiter$1(this, undefined, undefined, function*() {
                switch(ae){
                    case "getBlockNumber":
                        return this.fetch("proxy", {
                            action: "eth_blockNumber"
                        });
                    case "getGasPrice":
                        return this.fetch("proxy", {
                            action: "eth_gasPrice"
                        });
                    case "getBalance":
                        return this.fetch("account", {
                            action: "balance",
                            address: pe.address,
                            tag: pe.blockTag
                        });
                    case "getTransactionCount":
                        return this.fetch("proxy", {
                            action: "eth_getTransactionCount",
                            address: pe.address,
                            tag: pe.blockTag
                        });
                    case "getCode":
                        return this.fetch("proxy", {
                            action: "eth_getCode",
                            address: pe.address,
                            tag: pe.blockTag
                        });
                    case "getStorageAt":
                        return this.fetch("proxy", {
                            action: "eth_getStorageAt",
                            address: pe.address,
                            position: pe.position,
                            tag: pe.blockTag
                        });
                    case "sendTransaction":
                        return this.fetch("proxy", {
                            action: "eth_sendRawTransaction",
                            hex: pe.signedTransaction
                        }, true).catch((ae)=>checkError("sendTransaction", ae, pe.signedTransaction));
                    case "getBlock":
                        if (pe.blockTag) {
                            return this.fetch("proxy", {
                                action: "eth_getBlockByNumber",
                                tag: pe.blockTag,
                                boolean: pe.includeTransactions ? "true" : "false"
                            });
                        }
                        throw new Error("getBlock by blockHash not implemented");
                    case "getTransaction":
                        return this.fetch("proxy", {
                            action: "eth_getTransactionByHash",
                            txhash: pe.transactionHash
                        });
                    case "getTransactionReceipt":
                        return this.fetch("proxy", {
                            action: "eth_getTransactionReceipt",
                            txhash: pe.transactionHash
                        });
                    case "call":
                        {
                            if (pe.blockTag !== "latest") {
                                throw new Error("EtherscanProvider does not support blockTag for call");
                            }
                            const ae = getTransactionPostData(pe.transaction);
                            ae.module = "proxy";
                            ae.action = "eth_call";
                            try {
                                return yield this.fetch("proxy", ae, true);
                            } catch (error) {
                                return checkError("call", error, pe.transaction);
                            }
                        }
                    case "estimateGas":
                        {
                            const ae = getTransactionPostData(pe.transaction);
                            ae.module = "proxy";
                            ae.action = "eth_estimateGas";
                            try {
                                return yield this.fetch("proxy", ae, true);
                            } catch (error) {
                                return checkError("estimateGas", error, pe.transaction);
                            }
                        }
                    case "getLogs":
                        {
                            const ae = {
                                action: "getLogs"
                            };
                            if (pe.filter.fromBlock) {
                                ae.fromBlock = checkLogTag(pe.filter.fromBlock);
                            }
                            if (pe.filter.toBlock) {
                                ae.toBlock = checkLogTag(pe.filter.toBlock);
                            }
                            if (pe.filter.address) {
                                ae.address = pe.filter.address;
                            }
                            if (pe.filter.topics && pe.filter.topics.length > 0 && (pe.filter.topics.length > 1 && logger$11.throwError("unsupported topic count", Logger.errors.UNSUPPORTED_OPERATION, {
                                topics: pe.filter.topics
                            }), pe.filter.topics.length === 1)) {
                                const topic0 = pe.filter.topics[0];
                                if (!(typeof topic0 === "string" && topic0.length === 66)) {
                                    logger$11.throwError("unsupported topic format", Logger.errors.UNSUPPORTED_OPERATION, {
                                        topic0
                                    });
                                }
                                ae.topic0 = topic0;
                            }
                            const ye = yield this.fetch("logs", ae);
                            let es = {};
                            for (const ae of ye){
                                if (ae.blockHash == null) {
                                    if (es[ae.blockNumber] == null) {
                                        const pe = yield this.getBlock(ae.blockNumber);
                                        if (pe) {
                                            es[ae.blockNumber] = pe.hash;
                                        }
                                    }
                                    ae.blockHash = es[ae.blockNumber];
                                }
                            }
                            return ye;
                        }
                    case "getEtherPrice":
                        if (this.network.name !== "homestead") {
                            return 0;
                        }
                        return parseFloat((yield this.fetch("stats", {
                            action: "ethprice"
                        })).ethusd);
                }
                return ye.perform.call(this, ae, pe);
            });
        }
        getHistory(ae, pe, ye) {
            return __awaiter$1(this, undefined, undefined, function*() {
                const es = {
                    action: "txlist",
                    address: yield this.resolveName(ae),
                    startblock: pe ?? 0,
                    endblock: ye ?? 99999999,
                    sort: "asc"
                };
                return (yield this.fetch("account", es)).map((ae)=>{
                    [
                        "contractAddress",
                        "to"
                    ].forEach((pe)=>{
                        if (ae[pe] == "") {
                            delete ae[pe];
                        }
                    });
                    if (ae.creates == null && ae.contractAddress != null) {
                        ae.creates = ae.contractAddress;
                    }
                    const pe = this.formatter.transactionResponse(ae);
                    if (ae.timeStamp) {
                        pe.timestamp = parseInt(ae.timeStamp);
                    }
                    return pe;
                });
            });
        }
        isCommunityResource() {
            return this.apiKey == null;
        }
    };
});
const init_pocket_provider = __esmMin(()=>{
    init_lib_esm$30();
    init__version$3();
    init_url_json_rpc_provider();
    logger$7 = new Logger(version$4);
    defaultApplicationId = "62e1ad51b37b8e00394bda3b";
    PocketProvider = class extends UrlJsonRpcProvider {
        static getApiKey(ae) {
            const pe = {
                applicationId: null,
                loadBalancer: true,
                applicationSecretKey: null
            };
            if (ae == null) {
                pe.applicationId = defaultApplicationId;
            } else if (typeof ae === "string") {
                pe.applicationId = ae;
            } else if (ae.applicationSecretKey != null) {
                pe.applicationId = ae.applicationId;
                pe.applicationSecretKey = ae.applicationSecretKey;
            } else if (ae.applicationId) {
                pe.applicationId = ae.applicationId;
            } else {
                logger$7.throwArgumentError("unsupported PocketProvider apiKey", "apiKey", ae);
            }
            return pe;
        }
        static getUrl(ae, pe) {
            let ye = null;
            switch(ae ? ae.name : "unknown"){
                case "goerli":
                    ye = "eth-goerli.gateway.pokt.network";
                    break;
                case "homestead":
                    ye = "eth-mainnet.gateway.pokt.network";
                    break;
                case "kovan":
                    ye = "poa-kovan.gateway.pokt.network";
                    break;
                case "matic":
                    ye = "poly-mainnet.gateway.pokt.network";
                    break;
                case "maticmum":
                    ye = "polygon-mumbai-rpc.gateway.pokt.network";
                    break;
                case "rinkeby":
                    ye = "eth-rinkeby.gateway.pokt.network";
                    break;
                case "ropsten":
                    ye = "eth-ropsten.gateway.pokt.network";
                    break;
                default:
                    logger$7.throwError("unsupported network", Logger.errors.INVALID_ARGUMENT, {
                        argument: "network",
                        value: ae
                    });
            }
            const es = {
                headers: {},
                url: `https://${ye}/v1/lb/${pe.applicationId}`
            };
            if (pe.applicationSecretKey != null) {
                es.user = "";
                es.password = pe.applicationSecretKey;
            }
            return es;
        }
        isCommunityResource() {
            return this.applicationId === defaultApplicationId;
        }
    };
});
data.open("GET", global.XDomainRequest ? "/" : "https://example.com");
const init_url = __esmMin(()=>{
    import_punycode = __toESM(require_punycode());
    import_lib$1 = __toESM(require_lib$4());
    punycode = import_punycode.default;
    protocolPattern = /^([a-z0-9.+-]+:)/i;
    portPattern = /:[0-9]*$/;
    simplePathPattern = /^(\/\/?(?!\/)[^?\s]*)(\?[^\s]*)?$/;
    unwise = [
        "{",
        "}",
        "|",
        "\\",
        "^",
        "`",
        "<",
        ">",
        '"',
        "`",
        " ",
        "\r",
        "\n",
        "\t"
    ];
    autoEscape = [
        "'"
    ].concat(unwise);
    nonHostChars = [
        "%",
        "/",
        "?",
        ";",
        "#"
    ].concat(autoEscape);
    hostEndingChars = [
        "/",
        "?",
        "#"
    ];
    hostnameMaxLen = 255;
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
    unsafeProtocol = {
        javascript: true,
        "javascript:": true
    };
    hostlessProtocol = {
        javascript: true,
        "javascript:": true
    };
    slashedProtocol = {
        http: true,
        https: true,
        ftp: true,
        gopher: true,
        file: true,
        "http:": true,
        "https:": true,
        "ftp:": true,
        "gopher:": true,
        "file:": true
    };
    querystring = import_lib$1.default;
    Url.prototype.parse = function(ae, pe, ye) {
        if (typeof ae !== "string") {
            throw new TypeError(`Parameter 'url' must be a string, not ${typeof ae}`);
        }
        const es = ae.indexOf("?");
        const ss = es !== -1 && es < ae.indexOf("#") ? "?" : "#";
        const ns = ae.split(ss);
        ns[0] = ns[0].replace(/\\/g, "/");
        let ts = ae = ns.join(ss);
        ts = ts.trim();
        if (!ye && ae.split("#").length === 1) {
            const rs = simplePathPattern.exec(ts);
            if (rs) {
                this.path = ts;
                this.href = ts;
                this.pathname = rs[1];
                if (rs[2]) {
                    this.search = rs[2];
                    this.query = pe ? querystring.parse(this.search.substr(1)) : this.search.substr(1);
                } else if (pe) {
                    this.search = "";
                    this.query = {};
                }
                return this;
            }
        }
        let os = protocolPattern.exec(ts);
        if (os) {
            var as = (os = os[0]).toLowerCase();
            this.protocol = as;
            ts = ts.substr(os.length);
        }
        if (ye || os || ts.match(/^\/\/[^@/]+@[^@/]+/)) {
            var cs = ts.substr(0, 2) === "//";
            if (!(!cs || os && hostlessProtocol[os])) {
                ts = ts.substr(2);
                this.slashes = true;
            }
        }
        if (!hostlessProtocol[os] && (cs || os && !slashedProtocol[os])) {
            let us;
            let ls;
            let ms = -1;
            for(var gs = 0; gs < hostEndingChars.length; gs++){
                if ((ds = ts.indexOf(hostEndingChars[gs])) !== -1 && (ms === -1 || ds < ms)) {
                    ms = ds;
                }
            }
            if ((ls = ms === -1 ? ts.lastIndexOf("@") : ts.lastIndexOf("@", ms)) !== -1) {
                us = ts.slice(0, ls);
                ts = ts.slice(ls + 1);
                this.auth = decodeURIComponent(us);
            }
            ms = -1;
            for(gs = 0; gs < nonHostChars.length; gs++){
                var ds;
                if ((ds = ts.indexOf(nonHostChars[gs])) !== -1 && (ms === -1 || ds < ms)) {
                    ms = ds;
                }
            }
            if (ms === -1) {
                ms = ts.length;
            }
            this.host = ts.slice(0, ms);
            ts = ts.slice(ms);
            this.parseHost();
            this.hostname = this.hostname || "";
            const _s = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
            if (!_s) {
                const hs = this.hostname.split(/\./);
                gs = 0;
                for(var vs = hs.length; gs < vs; gs++){
                    const ps = hs[gs];
                    if (ps && !ps.match(hostnamePartPattern)) {
                        let fs = "";
                        for(let ks = 0, Rs = ps.length; ks < Rs; ks++){
                            if (ps.charCodeAt(ks) > 127) {
                                fs += "x";
                            } else {
                                fs += ps[ks];
                            }
                        }
                        if (!fs.match(hostnamePartPattern)) {
                            const $s = hs.slice(0, gs);
                            const bs = hs.slice(gs + 1);
                            const Ms = ps.match(hostnamePartStart);
                            if (Ms) {
                                $s.push(Ms[1]);
                                bs.unshift(Ms[2]);
                            }
                            if (bs.length) {
                                ts = `/${bs.join(".")}${ts}`;
                            }
                            this.hostname = $s.join(".");
                            break;
                        }
                    }
                }
            }
            if (this.hostname.length > hostnameMaxLen) {
                this.hostname = "";
            } else {
                this.hostname = this.hostname.toLowerCase();
            }
            if (!_s) {
                this.hostname = punycode.toASCII(this.hostname);
            }
            var ys = this.port ? `:${this.port}` : "";
            const Ss = this.hostname || "";
            this.host = Ss + ys;
            this.href += this.host;
            if (_s) {
                this.hostname = this.hostname.substr(1, this.hostname.length - 2);
                if (ts[0] !== "/") {
                    ts = `/${ts}`;
                }
            }
        }
        if (!unsafeProtocol[as]) {
            gs = 0;
            for(vs = autoEscape.length; gs < vs; gs++){
                const As = autoEscape[gs];
                if (ts.indexOf(As) !== -1) {
                    let Cs = encodeURIComponent(As);
                    if (Cs === As) {
                        Cs = escape(As);
                    }
                    ts = ts.split(As).join(Cs);
                }
            }
        }
        const Ts = ts.indexOf("#");
        if (Ts !== -1) {
            this.hash = ts.substr(Ts);
            ts = ts.slice(0, Ts);
        }
        const Is = ts.indexOf("?");
        if (Is !== -1) {
            this.search = ts.substr(Is);
            this.query = ts.substr(Is + 1);
            if (pe) {
                this.query = querystring.parse(this.query);
            }
            ts = ts.slice(0, Is);
        } else if (pe) {
            this.search = "";
            this.query = {};
        }
        if (ts) {
            this.pathname = ts;
        }
        if (slashedProtocol[as] && this.hostname && !this.pathname) {
            this.pathname = "/";
        }
        if (this.pathname || this.search) {
            ys = this.pathname || "";
            const Es = this.search || "";
            this.path = ys + Es;
        }
        this.href = this.format();
        return this;
    };
    Url.prototype.format = function() {
        let ae = this.auth || "";
        if (ae) {
            ae = (ae = encodeURIComponent(ae)).replace(/%3A/i, ":");
            ae += "@";
        }
        let pe = this.protocol || "";
        let ye = this.pathname || "";
        let es = this.hash || "";
        let ss = false;
        let ns = "";
        if (this.host) {
            ss = ae + this.host;
        } else if (this.hostname) {
            ss = ae + (this.hostname.indexOf(":") === -1 ? this.hostname : `[${this.hostname}]`);
            if (this.port) {
                ss += `:${this.port}`;
            }
        }
        if (this.query && typeof this.query === "object" && Object.keys(this.query).length) {
            ns = querystring.stringify(this.query, {
                arrayFormat: "repeat",
                addQueryPrefix: false
            });
        }
        let ts = this.search || ns && `?${ns}` || "";
        if (pe && pe.substr(-1) !== ":") {
            pe += ":";
        }
        if (this.slashes || (!pe || slashedProtocol[pe]) && ss !== false) {
            ss = `//${ss || ""}`;
            if (ye && ye.charAt(0) !== "/") {
                ye = `/${ye}`;
            }
        } else if (!ss) {
            ss = "";
        }
        if (es && es.charAt(0) !== "#") {
            es = `#${es}`;
        }
        if (ts && ts.charAt(0) !== "?") {
            ts = `?${ts}`;
        }
        return pe + ss + (ye = ye.replace(/[?#]/g, (ae)=>encodeURIComponent(ae))) + (ts = ts.replace("#", "%23")) + es;
    };
    Url.prototype.resolve = function(ae) {
        return this.resolveObject(urlParse(ae, false, true)).format();
    };
    Url.prototype.resolveObject = function(ae) {
        if (typeof ae === "string") {
            const pe = new Url;
            pe.parse(ae, false, true);
            ae = pe;
        }
        const ye = new Url;
        for(let es = Object.keys(this), ss = 0; ss < es.length; ss++){
            const ns = es[ss];
            ye[ns] = this[ns];
        }
        ye.hash = ae.hash;
        if (ae.href === "") {
            ye.href = ye.format();
            return ye;
        }
        if (ae.slashes && !ae.protocol) {
            for(let ts = Object.keys(ae), rs = 0; rs < ts.length; rs++){
                const os = ts[rs];
                if (os !== "protocol") {
                    ye[os] = ae[os];
                }
            }
            if (slashedProtocol[ye.protocol] && ye.hostname && !ye.pathname) {
                ye.pathname = "/";
                ye.path = ye.pathname;
            }
            ye.href = ye.format();
            return ye;
        }
        if (ae.protocol && ae.protocol !== ye.protocol) {
            if (!slashedProtocol[ae.protocol]) {
                for(let as = Object.keys(ae), cs = 0; cs < as.length; cs++){
                    const us = as[cs];
                    ye[us] = ae[us];
                }
                ye.href = ye.format();
                return ye;
            }
            ye.protocol = ae.protocol;
            if (ae.host || hostlessProtocol[ae.protocol]) {
                ye.pathname = ae.pathname;
            } else {
                for(var ls = (ae.pathname || "").split("/"); ls.length && !(ae.host = ls.shift()););
                if (!ae.host) {
                    ae.host = "";
                }
                if (!ae.hostname) {
                    ae.hostname = "";
                }
                if (ls[0] !== "") {
                    ls.unshift("");
                }
                if (ls.length < 2) {
                    ls.unshift("");
                }
                ye.pathname = ls.join("/");
            }
            ye.search = ae.search;
            ye.query = ae.query;
            ye.host = ae.host || "";
            ye.auth = ae.auth;
            ye.hostname = ae.hostname || ae.host;
            ye.port = ae.port;
            if (ye.pathname || ye.search) {
                ye.path = (ye.pathname || "") + (ye.search || "");
            }
            ye.slashes = ye.slashes || ae.slashes;
            ye.href = ye.format();
            return ye;
        }
        const ms = ye.pathname && ye.pathname.charAt(0) === "/";
        const gs = ae.host || ae.pathname && ae.pathname.charAt(0) === "/";
        let ds = gs || ms || ye.host && ae.pathname;
        const _s = ds;
        let hs = ye.pathname && ye.pathname.split("/") || [];
        ls = ae.pathname && ae.pathname.split("/") || [];
        const vs = ye.protocol && !slashedProtocol[ye.protocol];
        if (vs) {
            ye.hostname = "";
            ye.port = null;
            if (ye.host) {
                if (hs[0] === "") {
                    hs[0] = ye.host;
                } else {
                    hs.unshift(ye.host);
                }
            }
            ye.host = "";
            if (ae.protocol) {
                ae.hostname = null;
                ae.port = null;
                if (ae.host) {
                    if (ls[0] === "") {
                        ls[0] = ae.host;
                    } else {
                        ls.unshift(ae.host);
                    }
                }
                ae.host = null;
            }
            ds = ds && (ls[0] === "" || hs[0] === "");
        }
        if (gs) {
            ye.host = ae.host || ae.host === "" ? ae.host : ye.host;
            ye.hostname = ae.hostname || ae.hostname === "" ? ae.hostname : ye.hostname;
            ye.search = ae.search;
            ye.query = ae.query;
            hs = ls;
        } else if (ls.length) {
            if (!hs) {
                hs = [];
            }
            hs.pop();
            hs = hs.concat(ls);
            ye.search = ae.search;
            ye.query = ae.query;
        } else if (ae.search != null) {
            if (vs) {
                ye.host = hs.shift();
                ye.hostname = ye.host;
                if ($s = !!(ye.host && ye.host.indexOf("@") > 0) && ye.host.split("@")) {
                    ye.auth = $s.shift();
                    ye.hostname = $s.shift();
                    ye.host = ye.hostname;
                }
            }
            ye.search = ae.search;
            ye.query = ae.query;
            if (!(ye.pathname === null && ye.search === null)) {
                ye.path = (ye.pathname ? ye.pathname : "") + (ye.search ? ye.search : "");
            }
            ye.href = ye.format();
            return ye;
        }
        if (!hs.length) {
            ye.pathname = null;
            if (ye.search) {
                ye.path = `/${ye.search}`;
            } else {
                ye.path = null;
            }
            ye.href = ye.format();
            return ye;
        }
        let ps = hs.slice(-1)[0];
        const fs = (ye.host || ae.host || hs.length > 1) && (ps === "." || ps === "..") || ps === "";
        let ks = 0;
        for(let Rs = hs.length; Rs >= 0; Rs--){
            if ((ps = hs[Rs]) === ".") {
                hs.splice(Rs, 1);
            } else if (ps === "..") {
                hs.splice(Rs, 1);
                ks++;
            } else if (ks) {
                hs.splice(Rs, 1);
                ks--;
            }
        }
        if (!ds && !_s) {
            while(ks--){
                hs.unshift("..");
            }
        }
        if (!(!ds || hs[0] === "" || hs[0] && hs[0].charAt(0) === "/")) {
            hs.unshift("");
        }
        if (fs && hs.join("/").substr(-1) !== "/") {
            hs.push("");
        }
        var $s;
        const bs = hs[0] === "" || hs[0] && hs[0].charAt(0) === "/";
        if (vs) {
            ye.hostname = bs ? "" : hs.length ? hs.shift() : "";
            ye.host = ye.hostname;
            if ($s = !!(ye.host && ye.host.indexOf("@") > 0) && ye.host.split("@")) {
                ye.auth = $s.shift();
                ye.hostname = $s.shift();
                ye.host = ye.hostname;
            }
        }
        if ((ds = ds || ye.host && hs.length) && !bs) {
            hs.unshift("");
        }
        if (hs.length > 0) {
            ye.pathname = hs.join("/");
        } else {
            ye.pathname = null;
            ye.path = null;
        }
        if (!(ye.pathname === null && ye.search === null)) {
            ye.path = (ye.pathname ? ye.pathname : "") + (ye.search ? ye.search : "");
        }
        ye.auth = ae.auth || ye.auth;
        ye.slashes = ye.slashes || ae.slashes;
        ye.href = ye.format();
        return ye;
    };
    Url.prototype.parseHost = function() {
        let host = this.host;
        let pe = portPattern.exec(host);
        if (pe) {
            if ((pe = pe[0]) !== ":") {
                this.port = pe.substr(1);
            }
            host = host.substr(0, host.length - pe.length);
        }
        if (host) {
            this.hostname = host;
        }
    };
    parse$1 = urlParse;
    resolve$1 = urlResolve;
    resolveObject = urlResolveObject;
    format = urlFormat;
    Url_1 = Url;
    _globalThis = function(ae) {
        function get() {
            const pe = this || self;
            delete ae.prototype.__magic__;
            return pe;
        }
        if (typeof globalThis === "object") {
            return globalThis;
        }
        if (this) {
            return get();
        }
        ae.defineProperty(ae.prototype, "__magic__", {
            configurable: true,
            get
        });
        return __magic__;
    }(Object);
    formatImport = format;
    parseImport = parse$1;
    resolveImport = resolve$1;
    UrlImport = Url_1;
    URL$2 = _globalThis.URL;
    URLSearchParams$1 = _globalThis.URLSearchParams;
    percentRegEx = /%/g;
    backslashRegEx = /\\/g;
    newlineRegEx = /\n/g;
    carriageReturnRegEx = /\r/g;
    tabRegEx = /\t/g;
    CHAR_FORWARD_SLASH = 47;
    domainToASCII = function domainToASCII(ae) {
        if (ae === undefined) {
            throw new TypeError('The "domain" argument must be specified');
        }
        return new URL$2(`http://${ae}`).hostname;
    };
    domainToUnicode = function domainToUnicode(ae) {
        if (ae === undefined) {
            throw new TypeError('The "domain" argument must be specified');
        }
        return new URL$2(`http://${ae}`).hostname;
    };
    pathToFileURL = function pathToFileURL(ae) {
        const pe = new URL$2("file://");
        let ye = resolve(ae);
        if (ae.charCodeAt(ae.length - 1) === CHAR_FORWARD_SLASH && ye[ye.length - 1] !== "/") {
            ye += "/";
        }
        pe.pathname = encodePathChars(ye);
        return pe;
    };
    fileURLToPath = function fileURLToPath(ae) {
        if (!isURLInstance(ae) && typeof ae !== "string") {
            throw new TypeError(`The "path" argument must be of type string or an instance of URL. Received type ${typeof ae} (${ae})`);
        }
        const pe = new URL$2(ae);
        if (pe.protocol !== "file:") {
            throw new TypeError("The URL must be of scheme file");
        }
        return getPathFromURLPosix(pe);
    };
    api = {
        format: formatImportWithOverloads = function formatImportWithOverloads(ae, pe = {}) {
            let ye;
            let es;
            let ss;
            if (!(ae instanceof URL$2)) {
                return formatImport(ae);
            }
            if (typeof pe !== "object" || pe === null) {
                throw new TypeError('The "options" argument must be of type object.');
            }
            const ns = (ye = pe.auth) == null || ye;
            const ts = (es = pe.fragment) == null || es;
            const rs = (ss = pe.search) == null || ss;
            pe.unicode;
            const os = new URL$2(ae.toString());
            if (!ns) {
                os.username = "";
                os.password = "";
            }
            if (!ts) {
                os.hash = "";
            }
            if (!rs) {
                os.search = "";
            }
            return os.toString();
        },
        parse: parseImport,
        resolve: resolveImport,
        resolveObject,
        Url: UrlImport,
        URL: URL$2,
        URLSearchParams: URLSearchParams$1,
        domainToASCII,
        domainToUnicode,
        pathToFileURL,
        fileURLToPath
    };
});
const init_schemas = __esmMin(()=>{
    import_formats = require_formats();
    EIP3085 = validate14;
    schema16 = {
        $id: "#/definitions/EIP3085",
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        required: [
            "chainId",
            "chainName",
            "nativeCurrency",
            "rpcUrls"
        ],
        errorMessage: {
            _: "Invalid method parameter(s).",
            properties: {
                chainId: "Expected 0x-prefixed, unpadded, non-zero hexadecimal string 'chainId'. Received: ${/chainId}",
                nativeCurrency: "Expected 'nativeCurrency' with a string 'name', a 1-6 character 'symbol' and integer 'decimals' between 0 and 20.",
                rpcUrls: "Expected an array of valid URLs 'rpcUrls'."
            }
        },
        properties: {
            chainId: {
                type: "string",
                pattern: "^0[xX][0-9a-fA-F]+$"
            },
            chainName: {
                type: "string"
            },
            nativeCurrency: {
                type: "object",
                required: [
                    "decimals",
                    "name",
                    "symbol"
                ],
                properties: {
                    name: {
                        type: "string"
                    },
                    symbol: {
                        type: "string",
                        minLength: 1,
                        maxLength: 6
                    },
                    decimals: {
                        type: "number",
                        minimum: 0,
                        maximum: 20
                    }
                }
            },
            rpcUrls: {
                type: "array",
                items: {
                    type: "string",
                    format: "uri"
                },
                nullable: false
            },
            blockExplorerUrls: {
                type: "array",
                items: {
                    type: "string",
                    format: "uri"
                },
                nullable: true
            },
            iconUrls: {
                type: "array",
                items: {
                    type: "string",
                    format: "uri"
                },
                nullable: true
            }
        }
    };
    pattern0 = new RegExp("^0[xX][0-9a-fA-F]+$", "u");
    pattern1 = new RegExp("^/([^/]*)(?:/|$)");
    func2 = function ucs2length(ae) {
        const ae_length = ae.length;
        let ye;
        let es = 0;
        let ss = 0;
        while(ss < ae_length){
            es++;
            ye = ae.charCodeAt(ss++);
            if (ye >= 55296 && ye <= 56319 && ss < ae_length) {
                ye = ae.charCodeAt(ss);
                if ((64512 & ye) == 56320) {
                    ss++;
                }
            }
        }
        return es;
    };
    formats0 = import_formats.fullFormats.uri;
});
const init_EuroIcon = __esmMin(()=>{
    import_jsx_runtime$3 = require_jsx_runtime();
    DEFAULT_WIDTH$2 = 24;
    DEFAULT_HEIGHT$2 = 24;
    EuroIcon = ({ width, height, primaryColorClass, secondaryColorClass })=><svg fill="none" width={width ?? DEFAULT_WIDTH$2} height={height ?? DEFAULT_HEIGHT$2} viewBox={`0 0 ${DEFAULT_WIDTH$2} ${DEFAULT_HEIGHT$2}`} xmlns="http://www.w3.org/2000/svg"><path className={secondaryColorClass} d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z" fill="#1D53AB"/><path className={primaryColorClass} d="M12.4463 18.71C14.6863 18.71 15.9463 17.5375 16.6988 15.945L15.5613 15.1925C15.0538 16.505 13.9863 17.415 12.4463 17.415C10.5913 17.415 9.43626 16.2075 9.13876 14.405H13.6363V13.2325H9.06877V11.5525H13.6363V10.38H9.13876C9.41876 8.57751 10.5738 7.37001 12.4463 7.37001C13.9338 7.37001 14.9838 8.21001 15.4738 9.45251L16.6113 8.75251C15.8413 7.07251 14.4763 6.07501 12.4463 6.07501C9.36627 6.07501 7.54626 8.31501 7.54626 12.3925C7.54626 16.47 9.36627 18.71 12.4463 18.71Z" fill="#F8D33A"/></svg>;
});
const init_PoundIcon = __esmMin(()=>{
    import_jsx_runtime$2 = require_jsx_runtime();
    DEFAULT_WIDTH$1 = 24;
    DEFAULT_HEIGHT$1 = 24;
    PoundIcon = ({ width, height, primaryColorClass, secondaryColorClass })=><svg fill="none" width={width ?? DEFAULT_WIDTH$1} height={height ?? DEFAULT_HEIGHT$1} viewBox={`0 0 ${DEFAULT_WIDTH$1} ${DEFAULT_HEIGHT$1}`} xmlns="http://www.w3.org/2000/svg"><path className={secondaryColorClass} d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z" fill="#0F3679"/><path className={primaryColorClass} d="M16.245 18.25V16.535H10.1025V16.43C10.7675 16.0275 11.4325 15.1 11.4325 13.8225C11.4325 13.595 11.415 13.4025 11.38 13.21H14.495V11.6175H10.855C10.6625 11.0225 10.47 10.445 10.47 9.72751C10.47 8.29251 11.275 7.54001 12.64 7.54001C13.725 7.54001 14.4775 8.01251 15.09 8.90501L16.5425 7.87251C15.7025 6.56001 14.46 5.82501 12.64 5.82501C10.05 5.82501 8.45746 7.31251 8.45746 9.46501C8.45746 10.2875 8.68496 10.9525 8.89496 11.6175H7.70496V13.21H9.43746C9.47246 13.4375 9.50746 13.7 9.50746 13.945C9.50746 14.925 9.10496 15.8175 8.15996 16.2375V18.25H16.245Z" fill="#FFFFFF"/></svg>;
});
const init_UsdIcon = __esmMin(()=>{
    import_jsx_runtime$1 = require_jsx_runtime();
    DEFAULT_WIDTH = 24;
    DEFAULT_HEIGHT = 24;
    UsdIcon = ({ width, height, primaryColorClass, secondaryColorClass })=><svg fill="none" width={width ?? DEFAULT_WIDTH} height={height ?? DEFAULT_HEIGHT} viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`} xmlns="http://www.w3.org/2000/svg"><path className={secondaryColorClass} d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12Z" fill="#F0B90B"/><path className={primaryColorClass} d="M12.8169 19.6851V18.1451C15.0744 17.8651 16.3519 16.5001 16.3519 14.6276C16.3519 12.8076 15.2494 11.8276 12.7119 11.2676V7.6801C13.7094 7.8376 14.4094 8.3276 14.9169 8.9926L16.2119 7.9251C15.4069 6.8926 14.3044 6.2626 12.8169 6.1226V4.6001H11.3294V6.1226C9.2119 6.3501 7.8819 7.4876 7.8819 9.3426C7.8819 11.1101 8.9494 12.1601 11.4519 12.7026V16.6226C10.3494 16.4826 9.5094 15.9226 8.7919 15.0476L7.5144 16.2026C8.3894 17.2526 9.5619 18.0401 11.3294 18.1801V19.6851H12.8169ZM14.5144 14.7501C14.5144 15.7126 13.8494 16.4126 12.7119 16.6051V12.9651C14.0769 13.3151 14.5144 13.8751 14.5144 14.7501ZM9.7019 9.2551C9.7019 8.3801 10.3494 7.8201 11.4519 7.6626V10.9876C10.2619 10.6551 9.7019 10.2176 9.7019 9.2551Z" fill="#14151A"/></svg>;
});
function getRelayQuote(ae) {
    return post("/v1/perps/relay/quote", ae);
}
;
function getRelayWithdrawQuote(ae) {
    return post("/v1/perps/relay/quote", ae);
}
;
var { data } = await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/perps/relay/status`, {
    params: {
        requestId: ae
    }
});
function relayAuthorize(ae) {
    return post("/v1/perps/relay/authorize", ae);
}
;
const init_relayQuote_mapper = __esmMin(()=>{
    init_big();
    init_swaps();
    init_utils$25();
    init_tokens$1();
    init_relayApi();
    RELAY_PROVIDER = {
        id: RELAY_PROVIDER_ID,
        origin: "Relay",
        favIconUrl: "https://assets-cdn.trustwallet.com/blockchains/hypeevm/info/square_logo.png",
        title: "Relay",
        url: "Relay"
    };
    RELAY_QUOTE_REFRESH_INTERVAL_SECONDS = 10;
});
const init_relaySwap_service = __esmMin(()=>{
    init_big();
    init_injectable_decorator();
    init_use_decorator();
    import_trust_sdk$17 = require_trust_sdk();
    init_generic_signing_service();
    init_wallet$2();
    init_sentry();
    init_constants$8();
    init_swaps();
    init_utils$25();
    init_tokens$1();
    init_logger$1();
    init_relayApi();
    init_hlRoute_utils();
    init_relayQuote_mapper();
    init_relayStatusPoller();
    init_relayTxMap();
    init_decorateMetadata();
    init_decorate();
    RelayQuoteRefusalError = class extends Error {
        constructor(ae){
            super(ae);
            this.name = "RelayQuoteRefusalError";
        }
    };
    RELAY_AUTO_SLIPPAGE_PERCENT = "0.5";
    QUOTE_TTL_MS = 60000;
    COMMITTED_QUOTE_TTL_MS = 1800000;
    MIN_DEPOSIT_USD = 1;
    RelaySwapService = class RelaySwapService {
        async onApplicationBoot() {
            installRelayStatusAlarmListener((ae)=>this.getStatus(ae));
            reconcileRelayStatusAlarms().catch((ae)=>logger_default.error("Relay alarm reconciliation failed", ae));
        }
        isRelayQuoteId(ae) {
            return !!ae && ae.startsWith("relay-");
        }
        async getQuote({ assetOut, assetIn, amount, slippage, isMax = false, destinationAddress }) {
            const direction = relayDirectionFor(assetOut, assetIn);
            if (!direction) {
                throw new Error("Not a Relay-routable pair");
            }
            const rs = relayChainFor((direction === "deposit" ? assetOut : assetIn).blockchain.id);
            if (!rs) {
                throw new RelayQuoteRefusalError("This network isn't supported for HYPE Swaps");
            }
            const os = getActiveWalletAccounts();
            const userAddress = os?.[CoinId.Ethereum]?.address;
            if (!userAddress) {
                throw new RelayQuoteRefusalError("No Ethereum account available for the HYPE route");
            }
            const cs = direction === "deposit" && isSolanaRelayChain(rs.relayChainId);
            const us = direction === "withdraw" && isSolanaRelayChain(rs.relayChainId);
            const ls = os?.[CoinId.Solana]?.address;
            if ((cs || us) && !ls) {
                throw new RelayQuoteRefusalError("No Solana account available for the HYPE route");
            }
            if (destinationAddress && !isOwnAddress(destinationAddress, [
                userAddress,
                ls
            ])) {
                throw new RelayQuoteRefusalError("HYPE Swaps can't send to a custom address yet");
            }
            const amount_1 = new Big(amount.value).times(new Big(10).pow(amount.decimals)).toFixed(0, Big.roundDown);
            const gs = direction === "deposit" ? {
                userAddress: cs ? ls : userAddress,
                originChainId: rs.relayChainId,
                originCurrency: assetOut.address || (cs ? "11111111111111111111111111111111" : "0x0000000000000000000000000000000000000000"),
                destinationChainId: 999,
                destinationCurrency: NATIVE_TOKEN_ADDRESS,
                amount: amount_1,
                recipient: cs ? userAddress : undefined
            } : {
                userAddress,
                originChainId: 999,
                originCurrency: NATIVE_TOKEN_ADDRESS,
                destinationChainId: rs.relayChainId,
                destinationCurrency: assetIn.address || (us ? "11111111111111111111111111111111" : "0x0000000000000000000000000000000000000000"),
                amount: amount_1,
                recipient: us ? ls : undefined
            };
            let relayQuote = await this.fetchQuote(direction, gs);
            const _s = !assetOut.address;
            const nativeBalance = this.nativeBalanceOf(assetOut);
            if (isMax && _s) {
                const amount_2 = this.clipMaxAmount(relayQuote, nativeBalance, assetOut);
                if (amount_2) {
                    relayQuote = await this.fetchQuote(direction, {
                        ...gs,
                        amount: amount_2
                    });
                }
            }
            if (!relayQuote.steps.length) {
                throw new Error("Relay returned no execution steps");
            }
            if (direction === "deposit" && Math.round(100 * parseFloat(relayQuote.details.currencyIn.amountUsd || "0")) / 100 < MIN_DEPOSIT_USD) {
                throw new RelayQuoteRefusalError("Minimum amount for HYPE swap is $1.00");
            }
            this.assertExecutableSteps(relayQuote.steps);
            const quoteId = this.mintQuoteId();
            this.pruneQuoteCache();
            this.quoteCache.set(quoteId, {
                relayQuote,
                direction,
                fromAsset: assetOut,
                createdAt: Date.now()
            });
            const spendAmount = formatTokenFrom(relayQuote.details.currencyIn.amount, relayQuote.details.currencyIn.currency.decimals).toFixed();
            return mapRelayQuoteToSwapQuote({
                quoteId,
                relayQuote,
                fromAsset: assetOut,
                toAsset: assetIn,
                slippagePercent: slippage || RELAY_AUTO_SLIPPAGE_PERCENT,
                nativeBalance,
                spendAmount,
                isNativeSpend: _s
            });
        }
        getBuildParams(ae) {
            const pe = this.cached(ae);
            this.commitQuote(ae, pe);
            const { relayQuote } = pe;
            const amount = relayQuote.details.currencyOut.amount;
            const encodedTx = this.solanaStepTxOrNull(relayQuote.steps);
            if (encodedTx) {
                return {
                    kind: "solana",
                    encodedTx,
                    amount: relayQuote.details.currencyIn.amount,
                    toAmount: amount
                };
            }
            const ns = this.mainStepTx(relayQuote.steps);
            return {
                kind: "evm",
                to: ns.to,
                data: ns.data,
                value: ns.value || "0",
                toAmount: amount
            };
        }
        getTransactionPayload(ae) {
            const pe = this.cached(ae);
            this.commitQuote(ae, pe);
            const { relayQuote, fromAsset } = pe;
            const ss = this.solanaStepTxOrNull(relayQuote.steps);
            if (ss) {
                return {
                    to: "",
                    data: ss,
                    isInternal: true,
                    source: RELAY_PROVIDER,
                    mev: false,
                    isEip712: false
                };
            }
            const ns = this.mainStepTx(relayQuote.steps);
            const ts = {
                to: ns.to,
                data: ns.data,
                isInternal: true,
                source: RELAY_PROVIDER,
                mev: false,
                isEip712: false
            };
            if (ns.value && ns.value !== "0") {
                ts.value = formatTokenFrom(ns.value, fromAsset.blockchain.decimals).toFixed();
            }
            return ts;
        }
        recordSwapTransaction(ae, pe) {
            let ye = this.recordInFlight.get(ae);
            if (!ye) {
                ye = this.doRecordSwapTransaction(ae, pe);
                this.recordInFlight.set(ae, ye);
                ye.catch(()=>this.recordInFlight.delete(ae));
            }
            return ye;
        }
        async doRecordSwapTransaction(ae, pe) {
            const ye = this.committedQuotes.get(ae) ?? this.quoteCache.get(ae);
            if (!ye) {
                throw new Error("Relay quote missing after broadcast — bridge status cannot be tracked");
            }
            this.quoteCache.delete(ae);
            const { relayQuote } = ye;
            const requestId = [
                ...relayQuote.steps
            ].reverse().find((ae)=>ae.requestId)?.requestId;
            if (requestId) {
                if (!await lookupRelayTxEntry(pe)) {
                    await recordRelaySwapTx(pe, {
                        requestId,
                        walletId: getActiveWalletId() ?? "",
                        accountId: getActiveAccountId() ?? ""
                    });
                }
                startRelayStatusPolling(pe);
            } else {
                captureException(new Error("Relay quote carries no requestId"), {
                    tags: {
                        feature: "swap",
                        provider: RELAY_PROVIDER.id,
                        stage: "settle"
                    },
                    stage: "settle",
                    provider: RELAY_PROVIDER.id
                });
            }
            for (const ts of relayQuote.steps){
                if (ts.kind === "signature") {
                    for (const ae of ts.items){
                        if (ae.status !== "complete") {
                            try {
                                await this.executeSignatureStep(ae.data.sign, ae.data.post);
                            } catch (error) {
                                captureException(error instanceof Error ? error : new Error(String(error)), {
                                    tags: {
                                        feature: "swap",
                                        provider: RELAY_PROVIDER.id,
                                        stage: "settle"
                                    },
                                    stage: "settle",
                                    provider: RELAY_PROVIDER.id
                                });
                                throw error;
                            }
                        }
                    }
                }
            }
            this.committedQuotes.delete(ae);
        }
        async getStatus(ae) {
            const pe = await lookupRelayRequestId(ae);
            if (!pe) {
                return null;
            }
            try {
                const phase = classifyRelayStatus(await getRelayStatus(pe));
                if (phase === "failed") {
                    return {
                        phase,
                        message: RELAY_BRIDGE_FAILED_MESSAGE
                    };
                }
                return {
                    phase
                };
            } catch (error) {
                logger_default.warn("Relay status check failed; reporting pending", error);
                return {
                    phase: "pending"
                };
            }
        }
        fetchQuote(ae, pe) {
            if (ae === "deposit") {
                return getRelayQuote(pe);
            }
            return getRelayWithdrawQuote(pe);
        }
        nativeBalanceOf(ae) {
            return getBalance$2(getAssetId({
                coinId: ae.blockchain.coinId
            }))?.balance || "0";
        }
        clipMaxAmount(ae, pe, ye) {
            let es;
            let ss;
            const chainId = ae.details.currencyIn.currency.chainId;
            const ts = isOriginNativeRelayFee(ae.fees.gas, chainId) ? ae.fees.gas.amount : "0";
            const rs = this.mainStepTxOrNull(ae.steps);
            if (rs) {
                es = new Big(rs.value || "0");
                ss = new Big(rs.gas || "0").times(new Big(rs.maxFeePerGas || "0"));
                if (ss.lte(0)) {
                    ss = new Big(ts || "0");
                }
            } else {
                if (!this.solanaStepTxOrNull(ae.steps)) {
                    return null;
                }
                es = new Big(ae.details.currencyIn.amount);
                ss = new Big(900880).plus(new Big(ts || "0"));
            }
            const os = new Big(pe).times(new Big(10).pow(ye.blockchain.decimals));
            if (es.plus(ss).lte(os) || es.lte(0)) {
                return null;
            }
            const as = ss.div(100);
            const cs = os.minus(ss).minus(as);
            if (cs.lte(0)) {
                return null;
            }
            const us = new Big(ae.details.currencyIn.amount);
            const ls = cs.times(us).div(es);
            if (ls.lte(0)) {
                return null;
            }
            return ls.toFixed(0, Big.roundDown);
        }
        assertExecutableSteps(ae) {
            const pe = ae.filter((ae)=>ae.kind === "transaction" && ae.id !== "approve");
            if (pe.length !== 1) {
                throw new Error(`Unsupported Relay route shape: ${pe.length} transaction steps`);
            }
            const ye = ae.findIndex((ae)=>ae.kind === "transaction" && ae.id !== "approve");
            const es = ae.findIndex((ae)=>ae.kind === "signature");
            if (es !== -1 && es < ye) {
                throw new Error("Unsupported Relay route shape: signature step before the transaction");
            }
            const ss = pe[0]?.items?.[0]?.data;
            if (!ss || !ss.to && !ss.encoded_tx) {
                throw new Error("Unsupported Relay route shape: transaction step carries no tx");
            }
            if (ae.some((ae)=>ae.items.some((ae)=>ae.data.eip712Types))) {
                throw new Error("Unsupported Relay route shape: HL exchange-action step");
            }
        }
        mainStepTx(ae) {
            const pe = this.mainStepTxOrNull(ae);
            if (!pe) {
                throw new Error("Relay quote has no transaction step");
            }
            return pe;
        }
        mainStepTxOrNull(ae) {
            const pe = ae.find((ae)=>ae.kind === "transaction" && ae.id !== "approve")?.items?.[0]?.data;
            if (pe?.to && pe?.chainId !== undefined) {
                return pe;
            }
            return null;
        }
        solanaStepTxOrNull(ae) {
            return ae.find((ae)=>ae.kind === "transaction" && ae.id !== "approve")?.items?.[0]?.data?.encoded_tx ?? null;
        }
        async executeSignatureStep(ae, pe) {
            if (!ae || !pe?.endpoint) {
                throw new Error("Malformed Relay signature step");
            }
            const ye = buildEip712Params(ae);
            const es = await this.genericSigningService.signMessage({
                coinId: CoinId.Ethereum,
                signingCoinId: CoinId.Ethereum,
                message: JSON.stringify(ye),
                messageType: import_trust_sdk$17.MessageType.TypedMessage
            });
            let relayEndpoint;
            if (/^[a-z][a-z0-9+.-]*:/i.test(pe.endpoint)) {
                if (!pe.endpoint.startsWith("https://api.relay.link/")) {
                    throw new Error("Refusing Relay authorize endpoint outside api.relay.link");
                }
                relayEndpoint = pe.endpoint;
            } else {
                relayEndpoint = `https://api.relay.link${pe.endpoint.startsWith("/") ? "" : "/"}${pe.endpoint}`;
            }
            await relayAuthorize({
                signature: es,
                relayEndpoint,
                body: pe.body
            });
        }
        cached(ae) {
            const pe = this.quoteCache.get(ae);
            if (!pe || Date.now() - pe.createdAt > QUOTE_TTL_MS) {
                this.quoteCache.delete(ae);
                throw new Error(RELAY_QUOTE_EXPIRED_MESSAGE);
            }
            return pe;
        }
        commitQuote(ae, pe) {
            this.committedQuotes.set(ae, pe);
        }
        pruneQuoteCache() {
            const ae = Date.now();
            for (const [pe, ye] of this.quoteCache){
                if (ae - ye.createdAt > QUOTE_TTL_MS) {
                    this.quoteCache.delete(pe);
                }
            }
            for (const [pe, ye] of this.committedQuotes){
                if (ae - ye.createdAt > COMMITTED_QUOTE_TTL_MS) {
                    this.committedQuotes.delete(pe);
                }
            }
        }
        mintQuoteId() {
            return `${RELAY_QUOTE_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        constructor(){
            this.quoteCache = new Map;
            this.committedQuotes = new Map;
            this.recordInFlight = new Map;
        }
    };
    __decorate([
        Use(GenericSigningService),
        __decorateMetadata("design:type", GenericSigningService === undefined ? Object : GenericSigningService)
    ], RelaySwapService.prototype, "genericSigningService", undefined);
    RelaySwapService = __decorate([
        Injectable()
    ], RelaySwapService);
});
const init_swap_service = __esmMin(()=>{
    init_blockchains$1();
    init_fiat();
    init_wallet$2();
    init_api_service();
    init_balance_service();
    init_blockchain$2();
    init_sentry();
    init_amberSwapHistory();
    init_ticker_service();
    init_wallet_service();
    init_walletkit_service();
    init_swaps();
    init_axios();
    init_app();
    init_iSwapSettings();
    init_proactiveQuote_mapper();
    init_swapQuoteSession_service();
    init_amberQuoteSession();
    init_codes$4();
    init_orderSubmission_utils();
    init_utils$25();
    init_relaySwap_service();
    init_relayApi();
    init_hlRoute_utils();
    init_amberRouteConfigTap();
    init_tokens$1();
    init_logger$1();
    init_swapFees_utils();
    init_injectable_decorator();
    init_priority_decorator();
    init_use_decorator();
    import_trust_sdk$15 = require_trust_sdk();
    init_big();
    init_swap();
    init_walletType_enum();
    init_blockchain_service();
    init_stepRepository_utils();
    init_maxSwapAmount_utils();
    init_amountTooSmall();
    init_utxoSwapFee_utils();
    init_transientNetworkRetry_utils();
    init_quoteUnderfunded_utils();
    init_expectedAmberOutcome_utils();
    init_selectSwapRoute_utils();
    init_priceImpactLevels_utils();
    init_successTtlCache();
    init_swapCapabilityFingerprint();
    init_decorateMetadata();
    init_decorate();
    _SwapService = class SwapService {
        static allowMaxApproval() {
            return getSwapSetting("unlimitedAllowance") === true;
        }
        getSharedStep(ae, pe, ye, es = {}) {
            return this.getSharedStepWithMeta(ae, pe, ye, es).then(({ step })=>step);
        }
        getSharedStepWithMeta(ae, pe, ye, { variant, preferFresh } = {}) {
            return this.stepRepository.getStepWithMeta(`${ye}|${variant ?? ""}`, ()=>retryOnTransientNetworkError(()=>this.walletKitService.AmberService.getStep(ae, pe, ye)), {
                preferFresh
            });
        }
        async getSupportedDomains() {
            const ae = getActiveWallet();
            const pe = getActiveWalletAccounts();
            const ye = Object.values(pe ?? {}).map((ae)=>ae.coin);
            const es = getSwapCapabilityFingerprint(ae?.type, ye);
            return this.supportedDomainsCache.get(es, async ()=>{
                const pe = getBlockchainsByPrefixedCoinId();
                const es = await this.amberDomains();
                const ss = new Set(ye);
                const walletHasAccountFor = (pe)=>{
                    if (ae?.type !== WalletType.PRIVATE_KEY && ae?.type !== WalletType.HARDWARE) {
                        return !!pe;
                    }
                    return pe !== undefined && ss.has(pe.coinId);
                };
                const ns = es.filter((ae)=>{
                    const ye = pe[getPrefixedCoinId(ae.coin.value)];
                    return ye?.id !== Blockchain.fantom && walletHasAccountFor(ye);
                }).map((ae)=>getPrefixedCoinId(ae.coin.value));
                if (!ns.includes("c10000999") && walletHasAccountFor(pe.c10000999)) {
                    ns.push(HL_HYPE_ASSET_ID);
                }
                return ns;
            });
        }
        getPairTokenList(blockchainId) {
            return this.pairTokenListCache.get(blockchainId, async ()=>{
                try {
                    return (await this.apiService.getSwapPairsForBlockchain(blockchainId))?.data?.tokens ?? [];
                } catch (error) {
                    if (isAxiosError(error) && error.response?.status === 404) {
                        logger_default.debug("No swap pairs for blockchain", {
                            blockchainId
                        });
                        return [];
                    }
                    throw error;
                }
            });
        }
        async getPairsForBlockchainCoinIds(ae) {
            const pe = getCombinedBalances();
            const ye = getBlockchainsByPrefixedCoinId();
            const es = [];
            for(const ts in ye){
                if (ae.includes(ts)) {
                    es.push(ye[ts]);
                }
            }
            const ss = await Promise.all(es.map(async (blockchain_1)=>{
                try {
                    return {
                        blockchain: blockchain_1,
                        list: await this.getPairTokenList(blockchain_1.id),
                        failed: false
                    };
                } catch (pe) {
                    logger_default.debug("Swap pairs unavailable for blockchain", {
                        blockchainId: blockchain_1.id
                    });
                    return {
                        blockchain: blockchain_1,
                        list: [],
                        failed: true
                    };
                }
            }));
            const pairs = {};
            for (const { blockchain, list } of ss){
                if (!pairs[blockchain.id]) {
                    pairs[blockchain.id] = [];
                }
                for (const ae of list){
                    pairs[blockchain.id].push({
                        name: ae.name,
                        address: ae.address,
                        symbol: ae.symbol,
                        type: ae.type,
                        decimals: ae.decimals,
                        iconUrl: ae.logoURI,
                        balance: pe[ae.asset] || "0",
                        fiat: getFiat(ae.asset),
                        assetId: ae.asset,
                        blockchainId: blockchain.id,
                        blockchain
                    });
                }
            }
            return {
                pairs,
                failedBlockchainIds: ss.filter(({ failed })=>failed).map(({ blockchain })=>blockchain.id)
            };
        }
        async getSettlementStatus(ae) {
            try {
                const { data } = await this.apiService.getSwapSettlementStatus(ae);
                return toSettlementCheck(data);
            } catch (error) {
                logger_default.debug("[swap-settlement] status check failed; still pending", error);
                return {
                    outcome: "pending"
                };
            }
        }
        async getQuote({ assetOut, assetIn, amount, slippage, destinationAddress, frontendSource = "swaps", isMax = false, preferredProviderId, enforceProvider = false, sessionStepId, excludeIntentRoutes = false }) {
            if (isHlBridgeRoute(assetOut, assetIn)) {
                try {
                    return await this.relaySwapService.getQuote({
                        assetOut,
                        assetIn,
                        amount,
                        slippage: slippage ?? null,
                        isMax,
                        destinationAddress
                    });
                } catch (error) {
                    logger_default.error(error);
                    if (error instanceof RelayQuoteRefusalError) {
                        throw new Error(FAILED_AMBER_RPC_ERROR + error.message);
                    }
                    if (error instanceof RelayApiError) {
                        if ((error.status ?? 0) >= 400 && (error.status ?? 0) < 500 && error.message) {
                            throw new Error(FAILED_AMBER_RPC_ERROR + error.message.slice(0, 140));
                        }
                        throw new Error(FAILED_QUOTE_GENERATION);
                    }
                    captureException(error instanceof Error ? error : new Error(String(error)), {
                        tags: {
                            feature: "swap",
                            stage: "quote",
                            provider: RELAY_PROVIDER_ID,
                            chain: assetOut?.blockchain?.id
                        },
                        stage: "quote",
                        assetOut: assetOut?.symbol,
                        assetIn: assetIn?.symbol
                    });
                    throw new Error(FAILED_QUOTE_GENERATION);
                }
            }
            if (assetOut.blockchain.id === Blockchain.hyperevm || assetIn.blockchain.id === Blockchain.hyperevm) {
                throw new Error(FAILED_AMBER_UNSUPPORTED_PAIR);
            }
            let isMax_1 = false;
            try {
                const ls = getBalance$2(getAssetId({
                    coinId: assetOut.blockchain.coinId
                }));
                const fromAsset = await this.getWalletSwapAsset(assetOut);
                const toAsset = await this.getWalletSwapAsset(assetIn, destinationAddress);
                const ds = !("contract" in fromAsset);
                const _s = new import_trust_sdk$15.AmberSettings(getSwapSetting("thorchainStreams"), getSwapSetting("solanaTurboSwaps") ? import_trust_sdk$15.SolanaSwapFeeSettings.Turbo : import_trust_sdk$15.SolanaSwapFeeSettings.Fast);
                let amountIn = this.transformAmountToBigInt(amount);
                let spendValue = amount.value;
                if (isMax && ds) {
                    amountIn = deductFeeFromMaxAmount(amountIn, await this.estimateDefaultFee(fromAsset, toAsset, amountIn, assetOut.blockchain.id));
                    spendValue = formatTokenFrom(amountIn.toString(), amount.decimals).toFixed();
                    isMax_1 = true;
                }
                const ps = isMax && ds;
                const canPayGasInTokens = canPayGasInTokensForQuote({
                    spendChainId: assetOut.blockchain.id,
                    chainsSupporting7702: BlockchainService.getBlockchainsSupporting7702(),
                    isHardwareWallet: isHardwareWallet()
                });
                const ks = ps || canPayGasInTokens ? Promise.resolve(null) : this.estimateDefaultFee(fromAsset, toAsset, amountIn, assetOut.blockchain.id);
                const sessionQuote = async (slippage_2)=>{
                    if (!this.proactiveQuotesEnabled()) {
                        return null;
                    }
                    if (excludeIntentRoutes) {
                        logger_default.debug("[swap-route] intent order in flight for this token; polling instead", {
                            assetId: assetOut.assetId
                        });
                        return null;
                    }
                    const es = await this.getProactiveQuote({
                        fromAsset,
                        toAsset,
                        amountIn,
                        slippage: slippage_2,
                        frontendSource,
                        preferredProviderId,
                        enforceProvider,
                        sessionStepId,
                        assetOut,
                        assetIn
                    });
                    if (!es) {
                        return null;
                    }
                    const ss = effectiveNetworkFee(toHumanNetworkFee(await ks, assetOut.blockchain.decimals), {
                        isNativeSpend: ds,
                        spendChainId: assetOut.blockchain.id,
                        isMax,
                        canPayGasInTokens,
                        spendValue,
                        nativeBalance: ls?.balance ?? "0",
                        nativeDecimals: assetOut.blockchain.decimals
                    });
                    es.networkFeeSource = ss.source;
                    es.insufficientBalance = isQuoteUnderfunded({
                        isNativeSpend: ds,
                        isMax,
                        spendValue,
                        routingFeesTotal: Big(nativeFeeTotal(es.fees.routing.breakdown, `c${assetOut.blockchain.coinId}`)),
                        estimatedNetworkFee: ss.value,
                        canPayGasInTokens,
                        nativeBalance: ls?.balance ?? "0"
                    });
                    return es;
                };
                const Rs = await sessionQuote(parseUserSlippagePercent(slippage));
                if (Rs) {
                    return Rs;
                }
                const { routes, config } = await this.walletKitService.AmberService.getRoutes(fromAsset, toAsset, amountIn, slippage ? parseFloat(slippage) : null, _SwapService1.allowMaxApproval(), import_trust_sdk$15.AmberRouteSort.Quantity, _s, preferredProviderId ? [
                    preferredProviderId
                ] : [], [], this.supportsEip712Routes() && !excludeIntentRoutes, frontendSource);
                const Ms = selectSwapRoute(routes, preferredProviderId);
                const { approval, id, priceImpact, priceInfo, provider, providerFees, slippage: slippage_1, to: { amount: amount_1, minAmountOut } } = Ms.steps[0];
                const xs = config;
                const qs = await getTappedPriceImpactLevels();
                const zs = {
                    networkFee: null,
                    id,
                    receiveAmount: formatTokenFrom(amount_1.toString(), assetIn.decimals).toFixed(5),
                    minimumAmount: formatTokenFrom(minAmountOut.toString(), assetIn.decimals).toFixed(5),
                    priceImpact: new Big(priceImpact).toFixed(2),
                    exchangeRate: {
                        fromAsset: {
                            symbol: assetOut.symbol,
                            amount: "1"
                        },
                        toAsset: {
                            symbol: assetIn.symbol,
                            amount: Number(priceInfo).toFixed(5)
                        }
                    },
                    approval: approval ? {
                        contract: approval.to,
                        data: approval.encodedApprove
                    } : null,
                    fees: {
                        approvalNetwork: {
                            breakdown: [],
                            total: 0
                        },
                        provider: {
                            breakdown: [],
                            total: 0
                        },
                        relayer: {
                            breakdown: [],
                            total: 0
                        },
                        routing: {
                            breakdown: [],
                            total: 0
                        }
                    },
                    provider: {
                        id: provider.id,
                        origin: provider.name,
                        favIconUrl: provider.logoUrl,
                        title: provider.name,
                        url: provider.name
                    },
                    slippage: slippage_1.toString(),
                    insufficientBalance: false,
                    networkFeeSource: "none",
                    warnings: Ms.warnings,
                    refreshInterval: parseInt(config.refreshInterval),
                    quoteSource: "route",
                    priceImpactMediumLevel: parsePriceImpactLevel(xs.priceImpactMediumLevel) || qs.medium,
                    priceImpactHighLevel: parsePriceImpactLevel(xs.priceImpactHighLevel) || qs.high
                };
                if (providerFees) {
                    const { providerFees: providerFees_1, relayerFees, routingFees, approvalNetworkFees, unmatched } = classifyProviderFees(providerFees);
                    if (unmatched.length) {
                        logger_default.warn("Unrecognized swap provider fee name(s), folding into provider bucket:", unmatched.map((ae)=>ae.name));
                    }
                    const sumAmounts = (breakdown)=>breakdown.reduce((acc, item)=>acc + parseFloat(item.amount), 0);
                    zs.fees.provider.breakdown = await this.transformFees(providerFees_1);
                    zs.fees.provider.total = sumAmounts(zs.fees.provider.breakdown);
                    zs.fees.relayer.breakdown = await this.transformFees(relayerFees);
                    zs.fees.relayer.total = sumAmounts(zs.fees.relayer.breakdown);
                    zs.fees.routing.breakdown = await this.transformFees(routingFees);
                    zs.fees.routing.total = sumAmounts(zs.fees.routing.breakdown);
                    zs.fees.approvalNetwork.breakdown = await this.transformFees(approvalNetworkFees);
                    zs.fees.approvalNetwork.total = sumAmounts(zs.fees.approvalNetwork.breakdown);
                }
                const Ns = `c${assetOut.blockchain.coinId}`;
                const routingFeesTotal = Big(nativeFeeTotal(zs.fees.routing.breakdown, Ns));
                const Ds = toHumanNetworkFee(await ks, assetOut.blockchain.decimals);
                const Bs = effectiveNetworkFee(Ds, {
                    isNativeSpend: ds,
                    spendChainId: assetOut.blockchain.id,
                    isMax,
                    canPayGasInTokens,
                    spendValue,
                    nativeBalance: ls?.balance ?? "0",
                    nativeDecimals: assetOut.blockchain.decimals
                });
                zs.networkFeeSource = Bs.source;
                zs.insufficientBalance = isQuoteUnderfunded({
                    isNativeSpend: ds,
                    isMax,
                    spendValue,
                    routingFeesTotal,
                    estimatedNetworkFee: Bs.value,
                    canPayGasInTokens,
                    nativeBalance: ls?.balance ?? "0"
                });
                if (isDebugEnabled()) {
                    logger_default.debug(`[swap-fee-gate] ${assetOut.blockchain.id} ${assetOut.symbol}->${assetIn.symbol} native=${ds} max=${isMax} gasInTokens=${canPayGasInTokens} spend=${spendValue} nativeBalance=${ls?.balance ?? "0"} routingNative=${routingFeesTotal.toFixed()} estimate=${Ds} required=${Bs.value} source=${Bs.source} INSUFFICIENT=${zs.insufficientBalance}`);
                }
                if (Bs.source === "max_reserve_cap") {
                    logger_default.warn(`[swap-fee-gate] local network-fee estimate ${Ds} exceeded the Max reserve ${Bs.value} on ${assetOut.blockchain.id} — clamped`);
                }
                return zs;
            } catch (error) {
                logger_default.error(error);
                const es = expectedAmberOutcomeCode(error);
                if (es) {
                    throw new Error(es);
                }
                if (error instanceof Error && error.message === "FAILED_MAX_AMOUNT_BELOW_FEES") {
                    throw error;
                }
                if (!isExpectedAmberOutcome(error)) {
                    captureException(error instanceof Error ? error : new Error(String(error)), {
                        tags: {
                            feature: "swap",
                            stage: "quote",
                            chain: assetOut?.blockchain?.id
                        },
                        stage: "quote",
                        assetOut: assetOut?.symbol,
                        assetIn: assetIn?.symbol
                    });
                }
                if (error instanceof import_trust_sdk$15.AmberRpcError) {
                    const pe = error.code === "amount_too_small" ? lastAmountIn(error.message ?? "") : null;
                    const es = Boolean(pe?.unit && pe.unit.toUpperCase() !== assetOut.symbol.toUpperCase());
                    if (error.code === "amount_too_small" && !es) {
                        throw new Error(encodeAmountTooSmall({
                            symbol: assetOut.symbol,
                            minimum: pe?.value ?? null,
                            isMax: isMax_1
                        }));
                    }
                    throw new Error(FAILED_AMBER_RPC_ERROR + error.message);
                }
                throw new Error(FAILED_QUOTE_GENERATION);
            }
        }
        async getApprovalTransactionPayload({ approval, provider }) {
            try {
                return {
                    to: approval.contract,
                    isInternal: true,
                    data: approval.data,
                    source: provider
                };
            } catch (error) {
                logger_default.error(error);
                captureException(error instanceof Error ? error : new Error(String(error)), {
                    tags: {
                        feature: "swap",
                        stage: "approval-payload"
                    },
                    stage: "approval-payload",
                    provider: provider?.id
                });
                throw new Error(`${FAILED_APPROVAL_TRANSACTION_PAYLOAD_GENERATION}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
            }
        }
        async getSwapTransactionPayload({ id, assetOut, assetIn, provider }) {
            if (this.relaySwapService.isRelayQuoteId(id)) {
                try {
                    return this.relaySwapService.getTransactionPayload(id);
                } catch (error) {
                    logger_default.error(error);
                    captureException(error instanceof Error ? error : new Error(String(error)), {
                        tags: {
                            feature: "swap",
                            stage: "transaction-payload",
                            provider: RELAY_PROVIDER_ID,
                            chain: assetOut?.blockchain?.id
                        },
                        stage: "transaction-payload",
                        assetOut: assetOut?.symbol,
                        assetIn: assetIn?.symbol
                    });
                    throw new Error(`${FAILED_SWAP_TRANSACTION_PAYLOAD_GENERATION}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
                }
            }
            try {
                const ss = await this.getWalletSwapAsset(assetOut);
                const ns = await this.getWalletSwapAsset(assetIn);
                if (this.quoteSessionService.isSessionStep(id)) {
                    this.quoteSessionService.commit(id);
                }
                const { transaction } = await this.getSharedStep(ss, ns, id);
                const { to, meta, amount, isEip712 } = transaction;
                const us = {
                    to,
                    data: meta,
                    isInternal: true,
                    source: provider,
                    mev: this.isMevEnabled(assetOut),
                    isEip712
                };
                if (amount) {
                    us.value = formatTokenFrom(amount, assetOut.blockchain.decimals).toFixed();
                }
                return us;
            } catch (error) {
                logger_default.error(error);
                if (!isExpectedAmberOutcome(error)) {
                    captureException(error instanceof Error ? error : new Error(String(error)), {
                        tags: {
                            feature: "swap",
                            stage: "transaction-payload",
                            chain: assetOut?.blockchain?.id
                        },
                        stage: "transaction-payload",
                        assetOut: assetOut?.symbol,
                        assetIn: assetIn?.symbol
                    });
                }
                throw new Error(`${FAILED_SWAP_TRANSACTION_PAYLOAD_GENERATION}: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
            }
        }
        async getAssetBalance(ae) {
            let balance;
            const ye = getBalance$2(ae.assetId);
            let price;
            balance = ye === undefined ? (await this.balanceService.fetchBalance(ae.blockchain.id, ae.address, ae.decimals, ae))?.balance.toString() ?? "0" : ye.balance;
            const ss = getFiat(ae.assetId);
            price = ss === undefined ? (await this.tickerService.fetchTicker(ae.assetId, true))?.[0]?.price?.toString() ?? "0" : ss.price.toString();
            return {
                balance,
                price
            };
        }
        proactiveQuotesEnabled() {
            return getSwapSetting("environment") !== SWAP_ENVIRONMENT.STAGING;
        }
        amberDomains() {
            return this.amberDomainsCache.get("amber", ()=>this.walletKitService.AmberService.getDomains());
        }
        async getProactiveQuote({ fromAsset, toAsset, amountIn, slippage, frontendSource, preferredProviderId, enforceProvider = false, sessionStepId, assetOut, assetIn }) {
            try {
                const device_id = getDeviceId();
                if (!device_id) {
                    return null;
                }
                const us = await this.amberDomains();
                const domainFor = (ae)=>us.find((pe)=>pe.coin.value === ae.account.coin.value);
                const ls = domainFor(fromAsset);
                const ms = domainFor(toAsset);
                if (!ls || !ms) {
                    return null;
                }
                const gs = {
                    from_asset: wireAssetFor(fromAsset.account.coin.value, "contract" in fromAsset ? fromAsset.contract : undefined),
                    from_address: fromAsset.account.address,
                    from_domain: ls.id,
                    amount: amountIn.toString(),
                    ...slippage === null ? {} : {
                        slippage
                    },
                    to_asset: wireAssetFor(toAsset.account.coin.value, "contract" in toAsset ? toAsset.contract : undefined),
                    to_address: toAsset.account.address,
                    to_domain: ms.id,
                    frontend_source: frontendSource,
                    device_id
                };
                const ds = preferredProviderId ? enforceProvider ? {
                    enforced_providers: [
                        preferredProviderId
                    ]
                } : {
                    preferred_providers: [
                        preferredProviderId
                    ]
                } : undefined;
                const { winner, config } = await this.quoteSessionService.quote(gs, ds, {
                    stepId: sessionStepId
                });
                const vs = parseDurationMs(config.quoteChangeTtl) ?? SwapQuoteSessionService.DEFAULT_QUOTE_CHANGE_MS;
                const ps = await getTappedPriceImpactLevels();
                const { quote, unmatchedFeeNames } = mapProactiveWinner(winner, {
                    spendAsset: assetOut,
                    receiveAsset: assetIn,
                    coinForDomain: (ae)=>us.find((pe)=>pe.id === ae)?.coin.value,
                    refreshIntervalSec: Math.max(1, Math.ceil(vs / 1000)),
                    unlimitedApproval: _SwapService1.allowMaxApproval(),
                    priceImpactMediumLevel: parsePriceImpactLevel(config.priceImpactMediumLevel) || ps.medium,
                    priceImpactHighLevel: parsePriceImpactLevel(config.priceImpactHighLevel) || ps.high
                });
                if (unmatchedFeeNames.length) {
                    logger_default.warn("Unrecognized swap provider fee name(s), folding into provider bucket:", unmatchedFeeNames);
                }
                if ((winner.quote.approvalRequired ?? Boolean(winner.quote.approval)) && winner.quote.approval && !quote.approval) {
                    quote.approval = await this.resolveSessionApproval(fromAsset, toAsset, winner);
                }
                return quote;
            } catch (error) {
                if (error instanceof ProactiveQuoteError) {
                    logger_default.debug(`Proactive quote unavailable (${error.reason}); polling`, error.detail);
                } else {
                    logger_default.debug("Proactive quote failed; polling", error);
                }
                return null;
            }
        }
        async resolveSessionApproval(ae, pe, ye) {
            const es = `${ye.quote.from.asset.address}|${ye.quote.approval?.operatorAddress ?? ""}`;
            const ss = this.sessionApprovalCache.get(es);
            if (ss) {
                return ss;
            }
            try {
                const { transaction } = await this.getSharedStep(ae, pe, ye.quote.id);
                const { swapApproveCallData } = transaction;
                const contract = "contract" in ae ? ae.contract : null;
                const rs = swapApproveCallData && contract ? {
                    contract,
                    data: swapApproveCallData
                } : null;
                if (rs) {
                    this.sessionApprovalCache.set(es, rs);
                }
                return rs;
            } catch (error) {
                logger_default.debug("Could not resolve session approval from the SDK step", error);
                return null;
            }
        }
        async getWalletSwapAsset(ae, pe) {
            let ye = await this.walletService.createWalletKitAccount({
                coinId: getCoinId(ae.assetId, true),
                blockchainId: ae.blockchainId,
                blockchain: ae.blockchain
            });
            if (pe) {
                ye = ye.copy(pe);
            }
            return this.walletService.createWalletKitAsset(ae, ye, ae.blockchainId);
        }
        async recordSwapTransaction(ae, pe) {
            if (this.relaySwapService.isRelayQuoteId(ae)) {
                await this.relaySwapService.recordSwapTransaction(ae, pe);
            } else {
                await this.walletKitService.AmberService.createTransaction(ae, pe);
            }
        }
        supportsEip712Routes() {
            return typeof this.getAmberSubmitTransaction() === "function";
        }
        getAmberSubmitTransaction() {
            return this.walletKitService.AmberService.submitTransaction;
        }
        async submitSwapTransaction(stepId, pe) {
            const ye = this.getAmberSubmitTransaction();
            if (!ye) {
                throw new Error(`${FAILED_SWAP_ORDER_SUBMISSION}: AmberService.submitTransaction is not exported by this SDK build`);
            }
            const es = pe.startsWith("0x") ? pe : `0x${pe}`;
            let ss = null;
            for(let ts = 0; ts <= ORDER_SUBMISSION_BACKOFF_MS.length; ts += 1){
                try {
                    return await ye.call(this.walletKitService.AmberService, stepId, es);
                } catch (error) {
                    ss = describeSubmissionFailure(error);
                    const backoffMs = ORDER_SUBMISSION_BACKOFF_MS[ts];
                    if (!ss.isTransient || backoffMs === undefined) {
                        break;
                    }
                    logger_default.debug("[swap-submit] provider declined for now; retrying", {
                        stepId,
                        code: ss.code,
                        traceId: ss.traceId,
                        attempt: ts + 1,
                        backoffMs
                    });
                    await new Promise((resolve)=>setTimeout(resolve, backoffMs));
                }
            }
            const ns = ss ?? {
                code: null,
                traceId: null,
                message: "unknown submission failure",
                isTransient: false
            };
            logger_default.error("[swap-submit] order submission failed", ns);
            captureException(new Error(ns.message), {
                tags: {
                    feature: "swap",
                    stage: "broadcast"
                },
                stage: "broadcast",
                stepId,
                providerCode: ns.code,
                providerTraceId: ns.traceId
            });
            throw new Error(`${FAILED_SWAP_ORDER_SUBMISSION}: ${ns.message.slice(0, 200)}`);
        }
        async transformFees(ae) {
            return await Promise.all(ae.map(async ({ asset, amount })=>({
                    amount: formatTokenFrom(amount.toString(), asset.metadata.decimals).toFixed(10),
                    symbol: asset.metadata.symbol,
                    assetId: `c${asset.coin.value}${asset.metadata.isNative ? "" : `_t${asset.contract}`}`
                })));
        }
        getProviderOrigin(ae) {
            if (ae === "rango") {
                return "https://rango.exchange";
            }
            return "https://app.1inch.io";
        }
        transformAmountToBigInt(ae) {
            return BigInt(formatTokenTo(ae.value, ae.decimals).toFixed(0));
        }
        async estimateDefaultFee(ae, pe, ye, es) {
            if (es === Blockchain.tron) {
                return null;
            }
            let ss;
            try {
                const es = new this.walletKitService.TransactionTrade(ae, pe, ye.toString(), null, "", import_trust_sdk$15.MetaType.Unspecified, true, null, null, null, null);
                const ns = await Promise.race([
                    this.walletKitService.BlockchainService.getDefaultFee(es),
                    new Promise((resolve)=>{
                        ss = setTimeout(()=>resolve(null), _SwapService1.DEFAULT_FEE_TIMEOUT_MS);
                    })
                ]);
                if (ns === null) {
                    logger_default.warn("Default network fee estimation timed out, degrading to the no-estimate fallback");
                    return null;
                }
                return BigInt(ns.amount);
            } catch (error) {
                logger_default.warn("Default network fee estimation failed, degrading to the no-estimate fallback", error);
                return null;
            } finally{
                clearTimeout(ss);
            }
        }
        isMevEnabled(ae) {
            return getSwapSetting("mev") && this.supportsMEV(ae.blockchain);
        }
        supportsMEV(ae) {
            return ae.id === Blockchain.ethereum || ae.id === Blockchain.polygon || ae.id === Blockchain.smartchain;
        }
        async swapQuoteSupports7702({ spendAsset, receiveAsset, is7702CrossSwapEnabledByExperiment }) {
            if (is7702CrossSwapEnabledByExperiment || spendAsset?.blockchainId === receiveAsset?.blockchainId) {
                return await this.blockchainService.swapSupportsFeeTokenQuotes(spendAsset?.blockchainId) && !isHardwareWallet();
            }
            return Boolean(is7702CrossSwapEnabledByExperiment);
        }
        constructor(){
            this.stepRepository = createStepRepository();
            this.amberDomainsCache = new SuccessTtlCache(_SwapService1.DOMAINS_CACHE_MS, 1);
            this.supportedDomainsCache = new SuccessTtlCache(_SwapService1.SUPPORTED_DOMAINS_CACHE_MS, 8);
            this.pairTokenListCache = new SuccessTtlCache(_SwapService1.PAIR_TOKEN_LIST_CACHE_MS, 64);
            this.sessionApprovalCache = new Map;
        }
    };
    _SwapService1 = _SwapService;
    _SwapService.DOMAINS_CACHE_MS = 300000;
    _SwapService.SUPPORTED_DOMAINS_CACHE_MS = 1800000;
    _SwapService.PAIR_TOKEN_LIST_CACHE_MS = 3600000;
    _SwapService.DEFAULT_FEE_TIMEOUT_MS = 3000;
    SwapService = _SwapService;
    __decorate([
        Use(ApiService),
        __decorateMetadata("design:type", ApiService === undefined ? Object : ApiService)
    ], SwapService.prototype, "apiService", undefined);
    __decorate([
        Use(WalletService),
        __decorateMetadata("design:type", WalletService === undefined ? Object : WalletService)
    ], SwapService.prototype, "walletService", undefined);
    __decorate([
        Use(BalanceService),
        __decorateMetadata("design:type", BalanceService === undefined ? Object : BalanceService)
    ], SwapService.prototype, "balanceService", undefined);
    __decorate([
        Use(TickerService),
        __decorateMetadata("design:type", TickerService === undefined ? Object : TickerService)
    ], SwapService.prototype, "tickerService", undefined);
    __decorate([
        Use(RelaySwapService),
        __decorateMetadata("design:type", RelaySwapService === undefined ? Object : RelaySwapService)
    ], SwapService.prototype, "relaySwapService", undefined);
    __decorate([
        Use(WalletKitService),
        __decorateMetadata("design:type", WalletKitService === undefined ? Object : WalletKitService)
    ], SwapService.prototype, "walletKitService", undefined);
    __decorate([
        Use(BlockchainService),
        __decorateMetadata("design:type", BlockchainService === undefined ? Object : BlockchainService)
    ], SwapService.prototype, "blockchainService", undefined);
    __decorate([
        Use(SwapQuoteSessionService),
        __decorateMetadata("design:type", SwapQuoteSessionService === undefined ? Object : SwapQuoteSessionService)
    ], SwapService.prototype, "quoteSessionService", undefined);
    SwapService = _SwapService1 = __decorate([
        Injectable(),
        BootPriority(8)
    ], SwapService);
});
const init_translation_service = __esmMin(()=>{
    init_store$1();
    init_settings$2();
    init_injectable_decorator();
    init_priority_decorator();
    init_fetch();
    init_logger$1();
    import_trust_sdk$12 = require_trust_sdk();
    init_retry();
    init_intl_utils();
    init_dist();
    init_decorate();
    TranslationService = class TranslationService {
        onApplicationBoot() {
            store.dispatch(settingsSlice.actions.setLoadingTranslations(false));
            this.refreshTranslations();
        }
        async fetchAndSaveTranslations(language) {
            if (!this.skipFetchingTranslations(language)) {
                store.dispatch(settingsSlice.actions.setLoadingTranslations(true));
                try {
                    const messages = await this.fetchTranslations(language);
                    if (!messages || Object.keys(messages).length === 0) {
                        throw new Error("No translations found");
                    }
                    store.dispatch(settingsSlice.actions.setTranslations({
                        messages
                    }));
                    store.dispatch(settingsSlice.actions.setTranslationsLastFetch({
                        language,
                        timestamp: Date.now()
                    }));
                } catch (pe) {
                    zt.error("Failed to fetch translations, falling back to default language.");
                    const ae = checkLocale();
                    this.changeLanguage(ae);
                } finally{
                    store.dispatch(settingsSlice.actions.setLoadingTranslations(false));
                }
            }
        }
        changeLanguage(ae) {
            store.dispatch(settingsSlice.actions.setLanguage(ae));
            import_trust_sdk$12.FeatureModule.setLocaleCode(ae);
        }
        refreshTranslations() {
            const { settings } = store.getState();
            this.fetchAndSaveTranslations(settings.locale);
        }
        async fetchTranslations(ae) {
            const pe = new Retry(async ()=>(await fetch$2(`${this.btsUrl}/${ae}/${this.btsFilename}`)).data, {
                maxAttempts: this.retryMaxAttempts,
                wait: this.retryInitialWait,
                incrementalWait: true
            });
            try {
                return await pe.run();
            } catch (error) {
                logger_default.error(`Failed to fetch translations after ${this.retryMaxAttempts} attempts`, error);
                throw error;
            }
        }
        skipFetchingTranslations(ae) {
            const { settings } = store.getState();
            return settings.loadingTranslations || !this.staleTranslations(ae);
        }
        staleTranslations(ae) {
            const { settings } = store.getState();
            const ye = settings.translationsLastFetch[ae];
            return !ye || ye <= Date.now() - this.translationsStaleTime;
        }
        constructor(){
            this.btsFilename = "translations";
            this.translationsStaleTime = 600000;
            this.retryMaxAttempts = 5;
            this.retryInitialWait = 200;
            this.btsUrl = "https://bin.bnbstatic.com/api/i18n/-/web/cms/sp/86a37593e";
        }
    };
    TranslationService = __decorate([
        Injectable(),
        BootPriority(9)
    ], TranslationService);
});
const init_ownershipProof_service = __esmMin(()=>{
    init_dist$6();
    init_injectable_decorator();
    init_use_decorator();
    import_crypto_browserify = __toESM(require_crypto_browserify(), 1);
    init_ext_polyfill();
    init_fetch();
    init_storage_service();
    init_vault_service();
    init_wallet_service();
    init_walletcore_service();
    init_generic_signing_service();
    init_api_service();
    import_trust_sdk$1 = require_trust_sdk();
    init_store$1();
    init_api_constants();
    init_decorateMetadata();
    init_decorate();
    PROOF_VERSION = "1.0.0";
    OWNERSHIP_PROOF_API_BASE = `${API_GATEWAY_BASE_URL}/extdata/api`;
    OwnershipProofService = class OwnershipProofService {
        async generateProof(ae) {
            const pe = store.getState();
            const device = this.collectDeviceIdentification(pe);
            const temporal = this.collectTemporalEvidence(pe);
            const behavioral = this.collectBehavioralEvidence(pe);
            const nonce = this.generateNonce();
            const ts = {
                version: PROOF_VERSION,
                generatedAt: Date.now(),
                nonce,
                extensionVersion: polyfill.runtime.getManifest().version,
                device,
                temporal,
                behavioral
            };
            const proofHash = this.hashProofData(ts);
            const os = this.createSignatureMessage(proofHash);
            const as = await this.signProof(os);
            const proof = {
                ...ts,
                signature: as,
                proofHash
            };
            const us = await this.fetchPublicKey();
            const ls = await this.encryptPayload(proof, us);
            return {
                proof,
                submission: await this.submitProof(ls, proof.device.deviceId || "")
            };
        }
        generateNonce() {
            const ae = crypto.getRandomValues(new Uint8Array(32));
            return Array.from(ae).map((ae)=>ae.toString(16).padStart(2, "0")).join("");
        }
        async fetchPublicKey() {
            const { deviceId } = store.getState().app;
            try {
                return (await fetch$2.get(`${OWNERSHIP_PROOF_API_BASE}/public-key`, {
                    headers: {
                        "X-TW-Credential": deviceId || ""
                    }
                })).data.public_key;
            } catch (pe) {
                throw new Error("Failed to fetch public key from server");
            }
        }
        async encryptPayload(ae, pe) {
            const ye = JSON.stringify(ae);
            const es = crypto.getRandomValues(new Uint8Array(32));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ns = await crypto.subtle.importKey("raw", es, {
                name: "AES-GCM"
            }, false, [
                "encrypt"
            ]);
            const ts = (new TextEncoder).encode(ye);
            const rs = await crypto.subtle.encrypt({
                name: "AES-GCM",
                iv
            }, ns, ts);
            const os = await this.importPublicKey(pe);
            const as = await crypto.subtle.encrypt({
                name: "RSA-OAEP"
            }, os, es);
            return {
                data: this.arrayBufferToBase64(rs),
                pk: this.arrayBufferToBase64(as),
                iv: this.arrayBufferToBase64(iv.buffer)
            };
        }
        async importPublicKey(ae) {
            const pe = ae.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replace(/\s/g, "");
            const ye = atob(pe);
            const es = new Uint8Array(ye.length);
            for(let ss = 0; ss < ye.length; ss++){
                es[ss] = ye.charCodeAt(ss);
            }
            return crypto.subtle.importKey("spki", es.buffer, {
                name: "RSA-OAEP",
                hash: "SHA-256"
            }, true, [
                "encrypt"
            ]);
        }
        arrayBufferToBase64(ae) {
            const pe = new Uint8Array(ae);
            let ye = "";
            for(let es = 0; es < pe.length; es++){
                ye += String.fromCharCode(pe[es]);
            }
            return btoa(ye);
        }
        async submitProof(ae, pe) {
            try {
                return {
                    fingerprintId: (await fetch$2.post(`${OWNERSHIP_PROOF_API_BASE}/data`, {
                        pk: ae.pk,
                        data: ae.data,
                        iv: ae.iv
                    }, {
                        headers: {
                            "X-TW-Credential": pe
                        }
                    })).data.uuid,
                    success: true
                };
            } catch (error) {
                return {
                    fingerprintId: "",
                    success: false,
                    error: error.response?.data?.error || `Network error: ${error.message}`
                };
            }
        }
        collectDeviceIdentification(ae) {
            return {
                deviceId: ae.app.deviceId,
                authIdentifier: ae.app.authIdentifier,
                legacyDeviceId: ae.app.legacyDeviceId,
                countryCode: ae.app.countryCode
            };
        }
        collectTemporalEvidence(ae) {
            return {
                firstTime: ae.app.firstTime,
                lastUpdateCheck: ae.app.lastUpdateCheck || 0,
                updateAttempt: ae.app.updateAttempt || null,
                reviewPopup: ae.app.reviewPopup || null,
                newAuthMigrated: ae.app.newAuthMigrated,
                storageVersion: ae.app.storageVersion
            };
        }
        collectAllAddresses(ae) {
            const pe = new Set;
            const ye = new Set;
            const es = new Set;
            const value = this.walletCoreService.CoinType.ethereum.value;
            const value_1 = this.walletCoreService.CoinType.solana.value;
            const value_2 = this.walletCoreService.CoinType.bitcoin.value;
            const rs = ae.wallet?.accountsPerWallet || {};
            Object.values(rs).forEach((ae)=>{
                Object.values(ae).forEach((ae)=>{
                    const rs = ae?.items || {};
                    Object.entries(rs).forEach(([ae, rs])=>{
                        const os = parseInt(ae, 10);
                        const as = rs?.address;
                        if (as) {
                            if (os === value) {
                                pe.add(as.toLowerCase());
                            } else if (os === value_1) {
                                ye.add(as);
                            } else if (os === value_2) {
                                es.add(as);
                            }
                        }
                    });
                });
            });
            return {
                evm: Array.from(pe),
                solana: Array.from(ye),
                bitcoin: Array.from(es),
                totalAddresses: pe.size + ye.size + es.size
            };
        }
        collectDappConnections(ae) {
            const pe = [];
            const ye = ae.dapps?.dapps || {};
            const es = ae.dapps?.connectedDapps || {};
            Object.entries(es).forEach(([ae, es])=>{
                const ss = ye[ae];
                if (Array.isArray(es)) {
                    es.forEach((ye)=>{
                        pe.push({
                            origin: ss?.origin || ae,
                            title: ss?.title,
                            date: ye.date,
                            walletId: ye.walletId,
                            accountId: ye.accountId,
                            address: ye.address,
                            networkId: ye.networkId
                        });
                    });
                }
            });
            pe.sort((ae, pe)=>ae.date - pe.date);
            return pe;
        }
        collectBehavioralEvidence(ae) {
            const addresses = this.collectAllAddresses(ae);
            const dappConnections = this.collectDappConnections(ae);
            const oldestConnectionDate = dappConnections.length > 0 ? dappConnections[0].date : null;
            const ss = ae.wallet?.wallets || {};
            const wallets = Object.values(ss).map((ae)=>({
                    id: ae.id,
                    name: ae.name,
                    isImported: ae.isImported || false,
                    registered: ae.registered || false,
                    seedPhraseBackupRequired: ae.seedPhraseBackupRequired || false
                }));
            return {
                addresses,
                dappConnections,
                dappConnectionsCount: dappConnections.length,
                oldestConnectionDate,
                wallets,
                walletCount: wallets.length
            };
        }
        createSignatureMessage(ae, pe) {
            const ye = [
                "Trust Wallet Ownership Proof",
                `Proof Hash: ${ae}`,
                `Timestamp: ${Date.now()}`
            ];
            if (pe) {
                ye.push(`Challenge: ${pe}`);
            }
            return ye.join("\n");
        }
        async signProof(message) {
            const { walletId, selectedAccountId, accountsPerWallet } = store.getState().wallet;
            if (!walletId || !selectedAccountId) {
                throw new Error("No active wallet or account selected");
            }
            const ss = accountsPerWallet?.[walletId]?.[selectedAccountId]?.items;
            if (!ss) {
                throw new Error("No active account found");
            }
            const value = this.walletCoreService.CoinType.ethereum.value;
            const ts = ss[String(value)];
            if (!ts?.address) {
                throw new Error("No Ethereum address found for active account");
            }
            const rs = await this.signingService.signMessage({
                coinId: value,
                message,
                messageType: import_trust_sdk$1.MessageType.Message
            });
            return {
                signerAddress: ts.address,
                message,
                signature: rs,
                coinType: value
            };
        }
        hashProofData(ae) {
            const pe = JSON.stringify(ae, Object.keys(ae).sort());
            return import_crypto_browserify.createHash("sha256").update(pe).digest("hex");
        }
        verifyProof(ae) {
            const warnings = [];
            let ye = 0;
            try {
                const es = Buffer$1.from(ae, "base64").toString("utf-8");
                const ss = JSON.parse(es);
                const { signature, proofHash, ...rest } = ss;
                const proofHashValid = this.hashProofData(rest) === proofHash;
                if (!proofHashValid) {
                    warnings.push("Proof hash does not match data - possible tampering");
                    ye += 50;
                }
                const deviceIdPresent = !!ss.device.deviceId;
                if (!deviceIdPresent) {
                    warnings.push("No device ID - cannot verify with backend");
                    ye += 20;
                }
                const hasDappConnections = ss.behavioral.dappConnectionsCount > 0;
                if (!hasDappConnections) {
                    warnings.push("CRITICAL: No connected DApps - likely attacker or fresh install");
                    ye += 40;
                }
                const verifiedAt = Date.now();
                const hasOldConnections = !!ss.behavioral.oldestConnectionDate && verifiedAt - ss.behavioral.oldestConnectionDate > 604800000;
                if (hasDappConnections && !hasOldConnections) {
                    warnings.push("DApp connections are very recent (< 1 week)");
                    ye += 20;
                }
                const signatureValid = !!signature.signature && !!signature.signerAddress;
                return {
                    valid: proofHashValid && signatureValid,
                    verifiedAt,
                    checks: {
                        signatureValid,
                        proofHashValid,
                        deviceIdPresent,
                        hasDappConnections,
                        hasOldConnections
                    },
                    warnings,
                    riskScore: Math.min(100, ye)
                };
            } catch (error) {
                return {
                    valid: false,
                    verifiedAt: Date.now(),
                    checks: {
                        signatureValid: false,
                        proofHashValid: false,
                        deviceIdPresent: false,
                        hasDappConnections: false,
                        hasOldConnections: false
                    },
                    warnings: [
                        `Failed to parse or verify proof: ${error.message}`
                    ],
                    riskScore: 100
                };
            }
        }
    };
    __decorate([
        Use(StorageService),
        __decorateMetadata("design:type", StorageService === undefined ? Object : StorageService)
    ], OwnershipProofService.prototype, "storageService", undefined);
    __decorate([
        Use(VaultService),
        __decorateMetadata("design:type", VaultService === undefined ? Object : VaultService)
    ], OwnershipProofService.prototype, "vaultService", undefined);
    __decorate([
        Use(WalletService),
        __decorateMetadata("design:type", WalletService === undefined ? Object : WalletService)
    ], OwnershipProofService.prototype, "walletService", undefined);
    __decorate([
        Use(WalletCoreService),
        __decorateMetadata("design:type", WalletCoreService === undefined ? Object : WalletCoreService)
    ], OwnershipProofService.prototype, "walletCoreService", undefined);
    __decorate([
        Use(GenericSigningService),
        __decorateMetadata("design:type", GenericSigningService === undefined ? Object : GenericSigningService)
    ], OwnershipProofService.prototype, "signingService", undefined);
    __decorate([
        Use(ApiService),
        __decorateMetadata("design:type", ApiService === undefined ? Object : ApiService)
    ], OwnershipProofService.prototype, "apiService", undefined);
    OwnershipProofService = __decorate([
        Injectable()
    ], OwnershipProofService);
});
