Vs(BigDecimalSerializer, "BigDecimalSerializer", Cs, Cs, [
    Gs
]);
Vs(BigIntegerSerializer, "BigIntegerSerializer", Cs, Cs, [
    Gs
]);
kn(ParsedAssetID, "ParsedAssetID");
Vs(Numbers, "Numbers");
kn(EllipsisParams, "EllipsisParams");
Ks(BigDecimalSerializer).i3o = function() {
    return this.o1u9_1;
};
Ks(BigDecimalSerializer).w3o = function(ae) {
    return fs(ae.s3r());
};
Ks(BigDecimalSerializer).pip = function(ae, pe) {
    ae.z3s(pe.b8w());
};
Ks(BigDecimalSerializer).v3o = function(ae, pe) {
    return this.pip(ae, pe instanceof Ws ? pe : bs());
};
Ks(BigIntegerSerializer).i3o = function() {
    return this.p1u9_1;
};
Ks(BigIntegerSerializer).w3o = function(ae) {
    const pe = ae.s3r();
    if (Xs(pe) === 0 || pe === "0x") {
        return Ps().n8s_1;
    }
    if (Qs(pe, "0x")) {
        return Hs(function remove0x(ae) {
            return removePrefix(ae, "0x");
        }(pe), 16);
    }
    return Hs(pe);
};
Ks(BigIntegerSerializer).rip = function(ae, pe) {
    ae.z3s(pe.toString());
};
Ks(BigIntegerSerializer).v3o = function(ae, pe) {
    return this.rip(ae, pe instanceof Ys ? pe : bs());
};
Ks(ParsedAssetID).cj = function() {
    return this.q1u9_1;
};
Ks(ParsedAssetID).dj = function() {
    return this.r1u9_1;
};
Ks(ParsedAssetID).hashCode = function() {
    let ae = hn(this.q1u9_1);
    return ae = os(ae, 31) + (this.r1u9_1 == null ? 0 : pn(this.r1u9_1)) | 0;
};
Ks(ParsedAssetID).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof ParsedAssetID)) {
        return false;
    }
    const pe = ae instanceof ParsedAssetID ? ae : bs();
    return !!fn(this.q1u9_1, pe.q1u9_1) && this.r1u9_1 == pe.r1u9_1;
};
Ks(Numbers).t1u9 = function(ae) {
    return internalParseNumber(0, ae);
};
Ks(Numbers).u1u9 = function(ae) {
    return this.v1u9(ae, ys().c8t_1);
};
Ks(Numbers).v1u9 = function(ae, pe) {
    const ye = internalParseNumber(0, ae);
    return ye ?? pe;
};
Ks(EllipsisParams).toString = function() {
    return `EllipsisParams(startSymbolsCount=${this.w1u9_1}, endSymbolsCount=${this.x1u9_1})`;
};
Ks(EllipsisParams).hashCode = function() {
    let w1u9_1 = this.w1u9_1;
    return w1u9_1 = os(w1u9_1, 31) + this.x1u9_1 | 0;
};
Ks(EllipsisParams).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof EllipsisParams)) {
        return false;
    }
    const pe = ae instanceof EllipsisParams ? ae : bs();
    return this.w1u9_1 === pe.w1u9_1 && this.x1u9_1 === pe.x1u9_1;
};
ae.$_$ = ae.$_$ || {};
ae.$_$.a = get_DECIMAL128;
ae.$_$.b = EllipsisParams;
ae.$_$.c = function addressAsEvmEip55OrAsIs(ae) {
    if (Un(ae.ojo())) {
        return toEip55(ae.hjo_1);
    }
    return ae.hjo_1;
};
ae.$_$.d = function containsAsPrefix(ae, pe, ye, es) {
    let ss;
    ye = ye === Cs ? "" : ye;
    es = es === Cs ? "" : es;
    e: {
        for(const ns = ae.k(); ns.l();){
            const ts = ns.m();
            if (pe === ts || Qs(pe, ye + ts + es)) {
                ss = ts;
                break e;
            }
        }
        ss = null;
    }
    return !(ss == null);
};
ae.$_$.e = function get_decimals(ae) {
    _init_properties_CoinTypeExt_kt__gprif8();
    return jn.bim(ae);
};
ae.$_$.f = drop0x;
ae.$_$.g = function ellipsis(ae, pe) {
    const ye = (pe = pe === Cs ? null : pe) != null ? pe.w1u9_1 + pe.x1u9_1 | 0 : 4;
    const ae_length = ae.length;
    if (ae_length <= ye) {
        return ae;
    }
    const ss = js(Gt(ae_length / 3.4), 15);
    const ns = pe != null ? pe.w1u9_1 : ss;
    const ts = (ae_length - (pe != null ? pe.x1u9_1 : ss - 1 | 0) | 0) - 1 | 0;
    const rs = Ht(Vt(ns, 0, ae_length - 1 | 0), Vt(ts, 0, ae_length - 1 | 0));
    return _n(Mr(Jt(ae) ? ae : bs(), rs, "…"));
};
ae.$_$.h = function fromPercent(ae) {
    return toBigDecimal_0(ae, get_DECIMAL128(Ds())).e8v(ys().e8r(100), get_DECIMAL128(Ds()));
};
ae.$_$.i = function getAvailable(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof us) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.j = function getClaimable(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof ls) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.k = function getCoinIconUrl(ae) {
    return `https://assets-cdn.trustwallet.com/blockchains/${ae.qjr()}/info/square_logo.png`;
};
ae.$_$.l = getDecimalPlacesCount;
ae.$_$.m = function getEarned(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof _s) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.n = function getFrozen(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof hs) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.o = function getInvested(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof ms) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.p = function getPending(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof vs) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.q = function getRewards(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof gs) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.r = function getSlip44Index(ae) {
    if (isCustom(ae)) {
        return new an(ae.bjm().oil());
    }
    return Tn(ae.bjm().pik());
};
ae.$_$.s = function getStaked(ae) {
    let pe;
    e: {
        for(const ye = ae.k(); ye.l();){
            const es = ye.m();
            if (es instanceof ds) {
                pe = es;
                break e;
            }
        }
        pe = null;
    }
    return pe;
};
ae.$_$.t = function increaseBy(ae, pe) {
    return ae.o3(pe).w8r(Zs(100)).t8r(ae);
};
ae.$_$.u = function isAllZeroesForNumericInput(ae) {
    let pe;
    e: {
        for(let ye = 0; ye < Xs(ae);){
            const es = qt(ae, ye);
            ye = ye + 1 | 0;
            if (es !== qs(48) && es !== qs(46) && es !== qs(44) && es !== qs(45)) {
                pe = false;
                break e;
            }
        }
        pe = true;
    }
    return pe;
};
ae.$_$.v = function isBtcLike(ae) {
    _init_properties_CoinTypeExt_kt__gprif8();
    switch(ae.e3_1){
        case 3:
        case 4:
        case 25:
        case 34:
        case 13:
        case 47:
        case 51:
        case 10:
        case 12:
        case 50:
        case 11:
        case 48:
        case 20:
        case 45:
            return true;
        default:
            return false;
    }
};
ae.$_$.w = isCustom;
ae.$_$.x = function isGreater(ae) {
    return ae > 0;
};
ae.$_$.y = function isMorpho(ae) {
    return cs(as(ae), "Morpho", true);
};
ae.$_$.z = function isMorpho_0({ pk1_1 }) {
    const ye = pk1_1 == null ? null : pk1_1.yk0_1;
    return (ye == null ? null : cs(ye, "Morpho", true)) === true;
};
ae.$_$.a1 = function get_isNonNegative(ae) {
    return ae.p8r() >= 0;
};
ae.$_$.b1 = function get_isNonPositive(ae) {
    return ae.p8r() <= 0;
};
ae.$_$.c1 = function isNotZero(ae) {
    return !ae.o8r();
};
ae.$_$.d1 = function isTrustNodes(ae) {
    const ae_pk1_1 = ae.pk1_1;
    const ye = ae_pk1_1 == null ? null : ae_pk1_1.yk0_1;
    return (ye == null ? null : cs(ye, "Trust Nodes", true)) === true || ae.nk1_1 === "bva1c6aqe9ndzcn2nsan963z43xg6kgrvzynl97785";
};
ae.$_$.e1 = function isValidAddress(ae, pe) {
    let ye;
    try {
        let es;
        if (ae.bjm().equals(zn())) {
            es = !containsHexPrefix(pe) && Xs(qn(pe).yij()) > 0;
        } else if (ae.bjm().equals(xn())) {
            es = Xs(On(pe).yij()) > 0;
        } else if (ae.bjm().equals(Pn())) {
            es = ae.bjm().qil(`ronin:${drop0x(pe)}`);
        } else {
            let ss;
            if (ae instanceof dn) {
                const ns = ae.wjr_1;
                ss = Xs(ns) > 0;
            } else {
                ss = false;
            }
            es = ss ? En.vij(pe, ae.rjr_1, ae.wjr_1) : ae.bjm().qil(pe);
        }
        ye = es;
    } catch (error) {
        if (!(error instanceof Nn)) {
            throw error;
        }
        ye = false;
    }
    return ye;
};
ae.$_$.f1 = function get_nativeTokenName(ae) {
    _init_properties_CoinTypeExt_kt__gprif8();
    return jn.fim(ae);
};
ae.$_$.g1 = function parseAssetID(ae) {
    let pe;
    try {
        const ye = Rn(ae, [
            "_"
        ], Cs, 2);
        const es = Rn($n(ye), [
            ":"
        ], Cs, 2);
        const ss = $n(es).substring(1);
        const ns = bn(ss);
        if ((ns == null ? null : new an(ns)) == null) {
            throw Mn(_n(`Malformed assetID: "${ss}"`));
        }
        const ts = ns;
        const rs = yn.ail(ts);
        if (rs == null) {
            throw Mn(_n(`Unknown coin (id = "${new an(ts)}")`));
        }
        let os;
        const as = rs;
        const cs = es.o() > 1 ? new dn(as, es.q(1), "") : Sn(as);
        if (ye.o() > 1) {
            let us;
            e: {
                for(const ls = ye.k(); ls.l();){
                    const ms = ls.m();
                    if (Qs(ms, "t")) {
                        us = ms;
                        break e;
                    }
                }
                us = null;
            }
            os = us == null ? null : us.substring(1);
        } else {
            os = null;
        }
        pe = ks(new ParsedAssetID(cs, os));
    } catch (error) {
        if (!(error instanceof Error)) {
            throw error;
        }
        pe = ks(Rs(error));
    }
    let gs;
    const ds = pe;
    const _s = An(ds);
    if (_s != null) {
        Cn().d1tx(Cs, _s, function parseAssetID$lambda(ae) {
            return function() {
                return `Failed to parseAssetID: "${ae}"`;
            };
        }(ae));
    }
    if (Ms(ds)) {
        gs = null;
    } else {
        const hs = $s(ds);
        gs = hs == null || hs != null ? hs : bs();
    }
    return gs;
};
ae.$_$.h1 = function parseCoinID(ae) {
    let pe;
    try {
        const ye = $n(Rn($n(Rn(ae, [
            "_"
        ], Cs, 2)), [
            ":"
        ], Cs, 2)).substring(1);
        const es = bn(ye);
        if ((es == null ? null : new an(es)) == null) {
            throw Mn(_n(`Malformed assetID: "${ye}"`));
        }
        pe = ks(new an(es));
    } catch (error) {
        if (!(error instanceof Error)) {
            throw error;
        }
        pe = ks(Rs(error));
    }
    let ss;
    const ns = pe;
    const ts = An(ns);
    if (ts != null) {
        Cn().d1tx(Cs, ts, function parseCoinID$lambda(ae) {
            return function() {
                return `Failed to parseCoinID: "${ae}"`;
            };
        }(ae));
    }
    if (Ms(ns)) {
        ss = null;
    } else {
        const rs = $s(ns);
        ss = rs == null || rs != null ? rs : bs();
    }
    if (ss == null) {
        return null;
    }
    return ss.at_1;
};
ae.$_$.i1 = function parseCoin(ae) {
    let pe;
    _init_properties_CoinTypeExt_kt__gprif8();
    try {
        const ye = Dn(Dn(ae, "_"), ":").substring(1);
        const es = bn(ye);
        if ((es == null ? null : new an(es)) == null) {
            throw Mn(_n(`Malformed assetID: "${ye}"`));
        }
        const ss = es;
        const ns = yn.ail(ss);
        if (ns == null) {
            throw Mn(_n(`Unknown coin (id = "${new an(ss)}")`));
        }
        return ns;
    } catch (error) {
        if (!(error instanceof Error)) {
            throw error;
        }
        pe = ks(Rs(error));
    }
    let ts;
    const rs = pe;
    if (Ms(rs)) {
        ts = null;
    } else {
        const os = $s(rs);
        ts = os == null || os != null ? os : bs();
    }
    return ts;
};
ae.$_$.j1 = function reduceAndAbbreviate(ae) {
    _init_properties_BigDecimalExt_kt__o0ll4y();
    let pe;
    const ye = [
        new zs(qs(75)),
        new zs(qs(77)),
        new zs(qs(66)),
        new zs(qs(84))
    ];
    const es = [
        get_THOUSAND(),
        get_MILLION(),
        get_BILLION(),
        get_TRILLION()
    ];
    const ss = ae.w8s();
    const ns = getDecimalPlacesCount(ae);
    const ts = ss.n3(Es(ns));
    if (ts.k1(new Ts(3, 0)) > 0) {
        const rs = js(ts.n3(Es(1)).p3(Es(3)).n3(Es(1)).p1(), Ns(ye));
        const os = ye[rs].c2_1;
        const as = es[rs];
        pe = removeTrailingZeroes(scale(scale(ae, new Ts(0, 0), As()).e8v(as, get_DECIMAL128(Ds())), new Ts(1, 0), As())).d8w() + Bs(os);
    } else {
        pe = removeTrailingZeroes(reduceScale(ae)).d8w();
    }
    return pe;
};
ae.$_$.k1 = reduceScale;
ae.$_$.l1 = removeTrailingZeroes;
ae.$_$.m1 = function replaceByOrAdd(ae, pe, ye) {
    let es;
    const ss = Dr(ae);
    e: {
        let ns = 0;
        for(const ts = ss.k(); ts.l();){
            if (ye(pe, ts.m())) {
                es = ns;
                break e;
            }
            ns = ns + 1 | 0;
        }
        es = -1;
    }
    const rs = es;
    if (rs >= 0) {
        ss.b1(rs, pe);
    } else {
        ss.e(pe);
    }
    return ss;
};
ae.$_$.n1 = scale;
ae.$_$.o1 = function stripStakingPrefix(ae) {
    return removePrefix(ae, "staking-");
};
ae.$_$.p1 = function supportsEip1559(ae) {
    return ae instanceof In && function supportsEip1559_0(ae) {
        switch(ae.e3_1){
            case 71:
            case 142:
            case 167:
            case 73:
            case 140:
            case 155:
            case 156:
            case 6:
            case 16:
            case 75:
            case 159:
            case 97:
            case 143:
            case 149:
            case 163:
            case 98:
            case 162:
            case 94:
            case 138:
            case 69:
            case 161:
            case 66:
            case 74:
            case 151:
            case 157:
            case 166:
                return true;
            default:
                return false;
        }
    }(ae.njr_1);
};
ae.$_$.q1 = function get_symbol(ae) {
    _init_properties_CoinTypeExt_kt__gprif8();
    return jn.aim(ae);
};
ae.$_$.r1 = function toAssetIdentifier(ae, pe) {
    pe = pe === Cs ? null : pe;
    const ye = sn();
    ye.i9(`c${new an(ae.bjm().pik())}`);
    if (ae instanceof dn) {
        ye.i9(`:${ae.sjr_1}`);
    }
    if (pe != null && Xs(pe) !== 0) {
        ye.i9(`_t${pe}`);
    }
    return ye.toString();
};
ae.$_$.s1 = toBigDecimalOrNull;
ae.$_$.t1 = function toBigDecimalOrZero(ae) {
    _init_properties_BigDecimalExt_kt__o0ll4y();
    const pe = toBigDecimalOrNull(ae);
    return pe ?? ys().c8t_1;
};
ae.$_$.u1 = toBigDecimal_0;
ae.$_$.v1 = toBigIntegerOrNull;
ae.$_$.w1 = function toBigIntegerOrZero(ae) {
    const pe = toBigIntegerOrNull(ae);
    return pe ?? Ps().n8s_1;
};
ae.$_$.x1 = function toDouble(ae) {
    let pe;
    _init_properties_BigDecimalExt_kt__o0ll4y();
    try {
        pe = ae.g8s();
    } catch (error) {
        if (!(error instanceof ps)) {
            throw error;
        }
        pe = ae.f8s(false);
    }
    return pe;
};
ae.$_$.y1 = toEip55;
ae.$_$.z1 = function BigDecimalSerializer_getInstance() {
    if (ln == null) {
        new BigDecimalSerializer;
    }
    return ln;
};
ae.$_$.a2 = function BigIntegerSerializer_getInstance() {
    if (wn == null) {
        new BigIntegerSerializer;
    }
    return wn;
};
ae.$_$.b2 = function Numbers_getInstance() {
    if (gn == null) {
        new Numbers;
    }
    return gn;
};
bn($getVaultCOROUTINE$0, kn);
bn($fetchVaultOverviewFromRemoteCOROUTINE$1, kn);
zn(AngleVaultOverviewCache, "AngleVaultOverviewCache", On, On, On, [
    2,
    3
]);
Ln(AngleVaultsBalanceService$getVaultsMap$slambda$slambda, kn, On, [
    1
]);
Ln(AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda, kn, On, [
    1
]);
Ln(AngleVaultsBalanceService$getVaultsMap$slambda, kn, On, [
    1
]);
Ln(AngleVaultsBalanceService$getUserVaultPositions$slambda, kn, On, [
    1
]);
bn($loadBalancesOrThrowCOROUTINE$3, kn);
zn(AngleVaultsBalanceService, "AngleVaultsBalanceService", On, On, On, [
    1
]);
ll(Companion);
vl($serializer, "$serializer", On, On, [
    hl
]);
zn(Payload, "Payload", On, On, On, On, On, {
    0: $serializer_getInstance
});
zn(PayloadCommonData, "PayloadCommonData");
ll(Companion_0);
vl($serializer_0, "$serializer", On, On, [
    hl
]);
zn(UserVaultPosition, "UserVaultPosition", On, On, On, On, On, {
    0: $serializer_getInstance_0
});
ll(Companion_1);
vl($serializer_1, "$serializer", On, On, [
    hl
]);
zn(AngleVault, "AngleVault", On, On, On, On, On, {
    0: $serializer_getInstance_1
});
vl($serializer_2, "$serializer", On, On, [
    hl
]);
zn(Token_1, "Token", On, On, On, On, On, {
    0: $serializer_getInstance_2
});
ll(Companion_2);
vl($serializer_3, "$serializer", On, On, [
    hl
]);
zn(Swap, "Swap", On, On, On, On, On, {
    0: $serializer_getInstance_3
});
vl($serializer_4, "$serializer", On, On, [
    hl
]);
zn(Strategy, "Strategy", On, On, On, On, On, {
    0: $serializer_getInstance_4
});
vl($serializer_5, "$serializer", On, On, [
    hl
]);
zn(Protocol, "Protocol", On, On, On, On, On, {
    0: $serializer_getInstance_5
});
vl($serializer_6, "$serializer", On, On, [
    hl
]);
zn(StrategyToken, "StrategyToken", On, On, On, On, On, {
    0: $serializer_getInstance_6
});
ll(Companion_3);
zn(AngleVaultsModule, "AngleVaultsModule");
ll(Companion_4);
bn($getUserVaultPositionCOROUTINE$4, kn);
bn($getVaultOverviewCOROUTINE$5, kn);
bn($httpClientGetPayloadCOROUTINE$6, kn);
zn(AngleVaultsRpcClient, "AngleVaultsRpcClient", On, tw, On, [
    5,
    2,
    1,
    3
]);
Ln(AngleVaultsService$fetchVaults$slambda$slambda, kn, On, [
    1
]);
Ln(AngleVaultsService$fetchPositions$slambda$slambda, kn, On, [
    1
]);
Ln(AngleVaultsService$getVaultOrThrow$slambda, kn, On, [
    1
]);
Ln(AngleVaultsService$getUserVaultPositionOrThrow$slambda, kn, On, [
    1
]);
Ln(AngleVaultsService$fetchVaults$slambda, kn, On, [
    1
]);
Ln(AngleVaultsService$fetchPositions$slambda, kn, On, [
    1
]);
bn($createVaultApprovalTransactionInputCOROUTINE$7, kn);
bn($getWithdrawAllowanceInputCOROUTINE$8, kn);
bn($getVaultPositionOrNullCOROUTINE$9, kn);
bn($getAssetAddressForVaultWithdrawOrThrowCOROUTINE$10, kn);
zn(VaultProviderService, "VaultProviderService", On, On, On, [
    1,
    2,
    6,
    3
]);
zn(AngleVaultsService, "AngleVaultsService", On, VaultProviderService, On, [
    1,
    2,
    6,
    3,
    4,
    0
]);
ll(Companion_5);
Ln(AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda, kn, On, [
    1
]);
Ln(AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda, kn, On, [
    1
]);
bn($toCommonDataCOROUTINE$11, kn);
zn(AngleVaultsTransactionBuilder, "AngleVaultsTransactionBuilder", On, On, On, [
    1,
    0
]);
zn(UnknownVaultProviderBalanceService, "UnknownVaultProviderBalanceService", UnknownVaultProviderBalanceService, On, On, [
    1
]);
zn(UnknownVaultProviderService, "UnknownVaultProviderService", UnknownVaultProviderService, VaultProviderService, On, [
    1,
    2,
    6,
    3
]);
zn(UnknownVaultProviderTransactionBuilder, "UnknownVaultProviderTransactionBuilder", UnknownVaultProviderTransactionBuilder, On, On, [
    1
]);
Ln(VaultsBalanceService$loadBalances$slambda$slambda, kn, On, [
    1
]);
Ln(VaultsBalanceService$loadBalances$slambda, kn, On, [
    1
]);
bn($isBalanceSupportedCOROUTINE$12, kn);
zn(VaultsBalanceService, "VaultsBalanceService", On, On, [
    bw
], [
    1,
    0,
    2
]);
zn(VaultsEnvironmentConfigurator, "VaultsEnvironmentConfigurator");
zn(VaultsError, "VaultsError", On, Error);
zn(AccessRestricted, "AccessRestricted", On, VaultsError);
zn(AllowanceCheckFailed, "AllowanceCheckFailed", On, VaultsError);
zn(CannotFetchBalance, "CannotFetchBalance", On, VaultsError);
zn(CannotFetchClaimPayload, "CannotFetchClaimPayload", On, VaultsError);
zn(CannotFetchDepositPayload, "CannotFetchDepositPayload", On, VaultsError);
zn(CannotFetchExclusiveRewards, "CannotFetchExclusiveRewards", On, VaultsError);
zn(CannotFetchVault, "CannotFetchVault", On, VaultsError);
zn(CannotFetchVaults, "CannotFetchVaults", On, VaultsError);
zn(CannotFetchWithdrawPayload, "CannotFetchWithdrawPayload", On, VaultsError);
zn(InvalidApprovalAmount, "InvalidApprovalAmount", On, VaultsError);
zn(ConfigUnavailable, "ConfigUnavailable", ConfigUnavailable, VaultsError);
zn(InvalidConfig, "InvalidConfig", InvalidConfig, VaultsError);
zn(InvalidFetchClaimPayloadResponse, "InvalidFetchClaimPayloadResponse", On, VaultsError);
zn(InvalidUserPositionResponse, "InvalidUserPositionResponse", On, VaultsError);
zn(RouterAddressNotFound, "RouterAddressNotFound", On, VaultsError);
zn(UnsupportedVaultProvider, "UnsupportedVaultProvider", On, VaultsError);
zn(UnknownChainId, "UnknownChainId", On, VaultsError);
zn(UnknownVaultProvider, "UnknownVaultProvider", UnknownVaultProvider, VaultsError);
zn(VaultAndAccountChainMismatch, "VaultAndAccountChainMismatch", On, VaultsError);
zn(VaultConfigNotFound, "VaultConfigNotFound", On, VaultsError);
zn(WithdrawNotSupported, "WithdrawNotSupported", On, VaultsError);
zn(OperatorAlreadyApproved, "OperatorAlreadyApproved", On, VaultsError);
ll(Companion_6);
vl($serializer_7, "$serializer", On, On, [
    hl
]);
zn(EthereumCall_0, "EthereumCall", On, On, On, On, On, {
    0: $serializer_getInstance_7
});
zn(VaultApprovalTransactionInput, "VaultApprovalTransactionInput");
zn(CheckAllowanceInput, "CheckAllowanceInput");
zn(TokenServiceProviderImpl, "TokenServiceProviderImpl", On, On, [
    Iw
], [
    1
]);
zn(VaultsModule, "VaultsModule");
ll(Companion_7);
bn($checkAllowanceCOROUTINE$13, kn);
zn(VaultsRpcClient, "VaultsRpcClient", On, tw, On, [
    3,
    5,
    1
]);
Ln(VaultsServiceImpl$getVaults$slambda$slambda, kn, On, [
    1
]);
Ln(VaultsServiceImpl$getVaults$slambda$slambda_1, kn, On, [
    1
]);
Ln(VaultsServiceImpl$getPositions$slambda$slambda, kn, On, [
    1
]);
Ln(VaultsServiceImpl$getVaults$slambda, kn, On, [
    1
]);
Ln(VaultsServiceImpl$getVaults$slambda_1, kn, On, [
    1
]);
Ln(VaultsServiceImpl$getPositions$slambda, kn, On, [
    1
]);
bn($doesAssetHaveBonusRewardsCOROUTINE$14, kn);
bn($createVaultApprovalTransactionCOROUTINE$15, kn);
bn($isAssetSupportedCOROUTINE$16, kn);
bn($checkAllowanceOrThrowCOROUTINE$17, kn);
bn($getDepositAllowanceCOROUTINE$18, kn);
bn($getWithdrawAllowanceCOROUTINE$19, kn);
bn($buildToggleDefaultOperatorTransactionOrThrowCOROUTINE$20, kn);
zn(VaultsServiceImpl, "VaultsServiceImpl", On, On, On, [
    0,
    1,
    5,
    2
]);
bn($getValidatorsCOROUTINE$21, kn);
bn($getDelegationsCOROUTINE$22, kn);
bn($getMinAmountCOROUTINE$23, kn);
zn(VaultsStakingService, "VaultsStakingService", On, On, [
    um,
    Iw
], [
    1
]);
bn($getDestinationAddressCOROUTINE$24, kn);
zn(VaultsToAddressProvider, "VaultsToAddressProvider", On, On, [
    hm
], [
    1,
    0
]);
bn($buildDepositSigningInputCOROUTINE$25, kn);
bn($buildWithdrawSigningInputCOROUTINE$26, kn);
bn($buildClaimSigningInputCOROUTINE$27, kn);
zn(VaultsTransactionBuilderImpl, "VaultsTransactionBuilderImpl", On, On, On, [
    1
]);
zn(OptimizedVaultsConfig, "OptimizedVaultsConfig");
zn(AssetAddressAndChainId, "AssetAddressAndChainId");
zn(BackoffState, "BackoffState", BackoffState);
ll(Companion_8);
bn($getOptimizedVaultsConfigOrThrowCOROUTINE$28, kn);
bn($loadWithFallbackCOROUTINE$29, kn);
zn(OptimizedVaultsConfigCache, "OptimizedVaultsConfigCache", On, xn, On, [
    0
]);
ll(Companion_9);
bn($loadConfigCOROUTINE$30, kn);
zn(VaultsConfigLoader, "VaultsConfigLoader", On, On, On, [
    0
]);
zn(RemoteVaultsConfigLoader, "RemoteVaultsConfigLoader", On, VaultsConfigLoader, On, [
    0
]);
bn($loadConfigAndApplyFiltersOrThrowCOROUTINE$31, kn);
Pm(VaultProvider, "VaultProvider", On, On, On, On, On, {
    0: VaultProviderSerializer_getInstance
});
vl(Kiln_0, "Kiln", On, On, [
    VaultProvider,
    Em
], On, On, {
    0: Kiln_getInstance
});
vl(Angle_0, "Angle", On, On, [
    VaultProvider,
    Em
], On, On, {
    0: Angle_getInstance
});
vl(Yield_0, "Yield", On, On, [
    VaultProvider,
    Em
], On, On, {
    0: Yield_getInstance
});
vl(Unknown, "Unknown", On, On, [
    VaultProvider,
    Em
], On, On, {
    0: Unknown_getInstance
});
ll(Companion_10, On, [
    Em
]);
ll(Companion_11);
vl($serializer_8, "$serializer", On, On, [
    hl
]);
zn(VaultsConfig, "VaultsConfig", On, On, On, On, On, {
    0: $serializer_getInstance_8
});
ll(Companion_12);
vl($serializer_9, "$serializer", On, On, [
    hl
]);
zn(VaultsConfigWithoutVersion, "VaultsConfigWithoutVersion", On, On, On, On, On, {
    0: $serializer_getInstance_9
});
vl($serializer_10, "$serializer", On, On, [
    hl
]);
zn(AngleRouter, "AngleRouter", On, On, On, On, On, {
    0: $serializer_getInstance_10
});
vl($serializer_11, "$serializer", On, On, [
    hl
]);
zn(Vault, "Vault", On, On, On, On, On, {
    0: $serializer_getInstance_11
});
Pm(VaultType, "VaultType", On, On, On, On, On, {
    0: VaultTypeSerializer_getInstance
});
vl(Normal_0, "Normal", On, On, [
    VaultType,
    Em
], On, On, {
    0: Normal_getInstance
});
vl(AutoSwap, "AutoSwap", On, On, [
    VaultType,
    Em
], On, On, {
    0: AutoSwap_getInstance
});
vl(ExclusiveRewards_2, "ExclusiveRewards", On, On, [
    VaultType,
    Em
], On, On, {
    0: ExclusiveRewards_getInstance
});
vl(Unknown_0, "Unknown", On, On, [
    VaultType,
    Em
], On, On, {
    0: Unknown_getInstance_0
});
ll(Companion_13, On, [
    Em
]);
zn(Rewards_1, "Rewards");
zn(ExclusiveRewards_3, "ExclusiveRewards");
vl(VaultProviderSerializer, "VaultProviderSerializer", On, On, [
    Nw
]);
vl(VaultTypeSerializer, "VaultTypeSerializer", On, On, [
    Nw
]);
ll(Companion_14);
zn(MerkleDistributorService, "MerkleDistributorService", On, On, On, [
    3
]);
ll(Companion_15);
zn(MerkleDistributorTransactionBuilder, "MerkleDistributorTransactionBuilder", MerkleDistributorTransactionBuilder, On, On, [
    3
]);
zn(MerkleModule, "MerkleModule");
ll(Companion_16);
Ln(MerkleRpcClient$isOperatorApproved$slambda, kn, On, [
    1
]);
zn(MerkleRpcClient, "MerkleRpcClient", On, tw, On, [
    3,
    5,
    1
]);
bn($getToAddressCOROUTINE$32, kn);
zn(KilnToAddressProvider, "KilnToAddressProvider", On, On, On, [
    1
]);
Ln(KilnVaultsBalanceService$fetchVaultStats$slambda$slambda, kn, On, [
    1
]);
Ln(KilnVaultsBalanceService$fetchUserPositions$slambda$slambda, kn, On, [
    1
]);
Ln(KilnVaultsBalanceService$fetchVaultStats$slambda, kn, On, [
    1
]);
Ln(KilnVaultsBalanceService$fetchUserPositions$slambda, kn, On, [
    1
]);
bn($loadBalancesOrThrowCOROUTINE$34, kn);
zn(KilnVaultsBalanceService, "KilnVaultsBalanceService", On, On, On, [
    1,
    2
]);
vl($serializer_12, "$serializer", On, On, [
    hl
]);
zn(CraftClaimMorphoRewards, "CraftClaimMorphoRewards", On, On, On, On, On, {
    0: $serializer_getInstance_12
});
ll(Companion_17);
vl($serializer_13, "$serializer", On, On, [
    hl
]);
zn(VaultStats, "VaultStats", On, On, On, On, On, {
    0: $serializer_getInstance_13
});
ll(Companion_18);
vl($serializer_14, "$serializer", On, On, [
    hl
]);
zn(Position, "Position", On, On, On, On, On, {
    0: $serializer_getInstance_14
});
ll(Companion_19);
vl($serializer_15, "$serializer", On, On, [
    hl
]);
zn(ExclusiveRewards_4, "ExclusiveRewards", On, On, On, On, On, {
    0: $serializer_getInstance_15
});
ll(Companion_20);
vl($serializer_16, "$serializer", On, On, [
    hl
]);
zn(VaultStatsResponse, "VaultStatsResponse", On, On, On, On, On, {
    0: $serializer_getInstance_16
});
ll(Companion_21);
vl($serializer_17, "$serializer", On, On, [
    hl
]);
zn(PositionsResponse, "PositionsResponse", On, On, On, On, On, {
    0: $serializer_getInstance_17
});
ll(Companion_22);
vl($serializer_18, "$serializer", On, On, [
    hl
]);
zn(ExclusiveRewardsResponse, "ExclusiveRewardsResponse", On, On, On, On, On, {
    0: $serializer_getInstance_18
});
ll(Companion_23);
vl($serializer_19, "$serializer", On, On, [
    hl
]);
zn(CraftClaimMorphoRewardsResponse, "CraftClaimMorphoRewardsResponse", On, On, On, On, On, {
    0: $serializer_getInstance_19
});
vl($serializer_20, "$serializer", On, On, [
    hl
]);
zn(AdditionalRewards, "AdditionalRewards", On, On, On, On, On, {
    0: $serializer_getInstance_20
});
ll(Companion_24);
zn(KilnVaultsModule, "KilnVaultsModule");
ll(Companion_25);
bn($balanceOfSharesCOROUTINE$35, kn);
bn($positionsCOROUTINE$36, kn);
bn($vaultsCOROUTINE$37, kn);
bn($morphoExtraRewardsCOROUTINE$38, kn);
bn($craftClaimMorphoRewardsCOROUTINE$39, kn);
zn(KilnVaultsRpcClient, "KilnVaultsRpcClient", On, tw, On, [
    2,
    1,
    5,
    3
]);
Ln(KilnVaultsService$getPositions$slambda$slambda, kn, On, [
    1
]);
Ln(KilnVaultsService$getPositions$slambda$slambda_1, kn, On, [
    1
]);
ll(Companion_26);
Ln(KilnVaultsService$getPositions$slambda, kn, On, [
    1
]);
Ln(KilnVaultsService$isDeviceRestricted$slambda, kn, On, [
    1
]);
Ln(KilnVaultsService$getVaults$slambda, kn, On, [
    1
]);
Ln(KilnVaultsService$getPositions$slambda_1, kn, On, [
    1
]);
bn($fetchVaultsCOROUTINE$40, kn);
zn(KilnVaultsService, "KilnVaultsService", On, VaultProviderService, On, [
    1,
    2,
    6,
    3,
    0
]);
ll(Companion_27);
bn($buildWithdrawSigningInputCOROUTINE$41, kn);
bn($buildClaimSigningInputCOROUTINE$42, kn);
zn(KilnVaultsTransactionBuilder, "KilnVaultsTransactionBuilder", On, On, On, [
    1
]);
bn($getCraftClaimMorphoRewardsResponseCOROUTINE$43, kn);
bn($getCraftClaimMorphoRewardsResponseFromRemoteCOROUTINE$44, kn);
zn(KilnCraftMorphoClaimResponseCache, "KilnCraftMorphoClaimResponseCache", On, On, On, [
    1
]);
bn($getExclusiveRewardsCOROUTINE$45, kn);
bn($fetchExclusiveRewardsFromRemoteCOROUTINE$46, kn);
zn(KilnExclusiveRewardsCache, "KilnExclusiveRewardsCache", On, On, On, [
    2
]);
Ln(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda, kn, On, [
    1
]);
Ln(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_1, kn, On, [
    1
]);
ll(Companion_28);
Ln(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda, kn, On, [
    1
]);
bn($getPositionsCOROUTINE$47, kn);
zn(KilnVaultsPositionsCache, "KilnVaultsPositionsCache", On, On, On, [
    2
]);
bn($getVaultsStatsCOROUTINE$49, kn);
bn($fetchVaultsStatsFromRemoteCOROUTINE$50, kn);
zn(KilnVaultsStatsCache, "KilnVaultsStatsCache", On, On, On, [
    1
]);
zn(YieldVaultProviderService, "YieldVaultProviderService", YieldVaultProviderService, VaultProviderService, On, [
    1,
    2,
    6,
    3
]);
$n($getVaultCOROUTINE$0).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 7;
                    this.t145_1 = vaultKey(this.q145_1, this.r145_1, this.s145_1);
                    const pe = getVaultOverviewFromLocalCache(this.q145_1, this.t145_1);
                    if (pe != null) {
                        return pe;
                    }
                    this.u145_1 = this.q145_1.p144_1;
                    this.v145_1 = this.u145_1;
                    this.w145_1 = null;
                    this.na_1 = 1;
                    if ((pa_1 = this.v145_1.w35(this.w145_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.x145_1 = fn;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    this.oa_1 = 6;
                    this.y145_1 = getVaultOverviewFromLocalCache(this.q145_1, this.t145_1);
                    if (this.y145_1 == null) {
                        this.na_1 = 3;
                        if ((pa_1 = fetchVaultOverviewFromRemote(this.q145_1, this.t145_1, this.r145_1, this.s145_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.z145_1 = this.y145_1;
                    this.na_1 = 4;
                    continue e;
                case 3:
                    this.z145_1 = pa_1;
                    this.na_1 = 4;
                    continue e;
                case 4:
                    this.x145_1 = this.z145_1;
                    this.oa_1 = 7;
                    this.na_1 = 5;
                    continue e;
                case 5:
                    const ye = this.x145_1;
                    this.oa_1 = 7;
                    this.v145_1.x35(this.w145_1);
                    return ye;
                case 6:
                    this.oa_1 = 7;
                    const es = this.qa_1;
                    this.v145_1.x35(this.w145_1);
                    throw es;
                case 7:
                    throw this.qa_1;
            }
        } catch (error) {
            const ss = error;
            if (this.oa_1 === 7) {
                throw ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ss;
        }
    }
};
$n($fetchVaultOverviewFromRemoteCOROUTINE$1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.c145_1 = this.y144_1;
                    this.d145_1 = this.c145_1;
                    this.oa_1 = 2;
                    this.f145_1 = Mn;
                    this.g145_1 = this.d145_1;
                    this.h145_1 = this.g145_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.h145_1.n144_1.f146(this.a145_1, this.b145_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.h145_1.o144_1.aiq(this.z144_1, pe);
                    this.f145_1;
                    this.e145_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.e145_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const es = this.e145_1;
                    if (An(es) != null) {
                        throw new CannotFetchVault(this.b145_1);
                    }
                    const ss = Cn(es);
                    if (ss == null || ss != null) {
                        return ss;
                    }
                    return Tn();
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 3) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(AngleVaultOverviewCache).g146 = function(ae, pe, ye) {
    const es = new $getVaultCOROUTINE$0(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda$slambda).z146 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda$slambda).hb = function(ae, pe) {
    return this.z146(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.s146_1 = this.r146_1;
                    this.t146_1 = this.s146_1;
                    this.oa_1 = 2;
                    this.v146_1 = Mn;
                    this.w146_1 = this.t146_1;
                    this.x146_1 = this.w146_1;
                    this.y146_1 = this.p146_1.c147_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.q146_1.m147_1.r147(this.p146_1.b147_1, this.p146_1.c147_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    const ye = Dn(this.y146_1, pe);
                    this.v146_1;
                    this.u146_1 = yn(ye);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const es = this.qa_1;
                        this.u146_1 = yn(Sn(es));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let ss;
                    const ns = this.u146_1;
                    if (Bn(ns)) {
                        ss = null;
                    } else {
                        const ts = Cn(ns);
                        ss = ts == null || ts != null ? ts : Tn();
                    }
                    return ss;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsBalanceService$getVaultsMap$slambda$slambda(this.p146_1, this.q146_1, pe);
    ye.r146_1 = ae;
    return ye;
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda).j148 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda).hb = function(ae, pe) {
    return this.j148(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.d148_1 = this.c148_1;
                    this.e148_1 = this.d148_1;
                    this.oa_1 = 2;
                    this.g148_1 = Mn;
                    this.h148_1 = this.e148_1;
                    this.i148_1 = this.h148_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.a148_1.m147_1.k148(this.b148_1.vjo(), On, On, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.g148_1;
                    this.f148_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.f148_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.f148_1;
                    const ns = Un();
                    s: do {
                        if (Bn(ss)) {
                            es = ns;
                            break s;
                        }
                        const ts = Cn(ss);
                        es = ts == null || ts != null ? ts : Tn();
                    }while (0)
                    return es;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda(this.a148_1, this.b148_1, pe);
    ye.c148_1 = ae;
    return ye;
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda).c14a = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda).hb = function(ae, pe) {
    return this.c14a(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.r149_1 = this.o149_1;
                    this.s149_1 = this.r149_1;
                    this.t149_1 = this.s149_1;
                    this.u149_1 = Xn(this.s149_1.o());
                    this.v149_1 = this.t149_1;
                    this.w149_1 = this.u149_1;
                    this.x149_1 = this.v149_1.d1().k();
                    this.na_1 = 1;
                    continue e;
                case 1:
                    if (!this.x149_1.l()) {
                        this.na_1 = 3;
                        continue e;
                    }
                    this.y149_1 = this.x149_1.m();
                    this.z149_1 = this.y149_1;
                    this.a14a_1 = this.z149_1;
                    this.b14a_1 = this.a14a_1.f1();
                    this.na_1 = 2;
                    const pe = this.b14a_1;
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.q149_1, On, On, AngleVaultsBalanceService$getVaultsMap$slambda$slambda_0(ss, this.p149_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const ns = Ht(pa_1);
                    this.w149_1.e(ns);
                    this.na_1 = 1;
                    continue e;
                case 3:
                    const ts = this.w149_1;
                    return Mr(Jt(ts));
                case 4:
                    throw this.qa_1;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 4) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(AngleVaultsBalanceService$getVaultsMap$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsBalanceService$getVaultsMap$slambda(this.o149_1, this.p149_1, pe);
    ye.q149_1 = ae;
    return ye;
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda).j148 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda).hb = function(ae, pe) {
    return this.j148(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    const pe = this.l14a_1;
                    const ye = Jn();
                    for(const es = pe.k(); es.l();){
                        let ss;
                        const ns = es.m();
                        const ts = ns.xjo().nil();
                        const rs = ye.x2(ts);
                        if (rs == null) {
                            const os = Zn();
                            ye.a3(ts, os);
                            ss = os;
                        } else {
                            ss = rs;
                        }
                        ss.e(ns);
                    }
                    this.o14a_1 = ye;
                    this.p14a_1 = this.o14a_1;
                    this.q14a_1 = this.p14a_1;
                    this.r14a_1 = Zn();
                    this.s14a_1 = this.q14a_1;
                    this.t14a_1 = this.r14a_1;
                    this.u14a_1 = this.s14a_1.d1().k();
                    this.na_1 = 1;
                    continue e;
                case 1:
                    if (!this.u14a_1.l()) {
                        this.na_1 = 3;
                        continue e;
                    }
                    this.v14a_1 = this.u14a_1.m();
                    this.w14a_1 = this.v14a_1;
                    this.x14a_1 = this.w14a_1;
                    this.y14a_1 = this.x14a_1.f1();
                    this.na_1 = 2;
                    const as = this.y14a_1;
                    const cs = Dr();
                    const us = Zn();
                    for(const ls = as.k(); ls.l();){
                        const ms = ls.m();
                        const gs = ms.vjo().hjo_1;
                        if (cs.e(gs)) {
                            us.e(ms);
                        }
                    }
                    const ds = Xn(Kn(us, 10));
                    for(const _s = us.k(); _s.l();){
                        const hs = _s.m();
                        ds.e(Gt(this.n14a_1, On, On, AngleVaultsBalanceService$getUserVaultPositions$slambda$slambda_0(this.m14a_1, hs, null)));
                    }
                    if ((pa_1 = Vt(ds, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const vs = Jt(pa_1);
                    Kr(this.t14a_1, vs);
                    this.na_1 = 1;
                    continue e;
                case 3:
                    return this.t14a_1;
                case 4:
                    throw this.qa_1;
            }
        } catch (error) {
            const ps = error;
            if (this.oa_1 === 4) {
                throw ps;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ps;
        }
    }
};
$n(AngleVaultsBalanceService$getUserVaultPositions$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsBalanceService$getUserVaultPositions$slambda(this.l14a_1, this.m14a_1, pe);
    ye.n14a_1 = ae;
    return ye;
};
$n($loadBalancesOrThrowCOROUTINE$3).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    if (this.i14b_1.u()) {
                        return Un();
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.h14b_1.n147_1.u14b(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.j14b_1 = pa_1;
                    this.k14b_1 = mapAssetsToVaults(this.h14b_1, this.i14b_1, this.j14b_1);
                    this.na_1 = 2;
                    if ((pa_1 = getVaultsMap(this.h14b_1, this.k14b_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.l14b_1 = pa_1;
                    if (this.l14b_1.u()) {
                        return Un();
                    }
                    this.na_1 = 3;
                    if ((pa_1 = getUserVaultPositions(this.h14b_1, this.i14b_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    const pe = pa_1;
                    return buildBalanceResults(this.h14b_1, this.i14b_1, this.l14b_1, pe);
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
$n(AngleVaultsBalanceService).v14b = function(ae, pe) {
    const ye = new $loadBalancesOrThrowCOROUTINE$3(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n($serializer).f14c = function(ae, pe) {
    const e14c_1 = this.e14c_1;
    const es = ae.w3r(e14c_1);
    const d14c_1 = Companion_getInstance_4().d14c_1;
    es.k3t(e14c_1, 0, pe.g14c_1);
    es.c3t(e14c_1, 1, pe.h14c_1);
    es.m3t(e14c_1, 2, d14c_1[2].f1(), pe.i14c_1);
    es.n3t(e14c_1, 3, $serializer_getInstance_3(), pe.j14c_1);
    es.k3t(e14c_1, 4, pe.k14c_1);
    es.k3t(e14c_1, 5, pe.l14c_1);
    es.x3r(e14c_1);
};
$n($serializer).v3o = function(ae, pe) {
    return this.f14c(ae, pe instanceof Payload ? pe : Tn());
};
$n($serializer).w3o = function(ae) {
    const e14c_1 = this.e14c_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = false;
    let rs = null;
    let os = null;
    let as = null;
    let cs = null;
    const us = ae.w3r(e14c_1);
    const d14c_1 = Companion_getInstance_4().d14c_1;
    if (us.l3s()) {
        ns = us.g3s(e14c_1, 0);
        ss |= 1;
        ts = us.y3r(e14c_1, 1);
        ss |= 2;
        rs = us.i3s(e14c_1, 2, d14c_1[2].f1(), rs);
        ss |= 4;
        os = us.k3s(e14c_1, 3, $serializer_getInstance_3(), os);
        ss |= 8;
        as = us.g3s(e14c_1, 4);
        ss |= 16;
        cs = us.g3s(e14c_1, 5);
        ss |= 32;
    } else {
        while(ye){
            switch(es = us.m3s(e14c_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = us.g3s(e14c_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = us.y3r(e14c_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = us.i3s(e14c_1, 2, d14c_1[2].f1(), rs);
                    ss |= 4;
                    break;
                case 3:
                    os = us.k3s(e14c_1, 3, $serializer_getInstance_3(), os);
                    ss |= 8;
                    break;
                case 4:
                    as = us.g3s(e14c_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = us.g3s(e14c_1, 5);
                    ss |= 32;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    us.x3r(e14c_1);
    return function Payload_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs) {
        return function Payload_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os) {
            if (63 & ~ae) {
                pl(ae, 63, $serializer_getInstance().e14c_1);
            }
            os.g14c_1 = pe;
            os.h14c_1 = ye;
            os.i14c_1 = es;
            os.j14c_1 = ss;
            os.k14c_1 = ns;
            os.l14c_1 = ts;
            return os;
        }(ae, pe, ye, es, ss, ns, ts, 0, fl($n(Payload)));
    }(ss, ns, ts, rs, os, as, cs);
};
$n($serializer).i3o = function() {
    return this.e14c_1;
};
$n($serializer).z3z = function() {
    const d14c_1 = Companion_getInstance_4().d14c_1;
    return [
        ol(),
        gl(),
        d14c_1[2].f1(),
        dl($serializer_getInstance_3()),
        ol(),
        ol()
    ];
};
$n(Payload).toString = function() {
    return `Payload(data=${this.g14c_1}, success=${this.h14c_1}, summary=${kl(this.i14c_1)}, swap=${Rl(this.j14c_1)}, to=${this.k14c_1}, value=${this.l14c_1})`;
};
$n(Payload).hashCode = function() {
    let ae = $l(this.g14c_1);
    ae = pn(ae, 31) + bl(this.h14c_1) | 0;
    ae = pn(ae, 31) + Ml(this.i14c_1) | 0;
    ae = pn(ae, 31) + (this.j14c_1 == null ? 0 : this.j14c_1.hashCode()) | 0;
    ae = pn(ae, 31) + $l(this.k14c_1) | 0;
    return ae = pn(ae, 31) + $l(this.l14c_1) | 0;
};
$n(Payload).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Payload)) {
        return false;
    }
    const pe = ae instanceof Payload ? ae : Tn();
    return this.g14c_1 === pe.g14c_1 && this.h14c_1 === pe.h14c_1 && !!yl(this.i14c_1, pe.i14c_1) && !!yl(this.j14c_1, pe.j14c_1) && this.k14c_1 === pe.k14c_1 && this.l14c_1 === pe.l14c_1;
};
$n(PayloadCommonData).hashCode = function() {
    let ae = this.m14c_1.hashCode();
    ae = pn(ae, 31) + Ml(this.n14c_1) | 0;
    ae = pn(ae, 31) + $l(this.o14c_1) | 0;
    ae = pn(ae, 31) + this.p14c_1.hashCode() | 0;
    ae = pn(ae, 31) + $l(this.q14c_1) | 0;
    ae = pn(ae, 31) + $l(this.r14c_1) | 0;
    return ae = pn(ae, 31) + this.s14c_1.hashCode() | 0;
};
$n(PayloadCommonData).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof PayloadCommonData)) {
        return false;
    }
    const pe = ae instanceof PayloadCommonData ? ae : Tn();
    return !!this.m14c_1.equals(pe.m14c_1) && !!yl(this.n14c_1, pe.n14c_1) && this.o14c_1 === pe.o14c_1 && !!this.p14c_1.equals(pe.p14c_1) && this.q14c_1 === pe.q14c_1 && this.r14c_1 === pe.r14c_1 && !!this.s14c_1.equals(pe.s14c_1);
};
$n($serializer_0).u14c = function(ae, pe) {
    const t14c_1 = this.t14c_1;
    const es = ae.w3r(t14c_1);
    es.k3t(t14c_1, 0, pe.q148_1);
    es.k3t(t14c_1, 1, pe.r148_1);
    es.k3t(t14c_1, 2, pe.s148_1);
    es.m3t(t14c_1, 3, Sl(), pe.t148_1);
    es.m3t(t14c_1, 4, Sl(), pe.u148_1);
    es.m3t(t14c_1, 5, Sl(), pe.v148_1);
    es.m3t(t14c_1, 6, Sl(), pe.w148_1);
    es.m3t(t14c_1, 7, Sl(), pe.x148_1);
    es.x3r(t14c_1);
};
$n($serializer_0).v3o = function(ae, pe) {
    return this.u14c(ae, pe instanceof UserVaultPosition ? pe : Tn());
};
$n($serializer_0).w3o = function(ae) {
    const t14c_1 = this.t14c_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    let as = null;
    let cs = null;
    let us = null;
    let ls = null;
    const ms = ae.w3r(t14c_1);
    if (ms.l3s()) {
        ns = ms.g3s(t14c_1, 0);
        ss |= 1;
        ts = ms.g3s(t14c_1, 1);
        ss |= 2;
        rs = ms.g3s(t14c_1, 2);
        ss |= 4;
        os = ms.i3s(t14c_1, 3, Sl(), os);
        ss |= 8;
        as = ms.i3s(t14c_1, 4, Sl(), as);
        ss |= 16;
        cs = ms.i3s(t14c_1, 5, Sl(), cs);
        ss |= 32;
        us = ms.i3s(t14c_1, 6, Sl(), us);
        ss |= 64;
        ls = ms.i3s(t14c_1, 7, Sl(), ls);
        ss |= 128;
    } else {
        while(ye){
            switch(es = ms.m3s(t14c_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ms.g3s(t14c_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = ms.g3s(t14c_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = ms.g3s(t14c_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = ms.i3s(t14c_1, 3, Sl(), os);
                    ss |= 8;
                    break;
                case 4:
                    as = ms.i3s(t14c_1, 4, Sl(), as);
                    ss |= 16;
                    break;
                case 5:
                    cs = ms.i3s(t14c_1, 5, Sl(), cs);
                    ss |= 32;
                    break;
                case 6:
                    us = ms.i3s(t14c_1, 6, Sl(), us);
                    ss |= 64;
                    break;
                case 7:
                    ls = ms.i3s(t14c_1, 7, Sl(), ls);
                    ss |= 128;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ms.x3r(t14c_1);
    return function UserVaultPosition_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as) {
        return function UserVaultPosition_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs) {
            if (255 & ~ae) {
                pl(ae, 255, $serializer_getInstance_0().t14c_1);
            }
            cs.q148_1 = pe;
            cs.r148_1 = ye;
            cs.s148_1 = es;
            cs.t148_1 = ss;
            cs.u148_1 = ns;
            cs.v148_1 = ts;
            cs.w148_1 = rs;
            cs.x148_1 = os;
            return cs;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, 0, fl($n(UserVaultPosition)));
    }(ss, ns, ts, rs, os, as, cs, us, ls);
};
$n($serializer_0).i3o = function() {
    return this.t14c_1;
};
$n($serializer_0).z3z = function() {
    return [
        ol(),
        ol(),
        ol(),
        Sl(),
        Sl(),
        Sl(),
        Sl(),
        Sl()
    ];
};
$n(UserVaultPosition).toString = function() {
    return `UserVaultPosition(address=${this.q148_1}, chainId=${this.r148_1}, strategyAddress=${this.s148_1}, totalDeposit=${this.t148_1.toString()}, totalWithdraw=${this.u148_1.toString()}, cumulatedProfits=${this.v148_1.toString()}, currentShares=${this.w148_1.toString()}, currentProfits=${this.x148_1.toString()})`;
};
$n(UserVaultPosition).hashCode = function() {
    let ae = $l(this.q148_1);
    ae = pn(ae, 31) + $l(this.r148_1) | 0;
    ae = pn(ae, 31) + $l(this.s148_1) | 0;
    ae = pn(ae, 31) + this.t148_1.hashCode() | 0;
    ae = pn(ae, 31) + this.u148_1.hashCode() | 0;
    ae = pn(ae, 31) + this.v148_1.hashCode() | 0;
    ae = pn(ae, 31) + this.w148_1.hashCode() | 0;
    return ae = pn(ae, 31) + this.x148_1.hashCode() | 0;
};
$n(UserVaultPosition).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof UserVaultPosition)) {
        return false;
    }
    const pe = ae instanceof UserVaultPosition ? ae : Tn();
    return this.q148_1 === pe.q148_1 && this.r148_1 === pe.r148_1 && this.s148_1 === pe.s148_1 && !!this.t148_1.equals(pe.t148_1) && !!this.u148_1.equals(pe.u148_1) && !!this.v148_1.equals(pe.v148_1) && !!this.w148_1.equals(pe.w148_1) && !!this.x148_1.equals(pe.x148_1);
};
$n($serializer_1).w14c = function(ae, pe) {
    const v14c_1 = this.v14c_1;
    const es = ae.w3r(v14c_1);
    es.m3t(v14c_1, 0, $serializer_getInstance_2(), pe.y148_1);
    es.k3t(v14c_1, 1, pe.z148_1);
    es.m3t(v14c_1, 2, Sl(), pe.a149_1);
    es.k3t(v14c_1, 3, pe.b149_1);
    es.k3t(v14c_1, 4, pe.c149_1);
    es.g3t(v14c_1, 5, pe.d149_1);
    es.g3t(v14c_1, 6, pe.e149_1);
    es.m3t(v14c_1, 7, $serializer_getInstance_4(), pe.f149_1);
    es.x3r(v14c_1);
};
$n($serializer_1).v3o = function(ae, pe) {
    return this.w14c(ae, pe instanceof AngleVault ? pe : Tn());
};
$n($serializer_1).w3o = function(ae) {
    const v14c_1 = this.v14c_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    let as = null;
    let cs = new Al(0, 0);
    let us = new Al(0, 0);
    let ls = null;
    const ms = ae.w3r(v14c_1);
    if (ms.l3s()) {
        ns = ms.i3s(v14c_1, 0, $serializer_getInstance_2(), ns);
        ss |= 1;
        ts = ms.g3s(v14c_1, 1);
        ss |= 2;
        rs = ms.i3s(v14c_1, 2, Sl(), rs);
        ss |= 4;
        os = ms.g3s(v14c_1, 3);
        ss |= 8;
        as = ms.g3s(v14c_1, 4);
        ss |= 16;
        cs = ms.c3s(v14c_1, 5);
        ss |= 32;
        us = ms.c3s(v14c_1, 6);
        ss |= 64;
        ls = ms.i3s(v14c_1, 7, $serializer_getInstance_4(), ls);
        ss |= 128;
    } else {
        while(ye){
            switch(es = ms.m3s(v14c_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ms.i3s(v14c_1, 0, $serializer_getInstance_2(), ns);
                    ss |= 1;
                    break;
                case 1:
                    ts = ms.g3s(v14c_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = ms.i3s(v14c_1, 2, Sl(), rs);
                    ss |= 4;
                    break;
                case 3:
                    os = ms.g3s(v14c_1, 3);
                    ss |= 8;
                    break;
                case 4:
                    as = ms.g3s(v14c_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = ms.c3s(v14c_1, 5);
                    ss |= 32;
                    break;
                case 6:
                    us = ms.c3s(v14c_1, 6);
                    ss |= 64;
                    break;
                case 7:
                    ls = ms.i3s(v14c_1, 7, $serializer_getInstance_4(), ls);
                    ss |= 128;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ms.x3r(v14c_1);
    return function AngleVault_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as) {
        return function AngleVault_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs) {
            if (255 & ~ae) {
                pl(ae, 255, $serializer_getInstance_1().v14c_1);
            }
            cs.y148_1 = pe;
            cs.z148_1 = ye;
            cs.a149_1 = es;
            cs.b149_1 = ss;
            cs.c149_1 = ns;
            cs.d149_1 = ts;
            cs.e149_1 = rs;
            cs.f149_1 = os;
            return cs;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, 0, fl($n(AngleVault)));
    }(ss, ns, ts, rs, os, as, cs, us, ls);
};
$n($serializer_1).i3o = function() {
    return this.v14c_1;
};
$n($serializer_1).z3z = function() {
    return [
        $serializer_getInstance_2(),
        ol(),
        Sl(),
        ol(),
        ol(),
        Cl(),
        Cl(),
        $serializer_getInstance_4()
    ];
};
$n(AngleVault).hashCode = function() {
    let ae = this.y148_1.hashCode();
    ae = pn(ae, 31) + $l(this.z148_1) | 0;
    ae = pn(ae, 31) + this.a149_1.hashCode() | 0;
    ae = pn(ae, 31) + $l(this.b149_1) | 0;
    ae = pn(ae, 31) + $l(this.c149_1) | 0;
    ae = pn(ae, 31) + this.d149_1.hashCode() | 0;
    ae = pn(ae, 31) + this.e149_1.hashCode() | 0;
    return ae = pn(ae, 31) + this.f149_1.hashCode() | 0;
};
$n(AngleVault).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof AngleVault)) {
        return false;
    }
    const pe = ae instanceof AngleVault ? ae : Tn();
    return !!this.y148_1.equals(pe.y148_1) && this.z148_1 === pe.z148_1 && !!this.a149_1.equals(pe.a149_1) && this.b149_1 === pe.b149_1 && this.c149_1 === pe.c149_1 && !!this.d149_1.equals(pe.d149_1) && !!this.e149_1.equals(pe.e149_1) && !!this.f149_1.equals(pe.f149_1);
};
$n($serializer_2).y14c = function(ae, pe) {
    const x14c_1 = this.x14c_1;
    const es = ae.w3r(x14c_1);
    es.k3t(x14c_1, 0, pe.w14b_1);
    es.k3t(x14c_1, 1, pe.x14b_1);
    es.f3t(x14c_1, 2, pe.y14b_1);
    es.x3r(x14c_1);
};
$n($serializer_2).v3o = function(ae, pe) {
    return this.y14c(ae, pe instanceof Token_1 ? pe : Tn());
};
$n($serializer_2).w3o = function(ae) {
    const x14c_1 = this.x14c_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = 0;
    const os = ae.w3r(x14c_1);
    if (os.l3s()) {
        ns = os.g3s(x14c_1, 0);
        ss |= 1;
        ts = os.g3s(x14c_1, 1);
        ss |= 2;
        rs = os.b3s(x14c_1, 2);
        ss |= 4;
    } else {
        while(ye){
            switch(es = os.m3s(x14c_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = os.g3s(x14c_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = os.g3s(x14c_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = os.b3s(x14c_1, 2);
                    ss |= 4;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    os.x3r(x14c_1);
    return function Token_init_$Create$(ae, pe, ye, es, ss) {
        return function Token_init_$Init$(ae, pe, ye, es, ss, ns) {
            if (7 & ~ae) {
                pl(ae, 7, $serializer_getInstance_2().x14c_1);
            }
            ns.w14b_1 = pe;
            ns.x14b_1 = ye;
            ns.y14b_1 = es;
            return ns;
        }(ae, pe, ye, es, 0, fl($n(Token_1)));
    }(ss, ns, ts, rs);
};
$n($serializer_2).i3o = function() {
    return this.x14c_1;
};
$n($serializer_2).z3z = function() {
    return [
        ol(),
        ol(),
        Tl()
    ];
};
$n(Token_1).toString = function() {
    return `Token(address=${this.w14b_1}, symbol=${this.x14b_1}, decimals=${this.y14b_1})`;
};
$n(Token_1).hashCode = function() {
    let ae = $l(this.w14b_1);
    ae = pn(ae, 31) + $l(this.x14b_1) | 0;
    return ae = pn(ae, 31) + this.y14b_1 | 0;
};
$n(Token_1).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Token_1)) {
        return false;
    }
    const pe = ae instanceof Token_1 ? ae : Tn();
    return this.w14b_1 === pe.w14b_1 && this.x14b_1 === pe.x14b_1 && this.y14b_1 === pe.y14b_1;
};
$n($serializer_3).b14d = function(ae, pe) {
    const a14d_1 = this.a14d_1;
    const es = ae.w3r(a14d_1);
    const z14c_1 = Companion_getInstance_7().z14c_1;
    es.k3t(a14d_1, 0, pe.c14d_1);
    es.k3t(a14d_1, 1, pe.d14d_1);
    es.k3t(a14d_1, 2, pe.e14d_1);
    es.k3t(a14d_1, 3, pe.f14d_1);
    es.k3t(a14d_1, 4, pe.g14d_1);
    es.k3t(a14d_1, 5, pe.h14d_1);
    es.k3t(a14d_1, 6, pe.i14d_1);
    es.k3t(a14d_1, 7, pe.j14d_1);
    es.m3t(a14d_1, 8, z14c_1[8].f1(), pe.k14d_1);
    es.f3t(a14d_1, 9, pe.l14d_1);
    es.x3r(a14d_1);
};
$n($serializer_3).v3o = function(ae, pe) {
    return this.b14d(ae, pe instanceof Swap ? pe : Tn());
};
$n($serializer_3).w3o = function(ae) {
    const a14d_1 = this.a14d_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    let as = null;
    let cs = null;
    let us = null;
    let ls = null;
    let ms = null;
    let gs = 0;
    const ds = ae.w3r(a14d_1);
    const z14c_1 = Companion_getInstance_7().z14c_1;
    if (ds.l3s()) {
        ns = ds.g3s(a14d_1, 0);
        ss |= 1;
        ts = ds.g3s(a14d_1, 1);
        ss |= 2;
        rs = ds.g3s(a14d_1, 2);
        ss |= 4;
        os = ds.g3s(a14d_1, 3);
        ss |= 8;
        as = ds.g3s(a14d_1, 4);
        ss |= 16;
        cs = ds.g3s(a14d_1, 5);
        ss |= 32;
        us = ds.g3s(a14d_1, 6);
        ss |= 64;
        ls = ds.g3s(a14d_1, 7);
        ss |= 128;
        ms = ds.i3s(a14d_1, 8, z14c_1[8].f1(), ms);
        ss |= 256;
        gs = ds.b3s(a14d_1, 9);
        ss |= 512;
    } else {
        while(ye){
            switch(es = ds.m3s(a14d_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ds.g3s(a14d_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = ds.g3s(a14d_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = ds.g3s(a14d_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = ds.g3s(a14d_1, 3);
                    ss |= 8;
                    break;
                case 4:
                    as = ds.g3s(a14d_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = ds.g3s(a14d_1, 5);
                    ss |= 32;
                    break;
                case 6:
                    us = ds.g3s(a14d_1, 6);
                    ss |= 64;
                    break;
                case 7:
                    ls = ds.g3s(a14d_1, 7);
                    ss |= 128;
                    break;
                case 8:
                    ms = ds.i3s(a14d_1, 8, z14c_1[8].f1(), ms);
                    ss |= 256;
                    break;
                case 9:
                    gs = ds.b3s(a14d_1, 9);
                    ss |= 512;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ds.x3r(a14d_1);
    return function Swap_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us) {
        return function Swap_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us, ls) {
            if (1023 & ~ae) {
                pl(ae, 1023, $serializer_getInstance_3().a14d_1);
            }
            ls.c14d_1 = pe;
            ls.d14d_1 = ye;
            ls.e14d_1 = es;
            ls.f14d_1 = ss;
            ls.g14d_1 = ns;
            ls.h14d_1 = ts;
            ls.i14d_1 = rs;
            ls.j14d_1 = os;
            ls.k14d_1 = as;
            ls.l14d_1 = cs;
            return ls;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, 0, fl($n(Swap)));
    }(ss, ns, ts, rs, os, as, cs, us, ls, ms, gs);
};
$n($serializer_3).i3o = function() {
    return this.a14d_1;
};
$n($serializer_3).z3z = function() {
    const z14c_1 = Companion_getInstance_7().z14c_1;
    return [
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        z14c_1[8].f1(),
        Tl()
    ];
};
$n(Swap).hashCode = function() {
    let ae = $l(this.c14d_1);
    ae = pn(ae, 31) + $l(this.d14d_1) | 0;
    ae = pn(ae, 31) + $l(this.e14d_1) | 0;
    ae = pn(ae, 31) + $l(this.f14d_1) | 0;
    ae = pn(ae, 31) + $l(this.g14d_1) | 0;
    ae = pn(ae, 31) + $l(this.h14d_1) | 0;
    ae = pn(ae, 31) + $l(this.i14d_1) | 0;
    ae = pn(ae, 31) + $l(this.j14d_1) | 0;
    ae = pn(ae, 31) + Ml(this.k14d_1) | 0;
    return ae = pn(ae, 31) + this.l14d_1 | 0;
};
$n(Swap).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Swap)) {
        return false;
    }
    const pe = ae instanceof Swap ? ae : Tn();
    return this.c14d_1 === pe.c14d_1 && this.d14d_1 === pe.d14d_1 && this.e14d_1 === pe.e14d_1 && this.f14d_1 === pe.f14d_1 && this.g14d_1 === pe.g14d_1 && this.h14d_1 === pe.h14d_1 && this.i14d_1 === pe.i14d_1 && this.j14d_1 === pe.j14d_1 && !!yl(this.k14d_1, pe.k14d_1) && this.l14d_1 === pe.l14d_1;
};
$n($serializer_4).n14d = function(ae, pe) {
    const m14d_1 = this.m14d_1;
    const es = ae.w3r(m14d_1);
    es.m3t(m14d_1, 0, $serializer_getInstance_6(), pe.z14b_1);
    es.k3t(m14d_1, 1, pe.a14c_1);
    es.k3t(m14d_1, 2, pe.b14c_1);
    es.n3t(m14d_1, 3, Il(), pe.c14c_1);
    es.x3r(m14d_1);
};
$n($serializer_4).v3o = function(ae, pe) {
    return this.n14d(ae, pe instanceof Strategy ? pe : Tn());
};
$n($serializer_4).w3o = function(ae) {
    const m14d_1 = this.m14d_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    const as = ae.w3r(m14d_1);
    if (as.l3s()) {
        ns = as.i3s(m14d_1, 0, $serializer_getInstance_6(), ns);
        ss |= 1;
        ts = as.g3s(m14d_1, 1);
        ss |= 2;
        rs = as.g3s(m14d_1, 2);
        ss |= 4;
        os = as.k3s(m14d_1, 3, Il(), os);
        ss |= 8;
    } else {
        while(ye){
            switch(es = as.m3s(m14d_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = as.i3s(m14d_1, 0, $serializer_getInstance_6(), ns);
                    ss |= 1;
                    break;
                case 1:
                    ts = as.g3s(m14d_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = as.g3s(m14d_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = as.k3s(m14d_1, 3, Il(), os);
                    ss |= 8;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    as.x3r(m14d_1);
    return function Strategy_init_$Create$(ae, pe, ye, es, ss, ns) {
        return function Strategy_init_$Init$(ae, pe, ye, es, ss, ns, ts) {
            if (15 & ~ae) {
                pl(ae, 15, $serializer_getInstance_4().m14d_1);
            }
            ts.z14b_1 = pe;
            ts.a14c_1 = ye;
            ts.b14c_1 = es;
            ts.c14c_1 = ss;
            return ts;
        }(ae, pe, ye, es, ss, 0, fl($n(Strategy)));
    }(ss, ns, ts, rs, os);
};
$n($serializer_4).i3o = function() {
    return this.m14d_1;
};
$n($serializer_4).z3z = function() {
    return [
        $serializer_getInstance_6(),
        ol(),
        ol(),
        dl(Il())
    ];
};
$n(Strategy).hashCode = function() {
    let ae = this.z14b_1.hashCode();
    ae = pn(ae, 31) + $l(this.a14c_1) | 0;
    ae = pn(ae, 31) + $l(this.b14c_1) | 0;
    return ae = pn(ae, 31) + (this.c14c_1 == null ? 0 : this.c14c_1.hashCode()) | 0;
};
$n(Strategy).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Strategy)) {
        return false;
    }
    const pe = ae instanceof Strategy ? ae : Tn();
    return !!this.z14b_1.equals(pe.z14b_1) && this.a14c_1 === pe.a14c_1 && this.b14c_1 === pe.b14c_1 && !!yl(this.c14c_1, pe.c14c_1);
};
$n($serializer_5).p14d = function(ae, pe) {
    const o14d_1 = this.o14d_1;
    const es = ae.w3r(o14d_1);
    es.k3t(o14d_1, 0, pe.q14d_1);
    es.f3t(o14d_1, 1, pe.r14d_1);
    es.k3t(o14d_1, 2, pe.s14d_1);
    es.k3t(o14d_1, 3, pe.t14d_1);
    es.x3r(o14d_1);
};
$n($serializer_5).v3o = function(ae, pe) {
    return this.p14d(ae, pe instanceof Protocol ? pe : Tn());
};
$n($serializer_5).w3o = function(ae) {
    const o14d_1 = this.o14d_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = 0;
    let rs = null;
    let os = null;
    const as = ae.w3r(o14d_1);
    if (as.l3s()) {
        ns = as.g3s(o14d_1, 0);
        ss |= 1;
        ts = as.b3s(o14d_1, 1);
        ss |= 2;
        rs = as.g3s(o14d_1, 2);
        ss |= 4;
        os = as.g3s(o14d_1, 3);
        ss |= 8;
    } else {
        while(ye){
            switch(es = as.m3s(o14d_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = as.g3s(o14d_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = as.b3s(o14d_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = as.g3s(o14d_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = as.g3s(o14d_1, 3);
                    ss |= 8;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    as.x3r(o14d_1);
    return function Protocol_init_$Create$(ae, pe, ye, es, ss, ns) {
        return function Protocol_init_$Init$(ae, pe, ye, es, ss, ns, ts) {
            if (15 & ~ae) {
                pl(ae, 15, $serializer_getInstance_5().o14d_1);
            }
            ts.q14d_1 = pe;
            ts.r14d_1 = ye;
            ts.s14d_1 = es;
            ts.t14d_1 = ss;
            return ts;
        }(ae, pe, ye, es, ss, 0, fl($n(Protocol)));
    }(ss, ns, ts, rs, os);
};
$n($serializer_5).i3o = function() {
    return this.o14d_1;
};
$n($serializer_5).z3z = function() {
    return [
        ol(),
        Tl(),
        ol(),
        ol()
    ];
};
$n(Protocol).hashCode = function() {
    let ae = $l(this.q14d_1);
    ae = pn(ae, 31) + this.r14d_1 | 0;
    ae = pn(ae, 31) + $l(this.s14d_1) | 0;
    return ae = pn(ae, 31) + $l(this.t14d_1) | 0;
};
$n(Protocol).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Protocol)) {
        return false;
    }
    const pe = ae instanceof Protocol ? ae : Tn();
    return this.q14d_1 === pe.q14d_1 && this.r14d_1 === pe.r14d_1 && this.s14d_1 === pe.s14d_1 && this.t14d_1 === pe.t14d_1;
};
$n($serializer_6).v14d = function(ae, pe) {
    const u14d_1 = this.u14d_1;
    const es = ae.w3r(u14d_1);
    es.k3t(u14d_1, 0, pe.w14d_1);
    es.k3t(u14d_1, 1, pe.x14d_1);
    es.f3t(u14d_1, 2, pe.y14d_1);
    es.x3r(u14d_1);
};
$n($serializer_6).v3o = function(ae, pe) {
    return this.v14d(ae, pe instanceof StrategyToken ? pe : Tn());
};
$n($serializer_6).w3o = function(ae) {
    const u14d_1 = this.u14d_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = 0;
    const os = ae.w3r(u14d_1);
    if (os.l3s()) {
        ns = os.g3s(u14d_1, 0);
        ss |= 1;
        ts = os.g3s(u14d_1, 1);
        ss |= 2;
        rs = os.b3s(u14d_1, 2);
        ss |= 4;
    } else {
        while(ye){
            switch(es = os.m3s(u14d_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = os.g3s(u14d_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = os.g3s(u14d_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = os.b3s(u14d_1, 2);
                    ss |= 4;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    os.x3r(u14d_1);
    return function StrategyToken_init_$Create$(ae, pe, ye, es, ss) {
        return function StrategyToken_init_$Init$(ae, pe, ye, es, ss, ns) {
            if (7 & ~ae) {
                pl(ae, 7, $serializer_getInstance_6().u14d_1);
            }
            ns.w14d_1 = pe;
            ns.x14d_1 = ye;
            ns.y14d_1 = es;
            return ns;
        }(ae, pe, ye, es, 0, fl($n(StrategyToken)));
    }(ss, ns, ts, rs);
};
$n($serializer_6).i3o = function() {
    return this.u14d_1;
};
$n($serializer_6).z3z = function() {
    return [
        ol(),
        ol(),
        Tl()
    ];
};
$n(StrategyToken).toString = function() {
    return `StrategyToken(address=${this.w14d_1}, symbol=${this.x14d_1}, decimals=${this.y14d_1})`;
};
$n(StrategyToken).hashCode = function() {
    let ae = $l(this.w14d_1);
    ae = pn(ae, 31) + $l(this.x14d_1) | 0;
    return ae = pn(ae, 31) + this.y14d_1 | 0;
};
$n(StrategyToken).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof StrategyToken)) {
        return false;
    }
    const pe = ae instanceof StrategyToken ? ae : Tn();
    return this.w14d_1 === pe.w14d_1 && this.x14d_1 === pe.x14d_1 && this.y14d_1 === pe.y14d_1;
};
$n(AngleVaultsModule).m14e = function() {
    const h14e_1 = this.h14e_1;
    (function vaultsTransactionBuilder$factory() {
        return xl("vaultsTransactionBuilder", 1, Ol, function(ae) {
            return ae.m14e();
        }, null);
    })();
    return h14e_1.f1();
};
$n(AngleVaultsModule).n14e = function() {
    const i14e_1 = this.i14e_1;
    (function vaultsBalanceService$factory() {
        return xl("vaultsBalanceService", 1, Ol, function(ae) {
            return ae.n14e();
        }, null);
    })();
    return i14e_1.f1();
};
$n(AngleVaultsModule).l14e = function() {
    const j14e_1 = this.j14e_1;
    (function vaultsService$factory() {
        return xl("vaultsService", 1, Ol, function(ae) {
            return ae.l14e();
        }, null);
    })();
    return j14e_1.f1();
};
$n($getUserVaultPositionCOROUTINE$4).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    this.i14h_1.e14j(this.m14h_1, this.n14h_1);
                    this.o14h_1 = this.i14h_1.d146_1;
                    this.p14h_1 = `${this.i14h_1.e146_1}/v1/defi/angle/positions`;
                    this.q14h_1 = this.o14h_1;
                    this.r14h_1 = this.p14h_1;
                    this.s14h_1 = this.q14h_1;
                    this.t14h_1 = this.s14h_1;
                    this.u14h_1 = this.t14h_1;
                    const pe = new Dl;
                    Bl(pe, this.r14h_1);
                    jl(pe, "userAddress", this.j14h_1);
                    jl(pe, "first", this.m14h_1);
                    if (this.k14h_1 != null) {
                        jl(pe, "chainId", this.k14h_1);
                    }
                    if (this.l14h_1 != null) {
                        jl(pe, "strategyAddress", this.l14h_1);
                    }
                    if (this.n14h_1 != null) {
                        jl(pe, "skip", this.n14h_1);
                    }
                    this.v14h_1 = pe;
                    this.w14h_1 = this.u14h_1;
                    this.x14h_1 = this.v14h_1;
                    this.x14h_1.b79_1 = Fl().i6j_1;
                    this.y14h_1 = this.w14h_1;
                    this.z14h_1 = this.x14h_1;
                    this.a14i_1 = this.y14h_1;
                    this.b14i_1 = this.z14h_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.b14i_1, this.a14i_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.c14i_1 = pa_1;
                    this.d14i_1 = "error";
                    this.e14i_1 = this.c14i_1;
                    this.f14i_1 = this.d14i_1;
                    if (Jl(this.e14i_1.v6o())) {
                        this.oa_1 = 4;
                        this.i14i_1 = this.e14i_1;
                        this.j14i_1 = this.i14i_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.j14i_1.i7c();
                        const ss = Wl(Kl);
                        try {
                            ye = Vl(Wl(Kl), Gl([
                                Hl(Vl(Wl(UserVaultPosition), Gl([]), false))
                            ]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            ye = null;
                        }
                        if ((pa_1 = es.l7b(new Zl(ss, ye), this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.k14i_1 = this.e14i_1.v6o().c6m_1;
                    this.l14i_1 = this.e14i_1;
                    this.m14i_1 = this.f14i_1;
                    this.n14i_1 = this.l14i_1;
                    this.o14i_1 = this.m14i_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.n14i_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.p14i_1 = pa_1;
                    this.q14i_1 = Xl(this.p14i_1, this.o14i_1);
                    const ns = this.q14i_1;
                    this.r14i_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.k14i_1, this.r14i_1);
                case 3:
                    this.h14i_1 = pa_1 != null && jn(pa_1, Kl) ? pa_1 : Tn();
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 9;
                    if (this.qa_1 instanceof nw) {
                        this.s14i_1 = this.qa_1;
                        this.t14i_1 = this.e14i_1.v6o().c6m_1;
                        this.u14i_1 = this.e14i_1;
                        this.v14i_1 = this.f14i_1;
                        this.w14i_1 = this.u14i_1;
                        this.x14i_1 = this.v14i_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.w14i_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.y14i_1 = this.qa_1;
                        this.z14i_1 = this.e14i_1.v6o().c6m_1;
                        this.a14j_1 = this.e14i_1;
                        this.b14j_1 = this.f14i_1;
                        this.c14j_1 = this.a14j_1;
                        this.d14j_1 = this.b14j_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.c14j_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.x14i_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.t14i_1, rs, this.s14i_1);
                case 6:
                    const os = Xl(pa_1, this.d14j_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.z14i_1, as, this.y14i_1);
                case 7:
                    this.oa_1 = 9;
                    this.g14i_1 = this.h14i_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    return this.g14i_1;
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const cs = error;
            if (this.oa_1 === 9) {
                throw cs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = cs;
        }
    }
};
$n($getVaultOverviewCOROUTINE$5).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    this.q14j_1 = this.n14j_1.d146_1;
                    this.r14j_1 = `${this.n14j_1.e146_1}/v1/defi/angle/overview`;
                    this.s14j_1 = this.q14j_1;
                    this.t14j_1 = this.r14j_1;
                    this.u14j_1 = this.s14j_1;
                    this.v14j_1 = this.u14j_1;
                    this.w14j_1 = this.v14j_1;
                    const pe = new Dl;
                    Bl(pe, this.t14j_1);
                    jl(pe, "chainId", this.o14j_1);
                    jl(pe, "strategyAddress", this.p14j_1);
                    this.x14j_1 = pe;
                    this.y14j_1 = this.w14j_1;
                    this.z14j_1 = this.x14j_1;
                    this.z14j_1.b79_1 = Fl().i6j_1;
                    this.a14k_1 = this.y14j_1;
                    this.b14k_1 = this.z14j_1;
                    this.c14k_1 = this.a14k_1;
                    this.d14k_1 = this.b14k_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.d14k_1, this.c14k_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.e14k_1 = pa_1;
                    this.f14k_1 = "error";
                    this.g14k_1 = this.e14k_1;
                    this.h14k_1 = this.f14k_1;
                    if (Jl(this.g14k_1.v6o())) {
                        this.oa_1 = 4;
                        this.k14k_1 = this.g14k_1;
                        this.l14k_1 = this.k14k_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.l14k_1.i7c();
                        const ss = Wl(AngleVault);
                        try {
                            ye = Vl(Wl(AngleVault), Gl([]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            ye = null;
                        }
                        if ((pa_1 = es.l7b(new Zl(ss, ye), this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.m14k_1 = this.g14k_1.v6o().c6m_1;
                    this.n14k_1 = this.g14k_1;
                    this.o14k_1 = this.h14k_1;
                    this.p14k_1 = this.n14k_1;
                    this.q14k_1 = this.o14k_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.p14k_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.r14k_1 = pa_1;
                    this.s14k_1 = Xl(this.r14k_1, this.q14k_1);
                    const ns = this.s14k_1;
                    this.t14k_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.m14k_1, this.t14k_1);
                case 3:
                    this.j14k_1 = pa_1 instanceof AngleVault ? pa_1 : Tn();
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 9;
                    if (this.qa_1 instanceof nw) {
                        this.u14k_1 = this.qa_1;
                        this.v14k_1 = this.g14k_1.v6o().c6m_1;
                        this.w14k_1 = this.g14k_1;
                        this.x14k_1 = this.h14k_1;
                        this.y14k_1 = this.w14k_1;
                        this.z14k_1 = this.x14k_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.y14k_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.a14l_1 = this.qa_1;
                        this.b14l_1 = this.g14k_1.v6o().c6m_1;
                        this.c14l_1 = this.g14k_1;
                        this.d14l_1 = this.h14k_1;
                        this.e14l_1 = this.c14l_1;
                        this.f14l_1 = this.d14l_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.e14l_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.z14k_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.v14k_1, rs, this.u14k_1);
                case 6:
                    const os = Xl(pa_1, this.f14l_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.b14l_1, as, this.a14l_1);
                case 7:
                    this.oa_1 = 9;
                    this.i14k_1 = this.j14k_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    return this.i14k_1;
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const cs = error;
            if (this.oa_1 === 9) {
                throw cs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = cs;
        }
    }
};
$n($httpClientGetPayloadCOROUTINE$6).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    this.a14f_1 = this.w14e_1.d146_1;
                    this.b14f_1 = this.w14e_1.e146_1 + this.x14e_1;
                    this.c14f_1 = this.a14f_1;
                    this.d14f_1 = this.b14f_1;
                    this.e14f_1 = this.c14f_1;
                    this.f14f_1 = this.e14f_1;
                    this.g14f_1 = this.f14f_1;
                    const pe = new Dl;
                    Bl(pe, this.d14f_1);
                    addCommonConfiguration(this.w14e_1, pe, this.y14e_1);
                    this.z14e_1(pe);
                    this.h14f_1 = pe;
                    this.i14f_1 = this.g14f_1;
                    this.j14f_1 = this.h14f_1;
                    this.j14f_1.b79_1 = Fl().i6j_1;
                    this.k14f_1 = this.i14f_1;
                    this.l14f_1 = this.j14f_1;
                    this.m14f_1 = this.k14f_1;
                    this.n14f_1 = this.l14f_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.n14f_1, this.m14f_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.o14f_1 = pa_1;
                    this.p14f_1 = "error";
                    this.q14f_1 = this.o14f_1;
                    this.r14f_1 = this.p14f_1;
                    if (Jl(this.q14f_1.v6o())) {
                        this.oa_1 = 4;
                        this.u14f_1 = this.q14f_1;
                        this.v14f_1 = this.u14f_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.v14f_1.i7c();
                        const ss = Wl(Payload);
                        try {
                            ye = Vl(Wl(Payload), Gl([]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            ye = null;
                        }
                        if ((pa_1 = es.l7b(new Zl(ss, ye), this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.w14f_1 = this.q14f_1.v6o().c6m_1;
                    this.x14f_1 = this.q14f_1;
                    this.y14f_1 = this.r14f_1;
                    this.z14f_1 = this.x14f_1;
                    this.a14g_1 = this.y14f_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.z14f_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.b14g_1 = pa_1;
                    this.c14g_1 = Xl(this.b14g_1, this.a14g_1);
                    const ns = this.c14g_1;
                    this.d14g_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.w14f_1, this.d14g_1);
                case 3:
                    this.t14f_1 = pa_1 instanceof Payload ? pa_1 : Tn();
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 9;
                    if (this.qa_1 instanceof nw) {
                        this.e14g_1 = this.qa_1;
                        this.f14g_1 = this.q14f_1.v6o().c6m_1;
                        this.g14g_1 = this.q14f_1;
                        this.h14g_1 = this.r14f_1;
                        this.i14g_1 = this.g14g_1;
                        this.j14g_1 = this.h14g_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.i14g_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.k14g_1 = this.qa_1;
                        this.l14g_1 = this.q14f_1.v6o().c6m_1;
                        this.m14g_1 = this.q14f_1;
                        this.n14g_1 = this.r14f_1;
                        this.o14g_1 = this.m14g_1;
                        this.p14g_1 = this.n14g_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.o14g_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.j14g_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.f14g_1, rs, this.e14g_1);
                case 6:
                    const os = Xl(pa_1, this.p14g_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.l14g_1, as, this.k14g_1);
                case 7:
                    this.oa_1 = 9;
                    this.s14f_1 = this.t14f_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    return this.s14f_1;
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const cs = error;
            if (this.oa_1 === 9) {
                throw cs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = cs;
        }
    }
};
$n(AngleVaultsRpcClient).g14l = function(ae, pe, ye, es, ss, ns) {
    const ts = new $getUserVaultPositionCOROUTINE$4(this, ae, pe, ye, es, ss, ns);
    ts.pa_1 = fn;
    ts.qa_1 = null;
    return ts.va();
};
$n(AngleVaultsRpcClient).h14l = function(ae, pe, ye, es, ss, ns, ts) {
    pe = pe === On ? null : pe;
    ye = ye === On ? null : ye;
    es = es === On ? 1 : es;
    ss = ss === On ? null : ss;
    if (ts === On) {
        return this.g14l(ae, pe, ye, es, ss, ns);
    }
    return ts.g14l.call(this, ae, pe, ye, es, ss, ns);
};
$n(AngleVaultsRpcClient).f146 = function(ae, pe, ye) {
    const es = new $getVaultOverviewCOROUTINE$5(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(AngleVaultsRpcClient).i14l = function(ae, pe) {
    this.j14l(ae);
    return httpClientGetPayload(this, "/v1/defi/angle/deposit", ae, function AngleVaultsRpcClient$getDepositPayload$lambda(ae) {
        return function(pe) {
            jl(pe, "inputTokenAddress", ae.n14c_1.wjo());
            return fn;
        };
    }(ae), pe);
};
$n(AngleVaultsRpcClient).k14l = function(ae, pe) {
    this.j14l(ae);
    return httpClientGetPayload(this, "/v1/defi/angle/withdraw", ae, function AngleVaultsRpcClient$getWithdrawPayload$lambda(ae) {
        return function(pe) {
            jl(pe, "outputTokenAddress", ae.n14c_1.wjo());
            return fn;
        };
    }(ae), pe);
};
$n(AngleVaultsRpcClient).e14j = function(ae, pe) {
    if (!(ae > 0)) {
        throw rw(kl("first parameter must be greater than zero"));
    }
    if (pe == null) ;
    else if (!(pe >= 0)) {
        throw rw(kl("skip parameter, when specified, must be greater or equal zero"));
    }
};
$n(AngleVaultsRpcClient).j14l = function(ae) {
    if (!(ae.p14c_1.h8v(ow().n8s_1) > 0)) {
        throw rw(kl("Input token amount must be greater than zero"));
    }
    const ae_q14c_1 = ae.q14c_1;
    if (!(iw(ae_q14c_1) > 0)) {
        throw rw(kl("Strategy address is required"));
    }
    const ae_r14c_1 = ae.r14c_1;
    if (!(iw(ae_r14c_1) > 0)) {
        throw rw(kl("User address is required"));
    }
    if (!(ae.s14c_1.h8v(Zr().c8t_1) > 0 && ae.s14c_1.h8v(Zr().d8t_1) < 0)) {
        throw rw(kl("Slippage must be between 0 and 1"));
    }
};
$n(AngleVaultsService$fetchVaults$slambda$slambda).e14m = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsService$fetchVaults$slambda$slambda).hb = function(ae, pe) {
    return this.e14m(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsService$fetchVaults$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.x14l_1 = this.w14l_1;
                    this.y14l_1 = this.x14l_1;
                    this.oa_1 = 2;
                    this.a14m_1 = Mn;
                    this.b14m_1 = this.y14l_1;
                    this.c14m_1 = this.b14m_1;
                    this.d14m_1 = this.t14l_1.f14m(this.u14l_1, this.v14l_1.b147_1);
                    this.na_1 = 1;
                    if ((pa_1 = this.t14l_1.r147(this.v14l_1.b147_1, this.v14l_1.a147_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = toCommon(pa_1, this.v14l_1, this.d14m_1);
                    this.a14m_1;
                    this.z14l_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.z14l_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.z14l_1;
                    if (Bn(ss)) {
                        es = null;
                    } else {
                        const ns = Cn(ss);
                        es = ns == null || ns != null ? ns : Tn();
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
$n(AngleVaultsService$fetchVaults$slambda$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsService$fetchVaults$slambda$slambda(this.t14l_1, this.u14l_1, this.v14l_1, pe);
    ye.w14l_1 = ae;
    return ye;
};
$n(AngleVaultsService$fetchPositions$slambda$slambda).n14n = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsService$fetchPositions$slambda$slambda).hb = function(ae, pe) {
    return this.n14n(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsService$fetchPositions$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 6;
                    this.t14m_1 = this.s14m_1;
                    this.u14m_1 = this.t14m_1;
                    this.oa_1 = 5;
                    this.w14m_1 = Mn;
                    this.x14m_1 = this.u14m_1;
                    this.y14m_1 = this.x14m_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.o14m_1.k148(this.p14m_1, On, On, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.z14m_1 = pa_1;
                    this.a14n_1 = this.z14m_1;
                    this.b14n_1 = this.a14n_1;
                    this.c14n_1 = Zn();
                    this.d14n_1 = this.b14n_1;
                    this.e14n_1 = this.c14n_1;
                    this.f14n_1 = this.d14n_1;
                    this.g14n_1 = this.f14n_1;
                    this.h14n_1 = this.g14n_1.k();
                    this.na_1 = 2;
                    continue e;
                case 2:
                    if (!this.h14n_1.l()) {
                        this.na_1 = 4;
                        continue e;
                    }
                    this.i14n_1 = this.h14n_1.m();
                    this.j14n_1 = this.i14n_1;
                    this.k14n_1 = this.j14n_1;
                    this.l14n_1 = this.k14n_1;
                    this.m14n_1 = this.l14n_1;
                    this.na_1 = 3;
                    if ((pa_1 = getVaultPositionOrNull(this.o14m_1, this.m14n_1, this.p14m_1, this.q14m_1, this.r14m_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    const pe = pa_1;
                    if (pe != null) {
                        this.e14n_1.e(pe);
                    }
                    this.na_1 = 2;
                    continue e;
                case 4:
                    const ye = this.e14n_1;
                    this.w14m_1;
                    this.v14m_1 = yn(ye);
                    this.oa_1 = 6;
                    this.na_1 = 7;
                    continue e;
                case 5:
                    this.oa_1 = 6;
                    if (this.qa_1 instanceof Error) {
                        const es = this.qa_1;
                        this.v14m_1 = yn(Sn(es));
                        this.na_1 = 7;
                        continue e;
                    }
                    throw this.qa_1;
                case 6:
                    throw this.qa_1;
                case 7:
                    this.oa_1 = 6;
                    let ss;
                    const ns = this.v14m_1;
                    if (Bn(ns)) {
                        ss = null;
                    } else {
                        const ts = Cn(ns);
                        ss = ts == null || ts != null ? ts : Tn();
                    }
                    return ss;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 6) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(AngleVaultsService$fetchPositions$slambda$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsService$fetchPositions$slambda$slambda(this.o14m_1, this.p14m_1, this.q14m_1, this.r14m_1, pe);
    ye.s14m_1 = ae;
    return ye;
};
$n(AngleVaultsService$getVaultOrThrow$slambda).g14p = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsService$getVaultOrThrow$slambda).hb = function(ae, pe) {
    return this.g14p(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsService$getVaultOrThrow$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.c14p_1.q147_1.g146(this.d14p_1, this.e14p_1, this)) === Rn()) {
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
$n(AngleVaultsService$getVaultOrThrow$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsService$getVaultOrThrow$slambda(this.c14p_1, this.d14p_1, this.e14p_1, pe);
    ye.f14p_1 = ae;
    return ye;
};
$n(AngleVaultsService$getUserVaultPositionOrThrow$slambda).j148 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsService$getUserVaultPositionOrThrow$slambda).hb = function(ae, pe) {
    return this.j148(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsService$getUserVaultPositionOrThrow$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.p14p_1.p147_1.g14l(this.q14p_1.hjo_1, this.q14p_1.ojo().nil(), this.r14p_1, this.s14p_1, this.t14p_1, this)) === Rn()) {
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
$n(AngleVaultsService$getUserVaultPositionOrThrow$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsService$getUserVaultPositionOrThrow$slambda(this.p14p_1, this.q14p_1, this.r14p_1, this.s14p_1, this.t14p_1, pe);
    ye.u14p_1 = ae;
    return ye;
};
$n(AngleVaultsService$fetchVaults$slambda).h14q = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsService$fetchVaults$slambda).hb = function(ae, pe) {
    return this.h14q(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsService$fetchVaults$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    const pe = this.d14q_1;
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.g14q_1, On, On, AngleVaultsService$fetchVaults$slambda$slambda_0(this.e14q_1, this.f14q_1, ss, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return Ht(pa_1);
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 2) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(AngleVaultsService$fetchVaults$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsService$fetchVaults$slambda(this.d14q_1, this.e14q_1, this.f14q_1, pe);
    ye.g14q_1 = ae;
    return ye;
};
$n(AngleVaultsService$fetchPositions$slambda).v14q = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsService$fetchPositions$slambda).hb = function(ae, pe) {
    return this.v14q(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsService$fetchPositions$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    const pe = this.q14q_1;
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.u14q_1, On, On, AngleVaultsService$fetchPositions$slambda$slambda_0(this.r14q_1, ss, this.s14q_1, this.t14q_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return Jt(Ht(pa_1));
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 2) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(AngleVaultsService$fetchPositions$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsService$fetchPositions$slambda(this.q14q_1, this.r14q_1, this.s14q_1, this.t14q_1, pe);
    ye.u14q_1 = ae;
    return ye;
};
$n($createVaultApprovalTransactionInputCOROUTINE$7).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    if (!this.g14r_1 && this.h14r_1.h8v(ow().n8s_1) <= 0) {
                        throw new InvalidApprovalAmount("Min amount should be greater than 0");
                    }
                    let pe;
                    const ye = this.f14r_1.o14r(this.i14r_1.a4r());
                    if (ye == null) {
                        throw new VaultConfigNotFound(this.i14r_1.a4r());
                    }
                    pe = ye;
                    this.l14r_1 = pe;
                    this.m14r_1 = this.e14r_1.f14m(this.f14r_1, this.i14r_1.ojo().nil());
                    if (this.k14r_1) {
                        this.na_1 = 1;
                        if ((pa_1 = getAssetAddressForVaultWithdrawOrThrow(this.e14r_1, this.l14r_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.n14r_1 = this.l14r_1.d147_1;
                    this.na_1 = 2;
                    continue e;
                case 1:
                    this.n14r_1 = pa_1;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    const es = this.n14r_1;
                    return new VaultApprovalTransactionInput(this.g14r_1 ? aw().rqj(cw(this.m14r_1, this.j14r_1.ojo())) : aw().qqj(cw(this.m14r_1, this.j14r_1.ojo()), this.h14r_1), es);
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
$n($getWithdrawAllowanceInputCOROUTINE$8).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    let pe;
                    const ye = this.y14r_1.o14r(this.z14r_1.a4r());
                    if (ye == null) {
                        throw new VaultConfigNotFound(this.z14r_1.a4r());
                    }
                    pe = ye;
                    this.b14s_1 = pe;
                    this.na_1 = 1;
                    if ((pa_1 = getAssetAddressForVaultWithdrawOrThrow(this.x14r_1, this.b14s_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const es = pa_1;
                    return new CheckAllowanceInput(this.a14s_1, es, this.x14r_1.f14m(this.y14r_1, this.z14r_1.ojo().nil()));
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ss = error;
            if (this.oa_1 === 2) {
                throw ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ss;
        }
    }
};
$n($getVaultPositionOrNullCOROUTINE$9).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.b14o_1 = this.w14n_1;
                    this.c14o_1 = this.b14o_1;
                    this.oa_1 = 3;
                    this.e14o_1 = Mn;
                    this.f14o_1 = this.c14o_1;
                    this.g14o_1 = this.f14o_1;
                    let pe;
                    const ye = this.z14n_1;
                    s: do {
                        for(const es = ye.k(); es.l();){
                            const ss = es.m();
                            if (Wt(ss.a147_1, this.x14n_1.s148_1, true)) {
                                pe = ss;
                                break s;
                            }
                        }
                        throw uw("Collection contains no element matching the predicate.");
                    }while (0)
                    this.h14o_1 = pe;
                    this.i14o_1 = this.g14o_1.f14m(this.a14o_1, this.h14o_1.b147_1);
                    if (matches(this.g14o_1, this.x14n_1, this.y14n_1)) {
                        this.na_1 = 1;
                        if ((pa_1 = this.g14o_1.r147(this.h14o_1.b147_1, this.h14o_1.a147_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.j14o_1 = null;
                    this.na_1 = 2;
                    continue e;
                case 1:
                    const ns = toCommon(pa_1, this.h14o_1, this.i14o_1);
                    this.j14o_1 = toNormal(this.x14n_1, this.y14n_1, ns);
                    this.na_1 = 2;
                    continue e;
                case 2:
                    return this.j14o_1;
                case 3:
                    this.oa_1 = 4;
                    if (this.qa_1 instanceof Error) {
                        const ts = this.qa_1;
                        this.d14o_1 = yn(Sn(ts));
                        this.na_1 = 5;
                        continue e;
                    }
                    throw this.qa_1;
                case 4:
                    throw this.qa_1;
                case 5:
                    this.oa_1 = 4;
                    let rs;
                    const os = this.d14o_1;
                    if (Bn(os)) {
                        rs = null;
                    } else {
                        const as = Cn(os);
                        rs = as == null || as != null ? as : Tn();
                    }
                    return rs;
            }
        } catch (error) {
            const cs = error;
            if (this.oa_1 === 4) {
                throw cs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = cs;
        }
    }
};
$n($getAssetAddressForVaultWithdrawOrThrowCOROUTINE$10).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.s14o_1.r147(this.t14o_1.b147_1, this.t14o_1.a147_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return pa_1.y148_1.w14b_1;
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
$n(AngleVaultsService).c14s = function(ae, pe) {
    const ye = this.e14s(ae);
    if (ye.u()) {
        return Un();
    }
    return fetchVaults(this, ye, ae, pe);
};
$n(AngleVaultsService).f14s = function(ae, pe, ye) {
    const es = this.g14s(ae, pe.slice());
    if (es.u()) {
        return Un();
    }
    return fetchVaults(this, es, ae, ye);
};
$n(AngleVaultsService).h14s = function(ae, pe, ye) {
    const es = this.e14s(ae);
    if (es.u()) {
        return Un();
    }
    return fetchPositions(this, function filterByConfiguredChains(ae, pe, ye) {
        const es = Zn();
        for(let ss = 0, ns = pe.length; ss < ns;){
            const ts = pe[ss];
            ss = ss + 1 | 0;
            const rs = Xn(Kn(ye, 10));
            for(const os = ye.k(); os.l();){
                const as = os.m().b147_1;
                rs.e(as);
            }
            if (rs.n(ts.ojo().nil())) {
                es.e(ts);
            }
        }
        return es;
    }(0, pe, es), es, ae, ye);
};
$n(AngleVaultsService).i14s = function(ae, pe, ye, es, ss, ns, ts) {
    const rs = new $createVaultApprovalTransactionInputCOROUTINE$7(this, ae, pe, ye, es, ss, ns, ts);
    rs.pa_1 = fn;
    rs.qa_1 = null;
    return rs.va();
};
$n(AngleVaultsService).j14s = function(ae, pe, ye, es) {
    const ss = ae.o14r(pe.a4r());
    if (ss == null) {
        throw new VaultConfigNotFound(pe.a4r());
    }
    return new CheckAllowanceInput(ye, ss.d147_1, this.f14m(ae, pe.ojo().nil()));
};
$n(AngleVaultsService).k14s = function(ae, pe, ye, es) {
    const ss = new $getWithdrawAllowanceInputCOROUTINE$8(this, ae, pe, ye, es);
    ss.pa_1 = fn;
    ss.qa_1 = null;
    return ss.va();
};
$n(AngleVaultsService).r147 = function(ae, pe, ye) {
    return lw(function AngleVaultsService$getVaultOrThrow$slambda_0(ae, pe, ye, es) {
        const ss = new AngleVaultsService$getVaultOrThrow$slambda(ae, pe, ye, es);
        const l = function(ae, pe) {
            return ss.g14p(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, pe, null), ye);
};
$n(AngleVaultsService).l14s = function(ae, pe, ye, es, ss) {
    return lw(function AngleVaultsService$getUserVaultPositionOrThrow$slambda_0(ae, pe, ye, es, ss, ns) {
        const ts = new AngleVaultsService$getUserVaultPositionOrThrow$slambda(ae, pe, ye, es, ss, ns);
        const l = function(ae, pe) {
            return ts.j148(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, pe, ye, es, null), ss);
};
$n(AngleVaultsService).k148 = function(ae, pe, ye, es, ss, ns) {
    pe = pe === On ? null : pe;
    ye = ye === On ? 1 : ye;
    es = es === On ? null : es;
    if (ns === On) {
        return this.l14s(ae, pe, ye, es, ss);
    }
    return ns.l14s.call(this, ae, pe, ye, es, ss);
};
$n(AngleVaultsService).f14m = function(ae, pe) {
    const ye = ae.m14s(pe);
    if (ye == null) {
        throw new RouterAddressNotFound(pe);
    }
    return ye;
};
$n(AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda).r14t = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda).hb = function(ae, pe) {
    return this.r14t(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.l14t_1 = this.k14t_1;
                    this.m14t_1 = this.l14t_1;
                    this.oa_1 = 2;
                    this.o14t_1 = Mn;
                    this.p14t_1 = this.m14t_1;
                    this.q14t_1 = this.p14t_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.i14t_1.s14t_1.i14l(toCommonData(this.i14t_1, this.j14t_1), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    const ye = toEthereumTransaction(this.i14t_1, pe);
                    this.o14t_1;
                    this.n14t_1 = yn(ye);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const es = this.qa_1;
                        this.n14t_1 = yn(Sn(es));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const ss = this.n14t_1;
                    if (An(ss) != null) {
                        throw new CannotFetchDepositPayload(this.j14t_1.mk6_1);
                    }
                    const ns = Cn(ss);
                    if (ns == null || ns != null) {
                        return ns;
                    }
                    return Tn();
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
$n(AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda(this.i14t_1, this.j14t_1, pe);
    ye.k14t_1 = ae;
    return ye;
};
$n(AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda).r14t = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda).hb = function(ae, pe) {
    return this.r14t(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.e14u_1 = this.d14u_1;
                    this.f14u_1 = this.e14u_1;
                    this.oa_1 = 3;
                    this.h14u_1 = Mn;
                    this.i14u_1 = this.f14u_1;
                    this.j14u_1 = this.i14u_1;
                    this.k14u_1 = this.b14u_1.s14t_1;
                    this.na_1 = 1;
                    if ((pa_1 = toCommonData_0(this.b14u_1, this.c14u_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.l14u_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.k14u_1.k14l(this.l14u_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1;
                    const ye = toEthereumTransaction(this.b14u_1, pe);
                    this.h14u_1;
                    this.g14u_1 = yn(ye);
                    this.oa_1 = 4;
                    this.na_1 = 5;
                    continue e;
                case 3:
                    this.oa_1 = 4;
                    if (this.qa_1 instanceof Error) {
                        const es = this.qa_1;
                        this.g14u_1 = yn(Sn(es));
                        this.na_1 = 5;
                        continue e;
                    }
                    throw this.qa_1;
                case 4:
                    throw this.qa_1;
                case 5:
                    this.oa_1 = 4;
                    const ss = this.g14u_1;
                    const ns = An(ss);
                    if (ns != null) {
                        throw ns instanceof InvalidUserPositionResponse ? ns : new CannotFetchWithdrawPayload(this.c14u_1.vk6_1);
                    }
                    const ts = Cn(ss);
                    if (ts == null || ts != null) {
                        return ts;
                    }
                    return Tn();
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 4) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda).g1w = function(ae, pe) {
    const ye = new AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda(this.b14u_1, this.c14u_1, pe);
    ye.d14u_1 = ae;
    return ye;
};
$n($toCommonDataCOROUTINE$11).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.y14s_1 = this.x14s_1.zk6_1;
                    if (this.y14s_1 === true) {
                        this.na_1 = 1;
                        if ((pa_1 = this.w14s_1.s14t_1.h14l(this.x14s_1.tk6_1.vjo().hjo_1, this.x14s_1.tk6_1.xjo().nil(), this.x14s_1.vk6_1, On, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.y14s_1 === false) {
                        const pe = this.x14s_1.tk6_1.ojo();
                        const ye = this.x14s_1.tk6_1.ojo().nil();
                        const es = this.x14s_1.tk6_1.vjo().hjo_1;
                        const ss = this.x14s_1.yk6_1;
                        this.z14s_1 = new PayloadCommonData(pe, this.x14s_1.tk6_1, ye, this.x14s_1.uk6_1, this.x14s_1.vk6_1, es, ss ?? Companion_getInstance_10().n14s_1);
                        this.na_1 = 2;
                        continue e;
                    }
                    hw();
                    break;
                case 1:
                    const ns = pa_1;
                    if (ns.o() !== 1) {
                        throw new InvalidUserPositionResponse(ns.o());
                    }
                    const ts = vw(ns).w148_1;
                    const rs = this.x14s_1.tk6_1.ojo();
                    const os = this.x14s_1.tk6_1.ojo().nil();
                    const as = this.x14s_1.tk6_1.vjo().hjo_1;
                    const cs = this.x14s_1.yk6_1;
                    this.z14s_1 = new PayloadCommonData(rs, this.x14s_1.tk6_1, os, ts, this.x14s_1.vk6_1, as, cs ?? Companion_getInstance_10().n14s_1);
                    this.na_1 = 2;
                    continue e;
                case 2:
                    return this.z14s_1;
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 3) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
$n(AngleVaultsTransactionBuilder).elq = function(ae, pe) {
    return lw(function AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda_0(ae, pe, ye) {
        const es = new AngleVaultsTransactionBuilder$buildDepositSigningInput$slambda(ae, pe, ye);
        const l = function(ae, pe) {
            return es.r14t(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, null), pe);
};
$n(AngleVaultsTransactionBuilder).flq = function(ae, pe) {
    return lw(function AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda_0(ae, pe, ye) {
        const es = new AngleVaultsTransactionBuilder$buildWithdrawSigningInput$slambda(ae, pe, ye);
        const l = function(ae, pe) {
            return es.r14t(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, null), pe);
};
$n(AngleVaultsTransactionBuilder).glq = function(ae, pe) {
    throw new UnsupportedVaultProvider(ae.dk7_1);
};
$n(UnknownVaultProviderBalanceService).v14b = function(ae, pe) {
    throw new UnknownVaultProvider;
};
$n(VaultProviderService).e14s = function(ae) {
    return ae.m14u(this.d14s_1);
};
$n(VaultProviderService).g14s = function(ae, pe) {
    return ae.n14u(this.d14s_1, pe.slice());
};
$n(UnknownVaultProviderService).c14s = function(ae, pe) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderService).f14s = function(ae, pe, ye) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderService).h14s = function(ae, pe, ye) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderService).i14s = function(ae, pe, ye, es, ss, ns, ts) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderService).j14s = function(ae, pe, ye, es) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderService).k14s = function(ae, pe, ye, es) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderTransactionBuilder).elq = function(ae, pe) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderTransactionBuilder).flq = function(ae, pe) {
    throw new UnknownVaultProvider;
};
$n(UnknownVaultProviderTransactionBuilder).glq = function(ae, pe) {
    throw new UnknownVaultProvider;
};
$n(VaultsBalanceService$loadBalances$slambda$slambda).cmg = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsBalanceService$loadBalances$slambda$slambda).hb = function(ae, pe) {
    return this.cmg(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsBalanceService$loadBalances$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.a14v_1 = this.z14u_1;
                    this.b14v_1 = this.a14v_1;
                    this.oa_1 = 2;
                    this.d14v_1 = Mn;
                    this.e14v_1 = this.b14v_1;
                    this.f14v_1 = this.e14v_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.x14u_1.v14b(this.y14u_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.d14v_1;
                    this.c14v_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.c14v_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.c14v_1;
                    const ns = Un();
                    s: do {
                        if (Bn(ss)) {
                            es = ns;
                            break s;
                        }
                        const ts = Cn(ss);
                        es = ts == null || ts != null ? ts : Tn();
                    }while (0)
                    return es;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(VaultsBalanceService$loadBalances$slambda$slambda).g1w = function(ae, pe) {
    const ye = new VaultsBalanceService$loadBalances$slambda$slambda(this.x14u_1, this.y14u_1, pe);
    ye.z14u_1 = ae;
    return ye;
};
$n(VaultsBalanceService$loadBalances$slambda).cmg = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsBalanceService$loadBalances$slambda).hb = function(ae, pe) {
    return this.cmg(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsBalanceService$loadBalances$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    if (this.q14v_1.u()) {
                        return Un();
                    }
                    this.na_1 = 1;
                    const pe = this.r14v_1.h14v_1;
                    const ye = Xn(pe.o());
                    for(const es = pe.d1().k(); es.l();){
                        const ss = es.m().f1();
                        ye.e(Gt(this.s14v_1, On, On, VaultsBalanceService$loadBalances$slambda$slambda_0(ss, this.q14v_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const ns = Jt(pa_1);
                    const ts = Jn();
                    for(const rs = ns.k(); rs.l();){
                        let os;
                        const as = rs.m();
                        const cs = as.gjr_1;
                        const us = ts.x2(cs);
                        if (us == null) {
                            const ls = Zn();
                            ts.a3(cs, ls);
                            os = ls;
                        } else {
                            os = us;
                        }
                        os.e(as);
                    }
                    const ms = Xn(ts.o());
                    for(const gs = ts.d1().k(); gs.l();){
                        const ds = gs.m();
                        const _s = ds.e1();
                        const hs = ds.f1();
                        const vs = Xn(Kn(hs, 10));
                        for(const ps = hs.k(); ps.l();){
                            const fs = ps.m();
                            vs.e(fs.hjr_1);
                        }
                        const ks = Jt(vs);
                        const Rs = Zn();
                        for(const $s = ks.k(); $s.l();){
                            const bs = $s.m();
                            if (bs instanceof Yn) {
                                Rs.e(bs);
                            }
                        }
                        const Ms = Qn(Rs, VaultsBalanceService$loadBalances$slambda$lambda);
                        const ys = Zn();
                        for(const Ss = ks.k(); Ss.l();){
                            const As = Ss.m();
                            if (As instanceof rt) {
                                ys.e(As);
                            }
                        }
                        const Cs = Qn(ys, VaultsBalanceService$loadBalances$slambda$lambda_0);
                        ms.e(new qt(_s, kt([
                            new Yn(Ms),
                            new rt(Cs)
                        ])));
                    }
                    return ms;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const Ts = error;
            if (this.oa_1 === 2) {
                throw Ts;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = Ts;
        }
    }
};
$n(VaultsBalanceService$loadBalances$slambda).g1w = function(ae, pe) {
    const ye = new VaultsBalanceService$loadBalances$slambda(this.q14v_1, this.r14v_1, pe);
    ye.s14v_1 = ae;
    return ye;
};
$n($isBalanceSupportedCOROUTINE$12).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.d14w_1 = this.b14w_1;
                    this.e14w_1 = this.d14w_1;
                    this.oa_1 = 2;
                    this.g14w_1 = Mn;
                    this.h14w_1 = this.e14w_1;
                    this.i14w_1 = this.h14w_1;
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfig(this.i14w_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.g14w_1;
                    this.f14w_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.f14w_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const es = this.f14w_1;
                    if (An(es) != null) {
                        return false;
                    }
                    const ss = Cn(es);
                    return !(ss == null || ss != null ? ss : Tn()).j14w(this.c14w_1).u();
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 3) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(VaultsBalanceService).aln = function(ae, pe) {
    return Hn(function VaultsBalanceService$loadBalances$slambda_0(ae, pe, ye) {
        const es = new VaultsBalanceService$loadBalances$slambda(ae, pe, ye);
        const l = function(ae, pe) {
            return es.cmg(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(ae, this, null), pe);
};
$n(VaultsBalanceService).bln = function(ae, pe) {
    throw new pw("Not implemented");
};
$n(VaultsBalanceService).gln = function(ae, pe) {
    const ye = new $isBalanceSupportedCOROUTINE$12(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsEnvironmentConfigurator).n14w = function() {
    let ae;
    const m14w_1 = this.m14w_1;
    if (yl(m14w_1, Mw)) {
        ae = this.k14w_1;
    } else if (yl(m14w_1, Sw)) {
        ae = this.l14w_1;
    } else if (m14w_1 instanceof yw) {
        const ye = this.m14w_1;
        ae = (ye instanceof yw ? ye : Tn()).oka_1;
    } else {
        hw();
    }
    return ae;
};
$n(VaultsEnvironmentConfigurator).o14w = function() {
    let ae;
    const m14w_1 = this.m14w_1;
    if (yl(m14w_1, Mw)) {
        ae = true;
    } else if (yl(m14w_1, Sw) || m14w_1 instanceof yw) {
        ae = false;
    } else {
        hw();
    }
    return ae;
};
$n(AccessRestricted).a2 = function() {
    return this.p14w_1;
};
$n($serializer_7).r14w = function(ae, pe) {
    const q14w_1 = this.q14w_1;
    const es = ae.w3r(q14w_1);
    es.n3t(q14w_1, 0, ol(), pe.s14w_1);
    es.k3t(q14w_1, 1, pe.t14w_1);
    es.k3t(q14w_1, 2, pe.u14w_1);
    es.x3r(q14w_1);
};
$n($serializer_7).v3o = function(ae, pe) {
    return this.r14w(ae, pe instanceof EthereumCall_0 ? pe : Tn());
};
$n($serializer_7).w3o = function(ae) {
    const q14w_1 = this.q14w_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    const os = ae.w3r(q14w_1);
    if (os.l3s()) {
        ns = os.k3s(q14w_1, 0, ol(), ns);
        ss |= 1;
        ts = os.g3s(q14w_1, 1);
        ss |= 2;
        rs = os.g3s(q14w_1, 2);
        ss |= 4;
    } else {
        while(ye){
            switch(es = os.m3s(q14w_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = os.k3s(q14w_1, 0, ol(), ns);
                    ss |= 1;
                    break;
                case 1:
                    ts = os.g3s(q14w_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = os.g3s(q14w_1, 2);
                    ss |= 4;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    os.x3r(q14w_1);
    return function EthereumCall_init_$Create$(ae, pe, ye, es, ss) {
        return function EthereumCall_init_$Init$(ae, pe, ye, es, ss, ns) {
            if (7 & ~ae) {
                pl(ae, 7, $serializer_getInstance_7().q14w_1);
            }
            ns.s14w_1 = pe;
            ns.t14w_1 = ye;
            ns.u14w_1 = es;
            return ns;
        }(ae, pe, ye, es, 0, fl($n(EthereumCall_0)));
    }(ss, ns, ts, rs);
};
$n($serializer_7).i3o = function() {
    return this.q14w_1;
};
$n($serializer_7).z3z = function() {
    return [
        dl(ol()),
        ol(),
        ol()
    ];
};
$n(EthereumCall_0).toString = function() {
    return `EthereumCall(from=${this.s14w_1}, to=${this.t14w_1}, data=${this.u14w_1})`;
};
$n(EthereumCall_0).hashCode = function() {
    let ae = this.s14w_1 == null ? 0 : $l(this.s14w_1);
    ae = pn(ae, 31) + $l(this.t14w_1) | 0;
    return ae = pn(ae, 31) + $l(this.u14w_1) | 0;
};
$n(EthereumCall_0).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof EthereumCall_0)) {
        return false;
    }
    const pe = ae instanceof EthereumCall_0 ? ae : Tn();
    return this.s14w_1 == pe.s14w_1 && this.t14w_1 === pe.t14w_1 && this.u14w_1 === pe.u14w_1;
};
$n(CheckAllowanceInput).toString = function() {
    return `CheckAllowanceInput(account=${this.x14w_1.toString()}, assetAddress=${this.y14w_1}, spender=${this.z14w_1})`;
};
$n(CheckAllowanceInput).hashCode = function() {
    let ae = this.x14w_1.hashCode();
    ae = pn(ae, 31) + $l(this.y14w_1) | 0;
    return ae = pn(ae, 31) + $l(this.z14w_1) | 0;
};
$n(CheckAllowanceInput).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof CheckAllowanceInput)) {
        return false;
    }
    const pe = ae instanceof CheckAllowanceInput ? ae : Tn();
    return !!this.x14w_1.equals(pe.x14w_1) && this.y14w_1 === pe.y14w_1 && this.z14w_1 === pe.z14w_1;
};
$n(TokenServiceProviderImpl).mjc = function() {
    return this.y14x_1;
};
$n(TokenServiceProviderImpl).zjc = function(ae, pe) {
    return this.x14x_1.zjc(ae, pe);
};
$n(VaultsModule).b14z = function() {
    const r14x_1 = this.r14x_1;
    (function vaultsTransactionBuilder$factory_0() {
        return xl("vaultsTransactionBuilder", 1, Ol, function(ae) {
            return ae.b14z();
        }, null);
    })();
    return r14x_1.f1();
};
$n(VaultsModule).c14z = function() {
    const s14x_1 = this.s14x_1;
    (function vaultsBalanceService$factory_0() {
        return xl("vaultsBalanceService", 1, Ol, function(ae) {
            return ae.c14z();
        }, null);
    })();
    return s14x_1.f1();
};
$n(VaultsModule).a14z = function() {
    const u14x_1 = this.u14x_1;
    (function vaultsService$factory_0() {
        return xl("vaultsService", 1, Ol, function(ae) {
            return ae.a14z();
        }, null);
    })();
    return u14x_1.f1();
};
$n(VaultsModule).d14z = function() {
    const w14x_1 = this.w14x_1;
    (function stablecoinServiceProvider$factory() {
        return xl("stablecoinServiceProvider", 1, Ol, function(ae) {
            return ae.d14z();
        }, null);
    })();
    return w14x_1.f1();
};
$n($checkAllowanceCOROUTINE$13).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.t14z_1 = this.p14z_1;
                    this.u14z_1 = this.q14z_1.mjo_1;
                    this.v14z_1 = "eth_call";
                    this.w14z_1 = buildJsonRPCRequestParams(this.p14z_1, this.r14z_1, aw().oqj(Fw(this.q14z_1), Lw(this.s14z_1, this.q14z_1.ojo())));
                    this.x14z_1 = this.t14z_1;
                    this.y14z_1 = this.u14z_1;
                    this.z14z_1 = this.v14z_1;
                    this.a150_1 = this.w14z_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.x14z_1.uli(this.y14z_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.b150_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.x14z_1.jpo(this.b150_1, this.z14z_1, this.a150_1, VaultsRpcClient$checkAllowance$lambda(this.x14z_1), On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1;
                    if (pe === "0x") {
                        return ow().n8s_1;
                    }
                    return Uw(pe);
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
$n(VaultsRpcClient).f150 = function(ae, pe, ye, es) {
    const ss = new $checkAllowanceCOROUTINE$13(this, ae, pe, ye, es);
    ss.pa_1 = fn;
    ss.qa_1 = null;
    return ss.va();
};
$n(VaultsServiceImpl$getVaults$slambda$slambda).x150 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl$getVaults$slambda$slambda).hb = function(ae, pe) {
    return this.x150(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsServiceImpl$getVaults$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.r150_1 = this.q150_1;
                    this.s150_1 = this.r150_1;
                    this.oa_1 = 2;
                    this.u150_1 = Mn;
                    this.v150_1 = this.s150_1;
                    this.w150_1 = this.v150_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.o150_1.c14s(this.p150_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.u150_1;
                    this.t150_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.t150_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.t150_1;
                    const ns = Un();
                    s: do {
                        if (Bn(ss)) {
                            es = ns;
                            break s;
                        }
                        const ts = Cn(ss);
                        es = ts == null || ts != null ? ts : Tn();
                    }while (0)
                    return es;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(VaultsServiceImpl$getVaults$slambda$slambda).g1w = function(ae, pe) {
    const ye = new VaultsServiceImpl$getVaults$slambda$slambda(this.o150_1, this.p150_1, pe);
    ye.q150_1 = ae;
    return ye;
};
$n(VaultsServiceImpl$getVaults$slambda$slambda_1).x150 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl$getVaults$slambda$slambda_1).hb = function(ae, pe) {
    return this.x150(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsServiceImpl$getVaults$slambda$slambda_1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.k151_1 = this.j151_1;
                    this.l151_1 = this.k151_1;
                    this.oa_1 = 2;
                    this.n151_1 = Mn;
                    this.o151_1 = this.l151_1;
                    this.p151_1 = this.o151_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.g151_1.f14s(this.h151_1, this.i151_1.slice(), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.n151_1;
                    this.m151_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.m151_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.m151_1;
                    const ns = Un();
                    s: do {
                        if (Bn(ss)) {
                            es = ns;
                            break s;
                        }
                        const ts = Cn(ss);
                        es = ts == null || ts != null ? ts : Tn();
                    }while (0)
                    return es;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(VaultsServiceImpl$getVaults$slambda$slambda_1).g1w = function(ae, pe) {
    const ye = new VaultsServiceImpl$getVaults$slambda$slambda_1(this.g151_1, this.h151_1, this.i151_1, pe);
    ye.j151_1 = ae;
    return ye;
};
$n(VaultsServiceImpl$getPositions$slambda$slambda).v14q = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl$getPositions$slambda$slambda).hb = function(ae, pe) {
    return this.v14q(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsServiceImpl$getPositions$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.c152_1 = this.b152_1;
                    this.d152_1 = this.c152_1;
                    this.oa_1 = 2;
                    this.f152_1 = Mn;
                    this.g152_1 = this.d152_1;
                    this.h152_1 = this.g152_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.y151_1.h14s(this.z151_1, this.a152_1.slice(), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.f152_1;
                    this.e152_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.e152_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.e152_1;
                    const ns = Un();
                    s: do {
                        if (Bn(ss)) {
                            es = ns;
                            break s;
                        }
                        const ts = Cn(ss);
                        es = ts == null || ts != null ? ts : Tn();
                    }while (0)
                    return es;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(VaultsServiceImpl$getPositions$slambda$slambda).g1w = function(ae, pe) {
    const ye = new VaultsServiceImpl$getPositions$slambda$slambda(this.y151_1, this.z151_1, this.a152_1, pe);
    ye.b152_1 = ae;
    return ye;
};
$n(VaultsServiceImpl$getVaults$slambda).x150 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl$getVaults$slambda).hb = function(ae, pe) {
    return this.x150(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsServiceImpl$getVaults$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.o153_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.q153_1 = pa_1;
                    this.na_1 = 2;
                    const pe = this.o153_1.k152_1.z2();
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.p153_1, On, On, VaultsServiceImpl$getVaults$slambda$slambda_0(ss, this.q153_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return Jt(pa_1);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 3) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(VaultsServiceImpl$getVaults$slambda).g1w = function(ae, pe) {
    const ye = new VaultsServiceImpl$getVaults$slambda(this.o153_1, pe);
    ye.p153_1 = ae;
    return ye;
};
$n(VaultsServiceImpl$getVaults$slambda_1).x150 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl$getVaults$slambda_1).hb = function(ae, pe) {
    return this.x150(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsServiceImpl$getVaults$slambda_1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.z153_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.c154_1 = pa_1;
                    this.na_1 = 2;
                    const pe = this.z153_1.k152_1.z2();
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.b154_1, On, On, VaultsServiceImpl$getVaults$slambda$slambda_2(ss, this.c154_1, this.a154_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return Jt(pa_1);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 3) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(VaultsServiceImpl$getVaults$slambda_1).g1w = function(ae, pe) {
    const ye = new VaultsServiceImpl$getVaults$slambda_1(this.z153_1, this.a154_1, pe);
    ye.b154_1 = ae;
    return ye;
};
$n(VaultsServiceImpl$getPositions$slambda).v14q = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl$getPositions$slambda).hb = function(ae, pe) {
    return this.v14q(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(VaultsServiceImpl$getPositions$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    if (this.l154_1.length === 0) {
                        return Un();
                    }
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.m154_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.o154_1 = pa_1;
                    this.na_1 = 2;
                    const pe = this.m154_1.k152_1.z2();
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.n154_1, On, On, VaultsServiceImpl$getPositions$slambda$slambda_0(ss, this.o154_1, this.l154_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return Jt(pa_1);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 3) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(VaultsServiceImpl$getPositions$slambda).g1w = function(ae, pe) {
    const ye = new VaultsServiceImpl$getPositions$slambda(this.l154_1, this.m154_1, pe);
    ye.n154_1 = ae;
    return ye;
};
$n($doesAssetHaveBonusRewardsCOROUTINE$14).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.x154_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    let pe;
                    const ye = pa_1.j14w(this.y154_1);
                    s: do {
                        if (!!jn(ye, Vw) && ye.u()) {
                            pe = false;
                            break s;
                        }
                        for(const es = ye.k(); es.l();){
                            if (es.m().e147_1 instanceof ExclusiveRewards_2) {
                                pe = true;
                                break s;
                            }
                        }
                        pe = false;
                    }while (0)
                    return pe;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ss = error;
            if (this.oa_1 === 2) {
                throw ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ss;
        }
    }
};
$n($createVaultApprovalTransactionCOROUTINE$15).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    requireVaultAndAccountMatchingChainId(this.h155_1, this.k155_1, this.l155_1);
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.h155_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.n155_1 = pa_1;
                    this.o155_1 = getVaultProviderService(this.h155_1, this.k155_1);
                    this.na_1 = 2;
                    if ((pa_1 = this.o155_1.i14s(this.n155_1, this.i155_1, this.j155_1, this.k155_1, this.l155_1, this.m155_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1;
                    return toTransaction(this.h155_1, pe, this.l155_1);
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
$n($isAssetSupportedCOROUTINE$16).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.x155_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return !pa_1.j14w(this.y155_1).u();
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
$n($checkAllowanceOrThrowCOROUTINE$17).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.a153_1 = this.y152_1;
                    this.b153_1 = this.a153_1;
                    this.oa_1 = 2;
                    this.d153_1 = Mn;
                    this.e153_1 = this.b153_1;
                    this.f153_1 = this.e153_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.f153_1.j152_1.f150(this.z152_1.x14w_1, this.z152_1.y14w_1, this.z152_1.z14w_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.d153_1;
                    this.c153_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.c153_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const es = this.c153_1;
                    const ss = An(es);
                    if (ss != null) {
                        const ns = ss.message;
                        throw new AllowanceCheckFailed(ns ?? "Allowance check failed");
                    }
                    const ts = Cn(es);
                    if (ts == null || ts != null) {
                        return ts;
                    }
                    return Tn();
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 3) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n($getDepositAllowanceCOROUTINE$18).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    requireVaultAndAccountMatchingChainId(this.h156_1, this.i156_1, this.j156_1);
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.h156_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.k156_1 = pa_1;
                    this.l156_1 = getVaultProviderService(this.h156_1, this.i156_1);
                    this.na_1 = 2;
                    if ((pa_1 = this.l156_1.j14s(this.k156_1, this.i156_1, this.j156_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.m156_1 = pa_1;
                    this.na_1 = 3;
                    if ((pa_1 = checkAllowanceOrThrow(this.h156_1, this.m156_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    const pe = pa_1;
                    return new Hw(this.i156_1, this.j156_1, pe);
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
$n($getWithdrawAllowanceCOROUTINE$19).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    requireVaultAndAccountMatchingChainId(this.v156_1, this.w156_1, this.x156_1);
                    this.na_1 = 1;
                    if ((pa_1 = getOptimizedVaultsConfigOrThrow(this.v156_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.y156_1 = pa_1;
                    this.z156_1 = getVaultProviderService(this.v156_1, this.w156_1);
                    this.na_1 = 2;
                    if ((pa_1 = this.z156_1.k14s(this.y156_1, this.w156_1, this.x156_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.a157_1 = pa_1;
                    this.na_1 = 3;
                    if ((pa_1 = checkAllowanceOrThrow(this.v156_1, this.a157_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    const pe = pa_1;
                    return new Hw(this.w156_1, this.x156_1, pe);
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
$n($buildToggleDefaultOperatorTransactionOrThrowCOROUTINE$20).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.na_1 = 1;
                    if ((pa_1 = this.j157_1.m157(this.k157_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.l157_1 = pa_1;
                    if (this.l157_1) {
                        throw new OperatorAlreadyApproved(this.j157_1.o152_1);
                    }
                    this.na_1 = 2;
                    if ((pa_1 = this.j157_1.n152_1.n157(this.k157_1, this.j157_1.o152_1, this.j157_1.p152_1, this)) === Rn()) {
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
$n(VaultsServiceImpl).q157 = function(ae) {
    return Hn(function VaultsServiceImpl$getVaults$slambda_0(ae, pe) {
        const ye = new VaultsServiceImpl$getVaults$slambda(ae, pe);
        const l = function(ae, pe) {
            return ye.x150(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, null), ae);
};
$n(VaultsServiceImpl).r157 = function(ae, pe) {
    return Hn(function VaultsServiceImpl$getVaults$slambda_2(ae, pe, ye) {
        const es = new VaultsServiceImpl$getVaults$slambda_1(ae, pe, ye);
        const l = function(ae, pe) {
            return es.x150(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, null), pe);
};
$n(VaultsServiceImpl).s157 = function(ae, pe) {
    return lw(function VaultsServiceImpl$getPositions$slambda_0(ae, pe, ye) {
        const es = new VaultsServiceImpl$getPositions$slambda(ae, pe, ye);
        const l = function(ae, pe) {
            return es.v14q(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(ae, this, null), pe);
};
$n(VaultsServiceImpl).t157 = function(ae, pe) {
    const ye = new $doesAssetHaveBonusRewardsCOROUTINE$14(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl).u157 = function(ae, pe, ye, es, ss, ns) {
    const ts = new $createVaultApprovalTransactionCOROUTINE$15(this, ae, pe, ye, es, ss, ns);
    ts.pa_1 = fn;
    ts.qa_1 = null;
    return ts.va();
};
$n(VaultsServiceImpl).v157 = function(ae, pe) {
    const ye = new $isAssetSupportedCOROUTINE$16(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl).w157 = function(ae, pe, ye) {
    const es = new $getDepositAllowanceCOROUTINE$18(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(VaultsServiceImpl).x157 = function(ae, pe, ye) {
    const es = new $getWithdrawAllowanceCOROUTINE$19(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(VaultsServiceImpl).y157 = function(ae) {
    return this.l152_1.y157(ae);
};
$n(VaultsServiceImpl).m157 = function(ae, pe) {
    return this.n152_1.z157(ae, this.o152_1, this.p152_1, pe);
};
$n(VaultsServiceImpl).a158 = function(ae, pe) {
    const ye = new $buildToggleDefaultOperatorTransactionOrThrowCOROUTINE$20(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsServiceImpl).b158 = function() {
    return this.o152_1;
};
$n($getValidatorsCOROUTINE$21).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.k158_1.z14x_1.r157([
                        this.l158_1
                    ], this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    return toValidators(this.k158_1, pe);
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
$n($getDelegationsCOROUTINE$22).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.na_1 = 1;
                    if ((pa_1 = this.u158_1.z14x_1.s157([
                        this.v158_1.vjo()
                    ], this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.w158_1 = pa_1;
                    const pe = this.w158_1;
                    const ye = Zn();
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        if (Wt(ss.zkc().ukb().skc_1, this.v158_1.wjo(), true)) {
                            ye.e(ss);
                        }
                    }
                    this.x158_1 = ye;
                    this.na_1 = 2;
                    if ((pa_1 = this.u158_1.slp(this.v158_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    let ns;
                    const ts = pa_1;
                    const rs = this.x158_1;
                    const os = Xn(Kn(rs, 10));
                    for(const as = rs.k(); as.l();){
                        const cs = as.m();
                        os.e(toDelegation(this.u158_1, cs));
                    }
                    s: do {
                        const us = ts.k();
                        if (!us.l()) {
                            throw rm();
                        }
                        let ls = us.m();
                        if (!us.l()) {
                            ns = ls;
                            break s;
                        }
                        const ms = ls.qk1_1;
                        const gs = ms == null ? null : ms.gk1_1;
                        let ds = gs ?? Zr().c8t_1;
                        do {
                            const _s = us.m();
                            const hs = _s.qk1_1;
                            const vs = hs == null ? null : hs.gk1_1;
                            const ps = vs ?? Zr().c8t_1;
                            if (om(ds, ps) < 0) {
                                ls = _s;
                                ds = ps;
                            }
                        }while (us.l())
                        ns = ls;
                    }while (0)
                    return new im(os, ns.qk1_1);
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const fs = error;
            if (this.oa_1 === 3) {
                throw fs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = fs;
        }
    }
};
$n($getMinAmountCOROUTINE$23).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.g159_1.slp(this.h159_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    let pe;
                    const ye = pa_1;
                    s: do {
                        const es = ye.k();
                        if (!es.l()) {
                            throw rm();
                        }
                        let ss = es.m();
                        if (!es.l()) {
                            pe = ss;
                            break s;
                        }
                        const ns = ss.qk1_1;
                        const ts = ns == null ? null : ns.gk1_1;
                        let rs = ts ?? Zr().c8t_1;
                        do {
                            const os = es.m();
                            const as = os.qk1_1;
                            const cs = as == null ? null : as.gk1_1;
                            const us = cs ?? Zr().c8t_1;
                            if (om(rs, us) < 0) {
                                ss = os;
                                rs = us;
                            }
                        }while (es.l())
                        pe = ss;
                    }while (0)
                    const ls = pe.qk1_1;
                    const ms = ls == null ? null : ls.fk1_1;
                    return ms ?? ow().n8s_1;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const gs = error;
            if (this.oa_1 === 2) {
                throw gs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = gs;
        }
    }
};
$n(VaultsStakingService).zjc = function(ae, pe) {
    return this.z14x_1.v157(ae, pe);
};
$n(VaultsStakingService).slp = function(ae, pe) {
    const ye = new $getValidatorsCOROUTINE$21(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsStakingService).tlp = function(ae, pe) {
    const ye = new $getDelegationsCOROUTINE$22(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsStakingService).xlp = function(ae, pe) {
    const ye = new $getMinAmountCOROUTINE$23(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n($getDestinationAddressCOROUTINE$24).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.s159_1 = this.r159_1.rk6();
                    if (yl(this.s159_1, dm)) {
                        let pe;
                        const ye = this.r159_1.sk6();
                        if (ye == null) {
                            throw lm(kl("No router address provided"));
                        }
                        pe = ye;
                        this.t159_1 = pe;
                        this.na_1 = 3;
                        continue e;
                    }
                    if (yl(this.s159_1, gm)) {
                        this.na_1 = 2;
                        if ((pa_1 = this.q159_1.u159_1.v159(this.r159_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (yl(this.s159_1, mm)) {
                        this.na_1 = 1;
                        if ((pa_1 = this.q159_1.u159_1.v159(this.r159_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (yl(this.s159_1, wm)) {
                        throw lm(kl("Unknown vault provider"));
                    }
                    hw();
                    break;
                case 1:
                case 2:
                    this.t159_1 = pa_1;
                    this.na_1 = 3;
                    continue e;
                case 3:
                    return this.t159_1;
                case 4:
                    throw this.qa_1;
            }
        } catch (error) {
            const es = error;
            if (this.oa_1 === 4) {
                throw es;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = es;
        }
    }
};
$n(VaultsToAddressProvider).v159 = function(ae, pe) {
    return function getDestinationAddress(ae, pe, ye) {
        const es = new $getDestinationAddressCOROUTINE$24(ae, pe, ye);
        es.pa_1 = fn;
        es.qa_1 = null;
        return es.va();
    }(this, ae, pe);
};
$n(VaultsToAddressProvider).du1 = function(ae, pe) {
    return this.v159(jn(ae, _m) ? ae : Tn(), pe);
};
$n($buildDepositSigningInputCOROUTINE$25).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.g15a_1 = this.e15a_1.i15a_1.x2(toConfig(this.f15a_1.nk6_1));
                    if (this.g15a_1 == null) {
                        this.h15a_1 = null;
                        this.na_1 = 2;
                        continue e;
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.g15a_1.elq(this.f15a_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.h15a_1 = pa_1;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    const pe = this.h15a_1;
                    if (pe == null) {
                        throw new UnsupportedVaultProvider(this.f15a_1.nk6_1);
                    }
                    return pe;
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
$n($buildWithdrawSigningInputCOROUTINE$26).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.t15a_1 = this.r15a_1.i15a_1.x2(toConfig(this.s15a_1.wk6_1));
                    if (this.t15a_1 == null) {
                        this.u15a_1 = null;
                        this.na_1 = 2;
                        continue e;
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.t15a_1.flq(this.s15a_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.u15a_1 = pa_1;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    const pe = this.u15a_1;
                    if (pe == null) {
                        throw new UnsupportedVaultProvider(this.s15a_1.wk6_1);
                    }
                    return pe;
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
$n($buildClaimSigningInputCOROUTINE$27).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.f15b_1 = this.d15b_1.i15a_1.x2(toConfig(this.e15b_1.dk7_1));
                    if (this.f15b_1 == null) {
                        this.g15b_1 = null;
                        this.na_1 = 2;
                        continue e;
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.f15b_1.glq(this.e15b_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.g15b_1 = pa_1;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    const pe = this.g15b_1;
                    if (pe == null) {
                        throw new UnsupportedVaultProvider(this.e15b_1.dk7_1);
                    }
                    return pe;
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
$n(VaultsTransactionBuilderImpl).elq = function(ae, pe) {
    const ye = new $buildDepositSigningInputCOROUTINE$25(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsTransactionBuilderImpl).flq = function(ae, pe) {
    const ye = new $buildWithdrawSigningInputCOROUTINE$26(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(VaultsTransactionBuilderImpl).glq = function(ae, pe) {
    const ye = new $buildClaimSigningInputCOROUTINE$27(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(OptimizedVaultsConfig).m14u = function(ae) {
    const pe = this.l148_1.x2(ae);
    return pe ?? Un();
};
$n(OptimizedVaultsConfig).n14u = function(ae, pe) {
    const ye = Zn();
    for(let es = 0, ss = pe.length; es < ss;){
        const ns = pe[es];
        es = es + 1 | 0;
        Kr(ye, this.j14w(ns));
    }
    const ts = Zn();
    for(const rs = ye.k(); rs.l();){
        const os = rs.m();
        if (yl(os.f147_1, ae)) {
            ts.e(os);
        }
    }
    return vm(ts);
};
$n(OptimizedVaultsConfig).j14w = function(ae) {
    const m148_1 = this.m148_1;
    const ye = Jn();
    for(const es = m148_1.d1().k(); es.l();){
        const ss = es.m();
        const ns = ss.e1();
        if (Wt(ns.h15b_1, ae.wjo(), true) && ns.i15b_1 === ae.vjo().ojo().nil()) {
            ye.a3(ss.e1(), ss.f1());
        }
    }
    const ts = Zn();
    for(const rs = ye.d1().k(); rs.l();){
        Kr(ts, rs.m().f1());
    }
    return ts;
};
$n(OptimizedVaultsConfig).p148 = function(ae, pe) {
    const ye = this.j14w(ae);
    const es = Zn();
    for(const ss = ye.k(); ss.l();){
        const ns = ss.m();
        if (yl(ns.f147_1, pe)) {
            es.e(ns);
        }
    }
    return es;
};
$n(OptimizedVaultsConfig).m14s = function(ae) {
    return this.o148_1.x2(toAngleRoutersByChainKey(ae));
};
$n(OptimizedVaultsConfig).o14r = function(ae) {
    return this.n148_1.x2(toVaultsByIdKey(ae));
};
$n(OptimizedVaultsConfig).toString = function() {
    return `OptimizedVaultsConfig(vaultsByProvider=${kl(this.l148_1)}, vaultsByAssetAddressAndChainId=${kl(this.m148_1)}, vaultsById=${kl(this.n148_1)}, angleRoutersByChain=${kl(this.o148_1)})`;
};
$n(OptimizedVaultsConfig).hashCode = function() {
    let ae = Ml(this.l148_1);
    ae = pn(ae, 31) + Ml(this.m148_1) | 0;
    ae = pn(ae, 31) + Ml(this.n148_1) | 0;
    return ae = pn(ae, 31) + Ml(this.o148_1) | 0;
};
$n(OptimizedVaultsConfig).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof OptimizedVaultsConfig)) {
        return false;
    }
    const pe = ae instanceof OptimizedVaultsConfig ? ae : Tn();
    return !!yl(this.l148_1, pe.l148_1) && !!yl(this.m148_1, pe.m148_1) && !!yl(this.n148_1, pe.n148_1) && !!yl(this.o148_1, pe.o148_1);
};
$n(AssetAddressAndChainId).toString = function() {
    return `AssetAddressAndChainId(assetAddress=${this.h15b_1}, chainId=${this.i15b_1})`;
};
$n(AssetAddressAndChainId).hashCode = function() {
    let ae = $l(this.h15b_1);
    return ae = pn(ae, 31) + $l(this.i15b_1) | 0;
};
$n(AssetAddressAndChainId).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof AssetAddressAndChainId)) {
        return false;
    }
    const pe = ae instanceof AssetAddressAndChainId ? ae : Tn();
    return this.h15b_1 === pe.h15b_1 && this.i15b_1 === pe.i15b_1;
};
$n(BackoffState).toString = function() {
    return `BackoffState(backoffUntil=${this.j15b_1.toString()}, lastError=${Rl(this.k15b_1)}, lastSuccessfulConfig=${Rl(this.l15b_1)})`;
};
$n(BackoffState).hashCode = function() {
    let ae = this.j15b_1.hashCode();
    ae = pn(ae, 31) + (this.k15b_1 == null ? 0 : Ml(this.k15b_1)) | 0;
    return ae = pn(ae, 31) + (this.l15b_1 == null ? 0 : this.l15b_1.hashCode()) | 0;
};
$n(BackoffState).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof BackoffState)) {
        return false;
    }
    const pe = ae instanceof BackoffState ? ae : Tn();
    return !!this.j15b_1.equals(pe.j15b_1) && !!yl(this.k15b_1, pe.k15b_1) && !!yl(this.l15b_1, pe.l15b_1);
};
$n($getOptimizedVaultsConfigOrThrowCOROUTINE$28).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 8;
                    const pe = getOptimizedVaultsConfigLocalCache(this.h15c_1);
                    if (pe != null) {
                        return pe;
                    }
                    this.i15c_1 = this.h15c_1.s14b_1;
                    if (isWithinErrorBackoff(this.h15c_1, this.i15c_1)) {
                        return getStaleConfigOrThrow(this.h15c_1, this.i15c_1);
                    }
                    this.j15c_1 = this.h15c_1.r14b_1;
                    this.k15c_1 = this.j15c_1;
                    this.l15c_1 = null;
                    this.na_1 = 1;
                    if ((pa_1 = this.k15c_1.w35(this.l15c_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.m15c_1 = fn;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    this.oa_1 = 7;
                    this.n15c_1 = getOptimizedVaultsConfigLocalCache(this.h15c_1);
                    if (this.n15c_1 == null) {
                        this.p15c_1 = this.h15c_1;
                        this.q15c_1 = this.p15c_1;
                        this.r15c_1 = this.q15c_1;
                        this.s15c_1 = this.r15c_1;
                        this.t15c_1 = this.s15c_1.s14b_1;
                        if (isWithinErrorBackoff(this.s15c_1, this.t15c_1)) {
                            this.u15c_1 = getStaleConfigOrThrow(this.s15c_1, this.t15c_1);
                            this.na_1 = 4;
                            continue e;
                        }
                        this.na_1 = 3;
                        if ((pa_1 = loadWithFallback(this.s15c_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.o15c_1 = this.n15c_1;
                    this.na_1 = 5;
                    continue e;
                case 3:
                    this.u15c_1 = pa_1;
                    this.na_1 = 4;
                    continue e;
                case 4:
                    this.o15c_1 = this.u15c_1;
                    this.na_1 = 5;
                    continue e;
                case 5:
                    this.m15c_1 = this.o15c_1;
                    this.oa_1 = 8;
                    this.na_1 = 6;
                    continue e;
                case 6:
                    const ye = this.m15c_1;
                    this.oa_1 = 8;
                    this.k15c_1.x35(this.l15c_1);
                    return ye;
                case 7:
                    this.oa_1 = 8;
                    const es = this.qa_1;
                    this.k15c_1.x35(this.l15c_1);
                    throw es;
                case 8:
                    throw this.qa_1;
            }
        } catch (error) {
            const ss = error;
            if (this.oa_1 === 8) {
                throw ss;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ss;
        }
    }
};
$n($loadWithFallbackCOROUTINE$29).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.v15b_1 = this.u15b_1.t14b_1;
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.u15b_1.p14b_1.z15c(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = toOptimised(pa_1);
                    if (this.v15b_1.equals(this.u15b_1.t14b_1)) {
                        this.u15b_1.aiq("optimized_vaults_config", pe);
                        this.u15b_1.s14b_1 = new BackoffState(On, On, pe);
                    }
                    this.w15b_1 = pe;
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof pm) {
                        throw this.qa_1;
                    }
                    if (this.qa_1 instanceof Error) {
                        let ye;
                        const es = this.qa_1;
                        if (!this.v15b_1.equals(this.u15b_1.t14b_1)) {
                            throw es;
                        }
                        const ss = this.u15b_1.s14b_1;
                        this.u15b_1.s14b_1 = new BackoffState(this.u15b_1.q14b_1.t53().m3(new Al(30000, 0)), es, ss.l15b_1);
                        const ns = ss.l15b_1;
                        if (ns == null) {
                            throw es;
                        }
                        ye = ns;
                        this.w15b_1 = ye;
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    return this.w15b_1;
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
$n(OptimizedVaultsConfigCache).u14b = function(ae) {
    const pe = new $getOptimizedVaultsConfigOrThrowCOROUTINE$28(this, ae);
    pe.pa_1 = fn;
    pe.qa_1 = null;
    return pe.va();
};
$n($loadConfigCOROUTINE$30).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    this.o15d_1 = this.n15d_1.h15f_1;
                    this.p15d_1 = `${this.n15d_1.i15f_1.n14w()}/v1/invests/stablecoin/config`;
                    this.q15d_1 = this.o15d_1;
                    this.r15d_1 = this.p15d_1;
                    this.s15d_1 = this.q15d_1;
                    this.t15d_1 = this.s15d_1;
                    this.u15d_1 = this.t15d_1;
                    const pe = new Dl;
                    Bl(pe, this.r15d_1);
                    km(RemoteVaultsConfigLoader$loadConfig$lambda);
                    this.v15d_1 = pe;
                    this.w15d_1 = this.u15d_1;
                    this.x15d_1 = this.v15d_1;
                    this.x15d_1.b79_1 = Fl().i6j_1;
                    this.y15d_1 = this.w15d_1;
                    this.z15d_1 = this.x15d_1;
                    this.a15e_1 = this.y15d_1;
                    this.b15e_1 = this.z15d_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.b15e_1, this.a15e_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.c15e_1 = pa_1;
                    this.d15e_1 = this.c15e_1;
                    this.e15e_1 = "message";
                    if (Jl(this.d15e_1.v6o())) {
                        this.oa_1 = 4;
                        this.h15e_1 = this.d15e_1;
                        this.i15e_1 = this.h15e_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.i15e_1.i7c();
                        const ss = Wl(VaultsConfigWithoutVersion);
                        try {
                            ye = Vl(Wl(VaultsConfigWithoutVersion), Gl([]), false);
                        } catch (error) {
                            if (!(error instanceof Error)) {
                                throw error;
                            }
                            ye = null;
                        }
                        if ((pa_1 = es.l7b(new Zl(ss, ye), this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.j15e_1 = this.d15e_1.v6o().c6m_1;
                    this.k15e_1 = this.d15e_1;
                    this.l15e_1 = this.e15e_1;
                    this.m15e_1 = this.k15e_1;
                    this.n15e_1 = this.l15e_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.m15e_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.o15e_1 = pa_1;
                    this.p15e_1 = Xl(this.o15e_1, this.n15e_1);
                    const ns = this.p15e_1;
                    this.q15e_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.j15e_1, this.q15e_1);
                case 3:
                    this.g15e_1 = pa_1 instanceof VaultsConfigWithoutVersion ? pa_1 : Tn();
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 9;
                    if (this.qa_1 instanceof nw) {
                        this.r15e_1 = this.qa_1;
                        this.s15e_1 = this.d15e_1.v6o().c6m_1;
                        this.t15e_1 = this.d15e_1;
                        this.u15e_1 = this.e15e_1;
                        this.v15e_1 = this.t15e_1;
                        this.w15e_1 = this.u15e_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.v15e_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.x15e_1 = this.qa_1;
                        this.y15e_1 = this.d15e_1.v6o().c6m_1;
                        this.z15e_1 = this.d15e_1;
                        this.a15f_1 = this.e15e_1;
                        this.b15f_1 = this.z15e_1;
                        this.c15f_1 = this.a15f_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.b15f_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.w15e_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.s15e_1, rs, this.r15e_1);
                case 6:
                    const os = Xl(pa_1, this.c15f_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.y15e_1, as, this.x15e_1);
                case 7:
                    this.oa_1 = 9;
                    this.f15e_1 = this.g15e_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    const cs = this.f15e_1;
                    return toVaultsConfigWithVersion(this.n15d_1, cs);
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 9) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
$n(RemoteVaultsConfigLoader).j15f = function(ae) {
    const pe = new $loadConfigCOROUTINE$30(this, ae);
    pe.pa_1 = fn;
    pe.qa_1 = null;
    return pe.va();
};
$n($loadConfigAndApplyFiltersOrThrowCOROUTINE$31).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.w15f_1.j15f(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    return applyFilters(this.w15f_1, pe);
                case 2:
                    this.oa_1 = 3;
                    throw this.qa_1 instanceof pm ? this.qa_1 : this.qa_1 instanceof Error ? (this.qa_1, new InvalidConfig) : this.qa_1;
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
$n(VaultsConfigLoader).z15c = function(ae) {
    const pe = new $loadConfigAndApplyFiltersOrThrowCOROUTINE$31(this, ae);
    pe.pa_1 = fn;
    pe.qa_1 = null;
    return pe.va();
};
$n(Kiln_0).j56 = function() {
    return function _get_$cachedSerializer__te6jhj(ae) {
        return ae.f15g_1.f1();
    }(this);
};
$n(Kiln_0).k40 = function(ae) {
    return this.j56();
};
$n(Kiln_0).toString = function() {
    return "Kiln";
};
$n(Kiln_0).hashCode = function() {
    return -1564308877;
};
$n(Kiln_0).equals = function(ae) {
    return this === ae || ae instanceof Kiln_0 && (ae instanceof Kiln_0 || Tn(), true);
};
$n(Angle_0).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_0(ae) {
        return ae.g15g_1.f1();
    }(this);
};
$n(Angle_0).k40 = function(ae) {
    return this.j56();
};
$n(Angle_0).toString = function() {
    return "Angle";
};
$n(Angle_0).hashCode = function() {
    return -1258025952;
};
$n(Angle_0).equals = function(ae) {
    return this === ae || ae instanceof Angle_0 && (ae instanceof Angle_0 || Tn(), true);
};
$n(Yield_0).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_1(ae) {
        return ae.h15g_1.f1();
    }(this);
};
$n(Yield_0).k40 = function(ae) {
    return this.j56();
};
$n(Yield_0).toString = function() {
    return "Yield";
};
$n(Yield_0).hashCode = function() {
    return -1236012326;
};
$n(Yield_0).equals = function(ae) {
    return this === ae || ae instanceof Yield_0 && (ae instanceof Yield_0 || Tn(), true);
};
$n(Unknown).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_2(ae) {
        return ae.i15g_1.f1();
    }(this);
};
$n(Unknown).k40 = function(ae) {
    return this.j56();
};
$n(Unknown).toString = function() {
    return "Unknown";
};
$n(Unknown).hashCode = function() {
    return -1503158185;
};
$n(Unknown).equals = function(ae) {
    return this === ae || ae instanceof Unknown && (ae instanceof Unknown || Tn(), true);
};
$n(Companion_10).n15g = function(ae) {
    switch(ae){
        case "Kiln":
            return Kiln_getInstance();
        case "Angle":
            return Angle_getInstance();
        case "Yield":
            return Yield_getInstance();
        default:
            return Unknown_getInstance();
    }
};
$n(Companion_10).o15g = function(ae) {
    let pe;
    if (yl(ae, Kiln_getInstance())) {
        pe = "Kiln";
    } else if (yl(ae, Angle_getInstance())) {
        pe = "Angle";
    } else if (yl(ae, Yield_getInstance())) {
        pe = "Yield";
    } else if (yl(ae, Unknown_getInstance())) {
        pe = "Unknown";
    } else {
        hw();
    }
    return pe;
};
$n(Companion_10).j56 = function() {
    return VaultProviderSerializer_getInstance();
};
$n(Companion_10).k40 = function(ae) {
    return this.j56();
};
$n($serializer_8).r15g = function(ae, pe) {
    const q15g_1 = this.q15g_1;
    const es = ae.w3r(q15g_1);
    const p15g_1 = Companion_getInstance_16().p15g_1;
    es.f3t(q15g_1, 0, pe.k15f_1);
    es.m3t(q15g_1, 1, p15g_1[1].f1(), pe.l15f_1);
    es.m3t(q15g_1, 2, p15g_1[2].f1(), pe.m15f_1);
    es.x3r(q15g_1);
};
$n($serializer_8).v3o = function(ae, pe) {
    return this.r15g(ae, pe instanceof VaultsConfig ? pe : Tn());
};
$n($serializer_8).w3o = function(ae) {
    const q15g_1 = this.q15g_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = 0;
    let ts = null;
    let rs = null;
    const os = ae.w3r(q15g_1);
    const p15g_1 = Companion_getInstance_16().p15g_1;
    if (os.l3s()) {
        ns = os.b3s(q15g_1, 0);
        ss |= 1;
        ts = os.i3s(q15g_1, 1, p15g_1[1].f1(), ts);
        ss |= 2;
        rs = os.i3s(q15g_1, 2, p15g_1[2].f1(), rs);
        ss |= 4;
    } else {
        while(ye){
            switch(es = os.m3s(q15g_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = os.b3s(q15g_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = os.i3s(q15g_1, 1, p15g_1[1].f1(), ts);
                    ss |= 2;
                    break;
                case 2:
                    rs = os.i3s(q15g_1, 2, p15g_1[2].f1(), rs);
                    ss |= 4;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    os.x3r(q15g_1);
    return function VaultsConfig_init_$Create$(ae, pe, ye, es, ss) {
        return function VaultsConfig_init_$Init$(ae, pe, ye, es, ss, ns) {
            if (7 & ~ae) {
                pl(ae, 7, $serializer_getInstance_8().q15g_1);
            }
            ns.k15f_1 = pe;
            ns.l15f_1 = ye;
            ns.m15f_1 = es;
            return ns;
        }(ae, pe, ye, es, 0, fl($n(VaultsConfig)));
    }(ss, ns, ts, rs);
};
$n($serializer_8).i3o = function() {
    return this.q15g_1;
};
$n($serializer_8).z3z = function() {
    const p15g_1 = Companion_getInstance_16().p15g_1;
    return [
        Tl(),
        p15g_1[1].f1(),
        p15g_1[2].f1()
    ];
};
$n(VaultsConfig).s15g = function(ae, pe, ye) {
    return new VaultsConfig(ae, pe, ye);
};
$n(VaultsConfig).n15f = function(ae, pe, ye, es) {
    ae = ae === On ? this.k15f_1 : ae;
    pe = pe === On ? this.l15f_1 : pe;
    ye = ye === On ? this.m15f_1 : ye;
    if (es === On) {
        return this.s15g(ae, pe, ye);
    }
    return es.s15g.call(this, ae, pe, ye);
};
$n(VaultsConfig).toString = function() {
    return `VaultsConfig(version=${this.k15f_1}, angleRouters=${kl(this.l15f_1)}, vaults=${kl(this.m15f_1)})`;
};
$n(VaultsConfig).hashCode = function() {
    let k15f_1 = this.k15f_1;
    k15f_1 = pn(k15f_1, 31) + Ml(this.l15f_1) | 0;
    return k15f_1 = pn(k15f_1, 31) + Ml(this.m15f_1) | 0;
};
$n(VaultsConfig).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof VaultsConfig)) {
        return false;
    }
    const pe = ae instanceof VaultsConfig ? ae : Tn();
    return this.k15f_1 === pe.k15f_1 && !!yl(this.l15f_1, pe.l15f_1) && !!yl(this.m15f_1, pe.m15f_1);
};
$n($serializer_9).v15g = function(ae, pe) {
    const u15g_1 = this.u15g_1;
    const es = ae.w3r(u15g_1);
    const t15g_1 = Companion_getInstance_17().t15g_1;
    es.m3t(u15g_1, 0, t15g_1[0].f1(), pe.a15d_1);
    es.m3t(u15g_1, 1, t15g_1[1].f1(), pe.b15d_1);
    es.x3r(u15g_1);
};
$n($serializer_9).v3o = function(ae, pe) {
    return this.v15g(ae, pe instanceof VaultsConfigWithoutVersion ? pe : Tn());
};
$n($serializer_9).w3o = function(ae) {
    const u15g_1 = this.u15g_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    const rs = ae.w3r(u15g_1);
    const t15g_1 = Companion_getInstance_17().t15g_1;
    if (rs.l3s()) {
        ns = rs.i3s(u15g_1, 0, t15g_1[0].f1(), ns);
        ss |= 1;
        ts = rs.i3s(u15g_1, 1, t15g_1[1].f1(), ts);
        ss |= 2;
    } else {
        while(ye){
            switch(es = rs.m3s(u15g_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = rs.i3s(u15g_1, 0, t15g_1[0].f1(), ns);
                    ss |= 1;
                    break;
                case 1:
                    ts = rs.i3s(u15g_1, 1, t15g_1[1].f1(), ts);
                    ss |= 2;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    rs.x3r(u15g_1);
    return function VaultsConfigWithoutVersion_init_$Create$(ae, pe, ye, es) {
        return function VaultsConfigWithoutVersion_init_$Init$(ae, pe, ye, es, ss) {
            if (3 & ~ae) {
                pl(ae, 3, $serializer_getInstance_9().u15g_1);
            }
            ss.a15d_1 = pe;
            ss.b15d_1 = ye;
            return ss;
        }(ae, pe, ye, 0, fl($n(VaultsConfigWithoutVersion)));
    }(ss, ns, ts);
};
$n($serializer_9).i3o = function() {
    return this.u15g_1;
};
$n($serializer_9).z3z = function() {
    const t15g_1 = Companion_getInstance_17().t15g_1;
    return [
        t15g_1[0].f1(),
        t15g_1[1].f1()
    ];
};
$n(VaultsConfigWithoutVersion).toString = function() {
    return `VaultsConfigWithoutVersion(angleRouters=${kl(this.a15d_1)}, vaults=${kl(this.b15d_1)})`;
};
$n(VaultsConfigWithoutVersion).hashCode = function() {
    let ae = Ml(this.a15d_1);
    return ae = pn(ae, 31) + Ml(this.b15d_1) | 0;
};
$n(VaultsConfigWithoutVersion).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof VaultsConfigWithoutVersion)) {
        return false;
    }
    const pe = ae instanceof VaultsConfigWithoutVersion ? ae : Tn();
    return !!yl(this.a15d_1, pe.a15d_1) && !!yl(this.b15d_1, pe.b15d_1);
};
$n($serializer_10).x15g = function(ae, pe) {
    const w15g_1 = this.w15g_1;
    const es = ae.w3r(w15g_1);
    es.k3t(w15g_1, 0, pe.x15f_1);
    es.k3t(w15g_1, 1, pe.y15f_1);
    es.x3r(w15g_1);
};
$n($serializer_10).v3o = function(ae, pe) {
    return this.x15g(ae, pe instanceof AngleRouter ? pe : Tn());
};
$n($serializer_10).w3o = function(ae) {
    const w15g_1 = this.w15g_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    const rs = ae.w3r(w15g_1);
    if (rs.l3s()) {
        ns = rs.g3s(w15g_1, 0);
        ss |= 1;
        ts = rs.g3s(w15g_1, 1);
        ss |= 2;
    } else {
        while(ye){
            switch(es = rs.m3s(w15g_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = rs.g3s(w15g_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = rs.g3s(w15g_1, 1);
                    ss |= 2;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    rs.x3r(w15g_1);
    return function AngleRouter_init_$Create$(ae, pe, ye, es) {
        return function AngleRouter_init_$Init$(ae, pe, ye, es, ss) {
            if (3 & ~ae) {
                pl(ae, 3, $serializer_getInstance_10().w15g_1);
            }
            ss.x15f_1 = pe;
            ss.y15f_1 = ye;
            return ss;
        }(ae, pe, ye, 0, fl($n(AngleRouter)));
    }(ss, ns, ts);
};
$n($serializer_10).i3o = function() {
    return this.w15g_1;
};
