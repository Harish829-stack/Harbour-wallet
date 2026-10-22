function PerpetualApiClientImpl$getUserPosition$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v5/private/future/user-data/user-position"
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
function PerpetualApiClientImpl$getUserOrders$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v2/private/future/order/open-orders"
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
function PerpetualApiClientImpl$getStrategyOrders$lambda(ae, pe, ye) {
    return function(es, ss) {
        Kg(es, [
            "/bapi/futures/v1/private/future/strategy/query-open-strategy"
        ]);
        const ns = ae;
        const ts = Xg([
            jm("strategyType", pe),
            jm("strategyId", ye)
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
function PerpetualApiClientImpl$cancelOrder$lambda(ae, pe, ye) {
    return function(es, ss) {
        Kg(es, [
            "/bapi/futures/v1/private/future/order/cancel-order"
        ]);
        const ns = ae;
        const ts = Xg([
            jm("orderId", pe),
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
function PerpetualApiClientImpl$cancelAllOrders$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/order/cancel-orders"
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
function PerpetualApiClientImpl$closeAllPositions$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v2/private/future/order/clear-position"
        ]);
        const es = ae;
        const ss = Wg(jm("symbolList", Hm()));
        if (ss == null) {
            es.d79_1 = Jg;
            let ns;
            const ts = Xw(Gg);
            try {
                ns = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Xw(Jw), Qw([
                        em(Yw(Vg().vd(), Qw([]), false))
                    ]), false))
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
                    em(Yw(Xw(Jw), Qw([
                        em(Yw(Vg().vd(), Qw([]), false))
                    ]), false))
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
function PerpetualApiClientImpl$getMultiAsset$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v1/private/future/user-data/get-join-margin"
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
function PerpetualApiClientImpl$changeMultiAsset$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/user-data/change-join-margin"
        ]);
        const ss = ae;
        const ns = Wg(jm("joinMargin", pe));
        if (ns == null) {
            ss.d79_1 = Jg;
            let ts;
            const rs = Xw(Gg);
            try {
                ts = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Vg().od(), Qw([]), false))
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
                    em(Yw(Vg().od(), Qw([]), false))
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
function PerpetualApiClientImpl$getUserLeverage$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v1/private/future/user-data/userLeverage"
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
function PerpetualApiClientImpl$getNetworkDepositAddress$lambda(ae) {
    return function(pe, ye) {
        Kg(pe, [
            "/bapi/futures/v1/private/future/web3/deposit-address"
        ]);
        pe.r6m_1.w67("chainId", ae);
        return Tl;
    };
}
;
function PerpetualApiClientImpl$getOrderHistory$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/order/order-history"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getTradeHistory$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/user-data/trade-history"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getTransactionHistory$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/user-data/transaction-history"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getDepositWithdrawalHistory$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/web3/ae/depositAndWithdraw/history"
        ]);
        const ss = ae;
        const ns = Wg(jm("addr", pe));
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
function PerpetualApiClientImpl$getAccountTierCommission$lambda(ae, pe) {
    Kg(ae, [
        "/bapi/futures/v1/private/future/user-data/account-tier-commission"
    ]);
    return Tl;
}
;
function PerpetualApiClientImpl$getPrivateDataWsKey$lambda(ae, pe) {
    return function(ye, es) {
        Kg(ye, [
            "/bapi/futures/v1/private/future/user-data/user-listen-key"
        ]);
        const ss = ae;
        const ns = Wg(jm("timestamp", pe));
        if (ns == null) {
            ss.d79_1 = Jg;
            let ts;
            const rs = Xw(Gg);
            try {
                ts = Yw(Xw(Gg), Qw([
                    em(Yw(Vg().vd(), Qw([]), false)),
                    em(Yw(Xw(tw), Qw([]), false))
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
                    em(Yw(Xw(tw), Qw([]), false))
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
function PerpetualApiClientImpl(ae, pe) {
    this.w29n_1 = ae;
    this.x29n_1 = pe;
}
;
function GasStationClient$getFeeHistory$lambda(ae) {
    return function(pe, ye) {
        ks(pe, [
            `/v1/fee/history/${ae.toString()}`
        ]);
        return Rs;
    };
}
;
function GasStationClient$getFeePriority$lambda(ae) {
    return function(pe, ye) {
        ks(pe, [
            `/v1/fee/priority/${ae.toString()}`
        ]);
        return Rs;
    };
}
;
function GasStationClient(ae, pe) {
    this.f2os_1 = ae;
    this.g2os_1 = pe;
}
;
function TransactionApiClientImpl$getTransaction$lambda(ae, pe, ye) {
    return function(es, ss) {
        Zs(es, [
            `/v1/txhub/txs/${ae}`
        ]);
        es.r6m_1.w67("chain", pe);
        if (ye != null) {
            es.r6m_1.w67("tx_type", ye);
        }
        return Xs;
    };
}
;
function TransactionApiClientImpl(ae, pe) {
    this.z23d_1 = ae;
    this.a23e_1 = pe;
}
;
Ws = this;
this.a23z_1 = "thorchain";
this.b23z_1 = "https://track.ninerealms.com/%s?logo=trust.svg";
this.c23z_1 = "";
this.d23z_1 = new xn(1000, 0);
this.e23z_1 = 30;
es = bm("https://track.ninerealms.com/%s?logo=trust.svg", "%s", pe);
;
const ss = function getCowswapExplorerUrl(ae, pe) {
    _init_properties_CowswapExplorer_kt__7kw3at();
    if (sl(pe) === 0) {
        return null;
    }
    let ye;
    const es = (function get_COWSWAP_CHAIN_PATHS() {
        _init_properties_CowswapExplorer_kt__7kw3at();
        return Gs;
    })().x2(ae);
    if (es == null) {
        return null;
    }
    ye = es;
    let ss;
    const ns = ye;
    ss = sl(ns) === 0 ? "" : `/${ns}`;
    return `https://explorer.cow.fi${ss}/orders/${pe}`;
}(ae, pe);
function ApprovalsDatabaseFactory() {}
;
Ss(Companion);
As(ApprovalsDB, "ApprovalsDB", Cs, Cs, Cs, [
    2
]);
zs(sam$kotlin_Comparator$0, "sam$kotlin_Comparator$0", Cs, Cs, [
    xs,
    Ps
]);
Bs(ApprovalsDBImpl$Schema$create$slambda, Ns, Cs, [
    0
]);
Bs(ApprovalsDBImpl$Schema$migrateInternal$slambda, Ns, Cs, [
    0
]);
Bs(ApprovalsDBImpl$Schema$migrate$slambda, Ns, Cs, [
    0
]);
Hs(Schema, "Schema", Cs, Cs, [
    Vs
]);
zs(ApprovalsDBImpl, "ApprovalsDBImpl", Cs, Zs, [
    Zs,
    ApprovalsDB
], [
    2
]);
zs(Adapter, "Adapter");
zs(Approval_0, "Approval");
zs(GetQuery, "GetQuery", Cs, an);
un($markAsPendingCOROUTINE$2, Ns);
zs(ApprovalsQueries, "ApprovalsQueries", Cs, Zs, Cs, [
    15,
    1,
    6,
    4,
    2
]);
Bs(ApprovalsCacheImpl$markAsPending$slambda, Ns, Cs, [
    1
]);
Bs(ApprovalsCacheImpl$get$slambda, Ns, Cs, [
    1
]);
un($markAsPendingCOROUTINE$5, Ns);
zs(ApprovalsCacheImpl, "ApprovalsCacheImpl", Cs, Cs, Cs, [
    15,
    5,
    4,
    1,
    2
]);
zs(ApprovalsApiClientImpl, "ApprovalsApiClientImpl", Cs, Cs, Cs, [
    1
]);
Hs(ApprovalsDatabaseFactory, "ApprovalsDatabaseFactory");
zs(ApprovalLocalEntity, "ApprovalLocalEntity");
Ss(Companion_0);
un($getCachedApprovalCOROUTINE$11, Ns);
zs(ApprovalsRepositoryImpl, "ApprovalsRepositoryImpl", Cs, Cs, Cs, [
    4,
    2,
    1,
    3
]);
zs(GetApprovalsUseCaseImpl, "GetApprovalsUseCaseImpl");
As(Action, "Action");
zs(Init, "Init", Cs, Cs, [
    Action
]);
Hs(Deinit, "Deinit", Cs, Cs, [
    Action
]);
Hs(Confirm, "Confirm", Cs, Cs, [
    Action
]);
Hs(ClearConfirmRequest, "ClearConfirmRequest", Cs, Cs, [
    Action
]);
zs(MarkAsPending, "MarkAsPending", Cs, Cs, [
    Action
]);
Hs(Loading, "Loading", Cs, Cs, [
    Un
]);
zs(Error_0, "Error", Error_0, Cs, [
    Un
]);
zs(Data, "Data", Cs, Cs, [
    Un
]);
zs(ViewState, "ViewState");
zs(sam$com_trustwallet_sdk_common_mvi_data_MviBinder_Mapper$0, "sam$com_trustwallet_sdk_common_mvi_data_MviBinder_Mapper$0", Cs, Cs, [
    Jn,
    Ps
]);
un($executeActionCOROUTINE$18, Ns);
un($onInitCOROUTINE$19, Ns);
zs(ApprovalDetailsFeatureImpl, "ApprovalDetailsFeatureImpl", Cs, Qn, Cs, [
    1
]);
ys(Companion).f1vr = function() {
    return function get_schema(ae) {
        return vs;
    }(Ms(ApprovalsDB));
};
ys(Companion).i27z = function(ae, pe) {
    return function newInstance(ae, pe, ye) {
        return new ApprovalsDBImpl(pe, ye);
    }(Ms(ApprovalsDB), ae, pe);
};
ys(sam$kotlin_Comparator$0).dg = function(ae, pe) {
    return this.k27z_1(ae, pe);
};
ys(sam$kotlin_Comparator$0).compare = function(ae, pe) {
    return this.dg(ae, pe);
};
ys(sam$kotlin_Comparator$0).g4 = function() {
    return this.k27z_1;
};
ys(sam$kotlin_Comparator$0).equals = function(ae) {
    let pe;
    if (ae != null && Os(ae, xs)) {
        pe = !(ae == null || !Os(ae, Ps)) && Es(this.g4(), ae.g4());
    } else {
        pe = false;
    }
    return pe;
};
ys(sam$kotlin_Comparator$0).hashCode = function() {
    return qs(this.g4());
};
ys(ApprovalsDBImpl$Schema$create$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = js;
    pe.qa_1 = null;
    return pe.va();
};
ys(ApprovalsDBImpl$Schema$create$slambda).mc = function(ae) {
    return this.c28(ae);
};
ys(ApprovalsDBImpl$Schema$create$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.t27z_1.b1vh(null, "CREATE TABLE Approval (\n    walletId TEXT NOT NULL,\n    address TEXT NOT NULL,\n    chainName TEXT NOT NULL,\n    chainIconUrl TEXT,\n    spenderAddress TEXT NOT NULL,\n    spenderName TEXT,\n    spenderExplorerUrl TEXT,\n    assetId TEXT NOT NULL,\n    riskLevel TEXT NOT NULL,\n    isUnlimited INTEGER NOT NULL,\n    allowanceAmount TEXT,\n    allowanceAmountInCurrency TEXT,\n    allowanceCurrencyCode TEXT,\n    pendingTimestamp INTEGER,\n    pendingTransactionHash TEXT,\n    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),\n    PRIMARY KEY (walletId, address, spenderAddress, assetId)\n)", 0).l12(this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return js;
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
ys(ApprovalsDBImpl$Schema$create$slambda).d28 = function(ae) {
    return new ApprovalsDBImpl$Schema$create$slambda(this.t27z_1, ae);
};
ys(ApprovalsDBImpl$Schema$migrateInternal$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = js;
    pe.qa_1 = null;
    return pe.va();
};
ys(ApprovalsDBImpl$Schema$migrateInternal$slambda).mc = function(ae) {
    return this.c28(ae);
};
ys(ApprovalsDBImpl$Schema$migrateInternal$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 6;
                    if (this.c280_1.k1(new Fs(1, 0)) <= 0 && this.d280_1.k1(new Fs(1, 0)) > 0) {
                        this.na_1 = 1;
                        if ((pa_1 = this.e280_1.b1vh(null, "CREATE TABLE IF NOT EXISTS Approval_new (\n    walletId TEXT NOT NULL,\n    address TEXT NOT NULL,\n    chainName TEXT NOT NULL,\n    chainIconUrl TEXT,\n    spenderAddress TEXT NOT NULL,\n    spenderName TEXT,\n    spenderExplorerUrl TEXT,\n    assetId TEXT NOT NULL,\n    riskLevel TEXT NOT NULL,\n    isUnlimited INTEGER NOT NULL,\n    allowanceAmount TEXT,\n    allowanceAmountInCurrency TEXT,\n    allowanceCurrencyCode TEXT,\n    pendingTimestamp INTEGER,\n    pendingTransactionHash TEXT,\n    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),\n    PRIMARY KEY (walletId, address, spenderAddress, assetId)\n)", 0).l12(this)) === Ds()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.na_1 = 5;
                    continue e;
                case 1:
                    this.na_1 = 2;
                    if ((pa_1 = this.e280_1.b1vh(null, "INSERT INTO Approval_new (\n    walletId,\n    address,\n    chainName,\n    chainIconUrl,\n    spenderAddress,\n    spenderName,\n    spenderExplorerUrl,\n    assetId,\n    riskLevel,\n    isUnlimited,\n    allowanceAmount,\n    allowanceAmountInCurrency,\n    allowanceCurrencyCode,\n    pendingTimestamp,\n    pendingTransactionHash,\n    timestamp\n)\nSELECT\n    walletId,\n    address,\n    chainName,\n    NULL, -- chainIconUrl (new column)\n    spenderAddress,\n    spenderName,\n    spenderExplorerUrl,\n    assetId,\n    riskLevel,\n    isUnlimited,\n    allowanceAmount,\n    allowanceAmountInCurrency,\n    allowanceCurrencyCode,\n    pendingTimestamp,\n    NULL, -- pendingTransactionHash (new column)\n    strftime('%s', 'now') * 1000 -- timestamp (new column, set to current time)\nFROM Approval", 0).l12(this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.na_1 = 3;
                    if ((pa_1 = this.e280_1.b1vh(null, "DROP TABLE Approval", 0).l12(this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    this.na_1 = 4;
                    if ((pa_1 = this.e280_1.b1vh(null, "ALTER TABLE Approval_new RENAME TO Approval", 0).l12(this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    this.na_1 = 5;
                    continue e;
                case 5:
                    return js;
                case 6:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 6) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
ys(ApprovalsDBImpl$Schema$migrateInternal$slambda).d28 = function(ae) {
    return new ApprovalsDBImpl$Schema$migrateInternal$slambda(this.c280_1, this.d280_1, this.e280_1, ae);
};
ys(ApprovalsDBImpl$Schema$migrate$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = js;
    pe.qa_1 = null;
    return pe.va();
};
ys(ApprovalsDBImpl$Schema$migrate$slambda).mc = function(ae) {
    return this.c28(ae);
};
ys(ApprovalsDBImpl$Schema$migrate$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 6;
                    this.r280_1 = this.n280_1;
                    const pe = this.o280_1;
                    const ye = Ls();
                    for(let es = 0, ss = pe.length; es < ss;){
                        const ns = pe[es];
                        es = es + 1 | 0;
                        const ts = this.n280_1;
                        const rs = this.p280_1;
                        const os = ns.j1vr_1;
                        if (ts.k1(os) <= 0 && os.k1(rs) < 0) {
                            ye.e(ns);
                        }
                    }
                    this.s280_1 = Us(ye, new sam$kotlin_Comparator$0(ApprovalsDBImpl$Schema$migrate$slambda$lambda));
                    this.t280_1 = this.s280_1;
                    this.u280_1 = this.t280_1.k();
                    this.na_1 = 1;
                    continue e;
                case 1:
                    if (!this.u280_1.l()) {
                        this.na_1 = 3;
                        continue e;
                    }
                    this.v280_1 = this.u280_1.m();
                    this.w280_1 = this.v280_1;
                    this.x280_1 = this.w280_1;
                    this.na_1 = 2;
                    const as = this.r280_1;
                    const cs = this.x280_1.j1vr_1;
                    if ((pa_1 = Ws(migrateInternal(0, this.q280_1, as, cs.m3(Ks(1))), this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.x280_1.k1vr_1(this.q280_1);
                    this.r280_1 = this.x280_1.j1vr_1.m3(Ks(1));
                    this.na_1 = 1;
                    continue e;
                case 3:
                    if (this.r280_1.k1(this.p280_1) < 0) {
                        this.na_1 = 4;
                        if ((pa_1 = Ws(migrateInternal(0, this.q280_1, this.r280_1, this.p280_1), this)) === Ds()) {
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
                    return js;
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
ys(ApprovalsDBImpl$Schema$migrate$slambda).d28 = function(ae) {
    return new ApprovalsDBImpl$Schema$migrate$slambda(this.n280_1, this.o280_1, this.p280_1, this.q280_1, ae);
};
ys(Schema).r7c = function() {
    return new Fs(2, 0);
};
ys(Schema).z1vs = function(ae) {
    return Is(function ApprovalsDBImpl$Schema$create$slambda_0(ae, pe) {
        const ye = new ApprovalsDBImpl$Schema$create$slambda(ae, pe);
        const l = function(ae) {
            return ye.c28(ae);
        };
        l.$arity = 0;
        return l;
    }(ae, null));
};
ys(Schema).c1vh = function(ae) {
    return new Gs(this.z1vs(ae));
};
ys(Schema).a1vt = function(ae, pe, ye, es) {
    return Is(function ApprovalsDBImpl$Schema$migrate$slambda_0(ae, pe, ye, es, ss) {
        const ns = new ApprovalsDBImpl$Schema$migrate$slambda(ae, pe, ye, es, ss);
        const l = function(ae) {
            return ns.c28(ae);
        };
        l.$arity = 0;
        return l;
    }(pe, es, ye, ae, null));
};
ys(Schema).d1vh = function(ae, pe, ye, es) {
    return new Gs(this.a1vt(ae, pe, ye, es));
};
ys(ApprovalsDBImpl).j27z = function() {
    return this.z280_1;
};
ys(Approval_0).toString = function() {
    return `Approval(walletId=${this.d281_1}, address=${this.e281_1}, chainName=${this.f281_1}, chainIconUrl=${this.g281_1}, spenderAddress=${this.h281_1}, spenderName=${this.i281_1}, spenderExplorerUrl=${this.j281_1}, assetId=${this.k281_1}, riskLevel=${this.l281_1}, isUnlimited=${this.m281_1}, allowanceAmount=${Xs(this.n281_1)}, allowanceAmountInCurrency=${Xs(this.o281_1)}, allowanceCurrencyCode=${this.p281_1}, pendingTimestamp=${Xs(this.q281_1)}, pendingTransactionHash=${this.r281_1}, timestamp=${this.s281_1.toString()})`;
};
ys(Approval_0).hashCode = function() {
    let ae = Qs(this.d281_1);
    ae = bs(ae, 31) + Qs(this.e281_1) | 0;
    ae = bs(ae, 31) + Qs(this.f281_1) | 0;
    ae = bs(ae, 31) + (this.g281_1 == null ? 0 : Qs(this.g281_1)) | 0;
    ae = bs(ae, 31) + Qs(this.h281_1) | 0;
    ae = bs(ae, 31) + (this.i281_1 == null ? 0 : Qs(this.i281_1)) | 0;
    ae = bs(ae, 31) + (this.j281_1 == null ? 0 : Qs(this.j281_1)) | 0;
    ae = bs(ae, 31) + Qs(this.k281_1) | 0;
    ae = bs(ae, 31) + Qs(this.l281_1) | 0;
    ae = bs(ae, 31) + Ys(this.m281_1) | 0;
    ae = bs(ae, 31) + (this.n281_1 == null ? 0 : this.n281_1.hashCode()) | 0;
    ae = bs(ae, 31) + (this.o281_1 == null ? 0 : this.o281_1.hashCode()) | 0;
    ae = bs(ae, 31) + (this.p281_1 == null ? 0 : Qs(this.p281_1)) | 0;
    ae = bs(ae, 31) + (this.q281_1 == null ? 0 : this.q281_1.hashCode()) | 0;
    ae = bs(ae, 31) + (this.r281_1 == null ? 0 : Qs(this.r281_1)) | 0;
    return ae = bs(ae, 31) + this.s281_1.hashCode() | 0;
};
ys(Approval_0).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Approval_0)) {
        return false;
    }
    const pe = ae instanceof Approval_0 ? ae : sn();
    return this.d281_1 === pe.d281_1 && this.e281_1 === pe.e281_1 && this.f281_1 === pe.f281_1 && this.g281_1 == pe.g281_1 && this.h281_1 === pe.h281_1 && this.i281_1 == pe.i281_1 && this.j281_1 == pe.j281_1 && this.k281_1 === pe.k281_1 && this.l281_1 === pe.l281_1 && this.m281_1 === pe.m281_1 && !!Es(this.n281_1, pe.n281_1) && !!Es(this.o281_1, pe.o281_1) && this.p281_1 == pe.p281_1 && !!Es(this.q281_1, pe.q281_1) && this.r281_1 == pe.r281_1 && !!this.s281_1.equals(pe.s281_1);
};
ys(GetQuery).w1vf = function(ae) {
    this.y281_1.m1vg_1.k1vg([
        "Approval"
    ], ae);
};
ys(GetQuery).x1vf = function(ae) {
    this.y281_1.m1vg_1.l1vg([
        "Approval"
    ], ae);
};
ys(GetQuery).z1vf = function(ae) {
    return this.y281_1.m1vg_1.j1vg(-814953894, "SELECT Approval.walletId, Approval.address, Approval.chainName, Approval.chainIconUrl, Approval.spenderAddress, Approval.spenderName, Approval.spenderExplorerUrl, Approval.assetId, Approval.riskLevel, Approval.isUnlimited, Approval.allowanceAmount, Approval.allowanceAmountInCurrency, Approval.allowanceCurrencyCode, Approval.pendingTimestamp, Approval.pendingTransactionHash, Approval.timestamp FROM Approval WHERE walletId = ? AND address = ? AND spenderAddress = ? AND assetId = ?", ae, 4, function ApprovalsQueries$GetQuery$execute$lambda(ae) {
        return function(pe) {
            pe.e1vi(0, ae.u281_1);
            pe.e1vi(1, ae.v281_1);
            pe.e1vi(2, ae.w281_1);
            pe.e1vi(3, ae.x281_1);
            return js;
        };
    }(this));
};
ys(GetQuery).toString = function() {
    return "Approvals.sq:get";
};
ys($markAsPendingCOROUTINE$2).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.j282_1.m1vg_1.a1vh(958664380, "UPDATE Approval\nSET pendingTimestamp = ?, pendingTransactionHash = ?\nWHERE walletId = ? AND address = ? AND spenderAddress = ? AND assetId = ?", 6, ApprovalsQueries$markAsPending$lambda(this.k282_1, this.l282_1, this.m282_1, this.n282_1, this.o282_1, this.p282_1)).l12(this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.j282_1.n1vg(958664380, ApprovalsQueries$markAsPending$lambda_0);
                    return js;
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
ys(ApprovalsQueries).q282 = function(ae, pe, ye, es, ss) {
    return new GetQuery(this, ae, pe, ye, es, function ApprovalsQueries$get$lambda(ae, pe) {
        return function(ye) {
            let es;
            const ss = cn(ye.f1vi(0));
            const ns = cn(ye.f1vi(1));
            const ts = cn(ye.f1vi(2));
            const rs = ye.f1vi(3);
            const os = cn(ye.f1vi(4));
            const as = ye.f1vi(5);
            const cs = ye.f1vi(6);
            const us = cn(ye.f1vi(7));
            const ls = cn(ye.f1vi(8));
            const ms = cn(ye.r1vz(9));
            const gs = ye.f1vi(10);
            const ds = gs == null ? null : pe.a282_1.a281_1.f1vh(gs);
            const _s = ye.f1vi(11);
            es = _s == null ? null : pe.a282_1.b281_1.f1vh(_s);
            return ae(ss, ns, ts, rs, os, as, cs, us, ls, ms, ds, es, ye.f1vi(12), ye.g1vi(13), ye.f1vi(14), pe.a282_1.c281_1.f1vh(cn(ye.g1vi(15))));
        };
    }(ss, this));
};
ys(ApprovalsQueries).r282 = function(ae, pe, ye, es) {
    return this.q282(ae, pe, ye, es, ApprovalsQueries$get$lambda_0);
};
ys(ApprovalsQueries).s282 = function(ae, pe, ye, es, ss, ns, ts) {
    const rs = new $markAsPendingCOROUTINE$2(this, ae, pe, ye, es, ss, ns, ts);
    rs.pa_1 = js;
    rs.qa_1 = null;
    return rs.va();
};
ys(ApprovalsCacheImpl$markAsPending$slambda).b24p = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = js;
    ye.qa_1 = null;
    const es = ye.va();
    Ds();
    return es;
};
ys(ApprovalsCacheImpl$markAsPending$slambda).hb = function(ae, pe) {
    return this.b24p(ae != null && Os(ae, wn) ? ae : sn(), pe);
};
ys(ApprovalsCacheImpl$markAsPending$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.m283_1 = this.l283_1;
                    this.n283_1 = this.m283_1;
                    this.oa_1 = 2;
                    this.p283_1 = mn;
                    this.q283_1 = this.n283_1;
                    this.r283_1 = this.q283_1;
                    this.s283_1 = _get_queries__fuw963(this.f283_1);
                    this.t283_1 = gn.wq().f4r();
                    this.na_1 = 1;
                    if ((pa_1 = this.s283_1.s282(this.t283_1, this.g283_1, this.h283_1, this.i283_1, this.j283_1, this.k283_1, this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.p283_1;
                    this.o283_1 = dn(js);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const pe = this.qa_1;
                        this.o283_1 = dn(_n(pe));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    return new ln(this.o283_1);
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
ys(ApprovalsCacheImpl$markAsPending$slambda).g1w = function(ae, pe) {
    const ye = new ApprovalsCacheImpl$markAsPending$slambda(this.f283_1, this.g283_1, this.h283_1, this.i283_1, this.j283_1, this.k283_1, pe);
    ye.l283_1 = ae;
    return ye;
};
ys(ApprovalsCacheImpl$get$slambda).i284 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = js;
    ye.qa_1 = null;
    return ye.va();
};
ys(ApprovalsCacheImpl$get$slambda).hb = function(ae, pe) {
    return this.i284(ae != null && Os(ae, wn) ? ae : sn(), pe);
};
ys(ApprovalsCacheImpl$get$slambda).va = function() {
    for(this.pa_1;;){
        try {
            const ae = this.na_1;
            if (ae === 0) {
                let pe;
                this.oa_1 = 1;
                this.h284_1;
                try {
                    const ye = _get_queries__fuw963(this.c284_1).r282(this.d284_1, this.e284_1, this.f284_1, this.g284_1).b1vg();
                    pe = dn(ye == null ? null : toLocalEntity(this.c284_1, ye));
                } catch (error) {
                    if (!(error instanceof Error)) {
                        throw error;
                    }
                    pe = dn(_n(error));
                }
                let es;
                const ss = pe;
                const ns = hn(ss);
                if (ns != null) {
                    pn().d1tx(Cs, ns, ApprovalsCacheImpl$get$slambda$lambda);
                }
                if (kn(ss)) {
                    es = null;
                } else {
                    const ts = fn(ss);
                    es = ts == null || ts != null ? ts : sn();
                }
                return es;
            }
            if (ae === 1) {
                throw this.qa_1;
            }
        } catch (error) {
            throw error;
        }
    }
};
ys(ApprovalsCacheImpl$get$slambda).g1w = function(ae, pe) {
    const ye = new ApprovalsCacheImpl$get$slambda(this.c284_1, this.d284_1, this.e284_1, this.f284_1, this.g284_1, pe);
    ye.h284_1 = ae;
    return ye;
};
ys($markAsPendingCOROUTINE$5).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = Rn(this.r284_1.u282_1.z1ty(), ApprovalsCacheImpl$markAsPending$slambda_0(this.r284_1, this.w284_1, this.s284_1, this.u284_1, this.v284_1, this.t284_1, null), this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return js;
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
ys(ApprovalsCacheImpl).x284 = function(ae, pe, ye, es, ss, ns) {
    const ts = new $markAsPendingCOROUTINE$5(this, ae, pe, ye, es, ss, ns);
    ts.pa_1 = js;
    ts.qa_1 = null;
    return ts.va();
};
ys(ApprovalsCacheImpl).y284 = function(ae, pe, ye, es, ss) {
    return Rn(this.u282_1.z1ty(), function ApprovalsCacheImpl$get$slambda_0(ae, pe, ye, es, ss, ns) {
        const ts = new ApprovalsCacheImpl$get$slambda(ae, pe, ye, es, ss, ns);
        const l = function(ae, pe) {
            return ts.i284(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, pe, ye, es, null), ss);
};
ys(ApprovalsDatabaseFactory).b285 = function() {
    const ae = function provideDbDriver(ae) {
        throw jn(Kn("Unsupported"));
    }(hs.f1vr());
    return hs.i27z(ae, new Adapter(yn, Sn, An));
};
ys(ApprovalLocalEntity).toString = function() {
    return `ApprovalLocalEntity(walletId=${this.c285_1}, address=${this.d285_1}, chainName=${this.e285_1}, chainIconUrl=${this.f285_1}, spenderAddress=${this.g285_1}, spenderName=${this.h285_1}, spenderExplorerUrl=${this.i285_1}, assetId=${this.j285_1}, riskLevel=${this.k285_1}, isUnlimited=${this.l285_1}, allowanceAmount=${Xs(this.m285_1)}, allowanceAmountInCurrency=${Xs(this.n285_1)}, allowanceCurrencyCode=${this.o285_1}, pendingTimestamp=${Xs(this.p285_1)}, pendingTxHash=${this.q285_1})`;
};
ys(ApprovalLocalEntity).hashCode = function() {
    let ae = Qs(this.c285_1);
    ae = bs(ae, 31) + Qs(this.d285_1) | 0;
    ae = bs(ae, 31) + Qs(this.e285_1) | 0;
    ae = bs(ae, 31) + (this.f285_1 == null ? 0 : Qs(this.f285_1)) | 0;
    ae = bs(ae, 31) + Qs(this.g285_1) | 0;
    ae = bs(ae, 31) + (this.h285_1 == null ? 0 : Qs(this.h285_1)) | 0;
    ae = bs(ae, 31) + (this.i285_1 == null ? 0 : Qs(this.i285_1)) | 0;
    ae = bs(ae, 31) + Qs(this.j285_1) | 0;
    ae = bs(ae, 31) + Qs(this.k285_1) | 0;
    ae = bs(ae, 31) + Ys(this.l285_1) | 0;
    ae = bs(ae, 31) + (this.m285_1 == null ? 0 : this.m285_1.hashCode()) | 0;
    ae = bs(ae, 31) + (this.n285_1 == null ? 0 : this.n285_1.hashCode()) | 0;
    ae = bs(ae, 31) + (this.o285_1 == null ? 0 : Qs(this.o285_1)) | 0;
    ae = bs(ae, 31) + (this.p285_1 == null ? 0 : this.p285_1.hashCode()) | 0;
    return ae = bs(ae, 31) + (this.q285_1 == null ? 0 : Qs(this.q285_1)) | 0;
};
ys(ApprovalLocalEntity).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof ApprovalLocalEntity)) {
        return false;
    }
    const pe = ae instanceof ApprovalLocalEntity ? ae : sn();
    return this.c285_1 === pe.c285_1 && this.d285_1 === pe.d285_1 && this.e285_1 === pe.e285_1 && this.f285_1 == pe.f285_1 && this.g285_1 === pe.g285_1 && this.h285_1 == pe.h285_1 && this.i285_1 == pe.i285_1 && this.j285_1 === pe.j285_1 && this.k285_1 === pe.k285_1 && this.l285_1 === pe.l285_1 && !!Es(this.m285_1, pe.m285_1) && !!Es(this.n285_1, pe.n285_1) && this.o285_1 == pe.o285_1 && !!Es(this.p285_1, pe.p285_1) && this.q285_1 == pe.q285_1;
};
ys($getCachedApprovalCOROUTINE$11).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.na_1 = 1;
                    if ((pa_1 = this.a286_1.m286_1.y284(this.b286_1, this.c286_1, this.d286_1, this.e286_1, this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.f286_1 = pa_1;
                    if (this.f286_1 == null) {
                        this.g286_1 = null;
                        this.na_1 = 3;
                        continue e;
                    }
                    this.h286_1 = this.f286_1;
                    this.i286_1 = this.h286_1;
                    this.j286_1 = this.i286_1;
                    this.k286_1 = this.j286_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.a286_1.n286_1.l1v2(this.k286_1.j285_1, Cs, this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    if (pa_1 == null) {
                        return null;
                    }
                    const pe = pa_1;
                    this.g286_1 = toDomain(this.k286_1, pe);
                    this.na_1 = 3;
                    continue e;
                case 3:
                    return this.g286_1;
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
ys(ApprovalsRepositoryImpl).q286 = function(ae, pe, ye, es, ss) {
    const ns = new $getCachedApprovalCOROUTINE$11(this, ae, pe, ye, es, ss);
    ns.pa_1 = js;
    ns.qa_1 = null;
    return ns.va();
};
ys(ApprovalsRepositoryImpl).r286 = function(ae, pe, ye, es) {
    return this.m286_1.x284(ae, pe.q27y_1.a1uj(), pe.p27y_1, pe.v27y_1.f27z_1, ye, es);
};
ys(ApprovalsRepositoryImpl).s286 = function(ae) {
    const pe = qn().qqj(zn(ae.v27y_1.f27z_1, ae.q27y_1.ojo()), Nn().n8s_1);
    const k1ui_1 = ae.q27y_1.k1ui_1;
    if (k1ui_1 == null) {
        return dn(_n(jn("Token contract address is missing when revoking")));
    }
    const es = k1ui_1;
    const ss = Dn(ae.q27y_1);
    const n8s_1 = Nn().n8s_1;
    return dn(new Ln(ss, es, n8s_1, Bn(pe)));
};
ys(Confirm).toString = function() {
    return "Confirm";
};
ys(Confirm).hashCode = function() {
    return -1893824818;
};
ys(Confirm).equals = function(ae) {
    return this === ae || ae instanceof Confirm && (ae instanceof Confirm || sn(), true);
};
ys(ClearConfirmRequest).toString = function() {
    return "ClearConfirmRequest";
};
ys(ClearConfirmRequest).hashCode = function() {
    return 283541098;
};
ys(ClearConfirmRequest).equals = function(ae) {
    return this === ae || ae instanceof ClearConfirmRequest && (ae instanceof ClearConfirmRequest || sn(), true);
};
ys(Loading).toString = function() {
    return "Loading";
};
ys(Loading).hashCode = function() {
    return -600405991;
};
ys(Loading).equals = function(ae) {
    return this === ae || ae instanceof Loading && (ae instanceof Loading || sn(), true);
};
ys(Error_0).toString = function() {
    return `Error(cause=${Xs(this.u286_1)})`;
};
ys(Error_0).hashCode = function() {
    if (this.u286_1 == null) {
        return 0;
    }
    return qs(this.u286_1);
};
ys(Error_0).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Error_0)) {
        return false;
    }
    const pe = ae instanceof Error_0 ? ae : sn();
    return !!Es(this.u286_1, pe.u286_1);
};
ys(Data).y286 = function(ae, pe, ye) {
    return new Data(ae, pe, ye);
};
ys(Data).z286 = function(ae, pe, ye, es) {
    ae = ae === Cs ? this.v286_1 : ae;
    pe = pe === Cs ? this.w286_1 : pe;
    ye = ye === Cs ? this.x286_1 : ye;
    if (es === Cs) {
        return this.y286(ae, pe, ye);
    }
    return es.y286.call(this, ae, pe, ye);
};
ys(Data).toString = function() {
    return `Data(walletId=${this.v286_1}, approval=${this.w286_1.toString()}, confirmRequest=${Xs(this.x286_1)})`;
};
ys(Data).hashCode = function() {
    let ae = Qs(this.v286_1);
    ae = bs(ae, 31) + this.w286_1.hashCode() | 0;
    return ae = bs(ae, 31) + (this.x286_1 == null ? 0 : this.x286_1.hashCode()) | 0;
};
ys(Data).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Data)) {
        return false;
    }
    const pe = ae instanceof Data ? ae : sn();
    return this.v286_1 === pe.v286_1 && !!this.w286_1.equals(pe.w286_1) && !!Es(this.x286_1, pe.x286_1);
};
ys(ViewState).toString = function() {
    return `ViewState(global=${Kn(this.a287_1)})`;
};
ys(ViewState).hashCode = function() {
    return qs(this.a287_1);
};
ys(ViewState).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof ViewState)) {
        return false;
    }
    const pe = ae instanceof ViewState ? ae : sn();
    return !!Es(this.a287_1, pe.a287_1);
};
ys(sam$com_trustwallet_sdk_common_mvi_data_MviBinder_Mapper$0).k1x6 = function(ae) {
    return this.e288_1(ae);
};
ys(sam$com_trustwallet_sdk_common_mvi_data_MviBinder_Mapper$0).g4 = function() {
    return this.e288_1;
};
ys(sam$com_trustwallet_sdk_common_mvi_data_MviBinder_Mapper$0).equals = function(ae) {
    let pe;
    if (ae != null && Os(ae, Jn)) {
        pe = !(ae == null || !Os(ae, Ps)) && Es(this.g4(), ae.g4());
    } else {
        pe = false;
    }
    return pe;
};
ys(sam$com_trustwallet_sdk_common_mvi_data_MviBinder_Mapper$0).hashCode = function() {
    return qs(this.g4());
};
ys($executeActionCOROUTINE$18).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.t288_1 = this.s288_1;
                    if (this.t288_1 instanceof Init) {
                        this.na_1 = 2;
                        if ((pa_1 = onInit(this.r288_1, this.s288_1, this)) === Ds()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.t288_1 instanceof Deinit) {
                        this.r288_1;
                        this.na_1 = 3;
                        continue e;
                    }
                    if (Es(this.t288_1, ks)) {
                        onConfirm(this.r288_1);
                        this.na_1 = 3;
                        continue e;
                    }
                    if (Es(this.t288_1, Rs)) {
                        onClearConfirmRequest(this.r288_1);
                        this.na_1 = 3;
                        continue e;
                    }
                    if (this.t288_1 instanceof MarkAsPending) {
                        this.na_1 = 1;
                        if ((pa_1 = onMarkAsPending(this.r288_1, this.s288_1, this)) === Ds()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    Xn();
                    break;
                case 1:
                case 2:
                    this.na_1 = 3;
                    continue e;
                case 3:
                    return js;
                case 4:
                    throw this.qa_1;
            }
        } catch (error) {
            const pe = error;
            if (this.oa_1 === 4) {
                throw pe;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = pe;
        }
    }
};
ys($onInitCOROUTINE$19).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.j287_1.y1xa(this.j287_1, ApprovalDetailsFeatureImpl$onInit$lambda);
                    this.na_1 = 1;
                    if ((pa_1 = this.j287_1.c288_1.q286(this.k287_1.f288_1, this.k287_1.g288_1, this.k287_1.h288_1, this.k287_1.i288_1, this)) === Ds()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    if (pe != null) {
                        this.j287_1.y1xa(this.j287_1, ApprovalDetailsFeatureImpl$onInit$lambda_0(this.k287_1, pe));
                    } else {
                        pn().z1tw(this.j287_1.y1x7_1, ApprovalDetailsFeatureImpl$onInit$lambda_1);
                        this.j287_1.y1xa(this.j287_1, ApprovalDetailsFeatureImpl$onInit$lambda_2);
                    }
                    return js;
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
ys(ApprovalDetailsFeatureImpl).r1xa = function() {
    return this.w1xa(ApprovalDetailsFeatureImpl$createViewState$lambda);
};
ys(ApprovalDetailsFeatureImpl).u288 = function(ae, pe) {
    const ye = new $executeActionCOROUTINE$18(this, ae, pe);
    ye.pa_1 = js;
    ye.qa_1 = null;
    return ye.va();
};
ys(ApprovalDetailsFeatureImpl).u1x9 = function(ae, pe) {
    return this.u288(Os(ae, Action) ? ae : sn(), pe);
};
hs = new Companion;
vs = new Schema;
ps = new ApprovalsDatabaseFactory;
ks = new Confirm;
Rs = new ClearConfirmRequest;
$s = new Loading;
ae.$_$ = ae.$_$ || {};
ae.$_$.a = ApprovalsApiClientImpl;
ae.$_$.b = ApprovalsRepositoryImpl;
ae.$_$.c = GetApprovalsUseCaseImpl;
ae.$_$.d = ApprovalsCacheImpl;
ae.$_$.e = ApprovalDetailsFeatureImpl;
ae.$_$.f = ps;
function PredictionTradeFlowFeatureImpl$Companion$dummyAsset$delegate$lambda() {
    return new sg(new Ym("dummy", new Qm("address", Jm(), "publicKey", "extendedPublicKey", "derivationPath", _m(Xm()))), Yn, new eg("dummy", "type", "Dummy Asset", "DUMMY", new Ol(2, 0), "https://assets-cdn.trustwallet.com/blockchains/60/info/square_logo.png"));
}
;
function PredictionApiClientImpl$getPortfolio$lambda(ae, pe) {
    return function(ye, es) {
        ud(ye, [
            "/v1/odd/portfolio"
        ]);
        wd(ae, ld().f6d_1);
        const ss = ae;
        const ns = new PredictionAddressRequest(Yn, pe);
        if (ns == null) {
            ss.d79_1 = vd;
            let ts;
            const rs = md(PredictionAddressRequest);
            try {
                ts = dd(md(PredictionAddressRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new _d(rs, ts);
            ss.w7e(os);
        } else if (ns instanceof hd) {
            ss.d79_1 = ns;
            ss.w7e(null);
        } else {
            ss.d79_1 = ns;
            let as;
            const cs = md(PredictionAddressRequest);
            try {
                as = dd(md(PredictionAddressRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                as = null;
            }
            const us = new _d(cs, as);
            ss.w7e(us);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$getPositions$lambda(ae, pe, ye, es, ss) {
    return function(ns, ts) {
        ud(ns, [
            "/v1/odd/positions"
        ]);
        const rs = ae;
        if (rs != null) {
            ns.r6m_1.w67("statuses", pd(rs, ","));
        }
        wd(pe, ld().f6d_1);
        const os = pe;
        const as = new PredictionAddressRequest(ye, es, ss);
        if (as == null) {
            os.d79_1 = vd;
            let cs;
            const us = md(PredictionAddressRequest);
            try {
                cs = dd(md(PredictionAddressRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                cs = null;
            }
            const ls = new _d(us, cs);
            os.w7e(ls);
        } else if (as instanceof hd) {
            os.d79_1 = as;
            os.w7e(null);
        } else {
            os.d79_1 = as;
            let ms;
            const gs = md(PredictionAddressRequest);
            try {
                ms = dd(md(PredictionAddressRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ms = null;
            }
            const ds = new _d(gs, ms);
            os.w7e(ds);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$getTrades$lambda(ae, pe, ye) {
    return function(es, ss) {
        ud(es, [
            "/v1/odd/trades"
        ]);
        wd(ae, ld().f6d_1);
        const ns = ae;
        const ts = new PredictionAddressRequest(Yn, pe, ye);
        if (ts == null) {
            ns.d79_1 = vd;
            let rs;
            const os = md(PredictionAddressRequest);
            try {
                rs = dd(md(PredictionAddressRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                rs = null;
            }
            const as = new _d(os, rs);
            ns.w7e(as);
        } else if (ts instanceof hd) {
            ns.d79_1 = ts;
            ns.w7e(null);
        } else {
            ns.d79_1 = ts;
            let cs;
            const us = md(PredictionAddressRequest);
            try {
                cs = dd(md(PredictionAddressRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                cs = null;
            }
            const ls = new _d(us, cs);
            ns.w7e(ls);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$createTrade$lambda(ae, pe, ye, es) {
    return function(ss, ns) {
        ud(ss, [
            "/v1/odd/trades/create"
        ]);
        wd(ae, ld().f6d_1);
        const ts = ae;
        const rs = new PredictionCreateTradeRequest(pe, ye, es);
        if (rs == null) {
            ts.d79_1 = vd;
            let os;
            const as = md(PredictionCreateTradeRequest);
            try {
                os = dd(md(PredictionCreateTradeRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                os = null;
            }
            const cs = new _d(as, os);
            ts.w7e(cs);
        } else if (rs instanceof hd) {
            ts.d79_1 = rs;
            ts.w7e(null);
        } else {
            ts.d79_1 = rs;
            let us;
            const ls = md(PredictionCreateTradeRequest);
            try {
                us = dd(md(PredictionCreateTradeRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                us = null;
            }
            const ms = new _d(ls, us);
            ts.w7e(ms);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$getCategories$lambda(ae, pe) {
    ud(ae, [
        "/v1/odd/categories"
    ]);
    return Wn;
}
;
function PredictionApiClientImpl$getNetworks$lambda(ae, pe) {
    ud(ae, [
        "/v1/odd/networks"
    ]);
    return Wn;
}
;
function PredictionApiClientImpl$getMarkets$lambda(ae, pe, ye, es) {
    return function(ss, ns) {
        ud(ss, [
            "/v1/odd/markets"
        ]);
        const ts = ae;
        if (ts != null) {
            ss.r6m_1.w67("search", ts);
        }
        const rs = pe == null ? null : ql(pe);
        if (rs != null) {
            ss.r6m_1.w67("network_id", rs);
        }
        const os = ye;
        if (os != null) {
            ss.r6m_1.w67("categories", pd(os, ","));
        }
        const as = es;
        if (as != null) {
            ss.r6m_1.w67("cursor", as);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$getMarket$lambda(ae, pe) {
    return function(ye, es) {
        ud(ye, [
            "/v1/odd/markets",
            ae
        ]);
        if (pe != null) {
            fd(function PredictionApiClientImpl$getMarket$lambda$lambda(ae) {
                return function(pe) {
                    pe.w67("network_id", ae.toString());
                    return Wn;
                };
            }(pe));
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$getQuote$lambda(ae, pe, ye, es, ss, ns, ts, rs) {
    return function(os, as) {
        ud(os, [
            `/v1/odd/markets/${ae}/quote`
        ]);
        os.r6m_1.w67("action", pe);
        os.r6m_1.w67("value", ye);
        if (es != null) {
            os.r6m_1.w67("from_asset_id", es);
        }
        os.r6m_1.w67("from_wallet_address", ss);
        os.r6m_1.w67("network_id", ns);
        os.r6m_1.w67("outcome_id", ts);
        os.r6m_1.w67("slippage", rs.toString());
        return Wn;
    };
}
;
function PredictionApiClientImpl$getOutcomePrices$lambda(ae, pe) {
    return function(ye, es) {
        ud(ye, [
            "/v1/odd/markets",
            ae,
            "prices",
            pe
        ]);
        return Wn;
    };
}
;
function PredictionApiClientImpl$getBatchOutcomes$lambda(ae) {
    return function(pe, ye) {
        ud(pe, [
            "/v1/odd/markets/batch_outcomes"
        ]);
        pe.r6m_1.w67("market_ids", pd(ae, ","));
        return Wn;
    };
}
;
function PredictionApiClientImpl$exchangeSignature$lambda(ae, pe) {
    return function(ye, es) {
        ud(ye, [
            "/v1/odd/auth"
        ]);
        wd(ae, ld().f6d_1);
        const ss = ae;
        const ns = pe;
        if (ns == null) {
            ss.d79_1 = vd;
            let ts;
            const rs = md(ExchangeSignatureRequest);
            try {
                ts = dd(md(ExchangeSignatureRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new _d(rs, ts);
            ss.w7e(os);
        } else if (ns instanceof hd) {
            ss.d79_1 = ns;
            ss.w7e(null);
        } else {
            ss.d79_1 = ns;
            let as;
            const cs = md(ExchangeSignatureRequest);
            try {
                as = dd(md(ExchangeSignatureRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                as = null;
            }
            const us = new _d(cs, as);
            ss.w7e(us);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl$submitOrder$lambda(ae, pe) {
    return function(ye, es) {
        ud(ye, [
            "/v1/odd/order"
        ]);
        wd(ae, ld().f6d_1);
        const ss = ae;
        const ns = pe;
        if (ns == null) {
            ss.d79_1 = vd;
            let ts;
            const rs = md(SubmitOrderRequest);
            try {
                ts = dd(md(SubmitOrderRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                ts = null;
            }
            const os = new _d(rs, ts);
            ss.w7e(os);
        } else if (ns instanceof hd) {
            ss.d79_1 = ns;
            ss.w7e(null);
        } else {
            ss.d79_1 = ns;
            let as;
            const cs = md(SubmitOrderRequest);
            try {
                as = dd(md(SubmitOrderRequest), gd([]), false);
            } catch (error) {
                if (!(error instanceof Error)) {
                    throw error;
                }
                as = null;
            }
            const us = new _d(cs, as);
            ss.w7e(us);
        }
        return Wn;
    };
}
;
function PredictionApiClientImpl(ae, pe) {
    this.s2rs_1 = ae;
    this.t2rs_1 = pe;
}
;
function SendFeatureImpl$onInit$lambda_1(ae, pe, ye, es) {
    return function(ss) {
        let ns;
        const b1xi_1 = _get_addressValidator__15ewxf(ae).a1xi_1.f1().f1xi_1.b1xi_1;
        const c1xi_1 = _get_addressValidator__15ewxf(ae).a1xi_1.f1().f1xi_1.c1xi_1;
        const b1xi_1_1 = _get_amountValidator__v3gz93(ae).v1xi_1.f1().w1xi_1.b1xi_1;
        const length = _get_amountValidator__v3gz93(ae).v1xi_1.f1().w1xi_1.b1xi_1.length;
        const cs = function getAssetSymbol(ae, pe) {
            if (pe.u1ui()) {
                return `${pe.z1ui().d1uj_1} (${pe.vkb()})`;
            }
            return pe.z1ui().d1uj_1;
        }(0, pe);
        const us = pe.xjo();
        const ls = El.m28l(pe);
        const { s22j_1, s22j_1: s22j_1_1 } = ye;
        const ds = s22j_1_1 == null ? null : s22j_1_1.h22l_1;
        const _s = ds ?? "";
        const ye_s22j_1 = ye.s22j_1;
        const vs = ye_s22j_1 == null ? null : ye_s22j_1.h22l_1;
        const length_1 = (vs ?? "").length;
        const z1xi_1 = _get_amountValidator__v3gz93(ae).v1xi_1.f1().z1xi_1;
        const x1xi_1 = _get_amountValidator__v3gz93(ae).v1xi_1.f1().x1xi_1;
        const Rs = _get_amountValidator__v3gz93(ae).e1xj();
        const $s = _get_amountValidator__v3gz93(ae).d1xj();
        const bs = Ul().y1tt(ye.r22j_1.ojo());
        const Ms = _get_addressValidator__15ewxf(ae).e1xi();
        const o1xj_1 = _get_metaValidator__ht5fto(ae).l1xj_1.f1().o1xj_1;
        const y1xi_1 = _get_amountValidator__v3gz93(ae).v1xi_1.f1().y1xi_1;
        const ye_t22j_1 = ye.t22j_1;
        if (!ye.r22j_1.w1ui() || es.h8v(gn().o8s_1) > 0) {
            const Cs = ye.t22j_1;
            ns = !((Cs == null ? null : Cs.z6a()) === false);
        } else {
            ns = false;
        }
        return new ql(new uw(pe, us, ls, s22j_1, null, cs, b1xi_1, c1xi_1, _s, length_1, z1xi_1, b1xi_1_1, length, x1xi_1, Rs, $s, bs, "https://community.trustwallet.com/t/what-is-a-memo-or-destination-tag/138516", "4294967295", Ms, o1xj_1, y1xi_1, ns, ye_t22j_1));
    };
}
;
function NamingClient$lookup$lambda(ae, pe) {
    return function(ye, es) {
        Vw(ye, [
            "/v1/lookup"
        ]);
        ye.r6m_1.w67("name", ae);
        ye.r6m_1.w67("coin", pe);
        return Ts;
    };
}
;
function NamingClient(ae, pe) {
    this.z28o_1 = ae;
    this.a28p_1 = pe;
}
;
function getMultiCoinWalletIconUrl(ae) {
    return `https://assets-cdn.trustwallet.com/blockchains/${Kn.dim(Wn())}/assets/0x4B0F1812e5Df2A09796481Ff14017e6005508003/logo.png`;
}
;
function WalletAggregationApiClientImpl$getWalletMetaFromRegistry$lambda(ae, pe) {
    return function(ye, es) {
        al(ye, [
            `/v1/wallets/${ae}/meta`
        ]);
        ll(pe, cl().f6d_1);
        return Ss;
    };
}
;
function WalletAggregationApiClientImpl$getWalletMetaLegacy$lambda(ae, pe, ye) {
    return function(es, ss) {
        al(es, [
            `/v3/devices/${ae}/wallets/${pe}/meta`
        ]);
        ll(ye, cl().f6d_1);
        return Ss;
    };
}
;
function WalletAggregationApiClientImpl(ae, pe, ye, es) {
    ye = ye === js ? null : ye;
    es = es === js ? null : es;
    this.w2uu_1 = ae;
    this.x2uu_1 = pe;
    this.y2uu_1 = ye;
    this.z2uu_1 = es;
}
;
function WatchListDatabaseFactory() {}
;
ls(Companion);
ms(PriceAlertsDB, "PriceAlertsDB", gs, gs, gs, [
    2
]);
vs(PriceAlertsDBImpl$Schema$create$slambda, ds, gs, [
    0
]);
vs(PriceAlertsDBImpl$Schema$migrate$slambda, ds, gs, [
    0
]);
$s(Schema, "Schema", gs, gs, [
    Rs
]);
Ms(PriceAlertsDBImpl, "PriceAlertsDBImpl", gs, bs, [
    bs,
    PriceAlertsDB
], [
    2
]);
Ms(Adapter, "Adapter");
Ms(Adapter_0, "Adapter");
Ms(PriceAlertsQueries, "PriceAlertsQueries", gs, bs, gs, [
    4,
    1,
    3,
    0,
    2
]);
Ms(PriceAlertsSettingsLocalSourceImpl, "PriceAlertsSettingsLocalSourceImpl", gs, gs, gs, [
    2,
    0
]);
Ms(WatchListApiClient, "WatchListApiClient", gs, gs, gs, [
    2,
    1
]);
$s(LongColumnAdapter, "LongColumnAdapter");
$s(WatchListDatabaseFactory, "WatchListDatabaseFactory");
Ms(WatchListLocalDataSourceImpl, "WatchListLocalDataSourceImpl", gs, gs, gs, [
    3,
    1,
    0
]);
Ms(WatchListRemoteDataSourceImpl, "WatchListRemoteDataSourceImpl", gs, gs, gs, [
    2,
    1
]);
Ms(WatchListRepositoryImpl, "WatchListRepositoryImpl", gs, gs, gs, [
    0,
    1
]);
ls(Companion_0);
Ms(WatchListSyncManagerImpl, "WatchListSyncManagerImpl", gs, gs, gs, [
    0,
    2
]);
us(Companion).f1vr = function() {
    return function get_schema(ae) {
        return ts;
    }(cs(PriceAlertsDB));
};
us(Companion).v2ud = function(ae, pe, ye) {
    return function newInstance(ae, pe, ye, es) {
        return new PriceAlertsDBImpl(pe, ye, es);
    }(cs(PriceAlertsDB), ae, pe, ye);
};
us(PriceAlertsDBImpl$Schema$create$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = _s;
    pe.qa_1 = null;
    return pe.va();
};
us(PriceAlertsDBImpl$Schema$create$slambda).mc = function(ae) {
    return this.c28(ae);
};
us(PriceAlertsDBImpl$Schema$create$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.na_1 = 1;
                    if ((pa_1 = this.f2ue_1.b1vh(null, "CREATE TABLE PriceAlertAssets (\n    assetId TEXT NOT NULL PRIMARY KEY,\n    isInWatchList INTEGER NOT NULL DEFAULT 0,\n    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),\n    syncStatus INTEGER NOT NULL DEFAULT 0, -- 0 = needs sync, 1 = synced\n    lastStateChangeTime INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),\n    lastFailureTime INTEGER DEFAULT NULL,\n    syncAttempts INTEGER NOT NULL DEFAULT 0,\n    nextRetryTime INTEGER DEFAULT NULL\n)", 0).l12(this)) === hs()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.na_1 = 2;
                    if ((pa_1 = this.f2ue_1.b1vh(null, "CREATE TABLE PriceAlertSettings (\n    id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,\n    isEnabled INTEGER NOT NULL DEFAULT 0,\n    lastSyncTimestamp INTEGER NOT NULL DEFAULT 0\n)", 0).l12(this)) === hs()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return _s;
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
us(PriceAlertsDBImpl$Schema$create$slambda).d28 = function(ae) {
    return new PriceAlertsDBImpl$Schema$create$slambda(this.f2ue_1, ae);
};
us(PriceAlertsDBImpl$Schema$migrate$slambda).c28 = function(ae) {
    const pe = this.d28(ae);
    pe.pa_1 = _s;
    pe.qa_1 = null;
    return pe.va();
};
us(PriceAlertsDBImpl$Schema$migrate$slambda).mc = function(ae) {
    return this.c28(ae);
};
us(PriceAlertsDBImpl$Schema$migrate$slambda).va = function() {
    for(this.pa_1;;){
        try {
            const ae = this.na_1;
            if (ae === 0) {
                this.oa_1 = 1;
                return _s;
            }
            if (ae === 1) {
                throw this.qa_1;
            }
        } catch (error) {
            throw error;
        }
    }
};
us(PriceAlertsDBImpl$Schema$migrate$slambda).d28 = function(ae) {
    return new PriceAlertsDBImpl$Schema$migrate$slambda(ae);
};
us(Schema).r7c = function() {
    return new ps(1, 0);
};
us(Schema).z1vs = function(ae) {
    return fs(function PriceAlertsDBImpl$Schema$create$slambda_0(ae, pe) {
        const ye = new PriceAlertsDBImpl$Schema$create$slambda(ae, pe);
        const l = function(ae) {
            return ye.c28(ae);
        };
        l.$arity = 0;
        return l;
    }(ae, null));
};
us(Schema).c1vh = function(ae) {
    return new ks(this.z1vs(ae));
};
us(Schema).a1vt = function(ae, pe, ye, es) {
    return fs(function PriceAlertsDBImpl$Schema$migrate$slambda_0(ae) {
        const pe = new PriceAlertsDBImpl$Schema$migrate$slambda(ae);
        const l = function(ae) {
            return pe.c28(ae);
        };
        l.$arity = 0;
        return l;
    }(null));
};
us(Schema).d1vh = function(ae, pe, ye, es) {
    return new ks(this.a1vt(ae, pe, ye, es));
};
us(PriceAlertsDBImpl).w2ud = function() {
    return this.p2ue_1;
};
us(LongColumnAdapter).e1vh = function(ae) {
    return ae;
};
us(LongColumnAdapter).f1vh = function(ae) {
    return this.e1vh(ae instanceof ps ? ae : Cs());
};
us(WatchListDatabaseFactory).b285 = function() {
    const ae = function provideDbDriver(ae) {
        throw xs(Os("Unsupported"));
    }(ns.f1vr());
    return ns.v2ud(ae, new Adapter(rs, rs), new Adapter_0(rs));
};
ns = new Companion;
ts = new Schema;
rs = new LongColumnAdapter;
os = new WatchListDatabaseFactory;
ae.$_$ = ae.$_$ || {};
ae.$_$.a = PriceAlertsSettingsLocalSourceImpl;
ae.$_$.b = WatchListApiClient;
ae.$_$.c = WatchListLocalDataSourceImpl;
ae.$_$.d = WatchListRemoteDataSourceImpl;
ae.$_$.e = WatchListRepositoryImpl;
ae.$_$.f = WatchListSyncManagerImpl;
ae.$_$.g = os;
this.a2wd_1 = "https://naming.trustwallet.com";
this.b2wd_1 = "https://wallet-kit.trustwallet.com";
this.c2wd_1 = "https://api.hyperliquid.xyz";
this.w2vu_1 = jn(function ServiceModule$assetApiClient$delegate$lambda(ae) {
    return function() {
        return new Fd(ae.l2vu_1, "https://gateway.us.trustwallet.com", ae.p2vu_1);
    };
}(this));
;
this.x2vu_1 = jn(function ServiceModule$marketApiClient$delegate$lambda(ae) {
    return function() {
        return new Ld(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.y2vu_1 = jn(function ServiceModule$gasStationClient$delegate$lambda(ae) {
    return function() {
        return new Ud(ae.k2vu_1, "https://wallet-kit.trustwallet.com");
    };
}(this));
;
this.z2vu_1 = jn(function ServiceModule$namingClient$delegate$lambda(ae) {
    return function() {
        return new Kd(ae.k2vu_1, "https://naming.trustwallet.com");
    };
}(this));
;
this.a2vv_1 = jn(function ServiceModule$transactionApiClient$delegate$lambda(ae) {
    return function() {
        return new Wd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.b2vv_1 = jn(function ServiceModule$investApiClient$delegate$lambda(ae) {
    return function() {
        return new Gd(ae.l2vu_1, "https://gateway.us.trustwallet.com", ae.q2vu_1);
    };
}(this));
;
this.c2vv_1 = jn(function ServiceModule$launchpoolApiClient$delegate$lambda(ae) {
    return function() {
        return new Vd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.d2vv_1 = jn(function ServiceModule$merklRewardsClient$delegate$lambda(ae) {
    return function() {
        return new Hd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.e2vv_1 = Ew(function ServiceModule$rewardsRemoteSource$delegate$lambda(ae) {
    return function() {
        return new Zd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.f2vv_1 = Ew(function ServiceModule$watchListApiClient$delegate$lambda(ae) {
    return function() {
        return new Jd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.g2vv_1 = Ew(function ServiceModule$vipApiClient$delegate$lambda(ae) {
    return function() {
        return new Xd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.h2vv_1 = jn(function ServiceModule$buyWidgetClient$delegate$lambda(ae) {
    return function() {
        return new Qd(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.k2vv_1 = jn(function ServiceModule$perpetualApiClient$delegate$lambda(ae) {
    return function() {
        return new s_(ae.m2vu_1, "https://perps.trustwallet.com");
    };
}(this));
;
this.m2vv_1 = Ew(function ServiceModule$dappTrackingApiClient$delegate$lambda(ae) {
    return function() {
        return new o_(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.n2vv_1 = jn(function ServiceModule$approvalsApiClient$delegate$lambda(ae) {
    return function() {
        return new i_(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.o2vv_1 = jn(function ServiceModule$predictionApiClient$delegate$lambda(ae) {
    return function() {
        return new a_(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.p2vv_1 = jn(function ServiceModule$walletAggregationApiClient$delegate$lambda(ae) {
    return function() {
        return new c_(ae.l2vu_1, "https://gateway.us.trustwallet.com", ae.u2vu_1, ae.v2vu_1);
    };
}(this));
;
this.q2vv_1 = jn(function ServiceModule$homepageApi$delegate$lambda(ae) {
    return function() {
        return new u_(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.r2vv_1 = jn(function ServiceModule$hyperliquidInfoApi$delegate$lambda(ae) {
    return function() {
        return new l_(ae.k2vu_1, "https://api.hyperliquid.xyz");
    };
}(this));
;
this.s2vv_1 = jn(function ServiceModule$addressPoisoningApi$delegate$lambda(ae) {
    return function() {
        return new w_(ae.l2vu_1, "https://gateway.us.trustwallet.com");
    };
}(this));
;
this.t2vv_1 = jn(function ServiceModule$balanceApiClient$delegate$lambda(ae) {
    return function() {
        return new m_(ae.l2vu_1, "https://gateway.us.trustwallet.com", Nm().i56());
    };
}(this));
function AnalyticsModule$trustAnalyticsClient$delegate$lambda() {
    return new AnalyticsClient(new ys(function AnalyticsModule$trustAnalyticsClient$delegate$lambda$slambda_0(ae) {
        const pe = new AnalyticsModule$trustAnalyticsClient$delegate$lambda$slambda(ae);
        const l = function(ae) {
            return pe.n2vc(ae);
        };
        l.$arity = 0;
        return l;
    }(null)), "https://gateway.us.trustwallet.com");
}
;
qs(ye, [
    "/analytics/v1/events"
]);
;
ye = this.isCoin() ? `https://assets-cdn.trustwallet.com/blockchains/${this.getCoinId()}/info/square_logo.png` : `https://assets-cdn.trustwallet.com/blockchains/${this.getCoinId()}/assets/${this.getTokenId()}/logo.png`;
const init_api_constants = __esmMin(()=>{
    API_BASE_URL = "https://api.trustwallet.com";
    API_GATEWAY_BASE_URL = "https://gateway.us.trustwallet.com";
    CDN_BASE_URL = "https://assets-cdn.trustwallet.com";
    NAMING_API_BASE_URL = "https://naming.trustwallet.com";
});
function sortQueryParams(ae) {
    if (!ae) {
        return ae;
    }
    const pe = new URLSearchParams(ae);
    const ye = Array.from(pe.keys());
    ye.sort((ae, pe)=>ae.localeCompare(pe));
    const es = new Set(ye);
    const ss = [];
    for (const ns of es){
        const ae = pe.getAll(ns);
        for (const pe of ae){
            ss.push(`${encodeURIComponent(ns)}=${encodeURIComponent(pe)}`);
        }
    }
    return ss.join("&");
}
;
function authenticationInterceptor(ae) {
    const { deviceId, hashKey } = store.getState().app;
    const es = parseApiGatewayUrl(ae.url);
    if (!deviceId || !hashKey || !es) {
        return ae;
    }
    const ss = ae.method?.toUpperCase();
    const es_pathname = es.pathname;
    const ts = es.search ? es.search.slice(1) : undefined;
    const rs = Object.entries(ae.params ?? {}).filter(([, ae])=>ae !== undefined).flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
    const os = sortQueryParams(ts ?? rs);
    const as = (new Date).toUTCString();
    const cs = crypto.randomUUID();
    const us = [
        ss,
        es_pathname,
        os,
        deviceId,
        cs,
        as
    ].join(";");
    const ls = import_crypto_browserify$4.createHmac("sha256", hashKey).update(us).digest("base64");
    ae.headers["X-TW-DATE"] = as;
    ae.headers["X-TW-NONCE"] = cs;
    ae.headers["X-TW-CREDENTIAL"] = deviceId;
    ae.headers.Authorization = `HMAC-SHA256 Signature=${ls}`;
    return ae;
}
;
async function getFingerprintIdentifier() {
    let ae = getAuthIdentifier();
    if (!ae) {
        ae = await createIdentifier();
        store.dispatch(appSlice.actions.setAuthIdentifier(ae));
    }
    return ae;
}
;
async function createIdentifier() {
    let ae = crypto.randomUUID();
    ae += `-${import_crypto_browserify$3.createHash("sha256").update(ae).digest("hex").substring(0, 4)}`;
    return ae;
}
;
async function unauthenticatedInterceptor(ae) {
    const pe = ae.response?.status === 403;
    const ye = ae.response?.config;
    const es = parseApiGatewayUrl(ye?.url);
    if (pe && es && !(es?.pathname === FINGERPRINT_PATH) && ye && !ye[RETRIED_AFTER_AUTH] && await refreshHashKey()) {
        ye[RETRIED_AFTER_AUTH] = true;
        return fetch$2.request(ye);
    }
    return Promise.reject(ae);
}
;
const init_unauthenticated_interceptor = __esmMin(()=>{
    init_authentication_interceptor();
    init_app$3();
    init_constants$8();
    init_api_constants();
    init_store$1();
    init_app$1();
    init_authentication_utils();
    init_fetch();
    init_logger$1();
    RETRIED_AFTER_AUTH = "retriedAfterAuth";
    FINGERPRINT_PATH = "/v2/devices/fingerprint";
    hashKeyRefresh = null;
});
const init_utils$8 = __esmMin(()=>{
    hasBrowserEnv = typeof window !== "undefined" && typeof document !== "undefined";
    _navigator = typeof navigator === "object" && navigator || undefined;
    hasStandardBrowserEnv = hasBrowserEnv && (!_navigator || [
        "ReactNative",
        "NativeScript",
        "NS"
    ].indexOf(_navigator.product) < 0);
    hasStandardBrowserWebWorkerEnv = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope && typeof self.importScripts === "function";
    origin = hasBrowserEnv && window.location.href || "http://localhost";
});
globalThis.fetch = async (pe, ye)=>{
    const es = typeof pe === "string" ? pe : pe instanceof URL ? pe.href : pe?.url;
    if (es && NODE_REGISTRY_PATH.test(new URL(es, "https://x").pathname)) {
        return serveNodeRegistry(es, ae, pe, ye);
    }
    if (!isNaasNodeHost(es)) {
        return ae(pe, ye);
    }
    const ss = await readBody(pe, ye);
    const ns = ss ? parseSingleCall(ss) : null;
    const ttl = ns ? CACHEABLE_METHODS[ns.method] : undefined;
    if (!ns || ttl === undefined) {
        return ae(pe, ye);
    }
    if (ns.method === "pm_isSponsorable") {
        prefetchSimulation(es, ns, ye);
    }
    const rs = `${es}\0${ns.method}\0${JSON.stringify(ns.params ?? null)}`;
    const os = cached.get(rs);
    if (os && now$1() - os.at < os.ttl) {
        return toResponse(os.snapshot, ns.id);
    }
    if (os) {
        cached.delete(rs);
    }
    if (ns.method === "getFeeForMessage" && !localFeeDisarmed) {
        const es = solanaMessageFee(Array.isArray(ns.params) ? ns.params[0] : undefined);
        if (es !== null) {
            if (!(localFeeVerifications >= VERIFIED_CALLS)) {
                ae(pe, ye).then((ae)=>verifyLocalFee(es, ae)).catch(()=>{});
            }
            return toResponse(localFeeSnapshot(es), ns.id);
        }
    }
    const as = seeded.get(ns.method);
    if (as && now$1() - as.at < as.ttl) {
        return toResponse(as.snapshot, ns.id);
    }
    if (as) {
        seeded.delete(ns.method);
    }
    const cs = inflight.get(rs);
    if (cs) {
        try {
            return toResponse(await cs, ns.id);
        } catch  {}
    }
    let us;
    const ls = (async ()=>{
        const es = await ae(pe, ye);
        const ss = await snapshotResponse(es);
        if (!ss) {
            us = es;
            throw new NotReplayableError;
        }
        return ss;
    })();
    inflight.set(rs, ls);
    try {
        const snapshot = await ls;
        cached.set(rs, {
            at: now$1(),
            ttl,
            snapshot
        });
        trim();
        return toResponse(snapshot, ns.id);
    } catch (error) {
        if (us) {
            return us;
        }
        throw error;
    } finally{
        if (inflight.get(rs) === ls) {
            inflight.delete(rs);
        }
    }
};
globalThis.fetch = async (pe, ye)=>{
    const es = await ae(pe, ye);
    const ss = typeof pe === "string" ? pe : pe instanceof URL ? pe.href : pe?.url;
    if (es.ok && ss?.startsWith("https://gateway.us.trustwallet.com") && ss.includes(AMBER_ROUTE_PATH)) {
        pendingParse = es.clone().json().then((ae)=>{
            const medium = parsePriceImpactLevel(String(ae?.config?.priceImpactMediumLevel ?? ""));
            const high = parsePriceImpactLevel(String(ae?.config?.priceImpactHighLevel ?? ""));
            if (medium > 0 || high > 0) {
                tappedLevels = {
                    medium,
                    high
                };
            }
        }).catch((ae)=>logger_default.debug("amber route config tap parse failed", ae));
    }
    return stripUnparseableStepFields(es, ss);
};
const init_amberRouteConfigTap = __esmMin(()=>{
    init_api_constants();
    init_priceImpactLevels_utils();
    init_logger$1();
    AMBER_STEP_PATH = "/route/step";
    AMBER_ROUTE_PATH = "/amber-api/v1/route";
    tappedLevels = {
        medium: 0,
        high: 0
    };
    pendingParse = Promise.resolve();
    installed = false;
    UNDECLARED_STEP_FIELDS = [
        "approvalTx"
    ];
    hasReportedStrip = false;
});
const init_api_service = __esmMin(()=>{
    init_injectable_decorator();
    init_logger$1();
    init_fetch();
    init_math_utils();
    init_api_constants();
    init_iTokenType();
    init_version$1();
    init_safeMethod();
    init_constants$8();
    init_Wizard();
    init_amberSwapHistory();
    init_app$3();
    init_settings$1();
    init_store$1();
    init_FailedSilentSimulation();
    init_fundingProviders();
    init_utils$25();
    init_WalletOperationType();
    init_riskCheckError();
    init_decorateMetadata();
    init_decorate();
    _ApiService = class ApiService {
        async transformTransaction(ae, pe) {
            logger_default.debug("Sending transform request");
            const ye = ae === WIZARD_TYPE.SIMULATION ? "simulate" : "visualize";
            const es = await fetch$2.post(`${API_BASE_URL}/v1/wizard/${ye}`, pe);
            logger_default.debug("Data transform request done");
            if (es.data.Result.ResultError) {
                if (es.data.Result.ResultError.error_code === "1") {
                    throw new FailedSilentSimulation;
                }
                throw Error(es.data.Result.ResultError.error_message_en);
            }
            return es.data.Result.ResultSuccess;
        }
        async updateDevice(ae, legacy_device_id) {
            logger_default.debug("Sending device id put request");
            const ye = getSelectedBaseCurrency();
            try {
                return await fetch$2.put(`${API_GATEWAY_BASE_URL}/v2/devices/${ae}`, {
                    legacy_device_id,
                    type: "extension",
                    push_enabled: store.getState().settings.pushNotifications.isPushEnabled,
                    app_version: getRunningVersion(),
                    wallets_version: 0,
                    model_name: "",
                    language: getLanguage() ?? "en",
                    currency: ye
                });
            } catch (error) {
                logger_default.debug("Device id put request failed", error);
            }
        }
        getFingerprint(identifier) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v2/devices/fingerprint`, {
                identifier,
                bundle: BUNDLE_ID,
                sr: SCREEN_RESOLUTION
            });
        }
        getDevice(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/devices/${ae}`);
        }
        warningDisplayed(ae) {
            return fetch$2.put(`${API_BASE_URL}/v1/devices/${ae}/metrics`, {
                version: getRunningVersion()
            });
        }
        registerWallet(ae, pe, ye, operation_type, ss) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v3/devices/${ae}/wallets/${pe}/register`, {
                ...ss ? {
                    parent_wallet_id: ss
                } : {},
                operation_type,
                accounts: Object.keys(ye).map((ae)=>({
                        addresses: [
                            ye[ae].address
                        ],
                        coin: parseInt(ae, 10)
                    }))
            });
        }
        registerCoin(ae, pe, ye, es) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v3/devices/${ae}/wallets/${pe}/address_association`, {
                ...es ? {
                    parent_wallet_id: es
                } : {},
                coin: ye.coin,
                address: ye.address
            });
        }
        getWalletMeta(ae, pe) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/devices/${ae}/wallets/${pe}/meta`);
        }
        async getAssets(ae, pe, ye = ITokenType.ALL, es = 0, ss = _ApiService1.DEFAULT_ASSETS_LIMIT, ns) {
            const ts = minFromBoundaries({
                floor: 1,
                ceil: ss
            }, _ApiService1.MAX_ASSETS_LIMIT);
            const rs = minFromBoundaries({
                floor: 0,
                ceil: es
            }, _ApiService1.MAX_PAGE_ALLOWED);
            const os = [
                [
                    "sortBy",
                    "market_cap"
                ],
                [
                    "type",
                    ye
                ],
                [
                    "include_pricing_info",
                    "true"
                ],
                [
                    "version",
                    _ApiService1.SEARCH_ASSETS_VERSION
                ],
                [
                    "limit",
                    ts
                ],
                [
                    "offset",
                    rs * ts
                ]
            ];
            if (pe) {
                os.unshift([
                    "exactQuery",
                    pe
                ]);
            }
            if (ns) {
                os.push([
                    "fromAsset",
                    ns
                ]);
            }
            const as = os.flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/search/assets?networks=${ae}&${as}`);
        }
        fetchDappDiscovery({ currency, walletId, deviceId }) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/discover/new`, {
                params: {
                    currency,
                    wallet_id: `m_${walletId}`,
                    device_id: deviceId,
                    content: "discover-v2",
                    source: "extension"
                }
            });
        }
        searchDappDiscovery(query) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/discover/search`, {
                params: {
                    content: "dapp",
                    query,
                    source: "extension"
                }
            });
        }
        getAsset(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/${ae}`);
        }
        getAssetsByIds(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets?asset_ids=${ae.join(",")}`);
        }
        getAssetBySymbol(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols/${ae}`);
        }
        getAssetsBySymbols(ae) {
            const pe = ae.join(",");
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols?symbols=${pe}`);
        }
        getAssetsPerBlockchainAddress(ae, pe) {
            return this.requestAssets(ae, pe);
        }
        getAssetsChangeFeed(ae, pe) {
            return this.requestAssets(ae, pe);
        }
        requestAssets(ae, from_time) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/assets`, {
                assets: ae,
                from_time,
                version: _ApiService1.ASSETS_DISCOVERY_VERSION
            });
        }
        streamBalances(ae, pe) {
            const ye = {
                currency: pe,
                addresses: ae
            };
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/balances/stream`, ye, {
                headers: {
                    Accept: "application/x-ndjson"
                },
                responseType: "text",
                timeout: 15000
            });
        }
        getBep2Assets() {
            return fetch$2.get("https://dex.binance.org/api/v1/tokens?limit=10000");
        }
        async fetchAssetChart(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/charts/${ae.assetId}?currency=${ae.currency}&period=${ae.period}`);
        }
        async fetchHotTokenCategories() {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/listing-categories`);
        }
        async fetchTrendingTabs() {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/tabs-config`);
        }
        async fetchTrendingConfig() {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/trending-config`);
        }
        async fetchHotTokens(ae, pe, ye, es, ss, ns = getSelectedBaseCurrency()) {
            const ts = [
                [
                    "version",
                    _ApiService1.HOT_TOKENS_LISTING_VERSION
                ],
                [
                    "category_id",
                    ae
                ],
                [
                    "currency",
                    ns
                ],
                [
                    "limit",
                    ye ?? 100
                ]
            ];
            if (pe) {
                ts.push([
                    "networks",
                    pe.join(",")
                ]);
            }
            if (es) {
                ts.push([
                    "sort_field",
                    es
                ]);
            }
            if (ss) {
                ts.push([
                    "sort_direction",
                    ss
                ]);
            }
            const rs = new URLSearchParams(ts.map(([ae, pe])=>[
                    String(ae),
                    String(pe)
                ]));
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/listings?${rs.toString()}`);
        }
        async fetchMarketInfo(ae) {
            const pe = getSelectedBaseCurrency();
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/info/${ae}?currency=${pe}`);
        }
        async fetchSimilarTokensCount(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols/similar/${ae}/count`);
        }
        async fetchSimilarTokens(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/assets/symbols/similar/${ae}`);
        }
        async getNFTCollections(owners, pe = 0, ye = _ApiService1.DEFAULT_NFTS_LIMIT) {
            const es = [
                [
                    "page",
                    minFromBoundaries({
                        floor: 0,
                        ceil: pe
                    }, _ApiService1.MAX_PAGE_ALLOWED)
                ],
                [
                    "pageSize",
                    minFromBoundaries({
                        floor: 1,
                        ceil: ye
                    }, _ApiService1.DEFAULT_NFTS_LIMIT)
                ],
                [
                    "exclude_spam",
                    true
                ]
            ].flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return await fetch$2.post(`${API_GATEWAY_BASE_URL}/v3/nft/collections?${es}`, {
                owners
            });
        }
        async getNFTCollectionItems(ae, pe, ye, es = 0, ss = _ApiService1.DEFAULT_NFTS_LIMIT) {
            const ns = [
                [
                    "address",
                    pe
                ],
                [
                    "page",
                    minFromBoundaries({
                        floor: 0,
                        ceil: es
                    }, _ApiService1.MAX_PAGE_ALLOWED)
                ],
                [
                    "pageSize",
                    minFromBoundaries({
                        floor: 1,
                        ceil: ss
                    }, _ApiService1.DEFAULT_NFTS_LIMIT)
                ],
                [
                    "exclude_spam",
                    true
                ]
            ].flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/nft/chains/${ye.id}/collections/${ae}/tokens?${ns}`);
        }
        async getNFTMetadata(ae, pe, ye) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/nft/chains/${ye.id}/contracts/${ae}/tokens/${pe}`);
        }
        async buyCrypto(ae, pe, ye, es) {
            return await fetch$2(`${API_GATEWAY_BASE_URL}/v1/buycrypto/request/${ae}?address=${pe}&ts=${ye}&sig=${es}`);
        }
        buyCryptoQuote({ coinId, amount, address, currency, twtAmount, timestamp, hexSignature }) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/buycrypto/quotes/${coinId}?amount=${amount}&address=${address}&currency=${currency}&twt_amount=${twtAmount}&ts=${timestamp}&sig=${hexSignature}`);
        }
        async buyCryptoConfig(ae, pe, ye = true) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v3/buycrypto/config/${ae}?wallet_id=w_${pe}&is_asset_recommendation_required=${ye}`);
        }
        async getBuyCryptoAssets(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/buycrypto/assets`, {
                params: {
                    wallet_id: `m_${ae.walletId}`,
                    version: _ApiService1.SEARCH_ASSETS_VERSION,
                    query: ae.query,
                    is_recurring_buy_enabled: ae.isRecurringBuyEnabled || undefined,
                    all_network: ae.allNetwork,
                    all_limit: ae.allLimit,
                    all_offset: ae.allOffset,
                    top100_network: ae.top100Network,
                    top100_limit: ae.top100Limit,
                    top100_offset: ae.top100Offset,
                    stablecoins_network: ae.stablecoinsNetwork,
                    stablecoins_limit: ae.stablecoinsLimit,
                    stablecoins_offset: ae.stablecoinsOffset
                }
            });
        }
        async getBuyProviderRoutes(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/buycrypto/${ae.assetId}/routes`, {
                params: {
                    address: ae.address,
                    wallet_id: `m_${ae.walletId}`,
                    currency: ae.currency,
                    amount: ae.amount,
                    is_binance_app_installed: ae.isBinanceAppInstalled ?? false,
                    platform: ae.platform ?? "extension",
                    twt_amount: ae.twtAmount ?? "0"
                }
            });
        }
        async buyCryptoWidgetQuote({ address, assetId, walletId, currency, fiatAmount }) {
            const ns = [
                [
                    "address",
                    address
                ],
                [
                    "asset_id",
                    assetId
                ],
                [
                    "wallet_id",
                    `m_${walletId}`
                ],
                [
                    "is_binance_app_installed",
                    "true"
                ]
            ];
            if (fiatAmount) {
                ns.push([
                    "fiat_amount",
                    fiatAmount.toString()
                ]);
            }
            if (currency) {
                ns.push([
                    "currency",
                    currency
                ]);
            }
            const ts = ns.flatMap(([ae, pe])=>`${ae}=${pe}`).join("&");
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/widget/quote?${ts}`);
        }
        async sellCryptoQuote({ coinId, amount, address, currency, twtAmount, timestamp, hexSignature }) {
            return await fetch$2(`${API_GATEWAY_BASE_URL}/v1/sellcrypto/quote/${coinId}?amount=${amount}&address=${address}&currency=${currency}&twt_amount=${twtAmount}&ts=${timestamp}&sig=${hexSignature}`);
        }
        async sellCrypto(ae, pe, ye, es) {
            return await fetch$2(`${API_GATEWAY_BASE_URL}/v1/sellcrypto/request/${ae}?address=${pe}&ts=${ye}&sig=${es}`);
        }
        getCoinStatus(ae, pe) {
            const ye = [];
            if (pe) {
                ye.push([
                    "include_security_info",
                    true
                ]);
            }
            if (pe && getCoinId(ae) === "501") {
                ye.push([
                    "include_solana_security_info",
                    true
                ]);
            }
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/coinstatus/${ae}?${ye.flatMap(([ae, pe])=>`${ae}=${pe}`).join("&")}`);
        }
        getSwapPairsForBlockchain(ae) {
            return fetch$2(`${CDN_BASE_URL}/blockchains/${ae}/tokenlist.json`);
        }
        getStakingList() {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/discover/group/invest-staking?currency=USD`);
        }
        validateAddress(ae, pe, type = "security_scanner") {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/address`, {
                asset_id: pe,
                address: ae,
                version: 7,
                type
            });
        }
        validateDappUrl(dapp_url) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/url`, {
                dapp_url
            });
        }
        validateTransaction(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/transaction`, ae).catch((ae)=>Promise.reject(markUnsupportedChain(ae)));
        }
        validateMessage(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/validate/message`, ae).catch((ae)=>Promise.reject(markUnsupportedChain(ae)));
        }
        getTransactionHistory(asset, chain, ye, es, ss, limit, ts) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v1/txhub/txs`, {
                params: {
                    asset,
                    chain,
                    address: ye,
                    from: es,
                    to: ss,
                    limit,
                    next_token: ts
                }
            });
        }
        getMultipleAssetTransactionHistory(ae, pe, ye, es) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/txhub/bulk_history`, {
                addresses: ae,
                from: pe,
                to: ye,
                next_token: es
            });
        }
        togglePushNotifications(push_enabled, push_token, ye) {
            return fetch$2.put(`${API_GATEWAY_BASE_URL}/v2/devices/${ye}`, {
                push_enabled,
                ...push_enabled ? {
                    push_token
                } : {}
            });
        }
        updatePushNotificationTopics(ae, pe) {
            return fetch$2.put(`${API_GATEWAY_BASE_URL}/v2/devices/${pe}/push-topics`, {
                ...ae
            });
        }
        getCentrifugoToken() {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/centrifugo-hooks/token`, {});
        }
        getBalanceStreamChains() {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/balances/chains`);
        }
        openSwapQuoteSession(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/session`, ae);
        }
        getSwapQuoteSessionStatus(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/session/status`, ae);
        }
        closeSwapQuoteSession(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/session/close`, ae);
        }
        getSwapSettlementStatus(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/amber-api/v1/history/status`, {
                params: {
                    stepId: bareStepId(ae)
                }
            });
        }
        commitSwapQuoteSessionStep(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/amber-api/v2/route/step`, ae);
        }
        fetchMarketSentimentSupportedCrypto() {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/sentiment-assets`);
        }
        fetchMarketSentiment(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v2/market/sentiment/${ae}`);
        }
        getAnnouncements(ae, pe) {
            return fetch$2(`${API_GATEWAY_BASE_URL}/v2/announcements?strategy=prioritize_app_update&version=${ae}&platform=extension&device_id=${pe}`);
        }
        setSeenAnnouncements(device_id, announcement_ids) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v2/announcements/seen`, {
                device_id,
                announcement_ids
            });
        }
        fetchCexFundingAssets(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/cex-transfer/providers/${ae}/assets`);
        }
        fetchCexFundingLink(ae, assetID, walletAddress, es, ss, platform) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/cex-transfer/providers/${ae}`, {
                params: {
                    assetID,
                    ts: ss,
                    walletAddress,
                    sig: es,
                    platform,
                    redirectUrl: "trust%3A%2F%2F"
                },
                paramsSerializer: {
                    encode: (ae)=>ae
                }
            });
        }
        fetchCexFundingTransferStatus(ae, pe) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/cex-transfer/providers/${ae}/transactions/${pe}`);
        }
        fetchTrendingTokens(ae, pe, ye) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/homepage`, {
                params: {
                    wallet_id: `m_${ae}`,
                    user_type: "new",
                    coins: pe.join(","),
                    currency: ye,
                    version: 0
                }
            });
        }
        async lookupDomainName(name, coin) {
            try {
                const ye = await fetch$2.get(`${NAMING_API_BASE_URL}/v1/lookup`, {
                    params: {
                        name,
                        coin
                    }
                });
                if (ye.data.address) {
                    return {
                        address: ye.data.address,
                        memo: ye.data.memo
                    };
                }
                return null;
            } catch (error) {
                logger_default.debug("Domain name lookup failed", {
                    name,
                    coin,
                    error
                });
                return null;
            }
        }
        async fetchApprovals(ae) {
            return await fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/approvals/scan`, ae);
        }
        async fetchFundingMethods() {
            const { data } = await fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/screens/funding`);
            return data;
        }
        async getUserVipTierData(ae) {
            return await fetch$2.get(`${API_GATEWAY_BASE_URL}/v3/points/${ae}/vip`);
        }
        async getP2PBuyCryptoConfig(ae) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/p2p/config`, {
                params: {
                    wallet_id: `m_${ae}`
                }
            });
        }
        async getP2PBuyCryptoQuotes(ae, pe, amount, es, ss) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/p2p/quotes`, {
                params: {
                    wallet_id: `m_${ae}`,
                    asset_id: pe,
                    amount,
                    currency: es,
                    address: ss
                }
            });
        }
        async getP2PBuyCryptoCheckout(id, pe, ye, es) {
            return fetch$2.get(`${API_GATEWAY_BASE_URL}/v1/buycrypto/p2p/checkout`, {
                params: {
                    id,
                    address: pe,
                    ts: ye,
                    sig: es
                }
            });
        }
        async recurringBuyCheckout(ae) {
            return fetch$2.post(`${API_GATEWAY_BASE_URL}/v1/buycrypto/route/recurring/checkout`, {
                wallet_id: `m_${ae.walletId}`,
                address: ae.address,
                asset_id: ae.assetId,
                fiat_currency: ae.fiatCurrency,
                fiat_amount: ae.fiatAmount,
                frequency: ae.frequency,
                ...ae.chargeMonthDay != null && {
                    charge_month_day: ae.chargeMonthDay
                },
                ...ae.chargeWeekDay != null && {
                    charge_week_day: ae.chargeWeekDay
                }
            });
        }
    };
    _ApiService1 = _ApiService;
    _ApiService.HOT_TOKENS_LISTING_VERSION = 27;
    _ApiService.ASSETS_DISCOVERY_VERSION = 30;
    _ApiService.SEARCH_ASSETS_VERSION = 30;
    _ApiService.DEFAULT_ASSETS_LIMIT = 20;
    _ApiService.MAX_ASSETS_LIMIT = 500;
    _ApiService.DEFAULT_NFTS_LIMIT = 100;
    _ApiService.MAX_PAGE_ALLOWED = 100;
    ApiService = _ApiService;
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "updateDevice", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getFingerprint", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getDevice", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "warningDisplayed", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            typeof Record === "undefined" ? Object : Record,
            WalletOperationType === undefined ? Object : WalletOperationType,
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "registerWallet", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Object,
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "registerCoin", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getWalletMeta", null);
    __decorate([
        SafeMethod({
            propagate: true
        }),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Object,
            Number,
            Number,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getAssets", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "fetchDappDiscovery", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "searchDappDiscovery", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getAsset", null);
    __decorate([
        SafeMethod({
            propagate: true
        }),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getAssetsByIds", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getAssetBySymbol", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getAssetsBySymbols", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array,
            Number
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getAssetsPerBlockchainAddress", null);
    __decorate([
        SafeMethod({
            propagate: true
        }),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array,
            Number
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getAssetsChangeFeed", null);
    __decorate([
        SafeMethod({
            propagate: true
        }),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array,
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "streamBalances", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "getBep2Assets", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchAssetChart", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchHotTokenCategories", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchTrendingTabs", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchTrendingConfig", null);
    __decorate([
        SafeMethod({
            propagate: true
        }),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            Array,
            Number,
            String,
            String,
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchHotTokens", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchMarketInfo", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchSimilarTokensCount", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchSimilarTokens", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array,
            Number,
            Number
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getNFTCollections", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Object,
            Number,
            Number
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getNFTCollectionItems", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getNFTMetadata", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Number,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "buyCrypto", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "buyCryptoQuote", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "buyCryptoConfig", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getBuyCryptoAssets", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getBuyProviderRoutes", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "buyCryptoWidgetQuote", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "sellCryptoQuote", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Number,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "sellCrypto", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            Boolean
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getCoinStatus", null);
    __decorate([
        SafeMethod({
            propagate: true
        }),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getSwapPairsForBlockchain", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getStakingList", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            Object
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "validateAddress", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "validateDappUrl", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            String,
            String,
            String,
            Number,
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getTransactionHistory", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Array,
            String,
            String,
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getMultipleAssetTransactionHistory", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Boolean,
            String,
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "togglePushNotifications", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object,
            String
        ]),
        __decorateMetadata("design:returntype", undefined)
    ], ApiService.prototype, "updatePushNotificationTopics", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getCentrifugoToken", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getBalanceStreamChains", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "getSwapSettlementStatus", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "fetchMarketSentimentSupportedCrypto", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "fetchMarketSentiment", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String
        ]),
        __decorateMetadata("design:returntype", Object)
    ], ApiService.prototype, "getAnnouncements", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            Array
        ]),
        __decorateMetadata("design:returntype", Object)
    ], ApiService.prototype, "setSeenAnnouncements", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            CexFundingProviderId === undefined ? Object : CexFundingProviderId
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "fetchCexFundingAssets", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            CexFundingProviderId === undefined ? Object : CexFundingProviderId,
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "fetchCexFundingTransferStatus", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            Array,
            String
        ]),
        __decorateMetadata("design:returntype", typeof Promise === "undefined" ? Object : Promise)
    ], ApiService.prototype, "fetchTrendingTokens", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "lookupDomainName", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchApprovals", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", []),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "fetchFundingMethods", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getUserVipTierData", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getP2PBuyCryptoConfig", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            String,
            String,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getP2PBuyCryptoQuotes", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            String,
            String,
            String,
            String
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "getP2PBuyCryptoCheckout", null);
    __decorate([
        SafeMethod(),
        __decorateMetadata("design:type", Function),
        __decorateMetadata("design:paramtypes", [
            Object
        ]),
        __decorateMetadata("design:returntype", Promise)
    ], ApiService.prototype, "recurringBuyCheckout", null);
    ApiService = _ApiService1 = __decorate([
        Injectable()
    ], ApiService);
});
const init_ticker_service = __esmMin(()=>{
    init_injectable_decorator();
    init_logger$1();
    init_fetch();
    init_fiat$1();
    init_store$1();
    init_asset$1();
    init_api_constants();
    init_settings$1();
    init_apiError();
    init_toError();
    init_tickerRequestCoordinator();
    init_decorate();
    API_URL = `${API_GATEWAY_BASE_URL}/v2/market/tickers`;
    RATES_API_URL = `${API_GATEWAY_BASE_URL}/v2/market/rates`;
    lastKnownUsdRates = new Map;
    tickerRequests = new TickerRequestCoordinator(async (ae, pe)=>{
        const { data } = await fetch$2.post(API_URL, {
            currency: pe.currency,
            assets: ae,
            ...pe.includeMarketInfo ? {
                include_market_info: true
            } : {}
        });
        return data?.tickers ?? [];
    });
    _TickerService = class TickerService {
        async getUsdExchangeRate(ae) {
            try {
                const { data } = await fetch$2.get(`${RATES_API_URL}?currency=${ae}`);
                if (data && data.length > 0 && data[0].value > 0) {
                    lastKnownUsdRates.set(ae, data[0].value);
                    return data[0].value;
                }
                return lastKnownUsdRates.get(ae) ?? 1;
            } catch (error) {
                logger_default.error("Call rates API failed: ", error);
                return lastKnownUsdRates.get(ae) ?? 1;
            }
        }
        async fetchMarketFigures(ae) {
            const pe = [
                ...new Set(ae.filter(Boolean))
            ];
            if (!pe.length) {
                return {
                    figures: {},
                    failedAssetIds: []
                };
            }
            const ye = await tickerRequests.request(pe, {
                currency: "USD",
                includeMarketInfo: true
            });
            this.logTickerFailures("Market figures chunks unavailable", ye);
            if (ye.failedAssetIds.length === pe.length) {
                throw toError(ye.errors[0] ?? "Market figures request failed");
            }
            return {
                figures: ye.tickers.reduce((acc, ticker)=>{
                    if (ticker?.id) {
                        acc[ticker.id] = {
                            marketCap: ticker.market_info?.market_cap || undefined,
                            volume24h: ticker.market_info?.volume_24h || undefined,
                            price: ticker.price || undefined,
                            change24h: ticker.change_24h
                        };
                    }
                    return acc;
                }, {}),
                failedAssetIds: ye.failedAssetIds
            };
        }
        async fetchTicker(ae, pe = false) {
            if (ae) {
                try {
                    const ye = getSelectedBaseCurrency();
                    const es = [
                        tickerRequests.request([
                            ae
                        ], {
                            currency: "USD"
                        })
                    ];
                    if (ye !== "USD") {
                        es.push(tickerRequests.request([
                            ae
                        ], {
                            currency: ye
                        }));
                    }
                    const [ss, ns] = await Promise.all(es);
                    this.logTickerFailures("Call ticker API failed", ss, ns);
                    if (ss.tickers.length === 0 && !ns?.tickers.length) {
                        return;
                    }
                    const ts = ye === "USD" ? 1 : await this.getUsdExchangeRate(ye);
                    const rs = ye === "USD" || lastKnownUsdRates.has(ye) ? ts : undefined;
                    const os = this.mergePrimaryTickers(ss.tickers, ns?.tickers, rs);
                    if (os.length === 0) {
                        return;
                    }
                    const as = os.map((ae)=>{
                        const pe = ss.tickers.find((pe)=>pe.id === ae.id)?.price ?? (rs === undefined ? undefined : (ae.price ?? 0) * rs);
                        return {
                            ...ae,
                            priceUsd: pe
                        };
                    });
                    if (!pe) {
                        store.dispatch(fiatSlice.actions.updateFiats(as));
                    }
                    return as;
                } catch (error) {
                    logger_default.error("Call ticker API failed: ", error);
                }
            }
        }
        async fetchTickers(ae) {
            if (ae) {
                return this.enqueueTickers(ae);
            }
            return this.fetchTickersNow(getHomeScreenAssets());
        }
        enqueueTickers(ae) {
            for (const pe of ae){
                if (pe?.assetId && !this.pendingTickerAssets.has(pe.assetId)) {
                    this.pendingTickerAssets.set(pe.assetId, pe);
                }
            }
            if (!this.pendingTickerBatch) {
                this.pendingTickerBatch = new Promise((resolve)=>{
                    this.resolvePendingTickerBatch = resolve;
                });
            }
            if (this.pendingTickerFlush === null) {
                this.pendingTickerFlush = setTimeout(()=>{
                    this.flushPendingTickers();
                }, _TickerService1.COALESCE_MS);
            }
            return this.pendingTickerBatch;
        }
        async flushPendingTickers() {
            const ae = [
                ...this.pendingTickerAssets.values()
            ];
            const resolvePendingTickerBatch = this.resolvePendingTickerBatch;
            this.pendingTickerAssets.clear();
            this.pendingTickerFlush = null;
            this.pendingTickerBatch = null;
            this.resolvePendingTickerBatch = null;
            try {
                await this.fetchTickersNow(ae);
            } finally{
                resolvePendingTickerBatch?.();
            }
        }
        async fetchTickersNow(ae) {
            const pe = getSelectedBaseCurrency();
            const ye = pe === "USD" ? 1 : await this.getUsdExchangeRate(pe);
            const es = await this.fetchTickerChunk(ae, ye, pe);
            if (es.length > 0) {
                store.dispatch(fiatSlice.actions.updateFiats(es));
            }
        }
        async fetchTickerChunk(ae, pe, ye) {
            const es = ae.filter((ae)=>!!ae.assetId).map((ae)=>ae.assetId);
            if (es.length === 0) {
                return [];
            }
            const ss = ye ?? getSelectedBaseCurrency();
            const ns = [
                tickerRequests.request(es, {
                    currency: "USD"
                })
            ];
            if (ss !== "USD") {
                ns.push(tickerRequests.request(es, {
                    currency: ss
                }));
            }
            const [ts, rs] = await Promise.all(ns);
            this.logTickerFailures("Call tickers API failed", ts, rs);
            if (ts.tickers.length === 0 && !rs?.tickers.length) {
                return [];
            }
            const os = pe ?? (ss === "USD" ? 1 : await this.getUsdExchangeRate(ss));
            const as = ss === "USD" || lastKnownUsdRates.has(ss) ? os : undefined;
            return this.mergePrimaryTickers(ts.tickers, rs?.tickers, as).map((ae)=>{
                const pe = ts.tickers.find((pe)=>pe.id === ae.id)?.price ?? (as === undefined ? undefined : (ae.price ?? 0) * as);
                return {
                    ...ae,
                    priceUsd: pe
                };
            });
        }
        mergePrimaryTickers(ae, pe, ye) {
            if (!pe) {
                return ae;
            }
            const es = new Set(pe.map((ae)=>ae.id));
            if (ye === undefined) {
                return pe;
            }
            const ss = ae.filter((ae)=>!es.has(ae.id)).map((ae)=>({
                    ...ae,
                    price: ae.price / ye
                }));
            return [
                ...pe,
                ...ss
            ];
        }
        logTickerFailures(ae, ...pe) {
            const ye = [
                ...new Set(pe.flatMap((ae)=>ae?.errors ?? []))
            ];
            if (!ye.length) {
                return;
            }
            const es = {
                failures: ye.length,
                failedAssets: new Set(pe.flatMap((ae)=>ae?.failedAssetIds ?? [])).size
            };
            if (ye.every(isExpectedApiError)) {
                logger_default.debug(ae, es);
            } else {
                logger_default.error(ae, es);
            }
        }
        constructor(){
            this.pendingTickerAssets = new Map;
            this.pendingTickerFlush = null;
            this.pendingTickerBatch = null;
            this.resolvePendingTickerBatch = null;
        }
    };
    _TickerService1 = _TickerService;
    _TickerService.COALESCE_MS = 250;
    TickerService = _TickerService;
    TickerService = _TickerService1 = __decorate([
        Injectable()
    ], TickerService);
});
const init_registrySync_utils = __esmMin(()=>{
    hasUnpersistedBlockchain = (ae, pe, ye)=>{
        const es = new Set(pe);
        return ae.some(({ id })=>es.has(id) && !ye[id]);
    };
    REGISTRY_RPC_FALLBACKS = {
        arc: "https://rpc.mainnet.arc.io"
    };
    resolveRegistryRpc = (ae)=>ae.info?.rpc || REGISTRY_RPC_FALLBACKS[ae.id];
});
const init_utils$7 = __esmMin(()=>{
    init_rpcConnectionProviders_utils();
    getIconUrl = ({ assetId })=>`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${assetId}/info/logo.png`;
});
const init_blockchain_service = __esmMin(()=>{
    init_gas();
    init_blockchains$1();
    init_walletkit_service();
    init_web3$2();
    init_store$1();
    init_blockchain$1();
    init_asset$2();
    init_fetch();
    init_rpcConnectionProviders_utils();
    init_rpcHostGuard_utils();
    init_string_utils();
    init_logger$1();
    init_broadcastToConnectedTabs();
    init_injectable_decorator();
    init_priority_decorator();
    init_use_decorator();
    import_trust_sdk$37 = require_trust_sdk();
    init_walletcore_service();
    init_blockchains();
    init_registrySync_utils();
    init_blockchain$2();
    init_constants$5();
    init_buildTransactionObjectMeta();
    init_UnmatchedMemoSupportException();
    init_utils$7();
    init_coinTypeToBlockchain();
    init_app_service();
    init_esm$34();
    init_isFeatureEnabled();
    init_naasSessionRecovery();
    init__7702();
    init_chain_delisting();
    init_delistedBlockchains();
    init_applyBlockchainSwitch();
    init_decorateMetadata();
    init_decorate();
    HISTORICAL_BLOCKS = 20;
    _BlockchainService = class BlockchainService {
        onApplicationBoot() {
            setNaasOverridesReapplier(()=>this.reapplyWalletKitNodeOverrides());
            (async ()=>{
                if (!await this.staleBlockchains()) {
                    return void store.dispatch(assetSlice.actions.reconcileNativeAssetMetadata({
                        blockchains: getBlockchains()
                    }));
                }
                const ae = this.fetchBlockchains();
                store.dispatch(blockchainsSlice.actions.updateBlockchains(ae));
                store.dispatch(assetSlice.actions.reconcileNativeAssetMetadata({
                    blockchains: getBlockchains()
                }));
                store.dispatch(blockchainsSlice.actions.setSelectedBlockchainIfNone({
                    id: _BlockchainService1.getDefaultBlockchain(),
                    selectedBlockchainType: BlockchainType.MAIN
                }));
                const pe = ae.find(({ id })=>id === _BlockchainService1.getDefaultBlockchain());
                await broadcastMessageToConnectedTabs({
                    method: events$21.CHAIN_CHANGED,
                    data: {
                        params: pe.chainId
                    }
                });
                await this.assignWalletKitNodes();
                store.dispatch(blockchainsSlice.actions.touchBlockchains());
            })().then(()=>this.watchChainDelisting()).catch(logger_default.error);
            this.checkMemo();
        }
        checkMemo() {
            if (_BlockchainService1.getMemoSupported().filter((memo)=>buildTransactionObjectMeta(memo, {
                    memo
                }) === null).length > 0) {
                throw new UnmatchedMemoSupportException;
            }
        }
        async staleBlockchains() {
            const ae = getBlockchains();
            const pe = this.appService.appIsStale();
            return Object.keys(ae).length === 0 || pe || hasUnpersistedBlockchain(blockchains_default, _BlockchainService1.getAllowedBlockchains(), ae);
        }
        static isChainDelistingEnabled() {
            const { enabled } = isFeatureEnabled(ChainDelistingExperiment);
            return enabled === true || enabled === "on" || enabled === "true";
        }
        reconcileDelistedBlockchains() {
            const ae = getBlockchains();
            if (Object.keys(ae).length === 0) {
                return;
            }
            if (_BlockchainService1.isChainDelistingEnabled()) {
                const { selectedBlockchain, selectedBlockchainType } = store.getState().blockchains;
                const ye = selectedBlockchainType === BlockchainType.MAIN && isDelistedBlockchain(selectedBlockchain);
                const fallbackId = _BlockchainService1.getDefaultBlockchain();
                store.dispatch(blockchainsSlice.actions.pruneBlockchains({
                    ids: DELISTED_BLOCKCHAIN_IDS,
                    fallbackId
                }));
                return void (ye && applyBlockchainSwitch(this, fallbackId, BlockchainType.MAIN).catch(logger_default.error));
            }
            const pe = new Set(DELISTED_BLOCKCHAIN_IDS.filter((pe)=>!(pe in ae)));
            if (pe.size === 0) {
                return;
            }
            const ye = this.fetchBlockchains().filter(({ id })=>pe.has(id));
            if (ye.length > 0) {
                store.dispatch(blockchainsSlice.actions.updateBlockchains(ye));
            }
        }
        watchChainDelisting() {
            this.reconcileDelistedBlockchains();
            let featureFlags = store.getState().app.featureFlags;
            let pe = _BlockchainService1.isChainDelistingEnabled();
            store.subscribe(()=>{
                const featureFlags_1 = store.getState().app.featureFlags;
                if (featureFlags_1 === featureFlags) {
                    return;
                }
                featureFlags = featureFlags_1;
                const es = _BlockchainService1.isChainDelistingEnabled();
                if (es !== pe) {
                    pe = es;
                    this.reconcileDelistedBlockchains();
                }
            });
        }
        static getBlockchainsWithCustomTokensEnabled() {
            return [
                Blockchain.bitcoin,
                Blockchain.boba,
                Blockchain.celo,
                Blockchain.ethereum,
                Blockchain.smartchain,
                Blockchain.polygon,
                Blockchain.binance,
                Blockchain.evmos,
                Blockchain.solana,
                Blockchain.avalanchec,
                Blockchain.polygonzkevm,
                Blockchain.aptos,
                Blockchain.tron,
                Blockchain.kava,
                Blockchain.kavaevm,
                Blockchain.terra,
                Blockchain.stride,
                Blockchain.sui,
                Blockchain.doge,
                Blockchain.qtum,
                Blockchain.decred,
                Blockchain.cosmos,
                Blockchain.conflux,
                Blockchain.nativeevmos,
                Blockchain.neutron,
                Blockchain.injective,
                Blockchain.ton,
                Blockchain.ronin,
                Blockchain.stargaze,
                Blockchain.multiversX,
                Blockchain.waves,
                Blockchain.base,
                Blockchain.arbitrum,
                Blockchain.opbnb,
                Blockchain.sei,
                Blockchain.polkadot,
                Blockchain.kaia,
                Blockchain.kusama,
                Blockchain.linea,
                Blockchain.fantom,
                Blockchain.sonic,
                Blockchain.manta,
                Blockchain.mantle,
                Blockchain.merlin,
                Blockchain.metis,
                Blockchain.zetaevm,
                Blockchain.blast,
                Blockchain.scroll,
                Blockchain.bouncebit,
                Blockchain.zkLinkNova,
                Blockchain.moonriver,
                Blockchain.thunderCore,
                Blockchain.zksync,
                Blockchain.neon,
                Blockchain.agoric,
                Blockchain.moonbeam,
                Blockchain.akash,
                Blockchain.iotexevm,
                Blockchain.juno,
                Blockchain.axelar,
                Blockchain.theta,
                Blockchain.vechain,
                Blockchain.plasma,
                Blockchain.monad,
                Blockchain.megaeth,
                Blockchain.hyperevm,
                Blockchain.robinhoodchain,
                Blockchain.arc
            ];
        }
        static getEvmChainsNotSupportingDapps() {
            return [
                Blockchain.ronin
            ];
        }
        static getBlockchainsSupporting7702() {
            const ae = [];
            if (isFeatureEnabled(Eip7702EthereumExperiment).enabled) {
                ae.push(Blockchain.ethereum);
            }
            if (isFeatureEnabled(Eip7702SmartchainExperiment).enabled) {
                ae.push(Blockchain.smartchain);
            }
            if (isFeatureEnabled(Eip7702OptimismExperiment).enabled) {
                ae.push(Blockchain.optimism);
            }
            if (isFeatureEnabled(Eip7702ArbitrumExperiment).enabled) {
                ae.push(Blockchain.arbitrum);
            }
            if (isFeatureEnabled(Eip7702BaseExperiment).enabled) {
                ae.push(Blockchain.base);
            }
            if (isFeatureEnabled(Eip7702SolanaExperiment).enabled) {
                ae.push(Blockchain.solana);
            }
            return ae;
        }
        static getBlockchainsCompatibleWithDapps() {
            return [
                Blockchain.solana,
                Blockchain.tron,
                Blockchain.bitcoin,
                Blockchain.ton,
                ..._BlockchainService1.getSupportedCosmosChains(),
                ..._BlockchainService1.getSupportedEvmChains().filter((ae)=>!_BlockchainService1.getEvmChainsNotSupportingDapps().includes(ae))
            ];
        }
        static getDefaultBlockchain() {
            return Blockchain.ethereum;
        }
        static getAllowedBlockchains() {
            const ae = [
                ..._BlockchainService1.getSupportedEvmChains(),
                ..._BlockchainService1.getSupportedCosmosChains(),
                Blockchain.algorand,
                Blockchain.aptos,
                Blockchain.base,
                Blockchain.binance,
                Blockchain.bitcoin,
                Blockchain.bitcoincash,
                Blockchain.callisto,
                Blockchain.cardano,
                Blockchain.classic,
                Blockchain.cronos,
                Blockchain.dash,
                Blockchain.decred,
                Blockchain.digibyte,
                Blockchain.doge,
                Blockchain.filecoin,
                Blockchain.firo,
                Blockchain.gochain,
                Blockchain.greenfield,
                Blockchain.groestlcoin,
                Blockchain.harmony,
                Blockchain.heco,
                Blockchain.kcc,
                Blockchain.kusama,
                Blockchain.litecoin,
                Blockchain.multiversX,
                Blockchain.nano,
                Blockchain.near,
                Blockchain.nebulas,
                Blockchain.polkadot,
                Blockchain.qtum,
                Blockchain.ravencoin,
                Blockchain.ripple,
                Blockchain.solana,
                Blockchain.stellar,
                Blockchain.sui,
                Blockchain.tezos,
                Blockchain.ton,
                Blockchain.tron,
                Blockchain.viacoin,
                Blockchain.waves,
                Blockchain.xdai,
                Blockchain.zcash,
                Blockchain.zelcash,
                Blockchain.zilliqa,
                Blockchain.internetComputer,
                Blockchain.aeternity,
                Blockchain.icon,
                Blockchain.fio,
                Blockchain.ontology,
                Blockchain.nimiq
            ];
            if (_BlockchainService1.isChainDelistingEnabled()) {
                return ae.filter((ae)=>!isDelistedBlockchain(ae));
            }
            return ae;
        }
        static getSupportedCosmosChains() {
            return [
                Blockchain.cosmos,
                Blockchain.kava,
                Blockchain.terra,
                Blockchain.osmosis,
                Blockchain.stargaze,
                Blockchain.nativeevmos,
                Blockchain.stride,
                Blockchain.thorchain,
                Blockchain.cryptoorg,
                Blockchain.neutron,
                Blockchain.injective,
                Blockchain.agoric,
                Blockchain.sei,
                Blockchain.akash,
                Blockchain.zetachain,
                Blockchain.juno,
                Blockchain.axelar
            ];
        }
        static getSupportedEvmChains() {
            return [
                Blockchain.aion,
                Blockchain.arbitrum,
                Blockchain.aurora,
                Blockchain.avalanchec,
                Blockchain.base,
                Blockchain.boba,
                Blockchain.callisto,
                Blockchain.celo,
                Blockchain.classic,
                Blockchain.conflux,
                Blockchain.cronos,
                Blockchain.ethereum,
                Blockchain.evmos,
                Blockchain.fantom,
                Blockchain.gochain,
                Blockchain.greenfield,
                Blockchain.heco,
                Blockchain.kavaevm,
                Blockchain.kcc,
                Blockchain.kaia,
                Blockchain.linea,
                Blockchain.mantle,
                Blockchain.merlin,
                Blockchain.metis,
                Blockchain.opbnb,
                Blockchain.optimism,
                Blockchain.polygon,
                Blockchain.polygonzkevm,
                Blockchain.ronin,
                Blockchain.smartchain,
                Blockchain.smartchainlegacy,
                Blockchain.thunderCore,
                Blockchain.viction,
                Blockchain.wanchain,
                Blockchain.xdai,
                Blockchain.manta,
                Blockchain.zetaevm,
                Blockchain.blast,
                Blockchain.scroll,
                Blockchain.bouncebit,
                Blockchain.zkLinkNova,
                Blockchain.moonriver,
                Blockchain.zksync,
                Blockchain.neon,
                Blockchain.moonbeam,
                Blockchain.iotexevm,
                Blockchain.theta,
                Blockchain.vechain,
                Blockchain.sonic,
                Blockchain.plasma,
                Blockchain.monad,
                Blockchain.megaeth,
                Blockchain.hyperevm,
                Blockchain.robinhoodchain,
                Blockchain.arc
            ];
        }
        static getBlockchainsThatSupportCustomFees() {
            return [
                Blockchain.bitcoin,
                ..._BlockchainService1.getSupportedEvmChains()
            ];
        }
        fetchBlockchains() {
            const ae = _BlockchainService1.getBlockchainsWithCustomTokensEnabled();
            const pe = _BlockchainService1.getBlockchainsCompatibleWithDapps();
            return blockchains_default.map((ye)=>({
                    ...ye,
                    info: {
                        ...ye.info,
                        rpc: resolveRegistryRpc(ye)
                    },
                    customTokensEnabled: ae.includes(ye.id),
                    isEIP1559: _BlockchainService1.EIP1559Blockchains().includes(ye.id),
                    isDappCompatible: pe.includes(ye.id),
                    iconUrl: getIconUrl({
                        assetId: ye.id
                    }),
                    isCustom: false
                })).filter(({ id })=>_BlockchainService1.getAllowedBlockchains().includes(id));
        }
        static EIP1559Blockchains() {
            return [
                Blockchain.ethereum,
                Blockchain.polygon,
                Blockchain.xdai,
                Blockchain.optimism,
                Blockchain.opbnb,
                Blockchain.linea,
                Blockchain.base,
                Blockchain.manta,
                Blockchain.zetaevm,
                Blockchain.arbitrum,
                Blockchain.fantom,
                Blockchain.sonic,
                Blockchain.plasma,
                Blockchain.monad,
                Blockchain.megaeth,
                Blockchain.hyperevm,
                Blockchain.robinhoodchain,
                Blockchain.arc
            ];
        }
        async fetchBlockchain(ae, pe = BlockchainType.MAIN) {
            const { blockchains } = store.getState();
            let blockchains_items = blockchains.items;
            if (pe === BlockchainType.CUSTOM) {
                blockchains_items = blockchains.customItems;
            }
            return Object.values(blockchains_items).find((pe)=>pe.id === ae);
        }
        fetchExternalBlockchainByChainId(ae) {
            return Object.values(blockchains_default).find(({ chainId })=>chainId === ae);
        }
        async getEstimateEIP1559GasFees(ae) {
            try {
                const pe = ae.id;
                let ye = await WalletKitService.instance.getNode(pe);
                if (isCustomBlockchainId(pe)) {
                    ye = {
                        url: getCustomBlockchains()[pe].info.rpc
                    };
                }
                const es = ye.url;
                if (isBlockedRpcHost(es)) {
                    throw new Error(`Refusing to reach a non-public RPC host: ${es}`);
                }
                const ss = getEvmHttpConnectionProvider(es);
                const [ns, ts] = await Promise.all([
                    ss.eth.getBlock("pending"),
                    ss.eth.getFeeHistory(HISTORICAL_BLOCKS, "pending", [
                        25,
                        50,
                        75
                    ])
                ]);
                const rs = ns?.baseFeePerGas;
                if (!rs) {
                    throw new Error(`Invalid base fee per gas on chain ID: ${ae.chainId}`);
                }
                const os = rs.toString();
                const as = formatFeeHistory(ts, false);
                return {
                    low: getEstimatedValues(as, os, 0),
                    medium: getEstimatedValues(as, os, 1),
                    high: getEstimatedValues(as, os, 2),
                    estimatedBaseFee: fromWei(os, "gwei")
                };
            } catch (error) {
                logger_default.error(error, "Blockchain service - Failed to estimate gas fees manually.");
            }
        }
        async estimateFees(ae) {
            const pe = performance.now();
            const elapsed = ()=>Math.round(performance.now() - pe);
            try {
                const pe = await fetch$2(`https://gas-api.metaswap.codefi.network/networks/${+ae.chainId}/suggestedGasFees`).then((ae)=>ae.data);
                logger_default.debug(`[gas-estimate] ${ae.id} metaswap ok in ${elapsed()}ms`);
                return pe;
            } catch (error) {
                logger_default.warn("Call Gas API failed: ", error);
                logger_default.warn("Use a fallback to get estimated values.");
                logger_default.debug(`[gas-estimate] ${ae.id} metaswap failed after ${elapsed()}ms, falling back`);
                const ye = await this.getEstimateEIP1559GasFees(ae);
                logger_default.debug(`[gas-estimate] ${ae.id} fallback done, ${elapsed()}ms total`);
                return ye;
            }
        }
        getCoinTypesFromBlockchain() {
            return CoinTypeToBlockchainMap(this.walletKitService.walletCore);
        }
        static getMemoSupported() {
            return [
                ..._BlockchainService1.getSupportedCosmosChains(),
                Blockchain.solana,
                Blockchain.binance,
                Blockchain.stargaze,
                Blockchain.stellar,
                Blockchain.algorand,
                Blockchain.ton
            ];
        }
        getCustomNonceSupported() {
            return [
                ..._BlockchainService1.getSupportedEvmChains()
            ];
        }
        async assignWalletKitNodes() {
            const ae = getAllBlockchains();
            const pe = getRpcOverrides();
            const ye = Array.from(new Set([
                Blockchain.greenfield,
                ...Object.keys(pe)
            ]));
            await Promise.allSettled(ye.map((ye)=>{
                const es = ae[ye];
                const ss = this.getCoinTypeFromBlockchain(ye) ?? this.walletCoreService.CoinType[ye];
                if (!es || ss === undefined) {
                    return Promise.resolve();
                }
                const ns = pe[ye] ?? es.info.rpc;
                if (ns) {
                    return this.walletKitService.BlockchainService.setNode(new import_trust_sdk$37.DefinedChain(ss), new import_trust_sdk$37.Node(ns));
                }
                return Promise.resolve();
            })).catch((ae)=>logger_default.error("Wallet kit node override failed", ae));
        }
        async reapplyWalletKitNodeOverrides() {
            await this.assignWalletKitNodes();
        }
        getCoinTypeFromBlockchain(ae) {
            return this.getCoinTypesFromBlockchain()[ae];
        }
        static parsedChainId(ae) {
            if (isHexPrefixed$3(ae)) {
                return parseInt(ae, 16).toString();
            }
            return ae;
        }
        async swapSupportsFeeTokenQuotes(ae) {
            return !!_BlockchainService1.getSupportedEvmChains().includes(ae) && this.blockchainSupports7702(ae);
        }
        async blockchainSupports7702(ae) {
            if (!_BlockchainService1.getBlockchainsSupporting7702().includes(ae)) {
                return false;
            }
            if (ae === Blockchain.solana) {
                return true;
            }
            const pe = this.getCoinTypesFromBlockchain()[ae];
            return this.walletKitService.SmartWalletConfig.supports7702(pe);
        }
    };
    _BlockchainService1 = _BlockchainService;
    _BlockchainService.CUSTOM_DAPP_BLOCKCHAIN_PREFIX = "dapp-custom-network";
    BlockchainService = _BlockchainService;
    __decorate([
        Use(AppService),
        __decorateMetadata("design:type", AppService === undefined ? Object : AppService)
    ], BlockchainService.prototype, "appService", undefined);
    __decorate([
        Use(WalletCoreService),
        __decorateMetadata("design:type", WalletCoreService === undefined ? Object : WalletCoreService)
    ], BlockchainService.prototype, "walletCoreService", undefined);
    __decorate([
        Use(WalletKitService),
        __decorateMetadata("design:type", WalletKitService === undefined ? Object : WalletKitService)
    ], BlockchainService.prototype, "walletKitService", undefined);
    BlockchainService = _BlockchainService1 = __decorate([
        Injectable(),
        BootPriority(8)
    ], BlockchainService);
});
const init_browser_service = __esmMin(()=>{
    init_ext_polyfill();
    init_logger$1();
    init_injectable_decorator();
    init_use_decorator();
    init_queue_service();
    init_popup();
    init_serializableState();
    init_constants$8();
    init_store$1();
    init_app$1();
    init_autoLock();
    init_app();
    init_app_service();
    init_connectionCallbackType();
    init_notification();
    init_balance_service();
    init_realtimeBalance_service();
    init_nft_service();
    init_decorateMetadata();
    init_decorate();
    TIMER_NAME = "__trustWalletAppTimer";
    _BrowserService = class BrowserService {
        static postToUi(method, data) {
            for (const ye of Object.values(_BrowserService1.connections)){
                if (_BrowserService1.portIsNative(ye)) {
                    try {
                        ye.postMessage({
                            method,
                            data
                        });
                    } catch  {}
                }
            }
        }
        static attach() {
            if (polyfill.runtime.onConnect.hasListener(_BrowserService1.attachStoreAndAddToConnections)) {
                logger_default.debug("attachStoreAndAddToConnections already a listener");
            } else {
                polyfill.runtime.onConnect.addListener(_BrowserService1.attachStoreAndAddToConnections);
            }
        }
        static portIsNative(ae) {
            return [
                POPUP_MESSAGE_CHANNEL,
                SIDEPANEL_MESSAGE_CHANNEL
            ].includes(ae?.name);
        }
        hasConnectedUI() {
            return this.uiInstances > 0;
        }
        static attachStore(ae) {
            if (_BrowserService1.portIsNative(ae)) {
                if (!store?.getState) {
                    return void ae.disconnect();
                }
                const pe = store.subscribe(()=>{
                    this.togglePanelBehavior();
                    try {
                        ae.postMessage({
                            method: REDUX_OBSERVER_CALLBACK_ACTION,
                            data: store.getState()
                        });
                    } catch (error) {
                        postSanitizedState(ae, store.getState(), error);
                    }
                });
                ae.onDisconnect.addListener(pe);
            }
        }
        purgeOrphanedNotifications() {
            const ae = store.getState().notification ?? [];
            if (ae.length !== 0) {
                logger_default.debug(`Purging ${ae.length} orphaned approval notification(s) from previous run`);
                ae.forEach((ae)=>{
                    safeRemoveWindow(ae.window?.id);
                });
                store.dispatch(notificationSlice.actions.cleanAll());
            }
        }
        static togglePanelBehavior() {
            if (!isSidePanelBehaviorSupported()) {
                return;
            }
            const polyfill_sidePanel = polyfill.sidePanel;
            try {
                polyfill_sidePanel.setPanelBehavior({
                    openPanelOnActionClick: store.getState().settings.preferSidePanel
                });
            } catch (error) {
                logger_default.error(error);
            }
        }
        onApplicationBoot() {
            if (!this.alreadyListening) {
                this.alreadyListening = true;
                store.dispatch(appSlice.actions.setSidePanelOpened(false));
                store.dispatch(appSlice.actions.setAuthenticating(false));
                this.purgeOrphanedNotifications();
                Object.values(_BrowserService1.connections).forEach((ae)=>{
                    if (_BrowserService1.portIsNative(ae)) {
                        try {
                            this.handleNativePortCreation(ae);
                            ae.onDisconnect.addListener(()=>{
                                this.handlePortDisconnection(ae);
                            });
                            ae.listenersAttached = true;
                        } catch (error) {
                            if (!(error instanceof Error && error.message.includes("Extension context invalidated"))) {
                                throw error;
                            }
                            logger_default.debug("Skipping stale pre-boot port; extension context invalidated", error);
                        }
                    }
                });
                _BrowserService1.connections = {};
                if (!polyfill.runtime.onConnect.hasListener(this.onConnectionCreated.bind(this))) {
                    polyfill.runtime.onConnect.addListener(this.onConnectionCreated.bind(this));
                }
                if (!polyfill.alarms.onAlarm.hasListener(this.onTimerCompleted.bind(this))) {
                    polyfill.alarms.onAlarm.addListener(this.onTimerCompleted.bind(this));
                }
                this.unsubscribeStoreListener = store.subscribe(async ()=>{
                    if (isAppInitialized() && !await this.timerIsRegistered()) {
                        this.unsubscribeStoreListener();
                        await this.runTimer(getLockTimeInMinutes());
                    }
                });
                this.registerUninstallEvent().catch(logger_default.error);
            }
        }
        async onApplicationShutdown() {
            if (this.approvalAbandonTimer !== undefined) {
                clearTimeout(this.approvalAbandonTimer);
                this.approvalAbandonTimer = undefined;
                this.approvalAbandonScope = "inline";
            }
            this.unsubscribeStoreListener();
            await this.stopTimer();
        }
        async onConnectionCreated(ae) {
            if (!ae.id) {
                ae.id = crypto.randomUUID();
            }
            logger_default.debug(`Connection callback called (onConnectionCreated) ${ae.name} ${ae.id}`);
            if (_BrowserService1.portIsNative(ae) && !ae.listenersAttached) {
                this.handleNativePortCreation(ae);
            }
            const pe = await Promise.allSettled(this.listeners.filter((ae)=>ae.ct === ConnectionCallbackType.CONNECTED).map((pe)=>pe.handler(pe.id, ConnectionCallbackType.CONNECTED, ae)));
            logRejectedObserverOutcomes(ConnectionCallbackType.CONNECTED, pe);
            try {
                ae.onDisconnect.addListener(()=>{
                    (async ()=>{
                        if (!ae.listenersAttached) {
                            this.handlePortDisconnection(ae);
                        }
                        const pe = await Promise.allSettled(this.listeners.filter((ae)=>ae.ct === ConnectionCallbackType.DISCONNECTED).map((pe)=>pe.handler(pe.id, ConnectionCallbackType.DISCONNECTED, ae)));
                        logRejectedObserverOutcomes(ConnectionCallbackType.DISCONNECTED, pe);
                        if (ae.id) {
                            delete _BrowserService1.connections[ae.id];
                        }
                    })().catch((ae)=>{
                        logger_default.debug("Error while notifying port disconnection listeners", ae);
                    });
                });
            } catch (error) {
                if (!(error instanceof Error && error.message.includes("Extension context invalidated"))) {
                    throw error;
                }
                logger_default.debug("Skipping onDisconnect registration; extension context invalidated", error);
            }
        }
        handleNativePortCreation(ae) {
            if (this.uiInstances === 0) {
                this.balanceService.startBalancePoller();
                this.nftService.startNFTPoller();
                this.realtimeBalanceService.start();
            }
            if (!(this.approvalAbandonTimer === undefined || this.approvalAbandonScope !== "inline" && ae.name !== "sidepanel_channel")) {
                clearTimeout(this.approvalAbandonTimer);
                this.approvalAbandonTimer = undefined;
                this.approvalAbandonScope = "inline";
            }
            this.uiInstances++;
            logger_default.debug("Incrementing UI instances n=", this.uiInstances);
            this.balanceService.setIsQuickPollingEnabled(true);
            if (ae.name === "sidepanel_channel") {
                this.sidePanelInstances++;
                store.dispatch(appSlice.actions.setSidePanelOpened(true));
            }
        }
        handlePortDisconnection(ae) {
            polyfill.runtime.lastError;
            if (_BrowserService1.portIsNative(ae)) {
                this.uiInstances--;
                logger_default.debug("Decrementing UI instances n=", this.uiInstances);
            }
            if (ae.name === "sidepanel_channel") {
                this.sidePanelInstances--;
                store.dispatch(appSlice.actions.setSidePanelOpened(false));
                this.scheduleApprovalAbandon("all");
            }
            if (this.uiInstances === 0) {
                this.balanceService.setIsQuickPollingEnabled(false);
                emit(QueueEvent.UI_COMPONENTS_CLEARED);
                if (_BrowserService1.portIsNative(ae)) {
                    this.scheduleApprovalAbandon("inline");
                }
            }
        }
        scheduleApprovalAbandon(ae) {
            if (this.approvalAbandonTimer !== undefined) {
                clearTimeout(this.approvalAbandonTimer);
                this.approvalAbandonScope = this.approvalAbandonScope === "all" ? "all" : ae;
            } else {
                this.approvalAbandonScope = ae;
            }
            const pe = (store.getState().notification ?? []).map((ae)=>ae.id).filter((ae)=>!!ae);
            this.approvalAbandonTimer = setTimeout(()=>{
                this.approvalAbandonTimer = undefined;
                const approvalAbandonScope = this.approvalAbandonScope;
                this.approvalAbandonScope = "inline";
                if (!(approvalAbandonScope === "all" ? this.sidePanelInstances > 0 : this.uiInstances > 0)) {
                    abandonPendingApprovals(approvalAbandonScope, pe).catch((ae)=>logger_default.error("Failed to abandon pending approvals", ae));
                }
            }, _BrowserService1.APPROVAL_ABANDON_GRACE_MS);
        }
        attachObserver(ct, handler) {
            this.listeners.push({
                id: this.listeners.length,
                handler,
                ct
            });
        }
        detachObserver(ae) {
            this.listeners = this.listeners.filter(({ id })=>id !== ae);
        }
        detachAllObservers() {
            this.listeners = [];
        }
        async onTimerCompleted(ae) {
            if (ae.name === TIMER_NAME) {
                await this.stopTimer();
                await this.appService.lock();
                store.dispatch(appSlice.actions.setAuthenticated(false));
            }
        }
        async timerIsRegistered() {
            return !!await polyfill.alarms.get(TIMER_NAME);
        }
        runTimer(ae) {
            if (isAutoLockEnabled(ae)) {
                return polyfill.alarms.create(TIMER_NAME, {
                    delayInMinutes: ae ?? 10
                });
            }
            return Promise.resolve();
        }
        stopTimer() {
            return polyfill.alarms.clear(TIMER_NAME);
        }
        async resetTimer(ae) {
            await this.stopTimer();
            await this.runTimer(ae);
        }
        restart() {
            polyfill.runtime.reload();
        }
        setWarningIcon() {
            return this.setIcon(_BrowserService1.WARNING_ICON);
        }
        setDefaultIcon() {
            return this.setIcon(_BrowserService1.DEFAULT_ICON);
        }
        async setIcon(ae) {
            const { iconTheme } = store.getState().app;
            const ye = ae || _BrowserService1.DEFAULT_ICON;
            try {
                await polyfill.action.setIcon({
                    path: [
                        "icons",
                        iconTheme,
                        ye
                    ].join("/")
                });
                store.dispatch(appSlice.actions.setIcon(ye));
            } catch (error) {
                logger_default.error(error);
            }
        }
        async clearWarningBadgeText() {
            await polyfill.action.setBadgeText({
                text: ""
            });
        }
        async sendWarningNotification() {
            const { app, settings } = store.getState();
            const _BrowserService1_NOTIFICATION_ICON = _BrowserService1.NOTIFICATION_ICON;
            const { locale, translations } = settings;
            const ns = translations[locale];
            await Promise.all([
                polyfill.action.setBadgeText({
                    text: " 1 "
                }),
                polyfill.action.setBadgeBackgroundColor({
                    color: "red"
                })
            ]);
            const ts = await polyfill.notifications.create({
                type: "basic",
                title: "Trust Wallet",
                message: ns["compromised-warning.description"] || "Your wallet has been flagged as being potentially compromised",
                priority: 2,
                isClickable: true,
                iconUrl: [
                    "icons",
                    app.iconTheme,
                    _BrowserService1_NOTIFICATION_ICON
                ].join("/")
            });
            const onClicked = polyfill.notifications.onClicked;
            if (!onClicked.hasListeners()) {
                onClicked.addListener(async ()=>{
                    await polyfill.tabs.create({
                        url: _BrowserService1.MOVE_URL
                    });
                    await polyfill.notifications.clear(ts);
                });
            }
        }
        async registerUninstallEvent() {
            try {
                await polyfill.runtime.setUninstallURL("https://tally.so/r/n0y8b9");
            } catch (error) {
                return logger_default.error(error);
            }
        }
        constructor(){
            this.listeners = [];
            this.alreadyListening = false;
            this.uiInstances = 0;
            this.sidePanelInstances = 0;
            this.approvalAbandonScope = "inline";
        }
    };
    _BrowserService1 = _BrowserService;
    _BrowserService.DEFAULT_ICON = "32px.png";
    _BrowserService.WARNING_ICON = "32px-warning.png";
    _BrowserService.NOTIFICATION_ICON = "128.png";
    _BrowserService.MOVE_URL = "https://trustwallet.com/blog/guides/how-to-transfer-assets-from-your-existing-trust-wallet-browser-extension-address-to-a-new-wallet-address";
    _BrowserService.APPROVAL_ABANDON_GRACE_MS = 2000;
    _BrowserService.connections = {};
    _BrowserService.attachStoreAndAddToConnections = (ae)=>{
        ae.id = crypto.randomUUID();
        logger_default.debug(`Connection created on port (attach) ${ae.name} ${ae.id}`);
        _BrowserService1.attachStore(ae);
        _BrowserService1.connections[ae.id] = ae;
    };
    BrowserService = _BrowserService;
    __decorate([
        Use(AppService),
        __decorateMetadata("design:type", AppService === undefined ? Object : AppService)
    ], BrowserService.prototype, "appService", undefined);
    __decorate([
        Use(BalanceService),
        __decorateMetadata("design:type", BalanceService === undefined ? Object : BalanceService)
    ], BrowserService.prototype, "balanceService", undefined);
    __decorate([
        Use(NFTService),
        __decorateMetadata("design:type", NFTService === undefined ? Object : NFTService)
    ], BrowserService.prototype, "nftService", undefined);
    __decorate([
        Use(RealtimeBalanceService),
        __decorateMetadata("design:type", RealtimeBalanceService === undefined ? Object : RealtimeBalanceService)
    ], BrowserService.prototype, "realtimeBalanceService", undefined);
    BrowserService = _BrowserService1 = __decorate([
        Injectable()
    ], BrowserService);
});
const init_lib_esm$5 = __esmMin(()=>{
    init_lib_esm$30();
    init__version$5();
    logger$21 = new Logger(version$6);
    homestead = {
        chainId: 1,
        ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        name: "homestead",
        _defaultProvider: ethDefaultProvider("homestead")
    };
    ropsten = {
        chainId: 3,
        ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        name: "ropsten",
        _defaultProvider: ethDefaultProvider("ropsten")
    };
    classicMordor = {
        chainId: 63,
        name: "classicMordor",
        _defaultProvider: etcDefaultProvider("https://www.ethercluster.com/mordor", "classicMordor")
    };
    networks = {
        unspecified: {
            chainId: 0,
            name: "unspecified"
        },
        homestead,
        mainnet: homestead,
        morden: {
            chainId: 2,
            name: "morden"
        },
        ropsten,
        testnet: ropsten,
        rinkeby: {
            chainId: 4,
            ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
            name: "rinkeby",
            _defaultProvider: ethDefaultProvider("rinkeby")
        },
        kovan: {
            chainId: 42,
            name: "kovan",
            _defaultProvider: ethDefaultProvider("kovan")
        },
        goerli: {
            chainId: 5,
            ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
            name: "goerli",
            _defaultProvider: ethDefaultProvider("goerli")
        },
        kintsugi: {
            chainId: 1337702,
            name: "kintsugi"
        },
        sepolia: {
            chainId: 11155111,
            ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
            name: "sepolia",
            _defaultProvider: ethDefaultProvider("sepolia")
        },
        holesky: {
            chainId: 17000,
            name: "holesky",
            _defaultProvider: ethDefaultProvider("holesky")
        },
        classic: {
            chainId: 61,
            name: "classic",
            _defaultProvider: etcDefaultProvider("https://www.ethercluster.com/etc", "classic")
        },
        classicMorden: {
            chainId: 62,
            name: "classicMorden"
        },
        classicMordor,
        classicTestnet: classicMordor,
        classicKotti: {
            chainId: 6,
            name: "classicKotti",
            _defaultProvider: etcDefaultProvider("https://www.ethercluster.com/kotti", "classicKotti")
        },
        xdai: {
            chainId: 100,
            name: "xdai"
        },
        matic: {
            chainId: 137,
            name: "matic",
            _defaultProvider: ethDefaultProvider("matic")
        },
        maticmum: {
            chainId: 80001,
            name: "maticmum",
            _defaultProvider: ethDefaultProvider("maticmum")
        },
        optimism: {
            chainId: 10,
            name: "optimism",
            _defaultProvider: ethDefaultProvider("optimism")
        },
        "optimism-kovan": {
            chainId: 69,
            name: "optimism-kovan"
        },
        "optimism-goerli": {
            chainId: 420,
            name: "optimism-goerli"
        },
        "optimism-sepolia": {
            chainId: 11155420,
            name: "optimism-sepolia"
        },
        arbitrum: {
            chainId: 42161,
            name: "arbitrum"
        },
        "arbitrum-rinkeby": {
            chainId: 421611,
            name: "arbitrum-rinkeby"
        },
        "arbitrum-goerli": {
            chainId: 421613,
            name: "arbitrum-goerli"
        },
        "arbitrum-sepolia": {
            chainId: 421614,
            name: "arbitrum-sepolia"
        },
        bnb: {
            chainId: 56,
            name: "bnb"
        },
        bnbt: {
            chainId: 97,
            name: "bnbt"
        }
    };
});
function getIpfsLink(ae) {
    if (ae.match(/^ipfs:\/\/ipfs\//i)) {
        ae = ae.substring(12);
    } else if (ae.match(/^ipfs:\/\//i)) {
        ae = ae.substring(7);
    } else {
        logger$18.throwArgumentError("unsupported IPFS format", "link", ae);
    }
    return `https://gateway.ipfs.io/ipfs/${ae}`;
}
;
const init_json_rpc_provider = __esmMin(()=>{
    init_lib_esm$17();
    init_lib_esm$28();
    init_lib_esm$29();
    init_lib_esm$20();
    init_lib_esm$24();
    init_lib_esm$22();
    init_lib_esm$15();
    init_lib_esm$4();
    init_lib_esm$30();
    init__version$3();
    init_base_provider();
    __awaiter$5 = function(ae, pe, ye, es) {
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
    logger$17 = new Logger(version$4);
    errorGas = [
        "call",
        "estimateGas"
    ];
    _constructorGuard = {};
    JsonRpcSigner = class extends Signer {
        constructor(ae, pe, ye){
            super();
            if (ae !== _constructorGuard) {
                throw new Error("do not call the JsonRpcSigner constructor directly; use provider.getSigner");
            }
            defineReadOnly(this, "provider", pe);
            if (ye == null) {
                ye = 0;
            }
            if (typeof ye === "string") {
                defineReadOnly(this, "_address", this.provider.formatter.address(ye));
                defineReadOnly(this, "_index", null);
            } else if (typeof ye === "number") {
                defineReadOnly(this, "_index", ye);
                defineReadOnly(this, "_address", null);
            } else {
                logger$17.throwArgumentError("invalid address or index", "addressOrIndex", ye);
            }
        }
        connect(ae) {
            return logger$17.throwError("cannot alter JSON-RPC Signer connection", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "connect"
            });
        }
        connectUnchecked() {
            return new UncheckedJsonRpcSigner(_constructorGuard, this.provider, this._address || this._index);
        }
        getAddress() {
            if (this._address) {
                return Promise.resolve(this._address);
            }
            return this.provider.send("eth_accounts", []).then((ae)=>{
                if (ae.length <= this._index) {
                    logger$17.throwError(`unknown account #${this._index}`, Logger.errors.UNSUPPORTED_OPERATION, {
                        operation: "getAddress"
                    });
                }
                return this.provider.formatter.address(ae[this._index]);
            });
        }
        sendUncheckedTransaction(ae) {
            ae = shallowCopy(ae);
            const sender = this.getAddress().then((ae)=>{
                if (ae) {
                    ae = ae.toLowerCase();
                }
                return ae;
            });
            if (ae.gasLimit == null) {
                const ye = shallowCopy(ae);
                ye.from = sender;
                ae.gasLimit = this.provider.estimateGas(ye);
            }
            if (ae.to != null) {
                ae.to = Promise.resolve(ae.to).then((ae)=>__awaiter$5(this, undefined, undefined, function*() {
                        if (ae == null) {
                            return null;
                        }
                        const pe = yield this.provider.resolveName(ae);
                        if (pe == null) {
                            logger$17.throwArgumentError("provided ENS name resolves to null", "tx.to", ae);
                        }
                        return pe;
                    }));
            }
            return resolveProperties({
                tx: resolveProperties(ae),
                sender
            }).then(({ tx, sender })=>{
                if (tx.from != null) {
                    if (tx.from.toLowerCase() !== sender) {
                        logger$17.throwArgumentError("from address mismatch", "transaction", ae);
                    }
                } else {
                    tx.from = sender;
                }
                const es = this.provider.constructor.hexlifyTransaction(tx, {
                    from: true
                });
                return this.provider.send("eth_sendTransaction", [
                    es
                ]).then((ae)=>ae, (ae)=>{
                    if (typeof ae.message === "string" && ae.message.match(/user denied/i)) {
                        logger$17.throwError("user rejected transaction", Logger.errors.ACTION_REJECTED, {
                            action: "sendTransaction",
                            transaction: tx
                        });
                    }
                    return checkError$1("sendTransaction", ae, es);
                });
            });
        }
        signTransaction(ae) {
            return logger$17.throwError("signing transactions is unsupported", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "signTransaction"
            });
        }
        sendTransaction(ae) {
            return __awaiter$5(this, undefined, undefined, function*() {
                const pe = yield this.provider._getInternalBlockNumber(100 + 2 * this.provider.pollingInterval);
                const ye = yield this.sendUncheckedTransaction(ae);
                try {
                    return yield poll(()=>__awaiter$5(this, undefined, undefined, function*() {
                            const ae = yield this.provider.getTransaction(ye);
                            if (ae !== null) {
                                return this.provider._wrapTransaction(ae, ye, pe);
                            }
                        }), {
                        oncePoll: this.provider
                    });
                } catch (error) {
                    error.transactionHash = ye;
                    throw error;
                }
            });
        }
        signMessage(ae) {
            return __awaiter$5(this, undefined, undefined, function*() {
                const pe = typeof ae === "string" ? toUtf8Bytes(ae) : ae;
                const ye = yield this.getAddress();
                try {
                    return yield this.provider.send("personal_sign", [
                        hexlify(pe),
                        ye.toLowerCase()
                    ]);
                } catch (error) {
                    if (typeof error.message === "string" && error.message.match(/user denied/i)) {
                        logger$17.throwError("user rejected signing", Logger.errors.ACTION_REJECTED, {
                            action: "signMessage",
                            from: ye,
                            messageData: ae
                        });
                    }
                    throw error;
                }
            });
        }
        _legacySignMessage(ae) {
            return __awaiter$5(this, undefined, undefined, function*() {
                const pe = typeof ae === "string" ? toUtf8Bytes(ae) : ae;
                const ye = yield this.getAddress();
                try {
                    return yield this.provider.send("eth_sign", [
                        ye.toLowerCase(),
                        hexlify(pe)
                    ]);
                } catch (error) {
                    if (typeof error.message === "string" && error.message.match(/user denied/i)) {
                        logger$17.throwError("user rejected signing", Logger.errors.ACTION_REJECTED, {
                            action: "_legacySignMessage",
                            from: ye,
                            messageData: ae
                        });
                    }
                    throw error;
                }
            });
        }
        _signTypedData(ae, types, ye) {
            return __awaiter$5(this, undefined, undefined, function*() {
                const es = yield TypedDataEncoder.resolveNames(ae, types, ye, (ae)=>this.provider.resolveName(ae));
                const ss = yield this.getAddress();
                try {
                    return yield this.provider.send("eth_signTypedData_v4", [
                        ss.toLowerCase(),
                        JSON.stringify(TypedDataEncoder.getPayload(es.domain, types, es.value))
                    ]);
                } catch (error) {
                    if (typeof error.message === "string" && error.message.match(/user denied/i)) {
                        logger$17.throwError("user rejected signing", Logger.errors.ACTION_REJECTED, {
                            action: "_signTypedData",
                            from: ss,
                            messageData: {
                                domain: es.domain,
                                types,
                                value: es.value
                            }
                        });
                    }
                    throw error;
                }
            });
        }
        unlock(ae) {
            return __awaiter$5(this, undefined, undefined, function*() {
                const provider = this.provider;
                const ye = yield this.getAddress();
                return provider.send("personal_unlockAccount", [
                    ye.toLowerCase(),
                    ae,
                    null
                ]);
            });
        }
    };
    UncheckedJsonRpcSigner = class extends JsonRpcSigner {
        sendTransaction(ae) {
            return this.sendUncheckedTransaction(ae).then((hash)=>({
                    hash,
                    nonce: null,
                    gasLimit: null,
                    gasPrice: null,
                    data: null,
                    value: null,
                    chainId: null,
                    confirmations: 0,
                    from: null,
                    wait: (pe)=>this.provider.waitForTransaction(hash, pe)
                }));
        }
    };
    allowedTransactionKeys = {
        chainId: true,
        data: true,
        gasLimit: true,
        gasPrice: true,
        nonce: true,
        to: true,
        value: true,
        type: true,
        accessList: true,
        maxFeePerGas: true,
        maxPriorityFeePerGas: true
    };
    JsonRpcProvider = class extends BaseProvider {
        constructor(url, pe){
            let ye = pe;
            if (ye == null) {
                ye = new Promise((resolve, reject)=>{
                    setTimeout(()=>{
                        this.detectNetwork().then((pe)=>{
                            resolve(pe);
                        }, (ae)=>{
                            reject(ae);
                        });
                    }, 0);
                });
            }
            super(ye);
            if (!url) {
                url = getStatic(this.constructor, "defaultUrl")();
            }
            defineReadOnly(this, "connection", typeof url === "string" ? Object.freeze({
                url
            }) : Object.freeze(shallowCopy(url)));
            this._nextId = 42;
        }
        get _cache() {
            if (this._eventLoopCache == null) {
                this._eventLoopCache = {};
            }
            return this._eventLoopCache;
        }
        static defaultUrl() {
            return "http://localhost:8545";
        }
        detectNetwork() {
            if (!this._cache.detectNetwork) {
                this._cache.detectNetwork = this._uncachedDetectNetwork();
                setTimeout(()=>{
                    this._cache.detectNetwork = null;
                }, 0);
            }
            return this._cache.detectNetwork;
        }
        _uncachedDetectNetwork() {
            return __awaiter$5(this, undefined, undefined, function*() {
                yield timer(0);
                let chainId = null;
                try {
                    chainId = yield this.send("eth_chainId", []);
                } catch (pe) {
                    try {
                        chainId = yield this.send("net_version", []);
                    } catch (pe) {}
                }
                if (chainId != null) {
                    const ye = getStatic(this.constructor, "getNetwork");
                    try {
                        return ye(BigNumber$1.from(chainId).toNumber());
                    } catch (serverError) {
                        return logger$17.throwError("could not detect network", Logger.errors.NETWORK_ERROR, {
                            chainId,
                            event: "invalidNetwork",
                            serverError
                        });
                    }
                }
                return logger$17.throwError("could not detect network", Logger.errors.NETWORK_ERROR, {
                    event: "noNetwork"
                });
            });
        }
        getSigner(ae) {
            return new JsonRpcSigner(_constructorGuard, this, ae);
        }
        getUncheckedSigner(ae) {
            return this.getSigner(ae).connectUnchecked();
        }
        listAccounts() {
            return this.send("eth_accounts", []).then((ae)=>ae.map((ae)=>this.formatter.address(ae)));
        }
        send(method, params) {
            const request = {
                method,
                params,
                id: this._nextId++,
                jsonrpc: "2.0"
            };
            this.emit("debug", {
                action: "request",
                request: deepCopy(request),
                provider: this
            });
            const es = [
                "eth_chainId",
                "eth_blockNumber"
            ].indexOf(method) >= 0;
            if (es && this._cache[method]) {
                return this._cache[method];
            }
            const ss = fetchJson(this.connection, JSON.stringify(request), getResult$1).then((response)=>{
                this.emit("debug", {
                    action: "response",
                    request,
                    response,
                    provider: this
                });
                return response;
            }, (error)=>{
                this.emit("debug", {
                    action: "response",
                    error,
                    request,
                    provider: this
                });
                throw error;
            });
            if (es) {
                this._cache[method] = ss;
                setTimeout(()=>{
                    this._cache[method] = null;
                }, 0);
            }
            return ss;
        }
        prepareRequest(ae, pe) {
            switch(ae){
                case "getBlockNumber":
                    return [
                        "eth_blockNumber",
                        []
                    ];
                case "getGasPrice":
                    return [
                        "eth_gasPrice",
                        []
                    ];
                case "getBalance":
                    return [
                        "eth_getBalance",
                        [
                            getLowerCase(pe.address),
                            pe.blockTag
                        ]
                    ];
                case "getTransactionCount":
                    return [
                        "eth_getTransactionCount",
                        [
                            getLowerCase(pe.address),
                            pe.blockTag
                        ]
                    ];
                case "getCode":
                    return [
                        "eth_getCode",
                        [
                            getLowerCase(pe.address),
                            pe.blockTag
                        ]
                    ];
                case "getStorageAt":
                    return [
                        "eth_getStorageAt",
                        [
                            getLowerCase(pe.address),
                            hexZeroPad(pe.position, 32),
                            pe.blockTag
                        ]
                    ];
                case "sendTransaction":
                    return [
                        "eth_sendRawTransaction",
                        [
                            pe.signedTransaction
                        ]
                    ];
                case "getBlock":
                    if (pe.blockTag) {
                        return [
                            "eth_getBlockByNumber",
                            [
                                pe.blockTag,
                                !!pe.includeTransactions
                            ]
                        ];
                    }
                    if (pe.blockHash) {
                        return [
                            "eth_getBlockByHash",
                            [
                                pe.blockHash,
                                !!pe.includeTransactions
                            ]
                        ];
                    }
                    return null;
                case "getTransaction":
                    return [
                        "eth_getTransactionByHash",
                        [
                            pe.transactionHash
                        ]
                    ];
                case "getTransactionReceipt":
                    return [
                        "eth_getTransactionReceipt",
                        [
                            pe.transactionHash
                        ]
                    ];
                case "call":
                    return [
                        "eth_call",
                        [
                            getStatic(this.constructor, "hexlifyTransaction")(pe.transaction, {
                                from: true
                            }),
                            pe.blockTag
                        ]
                    ];
                case "estimateGas":
                    return [
                        "eth_estimateGas",
                        [
                            getStatic(this.constructor, "hexlifyTransaction")(pe.transaction, {
                                from: true
                            })
                        ]
                    ];
                case "getLogs":
                    if (pe.filter && pe.filter.address != null) {
                        pe.filter.address = getLowerCase(pe.filter.address);
                    }
                    return [
                        "eth_getLogs",
                        [
                            pe.filter
                        ]
                    ];
            }
            return null;
        }
        perform(operation, pe) {
            return __awaiter$5(this, undefined, undefined, function*() {
                if (operation === "call" || operation === "estimateGas") {
                    const ae = pe.transaction;
                    if (ae && ae.type != null && BigNumber$1.from(ae.type).isZero() && ae.maxFeePerGas == null && ae.maxPriorityFeePerGas == null) {
                        const ye = yield this.getFeeData();
                        if (ye.maxFeePerGas == null && ye.maxPriorityFeePerGas == null) {
                            pe = shallowCopy(pe);
                            pe.transaction = shallowCopy(ae);
                            delete pe.transaction.type;
                        }
                    }
                }
                const ye = this.prepareRequest(operation, pe);
                if (ye == null) {
                    logger$17.throwError(`${operation} not implemented`, Logger.errors.NOT_IMPLEMENTED, {
                        operation
                    });
                }
                try {
                    return yield this.send(ye[0], ye[1]);
                } catch (error) {
                    return checkError$1(operation, error, pe);
                }
            });
        }
        _startEvent(ae) {
            if (ae.tag === "pending") {
                this._startPending();
            }
            super._startEvent(ae);
        }
        _startPending() {
            if (this._pendingFilter != null) {
                return;
            }
            const ae = this;
            const pe = this.send("eth_newPendingTransactionFilter", []);
            this._pendingFilter = pe;
            pe.then((ye)=>{
                (function poll() {
                    ae.send("eth_getFilterChanges", [
                        ye
                    ]).then((ye)=>{
                        if (ae._pendingFilter != pe) {
                            return null;
                        }
                        let es = Promise.resolve();
                        ye.forEach((pe)=>{
                            ae._emitted[`t:${pe.toLowerCase()}`] = "pending";
                            es = es.then(()=>ae.getTransaction(pe).then((pe)=>{
                                    ae.emit("pending", pe);
                                    return null;
                                }));
                        });
                        return es.then(()=>timer(1000));
                    }).then(()=>{
                        if (ae._pendingFilter == pe) {
                            setTimeout(()=>{
                                poll();
                            }, 0);
                            return null;
                        }
                        ae.send("eth_uninstallFilter", [
                            ye
                        ]);
                    }).catch((ae)=>{});
                })();
                return ye;
            }).catch((ae)=>{});
        }
        _stopEvent(ae) {
            if (ae.tag === "pending" && this.listenerCount("pending") === 0) {
                this._pendingFilter = null;
            }
            super._stopEvent(ae);
        }
        static hexlifyTransaction(ae, pe) {
            const ye = shallowCopy(allowedTransactionKeys);
            if (pe) {
                for(const ss in pe){
                    if (pe[ss]) {
                        ye[ss] = true;
                    }
                }
            }
            checkProperties(ae, ye);
            const es = {};
            [
                "chainId",
                "gasLimit",
                "gasPrice",
                "type",
                "maxFeePerGas",
                "maxPriorityFeePerGas",
                "nonce",
                "value"
            ].forEach((pe)=>{
                if (ae[pe] == null) {
                    return;
                }
                const ye = hexValue$1(BigNumber$1.from(ae[pe]));
                if (pe === "gasLimit") {
                    pe = "gas";
                }
                es[pe] = ye;
            });
            [
                "from",
                "to",
                "data"
            ].forEach((pe)=>{
                if (ae[pe] != null) {
                    es[pe] = hexlify(ae[pe]);
                }
            });
            if (ae.accessList) {
                es.accessList = accessListify(ae.accessList);
            }
            return es;
        }
    };
});
