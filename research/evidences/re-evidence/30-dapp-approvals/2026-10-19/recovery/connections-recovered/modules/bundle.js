const Connection = ()=>{
    La({
        event: $.SETTINGS_CONNECTED_DAPP,
        props: null
    });
    const { formatMessage } = ne();
    const M = dt();
    const { trackAnalytics } = Ee();
    const I = Tt().id;
    const L = Pr((g)=>g.dapps.dapps[I]);
    const P = Pr((g)=>(g.dapps.connectedDapps[I] || []).map((M)=>{
            const account = g.wallet.accountsPerWallet[M.walletId]?.[M.accountId];
            const wallet = g.wallet.wallets[M.walletId];
            return {
                ...M,
                account,
                wallet
            };
        }).filter((g)=>Boolean(g.account && g.wallet)));
    const R = Pa();
    const [D, setD] = yd.useState(null);
    yd.useEffect(()=>{
        if (!L) {
            M(X.SETTINGS_CONNECTIONS);
        }
    }, [
        L,
        M
    ]);
    if (L) {
        return bd.jsxs(vt, {
            children: [
                bd.jsx(xt, {
                    title: L?.title,
                    backAction: ()=>M(X.SETTINGS_CONNECTIONS)
                }),
                <Et className="overflow-hidden"><div className="flex flex-col space-y-2 text-center mt-4 mb-7">{bd.jsx(ai, {
                    src: L.icon,
                    name: L.title
                })}{bd.jsx(te, {
                    type: Z.HEADING,
                    theme: Re.LABEL_PRIMARY,
                    children: L.title
                })}{bd.jsx(te, {
                    type: Z.EMPHASIS,
                    theme: Re.LABEL_SECONDARY,
                    children: L.origin
                })}</div>{bd.jsxs(ut, {
                    children: [
                        <div className="flex flex-col gap-4">{P.map((M)=>{
                            const T = M.accountId === R;
                            return <div key={`${M.accountId}-${M.id}`} className="flex flex-col gap-2"><Qa>{bd.jsxs(wn, {
                                children: [
                                    bd.jsx(te, {
                                        theme: Re.LABEL_SECONDARY,
                                        type: Z.EMPHASIS,
                                        children: formatMessage({
                                            id: "dapps.connected-wallet"
                                        })
                                    }),
                                    bd.jsx(te, {
                                        theme: Re.LABEL_PRIMARY,
                                        type: Z.EMPHASIS,
                                        children: M.wallet?.name
                                    })
                                ]
                            })}{bd.jsxs(wn, {
                                children: [
                                    bd.jsx(te, {
                                        theme: Re.LABEL_SECONDARY,
                                        type: Z.EMPHASIS,
                                        children: formatMessage({
                                            id: "dapps.account-connected",
                                            defaultMessage: "Account connected"
                                        })
                                    }),
                                    bd.jsx(te, {
                                        theme: Re.LABEL_PRIMARY,
                                        type: Z.EMPHASIS,
                                        children: M.account.name
                                    })
                                ]
                            })}{bd.jsxs(wn, {
                                children: [
                                    bd.jsx(te, {
                                        theme: Re.LABEL_SECONDARY,
                                        type: Z.EMPHASIS,
                                        children: formatMessage({
                                            id: "dapps.address",
                                            defaultMessage: "Address"
                                        })
                                    }),
                                    bd.jsx(te, {
                                        theme: Re.LABEL_PRIMARY,
                                        type: Z.EMPHASIS,
                                        children: Si({
                                            value: M.address,
                                            maxCharsPerSide: 10
                                        })
                                    })
                                ]
                            })}{bd.jsxs(wn, {
                                children: [
                                    bd.jsx(te, {
                                        theme: Re.LABEL_SECONDARY,
                                        type: Z.EMPHASIS,
                                        children: formatMessage({
                                            id: "dapps.first-connected"
                                        })
                                    }),
                                    bd.jsx(cd, {
                                        value: M.date,
                                        theme: Re.LABEL_PRIMARY,
                                        type: Z.EMPHASIS
                                    })
                                ]
                            })}</Qa>{T ? <div className="flex justify-end"><Dl theme={Nl.SUCCESS} size={Rl.SMALL}>{formatMessage({
                                id: "dapps.active-account",
                                defaultMessage: "Active account"
                            })}</Dl></div> : bd.jsx(ce, {
                                theme: pe.SUBTLE,
                                disabled: D === M.accountId,
                                loading: D === M.accountId,
                                onClick: ()=>(async (walletId, accountId)=>{
                                        if (accountId !== R) {
                                            setD(accountId);
                                            try {
                                                await aa.emit(Ei.SWITCH_WALLET, {
                                                    walletId,
                                                    accountId
                                                });
                                            } catch (error) {
                                                W.error(error);
                                            } finally{
                                                setD(null);
                                            }
                                        }
                                    })(M.walletId, M.accountId),
                                children: formatMessage({
                                    id: "dapps.use-this-account",
                                    defaultMessage: "Use this account"
                                })
                            })}</div>;
                        })}</div>,
                        <div className="my-6">{bd.jsx(ce, {
                            theme: pe.SUBTLE_DANGER,
                            "data-testid": "revoke-button",
                            onClick: async ()=>{
                                await aa.emit(va.DISCONNECT_SITE, I);
                                trackAnalytics({
                                    event: G.REVOKE_DAPP_ACCESS,
                                    props: {
                                        pageViewSource: $.SETTINGS_CONNECTED_DAPP,
                                        dAppOriginUrl: L.origin
                                    }
                                });
                                M(X.SETTINGS_CONNECTIONS);
                            },
                            children: formatMessage({
                                id: "dapps.revoke-access"
                            })
                        })}</div>
                    ]
                })}</Et>
            ]
        });
    }
    return <></>;
};
const EmptyDappList = ({ message })=><div className="flex flex-col space-y-6 items-center justify-center mt-20"><_l/>{bd.jsx(te, {
        type: Z.TITLE1,
        theme: Re.LABEL_PRIMARY,
        children: message
    })}</div>;
