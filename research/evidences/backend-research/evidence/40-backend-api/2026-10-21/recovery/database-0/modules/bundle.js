function onSave(ae, pe, ye, es) {
    const ss = new $onSaveCOROUTINE$80(ae, pe, ye, es);
    ss.pa_1 = Ps;
    ss.qa_1 = null;
    return ss.va();
}
;
function initSqlJS(ae) {
    return function invoke(ae, pe) {
        return ae(pe);
    }(pe, {});
}
;
function initChromeDb(ae, pe, ye) {
    const es = new $initChromeDbCOROUTINE$81(ae, pe = pe === Ts ? null : pe, ye);
    es.pa_1 = Ps;
    es.qa_1 = null;
    return es.va();
}
;
function initLocalDb(ae, pe) {
    return function invoke_1(ae) {
        return createInstance(ae, []);
    }(ae.Database);
}
;
function initSqlDriver(ae, pe, ye) {
    const es = new $initSqlDriverCOROUTINE$82(ae, pe, ye);
    es.pa_1 = Ps;
    es.qa_1 = null;
    return es.va();
}
;
function setStorageKey(ae, pe) {
    ae = ae === Ts ? "TrustSDK_DB" : ae;
    const local = chrome.storage.local;
    const ss = {};
    ss[ae] = function compressUtf8(ae) {
        const pe = ye.deflate(ae, new compressUtf8$buffer$1);
        return function toBase64(ae) {
            const pe = btoa(ae.reduce(toBase64$lambda, ""));
            if (pe != null && typeof pe === "string") {
                return pe;
            }
            return Es();
        }(pe instanceof Uint8Array ? pe : Es());
    }(pe);
    local.set(ss);
}
;
function getStorageKey(ae, pe) {
    ae = ae === Ts ? "TrustSDK_DB" : ae;
    const es = chrome;
    return Un(new Promise(function getStorageKey$lambda(ae, pe) {
        return function(es, ss) {
            ae.storage.local.get(pe, function getStorageKey$lambda$lambda(ae, pe) {
                return function(es) {
                    let ss;
                    const ns = es[ae];
                    const ts = ns != null && typeof ns === "string" ? ns : null;
                    ss = ts == null ? null : function decompressUtf8(ae) {
                        const pe = ye;
                        const es = function fromBase64(ae) {
                            const pe = atob(ae);
                            const pe_length = pe.length;
                            const es = pe_length != null && typeof pe_length === "number" ? pe_length : Es();
                            const ss = new Uint8Array(es);
                            let ns = 0;
                            if (ns < es) {
                                do {
                                    const ts = ns;
                                    ns = ns + 1 | 0;
                                    ss[ts] = pe.charCodeAt(ts);
                                }while (ns < es)
                            }
                            return ss;
                        }(ae);
                        const ss = pe.inflate(es, new decompressUtf8$1);
                        if (ss instanceof Uint8Array) {
                            return ss;
                        }
                        return Es();
                    }(ts);
                    pe(ss);
                    return Ps;
                };
            }(pe, es));
            return Ps;
        };
    }(es, ae)), pe);
}
;
