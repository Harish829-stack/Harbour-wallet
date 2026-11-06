$n($serializer_10).z3z = function() {
    return [
        ol(),
        ol()
    ];
};
$n(AngleRouter).toString = function() {
    return `AngleRouter(chainId=${this.x15f_1}, address=${this.y15f_1})`;
};
$n(AngleRouter).hashCode = function() {
    let ae = $l(this.x15f_1);
    return ae = pn(ae, 31) + $l(this.y15f_1) | 0;
};
$n(AngleRouter).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof AngleRouter)) {
        return false;
    }
    const pe = ae instanceof AngleRouter ? ae : Tn();
    return this.x15f_1 === pe.x15f_1 && this.y15f_1 === pe.y15f_1;
};
$n($serializer_11).z15g = function(ae, pe) {
    const y15g_1 = this.y15g_1;
    const es = ae.w3r(y15g_1);
    es.k3t(y15g_1, 0, pe.a147_1);
    es.k3t(y15g_1, 1, pe.b147_1);
    es.k3t(y15g_1, 2, pe.c147_1);
    es.k3t(y15g_1, 3, pe.d147_1);
    es.m3t(y15g_1, 4, VaultTypeSerializer_getInstance(), pe.e147_1);
    es.m3t(y15g_1, 5, VaultProviderSerializer_getInstance(), pe.f147_1);
    if (es.r3t(y15g_1, 6) || pe.g147_1 != null) {
        es.n3t(y15g_1, 6, Cl(), pe.g147_1);
    }
    es.k3t(y15g_1, 7, pe.h147_1);
    es.k3t(y15g_1, 8, pe.i147_1);
    es.k3t(y15g_1, 9, pe.j147_1);
    es.k3t(y15g_1, 10, pe.k147_1);
    es.n3t(y15g_1, 11, ol(), pe.l147_1);
    es.x3r(y15g_1);
};
$n($serializer_11).v3o = function(ae, pe) {
    return this.z15g(ae, pe instanceof Vault ? pe : Tn());
};
$n($serializer_11).w3o = function(ae) {
    const y15g_1 = this.y15g_1;
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
    let gs = null;
    let ds = null;
    let _s = null;
    const hs = ae.w3r(y15g_1);
    if (hs.l3s()) {
        ns = hs.g3s(y15g_1, 0);
        ss |= 1;
        ts = hs.g3s(y15g_1, 1);
        ss |= 2;
        rs = hs.g3s(y15g_1, 2);
        ss |= 4;
        os = hs.g3s(y15g_1, 3);
        ss |= 8;
        as = hs.i3s(y15g_1, 4, VaultTypeSerializer_getInstance(), as);
        ss |= 16;
        cs = hs.i3s(y15g_1, 5, VaultProviderSerializer_getInstance(), cs);
        ss |= 32;
        us = hs.k3s(y15g_1, 6, Cl(), us);
        ss |= 64;
        ls = hs.g3s(y15g_1, 7);
        ss |= 128;
        ms = hs.g3s(y15g_1, 8);
        ss |= 256;
        gs = hs.g3s(y15g_1, 9);
        ss |= 512;
        ds = hs.g3s(y15g_1, 10);
        ss |= 1024;
        _s = hs.k3s(y15g_1, 11, ol(), _s);
        ss |= 2048;
    } else {
        while(ye){
            switch(es = hs.m3s(y15g_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = hs.g3s(y15g_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = hs.g3s(y15g_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = hs.g3s(y15g_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = hs.g3s(y15g_1, 3);
                    ss |= 8;
                    break;
                case 4:
                    as = hs.i3s(y15g_1, 4, VaultTypeSerializer_getInstance(), as);
                    ss |= 16;
                    break;
                case 5:
                    cs = hs.i3s(y15g_1, 5, VaultProviderSerializer_getInstance(), cs);
                    ss |= 32;
                    break;
                case 6:
                    us = hs.k3s(y15g_1, 6, Cl(), us);
                    ss |= 64;
                    break;
                case 7:
                    ls = hs.g3s(y15g_1, 7);
                    ss |= 128;
                    break;
                case 8:
                    ms = hs.g3s(y15g_1, 8);
                    ss |= 256;
                    break;
                case 9:
                    gs = hs.g3s(y15g_1, 9);
                    ss |= 512;
                    break;
                case 10:
                    ds = hs.g3s(y15g_1, 10);
                    ss |= 1024;
                    break;
                case 11:
                    _s = hs.k3s(y15g_1, 11, ol(), _s);
                    ss |= 2048;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    hs.x3r(y15g_1);
    return function Vault_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us, ls, ms) {
        return function Vault_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us, ls, ms, gs) {
            if (4031 & ~ae) {
                pl(ae, 4031, $serializer_getInstance_11().y15g_1);
            }
            gs.a147_1 = pe;
            gs.b147_1 = ye;
            gs.c147_1 = es;
            gs.d147_1 = ss;
            gs.e147_1 = ns;
            gs.f147_1 = ts;
            gs.g147_1 = 64 & ae ? rs : null;
            gs.h147_1 = os;
            gs.i147_1 = as;
            gs.j147_1 = cs;
            gs.k147_1 = us;
            gs.l147_1 = ls;
            return gs;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us, ls, 0, fl($n(Vault)));
    }(ss, ns, ts, rs, os, as, cs, us, ls, ms, gs, ds, _s);
};
$n($serializer_11).i3o = function() {
    return this.y15g_1;
};
$n($serializer_11).z3z = function() {
    return [
        ol(),
        ol(),
        ol(),
        ol(),
        VaultTypeSerializer_getInstance(),
        VaultProviderSerializer_getInstance(),
        dl(Cl()),
        ol(),
        ol(),
        ol(),
        ol(),
        dl(ol())
    ];
};
$n(Vault).toString = function() {
    return `Vault(vaultId=${this.a147_1}, chainId=${this.b147_1}, contractAddress=${this.c147_1}, lockedAssetAddress=${this.d147_1}, type=${kl(this.e147_1)}, provider=${kl(this.f147_1)}, availableAfterTimestampInSeconds=${Rl(this.g147_1)}, iconUrl=${this.h147_1}, protocolName=${this.i147_1}, description=${this.j147_1}, website=${this.k147_1}, subtitle=${this.l147_1})`;
};
$n(Vault).hashCode = function() {
    let ae = $l(this.a147_1);
    ae = pn(ae, 31) + $l(this.b147_1) | 0;
    ae = pn(ae, 31) + $l(this.c147_1) | 0;
    ae = pn(ae, 31) + $l(this.d147_1) | 0;
    ae = pn(ae, 31) + Ml(this.e147_1) | 0;
    ae = pn(ae, 31) + Ml(this.f147_1) | 0;
    ae = pn(ae, 31) + (this.g147_1 == null ? 0 : this.g147_1.hashCode()) | 0;
    ae = pn(ae, 31) + $l(this.h147_1) | 0;
    ae = pn(ae, 31) + $l(this.i147_1) | 0;
    ae = pn(ae, 31) + $l(this.j147_1) | 0;
    ae = pn(ae, 31) + $l(this.k147_1) | 0;
    return ae = pn(ae, 31) + (this.l147_1 == null ? 0 : $l(this.l147_1)) | 0;
};
$n(Vault).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Vault)) {
        return false;
    }
    const pe = ae instanceof Vault ? ae : Tn();
    return this.a147_1 === pe.a147_1 && this.b147_1 === pe.b147_1 && this.c147_1 === pe.c147_1 && this.d147_1 === pe.d147_1 && !!yl(this.e147_1, pe.e147_1) && !!yl(this.f147_1, pe.f147_1) && !!yl(this.g147_1, pe.g147_1) && this.h147_1 === pe.h147_1 && this.i147_1 === pe.i147_1 && this.j147_1 === pe.j147_1 && this.k147_1 === pe.k147_1 && this.l147_1 == pe.l147_1;
};
$n(Normal_0).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_3(ae) {
        return ae.a15h_1.f1();
    }(this);
};
$n(Normal_0).k40 = function(ae) {
    return this.j56();
};
$n(Normal_0).toString = function() {
    return "Normal";
};
$n(Normal_0).hashCode = function() {
    return -599265071;
};
$n(Normal_0).equals = function(ae) {
    return this === ae || ae instanceof Normal_0 && (ae instanceof Normal_0 || Tn(), true);
};
$n(AutoSwap).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_4(ae) {
        return ae.b15h_1.f1();
    }(this);
};
$n(AutoSwap).k40 = function(ae) {
    return this.j56();
};
$n(AutoSwap).toString = function() {
    return "AutoSwap";
};
$n(AutoSwap).hashCode = function() {
    return -461056692;
};
$n(AutoSwap).equals = function(ae) {
    return this === ae || ae instanceof AutoSwap && (ae instanceof AutoSwap || Tn(), true);
};
$n(ExclusiveRewards_2).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_5(ae) {
        return ae.c15h_1.f1();
    }(this);
};
$n(ExclusiveRewards_2).k40 = function(ae) {
    return this.j56();
};
$n(ExclusiveRewards_2).toString = function() {
    return "ExclusiveRewards";
};
$n(ExclusiveRewards_2).hashCode = function() {
    return 1281112592;
};
$n(ExclusiveRewards_2).equals = function(ae) {
    return this === ae || ae instanceof ExclusiveRewards_2 && (ae instanceof ExclusiveRewards_2 || Tn(), true);
};
$n(Unknown_0).j56 = function() {
    return function _get_$cachedSerializer__te6jhj_6(ae) {
        return ae.d15h_1.f1();
    }(this);
};
$n(Unknown_0).k40 = function(ae) {
    return this.j56();
};
$n(Unknown_0).toString = function() {
    return "Unknown";
};
$n(Unknown_0).hashCode = function() {
    return 485160352;
};
$n(Unknown_0).equals = function(ae) {
    return this === ae || ae instanceof Unknown_0 && (ae instanceof Unknown_0 || Tn(), true);
};
$n(Companion_13).n15g = function(ae) {
    switch(ae.toLowerCase()){
        case "normal":
            return Normal_getInstance();
        case "auto_swap":
        case "autoswap":
            return AutoSwap_getInstance();
        case "exclusive_rewards":
        case "exclusiverewards":
            return ExclusiveRewards_getInstance();
        default:
            return Unknown_getInstance_0();
    }
};
$n(Companion_13).k15h = function(ae) {
    let pe;
    if (yl(ae, Normal_getInstance())) {
        pe = "normal";
    } else if (yl(ae, AutoSwap_getInstance())) {
        pe = "auto_swap";
    } else if (yl(ae, ExclusiveRewards_getInstance())) {
        pe = "exclusive_rewards";
    } else if (yl(ae, Unknown_getInstance_0())) {
        pe = "unknown";
    } else {
        hw();
    }
    return pe;
};
$n(Companion_13).j56 = function() {
    return VaultTypeSerializer_getInstance();
};
$n(Companion_13).k40 = function(ae) {
    return this.j56();
};
$n(Rewards_1).toString = function() {
    return `Rewards(assetAddress=${this.b15g_1}, assetSymbol=${this.c15g_1}, assetDecimals=${this.d15g_1}, apy=${this.e15g_1.toString()})`;
};
$n(Rewards_1).hashCode = function() {
    let ae = $l(this.b15g_1);
    ae = pn(ae, 31) + $l(this.c15g_1) | 0;
    ae = pn(ae, 31) + this.d15g_1 | 0;
    return ae = pn(ae, 31) + this.e15g_1.hashCode() | 0;
};
$n(Rewards_1).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Rewards_1)) {
        return false;
    }
    const pe = ae instanceof Rewards_1 ? ae : Tn();
    return this.b15g_1 === pe.b15g_1 && this.c15g_1 === pe.c15g_1 && this.d15g_1 === pe.d15g_1 && !!this.e15g_1.equals(pe.e15g_1);
};
$n(ExclusiveRewards_3).toString = function() {
    return `ExclusiveRewards(rewards=${kl(this.z15f_1)}, apy=${this.a15g_1.toString()})`;
};
$n(ExclusiveRewards_3).hashCode = function() {
    let ae = Ml(this.z15f_1);
    return ae = pn(ae, 31) + this.a15g_1.hashCode() | 0;
};
$n(ExclusiveRewards_3).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof ExclusiveRewards_3)) {
        return false;
    }
    const pe = ae instanceof ExclusiveRewards_3 ? ae : Tn();
    return !!yl(this.z15f_1, pe.z15f_1) && !!this.a15g_1.equals(pe.a15g_1);
};
$n(VaultProviderSerializer).i3o = function() {
    return this.l15h_1;
};
$n(VaultProviderSerializer).m15h = function(ae, pe) {
    return ae.z3s(Os.o15g(pe));
};
$n(VaultProviderSerializer).v3o = function(ae, pe) {
    return this.m15h(ae, pe != null && jn(pe, VaultProvider) ? pe : Tn());
};
$n(VaultProviderSerializer).w3o = function(ae) {
    return Os.n15g(ae.s3r());
};
$n(VaultTypeSerializer).i3o = function() {
    return this.n15h_1;
};
$n(VaultTypeSerializer).o15h = function(ae, pe) {
    return ae.z3s(Ks.k15h(pe));
};
$n(VaultTypeSerializer).v3o = function(ae, pe) {
    return this.o15h(ae, pe != null && jn(pe, VaultType) ? pe : Tn());
};
$n(VaultTypeSerializer).w3o = function(ae) {
    return Ks.n15g(ae.s3r());
};
$n(MerkleDistributorService).z157 = function(ae, pe, ye, es) {
    return this.r15h_1.z157(ae, pe, ye, es);
};
$n(MerkleDistributorService).n157 = function(ae, pe, ye, es) {
    return this.s15h_1.n157(ae, pe, ye, es);
};
$n(MerkleDistributorService).p157 = function() {
    return "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae";
};
$n(MerkleDistributorService).o157 = function() {
    return this.q15h_1.gqo();
};
$n(MerkleDistributorTransactionBuilder).n157 = function(ae, pe, ye, es) {
    const ss = qm("toggleOperator", function MerkleDistributorTransactionBuilder$buildToggleOperatorTransaction$lambda(ae, pe) {
        return function(ye) {
            ye.yim(Fw(ae).zij(), false);
            ye.yim(Lw(pe, ae.ojo()).zij(), false);
            return fn;
        };
    }(ae, pe));
    const ns = new zm(ae);
    const n8s_1 = ow().n8s_1;
    return new Gw(ns, ye, n8s_1, qw(ss));
};
$n(MerkleModule).z14y = function() {
    const y14y_1 = this.y14y_1;
    (function merkleDistributorService$factory() {
        return xl("merkleDistributorService", 1, Ol, function(ae) {
            return ae.z14y();
        }, null);
    })();
    return y14y_1.f1();
};
$n(MerkleRpcClient$isOperatorApproved$slambda).w15i = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(MerkleRpcClient$isOperatorApproved$slambda).hb = function(ae, pe) {
    return this.w15i(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(MerkleRpcClient$isOperatorApproved$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.n15i_1 = this.i15i_1;
                    this.o15i_1 = this.j15i_1.mjo_1;
                    this.p15i_1 = "eth_call";
                    this.q15i_1 = buildJsonRPCRequestParams_0(this.i15i_1, this.k15i_1, qm("operators", MerkleRpcClient$isOperatorApproved$slambda$lambda(this.j15i_1, this.l15i_1)));
                    this.r15i_1 = this.n15i_1;
                    this.s15i_1 = this.o15i_1;
                    this.t15i_1 = this.p15i_1;
                    this.u15i_1 = this.q15i_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.r15i_1.uli(this.s15i_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.v15i_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.r15i_1.jpo(this.v15i_1, this.t15i_1, this.u15i_1, MerkleRpcClient$isOperatorApproved$slambda$lambda_0(this.r15i_1), On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    const pe = pa_1;
                    return toBoolean(this.i15i_1, pe);
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
$n(MerkleRpcClient$isOperatorApproved$slambda).g1w = function(ae, pe) {
    const ye = new MerkleRpcClient$isOperatorApproved$slambda(this.i15i_1, this.j15i_1, this.k15i_1, this.l15i_1, pe);
    ye.m15i_1 = ae;
    return ye;
};
$n(MerkleRpcClient).z157 = function(ae, pe, ye, es) {
    return lw(function MerkleRpcClient$isOperatorApproved$slambda_0(ae, pe, ye, es, ss) {
        const ns = new MerkleRpcClient$isOperatorApproved$slambda(ae, pe, ye, es, ss);
        const l = function(ae, pe) {
            return ns.w15i(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, ye, pe, null), es);
};
$n($getToAddressCOROUTINE$32).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.h15j_1 = this.g15j_1;
                    if (this.h15j_1 instanceof xw) {
                        this.na_1 = 1;
                        if ((pa_1 = this.f15j_1.j15j_1.o15j(this.g15j_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.i15j_1 = this.g15j_1.qk6();
                    this.na_1 = 2;
                    continue e;
                case 1:
                    let pe;
                    const ye = pa_1;
                    pe = ye.o() === 1 ? vw(ye).r15j_1 : this.f15j_1.k15j_1.gqo();
                    this.i15j_1 = pe;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    return this.i15j_1;
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
$n(KilnToAddressProvider).v159 = function(ae, pe) {
    const ye = new $getToAddressCOROUTINE$32(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda$slambda).m15k = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda$slambda).hb = function(ae, pe) {
    return this.m15k(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.g15k_1 = this.f15k_1;
                    this.h15k_1 = this.g15k_1;
                    this.oa_1 = 2;
                    this.j15k_1 = Mn;
                    this.k15k_1 = this.h15k_1;
                    this.l15k_1 = this.k15k_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.d15k_1.n15k_1.v15k(Dm(this.e15k_1), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.j15k_1;
                    this.i15k_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.i15k_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.i15k_1;
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
$n(KilnVaultsBalanceService$fetchVaultStats$slambda$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsBalanceService$fetchVaultStats$slambda$slambda(this.d15k_1, this.e15k_1, pe);
    ye.f15k_1 = ae;
    return ye;
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda$slambda).p15l = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda$slambda).hb = function(ae, pe) {
    return this.p15l(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.i15l_1 = this.h15l_1;
                    this.j15l_1 = this.i15l_1;
                    this.oa_1 = 2;
                    this.l15l_1 = Mn;
                    this.m15l_1 = this.j15l_1;
                    this.n15l_1 = this.m15l_1;
                    this.o15l_1 = vm(Jt(this.e15l_1.z2()));
                    this.na_1 = 1;
                    if ((pa_1 = this.f15l_1.n15k_1.q15l(this.o15l_1, this.g15l_1.vjo(), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.l15l_1;
                    this.k15l_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.k15l_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.k15l_1;
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
$n(KilnVaultsBalanceService$fetchUserPositions$slambda$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsBalanceService$fetchUserPositions$slambda$slambda(this.e15l_1, this.f15l_1, this.g15l_1, pe);
    ye.h15l_1 = ae;
    return ye;
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda).q15m = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda).hb = function(ae, pe) {
    return this.q15m(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    const pe = this.n15m_1;
                    const ye = Zn();
                    for(const es = pe.d1().k(); es.l();){
                        Kr(ye, es.m().f1());
                    }
                    const ss = vm(ye);
                    const ns = Xn(Kn(ss, 10));
                    for(const ts = ss.k(); ts.l();){
                        const rs = ts.m();
                        ns.e(Gt(this.p15m_1, On, On, KilnVaultsBalanceService$fetchVaultStats$slambda$slambda_0(this.o15m_1, rs, null)));
                    }
                    if ((pa_1 = Vt(ns, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const os = Jt(pa_1);
                    const as = Vn(Gn(Wn(Kn(os, 10)), 16));
                    for(const cs = os.k(); cs.l();){
                        const us = cs.m();
                        as.a3(us.a15m_1, us);
                    }
                    return as;
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const ls = error;
            if (this.oa_1 === 2) {
                throw ls;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ls;
        }
    }
};
$n(KilnVaultsBalanceService$fetchVaultStats$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsBalanceService$fetchVaultStats$slambda(this.n15m_1, this.o15m_1, pe);
    ye.p15m_1 = ae;
    return ye;
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda).p15l = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda).hb = function(ae, pe) {
    return this.p15l(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    const pe = this.z15m_1;
                    const ye = Dr();
                    const es = Zn();
                    for(const ss = pe.k(); ss.l();){
                        const ns = ss.m();
                        const ts = ns.vjo().hjo_1;
                        if (ye.e(ts)) {
                            es.e(ns);
                        }
                    }
                    const rs = Xn(Kn(es, 10));
                    for(const os = es.k(); os.l();){
                        const as = os.m();
                        rs.e(Gt(this.c15n_1, On, On, KilnVaultsBalanceService$fetchUserPositions$slambda$slambda_0(this.a15n_1, this.b15n_1, as, null)));
                    }
                    if ((pa_1 = Vt(rs, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    return Jt(pa_1);
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const cs = error;
            if (this.oa_1 === 2) {
                throw cs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = cs;
        }
    }
};
$n(KilnVaultsBalanceService$fetchUserPositions$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsBalanceService$fetchUserPositions$slambda(this.z15m_1, this.a15n_1, this.b15n_1, pe);
    ye.c15n_1 = ae;
    return ye;
};
$n($loadBalancesOrThrowCOROUTINE$34).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    if (this.m15n_1.u()) {
                        return Un();
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.l15n_1.o15k_1.u14b(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.n15n_1 = pa_1;
                    this.o15n_1 = fetchVaultIdsByAsset(this.l15n_1, this.m15n_1, this.n15n_1);
                    this.na_1 = 2;
                    if ((pa_1 = fetchVaultStats(this.l15n_1, this.o15n_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.p15n_1 = pa_1;
                    if (this.p15n_1.u()) {
                        return Un();
                    }
                    this.na_1 = 3;
                    if ((pa_1 = fetchUserPositions(this.l15n_1, this.o15n_1, this.m15n_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    const pe = pa_1;
                    return buildBalanceResults_0(this.l15n_1, this.m15n_1, this.p15n_1, pe);
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
$n(KilnVaultsBalanceService).v14b = function(ae, pe) {
    const ye = new $loadBalancesOrThrowCOROUTINE$34(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n($serializer_12).f15o = function(ae, pe) {
    const e15o_1 = this.e15o_1;
    const es = ae.w3r(e15o_1);
    es.k3t(e15o_1, 0, pe.p15j_1);
    es.k3t(e15o_1, 1, pe.q15j_1);
    es.k3t(e15o_1, 2, pe.r15j_1);
    es.k3t(e15o_1, 3, pe.s15j_1);
    es.k3t(e15o_1, 4, pe.t15j_1);
    es.k3t(e15o_1, 5, pe.u15j_1);
    es.x3r(e15o_1);
};
$n($serializer_12).v3o = function(ae, pe) {
    return this.f15o(ae, pe instanceof CraftClaimMorphoRewards ? pe : Tn());
};
$n($serializer_12).w3o = function(ae) {
    const e15o_1 = this.e15o_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    let as = null;
    let cs = null;
    const us = ae.w3r(e15o_1);
    if (us.l3s()) {
        ns = us.g3s(e15o_1, 0);
        ss |= 1;
        ts = us.g3s(e15o_1, 1);
        ss |= 2;
        rs = us.g3s(e15o_1, 2);
        ss |= 4;
        os = us.g3s(e15o_1, 3);
        ss |= 8;
        as = us.g3s(e15o_1, 4);
        ss |= 16;
        cs = us.g3s(e15o_1, 5);
        ss |= 32;
    } else {
        while(ye){
            switch(es = us.m3s(e15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = us.g3s(e15o_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = us.g3s(e15o_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = us.g3s(e15o_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = us.g3s(e15o_1, 3);
                    ss |= 8;
                    break;
                case 4:
                    as = us.g3s(e15o_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = us.g3s(e15o_1, 5);
                    ss |= 32;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    us.x3r(e15o_1);
    return function CraftClaimMorphoRewards_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs) {
        return function CraftClaimMorphoRewards_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os) {
            if (63 & ~ae) {
                pl(ae, 63, $serializer_getInstance_12().e15o_1);
            }
            os.p15j_1 = pe;
            os.q15j_1 = ye;
            os.r15j_1 = es;
            os.s15j_1 = ss;
            os.t15j_1 = ns;
            os.u15j_1 = ts;
            return os;
        }(ae, pe, ye, es, ss, ns, ts, 0, fl($n(CraftClaimMorphoRewards)));
    }(ss, ns, ts, rs, os, as, cs);
};
$n($serializer_12).i3o = function() {
    return this.e15o_1;
};
$n($serializer_12).z3z = function() {
    return [
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol()
    ];
};
$n(CraftClaimMorphoRewards).toString = function() {
    return `CraftClaimMorphoRewards(wallet=${this.p15j_1}, asset=${this.q15j_1}, to=${this.r15j_1}, data=${this.s15j_1}, value=${this.t15j_1}, chainId=${this.u15j_1})`;
};
$n(CraftClaimMorphoRewards).hashCode = function() {
    let ae = $l(this.p15j_1);
    ae = pn(ae, 31) + $l(this.q15j_1) | 0;
    ae = pn(ae, 31) + $l(this.r15j_1) | 0;
    ae = pn(ae, 31) + $l(this.s15j_1) | 0;
    ae = pn(ae, 31) + $l(this.t15j_1) | 0;
    return ae = pn(ae, 31) + $l(this.u15j_1) | 0;
};
$n(CraftClaimMorphoRewards).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof CraftClaimMorphoRewards)) {
        return false;
    }
    const pe = ae instanceof CraftClaimMorphoRewards ? ae : Tn();
    return this.p15j_1 === pe.p15j_1 && this.q15j_1 === pe.q15j_1 && this.r15j_1 === pe.r15j_1 && this.s15j_1 === pe.s15j_1 && this.t15j_1 === pe.t15j_1 && this.u15j_1 === pe.u15j_1;
};
$n($serializer_13).i15o = function(ae, pe) {
    const h15o_1 = this.h15o_1;
    const es = ae.w3r(h15o_1);
    const g15o_1 = Companion_getInstance_22().g15o_1;
    es.k3t(h15o_1, 0, pe.w15l_1);
    es.k3t(h15o_1, 1, pe.x15l_1);
    es.f3t(h15o_1, 2, pe.y15l_1);
    es.m3t(h15o_1, 3, Il(), pe.z15l_1);
    es.k3t(h15o_1, 4, pe.a15m_1);
    es.k3t(h15o_1, 5, pe.b15m_1);
    es.m3t(h15o_1, 6, Sl(), pe.c15m_1);
    es.n3t(h15o_1, 7, Il(), pe.d15m_1);
    es.n3t(h15o_1, 8, g15o_1[8].f1(), pe.e15m_1);
    es.x3r(h15o_1);
};
$n($serializer_13).v3o = function(ae, pe) {
    return this.i15o(ae, pe instanceof VaultStats ? pe : Tn());
};
$n($serializer_13).w3o = function(ae) {
    const h15o_1 = this.h15o_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = 0;
    let os = null;
    let as = null;
    let cs = null;
    let us = null;
    let ls = null;
    let ms = null;
    const gs = ae.w3r(h15o_1);
    const g15o_1 = Companion_getInstance_22().g15o_1;
    if (gs.l3s()) {
        ns = gs.g3s(h15o_1, 0);
        ss |= 1;
        ts = gs.g3s(h15o_1, 1);
        ss |= 2;
        rs = gs.b3s(h15o_1, 2);
        ss |= 4;
        os = gs.i3s(h15o_1, 3, Il(), os);
        ss |= 8;
        as = gs.g3s(h15o_1, 4);
        ss |= 16;
        cs = gs.g3s(h15o_1, 5);
        ss |= 32;
        us = gs.i3s(h15o_1, 6, Sl(), us);
        ss |= 64;
        ls = gs.k3s(h15o_1, 7, Il(), ls);
        ss |= 128;
        ms = gs.k3s(h15o_1, 8, g15o_1[8].f1(), ms);
        ss |= 256;
    } else {
        while(ye){
            switch(es = gs.m3s(h15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = gs.g3s(h15o_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = gs.g3s(h15o_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = gs.b3s(h15o_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = gs.i3s(h15o_1, 3, Il(), os);
                    ss |= 8;
                    break;
                case 4:
                    as = gs.g3s(h15o_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = gs.g3s(h15o_1, 5);
                    ss |= 32;
                    break;
                case 6:
                    us = gs.i3s(h15o_1, 6, Sl(), us);
                    ss |= 64;
                    break;
                case 7:
                    ls = gs.k3s(h15o_1, 7, Il(), ls);
                    ss |= 128;
                    break;
                case 8:
                    ms = gs.k3s(h15o_1, 8, g15o_1[8].f1(), ms);
                    ss |= 256;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    gs.x3r(h15o_1);
    return function VaultStats_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs) {
        return function VaultStats_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us) {
            if (511 & ~ae) {
                pl(ae, 511, $serializer_getInstance_13().h15o_1);
            }
            us.w15l_1 = pe;
            us.x15l_1 = ye;
            us.y15l_1 = es;
            us.z15l_1 = ss;
            us.a15m_1 = ns;
            us.b15m_1 = ts;
            us.c15m_1 = rs;
            us.d15m_1 = os;
            us.e15m_1 = as;
            return us;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, as, 0, fl($n(VaultStats)));
    }(ss, ns, ts, rs, os, as, cs, us, ls, ms);
};
$n($serializer_13).i3o = function() {
    return this.h15o_1;
};
$n($serializer_13).z3z = function() {
    const g15o_1 = Companion_getInstance_22().g15o_1;
    return [
        ol(),
        ol(),
        Tl(),
        Il(),
        ol(),
        ol(),
        Sl(),
        dl(Il()),
        dl(g15o_1[8].f1())
    ];
};
$n(VaultStats).q15n = function() {
    return `${this.b15m_1}_${this.a15m_1}`;
};
$n(VaultStats).hashCode = function() {
    let ae = $l(this.w15l_1);
    ae = pn(ae, 31) + $l(this.x15l_1) | 0;
    ae = pn(ae, 31) + this.y15l_1 | 0;
    ae = pn(ae, 31) + this.z15l_1.hashCode() | 0;
    ae = pn(ae, 31) + $l(this.a15m_1) | 0;
    ae = pn(ae, 31) + $l(this.b15m_1) | 0;
    ae = pn(ae, 31) + this.c15m_1.hashCode() | 0;
    ae = pn(ae, 31) + (this.d15m_1 == null ? 0 : this.d15m_1.hashCode()) | 0;
    return ae = pn(ae, 31) + (this.e15m_1 == null ? 0 : Ml(this.e15m_1)) | 0;
};
$n(VaultStats).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof VaultStats)) {
        return false;
    }
    const pe = ae instanceof VaultStats ? ae : Tn();
    return this.w15l_1 === pe.w15l_1 && this.x15l_1 === pe.x15l_1 && this.y15l_1 === pe.y15l_1 && !!this.z15l_1.equals(pe.z15l_1) && this.a15m_1 === pe.a15m_1 && this.b15m_1 === pe.b15m_1 && !!this.c15m_1.equals(pe.c15m_1) && !!yl(this.d15m_1, pe.d15m_1) && !!yl(this.e15m_1, pe.e15m_1);
};
$n($serializer_14).k15o = function(ae, pe) {
    const j15o_1 = this.j15o_1;
    const es = ae.w3r(j15o_1);
    es.m3t(j15o_1, 0, Sl(), pe.r15l_1);
    es.k3t(j15o_1, 1, pe.s15l_1);
    es.m3t(j15o_1, 2, Sl(), pe.t15l_1);
    es.k3t(j15o_1, 3, pe.u15l_1);
    es.k3t(j15o_1, 4, pe.v15l_1);
    es.x3r(j15o_1);
};
$n($serializer_14).v3o = function(ae, pe) {
    return this.k15o(ae, pe instanceof Position ? pe : Tn());
};
$n($serializer_14).w3o = function(ae) {
    const j15o_1 = this.j15o_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    let as = null;
    const cs = ae.w3r(j15o_1);
    if (cs.l3s()) {
        ns = cs.i3s(j15o_1, 0, Sl(), ns);
        ss |= 1;
        ts = cs.g3s(j15o_1, 1);
        ss |= 2;
        rs = cs.i3s(j15o_1, 2, Sl(), rs);
        ss |= 4;
        os = cs.g3s(j15o_1, 3);
        ss |= 8;
        as = cs.g3s(j15o_1, 4);
        ss |= 16;
    } else {
        while(ye){
            switch(es = cs.m3s(j15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = cs.i3s(j15o_1, 0, Sl(), ns);
                    ss |= 1;
                    break;
                case 1:
                    ts = cs.g3s(j15o_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = cs.i3s(j15o_1, 2, Sl(), rs);
                    ss |= 4;
                    break;
                case 3:
                    os = cs.g3s(j15o_1, 3);
                    ss |= 8;
                    break;
                case 4:
                    as = cs.g3s(j15o_1, 4);
                    ss |= 16;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    cs.x3r(j15o_1);
    return function Position_init_$Create$(ae, pe, ye, es, ss, ns, ts) {
        return function Position_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs) {
            if (31 & ~ae) {
                pl(ae, 31, $serializer_getInstance_14().j15o_1);
            }
            rs.r15l_1 = pe;
            rs.s15l_1 = ye;
            rs.t15l_1 = es;
            rs.u15l_1 = ss;
            rs.v15l_1 = ns;
            return rs;
        }(ae, pe, ye, es, ss, ns, 0, fl($n(Position)));
    }(ss, ns, ts, rs, os, as);
};
$n($serializer_14).i3o = function() {
    return this.j15o_1;
};
$n($serializer_14).z3z = function() {
    return [
        Sl(),
        ol(),
        Sl(),
        ol(),
        ol()
    ];
};
$n(Position).q15n = function() {
    return `${this.u15l_1}_${this.s15l_1}`;
};
$n(Position).toString = function() {
    return `Position(currentBalance=${this.r15l_1.toString()}, vaultContractAddress=${this.s15l_1}, currentRewards=${this.t15l_1.toString()}, chain=${this.u15l_1}, owner=${this.v15l_1})`;
};
$n(Position).hashCode = function() {
    let ae = this.r15l_1.hashCode();
    ae = pn(ae, 31) + $l(this.s15l_1) | 0;
    ae = pn(ae, 31) + this.t15l_1.hashCode() | 0;
    ae = pn(ae, 31) + $l(this.u15l_1) | 0;
    return ae = pn(ae, 31) + $l(this.v15l_1) | 0;
};
$n(Position).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof Position)) {
        return false;
    }
    const pe = ae instanceof Position ? ae : Tn();
    return !!this.r15l_1.equals(pe.r15l_1) && this.s15l_1 === pe.s15l_1 && !!this.t15l_1.equals(pe.t15l_1) && this.u15l_1 === pe.u15l_1 && this.v15l_1 === pe.v15l_1;
};
$n($serializer_15).m15o = function(ae, pe) {
    const l15o_1 = this.l15o_1;
    const es = ae.w3r(l15o_1);
    es.k3t(l15o_1, 0, pe.v15n_1);
    es.k3t(l15o_1, 1, pe.w15n_1);
    es.k3t(l15o_1, 2, pe.x15n_1);
    es.k3t(l15o_1, 3, pe.y15n_1);
    es.k3t(l15o_1, 4, pe.z15n_1);
    es.k3t(l15o_1, 5, pe.a15o_1);
    es.k3t(l15o_1, 6, pe.b15o_1);
    es.k3t(l15o_1, 7, pe.c15o_1);
    es.f3t(l15o_1, 8, pe.d15o_1);
    es.x3r(l15o_1);
};
$n($serializer_15).v3o = function(ae, pe) {
    return this.m15o(ae, pe instanceof ExclusiveRewards_4 ? pe : Tn());
};
$n($serializer_15).w3o = function(ae) {
    const l15o_1 = this.l15o_1;
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
    let ms = 0;
    const gs = ae.w3r(l15o_1);
    if (gs.l3s()) {
        ns = gs.g3s(l15o_1, 0);
        ss |= 1;
        ts = gs.g3s(l15o_1, 1);
        ss |= 2;
        rs = gs.g3s(l15o_1, 2);
        ss |= 4;
        os = gs.g3s(l15o_1, 3);
        ss |= 8;
        as = gs.g3s(l15o_1, 4);
        ss |= 16;
        cs = gs.g3s(l15o_1, 5);
        ss |= 32;
        us = gs.g3s(l15o_1, 6);
        ss |= 64;
        ls = gs.g3s(l15o_1, 7);
        ss |= 128;
        ms = gs.b3s(l15o_1, 8);
        ss |= 256;
    } else {
        while(ye){
            switch(es = gs.m3s(l15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = gs.g3s(l15o_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = gs.g3s(l15o_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = gs.g3s(l15o_1, 2);
                    ss |= 4;
                    break;
                case 3:
                    os = gs.g3s(l15o_1, 3);
                    ss |= 8;
                    break;
                case 4:
                    as = gs.g3s(l15o_1, 4);
                    ss |= 16;
                    break;
                case 5:
                    cs = gs.g3s(l15o_1, 5);
                    ss |= 32;
                    break;
                case 6:
                    us = gs.g3s(l15o_1, 6);
                    ss |= 64;
                    break;
                case 7:
                    ls = gs.g3s(l15o_1, 7);
                    ss |= 128;
                    break;
                case 8:
                    ms = gs.b3s(l15o_1, 8);
                    ss |= 256;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    gs.x3r(l15o_1);
    return function ExclusiveRewards_init_$Create$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs) {
        return function ExclusiveRewards_init_$Init$(ae, pe, ye, es, ss, ns, ts, rs, os, as, cs, us) {
            if (511 & ~ae) {
                pl(ae, 511, $serializer_getInstance_15().l15o_1);
            }
            us.v15n_1 = pe;
            us.w15n_1 = ye;
            us.x15n_1 = es;
            us.y15n_1 = ss;
            us.z15n_1 = ns;
            us.a15o_1 = ts;
            us.b15o_1 = rs;
            us.c15o_1 = os;
            us.d15o_1 = as;
            return us;
        }(ae, pe, ye, es, ss, ns, ts, rs, os, as, 0, fl($n(ExclusiveRewards_4)));
    }(ss, ns, ts, rs, os, as, cs, us, ls, ms);
};
$n($serializer_15).i3o = function() {
    return this.l15o_1;
};
$n($serializer_15).z3z = function() {
    return [
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        ol(),
        Tl()
    ];
};
$n(ExclusiveRewards_4).toString = function() {
    return `ExclusiveRewards(wallet=${this.v15n_1}, asset=${this.w15n_1}, assetSymbol=${this.x15n_1}, assetDecimals=${this.y15n_1}, total=${this.z15n_1}, claimable=${this.a15o_1}, claimableNext=${this.b15o_1}, chain=${this.c15o_1}, chainId=${this.d15o_1})`;
};
$n(ExclusiveRewards_4).hashCode = function() {
    let ae = $l(this.v15n_1);
    ae = pn(ae, 31) + $l(this.w15n_1) | 0;
    ae = pn(ae, 31) + $l(this.x15n_1) | 0;
    ae = pn(ae, 31) + $l(this.y15n_1) | 0;
    ae = pn(ae, 31) + $l(this.z15n_1) | 0;
    ae = pn(ae, 31) + $l(this.a15o_1) | 0;
    ae = pn(ae, 31) + $l(this.b15o_1) | 0;
    ae = pn(ae, 31) + $l(this.c15o_1) | 0;
    return ae = pn(ae, 31) + this.d15o_1 | 0;
};
$n(ExclusiveRewards_4).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof ExclusiveRewards_4)) {
        return false;
    }
    const pe = ae instanceof ExclusiveRewards_4 ? ae : Tn();
    return this.v15n_1 === pe.v15n_1 && this.w15n_1 === pe.w15n_1 && this.x15n_1 === pe.x15n_1 && this.y15n_1 === pe.y15n_1 && this.z15n_1 === pe.z15n_1 && this.a15o_1 === pe.a15o_1 && this.b15o_1 === pe.b15o_1 && this.c15o_1 === pe.c15o_1 && this.d15o_1 === pe.d15o_1;
};
$n($serializer_16).p15o = function(ae, pe) {
    const o15o_1 = this.o15o_1;
    const es = ae.w3r(o15o_1);
    const n15o_1 = Companion_getInstance_25().n15o_1;
    es.m3t(o15o_1, 0, n15o_1[0].f1(), pe.q15o_1);
    es.x3r(o15o_1);
};
$n($serializer_16).v3o = function(ae, pe) {
    return this.p15o(ae, pe instanceof VaultStatsResponse ? pe : Tn());
};
$n($serializer_16).w3o = function(ae) {
    const o15o_1 = this.o15o_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    const ts = ae.w3r(o15o_1);
    const n15o_1 = Companion_getInstance_25().n15o_1;
    if (ts.l3s()) {
        ns = ts.i3s(o15o_1, 0, n15o_1[0].f1(), ns);
        ss |= 1;
    } else {
        while(ye){
            switch(es = ts.m3s(o15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ts.i3s(o15o_1, 0, n15o_1[0].f1(), ns);
                    ss |= 1;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ts.x3r(o15o_1);
    return function VaultStatsResponse_init_$Create$(ae, pe, ye) {
        return function VaultStatsResponse_init_$Init$(ae, pe, ye, es) {
            if (1 & ~ae) {
                pl(ae, 1, $serializer_getInstance_16().o15o_1);
            }
            es.q15o_1 = pe;
            return es;
        }(ae, pe, 0, fl($n(VaultStatsResponse)));
    }(ss, ns);
};
$n($serializer_16).i3o = function() {
    return this.o15o_1;
};
$n($serializer_16).z3z = function() {
    return [
        Companion_getInstance_25().n15o_1[0].f1()
    ];
};
$n(VaultStatsResponse).toString = function() {
    return `VaultStatsResponse(data=${kl(this.q15o_1)})`;
};
$n(VaultStatsResponse).hashCode = function() {
    return Ml(this.q15o_1);
};
$n(VaultStatsResponse).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof VaultStatsResponse)) {
        return false;
    }
    const pe = ae instanceof VaultStatsResponse ? ae : Tn();
    return !!yl(this.q15o_1, pe.q15o_1);
};
$n($serializer_17).t15o = function(ae, pe) {
    const s15o_1 = this.s15o_1;
    const es = ae.w3r(s15o_1);
    const r15o_1 = Companion_getInstance_26().r15o_1;
    es.m3t(s15o_1, 0, r15o_1[0].f1(), pe.u15o_1);
    es.x3r(s15o_1);
};
$n($serializer_17).v3o = function(ae, pe) {
    return this.t15o(ae, pe instanceof PositionsResponse ? pe : Tn());
};
$n($serializer_17).w3o = function(ae) {
    const s15o_1 = this.s15o_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    const ts = ae.w3r(s15o_1);
    const r15o_1 = Companion_getInstance_26().r15o_1;
    if (ts.l3s()) {
        ns = ts.i3s(s15o_1, 0, r15o_1[0].f1(), ns);
        ss |= 1;
    } else {
        while(ye){
            switch(es = ts.m3s(s15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ts.i3s(s15o_1, 0, r15o_1[0].f1(), ns);
                    ss |= 1;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ts.x3r(s15o_1);
    return function PositionsResponse_init_$Create$(ae, pe, ye) {
        return function PositionsResponse_init_$Init$(ae, pe, ye, es) {
            if (1 & ~ae) {
                pl(ae, 1, $serializer_getInstance_17().s15o_1);
            }
            es.u15o_1 = pe;
            return es;
        }(ae, pe, 0, fl($n(PositionsResponse)));
    }(ss, ns);
};
$n($serializer_17).i3o = function() {
    return this.s15o_1;
};
$n($serializer_17).z3z = function() {
    return [
        Companion_getInstance_26().r15o_1[0].f1()
    ];
};
$n(PositionsResponse).toString = function() {
    return `PositionsResponse(data=${kl(this.u15o_1)})`;
};
$n(PositionsResponse).hashCode = function() {
    return Ml(this.u15o_1);
};
$n(PositionsResponse).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof PositionsResponse)) {
        return false;
    }
    const pe = ae instanceof PositionsResponse ? ae : Tn();
    return !!yl(this.u15o_1, pe.u15o_1);
};
$n($serializer_18).x15o = function(ae, pe) {
    const w15o_1 = this.w15o_1;
    const es = ae.w3r(w15o_1);
    const v15o_1 = Companion_getInstance_27().v15o_1;
    es.m3t(w15o_1, 0, v15o_1[0].f1(), pe.y15o_1);
    es.x3r(w15o_1);
};
$n($serializer_18).v3o = function(ae, pe) {
    return this.x15o(ae, pe instanceof ExclusiveRewardsResponse ? pe : Tn());
};
$n($serializer_18).w3o = function(ae) {
    const w15o_1 = this.w15o_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    const ts = ae.w3r(w15o_1);
    const v15o_1 = Companion_getInstance_27().v15o_1;
    if (ts.l3s()) {
        ns = ts.i3s(w15o_1, 0, v15o_1[0].f1(), ns);
        ss |= 1;
    } else {
        while(ye){
            switch(es = ts.m3s(w15o_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ts.i3s(w15o_1, 0, v15o_1[0].f1(), ns);
                    ss |= 1;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ts.x3r(w15o_1);
    return function ExclusiveRewardsResponse_init_$Create$(ae, pe, ye) {
        return function ExclusiveRewardsResponse_init_$Init$(ae, pe, ye, es) {
            if (1 & ~ae) {
                pl(ae, 1, $serializer_getInstance_18().w15o_1);
            }
            es.y15o_1 = pe;
            return es;
        }(ae, pe, 0, fl($n(ExclusiveRewardsResponse)));
    }(ss, ns);
};
$n($serializer_18).i3o = function() {
    return this.w15o_1;
};
$n($serializer_18).z3z = function() {
    return [
        Companion_getInstance_27().v15o_1[0].f1()
    ];
};
$n(ExclusiveRewardsResponse).toString = function() {
    return `ExclusiveRewardsResponse(data=${kl(this.y15o_1)})`;
};
$n(ExclusiveRewardsResponse).hashCode = function() {
    return Ml(this.y15o_1);
};
$n(ExclusiveRewardsResponse).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof ExclusiveRewardsResponse)) {
        return false;
    }
    const pe = ae instanceof ExclusiveRewardsResponse ? ae : Tn();
    return !!yl(this.y15o_1, pe.y15o_1);
};
$n($serializer_19).b15p = function(ae, pe) {
    const a15p_1 = this.a15p_1;
    const es = ae.w3r(a15p_1);
    const z15o_1 = Companion_getInstance_28().z15o_1;
    es.m3t(a15p_1, 0, z15o_1[0].f1(), pe.c15p_1);
    es.x3r(a15p_1);
};
$n($serializer_19).v3o = function(ae, pe) {
    return this.b15p(ae, pe instanceof CraftClaimMorphoRewardsResponse ? pe : Tn());
};
$n($serializer_19).w3o = function(ae) {
    const a15p_1 = this.a15p_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    const ts = ae.w3r(a15p_1);
    const z15o_1 = Companion_getInstance_28().z15o_1;
    if (ts.l3s()) {
        ns = ts.i3s(a15p_1, 0, z15o_1[0].f1(), ns);
        ss |= 1;
    } else {
        while(ye){
            switch(es = ts.m3s(a15p_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = ts.i3s(a15p_1, 0, z15o_1[0].f1(), ns);
                    ss |= 1;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    ts.x3r(a15p_1);
    return function CraftClaimMorphoRewardsResponse_init_$Create$(ae, pe, ye) {
        return function CraftClaimMorphoRewardsResponse_init_$Init$(ae, pe, ye, es) {
            if (1 & ~ae) {
                pl(ae, 1, $serializer_getInstance_19().a15p_1);
            }
            es.c15p_1 = pe;
            return es;
        }(ae, pe, 0, fl($n(CraftClaimMorphoRewardsResponse)));
    }(ss, ns);
};
$n($serializer_19).i3o = function() {
    return this.a15p_1;
};
$n($serializer_19).z3z = function() {
    return [
        Companion_getInstance_28().z15o_1[0].f1()
    ];
};
$n(CraftClaimMorphoRewardsResponse).toString = function() {
    return `CraftClaimMorphoRewardsResponse(data=${kl(this.c15p_1)})`;
};
$n(CraftClaimMorphoRewardsResponse).hashCode = function() {
    return Ml(this.c15p_1);
};
$n(CraftClaimMorphoRewardsResponse).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof CraftClaimMorphoRewardsResponse)) {
        return false;
    }
    const pe = ae instanceof CraftClaimMorphoRewardsResponse ? ae : Tn();
    return !!yl(this.c15p_1, pe.c15p_1);
};
$n($serializer_20).e15p = function(ae, pe) {
    const d15p_1 = this.d15p_1;
    const es = ae.w3r(d15p_1);
    es.k3t(d15p_1, 0, pe.r15n_1);
    es.k3t(d15p_1, 1, pe.s15n_1);
    es.n3t(d15p_1, 2, Tl(), pe.t15n_1);
    es.m3t(d15p_1, 3, Il(), pe.u15n_1);
    es.x3r(d15p_1);
};
$n($serializer_20).v3o = function(ae, pe) {
    return this.e15p(ae, pe instanceof AdditionalRewards ? pe : Tn());
};
$n($serializer_20).w3o = function(ae) {
    const d15p_1 = this.d15p_1;
    let ye = true;
    let es = 0;
    let ss = 0;
    let ns = null;
    let ts = null;
    let rs = null;
    let os = null;
    const as = ae.w3r(d15p_1);
    if (as.l3s()) {
        ns = as.g3s(d15p_1, 0);
        ss |= 1;
        ts = as.g3s(d15p_1, 1);
        ss |= 2;
        rs = as.k3s(d15p_1, 2, Tl(), rs);
        ss |= 4;
        os = as.i3s(d15p_1, 3, Il(), os);
        ss |= 8;
    } else {
        while(ye){
            switch(es = as.m3s(d15p_1)){
                case -1:
                    ye = false;
                    break;
                case 0:
                    ns = as.g3s(d15p_1, 0);
                    ss |= 1;
                    break;
                case 1:
                    ts = as.g3s(d15p_1, 1);
                    ss |= 2;
                    break;
                case 2:
                    rs = as.k3s(d15p_1, 2, Tl(), rs);
                    ss |= 4;
                    break;
                case 3:
                    os = as.i3s(d15p_1, 3, Il(), os);
                    ss |= 8;
                    break;
                default:
                    throw ml(es);
            }
        }
    }
    as.x3r(d15p_1);
    return function AdditionalRewards_init_$Create$(ae, pe, ye, es, ss, ns) {
        return function AdditionalRewards_init_$Init$(ae, pe, ye, es, ss, ns, ts) {
            if (15 & ~ae) {
                pl(ae, 15, $serializer_getInstance_20().d15p_1);
            }
            ts.r15n_1 = pe;
            ts.s15n_1 = ye;
            ts.t15n_1 = es;
            ts.u15n_1 = ss;
            return ts;
        }(ae, pe, ye, es, ss, 0, fl($n(AdditionalRewards)));
    }(ss, ns, ts, rs, os);
};
$n($serializer_20).i3o = function() {
    return this.d15p_1;
};
$n($serializer_20).z3z = function() {
    return [
        ol(),
        ol(),
        dl(Tl()),
        Il()
    ];
};
$n(AdditionalRewards).toString = function() {
    return `AdditionalRewards(asset=${this.r15n_1}, assetSymbol=${this.s15n_1}, assetDecimals=${this.t15n_1}, nrr=${this.u15n_1.toString()})`;
};
$n(AdditionalRewards).hashCode = function() {
    let ae = $l(this.r15n_1);
    ae = pn(ae, 31) + $l(this.s15n_1) | 0;
    ae = pn(ae, 31) + (this.t15n_1 ?? 0) | 0;
    return ae = pn(ae, 31) + this.u15n_1.hashCode() | 0;
};
$n(AdditionalRewards).equals = function(ae) {
    if (this === ae) {
        return true;
    }
    if (!(ae instanceof AdditionalRewards)) {
        return false;
    }
    const pe = ae instanceof AdditionalRewards ? ae : Tn();
    return this.r15n_1 === pe.r15n_1 && this.s15n_1 === pe.s15n_1 && this.t15n_1 == pe.t15n_1 && !!this.u15n_1.equals(pe.u15n_1);
};
$n(KilnVaultsModule).r14y = function() {
    const m14y_1 = this.m14y_1;
    (function kilnToAddressProvider$factory() {
        return xl("kilnToAddressProvider", 1, Ol, function(ae) {
            return ae.r14y();
        }, null);
    })();
    return m14y_1.f1();
};
$n(KilnVaultsModule).m14e = function() {
    const o14y_1 = this.o14y_1;
    (function vaultsTransactionBuilder$factory_1() {
        return xl("vaultsTransactionBuilder", 1, Ol, function(ae) {
            return ae.m14e();
        }, null);
    })();
    return o14y_1.f1();
};
$n(KilnVaultsModule).n14e = function() {
    const p14y_1 = this.p14y_1;
    (function vaultsBalanceService$factory_1() {
        return xl("vaultsBalanceService", 1, Ol, function(ae) {
            return ae.n14e();
        }, null);
    })();
    return p14y_1.f1();
};
$n(KilnVaultsModule).l14e = function() {
    const q14y_1 = this.q14y_1;
    (function vaultsService$factory_1() {
        return xl("vaultsService", 1, Ol, function(ae) {
            return ae.l14e();
        }, null);
    })();
    return q14y_1.f1();
};
$n(Companion_25).kqj = function(ae) {
    const pe = Gm("balanceOf");
    pe.yim(ae.zij(), false);
    const ye = new Int8Array([]);
    pe.wim(ye, true);
    return Vm.rim(pe);
};
$n($balanceOfSharesCOROUTINE$35).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.j15q_1 = this.g15q_1;
                    this.k15q_1 = this.h15q_1.vjo().mjo_1;
                    this.l15q_1 = "eth_call";
                    const pe = this.g15q_1.hpo_1;
                    const ye = new EthereumCall_0(null, this.i15q_1, qw(Companion_getInstance_30().kqj(Fw(this.h15q_1.vjo()))));
                    const es = zw(pe.t3o(), Vl(Wl(EthereumCall_0), Gl([]), false));
                    this.m15q_1 = jw([
                        pe.c54(jn(es, Nw) ? es : Tn(), ye),
                        Companion_getInstance_30().k15p_1
                    ]);
                    this.n15q_1 = this.j15q_1;
                    this.o15q_1 = this.k15q_1;
                    this.p15q_1 = this.l15q_1;
                    this.q15q_1 = this.m15q_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.n15q_1.uli(this.o15q_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.r15q_1 = pa_1;
                    this.na_1 = 2;
                    if ((pa_1 = this.n15q_1.jpo(this.r15q_1, this.p15q_1, this.q15q_1, KilnVaultsRpcClient$balanceOfShares$lambda(this.n15q_1), On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return Um(Zm(pa_1), 16);
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
$n($positionsCOROUTINE$36).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 11;
                    this.d15r_1 = Jm(this.b15r_1, ",");
                    this.e15r_1 = Jm(Jt(this.c15r_1), ",");
                    this.f15r_1 = this.a15r_1;
                    this.g15r_1 = this.a15r_1.g15t_1;
                    this.h15r_1 = this.a15r_1.h15t_1;
                    this.i15r_1 = this.g15r_1;
                    this.j15r_1 = this.h15r_1;
                    this.k15r_1 = this.i15r_1;
                    this.l15r_1 = this.k15r_1;
                    this.m15r_1 = this.l15r_1;
                    const pe = new Dl;
                    Bl(pe, this.j15r_1);
                    pe.a8g(KilnVaultsRpcClient$positions$lambda);
                    zl(pe, ql().f6d_1);
                    jl(pe, "wallets", this.d15r_1);
                    jl(pe, "vaults", this.e15r_1);
                    this.n15r_1 = pe;
                    this.o15r_1 = this.m15r_1;
                    this.p15r_1 = this.n15r_1;
                    this.p15r_1.b79_1 = Fl().i6j_1;
                    this.q15r_1 = this.o15r_1;
                    this.r15r_1 = this.p15r_1;
                    this.s15r_1 = this.q15r_1;
                    this.t15r_1 = this.r15r_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.t15r_1, this.s15r_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.u15r_1 = pa_1;
                    this.v15r_1 = this.f15r_1;
                    this.w15r_1 = this.u15r_1;
                    this.x15r_1 = this.w15r_1.v6o().c6m_1;
                    if (this.x15r_1 === 451) {
                        this.z15r_1 = this.w15r_1;
                        this.a15s_1 = this.z15r_1;
                        this.b15s_1 = "message";
                        this.na_1 = 9;
                        if ((pa_1 = Ul(this.a15s_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.c15s_1 = this.w15r_1;
                    this.d15s_1 = this.c15s_1;
                    this.e15s_1 = "message";
                    if (Jl(this.d15s_1.v6o())) {
                        this.oa_1 = 4;
                        this.h15s_1 = this.d15s_1;
                        this.i15s_1 = this.h15s_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.i15s_1.i7c();
                        const ss = Wl(PositionsResponse);
                        try {
                            ye = Vl(Wl(PositionsResponse), Gl([]), false);
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
                    this.j15s_1 = this.d15s_1.v6o().c6m_1;
                    this.k15s_1 = this.d15s_1;
                    this.l15s_1 = this.e15s_1;
                    this.m15s_1 = this.k15s_1;
                    this.n15s_1 = this.l15s_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.m15s_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.o15s_1 = pa_1;
                    this.p15s_1 = Xl(this.o15s_1, this.n15s_1);
                    const ns = this.p15s_1;
                    this.q15s_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.j15s_1, this.q15s_1);
                case 3:
                    this.g15s_1 = pa_1 instanceof PositionsResponse ? pa_1 : Tn();
                    this.oa_1 = 11;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 11;
                    if (this.qa_1 instanceof nw) {
                        this.r15s_1 = this.qa_1;
                        this.s15s_1 = this.d15s_1.v6o().c6m_1;
                        this.t15s_1 = this.d15s_1;
                        this.u15s_1 = this.e15s_1;
                        this.v15s_1 = this.t15s_1;
                        this.w15s_1 = this.u15s_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.v15s_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.x15s_1 = this.qa_1;
                        this.y15s_1 = this.d15s_1.v6o().c6m_1;
                        this.z15s_1 = this.d15s_1;
                        this.a15t_1 = this.e15s_1;
                        this.b15t_1 = this.z15s_1;
                        this.c15t_1 = this.a15t_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.b15t_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.w15s_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.s15s_1, rs, this.r15s_1);
                case 6:
                    const os = Xl(pa_1, this.c15t_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.y15s_1, as, this.x15s_1);
                case 7:
                    this.oa_1 = 11;
                    this.f15s_1 = this.g15s_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    this.y15r_1 = this.f15s_1;
                    this.na_1 = 10;
                    continue e;
                case 9:
                    const cs = Xl(pa_1, this.b15s_1);
                    throw new AccessRestricted(kl(Yl(Ql(cs) ? cs : Tn())));
                case 10:
                    return this.y15r_1;
                case 11:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 11) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
$n($vaultsCOROUTINE$37).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 11;
                    this.s15t_1 = Jm(Jt(this.r15t_1), ",");
                    this.t15t_1 = this.q15t_1;
                    this.u15t_1 = this.q15t_1.g15t_1;
                    this.v15t_1 = this.q15t_1.h15t_1;
                    this.w15t_1 = this.u15t_1;
                    this.x15t_1 = this.v15t_1;
                    this.y15t_1 = this.w15t_1;
                    this.z15t_1 = this.y15t_1;
                    this.a15u_1 = this.z15t_1;
                    const pe = new Dl;
                    Bl(pe, this.x15t_1);
                    pe.a8g(KilnVaultsRpcClient$vaults$lambda);
                    zl(pe, ql().f6d_1);
                    jl(pe, "vaults", this.s15t_1);
                    this.b15u_1 = pe;
                    this.c15u_1 = this.a15u_1;
                    this.d15u_1 = this.b15u_1;
                    this.d15u_1.b79_1 = Fl().i6j_1;
                    this.e15u_1 = this.c15u_1;
                    this.f15u_1 = this.d15u_1;
                    this.g15u_1 = this.e15u_1;
                    this.h15u_1 = this.f15u_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.h15u_1, this.g15u_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.i15u_1 = pa_1;
                    this.j15u_1 = this.t15t_1;
                    this.k15u_1 = this.i15u_1;
                    this.l15u_1 = this.k15u_1.v6o().c6m_1;
                    if (this.l15u_1 === 451) {
                        this.n15u_1 = this.k15u_1;
                        this.o15u_1 = this.n15u_1;
                        this.p15u_1 = "message";
                        this.na_1 = 9;
                        if ((pa_1 = Ul(this.o15u_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.q15u_1 = this.k15u_1;
                    this.r15u_1 = this.q15u_1;
                    this.s15u_1 = "message";
                    if (Jl(this.r15u_1.v6o())) {
                        this.oa_1 = 4;
                        this.v15u_1 = this.r15u_1;
                        this.w15u_1 = this.v15u_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.w15u_1.i7c();
                        const ss = Wl(VaultStatsResponse);
                        try {
                            ye = Vl(Wl(VaultStatsResponse), Gl([]), false);
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
                    this.x15u_1 = this.r15u_1.v6o().c6m_1;
                    this.y15u_1 = this.r15u_1;
                    this.z15u_1 = this.s15u_1;
                    this.a15v_1 = this.y15u_1;
                    this.b15v_1 = this.z15u_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.a15v_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.c15v_1 = pa_1;
                    this.d15v_1 = Xl(this.c15v_1, this.b15v_1);
                    const ns = this.d15v_1;
                    this.e15v_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.x15u_1, this.e15v_1);
                case 3:
                    this.u15u_1 = pa_1 instanceof VaultStatsResponse ? pa_1 : Tn();
                    this.oa_1 = 11;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 11;
                    if (this.qa_1 instanceof nw) {
                        this.f15v_1 = this.qa_1;
                        this.g15v_1 = this.r15u_1.v6o().c6m_1;
                        this.h15v_1 = this.r15u_1;
                        this.i15v_1 = this.s15u_1;
                        this.j15v_1 = this.h15v_1;
                        this.k15v_1 = this.i15v_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.j15v_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.l15v_1 = this.qa_1;
                        this.m15v_1 = this.r15u_1.v6o().c6m_1;
                        this.n15v_1 = this.r15u_1;
                        this.o15v_1 = this.s15u_1;
                        this.p15v_1 = this.n15v_1;
                        this.q15v_1 = this.o15v_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.p15v_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.k15v_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.g15v_1, rs, this.f15v_1);
                case 6:
                    const os = Xl(pa_1, this.q15v_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.m15v_1, as, this.l15v_1);
                case 7:
                    this.oa_1 = 11;
                    this.t15u_1 = this.u15u_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    this.m15u_1 = this.t15u_1;
                    this.na_1 = 10;
                    continue e;
                case 9:
                    const cs = Xl(pa_1, this.p15u_1);
                    throw new AccessRestricted(kl(Yl(Ql(cs) ? cs : Tn())));
                case 10:
                    return this.m15u_1;
                case 11:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 11) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
$n($morphoExtraRewardsCOROUTINE$38).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 11;
                    this.c15w_1 = Jm(this.a15w_1, ",");
                    this.d15w_1 = Jm(this.b15w_1, ",");
                    this.e15w_1 = this.z15v_1;
                    this.f15w_1 = this.z15v_1.g15t_1;
                    this.g15w_1 = this.z15v_1.h15t_1;
                    this.h15w_1 = this.f15w_1;
                    this.i15w_1 = this.g15w_1;
                    this.j15w_1 = this.h15w_1;
                    this.k15w_1 = this.j15w_1;
                    this.l15w_1 = this.k15w_1;
                    const pe = new Dl;
                    Bl(pe, this.i15w_1);
                    pe.a8g(KilnVaultsRpcClient$morphoExtraRewards$lambda);
                    zl(pe, ql().f6d_1);
                    jl(pe, "wallets", this.c15w_1);
                    jl(pe, "chain_ids", this.d15w_1);
                    jl(pe, "asset_symbols", "any");
                    this.m15w_1 = pe;
                    this.n15w_1 = this.l15w_1;
                    this.o15w_1 = this.m15w_1;
                    this.o15w_1.b79_1 = Fl().i6j_1;
                    this.p15w_1 = this.n15w_1;
                    this.q15w_1 = this.o15w_1;
                    this.r15w_1 = this.p15w_1;
                    this.s15w_1 = this.q15w_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.s15w_1, this.r15w_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.t15w_1 = pa_1;
                    this.u15w_1 = this.e15w_1;
                    this.v15w_1 = this.t15w_1;
                    this.w15w_1 = this.v15w_1.v6o().c6m_1;
                    if (this.w15w_1 === 451) {
                        this.y15w_1 = this.v15w_1;
                        this.z15w_1 = this.y15w_1;
                        this.a15x_1 = "message";
                        this.na_1 = 9;
                        if ((pa_1 = Ul(this.z15w_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.b15x_1 = this.v15w_1;
                    this.c15x_1 = this.b15x_1;
                    this.d15x_1 = "message";
                    if (Jl(this.c15x_1.v6o())) {
                        this.oa_1 = 4;
                        this.g15x_1 = this.c15x_1;
                        this.h15x_1 = this.g15x_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.h15x_1.i7c();
                        const ss = Wl(ExclusiveRewardsResponse);
                        try {
                            ye = Vl(Wl(ExclusiveRewardsResponse), Gl([]), false);
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
                    this.i15x_1 = this.c15x_1.v6o().c6m_1;
                    this.j15x_1 = this.c15x_1;
                    this.k15x_1 = this.d15x_1;
                    this.l15x_1 = this.j15x_1;
                    this.m15x_1 = this.k15x_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.l15x_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.n15x_1 = pa_1;
                    this.o15x_1 = Xl(this.n15x_1, this.m15x_1);
                    const ns = this.o15x_1;
                    this.p15x_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.i15x_1, this.p15x_1);
                case 3:
                    this.f15x_1 = pa_1 instanceof ExclusiveRewardsResponse ? pa_1 : Tn();
                    this.oa_1 = 11;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 11;
                    if (this.qa_1 instanceof nw) {
                        this.q15x_1 = this.qa_1;
                        this.r15x_1 = this.c15x_1.v6o().c6m_1;
                        this.s15x_1 = this.c15x_1;
                        this.t15x_1 = this.d15x_1;
                        this.u15x_1 = this.s15x_1;
                        this.v15x_1 = this.t15x_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.u15x_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.w15x_1 = this.qa_1;
                        this.x15x_1 = this.c15x_1.v6o().c6m_1;
                        this.y15x_1 = this.c15x_1;
                        this.z15x_1 = this.d15x_1;
                        this.a15y_1 = this.y15x_1;
                        this.b15y_1 = this.z15x_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.a15y_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.v15x_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.r15x_1, rs, this.q15x_1);
                case 6:
                    const os = Xl(pa_1, this.b15y_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.x15x_1, as, this.w15x_1);
                case 7:
                    this.oa_1 = 11;
                    this.e15x_1 = this.f15x_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    this.x15w_1 = this.e15x_1;
                    this.na_1 = 10;
                    continue e;
                case 9:
                    const cs = Xl(pa_1, this.a15x_1);
                    throw new AccessRestricted(kl(Yl(Ql(cs) ? cs : Tn())));
                case 10:
                    return this.x15w_1;
                case 11:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 11) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
$n($craftClaimMorphoRewardsCOROUTINE$39).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 11;
                    this.n15y_1 = Jm(this.l15y_1, ",");
                    this.o15y_1 = Jm(this.m15y_1, ",");
                    this.p15y_1 = this.k15y_1;
                    this.q15y_1 = this.k15y_1.g15t_1;
                    this.r15y_1 = this.k15y_1.h15t_1;
                    this.s15y_1 = this.q15y_1;
                    this.t15y_1 = this.r15y_1;
                    this.u15y_1 = this.s15y_1;
                    this.v15y_1 = this.u15y_1;
                    this.w15y_1 = this.v15y_1;
                    const pe = new Dl;
                    Bl(pe, this.t15y_1);
                    pe.a8g(KilnVaultsRpcClient$craftClaimMorphoRewards$lambda);
                    zl(pe, ql().f6d_1);
                    jl(pe, "wallets", this.n15y_1);
                    jl(pe, "chain_ids", this.o15y_1);
                    jl(pe, "asset_symbols", "any");
                    this.x15y_1 = pe;
                    this.y15y_1 = this.w15y_1;
                    this.z15y_1 = this.x15y_1;
                    this.z15y_1.b79_1 = Fl().i6j_1;
                    this.a15z_1 = this.y15y_1;
                    this.b15z_1 = this.z15y_1;
                    this.c15z_1 = this.a15z_1;
                    this.d15z_1 = this.b15z_1;
                    this.na_1 = 1;
                    if ((pa_1 = new Ll(this.d15z_1, this.c15z_1).q8k(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.e15z_1 = pa_1;
                    this.f15z_1 = this.p15y_1;
                    this.g15z_1 = this.e15z_1;
                    this.h15z_1 = this.g15z_1.v6o().c6m_1;
                    if (this.h15z_1 === 451) {
                        this.j15z_1 = this.g15z_1;
                        this.k15z_1 = this.j15z_1;
                        this.l15z_1 = "message";
                        this.na_1 = 9;
                        if ((pa_1 = Ul(this.k15z_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.m15z_1 = this.g15z_1;
                    this.n15z_1 = this.m15z_1;
                    this.o15z_1 = "message";
                    if (Jl(this.n15z_1.v6o())) {
                        this.oa_1 = 4;
                        this.r15z_1 = this.n15z_1;
                        this.s15z_1 = this.r15z_1;
                        this.na_1 = 3;
                        let ye;
                        const es = this.s15z_1.i7c();
                        const ss = Wl(CraftClaimMorphoRewardsResponse);
                        try {
                            ye = Vl(Wl(CraftClaimMorphoRewardsResponse), Gl([]), false);
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
                    this.t15z_1 = this.n15z_1.v6o().c6m_1;
                    this.u15z_1 = this.n15z_1;
                    this.v15z_1 = this.o15z_1;
                    this.w15z_1 = this.u15z_1;
                    this.x15z_1 = this.v15z_1;
                    this.na_1 = 2;
                    if ((pa_1 = Ul(this.w15z_1, On, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    this.y15z_1 = pa_1;
                    this.z15z_1 = Xl(this.y15z_1, this.x15z_1);
                    const ns = this.z15z_1;
                    this.a160_1 = kl(Yl(Ql(ns) ? ns : Tn()));
                    throw new ew(this.t15z_1, this.a160_1);
                case 3:
                    this.q15z_1 = pa_1 instanceof CraftClaimMorphoRewardsResponse ? pa_1 : Tn();
                    this.oa_1 = 11;
                    this.na_1 = 7;
                    continue e;
                case 4:
                    this.oa_1 = 11;
                    if (this.qa_1 instanceof nw) {
                        this.b160_1 = this.qa_1;
                        this.c160_1 = this.n15z_1.v6o().c6m_1;
                        this.d160_1 = this.n15z_1;
                        this.e160_1 = this.o15z_1;
                        this.f160_1 = this.d160_1;
                        this.g160_1 = this.e160_1;
                        this.na_1 = 5;
                        if ((pa_1 = Ul(this.f160_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    if (this.qa_1 instanceof sw) {
                        this.h160_1 = this.qa_1;
                        this.i160_1 = this.n15z_1.v6o().c6m_1;
                        this.j160_1 = this.n15z_1;
                        this.k160_1 = this.o15z_1;
                        this.l160_1 = this.j160_1;
                        this.m160_1 = this.k160_1;
                        this.na_1 = 6;
                        if ((pa_1 = Ul(this.l160_1, On, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    throw this.qa_1;
                case 5:
                    const ts = Xl(pa_1, this.g160_1);
                    const rs = kl(Yl(Ql(ts) ? ts : Tn()));
                    throw new ew(this.c160_1, rs, this.b160_1);
                case 6:
                    const os = Xl(pa_1, this.m160_1);
                    const as = kl(Yl(Ql(os) ? os : Tn()));
                    throw new ew(this.i160_1, as, this.h160_1);
                case 7:
                    this.oa_1 = 11;
                    this.p15z_1 = this.q15z_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    this.i15z_1 = this.p15z_1;
                    this.na_1 = 10;
                    continue e;
                case 9:
                    const cs = Xl(pa_1, this.l15z_1);
                    throw new AccessRestricted(kl(Yl(Ql(cs) ? cs : Tn())));
                case 10:
                    return this.i15z_1;
                case 11:
                    throw this.qa_1;
            }
        } catch (error) {
            const us = error;
            if (this.oa_1 === 11) {
                throw us;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = us;
        }
    }
};
$n(KilnVaultsRpcClient).n160 = function(ae, pe, ye) {
    const es = new $balanceOfSharesCOROUTINE$35(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(KilnVaultsRpcClient).o160 = function(ae, pe, ye) {
    const es = new $positionsCOROUTINE$36(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(KilnVaultsRpcClient).p160 = function(ae, pe) {
    const ye = new $vaultsCOROUTINE$37(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsRpcClient).q160 = function(ae, pe, ye) {
    const es = new $morphoExtraRewardsCOROUTINE$38(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(KilnVaultsRpcClient).r160 = function(ae, pe, ye) {
    const es = new $craftClaimMorphoRewardsCOROUTINE$39(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(KilnVaultsService$getPositions$slambda$slambda).l161 = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    const es = ye.va();
    Rn();
    return es;
};
$n(KilnVaultsService$getPositions$slambda$slambda).hb = function(ae, pe) {
    return this.l161(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsService$getPositions$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.e161_1 = this.d161_1;
                    this.f161_1 = this.e161_1;
                    this.oa_1 = 2;
                    this.h161_1 = Mn;
                    this.i161_1 = this.f161_1;
                    this.j161_1 = this.i161_1;
                    const pe = this.a161_1;
                    const ye = Zn();
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        if (yl(ss.e147_1, ExclusiveRewards_getInstance())) {
                            ye.e(ss);
                        }
                    }
                    const ns = Xn(Kn(ye, 10));
                    for(const ts = ye.k(); ts.l();){
                        const rs = ts.m();
                        ns.e(rs.b147_1);
                    }
                    this.k161_1 = vm(ns);
                    this.na_1 = 1;
                    if ((pa_1 = this.b161_1.t15k_1.p161(this.c161_1, this.k161_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const os = pa_1;
                    const as = Zn();
                    for(const cs = os.k(); cs.l();){
                        const us = cs.m();
                        if (Wt(us.v15n_1, this.c161_1.hjo_1, true)) {
                            as.e(us);
                        }
                    }
                    const ls = Zn();
                    for(const ms = as.k(); ms.l();){
                        const gs = ms.m();
                        if (Wt(gs.d15o_1.toString(), this.c161_1.mjo_1.nil(), true)) {
                            ls.e(gs);
                        }
                    }
                    const ds = Vn(Gn(Wn(Kn(ls, 10)), 16));
                    for(const _s = ls.k(); _s.l();){
                        const hs = _s.m();
                        ds.a3(hs.w15n_1, hs);
                    }
                    this.h161_1;
                    this.g161_1 = yn(ds);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const vs = this.qa_1;
                        this.g161_1 = yn(Sn(vs));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    return new Xm(this.g161_1);
            }
        } catch (error) {
            const ps = error;
            if (this.oa_1 === 3) {
                throw ps;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ps;
        }
    }
};
$n(KilnVaultsService$getPositions$slambda$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsService$getPositions$slambda$slambda(this.a161_1, this.b161_1, this.c161_1, pe);
    ye.d161_1 = ae;
    return ye;
};
$n(KilnVaultsService$getPositions$slambda$slambda_1).n14n = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsService$getPositions$slambda$slambda_1).hb = function(ae, pe) {
    return this.n14n(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsService$getPositions$slambda$slambda_1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 11;
                    this.e162_1 = this.d162_1;
                    this.f162_1 = this.e162_1;
                    this.oa_1 = 10;
                    this.h162_1 = Mn;
                    this.i162_1 = this.f162_1;
                    this.j162_1 = this.i162_1;
                    this.na_1 = 1;
                    const pe = this.z161_1;
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(ss.a147_1);
                    }
                    if ((pa_1 = this.y161_1.q15l(ye, this.a162_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.k162_1 = pa_1;
                    this.l162_1 = this.k162_1;
                    this.m162_1 = this.l162_1;
                    this.n162_1 = Zn();
                    this.o162_1 = this.m162_1;
                    this.p162_1 = this.n162_1;
                    this.q162_1 = this.o162_1;
                    this.r162_1 = this.q162_1;
                    this.s162_1 = this.r162_1.k();
                    this.na_1 = 2;
                    continue e;
                case 2:
                    if (!this.s162_1.l()) {
                        this.na_1 = 9;
                        continue e;
                    }
                    this.t162_1 = this.s162_1.m();
                    this.u162_1 = this.t162_1;
                    this.v162_1 = this.u162_1;
                    this.w162_1 = this.v162_1;
                    this.x162_1 = fn;
                    this.na_1 = 3;
                    continue e;
                case 3:
                    this.y162_1 = this.w162_1;
                    this.z162_1 = this.b162_1.x2(this.y162_1.q15n());
                    if (this.z162_1 == null) {
                        this.a163_1 = null;
                        this.na_1 = 7;
                        continue e;
                    }
                    this.b163_1 = this.z162_1;
                    this.c163_1 = this.b163_1;
                    this.d163_1 = this.c163_1;
                    this.e163_1 = this.d163_1;
                    if (this.e163_1.ykb_1.nil() !== this.a162_1.ojo().nil()) {
                        this.x162_1 = null;
                        this.na_1 = 8;
                        continue e;
                    }
                    this.na_1 = 4;
                    continue e;
                case 4:
                    if (Wt(this.y162_1.v15l_1, this.a162_1.hjo_1, true)) {
                        this.na_1 = 5;
                        continue e;
                    }
                    this.x162_1 = null;
                    this.na_1 = 8;
                    continue e;
                case 5:
                    this.na_1 = 6;
                    if ((pa_1 = this.c162_1.l12(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 6:
                    let ns;
                    const ts = pa_1.bs_1;
                    if (Bn(ts)) {
                        ns = null;
                    } else {
                        const rs = Cn(ts);
                        ns = rs == null || rs != null ? rs : Tn();
                    }
                    let os;
                    const as = ns;
                    if (as == null) {
                        os = null;
                    } else {
                        os = this.e163_1.ekc_1 instanceof sm ? as : null;
                    }
                    this.a163_1 = toCommon_3(this.y162_1, this.a162_1, this.e163_1, os);
                    this.na_1 = 7;
                    continue e;
                case 7:
                    this.x162_1 = this.a163_1;
                    this.na_1 = 8;
                    continue e;
                case 8:
                    const us = this.x162_1;
                    if (us != null) {
                        this.p162_1.e(us);
                    }
                    this.na_1 = 2;
                    continue e;
                case 9:
                    const ls = this.p162_1;
                    this.h162_1;
                    this.g162_1 = yn(ls);
                    this.oa_1 = 11;
                    this.na_1 = 12;
                    continue e;
                case 10:
                    this.oa_1 = 11;
                    if (this.qa_1 instanceof Error) {
                        const ms = this.qa_1;
                        this.g162_1 = yn(Sn(ms));
                        this.na_1 = 12;
                        continue e;
                    }
                    throw this.qa_1;
                case 11:
                    throw this.qa_1;
                case 12:
                    this.oa_1 = 11;
                    let gs;
                    const ds = this.g162_1;
                    if (Bn(ds)) {
                        gs = null;
                    } else {
                        const _s = Cn(ds);
                        gs = _s == null || _s != null ? _s : Tn();
                    }
                    return gs;
            }
        } catch (error) {
            const hs = error;
            if (this.oa_1 === 11) {
                throw hs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = hs;
        }
    }
};
$n(KilnVaultsService$getPositions$slambda$slambda_1).g1w = function(ae, pe) {
    const ye = new KilnVaultsService$getPositions$slambda$slambda_1(this.y161_1, this.z161_1, this.a162_1, this.b162_1, this.c162_1, pe);
    ye.d162_1 = ae;
    return ye;
};
$n(KilnVaultsService$getPositions$slambda).v14q = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsService$getPositions$slambda).hb = function(ae, pe) {
    return this.v14q(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsService$getPositions$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.j164_1 = this.f164_1.e14s(this.g164_1);
                    if (this.j164_1.u()) {
                        return Un();
                    }
                    this.na_1 = 1;
                    if ((pa_1 = this.f164_1.c14s(this.g164_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.k164_1 = pa_1;
                    const pe = this.k164_1;
                    const ye = Vn(Gn(Wn(Kn(pe, 10)), 16));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        const ns = Dn(ss.a4r(), ss instanceof Bm ? ss : Tn());
                        ye.a3(ns.aj_1, ns.bj_1);
                    }
                    this.l164_1 = ye;
                    this.na_1 = 2;
                    const ts = this.h164_1;
                    const rs = Zn();
                    for(let os = 0, as = ts.length; os < as;){
                        const cs = ts[os];
                        os = os + 1 | 0;
                        const us = this.j164_1;
                        const ls = Xn(Kn(us, 10));
                        for(const ms = us.k(); ms.l();){
                            const gs = ms.m();
                            ls.e(gs.b147_1);
                        }
                        if (ls.n(cs.ojo().nil())) {
                            rs.e(cs);
                        }
                    }
                    const ds = Xn(Kn(rs, 10));
                    for(const _s = rs.k(); _s.l();){
                        const hs = _s.m();
                        const vs = Gt(this.i164_1, On, On, KilnVaultsService$getPositions$slambda$slambda_0(this.j164_1, this.f164_1, hs, null));
                        ds.e(Gt(this.i164_1, On, On, KilnVaultsService$getPositions$slambda$slambda_2(this.f164_1, this.j164_1, hs, this.l164_1, vs, null)));
                    }
                    if ((pa_1 = Vt(ds, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 2:
                    return Jt(Ht(pa_1));
                case 3:
                    throw this.qa_1;
            }
        } catch (error) {
            const ps = error;
            if (this.oa_1 === 3) {
                throw ps;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ps;
        }
    }
};
$n(KilnVaultsService$getPositions$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsService$getPositions$slambda(this.f164_1, this.g164_1, this.h164_1, pe);
    ye.i164_1 = ae;
    return ye;
};
$n(KilnVaultsService$isDeviceRestricted$slambda).w15i = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsService$isDeviceRestricted$slambda).hb = function(ae, pe) {
    return this.w15i(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsService$isDeviceRestricted$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 5;
                    let pe;
                    this.v164_1;
                    try {
                        pe = yn(this.u164_1.u15k_1.zip("is_device_restricted"));
                    } catch (error) {
                        if (!(error instanceof Error)) {
                            throw error;
                        }
                        pe = yn(Sn(error));
                    }
                    let ye;
                    const es = pe;
                    if (Bn(es)) {
                        ye = null;
                    } else {
                        const ss = Cn(es);
                        ye = ss == null || ss != null ? ss : Tn();
                    }
                    this.w164_1 = ye;
                    if (this.w164_1 != null) {
                        return this.w164_1;
                    }
                    this.y164_1 = this.v164_1;
                    this.z164_1 = this.y164_1;
                    this.oa_1 = 2;
                    this.b165_1 = Mn;
                    this.c165_1 = this.z164_1;
                    this.d165_1 = this.c165_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.u164_1.q15k_1.p160(Un(), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const ns = pa_1;
                    this.b165_1;
                    this.a165_1 = yn(ns);
                    this.oa_1 = 5;
                    this.na_1 = 3;
                    continue e;
                case 2:
                    this.oa_1 = 5;
                    if (this.qa_1 instanceof Error) {
                        const ts = this.qa_1;
                        this.a165_1 = yn(Sn(ts));
                        this.na_1 = 3;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    this.oa_1 = 5;
                    let rs;
                    const os = this.a165_1;
                    const as = An(os);
                    if (as == null) {
                        const cs = Cn(os);
                        if (!(cs == null || cs != null)) {
                            Tn();
                        }
                        rs = false;
                    } else {
                        rs = as instanceof AccessRestricted;
                    }
                    const us = rs;
                    this.v164_1;
                    try {
                        this.u164_1.u15k_1.aiq("is_device_restricted", us);
                        yn(fn);
                    } catch (error) {
                        if (!(error instanceof Error)) {
                            throw error;
                        }
                        yn(Sn(error));
                    }
                    this.x164_1 = us;
                    this.na_1 = 4;
                    continue e;
                case 4:
                    return this.x164_1;
                case 5:
                    throw this.qa_1;
            }
        } catch (error) {
            const ls = error;
            if (this.oa_1 === 5) {
                throw ls;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ls;
        }
    }
};
$n(KilnVaultsService$isDeviceRestricted$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsService$isDeviceRestricted$slambda(this.u164_1, pe);
    ye.v164_1 = ae;
    return ye;
};
$n(KilnVaultsService$getVaults$slambda).m15k = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsService$getVaults$slambda).hb = function(ae, pe) {
    return this.m15k(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsService$getVaults$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.p165_1 = this.o165_1;
                    this.q165_1 = this.p165_1;
                    this.oa_1 = 2;
                    this.s165_1 = Mn;
                    this.t165_1 = this.q165_1;
                    this.u165_1 = this.t165_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.m165_1.r15k_1.y165(this.n165_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.s165_1;
                    this.r165_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.r165_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const es = this.r165_1;
                    const ss = An(es);
                    if (ss != null) {
                        if (ss instanceof AccessRestricted) {
                            throw ss;
                        }
                        return Un();
                    }
                    const ns = Cn(es);
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
$n(KilnVaultsService$getVaults$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsService$getVaults$slambda(this.m165_1, this.n165_1, pe);
    ye.o165_1 = ae;
    return ye;
};
$n(KilnVaultsService$getPositions$slambda_1).p15l = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsService$getPositions$slambda_1).hb = function(ae, pe) {
    return this.p15l(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsService$getPositions$slambda_1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.l166_1 = this.k166_1;
                    this.m166_1 = this.l166_1;
                    this.oa_1 = 2;
                    this.o166_1 = Mn;
                    this.p166_1 = this.m166_1;
                    this.q166_1 = this.p166_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.h166_1.s15k_1.w166(this.i166_1, this.j166_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.o166_1;
                    this.n166_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.n166_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const es = this.n166_1;
                    const ss = An(es);
                    if (ss != null) {
                        if (ss instanceof AccessRestricted) {
                            throw ss;
                        }
                        return Un();
                    }
                    const ns = Cn(es);
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
$n(KilnVaultsService$getPositions$slambda_1).g1w = function(ae, pe) {
    const ye = new KilnVaultsService$getPositions$slambda_1(this.h166_1, this.i166_1, this.j166_1, pe);
    ye.k166_1 = ae;
    return ye;
};
$n($fetchVaultsCOROUTINE$40).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.p163_1 = this.n163_1;
                    this.q163_1 = this.p163_1;
                    this.oa_1 = 2;
                    this.s163_1 = Mn;
                    this.t163_1 = this.q163_1;
                    this.u163_1 = this.t163_1;
                    const pe = this.o163_1;
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(ss.a147_1);
                    }
                    this.v163_1 = ye;
                    this.na_1 = 1;
                    if ((pa_1 = this.u163_1.v15k(this.v163_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const ns = pa_1;
                    const ts = Zn();
                    for(const rs = ns.k(); rs.l();){
                        const os = rs.m();
                        const as = this.o163_1;
                        let cs = fn;
                        s: do {
                            for(const us = as.k(); us.l();){
                                const ls = us.m();
                                if (Wt(ls.a147_1, os.q15n(), true)) {
                                    cs = ls;
                                    break s;
                                }
                            }
                            cs = null;
                        }while (0)
                        const ms = cs == null ? null : toCommon_4(os, cs);
                        if (ms != null) {
                            ts.e(ms);
                        }
                    }
                    this.s163_1;
                    this.r163_1 = yn(ts);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const gs = this.qa_1;
                        this.r163_1 = yn(Sn(gs));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let ds;
                    const _s = this.r163_1;
                    const hs = Un();
                    s: do {
                        if (Bn(_s)) {
                            ds = hs;
                            break s;
                        }
                        const vs = Cn(_s);
                        ds = vs == null || vs != null ? vs : Tn();
                    }while (0)
                    return ds;
            }
        } catch (error) {
            const ps = error;
            if (this.oa_1 === 3) {
                throw ps;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ps;
        }
    }
};
$n(KilnVaultsService).c14s = function(ae, pe) {
    const ye = this.e14s(ae);
    if (ye.u()) {
        return Un();
    }
    return fetchVaults_0(this, ye, pe);
};
$n(KilnVaultsService).f14s = function(ae, pe, ye) {
    const es = this.g14s(ae, pe.slice());
    if (es.u()) {
        return Un();
    }
    return fetchVaults_0(this, es, ye);
};
$n(KilnVaultsService).h14s = function(ae, pe, ye) {
    return Hn(function KilnVaultsService$getPositions$slambda_0(ae, pe, ye, es) {
        const ss = new KilnVaultsService$getPositions$slambda(ae, pe, ye, es);
        const l = function(ae, pe) {
            return ss.v14q(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, pe, null), ye);
};
$n(KilnVaultsService).i14s = function(ae, pe, ye, es, ss, ns, ts) {
    if (!pe && ye.h8v(ow().n8s_1) <= 0) {
        throw new InvalidApprovalAmount("Min amount should be greater than 0");
    }
    const rs = ae.o14r(es.a4r());
    if (rs == null) {
        throw new VaultConfigNotFound(es.a4r());
    }
    const os = rs;
    if (ns) {
        throw new WithdrawNotSupported(function toCommon_0(ae) {
            let pe;
            if (yl(ae, Kiln_getInstance())) {
                pe = gm;
            } else if (yl(ae, Angle_getInstance())) {
                pe = dm;
            } else if (yl(ae, Yield_getInstance())) {
                pe = mm;
            } else if (yl(ae, Unknown_getInstance())) {
                pe = wm;
            } else {
                hw();
            }
            return pe;
        }(os.f147_1), toCommon_1(os.e147_1, null));
    }
    const { c147_1, d147_1 } = os;
    return new VaultApprovalTransactionInput(pe ? aw().rqj(cw(c147_1, ss.ojo())) : aw().qqj(cw(c147_1, ss.ojo()), ye), d147_1);
};
$n(KilnVaultsService).j14s = function(ae, pe, ye, es) {
    const ss = ae.o14r(pe.a4r());
    if (ss == null) {
        throw new VaultConfigNotFound(pe.a4r());
    }
    const ns = ss;
    return new CheckAllowanceInput(ye, ns.d147_1, ns.c147_1);
};
$n(KilnVaultsService).k14s = function(ae, pe, ye, es) {
    throw new UnsupportedVaultProvider(pe.rk6());
};
$n(KilnVaultsService).y157 = function(ae) {
    return lw(function KilnVaultsService$isDeviceRestricted$slambda_0(ae, pe) {
        const ye = new KilnVaultsService$isDeviceRestricted$slambda(ae, pe);
        const l = function(ae, pe) {
            return ye.w15i(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, null), ae);
};
$n(KilnVaultsService).v15k = function(ae, pe) {
    return lw(function KilnVaultsService$getVaults$slambda_0(ae, pe, ye) {
        const es = new KilnVaultsService$getVaults$slambda(ae, pe, ye);
        const l = function(ae, pe) {
            return es.m15k(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, ae, null), pe);
};
$n(KilnVaultsService).q15l = function(ae, pe, ye) {
    return lw(function KilnVaultsService$getPositions$slambda_2(ae, pe, ye, es) {
        const ss = new KilnVaultsService$getPositions$slambda_1(ae, pe, ye, es);
        const l = function(ae, pe) {
            return ss.p15l(ae, pe);
        };
        l.$arity = 1;
        return l;
    }(this, pe, ae, null), ye);
};
$n($buildWithdrawSigningInputCOROUTINE$41).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 5;
                    this.k167_1 = this.j167_1.uk6_1;
                    this.l167_1 = this.j167_1.tk6_1.vjo().hjo_1;
                    if (this.j167_1.zk6_1) {
                        this.m167_1 = this.i167_1;
                        this.n167_1 = this.m167_1;
                        this.oa_1 = 3;
                        this.p167_1 = Mn;
                        this.q167_1 = this.n167_1;
                        this.r167_1 = this.q167_1;
                        this.na_1 = 2;
                        if ((pa_1 = this.r167_1.s167_1.n160(this.j167_1.tk6_1, this.j167_1.vk6_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    const pe = new sg(256, ww(this.k167_1));
                    const ye = new ng(On, On, On, On, On, this.l167_1);
                    const es = new ng(On, On, On, On, On, this.l167_1);
                    const ss = kt([
                        new ng(On, On, On, pe),
                        ye,
                        es
                    ]);
                    return prepareContractTransactionInput(this.i167_1, "withdraw", ss, ow().n8s_1);
                case 1:
                    return fn;
                case 2:
                    const ns = pa_1;
                    this.p167_1;
                    this.o167_1 = yn(ns);
                    this.oa_1 = 5;
                    this.na_1 = 4;
                    continue e;
                case 3:
                    this.oa_1 = 5;
                    if (this.qa_1 instanceof Error) {
                        const ts = this.qa_1;
                        this.o167_1 = yn(Sn(ts));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 5;
                    let rs;
                    const os = this.o167_1;
                    if (An(os) != null) {
                        throw new CannotFetchBalance(this.j167_1.vk6_1);
                    }
                    const as = Cn(os);
                    rs = as == null || as != null ? as : Tn();
                    const cs = new sg(256, ww(rs));
                    const us = new ng(On, On, On, On, On, this.l167_1);
                    const ls = new ng(On, On, On, On, On, this.l167_1);
                    const ms = kt([
                        new ng(On, On, On, cs),
                        us,
                        ls
                    ]);
                    return prepareContractTransactionInput(this.i167_1, "redeem", ms, ow().n8s_1);
                case 5:
                    throw this.qa_1;
            }
        } catch (error) {
            const gs = error;
            if (this.oa_1 === 5) {
                throw gs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = gs;
        }
    }
};
$n($buildClaimSigningInputCOROUTINE$42).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 2;
                    this.na_1 = 1;
                    if ((pa_1 = this.d168_1.t167_1.o15j(this.e168_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    if (pe.o() === 1) {
                        const ye = vw(pe);
                        return new dw(On, On, On, On, On, new gw(ww(ow().n8s_1), mw(ye.s15j_1)));
                    }
                    const es = Xn(Kn(pe, 10));
                    for(const ss = pe.k(); ss.l();){
                        const ns = ss.m();
                        es.e(new tg(ns.r15j_1, false, ns.s15j_1));
                    }
                    const ts = this.d168_1.u167_1.eqo(es);
                    return new dw(On, On, On, On, On, new gw(ww(ow().n8s_1), mw(ts)));
                case 2:
                    throw this.qa_1;
            }
        } catch (error) {
            const rs = error;
            if (this.oa_1 === 2) {
                throw rs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = rs;
        }
    }
};
$n(KilnVaultsTransactionBuilder).elq = function(ae, pe) {
    const ae_lk6_1 = ae.lk6_1;
    const es = new sg(256, ww(ae_lk6_1));
    const hjo_1 = ae.kk6_1.vjo().hjo_1;
    const ns = new ng(On, On, On, On, On, hjo_1);
    return prepareContractTransactionInput(0, "deposit", kt([
        new ng(On, On, On, es),
        ns
    ]), ow().n8s_1);
};
$n(KilnVaultsTransactionBuilder).flq = function(ae, pe) {
    const ye = new $buildWithdrawSigningInputCOROUTINE$41(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsTransactionBuilder).glq = function(ae, pe) {
    const ye = new $buildClaimSigningInputCOROUTINE$42(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n($getCraftClaimMorphoRewardsResponseCOROUTINE$43).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 8;
                    this.h169_1 = getCraftClaimMorphoRewardsResponseFromLocalCache(this.f169_1, this.g169_1);
                    if (this.h169_1 == null) {
                        this.j169_1 = this.f169_1;
                        this.k169_1 = this.j169_1;
                        this.l169_1 = this.k169_1;
                        this.m169_1 = this.l169_1;
                        this.n169_1 = this.m169_1.n15j_1;
                        this.o169_1 = this.n169_1;
                        this.p169_1 = null;
                        this.na_1 = 1;
                        if ((pa_1 = this.o169_1.w35(this.p169_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.i169_1 = this.h169_1;
                    this.na_1 = 6;
                    continue e;
                case 1:
                    this.q169_1 = fn;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    this.oa_1 = 7;
                    this.r169_1 = getCraftClaimMorphoRewardsResponseFromLocalCache(this.m169_1, this.g169_1);
                    if (this.r169_1 == null) {
                        this.na_1 = 3;
                        if ((pa_1 = getCraftClaimMorphoRewardsResponseFromRemote(this.m169_1, this.g169_1, this)) === Rn()) {
                            return pa_1;
                        }
                        continue e;
                    }
                    this.s169_1 = this.r169_1;
                    this.na_1 = 4;
                    continue e;
                case 3:
                    this.s169_1 = pa_1;
                    this.na_1 = 4;
                    continue e;
                case 4:
                    this.q169_1 = this.s169_1;
                    this.oa_1 = 8;
                    this.na_1 = 5;
                    continue e;
                case 5:
                    const pe = this.q169_1;
                    this.oa_1 = 8;
                    this.o169_1.x35(this.p169_1);
                    this.i169_1 = pe;
                    this.na_1 = 6;
                    continue e;
                case 6:
                    return this.i169_1;
                case 7:
                    this.oa_1 = 8;
                    const ye = this.qa_1;
                    this.o169_1.x35(this.p169_1);
                    throw ye;
                case 8:
                    throw this.qa_1;
            }
        } catch (error) {
            const es = error;
            if (this.oa_1 === 8) {
                throw es;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = es;
        }
    }
};
$n($getCraftClaimMorphoRewardsResponseFromRemoteCOROUTINE$44).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 4;
                    this.p168_1 = this.o168_1.ak7_1.vjo().hjo_1;
                    this.q168_1 = this.o168_1.ak7_1.ojo().nil();
                    this.r168_1 = this.n168_1;
                    this.s168_1 = this.r168_1;
                    this.oa_1 = 2;
                    this.u168_1 = Mn;
                    this.v168_1 = this.s168_1;
                    this.w168_1 = this.v168_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.w168_1.l15j_1.r160(Dm(this.p168_1), Dm(this.q168_1), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.u168_1;
                    this.t168_1 = yn(pe);
                    this.oa_1 = 4;
                    this.na_1 = 3;
                    continue e;
                case 2:
                    this.oa_1 = 4;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.t168_1 = yn(Sn(ye));
                        this.na_1 = 3;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    this.oa_1 = 4;
                    const es = this.t168_1;
                    const ss = An(es);
                    if (ss != null) {
                        if (ss instanceof AccessRestricted) {
                            throw ss;
                        }
                        throw new CannotFetchClaimPayload(this.p168_1, this.q168_1);
                    }
                    const ns = Cn(es);
                    const ts = ns == null || ns != null ? ns : Tn();
                    this.n168_1.m15j_1.aiq(toKey(this.n168_1, this.o168_1), ts.c15p_1);
                    return ts.c15p_1;
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
$n(KilnCraftMorphoClaimResponseCache).o15j = function(ae, pe) {
    const ye = new $getCraftClaimMorphoRewardsResponseCOROUTINE$43(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n($getExclusiveRewardsCOROUTINE$45).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    if (this.u16a_1.u()) {
                        return Un();
                    }
                    this.v16a_1 = getExclusiveRewardsFromLocalCache(this.s16a_1, this.t16a_1, this.u16a_1);
                    this.w16a_1 = findMissingChainIds(this.s16a_1, this.u16a_1, this.v16a_1);
                    if (this.w16a_1.u()) {
                        return this.v16a_1;
                    }
                    this.x16a_1 = this.s16a_1.o161_1;
                    this.y16a_1 = this.x16a_1;
                    this.z16a_1 = null;
                    this.na_1 = 1;
                    if ((pa_1 = this.y16a_1.w35(this.z16a_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.a16b_1 = fn;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    this.na_1 = 3;
                    continue e;
                case 3:
                    this.oa_1 = 8;
                    this.c16b_1 = getExclusiveRewardsFromLocalCache(this.s16a_1, this.t16a_1, this.u16a_1);
                    this.d16b_1 = findMissingChainIds(this.s16a_1, this.u16a_1, this.c16b_1);
                    if (this.d16b_1.u()) {
                        this.na_1 = 4;
                        continue e;
                    }
                    this.na_1 = 5;
                    if ((pa_1 = fetchExclusiveRewardsFromRemote(this.s16a_1, this.t16a_1, this.d16b_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    this.a16b_1 = this.c16b_1;
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 5:
                    const pe = pa_1;
                    this.b16b_1 = rg(this.c16b_1, pe);
                    this.oa_1 = 9;
                    this.na_1 = 6;
                    continue e;
                case 6:
                    const ye = this.b16b_1;
                    this.oa_1 = 9;
                    this.y16a_1.x35(this.z16a_1);
                    return ye;
                case 7:
                    const es = this.a16b_1;
                    this.oa_1 = 9;
                    this.y16a_1.x35(this.z16a_1);
                    return es;
                case 8:
                    this.oa_1 = 9;
                    const ss = this.qa_1;
                    this.y16a_1.x35(this.z16a_1);
                    throw ss;
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 9) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n($fetchExclusiveRewardsFromRemoteCOROUTINE$46).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.e16a_1 = this.b16a_1;
                    this.f16a_1 = this.e16a_1;
                    this.oa_1 = 2;
                    this.h16a_1 = Mn;
                    this.i16a_1 = this.f16a_1;
                    this.j16a_1 = this.i16a_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.j16a_1.m161_1.q160(Dm(this.c16a_1.hjo_1), this.d16a_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1.y15o_1;
                    const ye = Zn();
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        if (containsChainId(this.j16a_1, this.d16a_1, ss.d15o_1.toString())) {
                            ye.e(ss);
                        }
                    }
                    this.h16a_1;
                    this.g16a_1 = yn(ye);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ns = this.qa_1;
                        this.g16a_1 = yn(Sn(ns));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const ts = this.g16a_1;
                    const rs = An(ts);
                    if (rs != null) {
                        if (rs instanceof AccessRestricted) {
                            throw rs;
                        }
                        throw new CannotFetchExclusiveRewards(this.c16a_1, this.d16a_1);
                    }
                    const os = Cn(ts);
                    const as = os == null || os != null ? os : Tn();
                    const cs = findMissingChainIds(this.b16a_1, this.d16a_1, as);
                    for(const us = as.k(); us.l();){
                        const ls = us.m();
                        this.b16a_1.n161_1.aiq(toKey_0(this.b16a_1, Dn(this.c16a_1, ls.d15o_1.toString())), ls);
                    }
                    for(const ms = cs.k(); ms.l();){
                        const gs = ms.m();
                        this.b16a_1.n161_1.aiq(toKey_0(this.b16a_1, Dn(this.c16a_1, gs)), toEmptyExclusiveRewards(this.b16a_1, gs, this.c16a_1));
                    }
                    return as;
            }
        } catch (error) {
            const ds = error;
            if (this.oa_1 === 3) {
                throw ds;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ds;
        }
    }
};
$n(KilnExclusiveRewardsCache).p161 = function(ae, pe, ye) {
    const es = new $getExclusiveRewardsCOROUTINE$45(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda).m15k = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda).hb = function(ae, pe) {
    return this.m15k(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.p16b_1 = this.o16b_1;
                    this.q16b_1 = this.p16b_1;
                    this.oa_1 = 2;
                    this.s16b_1 = Mn;
                    this.t16b_1 = this.q16b_1;
                    this.u16b_1 = this.t16b_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.m16b_1.s166_1.y165(this.n16b_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1;
                    this.s16b_1;
                    this.r16b_1 = yn(pe);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ye = this.qa_1;
                        this.r16b_1 = yn(Sn(ye));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    let es;
                    const ss = this.r16b_1;
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
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda(this.m16b_1, this.n16b_1, pe);
    ye.o16b_1 = ae;
    return ye;
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_1).p15l = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_1).hb = function(ae, pe) {
    return this.p15l(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_1).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 5;
                    this.na_1 = 1;
                    if ((pa_1 = this.d16c_1.r166_1.o160(Dm(this.e16c_1.hjo_1), Dm(this.f16c_1), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.i16c_1 = pa_1;
                    this.j16c_1 = this.i16c_1.u15o_1;
                    const pe = this.j16c_1;
                    const ye = Zn();
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        if (Wt(ss.v15l_1, this.e16c_1.hjo_1, true)) {
                            ye.e(ss);
                        }
                    }
                    this.k16c_1 = ye;
                    this.l16c_1 = this.k16c_1;
                    this.m16c_1 = this.l16c_1;
                    this.n16c_1 = Zn();
                    this.o16c_1 = this.m16c_1;
                    this.p16c_1 = this.n16c_1;
                    this.q16c_1 = this.o16c_1;
                    this.r16c_1 = this.q16c_1;
                    this.s16c_1 = this.r16c_1.k();
                    this.na_1 = 2;
                    continue e;
                case 2:
                    if (!this.s16c_1.l()) {
                        this.na_1 = 4;
                        continue e;
                    }
                    this.t16c_1 = this.s16c_1.m();
                    this.u16c_1 = this.t16c_1;
                    this.v16c_1 = this.u16c_1;
                    this.w16c_1 = this.v16c_1;
                    this.x16c_1 = this.w16c_1;
                    this.na_1 = 3;
                    if ((pa_1 = this.g16c_1.l12(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 3:
                    const ns = pa_1;
                    let ts = fn;
                    s: do {
                        for(const rs = ns.k(); rs.l();){
                            const os = rs.m();
                            if (Wt(os.a15m_1, this.x16c_1.s15l_1, true)) {
                                ts = os;
                                break s;
                            }
                        }
                        ts = null;
                    }while (0)
                    const as = ts == null ? null : this.x16c_1;
                    if (as != null) {
                        this.p16c_1.e(as);
                    }
                    this.na_1 = 2;
                    continue e;
                case 4:
                    return this.p16c_1;
                case 5:
                    throw this.qa_1;
            }
        } catch (error) {
            const cs = error;
            if (this.oa_1 === 5) {
                throw cs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = cs;
        }
    }
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_1).g1w = function(ae, pe) {
    const ye = new KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_1(this.d16c_1, this.e16c_1, this.f16c_1, this.g16c_1, pe);
    ye.h16c_1 = ae;
    return ye;
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda).p15l = function(ae, pe) {
    const ye = this.g1w(ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda).hb = function(ae, pe) {
    return this.p15l(ae != null && jn(ae, Nn) ? ae : Tn(), pe);
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 5;
                    this.l16d_1 = Gt(this.k16d_1, On, On, KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_0(this.i16d_1, this.h16d_1, null));
                    this.m16d_1 = this.k16d_1;
                    this.n16d_1 = this.m16d_1;
                    this.oa_1 = 2;
                    this.p16d_1 = Mn;
                    this.q16d_1 = this.n16d_1;
                    this.r16d_1 = this.q16d_1;
                    this.na_1 = 1;
                    const pe = ig(this.h16d_1, 20);
                    const ye = Xn(Kn(pe, 10));
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        ye.e(Gt(this.r16d_1, On, On, KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda$slambda_2(this.i16d_1, this.j16d_1, ss, this.l16d_1, null)));
                    }
                    if ((pa_1 = Vt(ye, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.s16d_1 = pa_1;
                    this.t16d_1 = Jt(this.s16d_1);
                    this.p16d_1;
                    const ns = this.t16d_1;
                    this.o16d_1 = yn(ns);
                    this.oa_1 = 5;
                    this.na_1 = 3;
                    continue e;
                case 2:
                    this.oa_1 = 5;
                    if (this.qa_1 instanceof Error) {
                        this.u16d_1 = this.qa_1;
                        const ts = this.u16d_1;
                        this.o16d_1 = yn(Sn(ts));
                        this.na_1 = 3;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    this.oa_1 = 5;
                    this.v16d_1 = this.o16d_1;
                    let rs;
                    const os = this.v16d_1;
                    const as = An(os);
                    if (as != null) {
                        if (as instanceof AccessRestricted) {
                            throw as;
                        }
                        throw new CannotFetchVaults(this.h16d_1);
                    }
                    const cs = Cn(os);
                    rs = cs == null || cs != null ? cs : Tn();
                    this.w16d_1 = rs;
                    this.x16d_1 = findMissingVaultIds(this.i16d_1, this.w16d_1, this.h16d_1);
                    this.na_1 = 4;
                    if ((pa_1 = this.l16d_1.l12(this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    const us = pa_1;
                    const ls = Zn();
                    for(const ms = us.k(); ms.l();){
                        const gs = ms.m();
                        if (this.x16d_1.n(gs.q15n())) {
                            ls.e(gs);
                        }
                    }
                    const _s = missingVaultsToEmptyPositions(this.i16d_1, ls, this.j16d_1);
                    const hs = rg(this.w16d_1, _s);
                    for(const vs = hs.k(); vs.l();){
                        const ps = vs.m();
                        this.i16d_1.u166_1.aiq(toKey_1(this.i16d_1, Dn(this.j16d_1, ps.q15n())), ps);
                    }
                    return hs;
                case 5:
                    throw this.qa_1;
            }
        } catch (error) {
            const fs = error;
            if (this.oa_1 === 5) {
                throw fs;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = fs;
        }
    }
};
$n(KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda).g1w = function(ae, pe) {
    const ye = new KilnVaultsPositionsCache$fetchPositionsFromRemote$slambda(this.h16d_1, this.i16d_1, this.j16d_1, pe);
    ye.k16d_1 = ae;
    return ye;
};
$n($getPositionsCOROUTINE$47).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    if (this.i16e_1.u()) {
                        return Un();
                    }
                    this.j16e_1 = getPositionsFromLocalCache(this.g16e_1, this.h16e_1, this.i16e_1);
                    this.k16e_1 = findMissingVaultIds(this.g16e_1, this.j16e_1, this.i16e_1);
                    if (this.k16e_1.u()) {
                        return this.j16e_1;
                    }
                    this.l16e_1 = this.g16e_1.v166_1;
                    this.m16e_1 = this.l16e_1;
                    this.n16e_1 = null;
                    this.na_1 = 1;
                    if ((pa_1 = this.m16e_1.w35(this.n16e_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.o16e_1 = fn;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    this.na_1 = 3;
                    continue e;
                case 3:
                    this.oa_1 = 8;
                    this.q16e_1 = getPositionsFromLocalCache(this.g16e_1, this.h16e_1, this.i16e_1);
                    this.r16e_1 = findMissingVaultIds(this.g16e_1, this.q16e_1, this.i16e_1);
                    if (this.r16e_1.u()) {
                        this.na_1 = 4;
                        continue e;
                    }
                    this.na_1 = 5;
                    if ((pa_1 = fetchPositionsFromRemote(this.g16e_1, this.h16e_1, this.r16e_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    this.o16e_1 = this.q16e_1;
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 5:
                    const pe = pa_1;
                    this.p16e_1 = rg(this.q16e_1, pe);
                    this.oa_1 = 9;
                    this.na_1 = 6;
                    continue e;
                case 6:
                    const ye = this.p16e_1;
                    this.oa_1 = 9;
                    this.m16e_1.x35(this.n16e_1);
                    return ye;
                case 7:
                    const es = this.o16e_1;
                    this.oa_1 = 9;
                    this.m16e_1.x35(this.n16e_1);
                    return es;
                case 8:
                    this.oa_1 = 9;
                    const ss = this.qa_1;
                    this.m16e_1.x35(this.n16e_1);
                    throw ss;
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 9) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n(KilnVaultsPositionsCache).w166 = function(ae, pe, ye) {
    const es = new $getPositionsCOROUTINE$47(this, ae, pe, ye);
    es.pa_1 = fn;
    es.qa_1 = null;
    return es.va();
};
$n($getVaultsStatsCOROUTINE$49).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 9;
                    if (this.r16f_1.u()) {
                        return Un();
                    }
                    this.s16f_1 = getVaultsStatsFromLocalCache(this.q16f_1, this.r16f_1);
                    this.t16f_1 = findMissingVaultIds_0(this.q16f_1, this.r16f_1, this.s16f_1);
                    if (this.t16f_1.u()) {
                        return this.s16f_1;
                    }
                    this.u16f_1 = this.q16f_1.x165_1;
                    this.v16f_1 = this.u16f_1;
                    this.w16f_1 = null;
                    this.na_1 = 1;
                    if ((pa_1 = this.v16f_1.w35(this.w16f_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    this.x16f_1 = fn;
                    this.na_1 = 2;
                    continue e;
                case 2:
                    this.na_1 = 3;
                    continue e;
                case 3:
                    this.oa_1 = 8;
                    this.z16f_1 = getVaultsStatsFromLocalCache(this.q16f_1, this.r16f_1);
                    this.a16g_1 = findMissingVaultIds_0(this.q16f_1, this.r16f_1, this.z16f_1);
                    if (this.a16g_1.u()) {
                        this.na_1 = 4;
                        continue e;
                    }
                    this.na_1 = 5;
                    if ((pa_1 = fetchVaultsStatsFromRemote(this.q16f_1, this.a16g_1, this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 4:
                    this.x16f_1 = this.z16f_1;
                    this.oa_1 = 9;
                    this.na_1 = 7;
                    continue e;
                case 5:
                    const pe = pa_1;
                    this.y16f_1 = rg(this.z16f_1, pe);
                    this.oa_1 = 9;
                    this.na_1 = 6;
                    continue e;
                case 6:
                    const ye = this.y16f_1;
                    this.oa_1 = 9;
                    this.v16f_1.x35(this.w16f_1);
                    return ye;
                case 7:
                    const es = this.x16f_1;
                    this.oa_1 = 9;
                    this.v16f_1.x35(this.w16f_1);
                    return es;
                case 8:
                    this.oa_1 = 9;
                    const ss = this.qa_1;
                    this.v16f_1.x35(this.w16f_1);
                    throw ss;
                case 9:
                    throw this.qa_1;
            }
        } catch (error) {
            const ns = error;
            if (this.oa_1 === 9) {
                throw ns;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ns;
        }
    }
};
$n($fetchVaultsStatsFromRemoteCOROUTINE$50).va = function() {
    let pa_1 = this.pa_1;
    e: while(true){
        try {
            switch(this.na_1){
                case 0:
                    this.oa_1 = 3;
                    this.c16f_1 = this.a16f_1;
                    this.d16f_1 = this.c16f_1;
                    this.oa_1 = 2;
                    this.f16f_1 = Mn;
                    this.g16f_1 = this.d16f_1;
                    this.h16f_1 = this.g16f_1;
                    this.na_1 = 1;
                    if ((pa_1 = this.h16f_1.v165_1.p160(Dm(this.b16f_1), this)) === Rn()) {
                        return pa_1;
                    }
                    continue e;
                case 1:
                    const pe = pa_1.q15o_1;
                    const ye = Zn();
                    for(const es = pe.k(); es.l();){
                        const ss = es.m();
                        if (containsVaultId(this.h16f_1, this.b16f_1, ss.q15n())) {
                            ye.e(ss);
                        }
                    }
                    this.f16f_1;
                    this.e16f_1 = yn(ye);
                    this.oa_1 = 3;
                    this.na_1 = 4;
                    continue e;
                case 2:
                    this.oa_1 = 3;
                    if (this.qa_1 instanceof Error) {
                        const ns = this.qa_1;
                        this.e16f_1 = yn(Sn(ns));
                        this.na_1 = 4;
                        continue e;
                    }
                    throw this.qa_1;
                case 3:
                    throw this.qa_1;
                case 4:
                    this.oa_1 = 3;
                    const ts = this.e16f_1;
                    const rs = An(ts);
                    if (rs != null) {
                        if (rs instanceof AccessRestricted) {
                            throw rs;
                        }
                        throw new CannotFetchVaults(this.b16f_1);
                    }
                    const os = Cn(ts);
                    const as = os == null || os != null ? os : Tn();
                    const cs = findMissingVaultIds_0(this.a16f_1, this.b16f_1, as);
                    if (!cs.u()) {
                        throw new CannotFetchVaults(cs);
                    }
                    for(const us = as.k(); us.l();){
                        const ls = us.m();
                        this.a16f_1.w165_1.aiq(toKey_2(this.a16f_1, ls.q15n()), ls);
                    }
                    return as;
            }
        } catch (error) {
            const ms = error;
            if (this.oa_1 === 3) {
                throw ms;
            }
            this.na_1 = this.oa_1;
            this.qa_1 = ms;
        }
    }
};
$n(KilnVaultsStatsCache).y165 = function(ae, pe) {
    const ye = new $getVaultsStatsCOROUTINE$49(this, ae, pe);
    ye.pa_1 = fn;
    ye.qa_1 = null;
    return ye.va();
};
$n(YieldVaultProviderService).c14s = function(ae, pe) {
    const ye = this.e14s(ae);
    const es = Xn(Kn(ye, 10));
    for(const ss = ye.k(); ss.l();){
        const ns = toYieldVault(0, ss.m());
        es.e(ns);
    }
    return es;
};
$n(YieldVaultProviderService).f14s = function(ae, pe, ye) {
    const es = this.g14s(ae, pe.slice());
    const ss = Xn(Kn(es, 10));
    for(const ns = es.k(); ns.l();){
        const ts = toYieldVault(0, ns.m());
        ss.e(ts);
    }
    return ss;
};
$n(YieldVaultProviderService).h14s = function(ae, pe, ye) {
    return Un();
};
$n(YieldVaultProviderService).i14s = function(ae, pe, ye, es, ss, ns, ts) {
    throw new UnsupportedVaultProvider(es.rk6());
};
$n(YieldVaultProviderService).j14s = function(ae, pe, ye, es) {
    throw new UnsupportedVaultProvider(pe.rk6());
};
$n(YieldVaultProviderService).k14s = function(ae, pe, ye, es) {
    throw new UnsupportedVaultProvider(pe.rk6());
};
$n($serializer).a40 = _l;
$n($serializer_0).a40 = _l;
$n($serializer_1).a40 = _l;
$n($serializer_2).a40 = _l;
$n($serializer_3).a40 = _l;
$n($serializer_4).a40 = _l;
$n($serializer_5).a40 = _l;
$n($serializer_6).a40 = _l;
$n(VaultsBalanceService).cln = fw;
$n(VaultsBalanceService).dln = kw;
$n(VaultsBalanceService).eln = Rw;
$n(VaultsBalanceService).fln = $w;
Cw($n(AccessRestricted), "message", function() {
    return this.a2();
});
$n($serializer_7).a40 = _l;
$n(VaultsStakingService).ulp = am;
$n(VaultsStakingService).mjc = cm;
$n($serializer_8).a40 = _l;
$n($serializer_9).a40 = _l;
$n($serializer_10).a40 = _l;
$n($serializer_11).a40 = _l;
$n($serializer_12).a40 = _l;
$n($serializer_13).a40 = _l;
$n($serializer_14).a40 = _l;
$n($serializer_15).a40 = _l;
$n($serializer_16).a40 = _l;
$n($serializer_17).a40 = _l;
$n($serializer_18).a40 = _l;
$n($serializer_19).a40 = _l;
$n($serializer_20).a40 = _l;
new Companion_0;
new Companion_1;
new Companion_4;
new Companion_6;
new Companion_9;
Os = new Companion_10;
Ks = new Companion_13;
new Companion_14;
new Companion_15;
new Companion_18;
new Companion_19;
new Companion_26;
new Companion_27;
new Companion_28;
ae.$_$ = ae.$_$ || {};
ae.$_$.a = AccessRestricted;
ae.$_$.b = AllowanceCheckFailed;
ae.$_$.c = CannotFetchBalance;
ae.$_$.d = CannotFetchClaimPayload;
ae.$_$.e = CannotFetchDepositPayload;
ae.$_$.f = CannotFetchExclusiveRewards;
ae.$_$.g = CannotFetchVaults;
ae.$_$.h = CannotFetchVault;
ae.$_$.i = CannotFetchWithdrawPayload;
ae.$_$.j = ConfigUnavailable;
ae.$_$.k = InvalidApprovalAmount;
ae.$_$.l = InvalidConfig;
ae.$_$.m = InvalidFetchClaimPayloadResponse;
ae.$_$.n = InvalidUserPositionResponse;
ae.$_$.o = OperatorAlreadyApproved;
ae.$_$.p = RouterAddressNotFound;
ae.$_$.q = UnknownChainId;
ae.$_$.r = UnknownVaultProvider;
ae.$_$.s = UnsupportedVaultProvider;
ae.$_$.t = VaultAndAccountChainMismatch;
ae.$_$.u = VaultConfigNotFound;
ae.$_$.v = WithdrawNotSupported;
ae.$_$.w = VaultsError;
ae.$_$.x = VaultsModule;
const init_constants$8 = __esmMin(()=>{
    POPUP_MESSAGE_CHANNEL = "popup_channel";
    SIDEPANEL_MESSAGE_CHANNEL = "sidepanel_channel";
    INPAGE_CHROME_SCRIPT_NAME = "trustwallet-script";
    INTERNAL_MSG = {
        unlockWalletCore: "INTERNAL_UnlockWalletCore",
        notificationConfirmPrefix: "INTERNAL_notificationConfirm_",
        notificationCancelPrefix: "INTERNAL_notificationCancel_",
        keyringControllerGetAccounts: "INTERNAL_keyringControllerGetAccounts",
        keyringControllerGetSeedPhrase: "INTERNAL_keyringControllerGetSeedPhrase",
        keyringControllerSetConnectedSites: "INTERNAL_keyringControllerSetConnectedSites",
        keyringControllerSetFirstTime: "INTERNAL_keyringControllerSetFirstTime",
        appControllerCreateVault: "INTERNAL_appControllerCreateVault",
        appControllerRestoreVault: "INTERNAL_appControllerRestoreVault",
        appControllerReset: "INTERNAL_appControllerReset",
        appControllerSetIsAnalyticsEnabled: "INTERNAL_appControllerSetIsAnalyticsEnabled",
        notificationControllerRemoveNotification: "INTERNAL_notificationControllerRemoveNotification",
        settingsControllerSetIsAnalyticsEnabled: "INTERNAL_settingsControllerSetIsAnalyticsEnabled",
        settingsControllerSetIsDefaultWallet: "INTERNAL_settingsControllerSetIsDefaultWallet",
        apiControllerFetch: "INTERNAL_apiControllerFetch"
    };
    REDUX_OBSERVER_CALLBACK_ACTION = "REDUX_OBSERVER_CALLBACK_ACTION";
    SCREEN_RESOLUTION = "1920x1080";
    CoinId = ((ae)=>{
        ae[ae.Bitcoin = 0] = "Bitcoin";
        ae[ae.Ethereum = 60] = "Ethereum";
        ae[ae.Tron = 195] = "Tron";
        ae[ae.Solana = 501] = "Solana";
        ae[ae.Base = 8453] = "Base";
        ae[ae.Robinhood = 10004663] = "Robinhood";
        ae[ae.Arc = 10005042] = "Arc";
        ae[ae.Arbitrum = 10042221] = "Arbitrum";
        ae[ae.SmartChain = 20000714] = "SmartChain";
        return ae;
    })({});
    HOME_SCREEN_TOP_MOVERS_TABS = ((ae)=>{
        ae[ae.RWA = 0] = "RWA";
        ae[ae.AI = 1] = "AI";
        ae[ae.MEMES = 2] = "MEMES";
        return ae;
    })({});
    HOME_SCREEN_POPULAR_TOKENS_TABS = ((ae)=>{
        ae[ae.TOP = 0] = "TOP";
        ae[ae.BNB = 1] = "BNB";
        ae[ae.ETH = 2] = "ETH";
        ae[ae.SOL = 3] = "SOL";
        return ae;
    })({});
});
function getHeaderVersionValue() {
    return "Trust/26.41.0 Extension";
}
;
function isFirstPartyRpcHost(url) {
    try {
        const { hostname } = new URL(url ?? "");
        return FIRST_PARTY_RPC_DOMAINS.some((ae)=>hostname === ae || hostname.endsWith(`.${ae}`));
    } catch  {
        return false;
    }
}
;
const init_xOrigin_utils = __esmMin(()=>{
    init_version$1();
    X_ORIGIN_HEADER = {
        name: "X-Origin",
        value: getHeaderVersionValue()
    };
    FIRST_PARTY_RPC_DOMAINS = [
        "trustwallet.com",
        "twnodes.com"
    ];
    NAAS_NODE_DOMAIN = "twnodes.com";
});
function commonHttpSetup(ae, pe) {
    if (ae.em5_1.cm7_1.equals(LoggerMode_Debug_getInstance())) {
        const ye = Ls();
        pe.h7a(ye, CommonModule$commonHttpSetup$lambda);
    }
    const es = Us();
    pe.h7a(es, function CommonModule$commonHttpSetup$lambda_0(ae) {
        return function(pe) {
            cl(pe, ae.i56(), al().x6c_1);
            return Bs;
        };
    }(ae));
    pe.v79(Ks());
}
;
function TrustSwapClient$getSwap$lambda(ae, pe, ye, es, ss, ns, ts, rs, os) {
    return function(as, cs) {
        Ss(as, [
            "/v2.1/swap"
        ]);
        As(ae, "from_address", pe);
        As(ae, "from_asset", ye);
        As(ae, "to_asset", es);
        As(ae, "from_amount", ss);
        As(ae, "to_amount", ns);
        As(ae, "slippage", ts);
        As(ae, "recipient_address", rs);
        As(ae, "contract_call", os);
        return ms;
    };
}
;
function TrustSwapClient$getSwapQuote$lambda(ae, pe, ye, es, ss, ns, ts, rs, os) {
    return function(as, cs) {
        Ss(as, [
            "/v2.1/swap/quote"
        ]);
        As(ae, "from_address", pe);
        As(ae, "from_asset", ye);
        As(ae, "to_asset", es);
        As(ae, "amount", ss);
        As(ae, "amount_for", ns.r17c_1);
        As(ae, "recipient_address", ts);
        As(ae, "slippage", rs);
        As(ae, "contract_call", os);
        return ms;
    };
}
;
const init_url_utils = __esmMin(()=>{
    init_ext_polyfill();
});
function parseApiGatewayUrl(ae) {
    if (!ae) {
        return null;
    }
    try {
        const pe = new URL(ae);
        if (pe.origin === API_GATEWAY_ORIGIN) {
            return pe;
        }
        return null;
    } catch  {
        return null;
    }
}
;
const init_authentication_interceptor = __esmMin(()=>{
    init_api_constants();
    init_store$1();
    init_url_utils();
    import_crypto_browserify$4 = __toESM(require_crypto_browserify(), 1);
    API_GATEWAY_ORIGIN = new URL(API_GATEWAY_BASE_URL).origin;
});
const init_traceparent_utils = __esmMin(()=>{
    generateRandomHex = (ae)=>{
        let pe;
        do {
            const ye = new Uint8Array(ae / 2);
            crypto.getRandomValues(ye);
            pe = Array.from(ye).map((ae)=>ae.toString(16).padStart(2, "0")).join("");
        }while (pe.split("").every((ae)=>ae === "0"))
        return pe;
    };
    generateTraceId = ()=>generateRandomHex(32);
    generateParentId = ()=>generateRandomHex(16);
    generateTraceparent = (ae = true)=>`00-${generateTraceId()}-${generateParentId()}-${ae ? "01" : "00"}`;
});
const init_traceparent_interceptor = __esmMin(()=>{
    init_traceparent_utils();
    init_xOrigin_utils();
    traceparentInterceptor = (ae)=>{
        if (isFirstPartyRpcHost(ae.url)) {
            ae.headers.traceparent = generateTraceparent();
        }
        return ae;
    };
});
const init_authentication_utils = __esmMin(()=>{
    init_app();
    init_store$1();
    init_app$1();
    import_crypto_browserify$3 = __toESM(require_crypto_browserify(), 1);
});
function refreshHashKey() {
    if (!hashKeyRefresh) {
        hashKeyRefresh = (async ()=>{
            try {
                const identifier = await getFingerprintIdentifier();
                const { data } = await fetch$2.post(`${API_GATEWAY_BASE_URL}${FINGERPRINT_PATH}`, {
                    identifier,
                    bundle: BUNDLE_ID,
                    sr: SCREEN_RESOLUTION
                });
                store.dispatch(appSlice.actions.setHashKey(data.hash_key));
                return Boolean(data.hash_key);
            } catch (error) {
                logger_default.warn("Error while fetching hash key", error);
                return false;
            } finally{
                hashKeyRefresh = null;
            }
        })();
    }
    return hashKeyRefresh;
}
;
const init_xOrigin_interceptor = __esmMin(()=>{
    init_xOrigin_utils();
    xOriginInterceptor = (ae)=>{
        if (isFirstPartyRpcHost(ae.url)) {
            ae.headers[X_ORIGIN_HEADER.name] = X_ORIGIN_HEADER.value;
        }
        return ae;
    };
});
const init_fetch = __esmMin(()=>{
    init_authentication_interceptor();
    init_traceparent_interceptor();
    init_unauthenticated_interceptor();
    init_xOrigin_interceptor();
    init_axios();
    (fetch$2 = axios.create({
        timeout: 5000,
        adapter: "fetch",
        fetchOptions: {
            redirect: "error"
        }
    })).interceptors.request.use(xOriginInterceptor, (ae)=>ae);
    fetch$2.interceptors.request.use(traceparentInterceptor, (ae)=>ae);
    fetch$2.interceptors.request.use(authenticationInterceptor, (ae)=>ae);
    fetch$2.interceptors.response.use((ae)=>ae, unauthenticatedInterceptor);
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
const init_walletkit_service = __esmMin(()=>{
    init_app();
    init_blockchains$1();
    init_customNodeUrl();
    init_settings$1();
    init_app$3();
    init_constants$8();
    init_coinTypeToBlockchain();
    init_blockchain$1();
    init_utils$24();
    init_rpcHostGuard_utils();
    init_rpcChainIdGuard();
    init_version$1();
    init_injectable_decorator();
    init_priority_decorator();
    init_ext_polyfill();
    import_trust_sdk$39 = require_trust_sdk();
    import_trust_sdk$40 = require_trust_sdk();
    init_logger$1();
    init_fetch();
    init_naas_interceptor();
    init_naasSessionRecovery();
    init_naasRpcTimeout();
    init_rpcRequestCache();
    init_amberRouteConfigTap();
    init_swap();
    init_iSwapSettings();
    init_constants$5();
    init_decorateMetadata();
    init_decorate();
    _WalletKitService = class WalletKitService {
        async onApplicationBoot() {
            this.BlockchainService = import_trust_sdk$40.BlockchainService;
            this.SwapService = import_trust_sdk$40.SwapService;
            this.AmberService = import_trust_sdk$40.AmberService;
            this.MevService = import_trust_sdk$40.MevService;
            this.TransactionTransfer = import_trust_sdk$40.TransactionTransfer;
            this.WebService = import_trust_sdk$40.WebService;
            this.Asset = import_trust_sdk$40.Asset;
            this.TransactionRegisterToken = import_trust_sdk$40.TransactionRegisterToken;
            this.RpcError = import_trust_sdk$40.RpcError;
            this.TransactionResult = import_trust_sdk$40.TransactionResult;
            this.TokenType = import_trust_sdk$40.TokenType;
            this.BalanceType = import_trust_sdk$40.BalanceType;
            this.SwapAmount = import_trust_sdk$40.SwapAmount;
            this.SwapAssetPosition = import_trust_sdk$40.SwapAssetPosition;
            this.DefinedChain = import_trust_sdk$40.DefinedChain;
            this.CustomChain = import_trust_sdk$40.CustomChain;
            this.Node = import_trust_sdk$40.Node;
            this.Account = import_trust_sdk$40.Account;
            this.MessageType = import_trust_sdk$40.MessageType;
            this.TransactionTrade = import_trust_sdk$40.TransactionTrade;
            this.SignInput = import_trust_sdk$40.SignInput;
            this.SmartWalletConfig = import_trust_sdk$39.SmartWalletConfig;
            this.EthereumAaService = import_trust_sdk$39.EthereumAaService;
            this.SolanaFlexGasFee = import_trust_sdk$39.SolanaFlexGasFee;
            this.SolanaFlexGasTokenFee = import_trust_sdk$39.SolanaFlexGasTokenFee;
            this.FlexGasTransactionStatusInProgress = import_trust_sdk$39.FlexGasTransactionStatusInProgress;
            this.FlexGasTransactionStatusSubmitted = import_trust_sdk$39.FlexGasTransactionStatusSubmitted;
            this.FlexGasTransactionStatusFailed = import_trust_sdk$39.FlexGasTransactionStatusFailed;
            this.SolanaFlexGasService = import_trust_sdk$39.SolanaFlexGasService;
            const ae = getDeviceId() ?? "";
            const pe = getHashKey() ?? "";
            const ye = getLanguage();
            const navigator_userAgent = navigator.userAgent;
            const ss = new import_trust_sdk$40.AuthCredentials(ae, pe, ye, navigator_userAgent, getAuthIdentifier() ?? "", BUNDLE_ID, SCREEN_RESOLUTION);
            const ns = getRunningVersion(polyfill.runtime.getManifest()?.version);
            logger_default.debug(`Passing version to WK: ${ns}`);
            const ts = getSwapSetting("environment");
            const rs = new import_trust_sdk$40.TrustSDKContext(new import_trust_sdk$40.ClientPlatformApp(import_trust_sdk$40.ClientPlatform.TwBrowserExtension, ns), ss, import_trust_sdk$40.LogMode.None, import_trust_sdk$40.LogSeverity.Error);
            (new import_trust_sdk$40.TrustSDKConfig.Builder).setContext(rs).addFeatureModule().addTrustSDKModule().addAnalyticsModule().init();
            this.walletCore = await import_trust_sdk$40.WalletCoreKotlin.init();
            import_trust_sdk$40.FeatureModule.setEnvironment(ts === SWAP_ENVIRONMENT.STAGING ? import_trust_sdk$40.TwEnvironmentStaging : import_trust_sdk$40.TwEnvironmentProduction);
            await this.BlockchainService.useBitcoinV2();
            setNaasRefreshHandler(()=>this.refreshNaas());
            registerNaasInterceptor(fetch$2);
            installNaasRpcTimeout();
            installNaasRpcRequestCache();
            installAmberRouteConfigTap();
        }
        async getNode(ae, pe, ye = true) {
            if (pe === BlockchainType.CUSTOM || isCustomBlockchainId(ae)) {
                return {
                    url: selectCustomNodeUrl(getCustomBlockchains()[ae].info, ye)
                };
            }
            const url = getRpcOverride(ae);
            if (url && ye) {
                return {
                    url
                };
            }
            const ss = CoinTypeToBlockchainMap(this.walletCore)[ae];
            const ns = new this.DefinedChain(ss);
            return (await this.BlockchainService.getNodes(ns)).find((ae)=>ae.weight.name === "High");
        }
        async applyNodeForChain(ae, pe) {
            const ye = isEvmChainRecord(pe);
            if (pe.isCustom) {
                return void await this.bindGuardedNode(ae, pe.info.rpc, ye, pe.chainId);
            }
            const es = getRpcOverride(pe.id);
            if (es) {
                await this.bindGuardedNode(ae, es, ye, pe.chainId);
            } else {
                await this.BlockchainService.resetNode(ae);
            }
        }
        async bindGuardedNode(ae, pe, ye, es) {
            if (isBlockedRpcHost(pe)) {
                throw new Error(`Blocked RPC endpoint (SSRF guard): ${pe}`);
            }
            if (ye) {
                await verifyRpcChainId(pe, es);
            }
            await this.BlockchainService.setNode(ae, new this.Node(pe));
        }
        refreshNaas() {
            return this.BlockchainService.resetNodesAndReload();
        }
        constructor(){
            _WalletKitService1.instance = this;
        }
    };
    _WalletKitService1 = _WalletKitService;
    WalletKitService = _WalletKitService;
    WalletKitService = _WalletKitService1 = __decorate([
        Injectable(),
        BootPriority(10),
        __decorateMetadata("design:paramtypes", [])
    ], WalletKitService);
});
const init_device_service = __esmMin(()=>{
    init_injectable_decorator();
    init_priority_decorator();
    init_use_decorator();
    init_logger$1();
    init_app();
    init_store$1();
    init_app$1();
    init_authentication_utils();
    init_poller();
    init_retry();
    init_api_service();
    init_storage_service();
    init_walletkit_service();
    import_trust_sdk$38 = require_trust_sdk();
    init_decorateMetadata();
    init_decorate();
    _DeviceService = class DeviceService {
        onApplicationShutdown() {
            this.devicePoller.stopAndRemoveListeners();
        }
        async onApplicationBoot() {
            const enhancedBoot = async ()=>{
                try {
                    const ae = await this.getDeviceId();
                    const pe = getDeviceId();
                    const ye = getLegacyDeviceId();
                    const es = getAppMigratedToNewAuth();
                    if (ae && ae !== pe) {
                        logger_default.debug("Settings fresh device id version");
                        store.dispatch(appSlice.actions.setDeviceId(ae));
                        await this.walletKitService.SwapService.setDeviceId(ae);
                        if (ye && !es) {
                            await this.apiService.updateDevice(ae, ye);
                            store.dispatch(appSlice.actions.setNewAuthMigrated(true));
                        } else {
                            await this.apiService.updateDevice(ae);
                        }
                    }
                    if (ae || pe) {
                        this.devicePoller.stop();
                    }
                } catch (error) {
                    logger_default.error(error);
                }
            };
            this.devicePoller.start(enhancedBoot.bind(this));
            enhancedBoot().catch(logger_default.error);
            if (store.getState().app.hashKey) {
                this.hashKey = store.getState().app.hashKey;
                await import_trust_sdk$38.SwapService.setHashKey(this.hashKey);
            }
            if (store.getState().app.authIdentifier) {
                this.authIdentifier = store.getState().app.authIdentifier;
                await import_trust_sdk$38.SwapService.setIdentifier(this.authIdentifier);
            }
            store.subscribe(async ()=>{
                if (store.getState().app.hashKey !== this.hashKey) {
                    this.hashKey = store.getState().app.hashKey;
                    await import_trust_sdk$38.SwapService.setHashKey(this.hashKey);
                }
                if (store.getState().app.authIdentifier !== this.authIdentifier) {
                    this.authIdentifier = store.getState().app.authIdentifier;
                    await import_trust_sdk$38.SwapService.setIdentifier(this.authIdentifier);
                }
            });
        }
        async deviceSync() {
            const ae = getDeviceId();
            const pe = getHashKey();
            if (ae && pe) {
                await this.apiService.updateDevice(ae);
            }
        }
        async fetchDeviceDetails() {
            const ae = await this.getDeviceId();
            const pe = getAppMigratedToNewAuth();
            const ye = getLegacyDeviceId();
            if (pe) {
                const pe = await this.apiService.getDevice(ae);
                store.dispatch(appSlice.actions.setCountryCode(pe?.data.country_code));
            } else {
                if (ye) {
                    await new Retry(async ()=>{
                        logger_default.debug("Sending an update of the legacy device Id");
                        await this.apiService.updateDevice(ae, ye);
                        store.dispatch(appSlice.actions.setNewAuthMigrated(true));
                    }, {
                        maxAttempts: 5,
                        wait: 1000,
                        incrementalWait: true
                    }).run();
                }
            }
        }
        async getDeviceId() {
            const ae = getDeviceId() || await this.getOldDeviceId();
            const pe = getHashKey();
            if (ae) {
                if (ae && !pe) {
                    store.dispatch(appSlice.actions.setNewAuthMigrated(false));
                    store.dispatch(appSlice.actions.setLegacyDeviceId(ae));
                    return await this.register();
                }
                return ae;
            }
            return await this.register();
        }
        async getOldDeviceId() {
            return (await this.storageService.getLegacyStore())?.store?.app?.deviceId;
        }
        async register() {
            const ae = await getFingerprintIdentifier();
            const pe = await this.apiService.getFingerprint(ae);
            store.dispatch(appSlice.actions.setHashKey(pe?.data.hash_key));
            return pe?.data.device_id;
        }
        constructor(){
            this.hashKey = null;
            this.authIdentifier = null;
            this.devicePoller = new Poller({
                interval: _DeviceService1.POLL_DEVICE_INTERVAL_MS
            });
        }
    };
    _DeviceService1 = _DeviceService;
    _DeviceService.POLL_DEVICE_INTERVAL_MS = 60000;
    DeviceService = _DeviceService;
    __decorate([
        Use(ApiService),
        __decorateMetadata("design:type", ApiService === undefined ? Object : ApiService)
    ], DeviceService.prototype, "apiService", undefined);
    __decorate([
        Use(StorageService),
        __decorateMetadata("design:type", StorageService === undefined ? Object : StorageService)
    ], DeviceService.prototype, "storageService", undefined);
    __decorate([
        Use(WalletKitService),
        __decorateMetadata("design:type", WalletKitService === undefined ? Object : WalletKitService)
    ], DeviceService.prototype, "walletKitService", undefined);
    DeviceService = _DeviceService1 = __decorate([
        Injectable(),
        BootPriority(9)
    ], DeviceService);
});
const init_balanceStream_service = __esmMin(()=>{
    init_injectable_decorator();
    init_use_decorator();
    init_logger$1();
    init_api_service();
    init_wallet$2();
    init_utils$25();
    init_evmSharedAccount_utils();
    init_tokens$1();
    init_constants$8();
    init_iBalance();
    init_balanceStreamRetry();
    init_decorateMetadata();
    init_decorate();
    BREAKDOWN_TO_FIELD = {
        available: "balance",
        staked: "staked",
        rewards: "rewards",
        pending: "pending",
        frozen: "frozen",
        locked: "locked",
        blocked: "blocked",
        reserved: "reserved",
        claimable: "claimable",
        transferable: "transferable",
        inscription: "inscription",
        dust: "dust"
    };
    RESOURCE_TYPES$1 = new Set(resourceTypes);
    BALANCE_EVENT_TYPE = "balance";
    BalanceStreamService = class BalanceStreamService {
        resolveAddress(ae, pe, ye, es) {
            return resolveAddressForChain(ye, pe, ae.isCustomAsset ? {
                isCustom: true
            } : es);
        }
        buildAddressEntries(ae, pe, ye) {
            const entries = [];
            const byAssetId = new Map;
            for (const asset of ae){
                if (!asset.assetId) {
                    continue;
                }
                const { coinId } = parseAssetId(asset.assetId);
                const address = this.resolveAddress(asset, coinId, pe, asset.blockchainId ? ye[asset.blockchainId] : undefined);
                if (address) {
                    entries.push({
                        asset_id: asset.assetId,
                        address
                    });
                    byAssetId.set(asset.assetId.toLowerCase(), {
                        asset,
                        coinId
                    });
                }
            }
            return {
                entries,
                byAssetId
            };
        }
        async fetchBalances(ae, pe, ye = {}, es = "USD") {
            const { entries, byAssetId } = this.buildAddressEntries(ae, pe, ye);
            if (entries.length === 0) {
                return {
                    results: [],
                    ok: true
                };
            }
            const ts = await requestBalanceStreamWithRetry(()=>this.apiService.streamBalances(entries, es));
            if (typeof ts?.data !== "string") {
                logger_default.warn("Balance stream returned no body — falling back to client path");
                return {
                    results: [],
                    ok: false
                };
            }
            const results = [];
            for (const os of ts.data.split("\n")){
                const ae = this.parseLine(os);
                const pe = ae?.asset_id;
                if (!pe) {
                    continue;
                }
                const ye = byAssetId.get(pe.toLowerCase());
                if (!ye) {
                    continue;
                }
                const es = this.mapPayload(ae, ye.asset, ye.coinId);
                if (es) {
                    results.push(es);
                }
            }
            return {
                results,
                ok: true
            };
        }
        parseLine(ae) {
            const pe = ae.trim();
            if (!pe) {
                return null;
            }
            try {
                const ae = JSON.parse(pe);
                if (ae?.type && ae.type !== BALANCE_EVENT_TYPE) {
                    return null;
                }
                return ae?.payload ?? null;
            } catch (error) {
                logger_default.warn("Failed to parse balance stream line", error);
                return null;
            }
        }
        mapPayload(ae, pe, coinId) {
            const pe_assetId = pe.assetId;
            if (coinId == null || !pe_assetId) {
                return null;
            }
            const ae_amounts = ae.amounts;
            if (!ae_amounts) {
                return null;
            }
            const ns = pe.decimals ?? 0;
            const ts = coinId === CoinId.Tron ? getBalance$2(pe_assetId) : undefined;
            const rs = {
                coinId,
                assetId: pe_assetId,
                address: pe.address,
                blockchainId: pe.blockchainId,
                balance: "0",
                bandwidth: ts?.bandwidth,
                energy: ts?.energy
            };
            const os = ae_amounts.available ?? ae_amounts.total;
            let as = os != null;
            if (os != null) {
                rs.balance = this.toHuman(os, ns);
            }
            for (const [cs, us] of Object.entries(ae_amounts.breakdown ?? {})){
                if (RESOURCE_TYPES$1.has(cs)) {
                    const ae = {
                        amount: toResourceCount$1(us?.amount),
                        limit: toResourceCount$1(us?.limit)
                    };
                    if (cs === "energy") {
                        rs.energy = ae;
                    } else {
                        rs.bandwidth = ae;
                    }
                    continue;
                }
                const ae = BREAKDOWN_TO_FIELD[cs];
                if (ae) {
                    rs[ae] = this.toHuman(us?.amount, ns);
                    as = as || ae === "balance";
                }
            }
            if (as) {
                return rs;
            }
            logger_default.debug("Balance stream named no spendable amount — falling back for this asset");
            return null;
        }
        toHuman(ae, pe) {
            if (ae == null || ae === "") {
                return "0";
            }
            try {
                const ye = formatTokenFrom(ae, pe);
                if (ye.lt(0)) {
                    logger_default.warn("Negative amount in balance stream — treating as 0");
                    return "0";
                }
                return ye.toString();
            } catch  {
                logger_default.warn("Non-numeric amount in balance stream — treating as 0");
                return "0";
            }
        }
    };
    __decorate([
        Use(ApiService),
        __decorateMetadata("design:type", ApiService === undefined ? Object : ApiService)
    ], BalanceStreamService.prototype, "apiService", undefined);
    BalanceStreamService = __decorate([
        Injectable()
    ], BalanceStreamService);
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
    tickerRequests = new TickerRequestCoordinator(async (assets, pe)=>{
        const { data } = await fetch$2.post(API_URL, {
            currency: pe.currency,
            assets,
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
const init_balanceFeed_service = __esmMin(()=>{
    init_asset_service();
    init_wallet$2();
    init_queue_service();
    init_sentry();
    init_apiError();
    init_logger$1();
    init_injectable_decorator();
    init_use_decorator();
    init_decorateMetadata();
    init_decorate();
    _BalanceFeedService = class BalanceFeedService {
        onApplicationShutdown() {
            this.stop();
        }
        start() {
            if (!this.running) {
                this.running = true;
                this.session += 1;
                this.consecutiveFailures = 0;
                this.consecutiveRateLimits = 0;
                this.rateLimitReported = false;
                this.resetWindow(this.currentScope());
                this.schedule();
            }
        }
        stop() {
            this.running = false;
            this.session += 1;
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }
        get currentIntervalMs() {
            return this.intervalMs;
        }
        get isRunning() {
            return this.running;
        }
        get reportScope() {
            const ae = this.running ? this.currentScope() : null;
            if (ae) {
                return `${this.session}:${ae}`;
            }
            return null;
        }
        currentScope() {
            const ae = getActiveWalletId();
            if (ae) {
                return `${ae}:${getActiveAccountId()}`;
            }
            return null;
        }
        resetWindow(ae) {
            this.scope = ae;
            this.cursorMs = Date.now();
        }
        schedule() {
            if (this.running) {
                if (this.timer) {
                    clearTimeout(this.timer);
                }
                this.timer = setTimeout(()=>{
                    this.timer = null;
                    this.tick();
                }, this.nextDelayMs());
            }
        }
        async tick() {
            if (!this.running || this.inFlight) {
                return;
            }
            this.inFlight = true;
            const session = this.session;
            try {
                const pe = this.currentScope();
                if (!pe) {
                    return;
                }
                if (pe !== this.scope) {
                    this.resetWindow(pe);
                    this.consecutiveFailures = 0;
                    return void (this.consecutiveRateLimits = 0);
                }
                const ye = Date.now();
                const es = await this.assetService.fetchAssetsChangeFeed(this.cursorMs);
                if (this.isSuperseded(pe, session)) {
                    return;
                }
                if (!es) {
                    this.consecutiveFailures += 1;
                    return void (this.consecutiveRateLimits = 0);
                }
                this.consecutiveFailures = 0;
                this.consecutiveRateLimits = 0;
                this.applyInterval(es.intervalMs);
                this.cursorMs = ye;
                if (es.assetIds.length > 0) {
                    emit(QueueEvent.REFRESH_BALANCE, {
                        assetIds: es.assetIds
                    });
                }
            } catch (error) {
                if (!this.isSuperseded(this.scope, session)) {
                    this.consecutiveFailures += 1;
                    this.trackRateLimit(getHttpStatus(error) === 429);
                }
                logger_default.debug("Assets change feed tick failed", error);
            } finally{
                this.inFlight = false;
                if (session === this.session || this.running && !this.timer) {
                    this.schedule();
                }
            }
        }
        trackRateLimit(ae) {
            this.consecutiveRateLimits = ae ? this.consecutiveRateLimits + 1 : 0;
            if (!(this.rateLimitReported || this.consecutiveRateLimits < _BalanceFeedService1.RATE_LIMIT_REPORT_AFTER)) {
                this.rateLimitReported = true;
                captureException(new Error("Assets change feed rate-limited (HTTP 429)"), {
                    context: "assets-change-feed",
                    consecutiveRateLimits: this.consecutiveRateLimits,
                    tags: {
                        feature: "assets_change_feed",
                        http_status: 429
                    }
                });
            }
        }
        isSuperseded(ae, pe) {
            return pe !== this.session || this.currentScope() !== ae;
        }
        nextDelayMs() {
            if (this.consecutiveFailures === 0) {
                return this.intervalMs;
            }
            return Math.min(_BalanceFeedService1.MAX_INTERVAL_MS, _BalanceFeedService1.FAILURE_BACKOFF_BASE_MS * 2 ** (this.consecutiveFailures - 1));
        }
        applyInterval(ae) {
            if (typeof ae === "number" && ae > 0) {
                this.intervalMs = Math.min(_BalanceFeedService1.MAX_INTERVAL_MS, Math.max(_BalanceFeedService1.MIN_INTERVAL_MS, ae));
            }
        }
        constructor(){
            this.running = false;
            this.inFlight = false;
            this.timer = null;
            this.intervalMs = _BalanceFeedService1.DEFAULT_INTERVAL_MS;
            this.consecutiveFailures = 0;
            this.consecutiveRateLimits = 0;
            this.rateLimitReported = false;
            this.cursorMs = 0;
            this.scope = null;
            this.session = 0;
        }
    };
    _BalanceFeedService1 = _BalanceFeedService;
    _BalanceFeedService.DEFAULT_INTERVAL_MS = 3000;
    _BalanceFeedService.MIN_INTERVAL_MS = 1000;
    _BalanceFeedService.MAX_INTERVAL_MS = 60000;
    _BalanceFeedService.FAILURE_BACKOFF_BASE_MS = 10000;
    _BalanceFeedService.RATE_LIMIT_REPORT_AFTER = 4;
    BalanceFeedService = _BalanceFeedService;
    __decorate([
        Use(AssetService),
        __decorateMetadata("design:type", AssetService === undefined ? Object : AssetService)
    ], BalanceFeedService.prototype, "assetService", undefined);
    BalanceFeedService = _BalanceFeedService1 = __decorate([
        Injectable()
    ], BalanceFeedService);
});
const init_balance_service = __esmMin(()=>{
    init_logger$1();
    init_injectable_decorator();
    init_use_decorator();
    init_big();
    init_asset$1();
    init_blockchains$1();
    init_wallet$2();
    init_queue_service();
    init_wallet$3();
    init_poller();
    init_balance_manager();
    init_balanceStream_service();
    init_balanceFeed_service();
    init_utils$22();
    init_evmSharedAccount_utils();
    init_utils$25();
    init_iBalance();
    init_store$1();
    init_asset$2();
    import_lodash$13 = require_lodash();
    init_app$1();
    init_isFeatureEnabled();
    init_assets_polling();
    init_boundedConcurrency();
    init_decorateMetadata();
    init_decorate();
    collectAutoEnableCandidates = (ae, pe, ye)=>{
        const es = new Set(pe.map((ae)=>ae.assetId));
        const ss = [];
        for (const ns of ae){
            if (combineOwnedBalances(ns) === "0") {
                continue;
            }
            const ae = ye.get(ns.assetId);
            if (ae) {
                if (!(ae.isShownInHomeScreen || ae.homeOverride?.action === "hide" && ae.homeOverride.hadBalance)) {
                    if (es.has(ns.assetId) || ae.pendingAutoEnable) {
                        ss.push(ae);
                    }
                }
            } else if (es.has(ns.assetId)) {
                logger_default.warn("Asset not found when trying to pre-enable it");
            }
        }
        return ss;
    };
    hasBalanceChanged = (ae, pe)=>!pe || pe.coinId !== ae.coinId || balanceTypes.some((ye)=>(pe[ye] ?? "0") !== (ae[ye] ?? "0")) || resourceTypes.some((ye)=>pe[ye]?.amount !== ae[ye]?.amount || pe[ye]?.limit !== ae[ye]?.limit);
    _BalanceService = class BalanceService {
        getPollingInterval() {
            const { enabled } = isFeatureEnabled(ASSETS_POLLING_EXPERIMENT);
            const pe = enabled && this.isQuickPollingEnabled ? _BalanceService1.POLL_BALANCE_INTERVAL_FAST : _BalanceService1.POLL_BALANCE_INTERVAL;
            logger_default.debug(`Balance polling interval: ${pe}ms (fast polling ${enabled && this.isQuickPollingEnabled ? "enabled" : "disabled"})`);
            return pe;
        }
        setIsQuickPollingEnabled(ae) {
            if (this.isQuickPollingEnabled !== ae) {
                this.isQuickPollingEnabled = ae;
                this.updatePollingInterval();
            }
        }
        updatePollingInterval() {
            if (this.getPollingInterval() !== this.balancePoller.opts.interval) {
                this.resetBalancePoller();
            }
        }
        startBalancePoller() {
            this.startSweepPoller();
            this.balanceFeedService.start();
        }
        startSweepPoller() {
            const interval = this.getPollingInterval();
            if (this.balancePoller) {
                this.balancePoller.stop();
            }
            this.balancePoller = new Poller({
                interval
            });
            this.balancePoller.start(()=>{
                emit(QueueEvent.REFRESH_BALANCE);
                emit(QueueEvent.CLEAN_STALE_NOTIFICATIONS);
            });
        }
        stopBalancePoller() {
            this.balancePoller.stopAndRemoveListeners();
            this.balanceFeedService.stop();
        }
        resetBalancePoller() {
            this.balancePoller.stopAndRemoveListeners();
            this.startSweepPoller();
        }
        async refresh(ae = false) {
            try {
                await this.refreshBalancesActive(ae);
            } catch (error) {
                logger_default.error(error);
            }
        }
        async refreshAssets(ae) {
            try {
                const pe = getAssetsV2Map();
                const ye = ae.map((ae)=>pe.get(ae)).filter((ae)=>Boolean(ae));
                if (ye.length === 0) {
                    return true;
                }
                const { enabled } = await this.refreshBalancesFor(ye, true);
                if (enabled > 0) {
                    emit(QueueEvent.FETCH_TICKERS);
                }
                return true;
            } catch (error) {
                logger_default.error(error);
                return false;
            }
        }
        onApplicationShutdown() {
            this.balancePoller.stopAndRemoveListeners();
        }
        async fetchBalance(ae, pe, ye, es) {
            const ss = getAllBlockchains();
            const ns = getAccounts$3();
            if (!getActiveWalletId()) {
                return {
                    balance: new Big(0)
                };
            }
            const ts = ss[ae];
            if (ts) {
                return this.balanceServiceManager.fetchBalanceAddress(ts, ns, pe, ye, es);
            }
            return {
                balance: new Big(0)
            };
        }
        async refreshBalancesActive(ae = false) {
            const pe = getHomeScreenAssets();
            const ye = getAssetsWithBalanceAlreadyEnabled();
            const es = ae || !ye;
            const ss = getWalletNewlyImported();
            if (!getActiveWalletId()) {
                return;
            }
            if (pe.length === 0) {
                return;
            }
            const ns = es ? [
                ...getAssetsV2Map().values()
            ] : pe;
            try {
                await this.refreshBalancesFor(ns, es);
            } finally{
                if (ss) {
                    this.checkIfActiveWalletHasBalance();
                    store.dispatch(appSlice.actions.setWalletNewlyImported(false));
                }
            }
        }
        async refreshBalancesFor(ae, pe) {
            const ye = getAssetsV2Map();
            const es = getDefaultAndCustomBlockchains();
            const ss = getAccounts$3();
            const walletId = getActiveWalletId();
            const ts = getBalances();
            const accountId = getActiveAccountId();
            if (!walletId) {
                return {
                    enabled: 0
                };
            }
            const os = ae.filter(({ assetId, isCustomAsset, blockchainId })=>{
                const { coinId } = parseAssetId(assetId);
                return Boolean(resolveAccountForChain(ss, coinId, isCustomAsset ? {
                    isCustom: true
                } : blockchainId ? es[blockchainId] : undefined));
            });
            const as = [];
            const cs = [];
            let enabled = 0;
            const flush = ()=>{
                if (cs.length > 0) {
                    store.dispatch(assetSlice.actions.enableInHomeScreenBulk({
                        walletId,
                        assetIds: cs.splice(0, cs.length).map((ae)=>ae.assetId)
                    }));
                }
                if (as.length > 0) {
                    logger_default.debug("Flushing updated balances");
                    store.dispatch(walletSlice.actions.setBalances({
                        walletId,
                        balances: as.splice(0, as.length),
                        accountId
                    }));
                }
            };
            const ls = setInterval(flush, _BalanceService1.FLUSH_REFRESH_BALANCE);
            try {
                const filterAndAddResults = (ae)=>{
                    const es = ae.filter((ae)=>hasBalanceChanged(ae, ts[ae.assetId]));
                    if (pe) {
                        const pe = collectAutoEnableCandidates(ae, es, ye);
                        enabled += pe.length;
                        cs.push(...pe);
                    }
                    if (es.length > 0) {
                        as.push(...es);
                    }
                };
                const fetchViaClient = async (ae)=>{
                    if (ae.length === 0) {
                        return;
                    }
                    const [pe, ye] = import_lodash$13.partition(ae, (ae)=>!!parseAssetId(ae.assetId).address);
                    const ns = import_lodash$13.groupBy(pe, (ae)=>parseAssetId(ae.assetId).coinId);
                    await runWithBoundedConcurrency([
                        ...Object.keys(ns).map((ae)=>async ()=>{
                                const { blockchainId } = ns[ae][0];
                                const ye = es[blockchainId];
                                const ts = await this.balanceServiceManager.fetchTokensBalance(ye, ss, ns[ae]);
                                if (ts) {
                                    filterAndAddResults(ts);
                                }
                            }),
                        ...ye.map((ae)=>async ()=>{
                                const pe = await this.balanceServiceManager.fetchBalance(ae, es, ss);
                                if (pe) {
                                    filterAndAddResults([
                                        pe
                                    ]);
                                }
                            })
                    ], _BalanceService1.CLIENT_FALLBACK_CONCURRENCY, async (ae)=>{
                        try {
                            await ae();
                        } catch (error) {
                            logger_default.warn("Balance client fallback task failed", error);
                            throw error;
                        }
                    });
                };
                const ae = await this.balanceStreamService.fetchBalances(os, ss, es);
                if (ae.results.length > 0) {
                    filterAndAddResults(ae.results);
                }
                const ns = new Set(ae.results.map((ae)=>ae.assetId));
                await fetchViaClient(ae.ok ? os.filter((ae)=>!ns.has(ae.assetId)) : os);
                return {
                    enabled
                };
            } finally{
                flush();
                clearInterval(ls);
            }
        }
        checkIfActiveWalletHasBalance() {
            const ae = getBalances();
            if (!Object.values(ae).some((ae)=>new Big(combineOwnedBalances(ae)).gt(0))) {
                store.dispatch(appSlice.actions.setShowEmptyWalletImportedModal(true));
            }
        }
        constructor(){
            this.balancePoller = new Poller({
                interval: this.getPollingInterval()
            });
            this.isQuickPollingEnabled = false;
        }
    };
    _BalanceService1 = _BalanceService;
    _BalanceService.POLL_BALANCE_INTERVAL = 60000;
    _BalanceService.POLL_BALANCE_INTERVAL_FAST = 30000;
    _BalanceService.FLUSH_REFRESH_BALANCE = 500;
    _BalanceService.CLIENT_FALLBACK_CONCURRENCY = 4;
    BalanceService = _BalanceService;
    __decorate([
        Use(BalanceServiceManager),
        __decorateMetadata("design:type", BalanceServiceManager === undefined ? Object : BalanceServiceManager)
    ], BalanceService.prototype, "balanceServiceManager", undefined);
    __decorate([
        Use(BalanceStreamService),
        __decorateMetadata("design:type", BalanceStreamService === undefined ? Object : BalanceStreamService)
    ], BalanceService.prototype, "balanceStreamService", undefined);
    __decorate([
        Use(BalanceFeedService),
        __decorateMetadata("design:type", BalanceFeedService === undefined ? Object : BalanceFeedService)
    ], BalanceService.prototype, "balanceFeedService", undefined);
    BalanceService = _BalanceService1 = __decorate([
        Injectable()
    ], BalanceService);
});
