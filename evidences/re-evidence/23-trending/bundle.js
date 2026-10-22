// REA-recovered (Wakaru 1.14.0) from App-D29UTaP5.js --unpack; TW v26.41.0.
// TrendingTokens page + PriceChangeSelect + table column defs + MarketSentiment.
// ---- TrendingTokens + table (entry.js ~80630-81365) ----
            let T = (M ? L.getPrePaginationRowModel() : L.getRowModel()).rowsById[g];
            if (!T && (T = L.getCoreRowModel().rowsById[g], !T)) {
                throw new Error;
            }
            return T;
        },
        _getDefaultColumnDef: memo(()=>[
                L.options.defaultColumn
            ], (g)=>{
            g = g ?? {};
            return {
                header: (g)=>{
                    const columnDef = g.header.column.columnDef;
                    if (columnDef.accessorKey) {
                        return columnDef.accessorKey;
                    }
                    if (columnDef.accessorFn) {
                        return columnDef.id;
                    }
                    return null;
                },
                cell: (g)=>{
                    var T;
                    return ((T = g.renderValue()) == null || T.toString == null ? undefined : T.toString()) ?? null;
                },
                ...L._features.reduce((acc, _feature)=>Object.assign(acc, _feature.getDefaultColumnDef?.()), {}),
                ...g
            };
        }, getMemoOptions(g, "debugColumns")),
        _getColumnDefs: ()=>L.options.columns,
        getAllColumns: memo(()=>[
                L._getColumnDefs()
            ], (g)=>{
            const recurseColumns = (g, M, T = 0)=>g.map((g)=>{
                    const I = function createColumn(g, M, T, I) {
                        const columnDef = {
                            ...g._getDefaultColumnDef(),
                            ...M
                        };
                        const R_accessorKey = columnDef.accessorKey;
                        let accessorFn;
                        let z = columnDef.id ?? (R_accessorKey ? typeof String.prototype.replaceAll === "function" ? R_accessorKey.replaceAll(".", "_") : R_accessorKey.replace(/\./g, "_") : undefined) ?? (typeof columnDef.header === "string" ? columnDef.header : undefined);
                        if (columnDef.accessorFn) {
                            accessorFn = columnDef.accessorFn;
                        } else if (R_accessorKey) {
                            accessorFn = R_accessorKey.includes(".") ? (g)=>{
                                let M = g;
                                for (const I of R_accessorKey.split(".")){
                                    M = M?.[I];
                                }
                                return M;
                            } : (g)=>g[columnDef.accessorKey];
                        }
                        if (!z) {
                            throw new Error;
                        }
                        let B = {
                            id: `${String(z)}`,
                            accessorFn,
                            parent: I,
                            depth: T,
                            columnDef,
                            columns: [],
                            getFlatColumns: memo(()=>[
                                    true
                                ], ()=>[
                                    B,
                                    ...B.columns?.flatMap((g)=>g.getFlatColumns())
                                ], getMemoOptions(g.options, "debugColumns")),
                            getLeafColumns: memo(()=>[
                                    g._getOrderColumnsFn()
                                ], (g)=>{
                                var M;
                                if ((M = B.columns) != null && M.length) {
                                    return g(B.columns.flatMap((g)=>g.getLeafColumns()));
                                }
                                return [
                                    B
                                ];
                            }, getMemoOptions(g.options, "debugColumns"))
                        };
                        for (const V of g._features){
                            V.createColumn?.(B, g);
                        }
                        return B;
                    }(L, g, T, M);
                    const P = g;
                    I.columns = P.columns ? recurseColumns(P.columns, I, T + 1) : [];
                    return I;
                });
            return recurseColumns(g);
        }, getMemoOptions(g, "debugColumns")),
        getAllFlatColumns: memo(()=>[
                L.getAllColumns()
            ], (g)=>g.flatMap((g)=>g.getFlatColumns()), getMemoOptions(g, "debugColumns")),
        _getAllFlatColumnsById: memo(()=>[
                L.getAllFlatColumns()
            ], (g)=>g.reduce((acc, item)=>{
                acc[item.id] = item;
                return acc;
            }, {}), getMemoOptions(g, "debugColumns")),
        getAllLeafColumns: memo(()=>[
                L.getAllColumns(),
                L._getOrderColumnsFn()
            ], (g, M)=>M(g.flatMap((g)=>g.getLeafColumns())), getMemoOptions(g, "debugColumns")),
        getColumn: (g)=>L._getAllFlatColumnsById()[g]
    };
    Object.assign(L, z);
    for(let B = 0; B < L._features.length; B++){
        const _feature = L._features[B];
        if (!(_feature == null || _feature.createTable == null)) {
            _feature.createTable(L);
        }
    }
    return L;
}
function filterRows(rows, M, T) {
    if (T.options.filterFromLeafRows) {
        return function filterRowModelFromLeafs(rows_1, M, T) {
            const L = [];
            const P = {};
            const R = T.options.maxLeafRowFilterDepth ?? 100;
            const recurseFilterRows = (g, I = 0)=>{
                const D = [];
                for (let B of g){
                    const V = createRow(T, B.id, B.original, B.index, B.depth, undefined, B.parentId);
                    V.columnFilters = B.columnFilters;
                    if (B.subRows?.length && I < R) {
                        V.subRows = recurseFilterRows(B.subRows, I + 1);
                        B = V;
                        if (M(B) && !V.subRows.length) {
                            D.push(B);
                            P[B.id] = B;
                            L.push(B);
                            continue;
                        }
                        if (M(B) || V.subRows.length) {
                            D.push(B);
                            P[B.id] = B;
                            L.push(B);
                            continue;
                        }
                    } else {
                        B = V;
                        if (M(B)) {
                            D.push(B);
                            P[B.id] = B;
                            L.push(B);
                        }
                    }
                }
                return D;
            };
            return {
                rows: recurseFilterRows(rows_1),
                flatRows: L,
                rowsById: P
            };
        }(rows, M, T);
    }
    return function filterRowModelFromRoot(rows_1, M, T) {
        const L = [];
        const P = {};
        const R = T.options.maxLeafRowFilterDepth ?? 100;
        const recurseFilterRows = (g, I = 0)=>{
            const D = [];
            for (let B of g){
                if (M(B)) {
                    if (B.subRows?.length && I < R) {
                        const g = createRow(T, B.id, B.original, B.index, B.depth, undefined, B.parentId);
                        g.subRows = recurseFilterRows(B.subRows, I + 1);
                        B = g;
                    }
                    D.push(B);
                    L.push(B);
                    P[B.id] = B;
                }
            }
            return D;
        };
        return {
            rows: recurseFilterRows(rows_1),
            flatRows: L,
            rowsById: P
        };
    }(rows, M, T);
}
function flexRender(g, M) {
    if (g) {
        if (function isReactComponent(g) {
            return function isClassComponent(g) {
                return typeof g === "function" && (()=>{
                    const M = Object.getPrototypeOf(g);
                    return M.prototype && M.prototype.isReactComponent;
                })();
            }(g) || typeof g === "function" || function isExoticComponent(g) {
                return typeof g === "object" && typeof g.$$typeof === "symbol" && [
                    "react.memo",
                    "react.forward_ref"
                ].includes(g.$$typeof.description);
            }(g);
        }(g)) {
            return yd.createElement(g, M);
        }
        return g;
    }
    return null;
}
const SorterIcon = ({ width, height, primaryColorClass, secondaryColorClass })=><svg fill="none" width={width ?? 16} height={height ?? 16} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path className={primaryColorClass} d="M6.12109 7.00048V5.8995L8.28776 3.56543L10.4544 5.8995V7.00048H6.12109Z" fill="currentColor"/><path className={secondaryColorClass} d="M10.4544 9V10.101L8.28776 12.435L6.12109 10.101V9H10.4544Z" fill="currentColor"/></svg>;
const Table = ({ data, loading, globalFilter, priceChange, disabled, selectedCategory, onTokenSelect })=>{
    const { formatMessage, locale } = P_1();
    const z = t_59();
    const { baseCurrencyType, currency } = t_31();
    const U = yd.useMemo(()=>[
            {
                accessorKey: "asset.name",
                id: "assetName",
                cell: (g)=>{
                    const M = z[g.row.original.asset.network];
                    const { address } = X(g.row.original.asset.asset_id);
                    const I = M?.displayName ?? M?.name;
                    return <div className="flex items-center space-x-2"><div className="shrink-0"><Ai1 name={g.getValue()} network={M_1({
                        address,
                        symbol: g.row.original.asset.symbol,
                        blockchainId: M?.id
                    }, M)} src={g.row.original.asset.icon_url}/></div><div className="flex flex-col min-w-0 max-w-[64px]"><L_1 testid="asset-symbol" type={B_1.SUBTITLE} truncated title={g.row.original.asset.symbol}>{g.row.original.asset.symbol}</L_1><L_1 theme={z_1.LABEL_SECONDARY} weight={V_1.LIGHT} truncated title={I}>{I}</L_1></div></div>;
                },
                enableSorting: false,
                header: ()=><L_1 type={B_1.FOOTNOTE} theme={z_1.LABEL_SECONDARY}>{formatMessage({
                        id: "dashboard.tokens.table.token"
                    })}</L_1>,
                meta: {
                    align: "left"
                }
            },
            {
                accessorKey: "price.price",
                id: "price",
                cell: (g)=>{
                    const M = g.row.original.price[priceChange];
                    const price = g.row.original.price.price;
                    const L = i_16(price, locale, currency);
                    return <div className="flex flex-col items-end min-w-0"><div className="max-w-full truncate" title={L ?? undefined}>{L ? <L_1 type={B_1.SUBTITLE} weight={V_1.NORMAL} truncated>{L}</L_1> : <Gs textType={B_1.SUBTITLE} weight={V_1.NORMAL} currency={currency} amountType={baseCurrencyType} value={price} maxSignificantDecimals={price < 0.01 ? 10 : undefined} tinyThreshold={price < 0.01 ? 10 : undefined}/>}</div><Gs theme={M > 0 ? z_1.SUCCESS : z_1.ERROR} weight={V_1.NORMAL} amountType={t_28.PERCENT} value={M}/></div>;
                },
                header: ()=><L_1 type={B_1.FOOTNOTE} theme={z_1.LABEL_SECONDARY}>{formatMessage({
                        id: "dashboard.tokens.table.price",
                        defaultMessage: "Price"
                    })}</L_1>,
                meta: {
                    align: "right"
                }
            },
            {
                accessorKey: "market.market_cap",
                id: "market",
                cell: (g)=><div className="flex flex-col"><div className="flex items-baseline justify-end gap-1"><Gs textType={B_1.SUBTITLE} weight={V_1.NORMAL} amountType={baseCurrencyType} value={g.row.original.market.market_cap} currency={currency} compact/></div><div className="flex items-baseline justify-end gap-1"><L_1 type={B_1.FOOTNOTE} theme={z_1.LABEL_SECONDARY} weight={V_1.LIGHT}>{formatMessage({
                        id: "dashboard.tokens.table.vol-label",
                        defaultMessage: "Vol:"
                    })}</L_1><Gs theme={z_1.LABEL_SECONDARY} weight={V_1.LIGHT} amountType={baseCurrencyType} value={g.row.original.market.volume_24h} currency={currency} compact/></div></div>,
                header: ()=><L_1 type={B_1.FOOTNOTE} theme={z_1.LABEL_SECONDARY}>{formatMessage({
                        id: "dashboard.tokens.table.market",
                        defaultMessage: "Market"
                    })}</L_1>,
                meta: {
                    align: "right"
                }
            }
        ], [
        priceChange
    ]);
    return <TokensTable data={yd.useMemo(()=>{
        if (loading) {
            return Array(30).fill({});
        }
        return data;
    }, [
        loading,
        data
    ])} columns={yd.useMemo(()=>{
        if (loading) {
            return U.map((g)=>({
                    ...g,
                    cell: <Wi1 isLoading><div className="w-full h-[30px]"/></Wi1>
                }));
        }
        return U;
    }, [
        loading,
        U
    ])} loading={loading} globalFilter={globalFilter} selectedCategory={selectedCategory} disabled={disabled} onTokenSelect={onTokenSelect} priceChange={priceChange}/>;
};
var TokensTable = ({ data, columns, loading, globalFilter, disabled, priceChange, selectedCategory, onTokenSelect })=>{
    const [globalFilter_1, setGlobalFilter] = yd.useState(globalFilter);
    const BRef = yd.useRef(null);
    const V = function useReactTable(g) {
        const M = {
            state: {},
            onStateChange: ()=>{},
            renderFallbackValue: null,
            ...g
        };
        const [T] = yd.useState(()=>({
                current: createTable(M)
            }));
        const [I, setI] = yd.useState(()=>T.current.initialState);
        T.current.setOptions((M)=>({
                ...M,
                ...g,
                state: {
                    ...I,
                    ...g.state
                },
                onStateChange: (M)=>{
                    setI(M);
                    g.onStateChange?.(M);
                }
            }));
        return T.current;
    }({
        columns,
        data,
        debugTable: false,
        filterFns: {
            nameOrContractFilter: (g, M, T)=>{
                const I = T.toLowerCase();
                const { address } = X(g.original.asset.asset_id);
                return !!address?.toLowerCase().includes(I) || !!g.original.asset.name.toLowerCase().includes(I) || !!g.original.asset.symbol.toLowerCase().includes(I);
            }
        },
        globalFilterFn: "nameOrContractFilter",
        getCoreRowModel: (g)=>memo(()=>[
                    g.options.data
                ], (M)=>{
                const T = {
                    rows: [],
                    flatRows: [],
                    rowsById: {}
                };
                const accessRows = (M, I = 0, L)=>{
                    const P = [];
                    for(let D = 0; D < M.length; D++){
                        const F = createRow(g, g._getRowId(M[D], D, L), M[D], D, I, undefined, L?.id);
                        let R;
                        T.flatRows.push(F);
                        T.rowsById[F.id] = F;
                        P.push(F);
                        if (g.options.getSubRows) {
                            F.originalSubRows = g.options.getSubRows(M[D], D);
                            if ((R = F.originalSubRows) != null && R.length) {
                                F.subRows = accessRows(F.originalSubRows, I + 1, F);
                            }
                        }
                    }
                    return P;
                };
                T.rows = accessRows(M);
                return T;
            }, getMemoOptions(g.options, "debugTable", 0, ()=>g._autoResetPageIndex())),
        getSortedRowModel: (g)=>memo(()=>[
                    g.getState().sorting,
                    g.getPreSortedRowModel()
                ], (M, T)=>{
                if (!T.rows.length || M == null || !M.length) {
                    return T;
                }
                const sorting = g.getState().sorting;
                const L = [];
                const P = sorting.filter((M)=>g.getColumn(M.id)?.getCanSort());
                const R = {};
                P.forEach((M)=>{
                    const T = g.getColumn(M.id);
                    if (T) {
                        R[M.id] = {
                            sortUndefined: T.columnDef.sortUndefined,
                            invertSorting: T.columnDef.invertSorting,
                            sortingFn: T.getSortingFn()
                        };
                    }
                });
                const sortData = (g)=>{
                    const M = g.map((g)=>({
                            ...g
                        }));
                    M.sort((g, M)=>{
                        for(let I = 0; I < P.length; I += 1){
                            var T;
                            const L = P[I];
                            const D = R[L.id];
                            const F = D.sortUndefined;
                            const z = (T = L?.desc) != null && T;
                            let B = 0;
                            if (F) {
                                const T = g.getValue(L.id) === undefined;
                                const I = M.getValue(L.id) === undefined;
                                if (T || I) {
                                    if (F === "first") {
                                        if (T) {
                                            return -1;
                                        }
                                        return 1;
                                    }
                                    if (F === "last") {
                                        if (T) {
                                            return 1;
                                        }
                                        return -1;
                                    }
                                    B = T && I ? 0 : T ? F : -F;
                                }
                            }
                            if (B === 0) {
                                B = D.sortingFn(g, M, L.id);
                            }
                            if (B !== 0) {
                                if (z) {
                                    B *= -1;
                                }
                                if (D.invertSorting) {
                                    B *= -1;
                                }
                                return B;
                            }
                        }
                        return g.index - M.index;
                    });
                    M.forEach((g)=>{
                        var M;
                        L.push(g);
                        if ((M = g.subRows) != null && M.length) {
                            g.subRows = sortData(g.subRows);
                        }
                    });
                    return M;
                };
                return {
                    rows: sortData(T.rows),
                    flatRows: L,
                    rowsById: T.rowsById
                };
            }, getMemoOptions(g.options, "debugTable", 0, ()=>g._autoResetPageIndex())),
        getFilteredRowModel: (g)=>memo(()=>[
                    g.getPreFilteredRowModel(),
                    g.getState().columnFilters,
                    g.getState().globalFilter
                ], (M, T, I)=>{
                if (!M.rows.length || (T == null || !T.length) && !I) {
                    for(let g = 0; g < M.flatRows.length; g++){
                        M.flatRows[g].columnFilters = {};
                        M.flatRows[g].columnFiltersMeta = {};
                    }
                    return M;
                }
                const L = [];
                const P = [];
                (T ?? []).forEach((M)=>{
                    const I = g.getColumn(M.id);
                    if (!I) {
                        return;
                    }
                    const P = I.getFilterFn();
                    if (P) {
                        L.push({
                            id: M.id,
                            filterFn: P,
                            resolvedValue: P.resolveFilterValue?.(M.value) ?? M.value
                        });
                    }
                });
                const R = (T ?? []).map((g)=>g.id);
                const D = g.getGlobalFilterFn();
                const F = g.getAllLeafColumns().filter((g)=>g.getCanGlobalFilter());
                let z;
                let B;
                if (I && D && F.length) {
                    R.push("__global__");
                    F.forEach((g)=>{
                        P.push({
                            id: g.id,
                            filterFn: D,
                            resolvedValue: D.resolveFilterValue?.(I) ?? I
                        });
                    });
                }
                for(let g = 0; g < M.flatRows.length; g++){
                    const flatRow = M.flatRows[g];
                    flatRow.columnFilters = {};
                    if (L.length) {
                        for(let g = 0; g < L.length; g++){
                            z = L[g];
                            const M = z.id;
                            flatRow.columnFilters[M] = z.filterFn(flatRow, M, z.resolvedValue, (g)=>{
                                flatRow.columnFiltersMeta[M] = g;
                            });
                        }
                    }
                    if (P.length) {
                        for(let g = 0; g < P.length; g++){
                            B = P[g];
                            const M = B.id;
                            if (B.filterFn(flatRow, M, B.resolvedValue, (g)=>{
                                flatRow.columnFiltersMeta[M] = g;
                            })) {
                                flatRow.columnFilters.__global__ = true;
                                break;
                            }
                        }
                        if (flatRow.columnFilters.__global__ !== true) {
                            flatRow.columnFilters.__global__ = false;
                        }
                    }
                }
                return filterRows(M.rows, (g)=>{
                    for(let M = 0; M < R.length; M++){
                        if (g.columnFilters[R[M]] === false) {
                            return false;
                        }
                    }
                    return true;
                }, g);
            }, getMemoOptions(g.options, "debugTable", 0, ()=>g._autoResetPageIndex())),
        state: {
            globalFilter: globalFilter_1
        }
    });
    yd.useEffect(()=>{
        const g = setTimeout(()=>{
            setGlobalFilter(globalFilter);
        }, 300);
        return ()=>clearTimeout(g);
    }, [
        globalFilter
    ]);
    yd.useEffect(()=>{
        if (BRef.current) {
            BRef.current.scrollTop = 0;
        }
    }, [
        globalFilter,
        priceChange,
        selectedCategory
    ]);
    if (loading || V.getRowModel().rows.length) {
        return <div ref={BRef} className="relative tw-scrollbar pr-1.5 pb-1.5"><table className="w-full table-fixed"><colgroup><col className="w-[42%]"/><col className="w-[29%]"/><col className="w-[29%]"/></colgroup><thead className="sticky top-0 z-[6] bg-tw3-background-primary">{V.getHeaderGroups().map((g)=><tr key={g.id}>{g.headers.map((g)=><th key={g.id} colSpan={g.colSpan} align={g.column.columnDef.meta?.align}><div className={`${g.column.getCanSort() ? "cursor-pointer select-none" : ""} flex items-center ${g.index > 0 ? "justify-end" : "justify-start"} py-3`} onClick={g.column.getToggleSortingHandler()}>{flexRender(g.column.columnDef.header, g.getContext())}{{
                    asc: <SorterIcon primaryColorClass="text-tw3-label-primary" secondaryColorClass="text-tw3-label-secondary"/>,
                    desc: <SorterIcon primaryColorClass="text-tw3-label-secondary" secondaryColorClass="text-tw3-label-primary"/>
                }[g.column.getIsSorted()] ?? (g.id !== "assetName" ? <SorterIcon primaryColorClass="text-tw3-label-secondary" secondaryColorClass="text-tw3-label-secondary"/> : null)}</div></th>)}</tr>)}</thead><tbody>{V.getRowModel().rows.map((g)=><tr key={g.id} className="group cursor-pointer" onClick={disabled ? xn : ()=>onTokenSelect(g.original)}>{g.getVisibleCells().map((g)=><td key={g.id} className={`py-2.5 ${g.column.getIndex() > 0 ? "pl-1" : ""} text-nowrap transition-colors group-hover:bg-tw3-action-hover first:rounded-l-xl first:pl-2 last:rounded-r-xl last:pr-2`} align={g.column.columnDef.meta?.align}>{flexRender(g.column.columnDef.cell, g.getContext())}</td>)}</tr>)}</tbody></table></div>;
    }
    return <div className="flex flex-col items-center space-y-2 my-10"><_l width={160} height={160}/><L_1 type={B_1.SUBTITLE}>Token not found</L_1></div>;
};
const LS = {
    [nS["1H"]]: "1H",
    [nS["24H"]]: "24H",
    [nS["7D"]]: "7D",
    [nS["1M"]]: "1M"
};
const PriceChangeSelect = ({ selectedPriceChange, onSelect })=>{
    const { formatMessage } = P_1();
    const I = [
        nS["1H"],
        nS["24H"],
        nS["7D"],
        nS["1M"]
    ];
    return <Rs as="div" className="relative">{({ open })=><><Ns className="outline-none rounded-full bg-tw3-background-secondary pl-1 pr-2 py-1"><div className="flex items-center gap-1"><div className="pl-2"><L_1 type={B_1.EMPHASIS} weight={V_1.MEDIUM}>{formatMessage({
            id: `trending-tokens.priceChange.${selectedPriceChange}`,
            defaultMessage: LS[selectedPriceChange]
        })}</L_1></div><div><$o width={18} height={18} colorClass={`text-tw3-label-secondary transition-transform ${open ? "rotate-180" : "rotate-0"}`}/></div></div></Ns><Ts enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1"><Ps className="absolute min-w-full w-max mt-1 left-0 z-10 shadow-lg rounded-4 bg-tw3-background-secondary cursor-default" onClick={(g)=>g.stopPropagation()}>{({ close })=><div className="px-4 py-4 tw-scrollbar max-h-[250px]"><div className="flex space-y-4 flex-col">{I.map((I)=><Gs1 key={I} onClick={()=>{
                    onSelect(I);
                    close();
                }}><div className="flex items-center gap-4"><div className="flex-grow"><L_1 weight={V_1.NORMAL} theme={z_1.LABEL_PRIMARY}>{formatMessage({
                    id: `trending-tokens.priceChange.${I}`,
                    defaultMessage: LS[I]
                })}</L_1></div><div>{selectedPriceChange === I && <Vo1 width={20} height={20} colorClass="text-tw3-brand-foreground-secondary"/>}</div></div></Gs1>)}</div></div>}</Ps></Ts></>}</Rs>;
};
const useNavigateToNewAsset = ()=>{
    const g = _();
    const M = t_17();
    const T = t_50();
    const [I, setI] = yd.useState(false);
    return {
        isNavigating: I,
        navigateToNewAsset: async (P, R)=>{
            if (!T.find((g)=>g.assetId === P.assetId)) {
                await (async (g)=>{
                    setI(true);
                    if (!I) {
                        if (M[g.blockchainId]) {
                            await t_55(vn.emit(t_39.TOGGLE_ASSET_VISIBILITY, g), 250);
                            setI(false);
                        } else {
                            s_1(new Error("Blockchain not found when clicking on a trending token"), {
                                network: g.blockchainId,
                                assetId: g.assetId
                            });
                        }
                    }
                })(P);
            }
            g(`${H_1.ASSET}/${P.assetId}`, {
                state: {
                    asset: P,
                    origin: R
                }
            });
        }
    };
};
const TrendingTokens = ()=>{
    t_12({
        event: D_1.TRENDING_TOKENS,
        props: null
    });
    const { formatMessage } = P_1();
    const { trackHotTokenSelectionAnalyticsEvent } = (()=>{
        const { trackAnalytics } = t_3();
        return {
            trackHotTokenSelectionAnalyticsEvent: (M, categoryName)=>{
                const I = {
                    assetId: M.asset_id,
                    assetName: M.name,
                    categoryName,
                    pageViewSource: D_1.TRENDING_TOKENS
                };
                trackAnalytics({
                    event: E_1.HOT_TOKEN_SELECTED,
                    props: I
                });
            }
        };
    })();
    const { domains } = yd.useContext(BCContext);
    const { selectedCategory, setSelectedCategory, selectedNetworks, setSelectedNetworks, searchText, setSearchText, selectedPriceChange, setSelectedPriceChange } = yd.useContext(OSContext);
    const { isError, categories, refetch } = useCategoriesFetching();
    const [, H] = (()=>{
        const { isPending, data } = t_4({
            queryKey: [
                "trending-networks"
            ],
            queryFn: ()=>vn.emit(t_39.FETCH_TRENDING_NETWORKS),
            staleTime: 3600000,
            refetchOnWindowFocus: false,
            retry: u_6,
            retryDelay: l_3
        });
        return [
            isPending,
            data ?? []
        ];
    })();
    const K = yd.useMemo(()=>H.map((g)=>K_1(g.chain)), [
        H
    ]);
    const Z = K.length ? K : domains;
    const q = H.length ? H.map((g)=>g.chain) : domains.map((g)=>Number(W_2(g)));
    const { sortField, sortDirection } = c_8(selectedCategory?.id);
    const { isLoading, isError: isError_1, data, refetch: refetch_1 } = n_31(selectedCategory?.id, selectedNetworks ? [
        W_2(selectedNetworks[0].prefixedCoinId, true)
    ] : q, undefined, sortField, sortDirection);
    const { navigateToHotToken, isNavigating } = (()=>{
        const { navigateToNewAsset, isNavigating } = useNavigateToNewAsset();
        const T = t_59();
        return {
            navigateToHotToken: async (M, I)=>{
                const L = i_2(M.asset);
                const P = T[M.asset.network];
                navigateToNewAsset({
                    ...L,
                    isShownInHomeScreen: true,
                    address: L.assetId.split("_")[1]?.slice(1),
                    blockchainId: P.id,
                    balance: "0"
                }, I);
            },
            isNavigating
        };
    })();
    const de = isError && categories.length > 0 || isError_1 && data.length > 0;
    yd.useEffect(()=>{
        recordFirstPaintEvent({
            view: "trending",
            phase: "ui-ready"
        });
    }, []);
    yd.useEffect(()=>{
        recordFirstPaintEvent({
            view: "trending",
            phase: isError && categories.length === 0 && !selectedCategory || isError_1 && data.length === 0 ? "data-error" : isLoading || !selectedCategory ? "data-loading" : "data-ready"
        });
    }, [
        categories.length,
        isError,
        data.length,
        isError_1,
        isLoading,
        selectedCategory
    ]);
    return <Vt1><Xt1 title={formatMessage({
        id: "trending-tokens.title",
        defaultMessage: "Trending"
    })}/><Et><div className="mb-2.5"><Uc placeholder={formatMessage({
        id: "dashboard.tokens.input-placeholder"
    })} value={searchText} onChange={(g)=>setSearchText(g.target.value)}/></div><div className="flex"><div className="flex relative w-full items-center justify-between"><BlockchainSelect selectedNetworks={selectedNetworks} onSelect={setSelectedNetworks} spacing={PC.SMALL} allowedPrefixedCoinIds={Z} compact/><div className="flex items-center space-x-2"><CategoriesSelect selectedCategory={selectedCategory} onSelect={setSelectedCategory}/><PriceChangeSelect selectedPriceChange={selectedPriceChange} onSelect={setSelectedPriceChange}/></div></div></div><Ut1>{de && <Jn testid="trending-tokens-stale" theme={a_5.WARNING}><div className="flex items-center justify-between gap-2"><span>{formatMessage({
        id: "trending-tokens.stale-content",
        defaultMessage: "Couldn’t refresh market data. Showing recent results."
    })}</span><W_1 fullWidth={false} noPadding size={ut_1.MINIMAL} theme={dt_1.INK} testid="trending-tokens-stale-retry" onClick={()=>{
        if (isError) {
            refetch();
        } else {
            refetch_1();
        }
    }}>{formatMessage({
        id: "generic.retry",
        defaultMessage: "Retry"
    })}</W_1></div></Jn>}{isError && categories.length === 0 && !selectedCategory || isError_1 && data.length === 0 ? <Ol testid="trending-tokens-error" title={formatMessage({
        id: "swap.error-load-title",
        defaultMessage: "Something went wrong"
    })} message={formatMessage({
        id: "swap.error-load-description",
        defaultMessage: "We couldn’t load tokens. Please check your connection and try again."
    })}><div className="mt-4"><W_1 fullWidth={false} size={ut_1.SMALL} theme={dt_1.SECONDARY} testid="trending-tokens-retry" onClick={()=>{
        if (isError && !selectedCategory) {
            refetch();
        } else {
            refetch_1();
        }
    }}>{formatMessage({
        id: "generic.retry",
        defaultMessage: "Retry"
    })}</W_1></div></Ol> : <Table globalFilter={searchText} loading={isLoading || !selectedCategory} data={data} priceChange={selectedPriceChange} selectedCategory={selectedCategory} disabled={isNavigating} onTokenSelect={async (g)=>{
        trackHotTokenSelectionAnalyticsEvent(g.asset, selectedCategory?.name ?? "");
        navigateToHotToken(g, H_1.TRENDING_TOKENS);
    }}/>}</Ut1></Et></Vt1>;
};
const Component = ()=><TokenFilteringProvider><SwapDomainsProvider><TrendingTokens/></SwapDomainsProvider></TokenFilteringProvider>;
n_1();
const importAsset = ()=>t_1(()=>import("./asset-COrXZQtQ.js"), __vite__mapDeps([

// ---- MarketSentiment (entry.js ~63150-63270) ----
    POST: "post",
    ARTICLE: "article"
};
function PostRow({ post, trackClick }) {
    return <Jc1 fullWidth><a href={post.url} target="_blank" rel="noopener nofollow noreferrer" onClick={()=>trackClick(post)}>{vd.truncate(post.header, {
        length: 210
    })}</a><div className="flex flex-col"><div className="flex justify-between gap-[5px]"><L_1 type={B_1.FOOTNOTE} theme={z_1.LABEL_SECONDARY}>{post.provider}</L_1><L_1 type={B_1.FOOTNOTE} theme={z_1.LABEL_SECONDARY} shrink="0">{function formatDate(g) {
        return `${new Date(g).toLocaleTimeString("default", {
            hour: "2-digit",
            minute: "2-digit"
        })} ${new Date(g).toLocaleDateString("default", {
            day: "2-digit",
            month: "2-digit"
        })}`;
    }(post.createdAt)}</L_1></div></div></Jc1>;
}
function PostsColumn({ posts, postType, trackClick }) {
    const { formatMessage } = P_1();
    return <div className="px-3"><__4>{posts?.length ? posts.map((post)=><PostRow key={post.url} post={post} trackClick={trackClick}/>) : <L_1>{formatMessage({
        id: `market-sentiment.no-data-${postType}`,
        defaultMessage: `No recent ${postType}s for this category`
    })}</L_1>}</__4></div>;
}
function SentimentPanel({ negative = [], neutral = [], positive = [], postType, trackClick }) {
    const { formatMessage } = P_1();
    if (negative?.length || neutral?.length || positive?.length) {
        return <div className="flex p-6"><div className="flex-col flex-1"><L_1 weight={V_1.BOLD}>{formatMessage({
            id: "market-sentiment.title",
            defaultMessage: "Negative"
        })}</L_1><PostsColumn posts={negative} postType={postType} trackClick={trackClick}/></div><div className="flex-col flex-1"><L_1 weight={V_1.BOLD}>{formatMessage({
            id: "market-sentiment.title",
            defaultMessage: "Neutral"
        })}</L_1><PostsColumn posts={neutral} postType={postType} trackClick={trackClick}/></div><div className="flex-col flex-1"><L_1 weight={V_1.BOLD}>{formatMessage({
            id: "market-sentiment.title",
            defaultMessage: "Positive"
        })}</L_1><PostsColumn posts={positive} postType={postType} trackClick={trackClick}/></div></div>;
    }
    return <div className="h-[330px]"><$n><div className="flex flex-col items-center gap-4"><Fa/><L_1>{formatMessage({
        id: `market-sentiment.no-data-${postType}`,
        defaultMessage: `No recent ${postType}s for this category`
    })}</L_1></div></$n></div>;
}
function MarketSentiment() {
    const { formatMessage } = P_1();
    const M = _();
    const { state, pathname } = g_1();
    const L = v()["*"]?.split("/")[1] ?? "BTC";
    const { data, isPending } = t_4({
        queryKey: [
            "marketSentiment",
            L
        ],
        queryFn: ()=>vn.emit(t_39.FETCH_MARKET_SENTIMENT, L),
        refetchOnWindowFocus: false,
        initialData: state?.sentiment,
        enabled: !state?.sentiment
    });
    const trackClick = function useMarketSentimentAnalytics({ pathname, assetSymbol, pageViewSource }) {
        const { trackAnalytics } = t_3();
        const L = pathname.includes(H_1.SOCIAL_POSTS) ? D_1.MARKET_SENTIMENT_POSTS : D_1.MARKET_SENTIMENT_ARTICLES;
        yd.useEffect(()=>{
            trackAnalytics({
                event: L,
                props: {
                    assetSymbol,
                    pageViewSource: pageViewSource ?? L
                }
            });
        }, [
            pathname
        ]);
        return function trackClick(M) {
            trackAnalytics({
                event: pathname.includes(H_1.SOCIAL_POSTS) ? E_1.CLICK_MARKET_SENTIMENT_POST : E_1.CLICK_MARKET_SENTIMENT_ARTICLE,
                props: {
                    assetSymbol: M.assetSymbol,
                    pageViewSource: L
                }
            });
        };
    }({
        pathname,
        assetSymbol: L,
        pageViewSource: state?.pageViewSource
    });
    return <Vt1 loose altTheme><Ut1><Et loose><div className="flex my-11 justify-center"><Gs1 onClick={()=>M(H_1.DEFAULT)}><Ma1/></Gs1></div><div className="w-[600px] mx-auto my-4"><Jn theme={a_5.INFO_ALT}><L_1>{formatMessage({
        id: "market-sentiment.description.header",
        defaultMessage: "Market Sentiment"
    })}</L_1><L_1 type={B_1.FOOTNOTE}>{formatMessage({
        id: "market-sentiment.description.body",
        defaultMessage: "Trust Wallet now shows market sentiment - a score that reflects how positive or negative the latest news and social discussions are about your assets. For example, if there are an equal number of positive and negative mentions, the sentiment score would be 50%."
    })}</L_1></Jn></div>{isPending ? <div className="mx-auto"><De1/></div> : <div className="flex flex-1 flex-col flex-grow-0 self-center bg-tw3-background-primary border border-tw3-line-divider rounded p-0 container"><div className="flex h-15 border-b border-tw3-line-divider space-x-8 px-6"><Kc isSelected={pathname.includes(H_1.NEWS_ARTICLES)} onClick={()=>M(`${H_1.NEWS_ARTICLES}/${L}`, {
            state: {
                pageViewSource: D_1.MARKET_SENTIMENT_POSTS
            }
        })} testid="news-articles-tab-button">{formatMessage({
        id: "market-sentiment.articles",
        defaultMessage: "News Articles"
    })}</Kc><Kc isSelected={pathname.includes(H_1.SOCIAL_POSTS)} onClick={()=>M(`${H_1.SOCIAL_POSTS}/${L}`, {
            state: {
                pageViewSource: D_1.MARKET_SENTIMENT_ARTICLES
            }
        })} testid="social-posts-tab-button">{formatMessage({
        id: "market-sentiment.posts",
        defaultMessage: "Social Posts"
    })}</Kc></div><Yt1><Ct path="/articles/:symbol?" element=<SentimentPanel negative={data?.negative.articles} neutral={data?.neutral.articles} positive={data?.positive.articles} postType={AC.ARTICLE} trackClick={trackClick}/>/><Ct path="/posts/:symbol?" element=<SentimentPanel negative={data?.negative.posts} neutral={data?.neutral.posts} positive={data?.positive.posts} postType={AC.POST} trackClick={trackClick}/>/></Yt1></div>}</Et></Ut1></Vt1>;
}
const wC = {
    success: "success",
    error: "failed",
    loading: "progress",
    info: "plain"
};
function Toasts() {
    useSwapCapsuleWatcher();
    yd.useEffect(()=>{
        traceSwap("toaster-mounted");
        return ()=>traceSwap("toaster-unmounted");
    }, []);
    const g = i_6((g)=>g.app.toasts);
    const { formatMessage } = P_1();

// ---- Categories (entry.js ~78380,78470) ----
const useCategoriesFetching = ()=>{
    const { isPending, isError, data, refetch } = t_4({
        queryKey: iS,
        queryFn: ()=>vn.emit(t_39.FETCH_HOT_TOKEN_CATEGORIES),
        staleTime: 3600000,
        refetchOnWindowFocus: false,
        retry: u_6,
        retryDelay: l_3
    });
    return {
        isPending,
        isError,
        categories: data ?? [],
        refetch
    };
};
const sS = {
    selectedCategory: null,
    selectedNetworks: null,
    searchText: "",
    currentPage: 1,
    selectedPriceChange: nS["24H"]
};
const OSContext = yd.createContext({
    searchText: "",
    setSearchText: xn,
    selectedCategory: null,
    setSelectedCategory: (g)=>{},
    selectedNetworks: null,
    setSelectedNetworks: (g)=>{},
    selectedPriceChange: nS["24H"],
    setSelectedPriceChange: (g)=>{},
    currentPage: 1,
    setCurrentPage: xn
});
const TokenFilteringProvider = ({ children })=>{
    const [M, setM] = yd.useState(()=>sS.selectedCategory ?? (t_6.getQueryData(iS) ?? [])[0] ?? null);
    const [I, setI] = yd.useState(sS.selectedNetworks);
    const [P, setP] = yd.useState(sS.searchText);
    const [D, setD] = yd.useState(sS.currentPage);
    const [z, setZ] = yd.useState(sS.selectedPriceChange);
    yd.useEffect(()=>{
        sS.selectedCategory = M;
        sS.selectedNetworks = I;
        sS.searchText = P;
        sS.currentPage = D;
        sS.selectedPriceChange = z;
    }, [
        M,
        I,
        P,
        D,
        z
    ]);
    return <OSContext.Provider value={{
        searchText: P,
        setSearchText: setP,
        selectedCategory: M,
        setSelectedCategory: setM,
        selectedNetworks: I,
        setSelectedNetworks: setI,
        selectedPriceChange: z,
        setSelectedPriceChange: setZ,
        currentPage: D,
        setCurrentPage: setD
    }}>{children}</OSContext.Provider>;
};
const CategoriesSelect = ({ selectedCategory, onSelect })=>{
    const { formatMessage } = P_1();
    const { isPending, categories } = useCategoriesFetching();
    yd.useEffect(()=>{
        if (categories.length > 0 && !selectedCategory) {
            onSelect(categories[0]);
        }
    }, [
        categories,
        selectedCategory
    ]);
    const P = isPending && !selectedCategory;
    const R = selectedCategory?.name ?? formatMessage({
        id: "trending-tokens.category.default",
        defaultMessage: "Hot tokens"
    });
    return <Rs as="div" className="relative">{({ open })=><><Ns className="outline-none rounded-full bg-tw3-background-secondary pl-1 pr-2 py-1"><div className="flex items-center gap-1"><div className="pl-2">{P ? <Yo1 isLoading widthClass="w-14" heightClass="h-3.5"/> : <L_1 type={B_1.EMPHASIS} weight={V_1.MEDIUM}>{R}</L_1>}</div><div><$o width={18} height={18} colorClass={`text-tw3-label-secondary transition-transform ${open ? "rotate-180" : "rotate-0"}`}/></div></div></Ns><Ts enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1"><Ps className="absolute min-w-full w-max mt-1 left-0 z-10 shadow-lg rounded-4 bg-tw3-background-secondary cursor-default" onClick={(g)=>g.stopPropagation()}>{({ close })=><div className="px-4 py-4 tw-scrollbar max-h-[250px]"><div className="flex space-y-4 flex-col">{categories.map((I)=><Gs1 key={I.id} onClick={()=>{
                    onSelect(I);
                    close();
                }}><div className="flex items-center gap-4"><div className="flex-grow"><L_1 weight={V_1.NORMAL} theme={(I.id, z_1.LABEL_PRIMARY)}>{I.name}</L_1></div><div>{selectedCategory?.id === I.id && <Vo1 width={20} height={20} colorClass="text-tw3-brand-foreground-secondary"/>}</div></div></Gs1>)}</div></div>}</Ps></Ts></>}</Rs>;
};
function isFunction(g) {
    return g instanceof Function;
}
