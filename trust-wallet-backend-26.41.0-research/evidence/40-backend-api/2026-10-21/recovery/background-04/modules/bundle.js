Qr(pe, [
    "network/status"
]);
;
Qr(ye, [
    "search/transactions"
]);
;
function TezosNodeRpcClient$getHeadHeader$lambda(ae, pe) {
    Yl(ae, [
        "/chains/main/blocks/head/header"
    ]);
    return cn;
}
;
function TezosNodeRpcClient(ae) {
    Companion_getInstance_26();
    this.s1iz_1 = ae;
}
;
this.t1iz_1 = "https://api.baking-bad.org";
function TezosRpcClient$getHead$lambda(ae) {
    ae.a8g(TezosRpcClient$getHead$lambda$lambda);
    return cn;
}
;
function TezosRpcClient$getHead$lambda$lambda(ae, pe) {
    Yl(ae, [
        "/chains/main/blocks/head"
    ]);
    return cn;
}
;
function TezosRpcClient$getAccountData$lambda(ae) {
    return function(pe) {
        pe.a8g(function TezosRpcClient$getAccountData$lambda$lambda(ae) {
            return function(pe, ye) {
                Yl(pe, [
                    `/chains/main/blocks/head/context/contracts/${ae}`
                ]);
                return cn;
            };
        }(ae));
        return cn;
    };
}
;
function TezosRpcClient$getManagerKey$lambda(ae) {
    return function(pe) {
        pe.a8g(function TezosRpcClient$getManagerKey$lambda$lambda(ae) {
            return function(pe, ye) {
                Yl(pe, [
                    `/chains/main/blocks/head/context/contracts/${ae}/manager_key`
                ]);
                return cn;
            };
        }(ae));
        return cn;
    };
}
;
function TezosRpcClient$forgeOperations$lambda(ae) {
    return function(pe) {
        pe.a8g(function TezosRpcClient$forgeOperations$lambda$lambda(ae) {
            return function(pe, ye) {
                Yl(pe, [
                    "/chains/main/blocks/head/helpers/forge/operations"
                ]);
                Sw(ae, yw().f6d_1);
                return cn;
            };
        }(pe));
        const ye = ae;
        if (ye == null) {
            pe.d79_1 = Cw;
            let es;
            const ss = sw(TezosEncodeContentsRequest);
            try {
                es = tw(sw(TezosEncodeContentsRequest), nw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                es = null;
            }
            const ns = new rw(ss, es);
            pe.w7e(ns);
        } else if (ye instanceof Aw) {
            pe.d79_1 = ye;
            pe.w7e(null);
        } else {
            pe.d79_1 = ye;
            let ts;
            const rs = sw(TezosEncodeContentsRequest);
            try {
                ts = tw(sw(TezosEncodeContentsRequest), nw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new rw(rs, ts);
            pe.w7e(os);
        }
        return cn;
    };
}
;
function TezosRpcClient$runOperation$lambda(ae) {
    return function(pe) {
        pe.a8g(function TezosRpcClient$runOperation$lambda$lambda(ae) {
            return function(pe, ye) {
                Yl(pe, [
                    "/chains/main/blocks/head/helpers/scripts/run_operation"
                ]);
                Sw(ae, yw().f6d_1);
                return cn;
            };
        }(pe));
        const ye = ae;
        if (ye == null) {
            pe.d79_1 = Cw;
            let es;
            const ss = sw(TezosRunOperationRequest);
            try {
                es = tw(sw(TezosRunOperationRequest), nw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                es = null;
            }
            const ns = new rw(ss, es);
            pe.w7e(ns);
        } else if (ye instanceof Aw) {
            pe.d79_1 = ye;
            pe.w7e(null);
        } else {
            pe.d79_1 = ye;
            let ts;
            const rs = sw(TezosRunOperationRequest);
            try {
                ts = tw(sw(TezosRunOperationRequest), nw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new rw(rs, ts);
            pe.w7e(os);
        }
        return cn;
    };
}
;
function TezosRpcClient$getConstants$lambda(ae) {
    ae.a8g(TezosRpcClient$getConstants$lambda$lambda);
    return cn;
}
;
function TezosRpcClient$getConstants$lambda$lambda(ae, pe) {
    Yl(ae, [
        "/chains/main/blocks/head/context/constants"
    ]);
    return cn;
}
;
function TezosRpcClient$broadcastTransaction$lambda$lambda(ae, pe) {
    Yl(ae, [
        "/injection/operation"
    ]);
    ae.r6m_1.w67("chain", "main");
    return cn;
}
;
function TezosRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(TezosRpcClient$broadcastTransaction$lambda$lambda);
        Tw(ye, ae);
        Iw(ye, `"${pe}"`);
        return cn;
    };
}
;
function TezosRpcClient$getBlockOperations$lambda(ae) {
    return function(pe) {
        pe.a8g(function TezosRpcClient$getBlockOperations$lambda$lambda(ae) {
            return function(pe, ye) {
                Yl(pe, [
                    `/chains/main/blocks/${ae.toString()}/operations`
                ]);
                return cn;
            };
        }(ae));
        return cn;
    };
}
;
function TezosRpcClient$getBakers$lambda(ae, pe) {
    Yl(ae, [
        "/v3/bakers"
    ]);
    return cn;
}
;
function TezosRpcClient(ae, pe) {
    zw.call(this, ae, pe);
}
;
this.o1jb_1 = "https://api.baking-bad.org";
this.p1jb_1 = this.n1jb_1;
this.q1jb_1 = this.o1jb_1;
;
this.c1jo_1 = `${this.u1jn_1.xkg_1}/rpc`;
;
this.z1jo_1 = `${this.r1jo_1.xkg_1}/rpc`;
;
this.w1jp_1 = ae;
this.x1jp_1 = `${this.w1jp_1}/rpc`;
;
this.r1jq_1 = ae;
this.s1jq_1 = `${this.r1jq_1}/rpc`;
;
this.n1jr_1 = ae;
this.o1jr_1 = `${this.n1jr_1}/rpc`;
;
function AeternityRpcClient$findTransaction$lambda(ae) {
    return function(pe) {
        pe.a8g(function AeternityRpcClient$findTransaction$lambda$lambda(ae) {
            return function(pe, ye) {
                qt(pe, [
                    `/v2/transactions/${ae}`
                ]);
                return Cs;
            };
        }(ae));
        return Cs;
    };
}
;
function AeternityRpcClient$getAccount$lambda(ae) {
    return function(pe) {
        pe.a8g(function AeternityRpcClient$getAccount$lambda$lambda(ae) {
            return function(pe, ye) {
                qt(pe, [
                    `/v2/accounts/${ae}`
                ]);
                return Cs;
            };
        }(ae));
        return Cs;
    };
}
;
function AeternityRpcClient$broadcastTransaction$lambda$lambda(ae, pe) {
    qt(ae, [
        "/v2/transactions"
    ]);
    return Cs;
}
;
function AeternityRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        Wt(ye, ae);
        ye.a8g(AeternityRpcClient$broadcastTransaction$lambda$lambda);
        Vt(ye, Gt().f6d_1);
        const es = new Ht;
        es.y56("tx", Jt(pe));
        const ss = es.l55();
        if (ss == null) {
            ye.d79_1 = Kr;
            let ns;
            const ts = Un(Mr);
            try {
                ns = Wn(Un(Mr), Kn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ns = null;
            }
            const rs = new Gn(ts, ns);
            ye.w7e(rs);
        } else if (ss instanceof Dr) {
            ye.d79_1 = ss;
            ye.w7e(null);
        } else {
            ye.d79_1 = ss;
            let os;
            const as = Un(Mr);
            try {
                os = Wn(Un(Mr), Kn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                os = null;
            }
            const cs = new Gn(as, os);
            ye.w7e(cs);
        }
        return Cs;
    };
}
;
function AeternityRpcClient$getBlockNumber$lambda(ae) {
    ae.a8g(AeternityRpcClient$getBlockNumber$lambda$lambda);
    return Cs;
}
;
function AeternityRpcClient$getBlockNumber$lambda$lambda(ae, pe) {
    qt(ae, [
        "/v2/blocks/top"
    ]);
    return Cs;
}
;
function AeternityRpcClient(ae, pe) {
    Vr.call(this, ae, pe);
}
;
this.x1cp_1 = `${this.p1cp_1.xkg_1}/v2/status`;
this.y1cp_1 = this.w1cp_1;
this.z1cp_1 = this.x1cp_1;
;
this.d1cs_1 = `${this.v1cr_1.xkg_1}/v2/blocks/top`;
this.e1cs_1 = this.c1cs_1;
this.f1cs_1 = this.d1cs_1;
;
function WavesNodeRpcClient$isSynced$lambda(ae, pe) {
    Vn(ae, [
        "/node/status"
    ]);
    return bs;
}
;
function WavesNodeRpcClient$blockNumber$lambda(ae, pe) {
    Vn(ae, [
        "/blocks/height"
    ]);
    return bs;
}
;
function WavesNodeRpcClient(ae) {
    (function Companion_getInstance_10() {
        if (ks == null) {
            new Companion_6;
        }
        return ks;
    })();
    this.e1qg_1 = ae;
}
;
function WavesRpcClient$getBalance$lambda(ae) {
    return function(pe) {
        pe.a8g(function WavesRpcClient$getBalance$lambda$lambda(ae) {
            return function(pe, ye) {
                Vn(pe, [
                    `/addresses/balance/${ae}/0`
                ]);
                return bs;
            };
        }(ae));
        return bs;
    };
}
;
function WavesRpcClient$getAssetBalances$lambda(ae) {
    return function(pe) {
        pe.a8g(function WavesRpcClient$getAssetBalances$lambda$lambda(ae) {
            return function(pe, ye) {
                Vn(pe, [
                    `/assets/balance/${ae}`
                ]);
                return bs;
            };
        }(ae));
        return bs;
    };
}
;
function WavesRpcClient$findTransactionByHash$lambda(ae) {
    return function(pe) {
        pe.a8g(function WavesRpcClient$findTransactionByHash$lambda$lambda(ae) {
            return function(pe, ye) {
                Vn(pe, [
                    `/transactions/info/${ae}`
                ]);
                return bs;
            };
        }(ae));
        return bs;
    };
}
;
function WavesRpcClient$broadcastTransaction$lambda$lambda(ae, pe) {
    Vn(ae, [
        "/transactions/broadcast"
    ]);
    return bs;
}
;
function WavesRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(WavesRpcClient$broadcastTransaction$lambda$lambda);
        al(ye, ae);
        cl(ye, pe);
        return bs;
    };
}
;
function WavesRpcClient$getTimeStamp$lambda(ae) {
    ae.a8g(WavesRpcClient$getTimeStamp$lambda$lambda);
    return bs;
}
;
function WavesRpcClient$getTimeStamp$lambda$lambda(ae, pe) {
    Vn(ae, [
        "/node/status"
    ]);
    return bs;
}
;
function WavesRpcClient(ae, pe) {
    ll.call(this, ae, pe);
}
;
function MultiversXRpcClient$getAccount$lambda(ae) {
    return function(pe) {
        pe.a8g(function MultiversXRpcClient$getAccount$lambda$lambda(ae) {
            return function(pe, ye) {
                jl(pe, [
                    `/address/${ae}`
                ]);
                return Ks;
            };
        }(ae));
        return Ks;
    };
}
;
function MultiversXRpcClient$getStakedBalance$lambda(ae) {
    return function(pe) {
        pe.a8g(function MultiversXRpcClient$getStakedBalance$lambda$lambda(ae) {
            return function(pe, ye) {
                jl(pe, [
                    `/accounts/${ae}/delegation`
                ]);
                return Ks;
            };
        }(ae));
        return Ks;
    };
}
;
function MultiversXRpcClient$getTokens$lambda(ae) {
    return function(pe) {
        pe.a8g(function MultiversXRpcClient$getTokens$lambda$lambda(ae) {
            return function(pe, ye) {
                jl(pe, [
                    `/address/${ae}/esdt`
                ]);
                return Ks;
            };
        }(ae));
        return Ks;
    };
}
;
function MultiversXRpcClient$getTransactionStatus$lambda(ae) {
    return function(pe) {
        pe.a8g(function MultiversXRpcClient$getTransactionStatus$lambda$lambda(ae) {
            return function(pe, ye) {
                jl(pe, [
                    `/transaction/${ae}/status`
                ]);
                return Ks;
            };
        }(ae));
        return Ks;
    };
}
;
function MultiversXRpcClient$submitTransaction$lambda$lambda(ae, pe) {
    jl(ae, [
        "/transaction/send"
    ]);
    return Ks;
}
;
function MultiversXRpcClient$submitTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(MultiversXRpcClient$submitTransaction$lambda$lambda);
        Dl(ye, ae);
        Bl(ye, pe);
        return Ks;
    };
}
;
function MultiversXRpcClient$getConfig$lambda(ae) {
    ae.a8g(MultiversXRpcClient$getConfig$lambda$lambda);
    return Ks;
}
;
function MultiversXRpcClient$getConfig$lambda$lambda(ae, pe) {
    jl(ae, [
        "/network/config"
    ]);
    return Ks;
}
;
function MultiversXRpcClient$estimateCost$lambda$lambda(ae, pe) {
    jl(ae, [
        "/transaction/cost"
    ]);
    return Ks;
}
;
function MultiversXRpcClient$estimateCost$lambda(ae) {
    return function(pe) {
        pe.a8g(MultiversXRpcClient$estimateCost$lambda$lambda);
        Bl(pe, ae);
        return Ks;
    };
}
;
function MultiversXRpcClient$getProviders$lambda(ae) {
    ae.a8g(MultiversXRpcClient$getProviders$lambda$lambda);
    return Ks;
}
;
function MultiversXRpcClient$getProviders$lambda$lambda(ae, pe) {
    jl(ae, [
        "/providers"
    ]);
    return Ks;
}
;
function MultiversXRpcClient$getProvider$lambda(ae) {
    return function(pe) {
        pe.a8g(function MultiversXRpcClient$getProvider$lambda$lambda(ae) {
            return function(pe, ye) {
                jl(pe, [
                    `/providers/${ae}`
                ]);
                return Ks;
            };
        }(ae));
        return Ks;
    };
}
;
function MultiversXRpcClient$getProviderDetails$lambda$lambda(ae, pe) {
    jl(ae, [
        "/vm-values/query"
    ]);
    return Ks;
}
;
function MultiversXRpcClient$getProviderDetails$lambda(ae) {
    return function(pe) {
        pe.a8g(MultiversXRpcClient$getProviderDetails$lambda$lambda);
        Bl(pe, ae);
        return Ks;
    };
}
;
function MultiversXRpcClient(ae, pe) {
    sw.call(this, ae, pe);
}
;
function StellarRpcClient$getAccount$lambda(ae) {
    return function(pe) {
        pe.a8g(function StellarRpcClient$getAccount$lambda$lambda(ae) {
            return function(pe, ye) {
                ll(pe, [
                    `/accounts/${ae}`
                ]);
                return Es;
            };
        }(ae));
        return Es;
    };
}
;
function StellarRpcClient$getClaimableBalance$lambda(ae) {
    return function(pe) {
        pe.a8g(function StellarRpcClient$getClaimableBalance$lambda$lambda(ae, pe) {
            return function(ye, es) {
                ll(ye, [
                    "/claimable_balances"
                ]);
                Cl(ae, "claimant", pe);
                return Es;
            };
        }(pe, ae));
        return Es;
    };
}
;
function StellarRpcClient$findTransactionByHash$lambda(ae) {
    return function(pe) {
        pe.a8g(function StellarRpcClient$findTransactionByHash$lambda$lambda(ae) {
            return function(pe, ye) {
                ll(pe, [
                    `/transactions/${ae}`
                ]);
                return Es;
            };
        }(ae));
        return Es;
    };
}
;
function StellarRpcClient$getFee$lambda(ae) {
    ae.a8g(StellarRpcClient$getFee$lambda$lambda);
    return Es;
}
;
function StellarRpcClient$getFee$lambda$lambda(ae, pe) {
    ll(ae, [
        "/fee_stats"
    ]);
    return Es;
}
;
function StellarRpcClient$broadcastTransaction$lambda$lambda(ae, pe) {
    ll(ae, [
        "/transactions"
    ]);
    return Es;
}
;
function StellarRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(StellarRpcClient$broadcastTransaction$lambda$lambda);
        Tl(ye, ae);
        El(ye, [
            Il("tx", pe)
        ]);
        return Es;
    };
}
;
function StellarRpcClient(ae, pe) {
    xl.call(this, ae, pe);
}
;
function NebulasRpcClient$getAccount$lambda$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/accountstate"
    ]);
    return Ts;
}
;
function NebulasRpcClient$getAccount$lambda(ae) {
    return function(pe) {
        pe.a8g(NebulasRpcClient$getAccount$lambda$lambda);
        Ln(pe, Bn().f6d_1);
        const ye = Wn([
            Kn("address", Un(ae))
        ]);
        if (ye == null) {
            pe.d79_1 = Qn;
            let es;
            const ss = Vn(Gn);
            try {
                es = Zn(Vn(Gn), Hn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                es = null;
            }
            const ns = new Jn(ss, es);
            pe.w7e(ns);
        } else if (ye instanceof Xn) {
            pe.d79_1 = ye;
            pe.w7e(null);
        } else {
            pe.d79_1 = ye;
            let ts;
            const rs = Vn(Gn);
            try {
                ts = Zn(Vn(Gn), Hn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new Jn(rs, ts);
            pe.w7e(os);
        }
        return Ts;
    };
}
;
function NebulasRpcClient$getGasPrice$lambda(ae) {
    ae.a8g(NebulasRpcClient$getGasPrice$lambda$lambda);
    return Ts;
}
;
function NebulasRpcClient$getGasPrice$lambda$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/getGasPrice"
    ]);
    return Ts;
}
;
function NebulasRpcClient$getTransactionReceipt$lambda$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/getTransactionReceipt"
    ]);
    return Ts;
}
;
function NebulasRpcClient$getTransactionReceipt$lambda(ae) {
    return function(pe) {
        pe.a8g(NebulasRpcClient$getTransactionReceipt$lambda$lambda);
        Ln(pe, Bn().f6d_1);
        const ye = Wn([
            Kn("hash", Un(ae))
        ]);
        if (ye == null) {
            pe.d79_1 = Qn;
            let es;
            const ss = Vn(Gn);
            try {
                es = Zn(Vn(Gn), Hn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                es = null;
            }
            const ns = new Jn(ss, es);
            pe.w7e(ns);
        } else if (ye instanceof Xn) {
            pe.d79_1 = ye;
            pe.w7e(null);
        } else {
            pe.d79_1 = ye;
            let ts;
            const rs = Vn(Gn);
            try {
                ts = Zn(Vn(Gn), Hn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new Jn(rs, ts);
            pe.w7e(os);
        }
        return Ts;
    };
}
;
function NebulasRpcClient$getLatestBlock$lambda(ae) {
    ae.a8g(NebulasRpcClient$getLatestBlock$lambda$lambda);
    return Ts;
}
;
function NebulasRpcClient$getLatestBlock$lambda$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/lib"
    ]);
    return Ts;
}
;
function NebulasRpcClient$getNebulasState$lambda(ae) {
    ae.a8g(NebulasRpcClient$getNebulasState$lambda$lambda);
    return Ts;
}
;
function NebulasRpcClient$getNebulasState$lambda$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/nebstate"
    ]);
    return Ts;
}
;
function NebulasRpcClient$broadcastTransaction$lambda$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/rawtransaction"
    ]);
    return Ts;
}
;
function NebulasRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(NebulasRpcClient$broadcastTransaction$lambda$lambda);
        Ln(ye, Bn().f6d_1);
        Yn(ye, ae);
        const es = Wn([
            Kn("data", Un(pe))
        ]);
        if (es == null) {
            ye.d79_1 = Qn;
            let ss;
            const ns = Vn(Gn);
            try {
                ss = Zn(Vn(Gn), Hn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ss = null;
            }
            const ts = new Jn(ns, ss);
            ye.w7e(ts);
        } else if (es instanceof Xn) {
            ye.d79_1 = es;
            ye.w7e(null);
        } else {
            ye.d79_1 = es;
            let rs;
            const os = Vn(Gn);
            try {
                rs = Zn(Vn(Gn), Hn([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new Jn(os, rs);
            ye.w7e(as);
        }
        return Ts;
    };
}
;
function NebulasRpcClient(ae, pe) {
    Kr.call(this, ae, pe);
}
;
function NebulasNodeRpcClient$isSynced$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/nebstate"
    ]);
    return Ts;
}
;
function NebulasNodeRpcClient$blockNumber$lambda(ae, pe) {
    Dn(ae, [
        "/v1/user/nebstate"
    ]);
    return Ts;
}
;
function NebulasNodeRpcClient(ae) {
    this.e1ph_1 = ae;
}
;
function IotexRpcClient$getAccountMeta$lambda(ae) {
    return function(pe) {
        pe.a8g(function IotexRpcClient$getAccountMeta$lambda$lambda(ae) {
            return function(pe, ye) {
                On(pe, [
                    `/v1/accounts/${ae}`
                ]);
                return As;
            };
        }(ae));
        return As;
    };
}
;
function IotexRpcClient$getTransactionByHash$lambda(ae) {
    return function(pe) {
        pe.a8g(function IotexRpcClient$getTransactionByHash$lambda$lambda(ae) {
            return function(pe, ye) {
                On(pe, [
                    `/v1/actions/hash/${ae}`
                ]);
                return As;
            };
        }(ae));
        return As;
    };
}
;
function IotexRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(function IotexRpcClient$broadcastTransaction$lambda$lambda(ae) {
            return function(pe, ye) {
                On(pe, [
                    `/v1/actionbytes/${ae}`
                ]);
                return As;
            };
        }(pe));
        xn(ye, ae);
        return As;
    };
}
;
function IotexRpcClient(ae, pe) {
    Hn.call(this, ae, pe);
}
;
Is($loadBalancesCOROUTINE$0, fs);
js(IconAccountService, "IconAccountService", Ds, Ds, [
    Ns
], [
    1,
    2
]);
Is($calculateFeeCOROUTINE$1, fs);
js(IconFeeService, "IconFeeService", Ds, Ds, [
    Hs
], [
    1,
    2,
    3
]);
Zs(Companion);
wn($serializer, "$serializer", Ds, Ds, [
    ln
]);
js(IconBlock, "IconBlock", Ds, Ds, Ds, Ds, Ds, {
    0: $serializer_getInstance
});
Zs(Companion_0);
wn($serializer_0, "$serializer", Ds, Ds, [
    ln
]);
js(IconTransactionResult, "IconTransactionResult", Ds, Ds, Ds, Ds, Ds, {
    0: $serializer_getInstance_0
});
Zs(Companion_1);
wn($serializer_1, "$serializer", Ds, Ds, [
    ln
]);
js(IconLimit, "IconLimit", Ds, Ds, Ds, Ds, Ds, {
    0: $serializer_getInstance_1
});
wn($serializer_2, "$serializer", Ds, Ds, [
    ln
]);
js(IconFailure, "IconFailure", Ds, Ds, Ds, Ds, Ds, {
    0: $serializer_getInstance_2
});
js(IconModule$blockchainServiceProvider$2$1, Ds, Ds, Ds, [
    Cn
], [
    3
]);
js(IconModule, "IconModule");
Is($isSyncedCOROUTINE$2, fs);
Is($blockNumberCOROUTINE$3, fs);
js(IconNodeRpcClient, "IconNodeRpcClient", Ds, Qr, Ds, [
    1,
    4,
    3
]);
Zs(Companion_2);
Is($getCoinBalanceCOROUTINE$4, fs);
Is($getTransactionByHashCOROUTINE$5, fs);
Is($broadcastTransactionCOROUTINE$6, fs);
Is($blockCOROUTINE$7, fs);
Is($estimateGasCOROUTINE$8, fs);
js(IconRpcClient, "IconRpcClient", Ds, hl, Ds, [
    1,
    2,
    3,
    5
]);
Al(IconSignService$buildSigningInput$slambda, fs, Ds, [
    1
]);
Is($signCOROUTINE$9, fs);
js(IconSignService, "IconSignService", Ds, Ds, [
    ql
], [
    4,
    3
]);
Is($findTransactionCOROUTINE$10, fs);
js(IconTransactionService, "IconTransactionService", Ds, Ds, [
    Hl
], [
    3,
    2,
    4,
    5
]);
Ts($loadBalancesCOROUTINE$0).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    if (this.p1ei_1.u()) {
                        return ks();
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.o1ei_1.q1ei_1.s1ei(Rs(this.p1ei_1).vjo().hjo_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    const ye = this.p1ei_1;
                    const es = Ms(bs(ye, 10));
                    for(const ss = ye.k(); ss.l();){
                        const ns = ss.m();
                        es.e(new As(ns, Ss(new ys(pe))));
                    }
                    return es;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ts = error;
            if (this.oa_1 === 2) {
                throw ts;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ts;
        }
    }
};
Ts(IconAccountService).aln = function(ae, pe) {
    const ye = new $loadBalancesCOROUTINE$0(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconAccountService).bln = function(ae, pe) {
    return Es(this.r1ei_1.fj());
};
Ts($calculateFeeCOROUTINE$1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.b1ej_1.d1ej_1.h1ej(this.c1ej_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return new Ls(Ds, Ds, pa_1, Fs(new Bs(-384901888, 2)));
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ts(IconFeeService).iln = function(ae, pe) {
    const ye = new $calculateFeeCOROUTINE$1(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconFeeService).jln = function(ae, pe) {
    return new Ls(Ds, Ds, Fs(new Bs(100000, 0)), Fs(new Bs(-384901888, 2)));
};
Ts($serializer).j1ej = function(ae, pe) {
    const i1ej_1 = this.i1ej_1;
    const es = ae.w3r(i1ej_1);
    es.k3t(i1ej_1, 0, pe.k1ej_1);
    es.k3t(i1ej_1, 1, pe.l1ej_1);
    es.k3t(i1ej_1, 2, pe.m1ej_1);
    es.m3t(i1ej_1, 3, Qs(), pe.n1ej_1);
    es.k3t(i1ej_1, 4, pe.o1ej_1);
    es.g3t(i1ej_1, 5, pe.p1ej_1);
    es.k3t(i1ej_1, 6, pe.q1ej_1);
    es.k3t(i1ej_1, 7, pe.r1ej_1);
    es.x3r(i1ej_1);
};
Ts($serializer).v3o = function(ae, pe) {
    return this.j1ej(ae, pe instanceof IconBlock ? pe : Ys());
};
Ts($serializer).w3o = function(ae) {
    const i1ej_1 = this.i1ej_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    let as = null;
    let cs = new Bs(0, 0);
    let us = null;
    let ls = null;
    const ms = ae.w3r(i1ej_1);
    if (ms.l3s()) {
        ns = ms.g3s(i1ej_1, 0);
        ss |= 1;
        ts = ms.g3s(i1ej_1, 1);
        ss |= 2;
        rs = ms.g3s(i1ej_1, 2);
        ss |= 4;
        os = ms.i3s(i1ej_1, 3, Qs(), os);
        ss |= 8;
        as = ms.g3s(i1ej_1, 4);
        ss |= 16;
        cs = ms.c3s(i1ej_1, 5);
        ss |= 32;
        us = ms.g3s(i1ej_1, 6);
        ss |= 64;
        ls = ms.g3s(i1ej_1, 7);
        ss |= 128;
    } else {
        while(ye){
            switch(es = ms.m3s(i1ej_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ms.g3s(i1ej_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = ms.g3s(i1ej_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = ms.g3s(i1ej_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = ms.i3s(i1ej_1, 3, Qs(), os);
                    ss |= 8;
                    break;
                case 4:
                    as = ms.g3s(i1ej_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = ms.c3s(i1ej_1, 5);
                    ss |= 32;
                    break;
                case 6:
                    us = ms.g3s(i1ej_1, 6);
                    ss |= 64;
                    break;
                case 7:
                    ls = ms.g3s(i1ej_1, 7);
                    ss |= 128;
                    break;
                default:
                    throw sn(es);
            }
        }
    }
    ms.x3r(i1ej_1);
    return function IconBlock_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as) {
        return function IconBlock_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs) {
            if (255 & ~ae) {
                mn(ae, 255, $serializer_getInstance().i1ej_1);
            }
            cs.k1ej_1 = pe;
            cs.l1ej_1 = ye;
            cs.m1ej_1 = es;
            cs.n1ej_1 = ss;
            cs.o1ej_1 = ns;
            cs.p1ej_1 = ts;
            cs.q1ej_1 = rs;
            cs.r1ej_1 = os;
            return cs;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, 0, gn(Ts(IconBlock)));
    }(ss, ns, ts, rs, os, as, cs, us, ls);
};
Ts($serializer).i3o = function() {
    return this.i1ej_1;
};
Ts($serializer).z3z = function() {
    return [
        an(),
        an(),
        an(),
        Qs(),
        an(),
        cn(),
        an(),
        an()
    ];
};
Ts(IconBlock).toString = function() {
    return `IconBlock(version=${this.k1ej_1}, prevBlockHash=${this.l1ej_1}, merkleTreeRootHash=${this.m1ej_1}, timestamp=${this.n1ej_1.toString()}, blockHash=${this.o1ej_1}, height=${this.p1ej_1.toString()}, peerID=${this.q1ej_1}, signature=${this.r1ej_1})`;
};
Ts(IconBlock).hashCode = function() {
    let ae = dn(this.k1ej_1);
    ae = ps(ae, 31) + dn(this.l1ej_1) | 0;
    ae = ps(ae, 31) + dn(this.m1ej_1) | 0;
    ae = ps(ae, 31) + this.n1ej_1.hashCode() | 0;
    ae = ps(ae, 31) + dn(this.o1ej_1) | 0;
    ae = ps(ae, 31) + this.p1ej_1.hashCode() | 0;
    ae = ps(ae, 31) + dn(this.q1ej_1) | 0;
    return ae = ps(ae, 31) + dn(this.r1ej_1) | 0;
};
Ts(IconBlock).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof IconBlock)) {
        return false;
    }
    const pe = ae instanceof IconBlock ? ae : Ys();
    return this.k1ej_1 === pe.k1ej_1 && this.l1ej_1 === pe.l1ej_1 && this.m1ej_1 === pe.m1ej_1 && !!this.n1ej_1.equals(pe.n1ej_1) && this.o1ej_1 === pe.o1ej_1 && !!this.p1ej_1.equals(pe.p1ej_1) && this.q1ej_1 === pe.q1ej_1 && this.r1ej_1 === pe.r1ej_1;
};
Ts($serializer_0).t1ej = function(ae, pe) {
    const s1ej_1 = this.s1ej_1;
    const es = ae.w3r(s1ej_1);
    es.k3t(s1ej_1, 0, pe.u1ej_1);
    es.n3t(s1ej_1, 1, $serializer_getInstance_2(), pe.v1ej_1);
    es.x3r(s1ej_1);
};
Ts($serializer_0).v3o = function(ae, pe) {
    return this.t1ej(ae, pe instanceof IconTransactionResult ? pe : Ys());
};
Ts($serializer_0).w3o = function(ae) {
    const s1ej_1 = this.s1ej_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    const rs = ae.w3r(s1ej_1);
    if (rs.l3s()) {
        ns = rs.g3s(s1ej_1, 0);
        ss |= 1;
        ts = rs.k3s(s1ej_1, 1, $serializer_getInstance_2(), ts);
        ss |= 2;
    } else {
        while(ye){
            switch(es = rs.m3s(s1ej_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = rs.g3s(s1ej_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = rs.k3s(s1ej_1, 1, $serializer_getInstance_2(), ts);
                    ss |= 2;
                    break;
                default:
                    throw sn(es);
            }
        }
    }
    rs.x3r(s1ej_1);
    return function IconTransactionResult_init_$Create$(ae, pe, ye, es) {
        return function IconTransactionResult_init_$Init$(ae, pe, ye, es, ss) {
            if (3 & ~ae) {
                mn(ae, 3, $serializer_getInstance_0().s1ej_1);
            }
            ss.u1ej_1 = pe;
            ss.v1ej_1 = ye;
            return ss;
        }(ae, pe, ye, 0, gn(Ts(IconTransactionResult)));
    }(ss, ns, ts);
};
Ts($serializer_0).i3o = function() {
    return this.s1ej_1;
};
Ts($serializer_0).z3z = function() {
    return [
        an(),
        _n($serializer_getInstance_2())
    ];
};
Ts(IconTransactionResult).toString = function() {
    return `IconTransactionResult(status=${this.u1ej_1}, failure=${hn(this.v1ej_1)})`;
};
Ts(IconTransactionResult).hashCode = function() {
    let ae = dn(this.u1ej_1);
    return ae = ps(ae, 31) + (this.v1ej_1 == null ? 0 : this.v1ej_1.hashCode()) | 0;
};
Ts(IconTransactionResult).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof IconTransactionResult)) {
        return false;
    }
    const pe = ae instanceof IconTransactionResult ? ae : Ys();
    return this.u1ej_1 === pe.u1ej_1 && !!pn(this.v1ej_1, pe.v1ej_1);
};
Ts($serializer_1).x1ej = function(ae, pe) {
    const w1ej_1 = this.w1ej_1;
    const es = ae.w3r(w1ej_1);
    es.k3t(w1ej_1, 0, pe.y1ej_1);
    es.x3r(w1ej_1);
};
Ts($serializer_1).v3o = function(ae, pe) {
    return this.x1ej(ae, pe instanceof IconLimit ? pe : Ys());
};
Ts($serializer_1).w3o = function(ae) {
    const w1ej_1 = this.w1ej_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    const ts = ae.w3r(w1ej_1);
    if (ts.l3s()) {
        ns = ts.g3s(w1ej_1, 0);
        ss |= 1;
    } else {
        while(ye){
            switch(es = ts.m3s(w1ej_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ts.g3s(w1ej_1, 0);
                    ss |= 1;
                    break;
                default:
                    throw sn(es);
            }
        }
    }
    ts.x3r(w1ej_1);
    return function IconLimit_init_$Create$(ae, pe, ye) {
        return function IconLimit_init_$Init$(ae, pe, ye, es) {
            if (1 & ~ae) {
                mn(ae, 1, $serializer_getInstance_1().w1ej_1);
            }
            es.y1ej_1 = pe;
            return es;
        }(ae, pe, 0, gn(Ts(IconLimit)));
    }(ss, ns);
};
Ts($serializer_1).i3o = function() {
    return this.w1ej_1;
};
Ts($serializer_1).z3z = function() {
    return [
        an()
    ];
};
Ts(IconLimit).toString = function() {
    return `IconLimit(default=${this.y1ej_1})`;
};
Ts(IconLimit).hashCode = function() {
    return dn(this.y1ej_1);
};
Ts(IconLimit).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof IconLimit)) {
        return false;
    }
    const pe = ae instanceof IconLimit ? ae : Ys();
    return this.y1ej_1 === pe.y1ej_1;
};
Ts($serializer_2).a1ek = function(ae, pe) {
    const z1ej_1 = this.z1ej_1;
    const es = ae.w3r(z1ej_1);
    es.k3t(z1ej_1, 0, pe.b1ek_1);
    es.f3t(z1ej_1, 1, pe.c1ek_1);
    es.x3r(z1ej_1);
};
Ts($serializer_2).v3o = function(ae, pe) {
    return this.a1ek(ae, pe instanceof IconFailure ? pe : Ys());
};
Ts($serializer_2).w3o = function(ae) {
    const z1ej_1 = this.z1ej_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = 0;
    const rs = ae.w3r(z1ej_1);
    if (rs.l3s()) {
        ns = rs.g3s(z1ej_1, 0);
        ss |= 1;
        ts = rs.b3s(z1ej_1, 1);
        ss |= 2;
    } else {
        while(ye){
            switch(es = rs.m3s(z1ej_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = rs.g3s(z1ej_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = rs.b3s(z1ej_1, 1);
                    ss |= 2;
                    break;
                default:
                    throw sn(es);
            }
        }
    }
    rs.x3r(z1ej_1);
    return function IconFailure_init_$Create$(ae, pe, ye, es) {
        return function IconFailure_init_$Init$(ae, pe, ye, es, ss) {
            if (3 & ~ae) {
                mn(ae, 3, $serializer_getInstance_2().z1ej_1);
            }
            ss.b1ek_1 = pe;
            ss.c1ek_1 = ye;
            return ss;
        }(ae, pe, ye, 0, gn(Ts(IconFailure)));
    }(ss, ns, ts);
};
Ts($serializer_2).i3o = function() {
    return this.z1ej_1;
};
Ts($serializer_2).z3z = function() {
    return [
        an(),
        fn()
    ];
};
Ts(IconFailure).toString = function() {
    return `IconFailure(message=${this.b1ek_1}, code=${this.c1ek_1})`;
};
Ts(IconFailure).hashCode = function() {
    let ae = dn(this.b1ek_1);
    return ae = ps(ae, 31) + this.c1ek_1 | 0;
};
Ts(IconFailure).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof IconFailure)) {
        return false;
    }
    const pe = ae instanceof IconFailure ? ae : Ys();
    return this.b1ek_1 === pe.b1ek_1 && this.c1ek_1 === pe.c1ek_1;
};
Ts(IconModule$blockchainServiceProvider$2$1).gjc = function() {
    return bn($n());
};
Ts(IconModule$blockchainServiceProvider$2$1).hjc = function() {
    return _get_iconNodeService__rk6gxj(this.o1ek_1);
};
Ts(IconModule$blockchainServiceProvider$2$1).ijc = function() {
    return _get_iconBalanceService__hv68qh(this.o1ek_1);
};
Ts(IconModule$blockchainServiceProvider$2$1).jjc = function() {
    return _get_iconFeeSource__yzv4s7(this.o1ek_1);
};
Ts(IconModule$blockchainServiceProvider$2$1).kjc = function() {
    return _get_iconSignService__8spb02(this.o1ek_1);
};
Ts(IconModule$blockchainServiceProvider$2$1).ljc = function() {
    return _get_iconTransactionService__65xz23(this.o1ek_1);
};
Ts(IconModule$blockchainServiceProvider$2$1).qjc = function(ae) {
    return createIconRpcClient(this.o1ek_1, ae);
};
Ts(IconModule).vms = function() {
    const n1ek_1 = this.n1ek_1;
    (function blockchainServiceProvider$factory() {
        return En("blockchainServiceProvider", 1, In, function(ae) {
            return ae.vms();
        }, null);
    })();
    return n1ek_1.f1();
};
Ts($isSyncedCOROUTINE$2).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 10;
                    this.z1ek_1 = this.x1ek_1;
                    this.a1el_1 = this.z1ek_1;
                    this.oa_1 = 9;
                    this.c1el_1 = jn;
                    this.d1el_1 = this.a1el_1;
                    this.e1el_1 = this.d1el_1;
                    this.f1el_1 = this.e1el_1.x1em_1;
                    this.g1el_1 = vs.f1en(this.y1ek_1.xkg_1);
                    this.h1el_1 = this.f1el_1;
                    this.i1el_1 = this.g1el_1;
                    this.j1el_1 = this.h1el_1;
                    this.k1el_1 = this.j1el_1;
                    this.l1el_1 = this.k1el_1;
                    const pe = new Dn;
                    Bn(pe, this.i1el_1);
                    Un(pe, Ln().f6d_1);
                    const ye = new Kn(Ds, "icx_getLastBlock", null);
                    if (ye == null) {
                        pe.d79_1 = Vn;
                        let es;
                        const ss = Pn(Kn);
                        try {
                            es = xn(Pn(Kn), On([]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            es = null;
                        }
                        pe.w7e(new Wn(ss, es));
                    } else if (ye instanceof Gn) {
                        pe.d79_1 = ye;
                        pe.w7e(null);
                    } else {
                        pe.d79_1 = ye;
                        let ns;
                        const ts = Pn(Kn);
                        try {
                            ns = xn(Pn(Kn), On([]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            ns = null;
                        }
                        pe.w7e(new Wn(ts, ns));
                    }
                    this.m1el_1 = pe;
                    this.n1el_1 = this.l1el_1;
                    this.o1el_1 = this.m1el_1;
                    this.o1el_1.b79_1 = Hn().j6j_1;
                    this.p1el_1 = this.n1el_1;
                    this.q1el_1 = this.o1el_1;
                    this.r1el_1 = this.p1el_1;
                    this.s1el_1 = this.q1el_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Zn(this.s1el_1, this.r1el_1).q8k(this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.t1el_1 = pa_1;
                    this.u1el_1 = this.t1el_1;
                    this.v1el_1 = this.u1el_1;
                    this.w1el_1 = "message";
                    if (Qn(this.v1el_1.v6o())) {
                        this.oa_1 = 4;
                        this.z1el_1 = this.v1el_1;
                        this.a1em_1 = this.z1el_1;
                        this.na_1 = 3;
                        let rs;
                        const os = this.a1em_1.i7c();
                        const as = Pn(Xn);
                        try {
                            rs = xn(Pn(Xn), On([]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            rs = null;
                        }
                        if ((pa_1 = os.l7b(new Wn(as, rs), this)) === $s()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.b1em_1 = this.v1el_1.v6o().c6m_1;
                    this.c1em_1 = this.v1el_1;
                    this.d1em_1 = this.w1el_1;
                    this.e1em_1 = this.c1em_1;
                    this.f1em_1 = this.d1em_1;
                    this.na_1 = 2;
                    if ((pa_1 = Jn(this.e1em_1, Ds, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.g1em_1 = pa_1;
                    this.h1em_1 = Yn(this.g1em_1, this.f1em_1);
                    const cs = this.h1em_1;
                    this.i1em_1 = qt(kt(rt(cs) ? cs : Ys()));
                    throw new Wt(this.b1em_1, this.i1em_1);
                case 3:
                    this.y1el_1 = pa_1 instanceof Xn ? pa_1 : Ys();
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 9;
                    if (this.qa_1 instanceof Vt) {
                        this.j1em_1 = this.qa_1;
                        this.k1em_1 = this.v1el_1.v6o().c6m_1;
                        this.l1em_1 = this.v1el_1;
                        this.m1em_1 = this.w1el_1;
                        this.n1em_1 = this.l1em_1;
                        this.o1em_1 = this.m1em_1;
                        this.na_1 = 5;
                        if ((pa_1 = Jn(this.n1em_1, Ds, this)) === $s()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof Gt) {
                        this.p1em_1 = this.qa_1;
                        this.q1em_1 = this.v1el_1.v6o().c6m_1;
                        this.r1em_1 = this.v1el_1;
                        this.s1em_1 = this.w1el_1;
                        this.t1em_1 = this.r1em_1;
                        this.u1em_1 = this.s1em_1;
                        this.na_1 = 6;
                        if ((pa_1 = Jn(this.t1em_1, Ds, this)) === $s()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const us = Yn(pa_1, this.o1em_1);
                    const ls = qt(kt(rt(us) ? us : Ys()));
                    throw new Wt(this.k1em_1, ls, this.j1em_1);
                case 6:
                    const ms = Yn(pa_1, this.u1em_1);
                    const gs = qt(kt(rt(ms) ? ms : Ys()));
                    throw new Wt(this.q1em_1, gs, this.p1em_1);
                case 7:
                    this.oa_1 = 9;
                    this.x1el_1 = this.y1el_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    const ds = this.x1el_1.ypo_1;
                    const _s = this.e1el_1.bpp_1;
                    const hs = qn(_s.t3o(), xn(Pn(IconBlock), On([]), false));
                    const ps = _s.d54(Nn(hs, zn) ? hs : Ys(), ds).n1ej_1;
                    const fs = Ht(this.t1el_1).o3(Jt(1000));
                    const ks = ps.n3(fs).b8t().h8v(600000000) < 0;
                    this.c1el_1;
                    this.b1el_1 = Mr(ks);
                    this.oa_1 = 10;
                    this.na_1 = 11;
                    continue e;
                case 9:
                    this.oa_1 = 10;
                    if (this.qa_1 instanceof Error) {
                        const Rs = this.qa_1;
                        this.b1el_1 = Mr(Dr(Rs));
                        this.na_1 = 11;
                        continue e;
                    }
                    throw this.qa_1;
                case 10:
                    throw this.qa_1;
                case 11:
                    this.oa_1 = 10;
                    let bs;
                    const Ms = this.b1el_1;
                    s: do {
                        if (Kr(Ms)) {
                            bs = false;
                            break s;
                        }
                        const ys = Vr(Ms);
                        bs = ys == null || ys != null ? ys : Ys();
                    }while (0)
                    return bs;
            }
        } catch (error) {
            const Ss = error;
            if (this.oa_1 === 10) {
                throw Ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = Ss;
        }
    }
};
Ts($blockNumberCOROUTINE$3).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.q1en_1 = this.o1en_1;
                    this.r1en_1 = this.q1en_1;
                    this.oa_1 = 2;
                    this.t1en_1 = jn;
                    this.u1en_1 = this.r1en_1;
                    this.v1en_1 = this.u1en_1;
                    this.w1en_1 = this.v1en_1;
                    this.x1en_1 = vs.f1en(this.p1en_1.xkg_1);
                    this.y1en_1 = "icx_getLastBlock";
                    this.z1en_1 = this.w1en_1;
                    this.a1eo_1 = this.x1en_1;
                    this.b1eo_1 = this.y1en_1;
                    this.c1eo_1 = null;
                    this.na_1 = 1;
                    if ((pa_1 = this.z1en_1.cpp(this.a1eo_1, this.b1eo_1, this.c1eo_1, IconNodeRpcClient$blockNumber$lambda(this.z1en_1), this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.t1en_1;
                    this.s1en_1 = Mr(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.s1en_1 = Mr(Dr(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.s1en_1;
                    if (Zr(ss) == null) {
                        const ns = Vr(ss);
                        es = Es((ns == null || ns != null ? ns : Ys()).p1ej_1);
                    } else {
                        es = Xr().n8s_1;
                    }
                    return es;
            }
        } catch (error) {
            const ts = error;
            if (this.oa_1 === 3) {
                throw ts;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ts;
        }
    }
};
Ts(IconNodeRpcClient).fkw = function(ae, pe) {
    const ye = new $isSyncedCOROUTINE$2(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconNodeRpcClient).dlo = function(ae, pe) {
    const ye = new $blockNumberCOROUTINE$3(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(Companion_2).f1en = function(ae) {
    return `${ae}/api/v3`;
};
Ts($getCoinBalanceCOROUTINE$4).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.n1eo_1 = this.l1eo_1;
                    this.o1eo_1 = vs;
                    this.na_1 = 1;
                    if ((pa_1 = this.l1eo_1.uli(ol($n()), this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.p1eo_1 = pa_1;
                    this.q1eo_1 = this.o1eo_1.f1en(this.p1eo_1);
                    this.r1eo_1 = "icx_getBalance";
                    this.s1eo_1 = new ll(cl(al("address", il(this.m1eo_1))));
                    this.t1eo_1 = this.n1eo_1;
                    this.u1eo_1 = this.q1eo_1;
                    this.v1eo_1 = this.r1eo_1;
                    this.w1eo_1 = this.s1eo_1;
                    this.x1eo_1 = wl();
                    this.na_1 = 2;
                    if ((pa_1 = this.t1eo_1.ipo(this.u1eo_1, this.v1eo_1, this.w1eo_1, IconRpcClient$getCoinBalance$lambda(this.t1eo_1), this.x1eo_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return ml(pa_1);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 3) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ts($getTransactionByHashCOROUTINE$5).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.j1ep_1 = this.g1ep_1;
                    this.k1ep_1 = vs;
                    this.na_1 = 1;
                    if ((pa_1 = this.g1ep_1.uli(this.h1ep_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.l1ep_1 = pa_1;
                    this.m1ep_1 = this.k1ep_1.f1en(this.l1ep_1);
                    this.n1ep_1 = "icx_getTransactionResult";
                    this.o1ep_1 = new ll(cl(al("txHash", il(this.i1ep_1))));
                    this.p1ep_1 = this.j1ep_1;
                    this.q1ep_1 = this.m1ep_1;
                    this.r1ep_1 = this.n1ep_1;
                    this.s1ep_1 = this.o1ep_1;
                    this.t1ep_1 = wl();
                    this.na_1 = 2;
                    if ((pa_1 = this.p1ep_1.ipo(this.q1ep_1, this.r1ep_1, this.s1ep_1, IconRpcClient$getTransactionByHash$lambda(this.p1ep_1), this.t1ep_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return pa_1;
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 3) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ts($broadcastTransactionCOROUTINE$6).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.g1eq_1 = this.c1eq_1;
                    this.h1eq_1 = vs;
                    this.na_1 = 1;
                    if ((pa_1 = this.c1eq_1.uli(this.d1eq_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.i1eq_1 = pa_1;
                    this.j1eq_1 = this.h1eq_1.f1en(this.i1eq_1);
                    this.k1eq_1 = "icx_sendTransaction";
                    const pe = this.c1eq_1.hpo_1;
                    const ye = this.e1eq_1;
                    const es = qn(pe.t3o(), xn(Pn(gl), On([]), true));
                    this.l1eq_1 = pe.q3p(Nn(es, zn) ? es : Ys(), ye);
                    this.m1eq_1 = dl(this.f1eq_1);
                    this.n1eq_1 = this.g1eq_1;
                    this.o1eq_1 = this.j1eq_1;
                    this.p1eq_1 = this.k1eq_1;
                    this.q1eq_1 = this.l1eq_1;
                    this.r1eq_1 = this.m1eq_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.n1eq_1.ipo(this.o1eq_1, this.p1eq_1, this.q1eq_1, IconRpcClient$broadcastTransaction$lambda(this.n1eq_1), this.r1eq_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return pa_1;
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const ss = error;
            if (this.oa_1 === 3) {
                throw ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ss;
        }
    }
};
Ts($blockCOROUTINE$7).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.c1er_1 = this.a1er_1;
                    this.d1er_1 = vs;
                    this.na_1 = 1;
                    if ((pa_1 = this.a1er_1.uli(this.b1er_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.e1er_1 = pa_1;
                    this.f1er_1 = this.d1er_1.f1en(this.e1er_1);
                    this.g1er_1 = "icx_getLastBlock";
                    this.h1er_1 = this.c1er_1;
                    this.i1er_1 = this.f1er_1;
                    this.j1er_1 = this.g1er_1;
                    this.k1er_1 = null;
                    this.l1er_1 = wl();
                    this.na_1 = 2;
                    if ((pa_1 = this.h1er_1.ipo(this.i1er_1, this.j1er_1, this.k1er_1, IconRpcClient$block$lambda(this.h1er_1), this.l1er_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return pa_1;
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 3) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ts($estimateGasCOROUTINE$8).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.w1er_1 = this.u1er_1;
                    this.x1er_1 = vs;
                    this.na_1 = 1;
                    if ((pa_1 = this.u1er_1.uli(this.v1er_1.ok2().xjo(), this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.y1er_1 = pa_1;
                    this.z1er_1 = this.x1er_1.f1en(this.y1er_1);
                    this.a1es_1 = "icx_call";
                    this.b1es_1 = new ll(_l([
                        al("from", il(this.v1er_1.ok2().vjo().hjo_1)),
                        al("to", il("cx0000000000000000000000000000000000000001")),
                        al("dataType", il("call")),
                        al("data", new ll(cl(al("method", il("getStepCosts")))))
                    ]));
                    this.c1es_1 = this.w1er_1;
                    this.d1es_1 = this.z1er_1;
                    this.e1es_1 = this.a1es_1;
                    this.f1es_1 = this.b1es_1;
                    this.g1es_1 = wl();
                    this.na_1 = 2;
                    if ((pa_1 = this.c1es_1.ipo(this.d1es_1, this.e1es_1, this.f1es_1, IconRpcClient$estimateGas$lambda(this.c1es_1), this.g1es_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1.y1ej_1;
                    return ml(pe);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const ye = error;
            if (this.oa_1 === 3) {
                throw ye;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ye;
        }
    }
};
Ts(IconRpcClient).s1ei = function(ae, pe) {
    const ye = new $getCoinBalanceCOROUTINE$4(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconRpcClient).h1es = function(ae, pe, ye) {
    const es = new $getTransactionByHashCOROUTINE$5(this, ae, pe, ye);
    es.pa_1 = Cs;
    es.qa_1 = null;
    return es.va();
};
Ts(IconRpcClient).i1es = function(ae, pe, ye, es) {
    const ss = new $broadcastTransactionCOROUTINE$6(this, ae, pe, ye, es);
    ss.pa_1 = Cs;
    ss.qa_1 = null;
    return ss.va();
};
Ts(IconRpcClient).j1es = function(ae, pe) {
    const ye = new $blockCOROUTINE$7(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconRpcClient).h1ej = function(ae, pe) {
    const ye = new $estimateGasCOROUTINE$8(this, ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconSignService$buildSigningInput$slambda).y1es = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = Cs;
    ye.qa_1 = null;
    return ye.va();
};
Ts(IconSignService$buildSigningInput$slambda).hb = function(ae, pe) {
    return this.y1es(ae != null && Nn(ae, Ml) ? ae : Ys(), pe);
};
Ts(IconSignService$buildSigningInput$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.s1es_1.z1es_1.j1es(this.t1es_1.ok2().xjo(), this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    let pe;
                    const ye = pa_1;
                    if (!(this.t1es_1 instanceof yl)) {
                        throw vl(qt("ICON: operation not supported"));
                    }
                    pe = buildForTransfer(this.s1es_1, ye.n1ej_1, this.u1es_1, this.t1es_1, this.v1es_1, this.w1es_1);
                    return Sl(pe);
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const es = error;
            if (this.oa_1 === 2) {
                throw es;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = es;
        }
    }
};
Ts(IconSignService$buildSigningInput$slambda).g1w = function(ae, pe) {
    const ye = new IconSignService$buildSigningInput$slambda(this.s1es_1, this.t1es_1, this.u1es_1, this.v1es_1, this.w1es_1, pe);
    ye.x1es_1 = ae;
    return ye;
};
Ts($signCOROUTINE$9).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.i1et_1.n1et(this.j1et_1, this.k1et_1, this.l1et_1, this.m1et_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    return this.i1et_1.nlp(this.j1et_1.ok2().ojo(), pe);
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ye = error;
            if (this.oa_1 === 2) {
                throw ye;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ye;
        }
    }
};
Ts(IconSignService).jlp = function() {
    return Cl().weh_1;
};
Ts(IconSignService).o1et = function(ae, pe, ye, es, ss) {
    const ns = new $signCOROUTINE$9(this, ae, pe, ye, es, ss);
    ns.pa_1 = Cs;
    ns.qa_1 = null;
    return ns.va();
};
Ts(IconSignService).klp = function(ae, pe, ye, es, ss) {
    return this.o1et(ae, pe, ye, es, ss);
};
Ts(IconSignService).n1et = function(ae, pe, ye, es, ss) {
    return Il(function IconSignService$buildSigningInput$slambda_0(ae, pe, ye, es, ss, ns) {
        const ts = new IconSignService$buildSigningInput$slambda(ae, pe, ye, es, ss, ns);
        const l = function(ae, pe) {
            return ts.y1es(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, ye, pe, es, null), ss);
};
Ts(IconSignService).plp = function(ae, pe, ye, es, ss) {
    return this.n1et(ae, pe, ye, es, ss);
};
Ts($findTransactionCOROUTINE$10).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.x1et_1.b1eu_1.h1es(this.y1et_1.mjo_1, this.z1et_1, this)) === $s()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    if (pe == null) {
                        throw new zl(this.z1et_1);
                    }
                    let ye;
                    const es = pe;
                    const ss = es.v1ej_1;
                    const ns = ss == null ? null : ss.b1ek_1;
                    if (ns != null && Bl(ns) !== 0) {
                        const ts = es.v1ej_1;
                        const rs = ts == null ? null : ts.b1ek_1;
                        ye = new Dl(rs ?? "");
                    } else {
                        ye = es.u1ej_1 === "0x1" ? jl : Nl;
                    }
                    return new Fl(this.y1et_1, this.z1et_1, ye, 0, new Bs(0, 0), Xr().n8s_1);
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const as = error;
            if (this.oa_1 === 2) {
                throw as;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = as;
        }
    }
};
Ts(IconTransactionService).c1eu = function(ae, pe, ye, es) {
    return this.tlq(ae, pe.qeh_1, ye, es);
};
Ts(IconTransactionService).rlq = function(ae, pe, ye, es) {
    return this.c1eu(ae, pe instanceof Ll ? pe : Ys(), ye, es);
};
Ts(IconTransactionService).tlq = function(ae, pe, ye, es) {
    return this.b1eu_1.i1es(ae, pe, ye, es);
};
Ts(IconTransactionService).vlq = function(ae, pe, ye, es) {
    const ss = new $findTransactionCOROUTINE$10(this, ae, pe, ye, es);
    ss.pa_1 = Cs;
    ss.qa_1 = null;
    return ss.va();
};
Ts(IconAccountService).cln = Ps;
Ts(IconAccountService).dln = Os;
Ts(IconAccountService).eln = xs;
Ts(IconAccountService).fln = qs;
Ts(IconAccountService).gln = zs;
Ts(IconFeeService).kln = Us;
Ts(IconFeeService).lln = Ks;
Ts(IconFeeService).mln = Ws;
Ts(IconFeeService).nln = Gs;
Ts(IconFeeService).oln = Vs;
Ts($serializer).a40 = un;
Ts($serializer_0).a40 = un;
Ts($serializer_1).a40 = un;
Ts($serializer_2).a40 = un;
Ts(IconModule$blockchainServiceProvider$2$1).mjc = Mn;
Ts(IconModule$blockchainServiceProvider$2$1).njc = yn;
Ts(IconModule$blockchainServiceProvider$2$1).ojc = Sn;
Ts(IconModule$blockchainServiceProvider$2$1).pjc = An;
Ts(IconSignService).llp = Tl;
Ts(IconSignService).mlp = El;
Ts(IconSignService).nlp = Pl;
Ts(IconSignService).olp = Ol;
Ts(IconSignService).qlp = xl;
Ts(IconTransactionService).wlq = Ul;
Ts(IconTransactionService).qlq = Kl;
Ts(IconTransactionService).slq = Wl;
Ts(IconTransactionService).ulq = Gl;
Ts(IconTransactionService).xlq = Vl;
new Companion;
new Companion_0;
new Companion_1;
vs = new Companion_2;
ae.$_$ = ae.$_$ || {};
ae.$_$.a = IconModule;
this.gu8_1 = "https://discover-cdn.trustwallet.com/public/config";
this.hu8_1 = "chain-config.json";
function PolkadotRpcClient$getBalance$lambda(ae) {
    return function(pe) {
        pe.a8g(function PolkadotRpcClient$getBalance$lambda$lambda(ae) {
            return function(pe, ye) {
                Jl(pe, [
                    `/accounts/${ae}/balance-info`
                ]);
                return Zs;
            };
        }(ae));
        return Zs;
    };
}
;
function PolkadotRpcClient$getTransactionArtifacts$lambda(ae) {
    ae.a8g(function PolkadotRpcClient$getTransactionArtifacts$lambda$lambda(ae) {
        return function(pe, ye) {
            Jl(pe, [
                "/transaction/material"
            ]);
            Xl(ae, "noMeta", true);
            return Zs;
        };
    }(ae));
    return Zs;
}
;
function PolkadotRpcClient$broadcastTransaction$lambda$lambda(ae, pe) {
    Jl(ae, [
        "/transaction"
    ]);
    return Zs;
}
;
function PolkadotRpcClient$broadcastTransaction$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(PolkadotRpcClient$broadcastTransaction$lambda$lambda);
        Yl(ye, Ql().f6d_1);
        ew(ye, ae);
        const es = new PolkadotExtrinsicRequest(pe);
        if (es == null) {
            ye.d79_1 = nw;
            let ss;
            const ns = Gt(PolkadotExtrinsicRequest);
            try {
                ss = Ht(Gt(PolkadotExtrinsicRequest), Vt([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ss = null;
            }
            const ts = new Jt(ns, ss);
            ye.w7e(ts);
        } else if (es instanceof sw) {
            ye.d79_1 = es;
            ye.w7e(null);
        } else {
            ye.d79_1 = es;
            let rs;
            const os = Gt(PolkadotExtrinsicRequest);
            try {
                rs = Ht(Gt(PolkadotExtrinsicRequest), Vt([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new Jt(os, rs);
            ye.w7e(as);
        }
        return Zs;
    };
}
;
function PolkadotRpcClient$estimateFee$lambda$lambda(ae, pe) {
    Jl(ae, [
        "/transaction/fee-estimate"
    ]);
    return Zs;
}
;
function PolkadotRpcClient$estimateFee$lambda(ae) {
    return function(pe) {
        pe.a8g(PolkadotRpcClient$estimateFee$lambda$lambda);
        Yl(pe, Ql().f6d_1);
        const ye = new PolkadotExtrinsicRequest(ae);
        if (ye == null) {
            pe.d79_1 = nw;
            let es;
            const ss = Gt(PolkadotExtrinsicRequest);
            try {
                es = Ht(Gt(PolkadotExtrinsicRequest), Vt([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                es = null;
            }
            const ns = new Jt(ss, es);
            pe.w7e(ns);
        } else if (ye instanceof sw) {
            pe.d79_1 = ye;
            pe.w7e(null);
        } else {
            pe.d79_1 = ye;
            let ts;
            const rs = Gt(PolkadotExtrinsicRequest);
            try {
                ts = Ht(Gt(PolkadotExtrinsicRequest), Vt([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new Jt(rs, ts);
            pe.w7e(os);
        }
        return Zs;
    };
}
;
function PolkadotRpcClient$getBlockNumber$lambda(ae) {
    return function(pe) {
        pe.a8g(function PolkadotRpcClient$getBlockNumber$lambda$lambda(ae) {
            return function(pe, ye) {
                Jl(pe, [
                    `/blocks/${ae}`
                ]);
                return Zs;
            };
        }(ae));
        return Zs;
    };
}
;
function PolkadotRpcClient$stakingInfo$lambda(ae) {
    return function(pe) {
        pe.a8g(function PolkadotRpcClient$stakingInfo$lambda$lambda(ae) {
            return function(pe, ye) {
                Jl(pe, [
                    `/accounts/${ae}/staking-info`
                ]);
                return Zs;
            };
        }(ae));
        return Zs;
    };
}
;
function PolkadotRpcClient$stakingProgress$lambda(ae) {
    ae.a8g(PolkadotRpcClient$stakingProgress$lambda$lambda);
    return Zs;
}
;
function PolkadotRpcClient$stakingProgress$lambda$lambda(ae, pe) {
    Jl(ae, [
        "/pallets/staking/progress"
    ]);
    return Zs;
}
;
function PolkadotRpcClient$nominators$lambda(ae) {
    return function(pe) {
        pe.a8g(function PolkadotRpcClient$nominators$lambda$lambda(ae) {
            return function(pe, ye) {
                Jl(pe, [
                    "/pallets/staking/storage/nominators"
                ]);
                pe.r6m_1.w67("keys[]", ae);
                return Zs;
            };
        }(ae));
        return Zs;
    };
}
;
function PolkadotRpcClient$activeEra$lambda(ae) {
    ae.a8g(PolkadotRpcClient$activeEra$lambda$lambda);
    return Zs;
}
;
function PolkadotRpcClient$activeEra$lambda$lambda(ae, pe) {
    Jl(ae, [
        "/pallets/staking/storage/activeEra"
    ]);
    return Zs;
}
;
function PolkadotRpcClient$erasTotalStake$lambda(ae) {
    return function(pe) {
        pe.a8g(function PolkadotRpcClient$erasTotalStake$lambda$lambda(ae) {
            return function(pe, ye) {
                Jl(pe, [
                    "/pallets/staking/storage/erasTotalStake"
                ]);
                pe.r6m_1.w67("keys[]", ae.toString());
                return Zs;
            };
        }(ae));
        return Zs;
    };
}
;
function PolkadotRpcClient$totalIssuance$lambda(ae) {
    ae.a8g(PolkadotRpcClient$totalIssuance$lambda$lambda);
    return Zs;
}
;
function PolkadotRpcClient$totalIssuance$lambda$lambda(ae, pe) {
    Jl(ae, [
        "/pallets/balances/storage/totalIssuance"
    ]);
    return Zs;
}
;
function PolkadotRpcClient(ae, pe, ye) {
    uw.call(this, ae, pe);
    this.ruq_1 = ye;
}
;
this.oa_1 = 9;
this.su8_1 = `https://discover-cdn.trustwallet.com/public/config/${pathFor(this.qu8_1, this.ru8_1)}/chain-config.json`;
;
function VeChainRpcClient$getBestBlock$lambda(ae) {
    ae.a8g(VeChainRpcClient$getBestBlock$lambda$lambda);
    return As;
}
;
function VeChainRpcClient$getBestBlock$lambda$lambda(ae, pe) {
    ol(ae, [
        "/blocks/best"
    ]);
    return As;
}
;
function VeChainRpcClient$getAccounts$lambda(ae) {
    return function(pe) {
        pe.a8g(function VeChainRpcClient$getAccounts$lambda$lambda(ae) {
            return function(pe, ye) {
                ol(pe, [
                    `/accounts/${ae}`
                ]);
                return As;
            };
        }(ae));
        return As;
    };
}
;
function VeChainRpcClient$getBalanceOfContract$lambda(ae, pe) {
    return function(ye) {
        ye.a8g(function VeChainRpcClient$getBalanceOfContract$lambda$lambda(ae, pe) {
            return function(ye, es) {
                ol(ye, [
                    `/accounts/${ae}`
                ]);
                Ol(pe, "revision", "best");
                return As;
            };
        }(pe, ye));
        ql(ye, xl().f6d_1);
        const es = jl([
            Nl("data", zl(Mn($n().kqj(bn(ae, Ht())))))
        ]);
        if (es == null) {
            ye.d79_1 = Fl;
            let ss;
            const ns = ml(Dl);
            try {
                ss = dl(ml(Dl), gl([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ss = null;
            }
            const ts = new _l(ns, ss);
            ye.w7e(ts);
        } else if (es instanceof Bl) {
            ye.d79_1 = es;
            ye.w7e(null);
        } else {
            ye.d79_1 = es;
            let rs;
            const os = ml(Dl);
            try {
                rs = dl(ml(Dl), gl([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new _l(os, rs);
            ye.w7e(as);
        }
        return As;
    };
}
;
function VeChainRpcClient$estimateGas$lambda$lambda(ae, pe) {
    ol(ae, [
        "/accounts/*"
    ]);
    return As;
}
;
function VeChainRpcClient$estimateGas$lambda(ae) {
    return function(pe) {
        pe.a8g(VeChainRpcClient$estimateGas$lambda$lambda);
        ql(pe, xl().f6d_1);
        const ye = ae;
        if (ye == null) {
            pe.d79_1 = Fl;
            let es;
            const ss = ml(VeChainEstimateGasRequest);
            try {
                es = dl(ml(VeChainEstimateGasRequest), gl([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                es = null;
            }
            const ns = new _l(ss, es);
            pe.w7e(ns);
        } else if (ye instanceof Bl) {
            pe.d79_1 = ye;
            pe.w7e(null);
        } else {
            pe.d79_1 = ye;
            let ts;
            const rs = ml(VeChainEstimateGasRequest);
            try {
                ts = dl(ml(VeChainEstimateGasRequest), gl([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new _l(rs, ts);
            pe.w7e(os);
        }
        return As;
    };
}
;
function VeChainRpcClient$sendRawTransaction$lambda$lambda(ae, pe) {
    ol(ae, [
        "/transactions"
    ]);
    return As;
}
;
function VeChainRpcClient$sendRawTransaction$lambda(ae, pe) {
    return function(ye) {
        Ll(ye, ae);
        ye.a8g(VeChainRpcClient$sendRawTransaction$lambda$lambda);
        ql(ye, xl().f6d_1);
        const es = jl([
            Nl("raw", zl(pe))
        ]);
        if (es == null) {
            ye.d79_1 = Fl;
            let ss;
            const ns = ml(Dl);
            try {
                ss = dl(ml(Dl), gl([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ss = null;
            }
            const ts = new _l(ns, ss);
            ye.w7e(ts);
        } else if (es instanceof Bl) {
            ye.d79_1 = es;
            ye.w7e(null);
        } else {
            ye.d79_1 = es;
            let rs;
            const os = ml(Dl);
            try {
                rs = dl(ml(Dl), gl([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new _l(os, rs);
            ye.w7e(as);
        }
        return As;
    };
}
;
function VeChainRpcClient$getTransactionReceipt$lambda(ae) {
    return function(pe) {
        pe.a8g(function VeChainRpcClient$getTransactionReceipt$lambda$lambda(ae) {
            return function(pe, ye) {
                ol(pe, [
                    `/transactions/${ae}/receipt`
                ]);
                return As;
            };
        }(ae));
        return As;
    };
}
;
function VeChainRpcClient(ae, pe) {
    Wl.call(this, ae, pe);
}
;
this.s1cg_1 = Rs(function TonConnectModule$tonEnvironmentConfigurator$delegate$lambda(ae) {
    return function() {
        return new TonEnvironmentConfigurator("https://tonconnect.trustwallet.com/bridge", new TonDeviceInfo(ae.m1cg_1.tm6_1.d3_1, "TrustWallet", ae.m1cg_1.um6_1, 2, ks(new Feature("SendTransaction", 4))));
    };
}(this));
function SwapModule$trustSwapClient$delegate$lambda() {
    return new TrustSwapClient(_get_commonModule__y85r0s(SwapModule_getInstance()).em8(), "https://gateway.us.trustwallet.com");
}
;
function WalletKitUniversalModule$tronModule$delegate$lambda() {
    return new Jw(_get_commonModule__y85r0s(WalletKitUniversalModule_getInstance()).am8(), _get_commonModule__y85r0s(WalletKitUniversalModule_getInstance()).em8(), "https://gateway.us.trustwallet.com", _get_commonModule__y85r0s(WalletKitUniversalModule_getInstance()).tli(), _get_commonModule__y85r0s(WalletKitUniversalModule_getInstance()).fm8(), _get_commonModule__y85r0s(WalletKitUniversalModule_getInstance()).i56(), Nw().sm6(), _get_commonModule__y85r0s(WalletKitUniversalModule_getInstance()).rm7());
}
;
function WalletKitModule$ethKilnModule$delegate$lambda() {
    return new Ad(cd().sm6(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).em8(), "https://platform.trustwallet.com");
}
;
function WalletKitModule$vaultsModule$delegate$lambda() {
    return new Td(_get_commonModule__y85r0s(WalletKitModule_getInstance()).em8(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).nm7(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).tli(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).i56(), "https://platform.trustwallet.com", "https://gateway.us.trustwallet.com", "https://earn.twstg.net", cd().sm6(), _get_utilModule__riqk77(WalletKitModule_getInstance()).fu1(), _get_bscModule__o1cc31(WalletKitModule_getInstance()).wtc());
}
;
function WalletKitModule$tronModule$delegate$lambda() {
    return new xd(_get_commonModule__y85r0s(WalletKitModule_getInstance()).am8(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).em8(), "https://gateway.us.trustwallet.com", _get_commonModule__y85r0s(WalletKitModule_getInstance()).tli(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).fm8(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).i56(), cd().sm6(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).rm7());
}
;
function WalletKitModule$fioModule$delegate$lambda() {
    return new Yd(_get_commonModule__y85r0s(WalletKitModule_getInstance()).am8(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).tli(), _get_commonModule__y85r0s(WalletKitModule_getInstance()).em8(), "https://platform.trustwallet.com");
}
;
function createHttpClient(ae, pe, ye, es, ss) {
    let ns;
    ns = ye ? _get_net__e6de38(ae).aj9() : _get_net__e6de38(ae).yj8();
    return sn(ns, function CommonModule$createHttpClient$lambda(ae, pe, ye, es) {
        return function(ss) {
            Pn().h1tx(js, function CommonModule$createHttpClient$lambda$lambda(ae) {
                return function() {
                    return `installXOriginHeaderPlugin=${ae}`;
                };
            }(pe));
            if (ae.a28s_1.a28t_1.equals(LogMode_Debug_getInstance())) {
                const ns = On();
                ss.h7a(ns, CommonModule$createHttpClient$lambda$lambda_0);
            }
            if (pe) {
                ss.v79(ae.t28s_1);
            }
            const ts = xn();
            ss.h7a(ts, CommonModule$createHttpClient$lambda$lambda_1);
            const rs = qn();
            ss.h7a(rs, function CommonModule$createHttpClient$lambda$lambda_2(ae) {
                return function(pe) {
                    pe.u8e_1 = ae;
                    return xs;
                };
            }(es));
            if (ye != null) {
                zn(ss, ye, ae.kj7(), ae.a28s_1.e28t_1);
            }
            return xs;
        };
    }(ae, pe, ss, es));
}
;
Ss = this;
this.u28s_1 = "https://wallet-kit.trustwallet.com";
this.v28s_1 = new an(20000, 0);
this.w28s_1 = new an(300000, 0);
;
this.i28s_1 = Fs(function CommonModule$trustGatewayHttpClient$delegate$lambda(ae) {
    return function() {
        const pe = createHttpClient$default(ae, mn().equals(gn()), js, js, dn().aj7_1);
        hn(pe, _n()).k7x(pn());
        hn(pe, _n()).k7x(fn("https://gateway.us.trustwallet.com", "https://platform.trustwallet.com", "https://amber-api-stg.twinternal.net", js, ae.a28s_1.y28s_1.tm6_1.xm6_1, ae.a28s_1.y28s_1.um6_1, ae.pm6(), _get_fingerPrintRpcClient__ei18nz(ae), _get_trustAuthenticator__5ojm6o(ae)));
        return pe;
    };
}(this));
;
this.j28s_1 = Fs(function CommonModule$perpetualApiHttpClient$delegate$lambda(ae) {
    return function() {
        const pe = createHttpClient$default(ae, js, true, js, dn().aj7_1);
        hn(pe, _n()).k7x(pn());
        hn(pe, _n()).k7x(kn("https://perps.trustwallet.com", ae.a28s_1.y28s_1.tm6_1.xm6_1, ae.pm6(), ae.mm7()));
        return pe;
    };
}(this));
;
this.l28s_1 = Fs(function CommonModule$realtimeMessagingHttpClient$delegate$lambda(ae) {
    return function() {
        const pe = createHttpClient$default(ae, js, js, js, dn().dj7_1);
        hn(pe, _n()).k7x(pn());
        hn(pe, _n()).k7x(fn("https://gateway.us.trustwallet.com", "https://platform.trustwallet.com", "https://amber-api-stg.twinternal.net", js, ae.a28s_1.y28s_1.tm6_1.xm6_1, ae.a28s_1.y28s_1.um6_1, ae.pm6(), _get_fingerPrintRpcClient__ei18nz(ae), _get_trustAuthenticator__5ojm6o(ae)));
        return pe;
    };
}(this));
;
this.g1ui_1 = "https://assets-cdn.trustwallet.com";
this.h1ui_1 = "c60_t0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
this.i1ui_1 = "0x4B0F1812e5Df2A09796481Ff14017e6005508003";
function getCoinIconUrl_0(ae) {
    return `https://assets-cdn.trustwallet.com/blockchains/${_g.dim(ae)}/info/square_logo.png`;
}
;
ae = this.v1ui() ? getCoinIconUrl_0(this.ojo()) : `https://assets-cdn.trustwallet.com/blockchains/${this.qjr()}/assets/${this.m1rv()}/logo.png`;
this.u1vz_1 = "https://trustwallet.com/blog/how-to-stake-agoric-bld-and-earn-rewards-using-trust-wallet";
this.v1vz_1 = "https://trustwallet.com/blog/how-to-stake-akash-akt-earn-rewards-using-trust-wallet";
this.w1vz_1 = "https://community.trustwallet.com/t/how-to-stake-algorand/198";
this.x1vz_1 = "https://trustwallet.com/blog/how-to-stake-cosmos-atom-and-earn-rewards-using-trust-wallet";
this.y1vz_1 = "https://trustwallet.com/blog/how-to-stake-axelar-axl-and-earn-rewards-using-trust-wallet";
this.z1vz_1 = "https://trustwallet.com/blog/how-to-stake-bnb-and-earn-yield-using-trust-wallet";
this.a1w0_1 = "https://trustwallet.com/blog/how-to-stake-cardano-ada-and-earn-rewards-using-trust-wallet";
this.b1w0_1 = "https://trustwallet.com/blog/how-to-stake-cronos-cro-and-earn-rewards-using-trust-wallet";
this.c1w0_1 = "https://trustwallet.com/blog/how-to-stake-ethereum-eth-using-trust-wallet";
this.d1w0_1 = "https://trustwallet.com/blog/how-to-stake-ethereum-eth-using-trust-wallet";
this.e1w0_1 = "https://trustwallet.com/blog/how-to-stake-injective-inj-and-earn-rewards-using-trust-wallet";
this.f1w0_1 = "https://trustwallet.com/blog/how-to-stake-juno-earn-rewards-using-trust-wallet";
this.g1w0_1 = "https://trustwallet.com/blog/how-to-stake-kava-and-earn-rewards-using-trust-wallet";
this.h1w0_1 = "https://trustwallet.com/blog/how-to-stake-kusama-ksm-earn-rewards-using-trust-wallet";
this.i1w0_1 = "https://trustwallet.com/blog/how-to-stake-near-and-earn-rewards-using-trust-wallet";
this.j1w0_1 = "https://trustwallet.com/blog/how-to-stake-osmosis-osmo-and-earn-rewards-using-trust-wallet";
this.k1w0_1 = "https://trustwallet.com/blog/how-to-stake-polkadot-dot-and-earn-rewards-using-trust-wallet";
this.l1w0_1 = "https://trustwallet.com/blog/how-to-stake-sei-and-earn-rewards-using-trust-wallet";
this.m1w0_1 = "https://trustwallet.com/blog/how-to-stake-solana-and-earn-rewards-using-trust-wallet";
this.n1w0_1 = "https://trustwallet.com/blog/how-to-stake-stargaze-and-earn-rewards-using-trust-wallet";
this.o1w0_1 = "https://trustwallet.com/blog/how-to-stake-stride-strd-and-earn-rewards-using-trust-wallet";
this.p1w0_1 = "https://trustwallet.com/blog/how-to-stake-sui-and-earn-rewards-using-trust-wallet";
this.q1w0_1 = "https://trustwallet.com/blog/how-to-stake-terra-classic-lunc-and-earn-rewards-using-trust-wallet";
this.r1w0_1 = "https://trustwallet.com/blog/how-to-stake-tezos-xtz-and-earn-rewards-using-trust-wallet";
this.s1w0_1 = "https://trustwallet.com/blog/how-to-stake-tron-trx-and-earn-yield-using-trust-wallet";
this.t1w0_1 = "https://blog.trustwallet.com/blog/unstaking-process-for-eth-in-trust-wallet";
this.u1w0_1 = "https://gov.tools/drep_directory";
this.v1w0_1 = "https://gov.tools/";
this.w1w0_1 = "https://community.trustwallet.com/";
this.x1w0_1 = "https://blog.trustwallet.com/blog/";
this.y1w0_1 = "https://trustwallet.com/";
this.z1w0_1 = "https://trustwallet.com/blog/";
this.a1w1_1 = "https://short.trustwallet.com/";
this.b1w1_1 = "https://support.trustwallet.com/";
this.c1w1_1 = "https://trustwallet.com/terms-of-services";
this.d1w1_1 = "https://support.trustwallet.com/en/support/solutions/articles/67000731431-how-to-add-a-custom-token";
this.e1w1_1 = "https://trustwallet.com/ai-supplement";
this.f1w1_1 = "https://trustwallet.com/risk";
this.g1w1_1 = "https://trustwallet.com/staking-risks";
this.h1w1_1 = "https://trustwallet.com/earn-rewards-with-staking";
this.i1w1_1 = "https://short.trustwallet.com/ETH-Staking-Earn-Page-Banner";
this.j1w1_1 = "https://trustwallet.com/blog/announcements/stablecoin-market-tutorial-guide";
this.k1w1_1 = "https://short.trustwallet.com/StablecoinEarn-EarnPage";
this.l1w1_1 = "https://short.trustwallet.com/stablecoin-learn-more";
this.m1w1_1 = "https://short.trustwallet.com/earn-terms";
this.n1w1_1 = "https://community.trustwallet.com/t/transaction-status";
this.o1w1_1 = "https://short.trustwallet.com/flexgas-blog-in-app";
this.p1w1_1 = "https://trustwallet.com/blog/guide/prediction-markets-country-regional-availability";
this.q1w1_1 = "https://docs.google.com/document/d/1CaX4RkQmTQTX3rAq7NGXaPUH2ovCmxIWV8p3eQ6kql0/edit?usp=sharing";
this.r1w1_1 = "https://community.trustwallet.com/t/trust-wallet-adds-a-scam-prevention-update-aimed-at-tron-multi-sig-scams/534456";
this.s1w1_1 = "https://trustwallet.com/browser-extension";
this.t1w1_1 = "https://short.trustwallet.com/About-Trust-Alpha";
this.u1w1_1 = "https://short.trustwallet.com/premium-app";
this.v1w1_1 = "https://blog.trustwallet.com/blog/announcements/introducing-trust-alpha-early-access-and-real-rewards-powered-by-twt";
ns(Staking, "Staking");
ns(TwLinks, "TwLinks");
ss(TwLinks).w1w1 = function(ae) {
    switch(ae.e3_1){
        case 109:
            return ye.u1vz_1;
        case 130:
            return ye.v1vz_1;
        case 56:
            return ye.w1vz_1;
        case 116:
            return ye.y1vz_1;
        case 2:
        case 63:
            return ye.z1vz_1;
        case 7:
            return ye.a1w0_1;
        case 8:
            return ye.x1vz_1;
        case 76:
            return ye.b1w0_1;
        case 16:
            return ye.c1w0_1;
        case 114:
            return ye.f1w0_1;
        case 23:
            return ye.g1w0_1;
        case 57:
            return ye.h1w0_1;
        case 93:
            return ye.d1w0_1;
        case 108:
            return ye.e1w0_1;
        case 30:
            return ye.i1w0_1;
        case 79:
            return ye.j1w0_1;
        case 58:
            return ye.k1w0_1;
        case 141:
            return ye.l1w0_1;
        case 36:
            return ye.m1w0_1;
        case 112:
            return ye.n1w0_1;
        case 115:
            return ye.o1w0_1;
        case 111:
            return ye.p1w0_1;
        case 53:
            return ye.q1w0_1;
        case 38:
            return ye.r1w0_1;
        case 43:
            return ye.s1w0_1;
        default:
            return "https://community.trustwallet.com/";
    }
};
ss(TwLinks).x1w1 = function(ae) {
    if (ae.e3_1 === 16) {
        return "https://blog.trustwallet.com/blog/unstaking-process-for-eth-in-trust-wallet";
    }
    return this.w1w1(ae);
};
ss(TwLinks).y1w1 = function() {
    return "https://trustwallet.com/blog/announcements/stablecoin-market-tutorial-guide";
};
ye = new Staking;
es = new TwLinks;
ae.$_$ = ae.$_$ || {};
ae.$_$.a = es;
wm = this;
this.p1wq_1 = new sd("staking-c60", "Ethereum (ETH)", "", "trust://open_coin?asset=c60", "https://assets-cdn.trustwallet.com/blockchains/ethereum/info/square_logo.png", "asset_apr", new Yg(null, 0, 0, 0, 0, null, null, null), Lm());
function DatabaseManager$writeDatabase$slambda$lambda(r1vu) {
    return function() {
        return `[TSDK-DB]: Write failed: ${r1vu.message}`;
    };
}
;
function DatabaseManager$writeDatabase$slambda(ae, pe, ye) {
    this.x1vt_1 = ae;
    this.y1vt_1 = pe;
    qs.call(this, ye);
}
;
function DatabaseManager() {
    this.s1vu_1 = new Rn;
}
;
function RealDatabaseManager$provideDb$lambda(o1vv) {
    return function() {
        return `[TSDK-DB]: Migration failed [to version: ${ms.f1vr().r7c().toString()}]: ${o1vv.message}`;
    };
}
;
function RealDatabaseManager(ae, pe) {
    DatabaseManager.call(this);
    this.q1vv_1 = ae;
    this.r1vv_1 = pe;
    this.s1vv_1 = null;
    this.t1vv_1 = null;
}
;
As(Adapter, "Adapter");
As(Adapter_0, "Adapter");
As(Adapter_1, "Adapter");
As(AssetQueries, "AssetQueries", Ts, Cs, Ts, [
    1,
    0,
    5,
    2,
    4
]);
As(Adapter_2, "Adapter");
As(Adapter_3, "Adapter");
As(Adapter_4, "Adapter");
As(EarnPortfolio, "EarnPortfolio");
As(SelectPortfolioQuery, "SelectPortfolioQuery", Ts, Os);
Ns($upsertPortfolioCOROUTINE$26, qs);
As(EarnPortfolioQueries, "EarnPortfolioQueries", Ts, Cs, Ts, [
    4,
    2,
    0
]);
As(FeePriorityQueries, "FeePriorityQueries", Ts, Cs, Ts, [
    7,
    1,
    2
]);
As(HomepageCacheQueries, "HomepageCacheQueries", Ts, Cs, Ts, [
    1,
    2,
    0
]);
As(LaunchpoolQueries, "LaunchpoolQueries", Ts, Cs, Ts, [
    1,
    0,
    2
]);
As(Adapter_5, "Adapter");
As(LaunchpoolRewardQueries, "LaunchpoolRewardQueries", Ts, Cs, Ts, [
    1,
    0,
    2
]);
As(Adapter_6, "Adapter");
As(MarketQueries, "MarketQueries", Ts, Cs, Ts, [
    1,
    2,
    0
]);
As(PerpetualAssetIcon, "PerpetualAssetIcon");
As(PerpetualBracketRisk, "PerpetualBracketRisk");
As(PerpetualExchangeSymbol, "PerpetualExchangeSymbol");
Ns($upsertLeverageCOROUTINE$50, qs);
Ns($deleteAllLeverageCOROUTINE$52, qs);
Ns($upsertExchangeSymbolCOROUTINE$53, qs);
Ns($deleteAllExchangeSymbolsCOROUTINE$54, qs);
Ns($upsertAssetIconCOROUTINE$55, qs);
Ns($deleteAllAssetIconsCOROUTINE$56, qs);
Ns($upsertOrderedSymbolCOROUTINE$57, qs);
Ns($deleteAllOrderedSymbolsCOROUTINE$58, qs);
Ns($upsertBracketRiskCOROUTINE$59, qs);
Ns($deleteAllBracketRisksCOROUTINE$60, qs);
Ns($upsertFavoriteSymbolCOROUTINE$61, qs);
Ns($deleteFavoriteSymbolCOROUTINE$62, qs);
Ns($deleteAllFavoriteSymbolsCOROUTINE$63, qs);
As(PerpetualQueries, "PerpetualQueries", Ts, Cs, Ts, [
    2,
    1,
    0,
    14,
    8
]);
As(PerpetualUserLeverage, "PerpetualUserLeverage");
As(PriceAlertQueries, "PriceAlertQueries", Ts, Cs, Ts, [
    1,
    0,
    2
]);
As(StablecoinBalanceChangeQueries, "StablecoinBalanceChangeQueries", Ts, Cs, Ts, [
    4,
    2,
    1,
    0
]);
As(StablecoinPopupStatusQueries, "StablecoinPopupStatusQueries", Ts, Cs, Ts, [
    4,
    2,
    0
]);
As(SwapQueries, "SwapQueries", Ts, Cs, Ts, [
    4,
    0,
    2
]);
As(Adapter_7, "Adapter");
As(Adapter_8, "Adapter");
As(TokenLockerPositionQueries, "TokenLockerPositionQueries", Ts, Cs, Ts, [
    1,
    2
]);
Us(Companion);
Ks(TrustSDKDB, "TrustSDKDB", Ts, Ts, Ts, [
    2
]);
As(sam$kotlin_Comparator$0, "sam$kotlin_Comparator$0", Ts, Ts, [
    Zs,
    Vs
]);
Qs(TrustSDKDBImpl$Schema$create$slambda, qs, Ts, [
    0
]);
Qs(TrustSDKDBImpl$Schema$migrateInternal$slambda, qs, Ts, [
    0
]);
Qs(TrustSDKDBImpl$Schema$migrate$slambda, qs, Ts, [
    0
]);
mn(Schema, "Schema", Ts, Ts, [
    wn
]);
As(TrustSDKDBImpl, "TrustSDKDBImpl", Ts, Cs, [
    Cs,
    TrustSDKDB
], [
    2
]);
Qs(DatabaseManager$writeDatabase$slambda, qs, Ts, [
    0
]);
As(DatabaseManager, "DatabaseManager", Ts, Ts, Ts, [
    1,
    0
]);
Ns($provideDbCOROUTINE$78, qs);
As(RealDatabaseManager, "RealDatabaseManager", Ts, DatabaseManager, Ts, [
    0,
    1
]);
Qs(SaveableSqlDriver$notifyListeners$slambda, qs, Ts, [
    1
]);
As(SaveableSqlDriver, "SaveableSqlDriver", Ts, Ts, [
    Tn
]);
mn(BigDecimalColumnAdapter, "BigDecimalColumnAdapter");
mn(BigIntegerColumnAdapter, "BigIntegerColumnAdapter");
mn(LongColumnAdapter, "LongColumnAdapter");
mn(SecurityItemTypeColumnAdapter, "SecurityItemTypeColumnAdapter");
Us(Companion_0);
As(SecurityItemType, "SecurityItemType", Ts, Nn);
mn(UIntColumnAdapter, "UIntColumnAdapter");
mn(ULongColumnAdapter, "ULongColumnAdapter");
Qs(provideDbDriver$slambda, qs, Ts, [
    0
]);
Qs(onSave$slambda, qs, Ts, [
    0
]);
Ns($provideDbDriverCOROUTINE$79, qs);
Ns($onSaveCOROUTINE$80, qs);
Ns($initChromeDbCOROUTINE$81, qs);
As(JsSqlDriver, "JsSqlDriver", Ts, Ts, [
    Tn
]);
As(JsSqlCursor, "JsSqlCursor");
As(JsSqlPreparedStatement, "JsSqlPreparedStatement");
Ns($initSqlDriverCOROUTINE$82, qs);
As(compressUtf8$buffer$1);
As(decompressUtf8$1);
Ss(EarnPortfolio).toString = function() {
    return `EarnPortfolio(wallet_id=${this.w1vh_1}, currency_code=${this.x1vh_1}, portfolio_json=${this.y1vh_1}, updated_at=${this.z1vh_1.toString()})`;
};
Ss(EarnPortfolio).hashCode = function() {
    let ae = Is(this.w1vh_1);
    ae = ys(ae, 31) + Is(this.x1vh_1) | 0;
    ae = ys(ae, 31) + Is(this.y1vh_1) | 0;
    return ae = ys(ae, 31) + this.z1vh_1.hashCode() | 0;
};
Ss(EarnPortfolio).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof EarnPortfolio)) {
        return false;
    }
    const pe = ae instanceof EarnPortfolio ? ae : Es();
    return this.w1vh_1 === pe.w1vh_1 && this.x1vh_1 === pe.x1vh_1 && this.y1vh_1 === pe.y1vh_1 && !!this.z1vh_1.equals(pe.z1vh_1);
};
Ss(SelectPortfolioQuery).w1vf = function(ae) {
    this.d1vi_1.m1vg_1.k1vg([
        "EarnPortfolio"
    ], ae);
};
Ss(SelectPortfolioQuery).x1vf = function(ae) {
    this.d1vi_1.m1vg_1.l1vg([
        "EarnPortfolio"
    ], ae);
};
Ss(SelectPortfolioQuery).z1vf = function(ae) {
    return this.d1vi_1.m1vg_1.j1vg(689013352, "SELECT EarnPortfolio.wallet_id, EarnPortfolio.currency_code, EarnPortfolio.portfolio_json, EarnPortfolio.updated_at FROM EarnPortfolio WHERE wallet_id = ? AND currency_code = ?", ae, 2, function EarnPortfolioQueries$SelectPortfolioQuery$execute$lambda(ae) {
        return function(pe) {
            pe.e1vi(0, ae.b1vi_1);
            pe.e1vi(1, ae.c1vi_1);
            return Ps;
        };
    }(this));
};
Ss(SelectPortfolioQuery).toString = function() {
    return "EarnPortfolio.sq:selectPortfolio";
};
Ss($upsertPortfolioCOROUTINE$26).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.q1vi_1.m1vg_1.a1vh(-800348267, "INSERT OR REPLACE INTO EarnPortfolio (wallet_id, currency_code, portfolio_json, updated_at)\nVALUES (?, ?, ?, ?)", 4, EarnPortfolioQueries$upsertPortfolio$lambda(this.r1vi_1, this.s1vi_1, this.t1vi_1, this.u1vi_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.q1vi_1.n1vg(-800348267, EarnPortfolioQueries$upsertPortfolio$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(EarnPortfolioQueries).w1vi = function(ae, pe, ye) {
    return new SelectPortfolioQuery(this, ae, pe, function EarnPortfolioQueries$selectPortfolio$lambda(ae) {
        return function(pe) {
            return ae(xs(pe.f1vi(0)), xs(pe.f1vi(1)), xs(pe.f1vi(2)), xs(pe.g1vi(3)));
        };
    }(ye));
};
Ss(EarnPortfolioQueries).x1vi = function(ae, pe) {
    return this.w1vi(ae, pe, EarnPortfolioQueries$selectPortfolio$lambda_0);
};
Ss(EarnPortfolioQueries).y1vi = function(ae, pe, ye, es, ss) {
    const ns = new $upsertPortfolioCOROUTINE$26(this, ae, pe, ye, es, ss);
    ns.pa_1 = Ps;
    ns.qa_1 = null;
    return ns.va();
};
Ss(PerpetualAssetIcon).toString = function() {
    return `PerpetualAssetIcon(assetCode=${this.g1vj_1}, logoUrl=${this.h1vj_1})`;
};
Ss(PerpetualAssetIcon).hashCode = function() {
    let ae = Is(this.g1vj_1);
    return ae = ys(ae, 31) + Is(this.h1vj_1) | 0;
};
Ss(PerpetualAssetIcon).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof PerpetualAssetIcon)) {
        return false;
    }
    const pe = ae instanceof PerpetualAssetIcon ? ae : Es();
    return this.g1vj_1 === pe.g1vj_1 && this.h1vj_1 === pe.h1vj_1;
};
Ss(PerpetualBracketRisk).toString = function() {
    return `PerpetualBracketRisk(symbol=${this.i1vj_1}, level=${this.j1vj_1.toString()}, maintenanceMarginRate=${this.k1vj_1}, notionalCap=${this.l1vj_1}, notionalFloor=${this.m1vj_1}, cumMaintenanceAmount=${this.n1vj_1}, maxOpenPosLeverage=${this.o1vj_1.toString()}, minOpenPosLeverage=${this.p1vj_1.toString()})`;
};
Ss(PerpetualBracketRisk).hashCode = function() {
    let ae = Is(this.i1vj_1);
    ae = ys(ae, 31) + this.j1vj_1.hashCode() | 0;
    ae = ys(ae, 31) + js(this.k1vj_1) | 0;
    ae = ys(ae, 31) + js(this.l1vj_1) | 0;
    ae = ys(ae, 31) + js(this.m1vj_1) | 0;
    ae = ys(ae, 31) + js(this.n1vj_1) | 0;
    ae = ys(ae, 31) + this.o1vj_1.hashCode() | 0;
    return ae = ys(ae, 31) + this.p1vj_1.hashCode() | 0;
};
Ss(PerpetualBracketRisk).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof PerpetualBracketRisk)) {
        return false;
    }
    const pe = ae instanceof PerpetualBracketRisk ? ae : Es();
    return this.i1vj_1 === pe.i1vj_1 && !!this.j1vj_1.equals(pe.j1vj_1) && !!Ds(this.k1vj_1, pe.k1vj_1) && !!Ds(this.l1vj_1, pe.l1vj_1) && !!Ds(this.m1vj_1, pe.m1vj_1) && !!Ds(this.n1vj_1, pe.n1vj_1) && !!this.o1vj_1.equals(pe.o1vj_1) && !!this.p1vj_1.equals(pe.p1vj_1);
};
Ss(PerpetualExchangeSymbol).toString = function() {
    return `PerpetualExchangeSymbol(symbol=${this.q1vj_1}, pair=${this.r1vj_1}, status=${this.s1vj_1}, baseAsset=${this.t1vj_1}, quoteAsset=${this.u1vj_1}, marginAsset=${this.v1vj_1}, quantityPrecision=${this.w1vj_1.toString()}, baseAssetPrecision=${this.x1vj_1.toString()}, quotePrecision=${Bs(this.y1vj_1)}, name=${this.z1vj_1}, filtersJson=${this.a1vk_1}, symbolSubtypes=${this.b1vk_1}, symbolSchedule=${this.c1vk_1.toString()}, stepSize=${this.d1vk_1.toString()})`;
};
Ss(PerpetualExchangeSymbol).hashCode = function() {
    let ae = Is(this.q1vj_1);
    ae = ys(ae, 31) + Is(this.r1vj_1) | 0;
    ae = ys(ae, 31) + Is(this.s1vj_1) | 0;
    ae = ys(ae, 31) + Is(this.t1vj_1) | 0;
    ae = ys(ae, 31) + Is(this.u1vj_1) | 0;
    ae = ys(ae, 31) + Is(this.v1vj_1) | 0;
    ae = ys(ae, 31) + this.w1vj_1.hashCode() | 0;
    ae = ys(ae, 31) + this.x1vj_1.hashCode() | 0;
    ae = ys(ae, 31) + (this.y1vj_1 == null ? 0 : this.y1vj_1.hashCode()) | 0;
    ae = ys(ae, 31) + Is(this.z1vj_1) | 0;
    ae = ys(ae, 31) + Is(this.a1vk_1) | 0;
    ae = ys(ae, 31) + Is(this.b1vk_1) | 0;
    ae = ys(ae, 31) + this.c1vk_1.hashCode() | 0;
    return ae = ys(ae, 31) + this.d1vk_1.hashCode() | 0;
};
Ss(PerpetualExchangeSymbol).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof PerpetualExchangeSymbol)) {
        return false;
    }
    const pe = ae instanceof PerpetualExchangeSymbol ? ae : Es();
    return this.q1vj_1 === pe.q1vj_1 && this.r1vj_1 === pe.r1vj_1 && this.s1vj_1 === pe.s1vj_1 && this.t1vj_1 === pe.t1vj_1 && this.u1vj_1 === pe.u1vj_1 && this.v1vj_1 === pe.v1vj_1 && !!this.w1vj_1.equals(pe.w1vj_1) && !!this.x1vj_1.equals(pe.x1vj_1) && !!Ds(this.y1vj_1, pe.y1vj_1) && this.z1vj_1 === pe.z1vj_1 && this.a1vk_1 === pe.a1vk_1 && this.b1vk_1 === pe.b1vk_1 && !!this.c1vk_1.equals(pe.c1vk_1) && !!this.d1vk_1.equals(pe.d1vk_1);
};
Ss($upsertLeverageCOROUTINE$50).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.o1vk_1.m1vg_1.a1vh(-314168906, "INSERT OR REPLACE INTO PerpetualUserLeverage (symbol, leverage)\nVALUES (?, ?)", 2, PerpetualQueries$upsertLeverage$lambda(this.p1vk_1, this.q1vk_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.o1vk_1.n1vg(-314168906, PerpetualQueries$upsertLeverage$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteAllLeverageCOROUTINE$52).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.z1vk_1.m1vg_1.b1vh(-1936341031, "DELETE FROM PerpetualUserLeverage", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.z1vk_1.n1vg(-1936341031, PerpetualQueries$deleteAllLeverage$lambda);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($upsertExchangeSymbolCOROUTINE$53).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.i1vl_1.m1vg_1.a1vh(1915802972, "INSERT OR REPLACE INTO PerpetualExchangeSymbol (symbol, pair, status, baseAsset, quoteAsset, marginAsset, quantityPrecision, baseAssetPrecision, quotePrecision, name, filtersJson, symbolSubtypes, symbolSchedule, stepSize)\nVALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 14, PerpetualQueries$upsertExchangeSymbol$lambda(this.j1vl_1, this.k1vl_1, this.l1vl_1, this.m1vl_1, this.n1vl_1, this.o1vl_1, this.p1vl_1, this.q1vl_1, this.r1vl_1, this.s1vl_1, this.t1vl_1, this.u1vl_1, this.v1vl_1, this.w1vl_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.i1vl_1.n1vg(1915802972, PerpetualQueries$upsertExchangeSymbol$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteAllExchangeSymbolsCOROUTINE$54).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.f1vm_1.m1vg_1.b1vh(1530239764, "DELETE FROM PerpetualExchangeSymbol", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.f1vm_1.n1vg(1530239764, PerpetualQueries$deleteAllExchangeSymbols$lambda);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($upsertAssetIconCOROUTINE$55).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.o1vm_1.m1vg_1.a1vh(1815954216, "INSERT OR REPLACE INTO PerpetualAssetIcon (assetCode, logoUrl)\nVALUES (?, ?)", 2, PerpetualQueries$upsertAssetIcon$lambda(this.p1vm_1, this.q1vm_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.o1vm_1.n1vg(1815954216, PerpetualQueries$upsertAssetIcon$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteAllAssetIconsCOROUTINE$56).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.z1vm_1.m1vg_1.b1vh(625722286, "DELETE FROM PerpetualAssetIcon", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.z1vm_1.n1vg(625722286, PerpetualQueries$deleteAllAssetIcons$lambda);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($upsertOrderedSymbolCOROUTINE$57).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.i1vn_1.m1vg_1.a1vh(1009667204, "INSERT OR REPLACE INTO PerpetualOrderedSymbol (orderIndex, symbol)\nVALUES (?, ?)", 2, PerpetualQueries$upsertOrderedSymbol$lambda(this.j1vn_1, this.k1vn_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.i1vn_1.n1vg(1009667204, PerpetualQueries$upsertOrderedSymbol$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteAllOrderedSymbolsCOROUTINE$58).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.t1vn_1.m1vg_1.b1vh(1169587282, "DELETE FROM PerpetualOrderedSymbol", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.t1vn_1.n1vg(1169587282, PerpetualQueries$deleteAllOrderedSymbols$lambda);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($upsertBracketRiskCOROUTINE$59).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.c1vo_1.m1vg_1.a1vh(177482614, "INSERT OR REPLACE INTO PerpetualBracketRisk (symbol, level, maintenanceMarginRate, notionalCap, notionalFloor, cumMaintenanceAmount, maxOpenPosLeverage, minOpenPosLeverage)\nVALUES (?, ?, ?, ?, ?, ?, ?, ?)", 8, PerpetualQueries$upsertBracketRisk$lambda(this.d1vo_1, this.e1vo_1, this.f1vo_1, this.g1vo_1, this.h1vo_1, this.i1vo_1, this.j1vo_1, this.k1vo_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.c1vo_1.n1vg(177482614, PerpetualQueries$upsertBracketRisk$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteAllBracketRisksCOROUTINE$60).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.t1vo_1.m1vg_1.b1vh(1546590304, "DELETE FROM PerpetualBracketRisk", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.t1vo_1.n1vg(1546590304, PerpetualQueries$deleteAllBracketRisks$lambda);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($upsertFavoriteSymbolCOROUTINE$61).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.c1vp_1.m1vg_1.a1vh(615698965, "INSERT OR IGNORE INTO PerpetualFavoriteSymbol (symbol)\nVALUES (?)", 1, PerpetualQueries$upsertFavoriteSymbol$lambda(this.d1vp_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.c1vp_1.n1vg(615698965, PerpetualQueries$upsertFavoriteSymbol$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteFavoriteSymbolCOROUTINE$62).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.m1vp_1.m1vg_1.a1vh(200062353, "DELETE FROM PerpetualFavoriteSymbol WHERE symbol = ?", 1, PerpetualQueries$deleteFavoriteSymbol$lambda(this.n1vp_1)).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.m1vp_1.n1vg(200062353, PerpetualQueries$deleteFavoriteSymbol$lambda_0);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($deleteAllFavoriteSymbolsCOROUTINE$63).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.w1vp_1.m1vg_1.b1vh(-118278789, "DELETE FROM PerpetualFavoriteSymbol", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.w1vp_1.n1vg(-118278789, PerpetualQueries$deleteAllFavoriteSymbols$lambda);
                    return Ps;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(PerpetualQueries).y1vp = function(ae) {
    return Fs(-482407448, [
        "PerpetualUserLeverage"
    ], this.m1vg_1, "Perpetual.sq", "selectAllLeverage", "SELECT PerpetualUserLeverage.symbol, PerpetualUserLeverage.leverage FROM PerpetualUserLeverage", function PerpetualQueries$selectAllLeverage$lambda(ae) {
        return function(pe) {
            return ae(xs(pe.f1vi(0)), xs(pe.g1vi(1)));
        };
    }(ae));
};
Ss(PerpetualQueries).z1vp = function() {
    return this.y1vp(PerpetualQueries$selectAllLeverage$lambda_0);
};
Ss(PerpetualQueries).a1vq = function(ae) {
    return Fs(-896960475, [
        "PerpetualExchangeSymbol"
    ], this.m1vg_1, "Perpetual.sq", "selectAllExchangeSymbols", "SELECT PerpetualExchangeSymbol.symbol, PerpetualExchangeSymbol.pair, PerpetualExchangeSymbol.status, PerpetualExchangeSymbol.baseAsset, PerpetualExchangeSymbol.quoteAsset, PerpetualExchangeSymbol.marginAsset, PerpetualExchangeSymbol.quantityPrecision, PerpetualExchangeSymbol.baseAssetPrecision, PerpetualExchangeSymbol.quotePrecision, PerpetualExchangeSymbol.name, PerpetualExchangeSymbol.filtersJson, PerpetualExchangeSymbol.symbolSubtypes, PerpetualExchangeSymbol.symbolSchedule, PerpetualExchangeSymbol.stepSize FROM PerpetualExchangeSymbol", function PerpetualQueries$selectAllExchangeSymbols$lambda(ae) {
        return function(pe) {
            return ae(xs(pe.f1vi(0)), xs(pe.f1vi(1)), xs(pe.f1vi(2)), xs(pe.f1vi(3)), xs(pe.f1vi(4)), xs(pe.f1vi(5)), xs(pe.g1vi(6)), xs(pe.g1vi(7)), pe.g1vi(8), xs(pe.f1vi(9)), xs(pe.f1vi(10)), xs(pe.f1vi(11)), xs(pe.g1vi(12)), xs(pe.g1vi(13)));
        };
    }(ae));
};
Ss(PerpetualQueries).b1vq = function() {
    return this.a1vq(PerpetualQueries$selectAllExchangeSymbols$lambda_0);
};
Ss(PerpetualQueries).c1vq = function(ae) {
    return Fs(1991524349, [
        "PerpetualAssetIcon"
    ], this.m1vg_1, "Perpetual.sq", "selectAllAssetIcons", "SELECT PerpetualAssetIcon.assetCode, PerpetualAssetIcon.logoUrl FROM PerpetualAssetIcon", function PerpetualQueries$selectAllAssetIcons$lambda(ae) {
        return function(pe) {
            return ae(xs(pe.f1vi(0)), xs(pe.f1vi(1)));
        };
    }(ae));
};
Ss(PerpetualQueries).d1vq = function() {
    return this.c1vq(PerpetualQueries$selectAllAssetIcons$lambda_0);
};
Ss(PerpetualQueries).e1vq = function() {
    return Fs(2061121825, [
        "PerpetualOrderedSymbol"
    ], this.m1vg_1, "Perpetual.sq", "selectAllOrderedSymbols", "SELECT symbol FROM PerpetualOrderedSymbol ORDER BY orderIndex ASC", PerpetualQueries$selectAllOrderedSymbols$lambda);
};
Ss(PerpetualQueries).f1vq = function(ae) {
    return Fs(-177619729, [
        "PerpetualBracketRisk"
    ], this.m1vg_1, "Perpetual.sq", "selectAllBracketRisks", "SELECT PerpetualBracketRisk.symbol, PerpetualBracketRisk.level, PerpetualBracketRisk.maintenanceMarginRate, PerpetualBracketRisk.notionalCap, PerpetualBracketRisk.notionalFloor, PerpetualBracketRisk.cumMaintenanceAmount, PerpetualBracketRisk.maxOpenPosLeverage, PerpetualBracketRisk.minOpenPosLeverage FROM PerpetualBracketRisk", function PerpetualQueries$selectAllBracketRisks$lambda(ae) {
        return function(pe) {
            return ae(xs(pe.f1vi(0)), xs(pe.g1vi(1)), xs(pe.e1vk(2)), xs(pe.e1vk(3)), xs(pe.e1vk(4)), xs(pe.e1vk(5)), xs(pe.g1vi(6)), xs(pe.g1vi(7)));
        };
    }(ae));
};
Ss(PerpetualQueries).g1vq = function() {
    return this.f1vq(PerpetualQueries$selectAllBracketRisks$lambda_0);
};
Ss(PerpetualQueries).h1vq = function() {
    return Fs(1749488268, [
        "PerpetualFavoriteSymbol"
    ], this.m1vg_1, "Perpetual.sq", "selectAllFavoriteSymbols", "SELECT symbol FROM PerpetualFavoriteSymbol", PerpetualQueries$selectAllFavoriteSymbols$lambda);
};
Ss(PerpetualQueries).i1vq = function(ae, pe, ye) {
    const es = new $upsertLeverageCOROUTINE$50(this, ae, pe, ye);
    es.pa_1 = Ps;
    es.qa_1 = null;
    return es.va();
};
Ss(PerpetualQueries).j1vq = function(ae) {
    const pe = new $deleteAllLeverageCOROUTINE$52(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(PerpetualQueries).k1vq = function(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us, ls, ms, gs) {
    const ds = new $upsertExchangeSymbolCOROUTINE$53(this, ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us, ls, ms, gs);
    ds.pa_1 = Ps;
    ds.qa_1 = null;
    return ds.va();
};
Ss(PerpetualQueries).l1vq = function(ae) {
    const pe = new $deleteAllExchangeSymbolsCOROUTINE$54(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(PerpetualQueries).m1vq = function(ae, pe, ye) {
    const es = new $upsertAssetIconCOROUTINE$55(this, ae, pe, ye);
    es.pa_1 = Ps;
    es.qa_1 = null;
    return es.va();
};
Ss(PerpetualQueries).n1vq = function(ae) {
    const pe = new $deleteAllAssetIconsCOROUTINE$56(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(PerpetualQueries).o1vq = function(ae, pe, ye) {
    const es = new $upsertOrderedSymbolCOROUTINE$57(this, ae, pe, ye);
    es.pa_1 = Ps;
    es.qa_1 = null;
    return es.va();
};
Ss(PerpetualQueries).p1vq = function(ae) {
    const pe = new $deleteAllOrderedSymbolsCOROUTINE$58(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(PerpetualQueries).q1vq = function(ae, pe, ye, es, ss, ns, ts, rs, os) {
    const as = new $upsertBracketRiskCOROUTINE$59(this, ae, pe, ye, es, ss, ns, ts, rs, os);
    as.pa_1 = Ps;
    as.qa_1 = null;
    return as.va();
};
Ss(PerpetualQueries).r1vq = function(ae) {
    const pe = new $deleteAllBracketRisksCOROUTINE$60(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(PerpetualQueries).s1vq = function(ae, pe) {
    const ye = new $upsertFavoriteSymbolCOROUTINE$61(this, ae, pe);
    ye.pa_1 = Ps;
    ye.qa_1 = null;
    return ye.va();
};
Ss(PerpetualQueries).t1vq = function(ae, pe) {
    const ye = new $deleteFavoriteSymbolCOROUTINE$62(this, ae, pe);
    ye.pa_1 = Ps;
    ye.qa_1 = null;
    return ye.va();
};
Ss(PerpetualQueries).u1vq = function(ae) {
    const pe = new $deleteAllFavoriteSymbolsCOROUTINE$63(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(PerpetualUserLeverage).toString = function() {
    return `PerpetualUserLeverage(symbol=${this.v1vq_1}, leverage=${this.w1vq_1.toString()})`;
};
Ss(PerpetualUserLeverage).hashCode = function() {
    let ae = Is(this.v1vq_1);
    return ae = ys(ae, 31) + this.w1vq_1.hashCode() | 0;
};
Ss(PerpetualUserLeverage).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof PerpetualUserLeverage)) {
        return false;
    }
    const pe = ae instanceof PerpetualUserLeverage ? ae : Es();
    return this.v1vq_1 === pe.v1vq_1 && !!this.w1vq_1.equals(pe.w1vq_1);
};
Ss(Companion).f1vr = function() {
    return function get_schema(ae) {
        return gs;
    }(Ls(TrustSDKDB));
};
Ss(Companion).g1vr = function(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs) {
    return function newInstance(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us) {
        return new TrustSDKDBImpl(pe, ye, es, ss, ns, ts, rs, os, as, cs, us);
    }(Ls(TrustSDKDB), ae, pe, ye, es, ss, ns, ts, rs, os, as, cs);
};
Ss(sam$kotlin_Comparator$0).dg = function(ae, pe) {
    return this.l1vr_1(ae, pe);
};
Ss(sam$kotlin_Comparator$0).compare = function(ae, pe) {
    return this.dg(ae, pe);
};
Ss(sam$kotlin_Comparator$0).g4 = function() {
    return this.l1vr_1;
};
Ss(sam$kotlin_Comparator$0).equals = function(ae) {
    let pe;
    if (ae != null && Hs(ae, Zs)) {
        pe = !(ae == null || !Hs(ae, Vs)) && Ds(this.g4(), ae.g4());
    } else {
        pe = false;
    }
    return pe;
};
Ss(sam$kotlin_Comparator$0).hashCode = function() {
    return Xs(this.g4());
};
Ss(TrustSDKDBImpl$Schema$create$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(TrustSDKDBImpl$Schema$create$slambda).mc = function(ae) {
    return this.c28(ae);
};
Ss(TrustSDKDBImpl$Schema$create$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 37;
                    this.na_1 = 1;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetInfo (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    type TEXT NOT NULL,\n    name TEXT NOT NULL,\n    symbol TEXT NOT NULL,\n    decimals INTEGER NOT NULL,\n    iconUrl TEXT,\n    updatedAt INTEGER NOT NULL DEFAULT 0\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.na_1 = 2;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetStatus (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSellAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSwapAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSwapCrossChainAvailable INTEGER DEFAULT 0 NOT NULL,\n    isStakeAvailable INTEGER DEFAULT 0 NOT NULL,\n    defaultSwapPairFromAssetID TEXT,\n    defaultSwapPairToAssetID TEXT,\n    defaultSwapCrossChainPairFromAssetID TEXT,\n    defaultSwapCrossChainPairToAssetID TEXT,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    -- ERC-8056 / BEP-677 scaled UI amount. Defaults preserve identity behaviour\n    -- for rows written before sc-137829/sc-137837 landed, and for assets the\n    -- backend does not flag. Display-only; raw amounts stay canonical.\n    isScaledUIAmount INTEGER NOT NULL DEFAULT 0,\n    uiMultiplier TEXT,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.na_1 = 3;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetLocalStatus (\n    assetID TEXT NOT NULL,\n    isAddedManually INTEGER DEFAULT 0 NOT NULL,\n    isEnabled INTEGER DEFAULT 1 NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    walletID TEXT NOT NULL,\n    PRIMARY KEY (assetID, walletID),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    this.na_1 = 4;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetMessage (\n    id TEXT NOT NULL PRIMARY KEY,\n    assetID TEXT NOT NULL,\n    messageType TEXT,\n    format TEXT,\n    title TEXT,\n    description TEXT NOT NULL,\n    imageUrl TEXT,\n    alwaysShow INTEGER DEFAULT 0 NOT NULL,\n    metadataType TEXT,\n    linkType TEXT,\n    linkUrl TEXT,\n    FOREIGN KEY(assetID) REFERENCES AssetStatus(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    this.na_1 = 5;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetLocalMessage (\n    walletID TEXT NOT NULL,\n    messageID TEXT NOT NULL,\n    assetID TEXT NOT NULL,\n    isClosed INTEGER DEFAULT 0 NOT NULL,\n    PRIMARY KEY (walletID, messageID),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,\n    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 5:
                    this.na_1 = 6;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetTicker (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    updatedTime INTEGER NOT NULL,\n    price TEXT NOT NULL,\n    percentChange24h TEXT NOT NULL,\n    currencyCode TEXT NOT NULL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 6:
                    this.na_1 = 7;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetAccount (\n    assetID TEXT NOT NULL,\n    accountAddress TEXT NOT NULL,\n    availableBalance TEXT,\n    frozenBalance TEXT,\n    lockedBalance TEXT,\n    rewardsBalance TEXT,\n    stakedBalance TEXT,\n    pendingBalance TEXT,\n    blockedBalance TEXT,\n    claimableBalance TEXT,\n    transferableBalance TEXT,\n    inscribedBalance TEXT,\n    dustBalance TEXT,\n    investedBalance TEXT,\n    earnedBalance TEXT,\n    energyBalance TEXT,\n    bandwidthBalance TEXT,\n    energyLimitBalance TEXT,\n    bandwidthLimitBalance TEXT,\n    reservedBalance TEXT,\n    isRegistered INTEGER DEFAULT 1 NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, accountAddress),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 7:
                    this.na_1 = 8;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetSecurityInfo (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isScanned INTEGER NOT NULL,\n    provider TEXT,\n    contractSecurityNumRisks INTEGER,\n    contractSecurityNumWarnings INTEGER,\n    honeypotRiskNumRisks INTEGER,\n    honeypotRiskNumWarnings INTEGER,\n    buyTax REAL,\n    sellTax REAL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 8:
                    this.na_1 = 9;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (\n    assetID TEXT NOT NULL,\n    itemType INTEGER NOT NULL,\n    type TEXT NOT NULL,\n    summary TEXT NOT NULL,\n    description TEXT NOT NULL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 9:
                    this.na_1 = 10;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS EarnPortfolio (\n    wallet_id TEXT NOT NULL,\n    currency_code TEXT NOT NULL,\n    portfolio_json TEXT NOT NULL,\n    updated_at INTEGER NOT NULL,\n    PRIMARY KEY (wallet_id, currency_code)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 10:
                    this.na_1 = 11;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS FeePriority (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    priceLow TEXT NOT NULL,\n    timeLow INTEGER NOT NULL,\n    priceMedium TEXT NOT NULL,\n    timeMedium INTEGER NOT NULL,\n    priceHigh TEXT NOT NULL,\n    timeHigh INTEGER NOT NULL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 11:
                    this.na_1 = 12;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS HomepageCache (\n    wallet_id TEXT NOT NULL,\n    currency_code TEXT NOT NULL,\n    data_json TEXT NOT NULL,\n    updated_at INTEGER NOT NULL,\n    PRIMARY KEY (wallet_id, currency_code)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 12:
                    this.na_1 = 13;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (\n    id TEXT NOT NULL PRIMARY KEY,\n    tokenLockerId TEXT NOT NULL,\n    groupId INTEGER NOT NULL,\n    timeStart INTEGER NOT NULL,\n    timeEnd INTEGER NOT NULL,\n    campaign TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 13:
                    this.na_1 = 14;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolReward (\n    rewardAssetId TEXT NOT NULL PRIMARY KEY,\n    rewardsInfo TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 14:
                    this.na_1 = 15;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (\n    rewardAssetId TEXT NOT NULL,\n    campaignId TEXT NOT NULL,\n    accumulated TEXT NOT NULL,\n    unclaimed TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 15:
                    this.na_1 = 16;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (\n    rewardAssetId TEXT NOT NULL,\n    proof TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 16:
                    this.na_1 = 17;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS MarketInfo (\n    assetID TEXT NOT NULL,\n    currency TEXT NOT NULL,\n    provider TEXT DEFAULT NULL,\n    providerUrl TEXT DEFAULT NULL,\n    volume24 REAL DEFAULT 0,\n    marketCap REAL DEFAULT 0,\n    circulatingSupply REAL DEFAULT 0,\n    totalSupply REAL DEFAULT 0,\n    website TEXT DEFAULT NULL,\n    explorer TEXT DEFAULT NULL,\n    research TEXT DEFAULT NULL,\n    shortDescription TEXT DEFAULT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, currency),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 17:
                    this.na_1 = 18;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS MarketInfoLink (\n    assetID TEXT NOT NULL,\n    name TEXT NOT NULL,\n    url TEXT NOT NULL,\n    handle TEXT DEFAULT NULL,\n    PRIMARY KEY (assetID, name),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 18:
                    this.na_1 = 19;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (\n    symbol TEXT NOT NULL PRIMARY KEY,\n    leverage INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 19:
                    this.na_1 = 20;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualExchangeSymbol (\n    symbol TEXT NOT NULL PRIMARY KEY,\n    pair TEXT NOT NULL,\n    status TEXT NOT NULL,\n    baseAsset TEXT NOT NULL,\n    quoteAsset TEXT NOT NULL,\n    marginAsset TEXT NOT NULL,\n    quantityPrecision INTEGER NOT NULL,\n    baseAssetPrecision INTEGER NOT NULL,\n    quotePrecision INTEGER,\n    name TEXT NOT NULL,\n    filtersJson TEXT NOT NULL,\n    symbolSubtypes TEXT NOT NULL,\n    symbolSchedule INTEGER NOT NULL,\n    stepSize INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 20:
                    this.na_1 = 21;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (\n    assetCode TEXT NOT NULL PRIMARY KEY,\n    logoUrl TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 21:
                    this.na_1 = 22;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (\n    orderIndex INTEGER NOT NULL PRIMARY KEY,\n    symbol TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 22:
                    this.na_1 = 23;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualBracketRisk (\n    symbol TEXT NOT NULL,\n    level INTEGER NOT NULL,\n    maintenanceMarginRate REAL NOT NULL,\n    notionalCap REAL NOT NULL,\n    notionalFloor REAL NOT NULL,\n    cumMaintenanceAmount REAL NOT NULL,\n    maxOpenPosLeverage INTEGER NOT NULL,\n    minOpenPosLeverage INTEGER NOT NULL,\n    PRIMARY KEY (symbol, level)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 23:
                    this.na_1 = 24;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (\n    symbol TEXT NOT NULL PRIMARY KEY\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 24:
                    this.na_1 = 25;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PriceAlert (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    enabled INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 25:
                    this.na_1 = 26;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (\n    wallet_id TEXT NOT NULL,\n    asset_id TEXT NOT NULL,\n    last_available_balance TEXT NOT NULL,\n    last_balance_increasing_date INTEGER,\n    PRIMARY KEY (wallet_id, asset_id)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 26:
                    this.na_1 = 27;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (\n    wallet_id TEXT NOT NULL,\n    asset_id TEXT NOT NULL,\n    last_shown_date INTEGER,\n    dont_remind_me INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (wallet_id, asset_id)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 27:
                    this.na_1 = 28;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS SwapSelectedPair (\n    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,\n    fromAssetID TEXT,\n    fromNetwork INTEGER,\n    toAssetID TEXT,\n    toNetwork INTEGER\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 28:
                    this.na_1 = 29;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE TABLE IF NOT EXISTS TokenLockerPosition (\n    assetId TEXT NOT NULL,\n    tokenLockerId TEXT NOT NULL,\n    amount TEXT NOT NULL,\n    unlockableTimestamp INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 29:
                    this.na_1 = 30;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 30:
                    this.na_1 = 31;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 31:
                    this.na_1 = 32;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 32:
                    this.na_1 = 33;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 33:
                    this.na_1 = 34;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 34:
                    this.na_1 = 35;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 35:
                    this.na_1 = 36;
                    if ((pa_1 = this.u1vr_1.b1vh(null, "CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 36:
                    return Ps;
                case 37:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 37) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(TrustSDKDBImpl$Schema$create$slambda).d28 = function(ae) {
    return new TrustSDKDBImpl$Schema$create$slambda(this.u1vr_1, ae);
};
Ss(TrustSDKDBImpl$Schema$migrateInternal$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(TrustSDKDBImpl$Schema$migrateInternal$slambda).mc = function(ae) {
    return this.c28(ae);
};
Ss(TrustSDKDBImpl$Schema$migrateInternal$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 108;
                    if (this.d1vs_1.k1(new Ys(1, 0)) <= 0 && this.e1vs_1.k1(new Ys(1, 0)) > 0) {
                        this.na_1 = 1;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE IF EXISTS AssetAccount", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 7;
                    continue e;
                case 1:
                    this.na_1 = 2;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetAccount (\n    assetID TEXT NOT NULL,\n    accountAddress TEXT NOT NULL,\n    availableBalance TEXT,\n    frozenBalance TEXT,\n    lockedBalance TEXT,\n    rewardsBalance TEXT,\n    stakedBalance TEXT,\n    pendingBalance TEXT,\n    blockedBalance TEXT,\n    claimableBalance TEXT,\n    transferableBalance TEXT,\n    inscribedBalance TEXT,\n    dustBalance TEXT,\n    isRegistered INTEGER DEFAULT 1 NOT NULL,\n    PRIMARY KEY (assetID, accountAddress),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.na_1 = 3;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetStatus_new (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSellAvailable INTEGER DEFAULT 0 NOT NULL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    this.na_1 = 4;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetStatus_new (\n    assetID,\n    isBuyAvailable,\n    isSellAvailable\n)\nSELECT\n    assetID,\n    isBuyAvailable,\n    isSellAvailable\nFROM AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    this.na_1 = 5;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 5:
                    this.na_1 = 6;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetStatus_new RENAME TO AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 6:
                    this.na_1 = 7;
                    continue e;
                case 7:
                    if (this.d1vs_1.k1(new Ys(2, 0)) <= 0 && this.e1vs_1.k1(new Ys(2, 0)) > 0) {
                        this.na_1 = 8;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetLocalStatus (\n    assetID TEXT NOT NULL,\n    isAddedManually INTEGER DEFAULT 0 NOT NULL,\n    isEnabled INTEGER DEFAULT 1 NOT NULL,\n    walletID TEXT NOT NULL,\n    PRIMARY KEY (assetID, walletID),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 9;
                    continue e;
                case 8:
                    this.na_1 = 9;
                    continue e;
                case 9:
                    if (this.d1vs_1.k1(new Ys(3, 0)) <= 0 && this.e1vs_1.k1(new Ys(3, 0)) > 0) {
                        this.na_1 = 10;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS SwapSelectedPair (\n    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,\n    fromAssetID TEXT,\n    fromNetwork INTEGER,\n    toAssetID TEXT,\n    toNetwork INTEGER\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 11;
                    continue e;
                case 10:
                    this.na_1 = 11;
                    continue e;
                case 11:
                    if (this.d1vs_1.k1(new Ys(4, 0)) <= 0 && this.e1vs_1.k1(new Ys(4, 0)) > 0) {
                        this.na_1 = 12;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetInfo_new (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    type TEXT NOT NULL,\n    name TEXT NOT NULL,\n    symbol TEXT NOT NULL,\n    decimals INTEGER NOT NULL,\n    iconUrl TEXT,\n    updatedAt INTEGER NOT NULL DEFAULT 0\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 28;
                    continue e;
                case 12:
                    this.na_1 = 13;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetInfo_new (\n    assetID,\n    type,\n    name,\n    symbol,\n    decimals,\n    iconUrl,\n    updatedAt\n)\nSELECT\n    assetID,\n    type,\n    name,\n    symbol,\n    decimals,\n    iconUrl,\n    0\nFROM AssetInfo", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 13:
                    this.na_1 = 14;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetInfo", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 14:
                    this.na_1 = 15;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetInfo_new RENAME TO AssetInfo", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 15:
                    this.na_1 = 16;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetStatus_new (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSellAvailable INTEGER DEFAULT 0 NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 16:
                    this.na_1 = 17;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetStatus_new (\n    assetID,\n    isBuyAvailable,\n    isSellAvailable,\n    updatedAt\n)\nSELECT\n    assetID,\n    isBuyAvailable,\n    isSellAvailable,\n    0\nFROM AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 17:
                    this.na_1 = 18;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 18:
                    this.na_1 = 19;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetStatus_new RENAME TO AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 19:
                    this.na_1 = 20;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetLocalStatus_new (\n    assetID TEXT NOT NULL,\n    isAddedManually INTEGER DEFAULT 0 NOT NULL,\n    isEnabled INTEGER DEFAULT 1 NOT NULL,\n    walletID TEXT NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, walletID),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 20:
                    this.na_1 = 21;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetLocalStatus_new (\n    assetID,\n    isAddedManually,\n    isEnabled,\n    walletID,\n    updatedAt\n)\nSELECT\n    assetID,\n    isAddedManually,\n    isEnabled,\n    walletID,\n    0\nFROM AssetLocalStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 21:
                    this.na_1 = 22;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetLocalStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 22:
                    this.na_1 = 23;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetLocalStatus_new RENAME TO AssetLocalStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 23:
                    this.na_1 = 24;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetAccount_new (\n    assetID TEXT NOT NULL,\n    accountAddress TEXT NOT NULL,\n    availableBalance TEXT,\n    frozenBalance TEXT,\n    lockedBalance TEXT,\n    rewardsBalance TEXT,\n    stakedBalance TEXT,\n    pendingBalance TEXT,\n    blockedBalance TEXT,\n    claimableBalance TEXT,\n    transferableBalance TEXT,\n    inscribedBalance TEXT,\n    dustBalance TEXT,\n    isRegistered INTEGER DEFAULT 1 NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, accountAddress),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 24:
                    this.na_1 = 25;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetAccount_new (\n    assetID,\n    accountAddress,\n    availableBalance,\n    frozenBalance,\n    lockedBalance,\n    rewardsBalance,\n    stakedBalance,\n    pendingBalance,\n    blockedBalance,\n    claimableBalance,\n    transferableBalance,\n    inscribedBalance,\n    dustBalance,\n    isRegistered,\n    updatedAt\n)\nSELECT\n    assetID,\n    accountAddress,\n    availableBalance,\n    frozenBalance,\n    lockedBalance,\n    rewardsBalance,\n    stakedBalance,\n    pendingBalance,\n    blockedBalance,\n    claimableBalance,\n    transferableBalance,\n    inscribedBalance,\n    dustBalance,\n    isRegistered,\n    0\nFROM AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 25:
                    this.na_1 = 26;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 26:
                    this.na_1 = 27;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetAccount_new RENAME TO AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 27:
                    this.na_1 = 28;
                    continue e;
                case 28:
                    if (this.d1vs_1.k1(new Ys(5, 0)) <= 0 && this.e1vs_1.k1(new Ys(5, 0)) > 0) {
                        this.na_1 = 29;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetStatus_new (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSellAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSwapAvailable INTEGER DEFAULT 0 NOT NULL,\n    isSwapCrossChainAvailable INTEGER DEFAULT 0 NOT NULL,\n    isStakeAvailable INTEGER DEFAULT 0 NOT NULL,\n    defaultSwapPairFromAssetID TEXT,\n    defaultSwapPairToAssetID TEXT,\n    defaultSwapCrossChainPairFromAssetID TEXT,\n    defaultSwapCrossChainPairToAssetID TEXT,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 37;
                    continue e;
                case 29:
                    this.na_1 = 30;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetStatus_new (\n    assetID,\n    isBuyAvailable,\n    isSellAvailable,\n    updatedAt\n)\nSELECT\n    assetID,\n    isBuyAvailable,\n    isSellAvailable,\n    updatedAt\nFROM AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 30:
                    this.na_1 = 31;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 31:
                    this.na_1 = 32;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetStatus_new RENAME TO AssetStatus", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 32:
                    this.na_1 = 33;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetMessage (\n    id TEXT NOT NULL PRIMARY KEY,\n    assetID TEXT NOT NULL,\n    messageType TEXT,\n    format TEXT,\n    title TEXT,\n    description TEXT NOT NULL,\n    imageUrl TEXT,\n    alwaysShow INTEGER DEFAULT 0 NOT NULL,\n    metadataType TEXT,\n    linkType TEXT,\n    linkUrl TEXT,\n    FOREIGN KEY(assetID) REFERENCES AssetStatus(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 33:
                    this.na_1 = 34;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 34:
                    this.na_1 = 35;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetLocalMessage (\n    walletID TEXT NOT NULL,\n    messageID TEXT NOT NULL,\n    assetID TEXT NOT NULL,\n    isClosed INTEGER DEFAULT 0 NOT NULL,\n    PRIMARY KEY (walletID, messageID),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,\n    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 35:
                    this.na_1 = 36;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 36:
                    this.na_1 = 37;
                    continue e;
                case 37:
                    if (this.d1vs_1.k1(new Ys(6, 0)) <= 0 && this.e1vs_1.k1(new Ys(6, 0)) > 0) {
                        this.na_1 = 38;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetAccount_new (\n    assetID TEXT NOT NULL,\n    accountAddress TEXT NOT NULL,\n    availableBalance TEXT,\n    frozenBalance TEXT,\n    lockedBalance TEXT,\n    rewardsBalance TEXT,\n    stakedBalance TEXT,\n    pendingBalance TEXT,\n    blockedBalance TEXT,\n    claimableBalance TEXT,\n    transferableBalance TEXT,\n    inscribedBalance TEXT,\n    dustBalance TEXT,\n    investedBalance TEXT,\n    earnedBalance TEXT,\n    energyBalance TEXT,\n    bandwidthBalance TEXT,\n    energyLimitBalance TEXT,\n    bandwidthLimitBalance TEXT,\n    isRegistered INTEGER DEFAULT 1 NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, accountAddress),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 42;
                    continue e;
                case 38:
                    this.na_1 = 39;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetAccount_new (\n    assetID,\n    accountAddress,\n    availableBalance,\n    frozenBalance,\n    lockedBalance,\n    rewardsBalance,\n    stakedBalance,\n    pendingBalance,\n    blockedBalance,\n    claimableBalance,\n    transferableBalance,\n    inscribedBalance,\n    dustBalance,\n    investedBalance,\n    earnedBalance,\n    energyBalance,\n    bandwidthBalance,\n    energyLimitBalance,\n    bandwidthLimitBalance,\n    isRegistered,\n    updatedAt\n)\nSELECT\n    assetID,\n    accountAddress,\n    availableBalance,\n    frozenBalance,\n    lockedBalance,\n    rewardsBalance,\n    stakedBalance,\n    pendingBalance,\n    blockedBalance,\n    claimableBalance,\n    transferableBalance,\n    inscribedBalance,\n    dustBalance,\n    NULL,\n    NULL,\n    NULL,\n    NULL,\n    NULL,\n    NULL,\n    isRegistered,\n    updatedAt\nFROM AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 39:
                    this.na_1 = 40;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 40:
                    this.na_1 = 41;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetAccount_new RENAME TO AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 41:
                    this.na_1 = 42;
                    continue e;
                case 42:
                    if (this.d1vs_1.k1(new Ys(7, 0)) <= 0 && this.e1vs_1.k1(new Ys(7, 0)) > 0) {
                        this.na_1 = 43;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PriceAlert (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    enabled INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 44;
                    continue e;
                case 43:
                    this.na_1 = 44;
                    continue e;
                case 44:
                    if (this.d1vs_1.k1(new Ys(8, 0)) <= 0 && this.e1vs_1.k1(new Ys(8, 0)) > 0) {
                        this.na_1 = 45;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetAccount_new (\n    assetID TEXT NOT NULL,\n    accountAddress TEXT NOT NULL,\n    availableBalance TEXT,\n    frozenBalance TEXT,\n    lockedBalance TEXT,\n    rewardsBalance TEXT,\n    stakedBalance TEXT,\n    pendingBalance TEXT,\n    blockedBalance TEXT,\n    claimableBalance TEXT,\n    transferableBalance TEXT,\n    inscribedBalance TEXT,\n    dustBalance TEXT,\n    investedBalance TEXT,\n    earnedBalance TEXT,\n    energyBalance TEXT,\n    bandwidthBalance TEXT,\n    energyLimitBalance TEXT,\n    bandwidthLimitBalance TEXT,\n    reservedBalance TEXT,\n    isRegistered INTEGER DEFAULT 1 NOT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, accountAddress),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 49;
                    continue e;
                case 45:
                    this.na_1 = 46;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetAccount_new (\n    assetID,\n    accountAddress,\n    availableBalance,\n    frozenBalance,\n    lockedBalance,\n    rewardsBalance,\n    stakedBalance,\n    pendingBalance,\n    blockedBalance,\n    claimableBalance,\n    transferableBalance,\n    inscribedBalance,\n    dustBalance,\n    investedBalance,\n    earnedBalance,\n    energyBalance,\n    bandwidthBalance,\n    energyLimitBalance,\n    bandwidthLimitBalance,\n    reservedBalance,\n    isRegistered,\n    updatedAt\n)\nSELECT\n    assetID,\n    accountAddress,\n    availableBalance,\n    frozenBalance,\n    lockedBalance,\n    rewardsBalance,\n    stakedBalance,\n    pendingBalance,\n    blockedBalance,\n    claimableBalance,\n    transferableBalance,\n    inscribedBalance,\n    dustBalance,\n    investedBalance,\n    earnedBalance,\n    energyBalance,\n    bandwidthBalance,\n    energyLimitBalance,\n    bandwidthLimitBalance,\n    NULL,\n    isRegistered,\n    updatedAt\nFROM AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 46:
                    this.na_1 = 47;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 47:
                    this.na_1 = 48;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetAccount_new RENAME TO AssetAccount", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 48:
                    this.na_1 = 49;
                    continue e;
                case 49:
                    if (this.d1vs_1.k1(new Ys(9, 0)) <= 0 && this.e1vs_1.k1(new Ys(9, 0)) > 0) {
                        this.na_1 = 50;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetSecurityInfo (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isScanned INTEGER NOT NULL,\n    contractSecurityNumRisks INTEGER,\n    contractSecurityNumWarnings INTEGER,\n    honeypotRiskNumRisks INTEGER,\n    honeypotRiskNumWarnings INTEGER,\n    buyTax REAL,\n    sellTax REAL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 53;
                    continue e;
                case 50:
                    this.na_1 = 51;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (\n    assetID TEXT NOT NULL,\n    itemType INTEGER NOT NULL,\n    type TEXT NOT NULL,\n    summary TEXT NOT NULL,\n    description TEXT NOT NULL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 51:
                    this.na_1 = 52;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 52:
                    this.na_1 = 53;
                    continue e;
                case 53:
                    if (this.d1vs_1.k1(new Ys(10, 0)) <= 0 && this.e1vs_1.k1(new Ys(10, 0)) > 0) {
                        this.na_1 = 54;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS MarketInfo (\n    assetID TEXT NOT NULL,\n    currency TEXT NOT NULL,\n    provider TEXT DEFAULT NULL,\n    providerUrl TEXT DEFAULT NULL,\n    volume24 REAL DEFAULT 0,\n    marketCap REAL DEFAULT 0,\n    circulatingSupply REAL DEFAULT 0,\n    totalSupply REAL DEFAULT 0,\n    website TEXT DEFAULT NULL,\n    explorer TEXT DEFAULT NULL,\n    research TEXT DEFAULT NULL,\n    shortDescription TEXT DEFAULT NULL,\n    updatedAt INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (assetID, currency),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 56;
                    continue e;
                case 54:
                    this.na_1 = 55;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS MarketInfoLink (\n    assetID TEXT NOT NULL,\n    name TEXT NOT NULL,\n    url TEXT NOT NULL,\n    handle TEXT DEFAULT NULL,\n    PRIMARY KEY (assetID, name),\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 55:
                    this.na_1 = 56;
                    continue e;
                case 56:
                    if (this.d1vs_1.k1(new Ys(11, 0)) <= 0 && this.e1vs_1.k1(new Ys(11, 0)) > 0) {
                        this.na_1 = 57;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (\n    id TEXT NOT NULL PRIMARY KEY,\n    tokenLockerId TEXT NOT NULL,\n    groupId INTEGER NOT NULL,\n    timeStart INTEGER NOT NULL,\n    timeEnd INTEGER NOT NULL,\n    title TEXT NOT NULL,\n    subtitle TEXT NOT NULL,\n    campaignUrl TEXT,\n    howToUrl TEXT,\n    reward TEXT NOT NULL,\n    participantsNumber INTEGER NOT NULL,\n    lockPeriod INTEGER NOT NULL,\n    lockAssetId TEXT NOT NULL,\n    rewardAssetId TEXT NOT NULL,\n    canSwapReward INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 66;
                    continue e;
                case 57:
                    this.na_1 = 58;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 58:
                    this.na_1 = 59;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS TokenLockerPosition (\n    assetId TEXT NOT NULL,\n    tokenLockerId TEXT NOT NULL,\n    amount TEXT NOT NULL,\n    unlockableTimestamp INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 59:
                    this.na_1 = 60;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 60:
                    this.na_1 = 61;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolReward (\n    rewardAssetId TEXT NOT NULL PRIMARY KEY,\n    tokenAccumulated TEXT NOT NULL,\n    tokenUnclaimed TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 61:
                    this.na_1 = 62;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (\n    rewardAssetId TEXT NOT NULL,\n    campaignId TEXT NOT NULL,\n    accumulated TEXT NOT NULL,\n    unclaimed TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 62:
                    this.na_1 = 63;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 63:
                    this.na_1 = 64;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (\n    rewardAssetId TEXT NOT NULL,\n    proof TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 64:
                    this.na_1 = 65;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 65:
                    this.na_1 = 66;
                    continue e;
                case 66:
                    if (this.d1vs_1.k1(new Ys(12, 0)) <= 0 && this.e1vs_1.k1(new Ys(12, 0)) > 0) {
                        this.na_1 = 67;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetSecurityInfo_new (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    isScanned INTEGER NOT NULL,\n    provider TEXT,\n    contractSecurityNumRisks INTEGER,\n    contractSecurityNumWarnings INTEGER,\n    honeypotRiskNumRisks INTEGER,\n    honeypotRiskNumWarnings INTEGER,\n    buyTax REAL,\n    sellTax REAL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 71;
                    continue e;
                case 67:
                    this.na_1 = 68;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO AssetSecurityInfo_new (\n    assetID,\n    isScanned,\n    provider,\n    contractSecurityNumRisks,\n    contractSecurityNumWarnings,\n    honeypotRiskNumRisks,\n    honeypotRiskNumWarnings,\n    buyTax,\n    sellTax\n)\nSELECT\n    assetID,\n    isScanned,\n    NULL AS provider,\n    contractSecurityNumRisks,\n    contractSecurityNumWarnings,\n    honeypotRiskNumRisks,\n    honeypotRiskNumWarnings,\n    buyTax,\n    sellTax\nFROM AssetSecurityInfo", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 68:
                    this.na_1 = 69;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE AssetSecurityInfo", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 69:
                    this.na_1 = 70;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetSecurityInfo_new RENAME TO AssetSecurityInfo", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 70:
                    this.na_1 = 71;
                    continue e;
                case 71:
                    if (this.d1vs_1.k1(new Ys(13, 0)) <= 0 && this.e1vs_1.k1(new Ys(13, 0)) > 0) {
                        this.na_1 = 72;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolCampaign_new (\n    id TEXT NOT NULL PRIMARY KEY,\n    tokenLockerId TEXT NOT NULL,\n    groupId INTEGER NOT NULL,\n    timeStart INTEGER NOT NULL,\n    timeEnd INTEGER NOT NULL,\n    title TEXT NOT NULL,\n    subtitle TEXT NOT NULL,\n    campaignUrl TEXT,\n    howToUrl TEXT,\n    reward TEXT NOT NULL,\n    participantsNumber INTEGER NOT NULL,\n    lockPeriod INTEGER NOT NULL,\n    lockAssetId TEXT NOT NULL,\n    rewardAssetId TEXT NOT NULL,\n    canSwapReward INTEGER NOT NULL,\n    isUserEligible INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 77;
                    continue e;
                case 72:
                    this.na_1 = 73;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "INSERT INTO LaunchpoolCampaign_new (\n    id,\n    tokenLockerId,\n    groupId,\n    timeStart,\n    timeEnd,\n    title,\n    subtitle,\n    campaignUrl,\n    howToUrl,\n    reward,\n    participantsNumber,\n    lockPeriod,\n    lockAssetId,\n    rewardAssetId,\n    canSwapReward,\n    isUserEligible\n)\nSELECT\n    id,\n    tokenLockerId,\n    groupId,\n    timeStart,\n    timeEnd,\n    title,\n    subtitle,\n    campaignUrl,\n    howToUrl,\n    reward,\n    participantsNumber,\n    lockPeriod,\n    lockAssetId,\n    rewardAssetId,\n    canSwapReward,\n    0 AS isUserEligible\nFROM LaunchpoolCampaign", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 73:
                    this.na_1 = 74;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE LaunchpoolCampaign", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 74:
                    this.na_1 = 75;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE LaunchpoolCampaign_new RENAME TO LaunchpoolCampaign", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 75:
                    this.na_1 = 76;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 76:
                    this.na_1 = 77;
                    continue e;
                case 77:
                    if (this.d1vs_1.k1(new Ys(14, 0)) <= 0 && this.e1vs_1.k1(new Ys(14, 0)) > 0) {
                        this.na_1 = 78;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS AssetHighlights (\n    assetID TEXT NOT NULL PRIMARY KEY,\n    title TEXT NOT NULL,\n    summary TEXT NOT NULL,\n    timestamp INTEGER NOT NULL,\n    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 79;
                    continue e;
                case 78:
                    this.na_1 = 79;
                    continue e;
                case 79:
                    if (this.d1vs_1.k1(new Ys(15, 0)) <= 0 && this.e1vs_1.k1(new Ys(15, 0)) > 0) {
                        this.na_1 = 80;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE IF EXISTS LaunchpoolCampaign", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 83;
                    continue e;
                case 80:
                    this.na_1 = 81;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (\n    id TEXT NOT NULL PRIMARY KEY,\n    tokenLockerId TEXT NOT NULL,\n    groupId INTEGER NOT NULL,\n    timeStart INTEGER NOT NULL,\n    timeEnd INTEGER NOT NULL,\n    campaign TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 81:
                    this.na_1 = 82;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 82:
                    this.na_1 = 83;
                    continue e;
                case 83:
                    if (this.d1vs_1.k1(new Ys(16, 0)) <= 0 && this.e1vs_1.k1(new Ys(16, 0)) > 0) {
                        this.na_1 = 84;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE LaunchpoolReward ADD COLUMN tgeTimestampSec INTEGER", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 85;
                    continue e;
                case 84:
                    this.na_1 = 85;
                    continue e;
                case 85:
                    if (this.d1vs_1.k1(new Ys(17, 0)) <= 0 && this.e1vs_1.k1(new Ys(17, 0)) > 0) {
                        this.na_1 = 86;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS EarnPortfolio (\n    wallet_id TEXT NOT NULL,\n    currency_code TEXT NOT NULL,\n    portfolio_json TEXT NOT NULL,\n    updated_at INTEGER NOT NULL,\n    PRIMARY KEY (wallet_id, currency_code)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 87;
                    continue e;
                case 86:
                    this.na_1 = 87;
                    continue e;
                case 87:
                    if (this.d1vs_1.k1(new Ys(18, 0)) <= 0 && this.e1vs_1.k1(new Ys(18, 0)) > 0) {
                        this.na_1 = 88;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE IF EXISTS LaunchpoolReward", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 90;
                    continue e;
                case 88:
                    this.na_1 = 89;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS LaunchpoolReward (\n    rewardAssetId TEXT NOT NULL PRIMARY KEY,\n    rewardsInfo TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 89:
                    this.na_1 = 90;
                    continue e;
                case 90:
                    if (this.d1vs_1.k1(new Ys(19, 0)) <= 0 && this.e1vs_1.k1(new Ys(19, 0)) > 0) {
                        this.na_1 = 91;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (\n    wallet_id TEXT NOT NULL,\n    asset_id TEXT NOT NULL,\n    last_available_balance TEXT NOT NULL,\n    last_balance_increasing_date INTEGER,\n    PRIMARY KEY (wallet_id, asset_id)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 93;
                    continue e;
                case 91:
                    this.na_1 = 92;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (\n    wallet_id TEXT NOT NULL,\n    asset_id TEXT NOT NULL,\n    last_shown_date INTEGER,\n    dont_remind_me INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (wallet_id, asset_id)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 92:
                    this.na_1 = 93;
                    continue e;
                case 93:
                    if (this.d1vs_1.k1(new Ys(20, 0)) <= 0 && this.e1vs_1.k1(new Ys(20, 0)) > 0) {
                        this.na_1 = 94;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (\n    symbol TEXT NOT NULL PRIMARY KEY,\n    leverage INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 100;
                    continue e;
                case 94:
                    this.na_1 = 95;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualExchangeSymbol (\n    symbol TEXT NOT NULL PRIMARY KEY,\n    pair TEXT NOT NULL,\n    status TEXT NOT NULL,\n    baseAsset TEXT NOT NULL,\n    quoteAsset TEXT NOT NULL,\n    marginAsset TEXT NOT NULL,\n    quantityPrecision INTEGER NOT NULL,\n    baseAssetPrecision INTEGER NOT NULL,\n    quotePrecision INTEGER,\n    name TEXT NOT NULL,\n    filtersJson TEXT NOT NULL,\n    symbolSubtypes TEXT NOT NULL,\n    symbolSchedule INTEGER NOT NULL,\n    stepSize INTEGER NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 95:
                    this.na_1 = 96;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (\n    assetCode TEXT NOT NULL PRIMARY KEY,\n    logoUrl TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 96:
                    this.na_1 = 97;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (\n    symbol TEXT NOT NULL PRIMARY KEY\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 97:
                    this.na_1 = 98;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (\n    orderIndex INTEGER NOT NULL PRIMARY KEY,\n    symbol TEXT NOT NULL\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 98:
                    this.na_1 = 99;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS PerpetualBracketRisk (\n    symbol TEXT NOT NULL,\n    level INTEGER NOT NULL,\n    maintenanceMarginRate REAL NOT NULL,\n    notionalCap REAL NOT NULL,\n    notionalFloor REAL NOT NULL,\n    cumMaintenanceAmount REAL NOT NULL,\n    maxOpenPosLeverage INTEGER NOT NULL,\n    minOpenPosLeverage INTEGER NOT NULL,\n    PRIMARY KEY (symbol, level)\n)", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 99:
                    this.na_1 = 100;
                    continue e;
                case 100:
                    if (this.d1vs_1.k1(new Ys(21, 0)) <= 0 && this.e1vs_1.k1(new Ys(21, 0)) > 0) {
                        this.na_1 = 101;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "CREATE TABLE IF NOT EXISTS HomepageCache (\n    wallet_id TEXT NOT NULL,\n    currency_code TEXT NOT NULL,\n    data_json TEXT NOT NULL,\n    updated_at INTEGER NOT NULL,\n    PRIMARY KEY (wallet_id, currency_code)\n)", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 102;
                    continue e;
                case 101:
                    this.na_1 = 102;
                    continue e;
                case 102:
                    if (this.d1vs_1.k1(new Ys(22, 0)) <= 0 && this.e1vs_1.k1(new Ys(22, 0)) > 0) {
                        this.na_1 = 103;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "DROP TABLE IF EXISTS AssetHighlights", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 104;
                    continue e;
                case 103:
                    this.na_1 = 104;
                    continue e;
                case 104:
                    if (this.d1vs_1.k1(new Ys(23, 0)) <= 0 && this.e1vs_1.k1(new Ys(23, 0)) > 0) {
                        this.na_1 = 105;
                        if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetStatus ADD COLUMN isScaledUIAmount INTEGER NOT NULL DEFAULT 0", 0).l12(this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 107;
                    continue e;
                case 105:
                    this.na_1 = 106;
                    if ((pa_1 = this.f1vs_1.b1vh(null, "ALTER TABLE AssetStatus ADD COLUMN uiMultiplier TEXT", 0).l12(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 106:
                    this.na_1 = 107;
                    continue e;
                case 107:
                    return Ps;
                case 108:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 108) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(TrustSDKDBImpl$Schema$migrateInternal$slambda).d28 = function(ae) {
    return new TrustSDKDBImpl$Schema$migrateInternal$slambda(this.d1vs_1, this.e1vs_1, this.f1vs_1, ae);
};
Ss(TrustSDKDBImpl$Schema$migrate$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(TrustSDKDBImpl$Schema$migrate$slambda).mc = function(ae) {
    return this.c28(ae);
};
Ss(TrustSDKDBImpl$Schema$migrate$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 6;
                    this.s1vs_1 = this.o1vs_1;
                    const pe = this.p1vs_1;
                    const ye = sn();
                    for(let es = 0, ss = pe.length; es < ss;){
                        const ns = pe[es];
                        es = es + 1 | 0;
                        const ts = this.o1vs_1;
                        const rs = this.q1vs_1;
                        const os = ns.j1vr_1;
                        if (ts.k1(os) <= 0 && os.k1(rs) < 0) {
                            ye.e(ns);
                        }
                    }
                    this.t1vs_1 = an(ye, new sam$kotlin_Comparator$0(TrustSDKDBImpl$Schema$migrate$slambda$lambda));
                    this.u1vs_1 = this.t1vs_1;
                    this.v1vs_1 = this.u1vs_1.k();
                    this.na_1 = 1;
                    continue e;
                case 1:
                    if (!this.v1vs_1.l()) {
                        this.na_1 = 3;
                        continue e;
                    }
                    this.w1vs_1 = this.v1vs_1.m();
                    this.x1vs_1 = this.w1vs_1;
                    this.y1vs_1 = this.x1vs_1;
                    this.na_1 = 2;
                    const as = this.s1vs_1;
                    const cs = this.y1vs_1.j1vr_1;
                    if ((pa_1 = un(migrateInternal(0, this.r1vs_1, as, cs.m3(cn(1))), this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.y1vs_1.k1vr_1(this.r1vs_1);
                    this.s1vs_1 = this.y1vs_1.j1vr_1.m3(cn(1));
                    this.na_1 = 1;
                    continue e;
                case 3:
                    if (this.s1vs_1.k1(this.q1vs_1) < 0) {
                        this.na_1 = 4;
                        if ((pa_1 = un(migrateInternal(0, this.r1vs_1, this.s1vs_1, this.q1vs_1), this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 5;
                    continue e;
                case 4:
                    this.na_1 = 5;
                    continue e;
                case 5:
                    return Ps;
                case 6:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 6) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
Ss(TrustSDKDBImpl$Schema$migrate$slambda).d28 = function(ae) {
    return new TrustSDKDBImpl$Schema$migrate$slambda(this.o1vs_1, this.p1vs_1, this.q1vs_1, this.r1vs_1, ae);
};
Ss(Schema).r7c = function() {
    return new Ys(24, 0);
};
Ss(Schema).z1vs = function(ae) {
    return Gs(function TrustSDKDBImpl$Schema$create$slambda_0(ae, pe) {
        const ye = new TrustSDKDBImpl$Schema$create$slambda(ae, pe);
        const l = function(ae) {
            return ye.c28(ae);
        };
        l.$arity = 0;
        return l;
    }(ae, null));
};
Ss(Schema).c1vh = function(ae) {
    return new ln(this.z1vs(ae));
};
Ss(Schema).a1vt = function(ae, pe, ye, es) {
    return Gs(function TrustSDKDBImpl$Schema$migrate$slambda_0(ae, pe, ye, es, ss) {
        const ns = new TrustSDKDBImpl$Schema$migrate$slambda(ae, pe, ye, es, ss);
        const l = function(ae) {
            return ns.c28(ae);
        };
        l.$arity = 0;
        return l;
    }(pe, es, ye, ae, null));
};
Ss(Schema).d1vh = function(ae, pe, ye, es) {
    return new ln(this.a1vt(ae, pe, ye, es));
};
Ss(TrustSDKDBImpl).h1vr = function() {
    return this.d1vt_1;
};
Ss(TrustSDKDBImpl).i1vr = function() {
    return this.j1vt_1;
};
Ss(DatabaseManager$writeDatabase$slambda).q1tt = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(DatabaseManager$writeDatabase$slambda).mc = function(ae) {
    return this.q1tt(ae);
};
Ss(DatabaseManager$writeDatabase$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 7;
                    this.z1vt_1 = this.x1vt_1;
                    this.a1vu_1 = this.z1vt_1;
                    this.oa_1 = 3;
                    this.c1vu_1 = gn;
                    this.d1vu_1 = this.a1vu_1;
                    this.e1vu_1 = this.d1vu_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.e1vu_1.t1vu(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.f1vu_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.y1vt_1(this.f1vu_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.g1vu_1 = pa_1;
                    this.c1vu_1;
                    const pe = this.g1vu_1;
                    this.b1vu_1 = dn(pe);
                    this.oa_1 = 7;
                    this.na_1 = 4;
                    continue e;
                case 3:
                    this.oa_1 = 7;
                    if (this.qa_1 instanceof Error) {
                        this.h1vu_1 = this.qa_1;
                        const ye = this.h1vu_1;
                        this.b1vu_1 = dn(_n(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 7;
                    this.i1vu_1 = this.b1vu_1;
                    this.j1vu_1 = this.i1vu_1;
                    this.k1vu_1 = hn(this.j1vu_1);
                    if (this.k1vu_1 == null) {
                        this.l1vu_1 = null;
                        this.na_1 = 6;
                        continue e;
                    }
                    this.m1vu_1 = this.k1vu_1;
                    this.n1vu_1 = this.m1vu_1;
                    this.o1vu_1 = this.n1vu_1;
                    this.p1vu_1 = this.o1vu_1;
                    this.q1vu_1 = this.p1vu_1;
                    this.r1vu_1 = this.q1vu_1;
                    this.na_1 = 5;
                    if ((pa_1 = this.x1vt_1.um7().q1tt(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 5:
                    pn(pa_1, this.r1vu_1, Ts, DatabaseManager$writeDatabase$slambda$lambda(this.r1vu_1));
                    this.l1vu_1 = Ps;
                    this.na_1 = 6;
                    continue e;
                case 6:
                    const es = this.j1vu_1;
                    fn(es);
                    const ss = kn(es);
                    if (ss == null || ss != null) {
                        return ss;
                    }
                    return Es();
                case 7:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 7) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
Ss(DatabaseManager$writeDatabase$slambda).d28 = function(ae) {
    return new DatabaseManager$writeDatabase$slambda(this.x1vt_1, this.y1vt_1, ae);
};
Ss(DatabaseManager).u1vu = function(ae, pe) {
    return this.s1vu_1.f4y(function DatabaseManager$writeDatabase$slambda_0(ae, pe, ye) {
        const es = new DatabaseManager$writeDatabase$slambda(ae, pe, ye);
        const l = function(ae) {
            return es.q1tt(ae);
        };
        l.$arity = 0;
        return l;
    }(this, ae, null), pe);
};
Ss($provideDbCOROUTINE$78).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 5;
                    if (this.d1vv_1.s1vv_1 == null) {
                        this.na_1 = 1;
                        if ((pa_1 = this.d1vv_1.q1vv_1(ms.f1vr(), this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 4;
                    continue e;
                case 1:
                    this.e1vv_1 = pa_1;
                    let pe;
                    this.d1vv_1;
                    try {
                        pe = dn(ms.f1vr().d1vh(this.e1vv_1, new Ys(0, 0), ms.f1vr().r7c(), []));
                    } catch (error) {
                        if (!(error instanceof Error)) {
                            throw error;
                        }
                        pe = dn(_n(error));
                    }
                    this.f1vv_1 = pe;
                    this.g1vv_1 = this.f1vv_1;
                    this.h1vv_1 = hn(this.g1vv_1);
                    if (this.h1vv_1 == null) {
                        this.i1vv_1 = null;
                        this.na_1 = 3;
                        continue e;
                    }
                    this.j1vv_1 = this.h1vv_1;
                    this.k1vv_1 = this.j1vv_1;
                    this.l1vv_1 = this.k1vv_1;
                    this.m1vv_1 = this.l1vv_1;
                    this.n1vv_1 = this.m1vv_1;
                    this.o1vv_1 = this.n1vv_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.d1vv_1.r1vv_1.q1tt(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    pn(pa_1, this.o1vv_1, Ts, RealDatabaseManager$provideDb$lambda(this.o1vv_1));
                    this.i1vv_1 = Ps;
                    this.na_1 = 3;
                    continue e;
                case 3:
                    const ye = this.g1vv_1;
                    fn(ye);
                    const es = kn(ye);
                    (es == null || es != null ? es : Es()).z1vg_1;
                    this.d1vv_1.t1vv_1 = this.e1vv_1;
                    const ss = this.d1vv_1;
                    const ns = new Adapter(Ms);
                    const ts = new Adapter_0(Ms);
                    const rs = new Adapter_1(Ms);
                    const os = new Adapter_4(Ms);
                    const as = new Adapter_7($n, bs, bs);
                    const cs = new Adapter_2($n, $n, $n, $n);
                    const us = new Adapter_3(vs);
                    const ls = new Adapter_6(Ms);
                    const gs = new Adapter_8(_s);
                    const ds = new Adapter_5(_s, _s);
                    ss.s1vv_1 = ms.g1vr(this.e1vv_1, ns, ts, rs, cs, us, os, ds, ls, as, gs);
                    this.na_1 = 4;
                    continue e;
                case 4:
                    const hs = this.d1vv_1.s1vv_1;
                    if (hs == null) {
                        throw Mn(bn("Database is not provided"));
                    }
                    return hs;
                case 5:
                    throw this.qa_1;
            }
        } catch (error) {
            const ps = error;
            if (this.oa_1 === 5) {
                throw ps;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ps;
        }
    }
};
Ss(RealDatabaseManager).um7 = function() {
    return this.r1vv_1;
};
Ss(RealDatabaseManager).t1vu = function(ae) {
    const pe = new $provideDbCOROUTINE$78(this, ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(SaveableSqlDriver$notifyListeners$slambda).f1w = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = Ps;
    ye.qa_1 = null;
    return ye.va();
};
Ss(SaveableSqlDriver$notifyListeners$slambda).hb = function(ae, pe) {
    return this.f1w(ae != null && Hs(ae, yn) ? ae : Es(), pe);
};
Ss(SaveableSqlDriver$notifyListeners$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 5;
                    this.na_1 = 1;
                    continue e;
                case 1:
                    this.oa_1 = 4;
                    this.oa_1 = 3;
                    this.c1vw_1.h1vw_1 = true;
                    this.na_1 = 2;
                    if ((pa_1 = this.c1vw_1.g1vw_1(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1 instanceof SaveableSqlDriver ? pa_1 : null;
                    if (pe == null) {
                        throw Mn(bn("Not chrome ext"));
                    }
                    const ye = pe;
                    this.c1vw_1.f1vw_1 = ye.f1vw_1;
                    this.c1vw_1.g1vw_1 = ye.g1vw_1;
                    this.e1vw_1 = Ps;
                    this.oa_1 = 5;
                    this.na_1 = 6;
                    continue e;
                case 3:
                    this.oa_1 = 4;
                    if (this.qa_1 instanceof Error) {
                        this.qa_1;
                        this.e1vw_1 = Ps;
                        this.oa_1 = 5;
                        this.na_1 = 6;
                        continue e;
                    }
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 5;
                    const es = this.qa_1;
                    this.c1vw_1.h1vw_1 = false;
                    throw es;
                case 5:
                    throw this.qa_1;
                case 6:
                    this.oa_1 = 5;
                    this.c1vw_1.h1vw_1 = false;
                    return Ps;
            }
        } catch (error) {
            const ss = error;
            if (this.oa_1 === 5) {
                throw ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ss;
        }
    }
};
Ss(SaveableSqlDriver$notifyListeners$slambda).g1w = function(ae, pe) {
    const ye = new SaveableSqlDriver$notifyListeners$slambda(this.c1vw_1, pe);
    ye.d1vw_1 = ae;
    return ye;
};
Ss(SaveableSqlDriver).k1vg = function(ae, pe) {
    this.f1vw_1.k1vg(ae.slice(), pe);
};
Ss(SaveableSqlDriver).w1vg = function() {
    return this.f1vw_1.w1vg();
};
Ss(SaveableSqlDriver).a1vh = function(ae, pe, ye, es) {
    while(this.h1vw_1){
        continue;
    }
    return this.f1vw_1.a1vh(ae, pe, ye, es);
};
Ss(SaveableSqlDriver).j1vg = function(ae, pe, ye, es, ss) {
    while(this.h1vw_1){
        continue;
    }
    return this.f1vw_1.j1vg(ae, pe, ye, es, ss);
};
Ss(SaveableSqlDriver).x1vg = function(ae) {
    this.f1vw_1.x1vg(ae.slice());
    Cn(An().f1ue(), Ts, Ts, function SaveableSqlDriver$notifyListeners$slambda_0(ae, pe) {
        const ye = new SaveableSqlDriver$notifyListeners$slambda(ae, pe);
        const l = function(ae, pe) {
            return ye.f1w(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, null));
};
Ss(SaveableSqlDriver).l1vg = function(ae, pe) {
    this.f1vw_1.l1vg(ae.slice(), pe);
};
Ss(BigDecimalColumnAdapter).dik = function(ae) {
    return In(ae);
};
Ss(BigDecimalColumnAdapter).f1vh = function(ae) {
    return this.dik(ae != null && typeof ae === "string" ? ae : Es());
};
Ss(BigIntegerColumnAdapter).dik = function(ae) {
    return En(ae);
};
Ss(BigIntegerColumnAdapter).f1vh = function(ae) {
    return this.dik(ae != null && typeof ae === "string" ? ae : Es());
};
Ss(LongColumnAdapter).e1vh = function(ae) {
    return ae;
};
Ss(LongColumnAdapter).f1vh = function(ae) {
    return this.e1vh(ae instanceof Ys ? ae : Es());
};
Ss(SecurityItemTypeColumnAdapter).e1vh = function(ae) {
    const pe = Companion_getInstance_0().j1vw(ae);
    if (pe == null) {
        throw Mn(bn(`SecurityItemTypeAdapter: invalid databaseValue: ${ae.toString()}`));
    }
    return pe;
};
Ss(SecurityItemTypeColumnAdapter).f1vh = function(ae) {
    return this.e1vh(ae instanceof Ys ? ae : Es());
};
Ss(Companion_0).j1vw = function(ae) {
    return this.i1vw_1.x2(ae);
};
Ss(UIntColumnAdapter).n1vw = function(ae) {
    return jn(ae.p1());
};
Ss(UIntColumnAdapter).f1vh = function(ae) {
    return new Dn(this.n1vw(ae instanceof Ys ? ae : Es()));
};
Ss(ULongColumnAdapter).o1vw = function(ae) {
    return Bn(ae);
};
Ss(ULongColumnAdapter).f1vh = function(ae) {
    return new Ln(this.o1vw(ae instanceof Ys ? ae : Es()));
};
Ss(provideDbDriver$slambda).b1vy = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(provideDbDriver$slambda).mc = function(ae) {
    return this.b1vy(ae);
};
Ss(provideDbDriver$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = onSave(this.y1vx_1, this.z1vx_1, this.a1vy_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return pa_1;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(provideDbDriver$slambda).d28 = function(ae) {
    return new provideDbDriver$slambda(this.y1vx_1, this.z1vx_1, this.a1vy_1, ae);
};
Ss(onSave$slambda).b1vy = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = Ps;
    pe.qa_1 = null;
    return pe.va();
};
Ss(onSave$slambda).mc = function(ae) {
    return this.b1vy(ae);
};
Ss(onSave$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = onSave(this.k1vy_1, this.l1vy_1, this.m1vy_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return pa_1;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(onSave$slambda).d28 = function(ae) {
    return new onSave$slambda(this.k1vy_1, this.l1vy_1, this.m1vy_1, ae);
};
Ss($provideDbDriverCOROUTINE$79).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 7;
                    this.na_1 = 1;
                    if ((pa_1 = initSqlJS(this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.y1vw_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = Un(this.y1vw_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.z1vw_1 = pa_1;
                    if (Kn.y53()) {
                        this.na_1 = 4;
                        if ((pa_1 = initChromeDb(this.z1vw_1, Ts, this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 3;
                    if ((pa_1 = initLocalDb(this.z1vw_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                case 4:
                    this.a1vx_1 = pa_1;
                    this.na_1 = 5;
                    continue e;
                case 5:
                    this.b1vx_1 = this.a1vx_1;
                    this.na_1 = 6;
                    if ((pa_1 = initSqlDriver(this.x1vw_1, this.b1vx_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 6:
                    return new SaveableSqlDriver(pa_1, provideDbDriver$slambda_0(this.x1vw_1, this.z1vw_1, this.b1vx_1, null));
                case 7:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 7) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss($onSaveCOROUTINE$80).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    if (Kn.w53()) {
                        this.n1vx_1 = null;
                        this.na_1 = 3;
                        continue e;
                    }
                    this.o1vx_1 = this.m1vx_1.export();
                    setStorageKey(Ts, this.o1vx_1);
                    this.na_1 = 1;
                    if ((pa_1 = initChromeDb(this.l1vx_1, this.o1vx_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.p1vx_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = initSqlDriver(this.k1vx_1, this.p1vx_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1;
                    this.n1vx_1 = new SaveableSqlDriver(pe, onSave$slambda_0(this.k1vx_1, this.l1vx_1, this.p1vx_1, null));
                    this.na_1 = 3;
                    continue e;
                case 3:
                    return this.n1vx_1;
                case 4:
                    throw this.qa_1;
            }
        } catch (error) {
            const ye = error;
            if (this.oa_1 === 4) {
                throw ye;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ye;
        }
    }
};
Ss($initChromeDbCOROUTINE$81).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.x1vy_1 = this.w1vy_1;
                    if (this.x1vy_1 == null) {
                        this.na_1 = 1;
                        if ((pa_1 = getStorageKey("TrustSDK_DB", this)) === zs()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.y1vy_1 = this.x1vy_1;
                    this.na_1 = 2;
                    continue e;
                case 1:
                    this.y1vy_1 = pa_1;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    const pe = this.y1vy_1;
                    const ye = pe ?? new Uint8Array(0);
                    return invoke_0(this.v1vy_1.Database, ye);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const es = error;
            if (this.oa_1 === 3) {
                throw es;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = es;
        }
    }
};
Ss(JsSqlDriver).k1vg = function(ae, pe) {
    for(let ye = 0, es = ae.length; ye < es;){
        const ss = ae[ye];
        ye = ye + 1 | 0;
        let ns;
        const ts = this.o1vz_1;
        const rs = ts.x2(ss);
        if (rs == null) {
            const os = Zn();
            ts.a3(ss, os);
            ns = os;
        } else {
            ns = rs;
        }
        ns.e(pe);
    }
};
Ss(JsSqlDriver).l1vg = function(ae, pe) {
    for(let ye = 0, es = ae.length; ye < es;){
        const ss = ae[ye];
        ye = ye + 1 | 0;
        const ns = this.o1vz_1.x2(ss);
        ns?.r2(pe);
    }
};
Ss(JsSqlDriver).x1vg = function(ae) {
    const pe = sn();
    for(let ye = 0, es = ae.length; ye < es;){
        const ss = ae[ye];
        ye = ye + 1 | 0;
        const ns = this.o1vz_1.x2(ss);
        Xn(pe, ns ?? Jn());
    }
    for(const ts = Qn(pe).k(); ts.l();){
        ts.m().u1vf();
    }
};
Ss(JsSqlDriver).j1vg = function(ae, pe, ye, es, ss) {
    const ns = createOrGetStatement(this, ae, pe);
    bind(0, ns, es, ss);
    let ts;
    const rs = new JsSqlCursor(ns);
    try {
        ts = ye(rs);
    } finally{
        rs.d5();
    }
    return ts;
};
Ss(JsSqlDriver).a1vh = function(ae, pe, ye, es) {
    const ss = createOrGetStatement(this, ae, pe);
    bind(0, ss, ye, es);
    ss.step();
    ss.freemem();
    return new rt(Yn(new Ys(0, 0)));
};
Ss(JsSqlDriver).w1vg = function() {
    return this.n1vz_1;
};
Ss(JsSqlCursor).q1vz = function() {
    return Yn(this.p1vz_1.step());
};
Ss(JsSqlCursor).m = function() {
    return new rt(this.q1vz());
};
Ss(JsSqlCursor).f1vi = function(ae) {
    return this.p1vz_1.get()[ae];
};
Ss(JsSqlCursor).g1vi = function(ae) {
    const pe = this.p1vz_1.get()[ae];
    const ye = pe != null && typeof pe === "number" ? pe : null;
    if (ye == null) {
        return null;
    }
    return kt(ye);
};
Ss(JsSqlCursor).e1vk = function(ae) {
    return this.p1vz_1.get()[ae];
};
Ss(JsSqlCursor).r1vz = function(ae) {
    const pe = this.p1vz_1.get()[ae];
    const ye = pe != null && typeof pe === "number" ? pe : null;
    if (ye == null) {
        return null;
    }
    return kt(ye).equals(new Ys(1, 0));
};
Ss(JsSqlCursor).d5 = function() {
    this.p1vz_1.freemem();
};
Ss(JsSqlPreparedStatement).h1vi = function(ae, pe) {
    this.k1vz_1.b1(ae, pe == null ? null : pe.f4());
};
Ss(JsSqlPreparedStatement).f1vk = function(ae, pe) {
    this.k1vz_1.b1(ae, pe);
};
Ss(JsSqlPreparedStatement).e1vi = function(ae, pe) {
    this.k1vz_1.b1(ae, pe);
};
Ss($initSqlDriverCOROUTINE$82).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.j1vz_1 = driver(this.i1vz_1);
                    this.na_1 = 1;
                    if ((pa_1 = Wt(this.h1vz_1, this.j1vz_1, this)) === zs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return this.j1vz_1;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 2) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
Ss(SaveableSqlDriver).b1vh = Sn;
Ss(JsSqlDriver).b1vh = Sn;
ms = new Companion;
gs = new Schema;
ds = new BigDecimalColumnAdapter;
_s = new BigIntegerColumnAdapter;
hs = new LongColumnAdapter;
vs = new SecurityItemTypeColumnAdapter;
bs = new UIntColumnAdapter;
Ms = new ULongColumnAdapter;
ae.$_$ = ae.$_$ || {};
ae.$_$.a = EarnPortfolio;
ae.$_$.b = RealDatabaseManager;
ae.$_$.c = TrustSDKDB;
ae.$_$.d = function provideDbDriver(ae, pe) {
    const ye = new $provideDbDriverCOROUTINE$79(ae, pe);
    ye.pa_1 = Ps;
    ye.qa_1 = null;
    return ye.va();
};
ae.$_$.e = ds;
ae.$_$.f = _s;
ae.$_$.g = hs;
this.l1vf_1 = "trust://";
this.m1vf_1 = "https://link.trustwallet.com";
function AssetApiClientImpl$getAsset$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            `/v1/assets/${ae}`
        ]);
        return pn;
    };
}
;
function AssetApiClientImpl$getAssets$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            "/v1/assets"
        ]);
        pe.r6m_1.w67("asset_ids", iw(ae, ","));
        return pn;
    };
}
;
function AssetApiClientImpl$getAssetStatus$lambda(ae, pe, ye, es) {
    return function(ye, ss) {
        Iw(ye, [
            `/v2/coinstatus/${ae}`
        ]);
        ye.r6m_1.w67("version", pe);
        ye.r6m_1.w67("platform", function getPlatformNameForCoinStatus(ae) {
            if (Tw().e3_1 === 3) {
                return "extension";
            }
            return Tw().d3_1;
        }());
        ye.r6m_1.w67("include_security_info", es.z1ut_1.toString());
        ye.r6m_1.w67("include_solana_security_info", es.a1uu_1.toString());
        return pn;
    };
}
;
function AssetApiClientImpl$findAssets$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            "/v1/search/assets"
        ]);
        const ae_y1uw_1 = ae.y1uw_1;
        const ss = !(ae_y1uw_1 == null || rw(ae_y1uw_1) === 0);
        pe.r6m_1.w67(ss ? "query" : "exactQuery", ae.q1uw_1);
        const pe_r6m_1 = pe.r6m_1;
        const ae_r1uw_1 = ae.r1uw_1;
        const rs = ae_r1uw_1 ?? "";
        pe_r6m_1.w67("networks", rs);
        pe.r6m_1.w67("limit", ae.s1uw_1.toString());
        pe.r6m_1.w67("offset", ae.t1uw_1.toString());
        pe.r6m_1.w67("type", ae.u1uw_1);
        pe.r6m_1.w67("version", ae.v1uw_1.toString());
        if (!ss) {
            pe.r6m_1.w67("sortBy", ae.w1uw_1);
        }
        if (ss) {
            const os = pe.r6m_1;
            const as = ae.y1uw_1;
            const cs = as ?? "";
            os.w67("ranking_mode", cs);
        }
        const ae_x1uw_1 = ae.x1uw_1;
        if (ae_x1uw_1 != null) {
            pe.r6m_1.w67("from_asset", ae_x1uw_1);
        }
        return pn;
    };
}
;
function AssetApiClientImpl$getPopularAssets$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            "/v1/assets/popular"
        ]);
        pe.r6m_1.w67("type", ae);
        return pn;
    };
}
;
function AssetApiClientImpl$getListingAssets$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            "/v1/assets/listings"
        ]);
        pe.r6m_1.w67("version", ae.e1ux_1.toString());
        pe.r6m_1.w67("currency", ae.d1ux_1);
        const pe_r6m_1 = pe.r6m_1;
        const ae_c1ux_1 = ae.c1ux_1;
        const ns = ae_c1ux_1 ?? "";
        pe_r6m_1.w67("category_id", ns);
        const ae_f1ux_1 = ae.f1ux_1;
        if (ae_f1ux_1 != null) {
            pe.r6m_1.w67("networks", iw(ae_f1ux_1));
        }
        const ae_g1ux_1 = ae.g1ux_1;
        if (ae_g1ux_1 != null) {
            pe.r6m_1.w67("sort", ae_g1ux_1);
        }
        const ae_h1ux_1 = ae.h1ux_1;
        if (ae_h1ux_1 != null) {
            pe.r6m_1.w67("limit", ae_h1ux_1.toString());
        }
        const ae_i1ux_1 = ae.i1ux_1;
        if (ae_i1ux_1 != null) {
            pe.r6m_1.w67("cursor", ae_i1ux_1);
        }
        const ae_j1ux_1 = ae.j1ux_1;
        if (ae_j1ux_1 != null) {
            pe.r6m_1.w67("use_pagination", ae_j1ux_1.toString());
        }
        return pn;
    };
}
;
function AssetApiClientImpl(ae, pe, ye) {
    this.a1y5_1 = ae;
    this.b1y5_1 = pe;
    this.c1y5_1 = ye;
}
;
function BalanceApiClientImpl$streamBalances$slambda$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            "/v1/balances/stream"
        ]);
        if (ae) {
            pe.r6m_1.w67("test_mode", "true");
        }
        return pn;
    };
}
;
function BalanceApiClientImpl$streamBalances$slambda(ae, pe, ye, es) {
    this.n1yd_1 = ae;
    this.o1yd_1 = pe;
    this.p1yd_1 = ye;
    hn.call(this, es);
}
;
function BalanceApiClientImpl$parseLine$lambda() {
    return "Failed to parse NDJSON line";
}
;
function BalanceApiClientImpl(ae, pe, ye) {
    this.y1yc_1 = ae;
    this.z1yc_1 = pe;
    this.a1yd_1 = ye;
}
;
function MarketApiClientImpl$getTickers$lambda(ae, pe) {
    Iw(ae, [
        "/v2/market/tickers"
    ]);
    return pn;
}
;
function MarketApiClientImpl$getMarketInfo$lambda(ae, pe) {
    return function(ye, es) {
        Iw(ye, [
            `/v1/market/info/${ae}`
        ]);
        ye.r6m_1.w67("currency", pe);
        return pn;
    };
}
;
function MarketApiClientImpl$getUsdExchangeRate$lambda(ae) {
    return function(pe, ye) {
        Iw(pe, [
            "/v2/market/rates"
        ]);
        pe.r6m_1.w67("currency", ae);
        return pn;
    };
}
;
function MarketApiClientImpl(ae, pe) {
    this.b1yg_1 = ae;
    this.c1yg_1 = pe;
}
;
this.h2jw_1 = "/v1/invests";
this.i2jw_1 = "/v1/invests/stablecoin/quotes";
function InvestApiClientImpl$_init_$slambda_sd11l0(ae) {
    Xr.call(this, ae);
}
;
function InvestApiClientImpl$nativeInvests$lambda(ae, pe) {
    return function(ye, es) {
        q_(ye, [
            "/v1/invests/staking"
        ]);
        ye.r6m_1.w67("currency", ae);
        const ss = pe;
        if (ss != null) {
            ye.r6m_1.w67("limit", `${ss}`);
        }
        return kt;
    };
}
;
function InvestApiClientImpl$stablecoinInvests$lambda(ae, pe) {
    return function(ye, es) {
        q_(ye, [
            "/v1/invests/stablecoin"
        ]);
        ye.r6m_1.w67("currency", ae);
        const ss = pe;
        if (ss != null) {
            ye.r6m_1.w67("limit", `${ss}`);
        }
        return kt;
    };
}
;
function InvestApiClientImpl$getStablecoinPositions$lambda(ae, pe, ye) {
    return function(es, ss) {
        q_(es, [
            "/v1/invests/stablecoin/positions"
        ]);
        es.r6m_1.w67("wallet_address", ae);
        const ns = pe;
        if (ns != null) {
            es.r6m_1.w67("asset_ids", z_(ns, ","));
        }
        if (ye) {
            es.r6m_1.w67("skip_geo_blocking", "true");
        }
        return kt;
    };
}
;
function InvestApiClientImpl$createApproveQuote$lambda(ae, pe) {
    q_(ae, [
        "/v1/invests/stablecoin/quotes/approve"
    ]);
    return kt;
}
;
function InvestApiClientImpl$createDepositQuote$lambda(ae, pe) {
    q_(ae, [
        "/v1/invests/stablecoin/quotes/deposit"
    ]);
    return kt;
}
;
function InvestApiClientImpl$createWithdrawQuote$lambda(ae, pe) {
    q_(ae, [
        "/v1/invests/stablecoin/quotes/withdraw"
    ]);
    return kt;
}
;
function InvestApiClientImpl(ae, pe, ye) {
    let es;
    es = ye === Wt ? new ah(function InvestApiClientImpl$_init_$slambda_sd11l0_0(ae) {
        const pe = new InvestApiClientImpl$_init_$slambda_sd11l0(ae);
        const l = function(ae) {
            return pe.x4x(ae);
        };
        l.$arity = 0;
        return l;
    }(null)) : ye;
    ye = es;
    this.f2jy_1 = ae;
    this.g2jy_1 = pe;
    this.h2jy_1 = ye;
}
;
function MerklRewardsClientImpl$merklRewards$lambda(ae) {
    return function(pe, ye) {
        q_(pe, [
            "/v1/launchpool/userMultiChainRewards"
        ]);
        (function applyParameters(ae, pe) {
            ae.w67("address", pe.a1w8_1);
            const ye = pe.b1w8_1.k();
            while(ye.l()){
                const es = ye.m();
                ae.w67("chain_ids", Bw(es));
            }
            ae.w67("include_test_rewards", pe.d1w8_1.toString());
            const pe_c1w8_1 = pe.c1w8_1;
            if (pe_c1w8_1 != null) {
                ae.w67("source", pe_c1w8_1.h1w8_1);
            }
        })(pe.r6m_1, ae);
        return kt;
    };
}
;
function MerklRewardsClientImpl(ae, pe) {
    this.r2k7_1 = ae;
    this.s2k7_1 = pe;
}
;
if (ae.p1ua(Nl()) == null) {
    ye = null;
} else {
    ye = pe ? new Gl(Wl().p1wq_1) : new Kl(Ul(), "https://short.trustwallet.com/ETH-Staking-Earn-Page-Banner");
}
;
vm();
this.o212_1 = fm(365, pm());
this.p212_1 = new km(300, 0);
this.q212_1 = new km(300, 0);
this.r212_1 = 6;
this.s212_1 = 5;
this.t212_1 = 5;
this.u212_1 = new km(300000, 0);
this.v212_1 = 10;
this.w212_1 = 20;
this.x212_1 = "https://docs.asterdex.com/product/aster-perpetual-pro/fees-and-specs/fees";
this.y212_1 = "https://www.asterdex.com/en/futures/trading-rules/trading-rules";
this.z212_1 = "https://trustwallet.com/blog/announcements/introducing-perps-trust-wallet";
this.a213_1 = "https://docs.asterdex.com/product/help";
this.b213_1 = "https://docs.asterdex.com/product/aster-perpetual-pro/single-asset-mode-and-multi-asset-mode";
this.c213_1 = new Rm(false, false, false, true, false, false);
this.d213_1 = Lw().d8t_1;
this.e213_1 = gm();
;
function PerpetualApiClientImpl$getNonce$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/public/future/web3/get-nonce"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$login$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/public/future/web3/login"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$placeOrder$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/order/place-order"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$placeStrategyOrder$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/strategy/place-order"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getWithdrawAssets$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/public/future/apx/withdraw/assets"
    ]);
    ae.r6m_1.w67("network", "EVM");
    return Tl;
}
;
function PerpetualApiClientImpl$getDepositAssets$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/public/future/apx/deposit/assets"
    ]);
    ae.r6m_1.w67("network", "EVM");
    return Tl;
}
;
function PerpetualApiClientImpl$getWithdrawalFee$lambda(ae, pe, ye, es, ss) {
    return function(ns, ts) {
        Kg(ns, [
            "/bapi/futures/v1/public/future/apx/estimate-withdraw-fee"
        ]);
        const ns_r6m_1 = ns.r6m_1;
        ns_r6m_1.w67("network", "EVM");
        ns_r6m_1.w67("accountType", "perp");
        ns_r6m_1.w67("chainId", ae);
        ns_r6m_1.w67("currency", pe);
        const os = ye;
        if (os != null) {
            ns_r6m_1.w67("baseFee", os);
        }
        const as = es;
        if (as != null) {
            ns_r6m_1.w67("maxPriorityFeePerGas", as);
        }
        const cs = ss;
        if (cs != null) {
            ns_r6m_1.w67("gasPrice", cs);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getChainWithdrawLimit$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/web3/chain-withdraw-limit"
        ]);
        ye.r6m_1.w67("currency", ae);
        ye.r6m_1.w67("chainId", pe);
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getLockedProfit$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v1/private/future/apx/limit/profit"
        ]);
        pe.r6m_1.w67("currency", ae);
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getLockedProfit$lambda_0(ae) {
    return function() {
        return `Failed to getProfitWithdrawLimit: ${ae.toString()}`;
    };
}
;
function PerpetualApiClientImpl$requestWithdraw$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/apx/user-withdraw"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getMaxWithdrawAmount$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/user-data/getMaxWithdrawAmount"
        ]);
        const ss = ae;
        const ns = Wg(jm("assetName", pe));
        if (ns == null) {
            ss.d79_1 = Jg;
            let ts;
            const rs = Xw(Gg);
            try {
                ts = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new Hg(rs, ts);
            ss.w7e(os);
        } else if (ns instanceof Zg) {
            ss.d79_1 = ns;
            ss.w7e(null);
        } else {
            ss.d79_1 = ns;
            let as;
            const cs = Xw(Gg);
            try {
                as = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                as = null;
            }
            const us = new Hg(cs, as);
            ss.w7e(us);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$updateMarginType$lambda(ae, pe, ye) {
    return function(es, ss) {
        Kg(es, [
            "/bapi/futures/v1/private/future/user-data/adjust-margin-type"
        ]);
        const ns = ae;
        const ts = Xg([
            jm("marginType", pe),
            jm("symbol", ye)
        ]);
        if (ts == null) {
            ns.d79_1 = Jg;
            let rs;
            const os = Xw(Gg);
            try {
                rs = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new Hg(os, rs);
            ns.w7e(as);
        } else if (ts instanceof Zg) {
            ns.d79_1 = ts;
            ns.w7e(null);
        } else {
            ns.d79_1 = ts;
            let cs;
            const us = Xw(Gg);
            try {
                cs = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                cs = null;
            }
            const ls = new Hg(us, cs);
            ns.w7e(ls);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getPerpetualAccountBalance$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v4/private/future/user-data/user-balance"
        ]);
        const es = ae;
        const ss = Wg(jm("platform", "dex"));
        if (ss == null) {
            es.d79_1 = Jg;
            let ns;
            const ts = Xw(Gg);
            try {
                ns = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ns = null;
            }
            const rs = new Hg(ts, ns);
            es.w7e(rs);
        } else if (ss instanceof Zg) {
            es.d79_1 = ss;
            es.w7e(null);
        } else {
            es.d79_1 = ss;
            let os;
            const as = Xw(Gg);
            try {
                os = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                os = null;
            }
            const cs = new Hg(as, os);
            es.w7e(cs);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getAssetIndex$lambda(ae, pe) {
    Kg(ae, [
        "/fapi/v1/assetIndex"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getTradeInfo$lambda(ae, pe) {
    Kg(ae, [
        "/fapi/v1/premiumIndex"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getFavoriteSymbols$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v1/private/future/user-setting/get-optional-symbols"
        ]);
        const es = ae;
        if ("{}" instanceof Zg) {
            es.d79_1 = "{}";
            es.w7e(null);
        } else {
            es.d79_1 = "{}";
            let ss;
            const ns = Vg().vd();
            try {
                ss = Yw(Vg().vd(), Qw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ss = null;
            }
            const ts = new Hg(ns, ss);
            es.w7e(ts);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$setFavoriteSymbols$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/user-setting/update-optional-symbols"
        ]);
        const ss = ae;
        const ns = Wg(jm("optionalSymbols", fm(pe, ",")));
        if (ns == null) {
            ss.d79_1 = Jg;
            let ts;
            const rs = Xw(Gg);
            try {
                ts = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new Hg(rs, ts);
            ss.w7e(os);
        } else if (ns instanceof Zg) {
            ss.d79_1 = ns;
            ss.w7e(null);
        } else {
            ss.d79_1 = ns;
            let as;
            const cs = Xw(Gg);
            try {
                as = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().vd(), Qw([]), false))
                ]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                as = null;
            }
            const us = new Hg(cs, as);
            ss.w7e(us);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$adjustLeverage$lambda(ae, pe, ye) {
    return function(es, ss) {
        Kg(es, [
            "/bapi/futures/v1/private/future/user-data/adjustLeverage"
        ]);
        const ns = ae;
        const ts = new PerpetualAdjustLeverageRequest(pe, ye);
        if (ts == null) {
            ns.d79_1 = Jg;
            let rs;
            const os = Xw(PerpetualAdjustLeverageRequest);
            try {
                rs = Yw(Xw(PerpetualAdjustLeverageRequest), Qw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new Hg(os, rs);
            ns.w7e(as);
        } else if (ts instanceof Zg) {
            ns.d79_1 = ts;
            ns.w7e(null);
        } else {
            ns.d79_1 = ts;
            let cs;
            const us = Xw(PerpetualAdjustLeverageRequest);
            try {
                cs = Yw(Xw(PerpetualAdjustLeverageRequest), Qw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                cs = null;
            }
            const ls = new Hg(us, cs);
            ns.w7e(ls);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getAssetIcons$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v1/public/future/asset/ae/all-asset-logo"
        ]);
        const es = ae;
        if ("{}" instanceof Zg) {
            es.d79_1 = "{}";
            es.w7e(null);
        } else {
            es.d79_1 = "{}";
            let ss;
            const ns = Vg().vd();
            try {
                ss = Yw(Vg().vd(), Qw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ss = null;
            }
            const ts = new Hg(ns, ss);
            es.w7e(ts);
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getExchangeInfo$lambda(ae, pe) {
    Kg(ae, [
        "/fapi/v1/astherusExchangeInfo"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getTickers$lambda(ae, pe) {
    Kg(ae, [
        "/fapi/v1/ticker/24hr"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getPairs$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/future/v1/public/future/aster/ticker/pair"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getKlines$lambda(ae, pe, ye, es) {
    return function(ss, ns) {
        Kg(ss, [
            "/fapi/v1/continuousKlines"
        ]);
        ss.r6m_1.w67("pair", ae);
        ss.r6m_1.w67("interval", pe.e21g_1);
        ss.r6m_1.w67("limit", ye.toString());
        ss.r6m_1.w67("contractType", "PERPETUAL");
        if (es != null) {
            ss.r6m_1.w67("endTime", es.toString());
        }
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getBrackets$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/friendly/future/common/brackets"
        ]);
        const ss = ae;
        const ns = pe == null || gm(pe) ? "{}" : Wg(jm("symbol", pe));
        if (ns == null) {
            ss.d79_1 = Jg;
            let ts;
            const rs = Vg().ld();
            try {
                ts = Yw(Vg().ld(), Qw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new Hg(rs, ts);
            ss.w7e(os);
        } else if (ns instanceof Zg) {
            ss.d79_1 = ns;
            ss.w7e(null);
        } else {
            ss.d79_1 = ns;
            let as;
            const cs = Vg().ld();
            try {
                as = Yw(Vg().ld(), Qw([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                as = null;
            }
            const us = new Hg(cs, as);
            ss.w7e(us);
        }
        return Tl;
    };
}
;