const ClickableRow = ({ children, onClick })=><div role="button" onClick={onClick} className="flex items-center justify-between">{children}</div>;
const PlainRow = ({ children })=><div className="flex items-center justify-between">{children}</div>;
const Content = ({ title, iconUrl, subtitle, showDetail, onClick })=><><div className="flex mr-3 my-2">{bd.jsx(ai, {
        name: title,
        src: iconUrl,
        size: ue.LARGE
    })}</div><div className="flex flex-1 flex-col space-y-1 overflow-hidden"><div className="flex flex-1">{bd.jsx(te, {
        type: Z.SUBTITLE,
        theme: Re.LABEL_PRIMARY,
        truncated: true,
        children: title
    })}</div>{bd.jsx(te, {
        type: Z.BODY,
        theme: Re.LABEL_SECONDARY,
        truncated: true,
        children: subtitle
    })}</div><div className="ml-6">{showDetail ? bd.jsx(po, {
        colorClass: "text-tw3-label-secondary"
    }) : bd.jsx(ce, {
        theme: pe.TRANSPARENT,
        onClick,
        children: <It colorClass="text-tw3-label-secondary"/>
    })}</div></>;
const DappRow = (g)=>{
    if (g.showDetail) {
        return <ClickableRow onClick={g.onClick}><Content {...g}/></ClickableRow>;
    }
    return <PlainRow><Content {...g}/></PlainRow>;
};
const Connections = ()=>{
    const { trackAnalytics } = Ee();
    La({
        event: $.SETTINGS_ALL_CONNECTED_DAPPS,
        props: null
    });
    const M = dt();
    const { formatMessage } = ne();
    const { connectedDapps } = Pr((g)=>g.dapps);
    const L = Pr((g)=>g.dapps.dapps);
    const P = yd.useMemo(()=>Object.keys(connectedDapps).map((g)=>L[g]), [
        L,
        connectedDapps
    ]);
    const [loading, setLoading] = yd.useState(false);
    const onClick = yd.useCallback(async ()=>{
        setLoading(true);
        try {
            await aa.emit(va.DISCONNECT_ALL);
            trackAnalytics({
                event: G.REVOKE_ALL_DAPP_ACCESS,
                props: {
                    pageViewSource: $.SETTINGS_CONNECTED_DAPP
                }
            });
        } finally{
            setLoading(false);
        }
    }, []);
    return bd.jsxs(vt, {
        children: [
            bd.jsx(xt, {
                title: formatMessage({
                    id: "settings.connected-dapps"
                }),
                backAction: ()=>M(X.SETTINGS)
            }),
            <Et>{bd.jsx(ut, {
                children: P.length > 0 ? <ul className="space-y-2">{P.map((g)=><li key={g.id} className="bg-tw3-background-tertiary hover:bg-tw3-action-hover transition hover:scale-[1.01] mx-2 py-2 px-4 rounded-4"><DappRow iconUrl={g.icon} title={g.title} subtitle={g.origin} showDetail onClick={()=>M(`${X.SETTINGS_CONNECTION}/${g.id}`)}/></li>)}</ul> : <EmptyDappList message={formatMessage({
                    id: "dapps.empty-list"
                })}/>
            })}</Et>,
            P.length > 0 && <At>{bd.jsx(ce, {
                theme: pe.SUBTLE_DANGER,
                loading,
                onClick,
                children: formatMessage({
                    id: "dapp.disconnect-from-all",
                    defaultMessage: "Disconnect all"
                })
            })}</At>
        ]
    });
};
const ConnectionsBlacklist = ()=>{
    La({
        event: $.SETTINGS_BLACKLISTED_DAPP,
        props: null
    });
    const g = dt();
    const { formatMessage } = ne();
    const { trackAnalytics } = Ee();
    const I = Pr((g)=>g.dapps.blacklistedSites);
    return bd.jsxs(vt, {
        children: [
            bd.jsx(xt, {
                title: formatMessage({
                    id: "dapps.blacklist-header"
                }),
                backAction: ()=>g(X.SETTINGS)
            }),
            <Et>{bd.jsx(ut, {
                children: I.length > 0 ? <ul className="space-y-8">{I.map((g)=><li key={g.id}><DappRow iconUrl={g.icon} title={g.title} subtitle={g.origin} onClick={()=>((g)=>{
                            Hr.dispatch(Ut.actions.removeBlacklistedSite(g.id));
                            trackAnalytics({
                                event: G.REMOVE_BLACKLISTED_DAPP,
                                props: {
                                    pageViewSource: $.SETTINGS_BLACKLISTED_DAPP,
                                    dAppOriginUrl: g.origin
                                }
                            });
                        })(g)}/></li>)}</ul> : <EmptyDappList message={formatMessage({
                    id: "dapps.empty-blacklist"
                })}/>
            })}</Et>
        ]
    });
};
