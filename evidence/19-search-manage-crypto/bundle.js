import { f, i } from "./preload-helper-C61CWiqK.js";
import { B as B_1, D, E as E_1, F, G as G_1, H, I, L, P as P_1, V as V_1, W as W_1, at as P1, ct, dt, it, lt, t, ut, z } from "./useAnalytics-COpZR7i2.js";
import { n } from "./constants-CV-R2xp4.js";
import { t as t_2 } from "./useQuery-xfIhCxCG.js";
import { t as t_3 } from "./jsx-runtime-C2w7GV0M.js";
import { _, i as E, n as M, t as C } from "./Page-7xxhohWn.js";
import { K as K_1, L as L_2, M as M_1, N, W as W_2, X, i as i_2, vn } from "./store-cAVdfWrK.js";
import { t as t_4 } from "./dapps-D5KacSOR.js";
import { t as t_5 } from "./useAnalyticsCaptureOnMount-BJcdtAcr.js";
import { a, t as t_6 } from "./useAccounts-CoMylq9s.js";
import { t as U } from "./Center-Biy7RhoP.js";
import { t as Z1 } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_7 } from "./useAllBlockchains-BCf0ZYTP.js";
import { t as Y } from "./ClickableArea-BE_vFWHj.js";
import { t as G } from "./PlusIcon-B6VDMCyI.js";
import { t as V } from "./Switch-B-r8Q0cU.js";
import { i as Q1, r as $, t as K } from "./tabs-DqgailPo.js";
import { t as t_8 } from "./useSelectedBaseCurrency-drfds3sV.js";
import { t as W } from "./Badge-smZjUX8n.js";
import { t as t_9 } from "./asset-63gBbrJ-.js";
import { r } from "./window-COx4dq7s.js";
import { t as J } from "./EmptySearchContent-BPhzgYFK.js";
import { t as t_10 } from "./useHomeScreenAssets-DXW0UWI9.js";
import { t as t_11 } from "./useAssetBlockchain-W0mhozm9.js";
import { a as a_2, d, n as n_2, o as o_1, r as Oe, t as t_12 } from "./pWaitForMinTime-B1Z-6awB.js";
import { i as i_3, t as Le } from "./HorizontalNetworksFilter-D_mSA3oc.js";
import { t as De } from "./index.es-B0L6n6Xe.js";
import { t as Me1 } from "./SearchInput-BIldQfbO.js";
import { t as t_13 } from "./useDebounce-kScTeB3K.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const s = (new e.Error).stack;
        if (s) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[s] = "facaf798-b82f-4f90-ac4a-78186b8d51fd";
            e._sentryDebugIdIdentifier = "sentry-dbid-facaf798-b82f-4f90-ac4a-78186b8d51fd";
        }
    } catch (e) {}
})();
const pe = it();
const he = f(i(), 1);
const fe = t_3();
const InfoAction = ({ onClick, testid })=>{
    const { formatMessage } = P_1();
    const id = he.useMemo(()=>pe.uniqueId("import-info-action-"), []);
    return <><div data-tooltip-id={id} data-tooltip-content={formatMessage({
        id: "manage-crypto.info-action.text"
    })}><W_1 testid={testid} size={ut.SMALL} shape={lt.ICON_SQUARE} theme={dt.TRANSPARENT} noPadding onClick={onClick}><G colorClass="text-tw3-label-secondary"/></W_1></div><G_1 id={id} className="tw-tooltip"/></>;
};
const AssetRow = ({ asset, onAssetToggle })=>{
    const { trackAnalytics } = t();
    const { formatMessage } = P_1();
    const m = _();
    const [u, setU] = he.useState(asset.isShownInHomeScreen);
    const [h, setH] = he.useState(false);
    const g = F();
    const x = a();
    const y = t_6();
    const toggleAssetVisibility = async (asset)=>{
        const t = !asset.isShownInHomeScreen;
        onAssetToggle(asset);
        setU(t);
        setH(true);
        await t_12(((asset_1, action)=>vn.emit(t_9.SET_HOME_OVERRIDE, {
                asset: asset_1,
                action
            }))(asset, t ? "show" : "hide"), 250);
        setH(false);
    };
    const w = t_11(asset);
    const v = he.useMemo(()=>{
        const s = w?.isCustom || N(w) ? n.Ethereum.toString() : X(asset.assetId).coinId;
        return !Boolean(y[s]);
    }, [
        y,
        w,
        asset.assetId
    ]);
    const S = he.useMemo(()=>v && g.type === L_2.MNEMONIC && (x?.derivationIndex ?? 0) > 0, [
        g,
        x,
        v
    ]);
    if (!w) {
        return null;
    }
    return <Y disabled={v || h} onClick={async ()=>{
        if (!v) {
            if (!u) {
                await toggleAssetVisibility(asset);
            }
            m(`${H.ASSET}/${asset.assetId}`);
        }
    }}><div className="flex justify-between space-x-2 items-center"><div className={v ? "opacity-70" : "opacity-100"}><Z1 src={asset.iconUrl} name={asset.name} network={M_1(asset, w)}/></div><div className={`flex-grow ${v ? "opacity-70" : "opacity-100"}`}><L testid="asset-symbol" type={B_1.SUBTITLE}>{asset.symbol}</L><div className="flex flex-row space-x-1"><L testid="asset-blockchain" type={B_1.BODY}>{asset.name}</L></div></div><div className={h ? "opacity-50" : "opacity-100"}>{v ? <W text={formatMessage({
        id: S ? "manage-assets.not-supported" : "manage-assets.support-coming-soon",
        defaultMessage: S ? "Not supported" : "manage-assets.support-coming-soon"
    })}/> : <V testid="toggle-asset-switch" label={asset.name} checked={u} onChange={()=>{
        trackAnalytics({
            event: E_1.TOGGLE_HOMESCREEN_ASSET_VISIBILITY,
            props: {
                pageViewSource: D.MANAGE_CRYPTO,
                assetName: asset.name,
                assetId: asset.assetId,
                enabled: !u
            }
        });
        toggleAssetVisibility(asset);
    }}/>}</div></div></Y>;
};
const AssetList = ({ assets, loadMoreItems, hasNextPage, onAssetToggle, footer })=>{
    const nRef = he.useRef(null);
    const [o, setO] = he.useState(0);
    he.useLayoutEffect(()=>{
        const nRef_current = nRef.current;
        if (!nRef_current) {
            return;
        }
        const update = ()=>{
            setO(Math.max(0, window.innerHeight - nRef_current.getBoundingClientRect().top - 8));
        };
        update();
        const s = new ResizeObserver(update);
        s.observe(nRef_current);
        window.addEventListener("resize", update);
        return ()=>{
            s.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);
    return <div ref={nRef} className="h-full w-full"><De dataLength={assets.length} next={loadMoreItems} height={o || undefined} className="tw-scrollbar" hasMore={!!hasNextPage} loader={null} scrollThreshold="5px"><div className="flex flex-col space-y-5">{assets.map((asset)=><AssetRow key={asset.assetId} asset={asset} onAssetToggle={onAssetToggle}/>)}{footer}</div></De></div>;
};
const DappRow = ({ dapp })=>{
    const [s, setS] = he.useState(false);
    return <Y onClick={()=>{
        r(dapp.url);
    }}><div className="flex items-center gap-3 py-2">{dapp.image && !s ? <img src={dapp.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" onError={()=>setS(true)}/> : <Z1 name={dapp.name} size={ct.LARGE} abstractFallback/>}<div className="min-w-0 flex-1"><L type={B_1.SUBTITLE} weight={V_1.MEDIUM} truncated>{dapp.name}</L>{!!dapp.description && <L theme={z.LABEL_SECONDARY} type={B_1.BODY}>{pe.truncate(dapp.description, {
        length: 74
    })}</L>}</div></div></Y>;
};
const DappSection = ({ section: section_1 })=><section className="flex flex-col gap-2"><L type={B_1.SUBTITLE} weight={V_1.MEDIUM}>{section_1.name}</L><div className="flex flex-col">{section_1.items.map((s)=><DappRow key={`${section_1.id}-${s.id}`} dapp={s}/>)}</div></section>;
const DappList = ({ isLoading, isError, query, sections, searchResults })=>{
    const { formatMessage } = P_1();
    if (isLoading) {
        return <U><P1 size={ct.MEDIUM}/></U>;
    }
    if (isError) {
        return <J message={formatMessage({
            id: "discover.error",
            defaultMessage: "DApps are unavailable right now"
        })}/>;
    }
    if (query.trim()) {
        if (searchResults.length === 0) {
            return <J message={formatMessage({
                id: "discover.no-dapps-available",
                defaultMessage: "No DApps found"
            })}/>;
        }
        return <div className="flex flex-col">{searchResults.map((e)=><DappRow key={e.id} dapp={e}/>)}</div>;
    }
    if (sections.length === 0) {
        return <J message={formatMessage({
            id: "discover.no-dapps-available",
            defaultMessage: "No DApps found"
        })}/>;
    }
    return <div className="flex flex-col gap-6 pb-4">{sections.map((section)=><DappSection key={section.id} section={section}/>)}</div>;
};
const matchesExactly = (e, s)=>e.symbol.toLowerCase() === s || e.name.toLowerCase() === s;
const matchesPartially = (e, s)=>e.symbol.toLowerCase().includes(s) || e.name.toLowerCase().includes(s);
const rankTokenSearchResults = (e, s)=>{
    const t = s.trim().toLowerCase();
    if (!t || e.length === 0) {
        return {
            primary: e,
            secondary: []
        };
    }
    const a = [];
    const r = [];
    const n = [];
    const o = [];
    const i = [];
    e.forEach((e)=>{
        const s = ((e)=>!e.address && !e.isUserCustomAsset && !e.isCustomAsset || e.isVerified === true && Number.isFinite(e.marketCap) && (e.marketCap ?? 0) > 0)(e);
        if (s && matchesExactly(e, t)) {
            a.push(e);
        } else if (s && matchesPartially(e, t)) {
            r.push(e);
        } else if (!s && matchesExactly(e, t)) {
            n.push(e);
        } else if (!s && matchesPartially(e, t)) {
            o.push(e);
        } else {
            i.push(e);
        }
    });
    if (a.length > 0) {
        return {
            primary: a,
            secondary: [
                ...r,
                ...n,
                ...o,
                ...i
            ]
        };
    }
    if (r.length > 0) {
        return {
            primary: r,
            secondary: [
                ...n,
                ...o,
                ...i
            ]
        };
    }
    return {
        primary: e,
        secondary: []
    };
};
const DappsContent = ({ search })=>{
    const s = ((search_1)=>{
        const s = t_13(search_1, 300);
        const t = search_1.trim();
        const query = s.trim();
        const r = I();
        const n = i_2((e)=>e.app.deviceId);
        const { currency } = t_8();
        const enabled = Boolean(query || r && n);
        const l = t_2({
            queryKey: [
                "dapp-discovery",
                query,
                r,
                n,
                currency
            ],
            queryFn: ()=>vn.emit(t_4.FETCH_DAPP_DISCOVERY, {
                    query
                }),
            enabled,
            staleTime: query ? 60000 : 300000
        });
        return {
            ...l,
            isPending: enabled && (t !== query || l.isPending)
        };
    })(search);
    const tRef = he.useRef(null);
    const [height, setHeight] = he.useState(0);
    he.useLayoutEffect(()=>{
        const tRef_current = tRef.current;
        if (!tRef_current) {
            return;
        }
        const updateHeight = ()=>{
            setHeight(Math.max(0, Math.floor(window.innerHeight - tRef_current.getBoundingClientRect().top - 8)));
        };
        updateHeight();
        const s = new ResizeObserver(updateHeight);
        s.observe(document.documentElement);
        window.addEventListener("resize", updateHeight);
        return ()=>{
            s.disconnect();
            window.removeEventListener("resize", updateHeight);
        };
    }, []);
    return <div ref={tRef} data-testid="dapp-list-scroll-container" className="mt-4 w-full shrink-0 overflow-y-auto tw-scrollbar" style={{
        height
    }}><DappList isLoading={s.isPending} isError={s.isError} query={search} sections={s.data?.sections ?? []} searchResults={s.data?.searchResults ?? []}/></div>;
};
const ManageCrypto = ()=>{
    t_5({
        event: D.MANAGE_CRYPTO,
        props: null
    });
    const { formatMessage } = P_1();
    const s = _();
    const r = d();
    const o = t_10();
    const c = F();
    const g = t_7();
    const [x, setX] = he.useState(i_3());
    const y = he.useMemo(()=>{
        const e = g.find((e)=>e.id === x);
        if (e) {
            return [
                K_1(e.coinId)
            ];
        }
        return null;
    }, [
        g,
        x
    ]);
    const { isLoading, data } = n_2("trending", he.useMemo(()=>{
        const e = g.find((e)=>e.id === x);
        if (e) {
            return [
                Number(e.coinId)
            ];
        }
    }, [
        g,
        x
    ]), 10, o_1.sortField, o_1.sortDirection);
    const [S, setS] = he.useState("");
    const [k, setK] = he.useState("");
    const [B, setB] = he.useState(0);
    const [P, setP] = he.useState(false);
    const [Y, setY] = he.useState(false);
    const V = S.trim();
    const { flattenData, isFetching, setQuery, fetchNextPage, hasNextPage, useOnlyBackendResults } = a_2(y, true, undefined, undefined, true);
    const de = t_6();
    const ueRef = he.useRef(false);
    const ge = he.useMemo(()=>(({ search, assets })=>{
            if (search) {
                return assets.filter(({ symbol, name, address })=>address?.toLowerCase().includes(search.toLowerCase()) || symbol.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase()));
            }
            return assets;
        })({
            search: S,
            assets: r
        }), [
        r,
        S
    ]);
    const xe = he.useMemo(()=>((e, s, t)=>{
            const a = new Set;
            return [
                ...e,
                ...s
            ].filter((e)=>!(t && e.blockchainId !== t || a.has(e.assetId) || (a.add(e.assetId), 0)));
        })(o, ((e, s)=>{
            const t = new Set(s.map((e)=>e.blockchainId));
            return e.filter((e)=>t.has(e.blockchainId));
        })(((data_1, s, t)=>{
            const a = new Map(s.map((e)=>[
                    Number(e.coinId),
                    e
                ]));
            const r = new Map(t.map((e)=>[
                    e.assetId,
                    e
                ]));
            const n = new Set;
            return data_1.flatMap((e)=>{
                const asset_id = e.asset.asset_id;
                if (!e.asset.is_verified || n.has(asset_id)) {
                    return [];
                }
                const { coinId, address } = X(asset_id);
                const i = coinId == null ? undefined : a.get(coinId);
                if (!i) {
                    return [];
                }
                n.add(asset_id);
                const c = r.get(asset_id);
                const price = e.price.price;
                return [
                    {
                        ...c,
                        assetId: asset_id,
                        blockchainId: i.id,
                        address: address ?? undefined,
                        name: e.asset.name,
                        symbol: e.asset.symbol,
                        type: e.asset.type,
                        decimals: e.asset.decimals,
                        iconUrl: e.asset.icon_url,
                        balance: c?.balance ?? "0",
                        isShownInHomeScreen: c?.isShownInHomeScreen ?? false,
                        isVerified: true,
                        verifiers: [
                            "trustwallet"
                        ],
                        marketCap: e.market.market_cap,
                        volume24h: e.market.volume_24h,
                        fiat: c?.fiat ?? (price > 0 ? {
                            id: asset_id,
                            slug: e.asset.symbol.toLowerCase(),
                            price,
                            change_24h: e.price.percent_change_24h
                        } : undefined)
                    }
                ];
            });
        })(data, g, r), r), x), [
        o,
        data,
        g,
        r,
        x
    ]);
    const je = he.useCallback(pe.debounce((e)=>{
        const s = e.trim();
        setY(Boolean(s));
        setQuery(s || undefined);
    }, 200), []);
    const ye = he.useMemo(()=>flattenData.map((e)=>e.assetId), [
        flattenData
    ]);
    const we = he.useMemo(()=>new Map(r.map((e)=>[
                e.assetId,
                e.isShownInHomeScreen
            ])), [
        r
    ]);
    const Ie = he.useMemo(()=>{
        if (!V) {
            return xe;
        }
        const e = ge.filter((e)=>!ye.includes(e.assetId));
        const s = flattenData.map((e)=>({
                ...e,
                isShownInHomeScreen: e.isShownInHomeScreen || we.get(e.assetId)
            }));
        return (useOnlyBackendResults ? flattenData.map((e)=>({
                ...e,
                isShownInHomeScreen: e.isShownInHomeScreen || we.get(e.assetId)
            })) : [
            ...s,
            ...e
        ]).filter((e)=>{
            if (c.type === L_2.PRIVATE_KEY) {
                return !(!de[e.isCustomAsset ? 60 : W_2(e.assetId)] || x && x !== e.blockchainId);
            }
            return !x || x === e.blockchainId;
        });
    }, [
        ge,
        we,
        flattenData,
        ye,
        V,
        x,
        useOnlyBackendResults,
        c.type,
        de,
        xe
    ]);
    const ve = he.useMemo(()=>rankTokenSearchResults(Ie, V), [
        V,
        Ie
    ]);
    const Se = P ? [
        ...ve.primary,
        ...ve.secondary
    ] : ve.primary;
    he.useEffect(()=>{
        if (V) {
            setY(true);
            setQuery(V);
        }
    }, [
        x
    ]);
    he.useEffect(()=>{
        setP(false);
    }, [
        S,
        x
    ]);
    const onAssetToggle = he.useCallback((e)=>{}, []);
    he.useEffect(()=>{
        if (!isFetching || ueRef.current) {
            if (!isFetching && ueRef.current) {
                setY(false);
                ueRef.current = false;
            }
        } else {
            ueRef.current = true;
        }
    }, [
        isFetching
    ]);
    const Ee = he.useMemo(()=>{
        if (V && Y || !V && isLoading) {
            return <U><div><P1 size={ct.XLARGE}/></div></U>;
        }
        if (Se.length === 0) {
            return <J message={formatMessage({
                id: "token-asset-list.empty-search-caption"
            })}/>;
        }
        return <div className="mt-4 flex-1 min-h-0"><AssetList assets={Se} hasNextPage={!!V && hasNextPage} loadMoreItems={fetchNextPage} onAssetToggle={onAssetToggle} footer={ve.secondary.length > 0 ? <W_1 testid="manage-crypto-show-more" theme={dt.TRANSPARENT} onClick={()=>setP((e)=>!e)}><L theme={z.BRAND} type={B_1.SUBTITLE}>{formatMessage(P ? {
            id: "generic.show-less",
            defaultMessage: "Show less"
        } : {
            id: "generic.show-more",
            defaultMessage: "Show more"
        })}</L></W_1> : undefined}/></div>;
    }, [
        Y,
        V,
        isLoading,
        Se,
        hasNextPage,
        fetchNextPage,
        formatMessage,
        ve.secondary.length,
        P
    ]);
    const value = B === 0 ? S : k;
    return <M><E backAction={()=>s(-1)} title={formatMessage({
        id: "manage-crypto.title"
    })} infoAction={B === 0 ? <InfoAction testid="import-asset-info-action" onClick={()=>{
        s(H.CUSTOM_ASSET_SELECT_NETWORK);
    }}/> : undefined}/><C className="min-h-0 overflow-hidden"><K selectedIndex={B} onChange={setB}><$ className="relative flex h-10 gap-5 border-b border-b-tw3-line-divider">{[
        {
            id: "crypto",
            title: formatMessage({
                id: "global-search.section.crypto",
                defaultMessage: "Crypto"
            })
        },
        {
            id: "dapps",
            title: formatMessage({
                id: "global-search.section.dapps",
                defaultMessage: "DApps"
            })
        }
    ].map(({ id, title })=><Q1 key={id} data-testid={`manage-crypto-tab-${id}`} className="outline-none flex h-full items-center justify-center">{({ selected })=><L type={B_1.SUBTITLE} weight={V_1.MEDIUM} theme={selected ? z.LABEL_PRIMARY : z.LABEL_SECONDARY}>{title}</L>}</Q1>)}<Oe selectedIndex={B}/></$></K><div className="mt-4"><Me1 testid={B === 0 ? "search-asset-input" : "search-dapp-input"} value={value} onChange={(e)=>{
        if (B === 0) {
            setY(true);
            setS(e.target.value);
            je(e.target.value);
        } else {
            setK(e.target.value);
        }
    }} placeholder={formatMessage(B === 0 ? {
        id: "component.input-asset-search.placeholder"
    } : {
        id: "discover.search.placeholder",
        defaultMessage: "Search DApps"
    })}/></div>{B === 0 ? <><div className="mt-4"><Le localFilteringBlockchainId={x} onFilterChange={setX}/></div>{Ee}</> : <DappsContent search={k}/>}</C></M>;
};
export { ManageCrypto as default };
