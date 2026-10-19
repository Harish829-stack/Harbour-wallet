import { f, i } from "./preload-helper-C61CWiqK.js";
import { B as B_1, D, E as E_1, F, L as L_1, P, V, ct, t, z } from "./useAnalytics-COpZR7i2.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { Cn, L as L_2, i as i_2, vn, w } from "./store-cAVdfWrK.js";
import { t as t_3 } from "./useAccounts-CoMylq9s.js";
import { t as J } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_4 } from "./blockchain-DRDWqNiT.js";
import { t as t_5 } from "./useAllBlockchains-BCf0ZYTP.js";
import { t as G } from "./ClickableArea-BE_vFWHj.js";
import { n, t as N } from "./Modal-BV3SfE1S.js";
import { n as C, t as L } from "./RadioUncheckedIcon-Dsz_4zlU.js";
import { t as A } from "./CaretDownIcon-qWhOaTgi.js";
import { n as n_2, t as t_6 } from "./window-COx4dq7s.js";
import { t as E } from "./EmptySearchContent-BPhzgYFK.js";
import { t as M } from "./NetworkIcon-CNKOmZnW.js";
import { t as B } from "./SearchInput-BIldQfbO.js";
import { r, t as t_7 } from "./popularChains-kJ9npbND.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "334781a1-9dbd-4e40-ab3f-7ede4485a7b9";
            e._sentryDebugIdIdentifier = "sentry-dbid-334781a1-9dbd-4e40-ab3f-7ede4485a7b9";
        }
    } catch (e) {}
})();
const useFilterByBlockchain = ()=>i_2((e)=>e.blockchains.filterByBlockchain);
const T = f(i(), 1);
const useIsCompactView = ()=>{
    const e = n();
    return n_2() || t_6() || e;
};
const _ = t_2();
const getNetworkName = (e)=>e.displayName ?? e.name;
const NetworkSelectionContent = ({ blockchainList, selectedBlockchainId, onSelectNetwork, hideAllNetworksOption, hideRadioButtons = false, testIdPrefix = "network-modal" })=>{
    const { formatMessage } = P();
    const [f, setF] = T.useState("");
    const w = f.toLowerCase();
    const { popular, others } = T.useMemo(()=>r(blockchainList.filter((e)=>!f || ((e, t)=>{
                const s = getNetworkName(e).toLowerCase();
                const l = e.symbol.toLowerCase();
                return s.includes(t) || l.includes(t);
            })(e, w)), (e)=>e.coinId, getNetworkName), [
        blockchainList,
        f,
        w
    ]);
    const b = !f && !hideAllNetworksOption;
    const k = f && popular.length === 0 && others.length === 0;
    const isSelected = (e)=>{
        if (e) {
            return selectedBlockchainId === e.id;
        }
        return !selectedBlockchainId;
    };
    return <><B placeholder={formatMessage({
        id: "select-network.search-placeholder",
        defaultMessage: "Search for network"
    })} value={f} onChange={(e)=>setF(e.target.value)} autoFocus={false} testid={`${testIdPrefix}-search`}/><div className="tw-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">{k ? <div className="flex-1 flex items-center justify-center"><E/></div> : <div className="space-y-4">{b && <G onClick={()=>onSelectNetwork(null)} testid={`${testIdPrefix}-all`}><div className="flex items-center justify-between py-3"><div className="flex items-center space-x-2"><div className="w-10 h-10 rounded-full bg-tw3-button-secondary-default flex items-center justify-center"><M width={20} height={20} colorClass="text-tw3-brand-foreground-secondary"/></div><L_1 type={B_1.SUBTITLE} theme={z.LABEL_PRIMARY}>{formatMessage({
        id: "select-crypto.all-networks",
        defaultMessage: "All networks"
    })}</L_1></div>{!hideRadioButtons && (isSelected(null) ? <C width={24} height={24} colorClass="text-tw3-brand-foreground-secondary"/> : <L width={24} height={24} colorClass="text-tw3-label-secondary"/>)}</div></G>}{popular.length > 0 && <div className="mt-4"><div className="mb-2"><L_1 type={B_1.BODY} theme={z.LABEL_SECONDARY} weight={V.SEMIBOLD} testid="popular-networks-title">{formatMessage({
        id: "select-network.popular-networks",
        defaultMessage: "Popular networks"
    })}</L_1></div>{popular.map((e)=><G key={e.coinId} onClick={()=>onSelectNetwork(e)} testid={`${testIdPrefix}-${e.symbol.toLowerCase()}`}><div className="flex items-center justify-between py-2"><div className="flex items-center space-x-3"><J name={getNetworkName(e)} src={e.iconUrl} size={ct.LARGE}/><L_1 type={B_1.SUBTITLE} theme={z.LABEL_PRIMARY}>{getNetworkName(e)}</L_1></div>{!hideRadioButtons && (isSelected(e) ? <C width={24} height={24} colorClass="text-tw3-brand-foreground-secondary"/> : <L width={24} height={24} colorClass="text-tw3-label-secondary"/>)}</div></G>)}</div>}{others.length > 0 && <div className="mt-4"><div className="mb-2"><L_1 type={B_1.BODY} theme={z.LABEL_SECONDARY} weight={V.SEMIBOLD} testid="az-networks-title">{formatMessage({
        id: "select-network.az-networks",
        defaultMessage: "A-Z networks"
    })}</L_1></div>{others.map((e)=><G key={e.coinId} onClick={()=>onSelectNetwork(e)} testid={`${testIdPrefix}-${e.symbol.toLowerCase()}`}><div className="flex items-center justify-between py-2"><div className="flex items-center space-x-3"><J name={getNetworkName(e)} src={e.iconUrl} size={ct.LARGE}/><L_1 type={B_1.SUBTITLE} theme={z.LABEL_PRIMARY}>{getNetworkName(e)}</L_1></div>{!hideRadioButtons && (isSelected(e) ? <C width={24} height={24} colorClass="text-tw3-brand-foreground-secondary"/> : <L width={24} height={24} colorClass="text-tw3-label-secondary"/>)}</div></G>)}</div>}</div>}</div></>;
};
const NetworkSelectionModal = ({ isOpen, onClose, blockchainList, selectedBlockchainId, onSelectNetwork, hideAllNetworksOption })=>{
    const { formatMessage } = P();
    const fullScreen = useIsCompactView();
    return <N opened={isOpen} onClose={onClose} title={formatMessage({
        id: "select-network.title",
        defaultMessage: "Select network"
    })} fullScreen={fullScreen}><div className={`flex flex-col space-y-3 ${fullScreen ? "h-full" : "h-[65vh]"}`}><NetworkSelectionContent blockchainList={blockchainList} selectedBlockchainId={selectedBlockchainId} onSelectNetwork={async (e)=>{
        onSelectNetwork(e);
        onClose();
    }} hideAllNetworksOption={hideAllNetworksOption} testIdPrefix="network-modal"/></div></N>;
};
const t_7_1 = t_7;
const HorizontalNetworksFilter = ({ useGlobalState, localFilteringBlockchainId, onFilterChange, hideAllOption = false, blockchainList })=>{
    const { formatMessage } = P();
    const { trackAnalytics } = t();
    const N = F();
    const C = t_3();
    const L = t_5(true);
    const v = useFilterByBlockchain();
    const [isOpen, setIsOpen] = T.useState(false);
    const M = useGlobalState ? v : localFilteringBlockchainId;
    const blockchainList_1 = T.useMemo(()=>{
        if (blockchainList) {
            return blockchainList;
        }
        if (N.type === L_2.MNEMONIC) {
            return L;
        }
        const e = Object.keys(C).map((e)=>e);
        return L.filter((t)=>e.includes(t.coinId.toString()));
    }, [
        L,
        C,
        N,
        blockchainList
    ]);
    const O = T.useMemo(()=>blockchainList_1?.find((e)=>e.id === M), [
        blockchainList_1,
        M
    ]);
    T.useEffect(()=>{
        if (useGlobalState && M && !O) {
            vn.emit(t_4.SWITCH_FILTERING_BLOCKCHAIN, null);
        }
    }, [
        useGlobalState,
        M,
        O
    ]);
    const R = T.useMemo(()=>{
        const e = blockchainList ? blockchainList_1.slice(0, 5) : t_7_1.map((e)=>blockchainList_1.find((t)=>t.coinId === e)).filter((e)=>e !== undefined);
        if (!O || e.some((e)=>e.id === O.id)) {
            return e;
        }
        return [
            ...e.slice(0, 4),
            O
        ];
    }, [
        blockchainList_1,
        blockchainList,
        O
    ]);
    const B_length = blockchainList_1.length;
    const setSelectedNetwork = async (t)=>{
        if (!useGlobalState) {
            const e = t?.id ?? null;
            return void onFilterChange?.(e);
        }
        if (!t) {
            return void await Promise.allSettled([
                vn.emit(t_4.SWITCH_FILTERING_BLOCKCHAIN, null),
                Cn(250)
            ]);
        }
        const blockchainType = t.isCustom ? w.CUSTOM : w.MAIN;
        await Promise.allSettled([
            vn.emit(t_4.SWITCH_FILTERING_BLOCKCHAIN, t.id),
            Cn(250)
        ]);
        trackAnalytics({
            event: E_1.SWITCH_FILTERING_NETWORK,
            props: {
                pageViewSource: D.HOME,
                blockchainName: t.name,
                blockchainChainId: t.chainId,
                blockchainType
            }
        });
    };
    const isSelected = (e)=>{
        if (e) {
            return M === e.id;
        }
        return !M;
    };
    return <div className="flex items-center justify-between overflow-x-auto scrollbar-hide pb-2">{!hideAllOption && <button onClick={()=>setSelectedNetwork(null)} className={`flex-shrink-0 w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${isSelected(null) ? "border-tw3-brand-primary bg-tw3-background-secondary" : "border-transparent bg-tw3-background-secondary"}`} data-testid="horizontal-network-filter-all" title={formatMessage({
        id: "component.blockchain-select.all-networks",
        defaultMessage: "All Networks"
    })}><span className={isSelected(null) ? "!text-tw3-brand-foreground-secondary" : ""}><L_1 type={B_1.EMPHASIS} theme={isSelected(null) ? z.BRAND : undefined}>{formatMessage({
        id: "component.blockchain-select.all",
        defaultMessage: "All"
    })}</L_1></span></button>}{R.map((e)=><button key={e.id} onClick={()=>setSelectedNetwork(e)} className={`flex-shrink-0 w-10 h-10 rounded-full border-2 transition-all ${isSelected(e) ? "border-tw3-brand-primary bg-tw3-background-secondary" : "border-transparent bg-tw3-background-secondary"}`} data-testid={`horizontal-network-filter-${e.id}`} title={e.displayName ?? e.name}><div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"><J name={e.name} size={ct.MEDIUM} src={e.iconUrl}/></div></button>)}<button onClick={()=>setIsOpen(true)} className="flex-shrink-0 px-3 py-2 rounded-full border-2 border-tw3-line-divider bg-tw3-background-secondary flex items-center gap-1.5" data-testid="horizontal-network-filter-more" title={`${B_length} networks available`}><L_1 type={B_1.EMPHASIS}>{B_length}</L_1><A width={12} height={12} colorClass="text-tw3-label-secondary"/></button><NetworkSelectionModal isOpen={isOpen} onClose={()=>setIsOpen(false)} blockchainList={blockchainList_1} selectedBlockchainId={M ?? null} onSelectNetwork={setSelectedNetwork} hideAllNetworksOption={hideAllOption}/></div>;
};
export { useFilterByBlockchain as i, NetworkSelectionModal as n, useIsCompactView as r, HorizontalNetworksFilter as t };
