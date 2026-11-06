const useIsSkip = (data)=>{
    const M = function useVerifyWalletAllowed(g) {
        const M = Ii(Ta.ethereum);
        const T = Pr((g)=>g.dapps.connectedSites);
        return !!M.data?.address && ((T.find((M)=>M.origin === g) || {}).addresses || []).includes(M.data.address);
    }(data.sender.origin);
    return data.method === "eth_requestAccounts" && M;
};
const ConnectWallet = ({ data, onCancel, onConfirm })=>{
    const { formatMessage } = ne();
    const L = q();
    const { trackAnalytics } = Ee();
    const R = useSenderOrigin(data.sender);
    const D = q();
    const F = ja();
    B = yd.useMemo(()=>({
            url: R
        }), []);
    const z = Za(ni.VALIDATE_DAPP_URL, "validate-url", B);
    var B;
    La({
        event: $.NOTIFICATION_CONNECT_DAPP,
        props: {
            dAppOriginUrl: R,
            walletType: D.type,
            blockchainId: data.params.networkId || Ta.ethereum,
            requestMethod: data.method
        }
    });
    const [V, setV] = yd.useState(false);
    const [W, setW] = yd.useState(false);
    const [opened, setOpened] = yd.useState(false);
    const [X] = Gn();
    const [ee, setEe] = yd.useState(null);
    const [ae, setAe] = yd.useState(false);
    const me = bi(X);
    const he = bi(((g, M, T)=>{
        if (g !== Ta.ethereum) {
            return g;
        }
        if (sr(T)) {
            return M;
        }
        return Ta.ethereum;
    })(data.params.networkId, X, me));
    const ge = Ii(data.params.networkId || Ta.ethereum, data.params.chainId);
    const fe = Ii(Ta.ethereum);
    const Se = useIsSkip(data);
    yd.useEffect(()=>{
        (async ()=>{
            setAe(true);
            const data_sender = data.sender;
            const T = data_sender?.tab?.id;
            if (!T) {
                return;
            }
            const I = await nr.tabs.get(T);
            const P = {
                origin: data_sender?.origin,
                icon: I?.favIconUrl,
                title: I?.title,
                addresses: ge.data?.address ? [
                    ge.data?.address
                ] : [],
                selectedWalletId: L.id,
                networkId: data.params.networkId,
                chainId: data.params.chainId,
                accountId: F.id
            };
            setAe(false);
            setEe(P);
        })();
    }, [
        ge,
        L.id,
        F?.id
    ]);
    const Ae = yd.useMemo(()=>{
        if (fe.data?.address) {
            return {
                ...ee,
                addresses: [
                    fe.data.address
                ],
                networkId: Ta.ethereum,
                accountId: F.id
            };
        }
        return null;
    }, [
        ee,
        fe,
        F
    ]);
    const onApprove = yd.useCallback(async ()=>{
        setV(true);
        await aa.emit(va.ADD_CONNECTED_SITE, ee);
        if (Ae && data.params.networkId === Ta.binance) {
            await aa.emit(va.ADD_CONNECTED_SITE, Ae);
        }
        trackAnalytics({
            event: G.CONNECT_DAPP,
            props: {
                pageViewSource: $.NOTIFICATION_CONNECT_DAPP,
                dAppOriginUrl: R,
                walletType: L.type,
                blockchainId: data.params.networkId
            }
        });
        setTimeout(()=>{
            onConfirm({
                address: data.params.networkId === Ta.cosmos ? ge : ge.data?.address
            });
        }, 500);
    }, [
        ee,
        ge,
        onConfirm
    ]);
    const [Me, setMe] = yd.useState(false);
    yd.useEffect(()=>{
        if (Me && !z.isLoading) {
            setMe(false);
            if (![
                sn.HIGH_RISK,
                sn.MEDIUM_RISK
            ].includes(z.riskLevel)) {
                onApprove();
            }
        }
    }, [
        Me,
        z.isLoading,
        z.riskLevel,
        onApprove
    ]);
    const onClick = yd.useCallback(async ()=>{
        Hr.dispatch(Ut.actions.addBlacklistedSite(ee));
        const g = getDAppByOrigin(R);
        if (g) {
            await aa.emit(va.DISCONNECT_SITE, g.id);
        }
        setTimeout(onCancel, 100);
    }, [
        ee,
        onCancel
    ]);
    if (Se) {
        onConfirm();
        return null;
    }
    if (ae || !ee || ge.isLoading) {
        return <$n>{bd.jsx(de, {
            size: ue.XLARGE
        })}</$n>;
    }
    if (V) {
        return <Connecting iconUrl={ee.icon} origin={ee.origin}/>;
    }
    if ([
        sn.HIGH_RISK,
        sn.MEDIUM_RISK
    ].includes(z.riskLevel)) {
        return <><ProceedRiskModal opened={opened} onClose={()=>setOpened(false)} onApprove={onApprove}/><div className="overflow-y-hidden h-[calc(100vh-1rem)]">{bd.jsxs(vt, {
            children: [
                <Et><div className="flex flex-col items-center space-y-2.5 p-12">{bd.jsx(oo, {})}{bd.jsx(te, {
                    type: Z.TITLE1,
                    align: ie.CENTER,
                    children: formatMessage({
                        id: "risk.lose-funds",
                        defaultMessage: "Warning! You could lose all your tokens!"
                    })
                })}<div className="flex justify-center items-center space-x-1 w-full">{bd.jsx(qn, {
                    colorClass: z.riskLevel === sn.HIGH_RISK ? "text-tw3-destructive-primary-default" : "text-tw3-warning-primary-default"
                })}{bd.jsx(te, {
                    truncated: true,
                    theme: z.riskLevel === sn.HIGH_RISK ? Re.ERROR : Re.WARNING,
                    weight: oe.BOLD,
                    children: formatMessage(z.riskLevel === sn.HIGH_RISK ? {
                        id: "risk.high-risk-url",
                        defaultMessage: " This URL is marked as high risk"
                    } : {
                        id: "risk.mid-risk-url",
                        defaultMessage: "This URL is marked as not secure"
                    })
                })}</div></div></Et>,
                <At><div className="mt-5 flex space-y-2 flex-col">{bd.jsx(ce, {
                    onClick: onCancel,
                    children: formatMessage({
                        id: "generic.stop-go-back-button",
                        defaultMessage: "Stop and go back"
                    })
                })}{bd.jsx(ce, {
                    theme: z.riskLevel === sn.HIGH_RISK ? pe.DANGER_TRANSPARENT : pe.WARNING_TRANSPARENT,
                    onClick: z.riskLevel === sn.HIGH_RISK ? ()=>{
                        setOpened(true);
                    } : onApprove,
                    children: formatMessage({
                        id: "risk.proceed",
                        defaultMessage: "Proceed anyway"
                    })
                })}</div></At>
            ]
        })}</div></>;
    }
    return <><Et>{bd.jsx(ut, {
        children: <div className="flex w-full flex-col items-center"><OriginTitleHeader iconUrl={ee.icon} origin={ee.origin} title={formatMessage({
            id: "connect-wallet.title"
        })}/><EmbeddedFrameWarning sender={data.sender}/>{z.isUnavailable && <div className="w-full my-2"><Jn theme={Yn.WARNING}>{formatMessage({
            id: "risk.dapp-check-unavailable",
            defaultMessage: "We couldn't check this site for risks right now. Only continue if you trust it."
        })}</Jn></div>}<div className="w-full my-4 space-y-2"><WalletSelect/>{ge.data?.address && <div className="flex py-3 px-4 rounded-4 gap-2 items-center bg-tw3-background-tertiary w-full"><div title={he?.displayName ?? he?.name}>{bd.jsx(ai, {
            name: he?.name ?? "",
            size: ue.MEDIUM,
            src: he?.iconUrl
        })}</div>{bd.jsx(te, {
            type: Z.BODY,
            theme: Re.LABEL_PRIMARY,
            children: Si({
                value: ge.data?.address,
                maxCharsPerSide: 10
            })
        })}</div>}</div><ul className={`w-full space-y-4 ${W ? "h-[170px] overflow-y-auto" : ""}`}><li><PermissionCard id="connect-wallet.notice1"/></li><li><PermissionCard id="connect-wallet.notice2"/></li><li><PermissionCard id="connect-wallet.notice3" warning/></li></ul></div>
    })}</Et><At><div className="flex mt-2 items-center space-x-2"><div>{bd.jsx(ce, {
        theme: pe.TRANSPARENT,
        noPadding: true,
        onClick: ()=>{
            setW(!W);
        },
        "data-testid": "expand-button",
        children: <span className={`${W ? "rotate-180" : "rotate-0"} transition duration-200 ease-in-out`}><Ko width={20} height={20} colorClass="text-tw3-label-secondary"/></span>
    })}</div><ButtonGroupNotification grow>{bd.jsx(ce, {
        onClick: onCancel,
        theme: pe.TRANSPARENT,
        children: bd.jsx(te, {
            theme: Re.BRAND,
            type: Z.SUBTITLE,
            children: formatMessage({
                id: "generic.cancel"
            })
        })
    })}{bd.jsx(ce, {
        disabled: !ge.data?.address,
        loading: Me,
        onClick: ()=>{
            if (z.isLoading) {
                setMe(true);
            } else {
                onApprove();
            }
        },
        children: formatMessage({
            id: "generic.connect"
        })
    })}</ButtonGroupNotification></div><div className={`mt-4 translate-x-0 ${W ? "h-14 translate-y-0" : "h-0 translate-y-[200px] absolute"} transition duration-200 ease-in-out overflow-hidden`}>{bd.jsx(ce, {
        onClick,
        theme: pe.DANGER,
        children: formatMessage({
            id: "connect-wallet.blacklist-button"
        })
    })}</div></At></>;
};
