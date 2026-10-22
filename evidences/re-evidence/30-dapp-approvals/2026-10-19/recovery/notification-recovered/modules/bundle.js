const ConfirmationBoundary = ({ id, children })=>{
    const onError = yd.useCallback(()=>{
        if (id) {
            aa.emit(ze.notificationControllerRemoveNotification, [
                id
            ]).catch((g)=>W.error("ConfirmationBoundary: failed to remove notification", g));
            Dr({
                method: `${ze.notificationCancelPrefix}${id}`,
                data: {
                    error: Cd.ethErrors.provider.userRejectedRequest()
                }
            }).catch((g)=>W.error("ConfirmationBoundary: failed to reject request", g));
        } else {
            W.error("ConfirmationBoundary caught a crash for a notification with no id");
        }
    }, [
        id
    ]);
    return <Lt fallback=<GenericError/> tags={{
        feature: "dapp-confirmation"
    }} resetKeys={[
        id
    ]} onError={onError}>{children}</Lt>;
};
const Hb = [
    "https://bscscan.com",
    "https://pancakeswap.finance",
    "https://account.mocaverse.xyz",
    "https://asterdex.github.io",
    "https://aden.io"
];
const isUnlockPopupMethod = (method)=>method === va.UNLOCK_POPUP || method === "PUBLIC_UnlockPopup";
const Notification$1 = ({ data })=>{
    const { id, method } = data;
    const I = ee();
    const L = useSelectedDappData(data.sender?.origin);
    const P = Pa();
    const R = data.params?.networkId ?? Ta.ethereum;
    const D = useResolvedSiteConnection(data.sender?.origin ?? "", P, R);
    const F = q();
    const [z] = useSelectedBlockchainForNetwork(Ea.EVM);
    const [B] = useSelectedBlockchainForNetwork(Ea.SOL);
    const V = bi(z);
    const network = bi(B);
    const H = useAccountPrefixedCoinIds(I ?? undefined, P ?? "").includes("c501");
    const assetId = er({
        coinId: V?.coinId
    }) ?? "";
    const Z = hs(assetId);
    const Q = yd.useCallback(()=>aa.emit(ze.notificationControllerRemoveNotification, [
            id
        ]), [
        id
    ]);
    const X = yd.useCallback(async (g)=>{
        Q();
        await Dr({
            method: `${ze.notificationCancelPrefix}${id}`,
            data: {
                error: Cd.serializeError(g ?? Cd.ethErrors.provider.userRejectedRequest())
            }
        });
    }, [
        Q,
        id
    ]);
    const te = yd.useCallback(()=>X(), [
        X
    ]);
    const re = yd.useCallback(async (g)=>{
        let params = {};
        if (vd.isPlainObject(g)) {
            params = g;
        }
        Q();
        await Dr({
            method: `${ze.notificationConfirmPrefix}${id}`,
            data: {
                params
            }
        });
    }, [
        Q,
        id
    ]);
    const ae = yd.useMemo(()=>method === va.ETH_SIGN_TRANSACTION && Ti(data.params?.data), [
        data.params,
        method
    ]);
    const { trackAnalytics } = Ee();
    const dappDomain = ((g)=>{
        if (typeof g !== "string" || !g) {
            return null;
        }
        try {
            return new URL(g).hostname || null;
        } catch  {
            return null;
        }
    })(data.sender?.origin);
    const requestType = ((method_1, M)=>{
        switch(method_1){
            case va.ETH_REQUEST_ACCOUNTS:
            case va.WALLET_REQUEST_PERMISSIONS:
                return "connect";
            case va.ETH_SEND_TRANSACTION:
            case va.ETH_SIGN_TRANSACTION:
                if (M) {
                    return "approve";
                }
                return "transaction";
            case va.ETH_SIGN_TYPED_MESSAGE:
            case va.ETH_SIGN_TYPED_DATA:
                return "typed_data";
            case va.SOL_SIGN_RAW_TRANSACTION:
            case va.SOL_SIGN_RAW_TRANSACTION_MULTI:
            case va.BITCOIN_SIGN_PSBT:
                return "transaction";
            case va.ETH_SIGN:
            case va.ETH_SIGN_PERSONAL_MESSAGE:
            case va.GENERIC_SIGN_MESSAGE:
            case va.SIGN_BNB_MESSAGE:
                return "message";
            case va.WALLET_ADD_ETHEREUM_CHAIN:
                return "add_network";
            case va.WALLET_SWITCH_NETWORK:
                return "switch_network";
            case va.WALLET_WATCH_ASSET:
                return "add_asset";
            default:
                return "other";
        }
    })(method, ae);
    const oe = !!dappDomain && !isRequestInternal(data);
    const chain = R === Ta.ethereum ? z ?? R : R;
    const de = yd.useCallback((g)=>{
        if (oe) {
            trackAnalytics({
                event: requestType === "connect" ? g ? G.DAPP_CONNECTED : G.DAPP_CONNECTION_REJECTED : g ? G.DAPP_SIGNATURE_APPROVED : G.DAPP_SIGNATURE_REJECTED,
                props: {
                    pageViewSource: $.NOTIFICATION_DAPP_REQUEST,
                    dappDomain,
                    requestType,
                    chain
                }
            });
        }
    }, [
        oe,
        requestType,
        dappDomain,
        chain,
        trackAnalytics
    ]);
    yd.useEffect(()=>{
        if (oe && requestType !== "connect") {
            trackAnalytics({
                event: G.DAPP_SIGNATURE_REQUESTED,
                props: {
                    pageViewSource: $.NOTIFICATION_DAPP_REQUEST,
                    dappDomain,
                    requestType,
                    chain
                }
            });
        }
    }, [
        id
    ]);
    const onCancel = yd.useCallback(async ()=>{
        de(false);
        await te();
    }, [
        te,
        de
    ]);
    const onReject = yd.useCallback(async (g)=>{
        de(false);
        await X(g);
    }, [
        X,
        de
    ]);
    const onConfirm = yd.useCallback(async (g)=>{
        de(true);
        await re(g);
    }, [
        re,
        de
    ]);
    const he = method === va.ETH_SIGN_TRANSACTION && data.params.networkId === Ta.cosmos && !data.params.raw;
    const Ge = yd.useMemo(()=>{
        const M = [
            va.ETH_REQUEST_ACCOUNTS,
            va.WALLET_REQUEST_PERMISSIONS
        ];
        const I = [
            va.ETH_SEND_TRANSACTION,
            va.ETH_SIGN,
            va.GENERIC_SIGN_MESSAGE,
            va.ETH_SIGN_TYPED_MESSAGE,
            va.ETH_SIGN_TRANSACTION,
            va.ETH_SIGN_PERSONAL_MESSAGE
        ];
        if (method === va.ETH_REQUEST_ACCOUNTS && F.type === ar.HARDWARE && data.params.networkId === Ta.solana && !H) {
            return (g)=><UnsupportedNetwork network={network} {...g}/>;
        }
        if (I.includes(method) && data.params.networkId === Ta.ethereum && parseInt(data.params.web3ChainId) !== parseInt(V?.chainId ?? "")) {
            W.error("web3 request chainId for write method is not the same as the selected network");
            return (g)=><ChainMismatch {...g}/>;
        }
        const R = Hb.includes(data.sender?.origin) || ((g)=>{
            const M = g?.origin;
            const T = g?.tab?.url;
            if (!M || M === "null" || !T) {
                return false;
            }
            try {
                const g = new URL(T).origin;
                return g !== "null" && g === M;
            } catch  {
                return false;
            }
        })(data.sender) || isUnlockPopupMethod(method);
        if (Number(data.sender?.frameId) > 0 && !R) {
            return (g)=><NoPermission {...g} message="dapp.frames-disallowed" rejectError={Cd.ethErrors.provider.unauthorized("Request blocked: embedded frames are not allowed for this origin.")}/>;
        }
        if (I.includes(method) && !L && !isRequestInternal(data)) {
            return (g)=><NoPermission {...g} rejectError={Cd.ethErrors.provider.unauthorized("Site not connected. Connect your wallet to this origin, then try again.")}/>;
        }
        if (!M.includes(method) && D && D.accountId !== P) {
            return SwitchWallet;
        }
        if (method === va.LOADING_SPINNER_CONFIRMING) {
            return BnbStakingConfirmation;
        }
        if (isUnlockPopupMethod(method)) {
            return UnlockPopupPlaceholder;
        }
        switch(method){
            case va.DAPP_TRIGGERED_STAKING_TRANSACTION:
                return Ln;
            case va.ETH_REQUEST_ACCOUNTS:
            case va.WALLET_REQUEST_PERMISSIONS:
                return ConnectWallet;
            case va.WALLET_ADD_ETHEREUM_CHAIN:
                return AddNetwork;
            case va.WALLET_WATCH_ASSET:
                return AddAsset;
            case va.WALLET_SWITCH_NETWORK:
                return SwitchNetwork;
            case va.ETH_SEND_TRANSACTION:
            case va.ETH_SIGN_TRANSACTION:
                if (ae) {
                    return App$7;
                }
                if (he) {
                    return SignCosmosMessage;
                }
                if (data.params.networkId === Ta.ton) {
                    return SignTonTransaction;
                }
                if (data.params.networkId === Ta.tron) {
                    return SignTronTransaction;
                }
                return SendTransaction;
            case va.ETH_SIGN_TYPED_MESSAGE:
            case va.ETH_SIGN_PERSONAL_MESSAGE:
                return SignMessage;
            case va.SIGN_BNB_MESSAGE:
                return SignBNBMessage;
            case va.ETH_GET_ENCRYPTION_PUBLIC_KEY:
                return GetEncryptedPublicKey;
            case va.ETH_DECRYPT:
                return Decrypt;
            case va.GENERIC_SIGN_MESSAGE:
                if (data.params.networkId === Ta.ethereum) {
                    return SignMessage;
                }
                if (data.params.networkId === Ta.ton) {
                    return SignTonRawMessage;
                }
                if (data.params.networkId === Ta.cosmos) {
                    return SignCosmosArbitrary;
                }
                if (data.params.networkId === Ta.tron) {
                    return SignTronMessage;
                }
                if (data.params.networkId === Ta.bitcoin) {
                    return NoPermission;
                }
                return SignSolanaMessage;
            case va.SOL_SIGN_RAW_TRANSACTION:
            case va.SOL_SIGN_RAW_TRANSACTION_MULTI:
                return SignSolanaRawTransaction;
            case va.BITCOIN_SIGN_PSBT:
                return SignBitcoinPSBT;
            default:
                return ()=><div/>;
        }
    }, [
        L,
        data,
        ae,
        he,
        method,
        V?.chainId,
        D,
        P,
        F.type,
        I,
        network,
        H
    ]);
    yd.useEffect(()=>{
        if (Z && !Z.isShownInHomeScreen) {
            aa.emit(Oo.TOGGLE_ASSET_VISIBILITY, Z);
            aa.emit(ni.FETCH_BALANCE, {
                blockchainId: Z.blockchainId
            });
        }
        if (!Z) {
            aa.emit(Oo.GET_AND_ADD_ASSET, {
                assetId
            });
        }
    }, []);
    return <Ge state={data.params?.state} data={data} onCancel={onCancel} onReject={onReject} onConfirm={onConfirm}/>;
};
const App$6 = ()=>{
    const g = Pr((g)=>g.notification);
    const [M, setM] = yd.useState(1);
    const current = yd.useMemo(()=>{
        if (g.length === 0) {
            return 1;
        }
        return Math.min(M, g.length);
    }, [
        g,
        M
    ]);
    const L = g[current - 1];
    const P = yd.useCallback((M)=>Promise.all(g.map(async (g)=>{
            if (M !== g.sender.tab?.id) {
                return;
            }
            const T = await nr.tabs.get(g.sender.tab?.id);
            if (!(T && g.sender.url && T.url?.startsWith(g.sender.url))) {
                await aa.emit(ze.notificationControllerRemoveNotification, [
                    g.id
                ]);
                await Dr({
                    method: `${ze.notificationCancelPrefix}${g.id}`,
                    data: {
                        error: Cd.ethErrors.provider.userRejectedRequest()
                    }
                });
            }
        })), [
        g
    ]);
    yd.useEffect(()=>{
        nr.tabs.onUpdated.addListener(P);
        return ()=>nr.tabs.onUpdated.removeListener(P);
    }, [
        P
    ]);
    return bd.jsxs(vt, {
        children: [
            g.length > 1 && <Pagination current={current} total={g.length} onChange={(g)=>setM(g)}/>,
            L && <ConfirmationBoundary id={L.id}><Notification$1 data={L}/></ConfirmationBoundary>
        ]
    });
};
