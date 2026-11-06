import { it } from "./useAnalytics-COpZR7i2.js";
import { t } from "./jsx-runtime-C2w7GV0M.js";
import { B, W, cn, et, ln, mn, nt, rn, tt, z } from "./store-cAVdfWrK.js";
import { s, u } from "./utils-BEeAK54T.js";
import { n as n_1, r } from "./useFiat-DH2a13VO.js";
import { d, f, u as u_2 } from "./useAsset-DL8yf1Bm.js";
import { n as n_2 } from "./math.utils-BUDjteRJ.js";
import { z as z_1 } from "./esm-BkKt8UqE.js";
import { t as t_1 } from "./txType-CH4ucKXs.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "b3d5d62c-26a0-4e27-8bec-12d12cfbdffa";
            e._sentryDebugIdIdentifier = "sentry-dbid-b3d5d62c-26a0-4e27-8bec-12d12cfbdffa";
        }
    } catch (e) {}
})();
const getFeeAssetSymbol = (e, t)=>{
    if (t && e.id === mn.terra && t.type !== "CW20") {
        return t.symbol;
    }
    if (et[e.id]) {
        return tt.find((t)=>t.blockchainId === e.id).symbol;
    }
    return e.symbol;
};
const getFeeAssetDecimals = (e, t)=>{
    if (t && e.id === mn.terra && t.type !== "CW20") {
        return t.decimals;
    }
    if (et[e.id]) {
        return tt.find((t)=>t.blockchainId === e.id).decimals;
    }
    return e.decimals;
};
const getFeeAssetIconUrl = (e, t)=>{
    if (t && e.id === mn.terra && t.type !== "CW20") {
        return t.iconUrl;
    }
    if (et[e.id]) {
        return tt.find((t)=>t.blockchainId === e.id).iconUrl;
    }
    return e.iconUrl;
};
const isSupportTag = (e)=>{
    switch(e.blockchainId){
        case mn.ripple:
        case mn.internetComputer:
            return true;
        default:
            return false;
    }
};
const h = it();
const I = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "owner",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "approved",
                type: "address"
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "Approval",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "owner",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "operator",
                type: "address"
            },
            {
                indexed: false,
                internalType: "bool",
                name: "approved",
                type: "bool"
            }
        ],
        name: "ApprovalForAll",
        type: "event"
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "from",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "to",
                type: "address"
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "Transfer",
        type: "event"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address"
            },
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "approve",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        constant: true,
        inputs: [],
        name: "totalSupply",
        outputs: [
            {
                name: "",
                type: "uint256"
            }
        ],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address"
            }
        ],
        name: "balanceOf",
        outputs: [
            {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "getApproved",
        outputs: [
            {
                internalType: "address",
                name: "operator",
                type: "address"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address"
            },
            {
                internalType: "address",
                name: "operator",
                type: "address"
            }
        ],
        name: "isApprovedForAll",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "name",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "ownerOf",
        outputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "from",
                type: "address"
            },
            {
                internalType: "address",
                name: "to",
                type: "address"
            },
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "from",
                type: "address"
            },
            {
                internalType: "address",
                name: "to",
                type: "address"
            },
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes"
            }
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "operator",
                type: "address"
            },
            {
                internalType: "bool",
                name: "_approved",
                type: "bool"
            }
        ],
        name: "setApprovalForAll",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "interfaceId",
                type: "bytes4"
            }
        ],
        name: "supportsInterface",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [],
        name: "symbol",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "tokenURI",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string"
            }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "from",
                type: "address"
            },
            {
                internalType: "address",
                name: "to",
                type: "address"
            },
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256"
            }
        ],
        name: "transferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
];
const checkContract = (e)=>!!e && e !== "0x";
const checkEip1559Tx = (e)=>{
    const { isEIP1559 } = e.network;
    return !!isEIP1559 && (h.isUndefined(e.type) ? isEIP1559 : +e.type === 2);
};
const checkNativeToken = ({ assetSymbol, networkSymbol, isAssetNFT })=>{
    if (isAssetNFT) {
        return false;
    }
    if (assetSymbol) {
        const n = tt.some((t)=>t.symbol === assetSymbol);
        const a = nt.includes(networkSymbol);
        return assetSymbol === networkSymbol && !a || n;
    }
    return !nt.includes(networkSymbol);
};
const parseAnyTransaction = ({ data, value })=>{
    try {
        const n = new n_1(f).parseTransaction({
            data,
            value
        });
        return {
            ...n,
            name: `${n.name.charAt(0).toUpperCase()}${n.name.slice(1)}`
        };
    } catch  {
        return null;
    }
};
const parseApproveTransaction = ({ data, network })=>{
    if (network.id === "tron") {
        return {
            spender: `0x${data.slice(10, 74)}`,
            allowance: z_1(`0x${data.slice(74, 138)}`)
        };
    }
    {
        const t = new n_1(f).parseTransaction({
            data
        });
        const n = t.args[1]._hex;
        const allowance = z_1(n);
        return {
            spender: t.args[0],
            allowance
        };
    }
};
const decodeErc20TokenTransfer = (e)=>{
    if (!e || e.length < 10) {
        return null;
    }
    const t = e.slice(0, 10).toLowerCase();
    if (t !== "0xa9059cbb" && t !== "0x23b872dd") {
        return null;
    }
    try {
        const n = new n_1(f).parseTransaction({
            data: e,
            value: "0"
        });
        if (t === "0xa9059cbb") {
            return {
                recipient: n.args[0],
                amount: n.args[1].toString()
            };
        }
        return {
            sender: n.args[0],
            recipient: n.args[1],
            amount: n.args[2].toString()
        };
    } catch  {
        return null;
    }
};
const decodeSetApprovalForAll = (e)=>{
    if (!e || e.length < 10) {
        return null;
    }
    if (e.slice(0, 10).toLowerCase() !== "0xa22cb465") {
        return null;
    }
    try {
        const t = new n_1(I).parseTransaction({
            data: e,
            value: "0"
        });
        return {
            operator: t.args[0],
            approved: Boolean(t.args[1])
        };
    } catch  {
        return null;
    }
};
function isCrossChainSwapEvent(e) {
    if (e?.type !== B.Swap) {
        return false;
    }
    const e_metadata = e.metadata;
    return !(!e_metadata?.sent?.assetId || !e_metadata?.received?.assetId) && W(e_metadata.sent.assetId) !== W(e_metadata.received.assetId);
}
function getSwapLegs(e) {
    const t = e.events?.[0];
    if (t?.type !== B.Swap) {
        return null;
    }
    const t_metadata = t.metadata;
    if (t_metadata.internal) {
        return null;
    }
    const { sent, received } = t_metadata;
    if (isSwapLegValue(sent) && isSwapLegValue(received)) {
        return {
            sent: {
                assetId: sent.assetId,
                value: sent.value
            },
            received: {
                assetId: received.assetId,
                value: received.value,
                ...received.symbol ? {
                    symbol: received.symbol
                } : {},
                ...received.name ? {
                    name: received.name
                } : {},
                ...received.iconUrl ? {
                    iconUrl: received.iconUrl
                } : {}
            }
        };
    }
    return null;
}
function isSwapLegValue(e) {
    return !!e?.assetId && typeof e.value === "string" && e.value !== "" && Number.isFinite(Number(e.value));
}
function isRegularSwapTransaction(e) {
    return getSwapLegs(e) !== null;
}
function getSwapBridge(e) {
    const t = e?.events?.[0];
    if (t?.type !== B.Swap) {
        return null;
    }
    const bridge = t.metadata.bridge;
    if (bridge?.stepId && bridge.dstBlockchainId) {
        return bridge;
    }
    return null;
}
function isBridgeAwaitingDestination(e) {
    const t = getSwapBridge(e);
    return !!t && e?.status === "pending" && t.srcStatus === "confirmed" && (t.status === "pending" || t.status === "expired");
}
function normalizeAssetIdForCompare(e) {
    if (typeof e === "string") {
        return e.toLowerCase();
    }
    return "";
}
function describeUnknownValue(e) {
    if (e == null) {
        return String(e);
    }
    if (typeof e !== "object") {
        return typeof e;
    }
    if (Array.isArray(e)) {
        return `Array(${e.length})`;
    }
    const t = e.constructor?.name ?? "Object";
    const n = Object.keys(e).slice(0, 10).join("|");
    if (n) {
        return `${t}{${n}}`;
    }
    return t;
}
function shouldHideAirdropTransaction(e, t) {
    const n = normalizeAssetIdForCompare(e.assetId);
    return (!n || !t.has(n)) && e.events.length > 0 && e.events.every((e)=>e.metadata?.airdrop === true);
}
function shouldHideUnknownAssetReceive(e, t) {
    const a = normalizeAssetIdForCompare(e.assetId);
    return (!a || !t.has(a)) && e.events.length > 0 && e.events.every((e)=>e.type === B.Receive);
}
function isUtxoTransaction(e) {
    return e[0].type === B.Utxo;
}
function isContractTransaction(e) {
    return e[0].type === B.Contract;
}
function isApproveTransaction(e) {
    return e[0].type === B.Approve;
}
function isBurnTransaction(e) {
    return e[0].type === B.Burn;
}
function isSwapTransaction(e) {
    return e[0].type === B.Swap && !!e[0].metadata?.internal;
}
function getValueFromTransaction(e, t) {
    let a = "0";
    if (e.events[0].type === B.Contract) {
        a = e.events[0].metadata.value;
    } else if (e.events[0].type === "swap") {
        const t = e.events[0].metadata;
        if (t.internal) {
            a = t.value || "0";
        } else if (t.sent) {
            a = t.sent.value;
        } else if (t.received) {
            a = t.received.value;
        }
    } else {
        if (e.events[0].type === "approve") {
            a = e.events[0].metadata.value;
        }
    }
    if (isUtxoTransaction(e.events)) {
        const t = e.events[0].metadata.direction === z.Outgoing;
        const n = e.events[0].metadata.direction === z.Incoming;
        e.events.forEach((e)=>{
            if (n && e.metadata.direction === z.Incoming) {
                a = new cn(a).add(e.metadata.value).toString();
            }
            if (t && e.metadata.direction === z.Outgoing) {
                a = new cn(a).sub(e.metadata.value).toString();
            }
        });
    } else {
        if (e.events[0].type === B.Contract && a && ln(a) || e.events[0].type === B.Send && e.events[0].metadata.value && ln(e.events[0].metadata.value)) {
            a = rn(n_2(e.events[0].metadata.value), t?.decimals).toString();
        } else if (e.events[0].metadata.value) {
            a = e.events[0].metadata.value;
        }
    }
    return a;
}
function getAmountFromDappTx(e, t) {
    if (ln(e.value)) {
        return rn(BigInt(e.value ?? e.internal?.value ?? "0x0").toString(), t);
    }
    return new cn(e.value ?? e.internal?.value ?? "0");
}
function isUtxoBlockchain(e) {
    return [
        mn.bitcoin,
        mn.litecoin,
        mn.doge
    ].includes(e);
}
function isValidator(e, t) {
    return isStakingTransactionType(t) && Array.isArray(e);
}
function isStakingTransactionType(e) {
    return e === t_1.Delegate || e === t_1.ClaimRewards || e === t_1.Undelegate || e === t_1.Redelegate || e === t_1.CrossChainRedelegate || e === t_1.Compound || e === t_1.Claim;
}
function isNonDelegateStakingTx(e) {
    return e !== t_1.Delegate && isStakingTransactionType(e);
}
function getStakingType(e) {
    return s[e] ?? u.NATIVE;
}
const S = t();
const ExternalLinkIcon = ({ width = 24, height = 24, colorClass })=><svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={colorClass}><path d="M11.6999 12.3C11.9199 12.52 12.2099 12.63 12.4999 12.63C12.7899 12.63 13.0799 12.52 13.2999 12.3L19.3799 6.22V9.5C19.3799 10.12 19.8799 10.62 20.4999 10.62C21.1199 10.62 21.6199 10.12 21.6199 9.5V3.5C21.6199 3.35 21.5899 3.21 21.5299 3.07C21.4799 2.94 21.3999 2.83 21.3099 2.74C21.3099 2.74 21.2999 2.72 21.2899 2.71C21.2799 2.7 21.2599 2.69 21.2399 2.68C21.1499 2.6 21.0399 2.52 20.9199 2.47C20.7799 2.41 20.6299 2.38 20.4899 2.38H14.4899C13.8699 2.38 13.3699 2.88 13.3699 3.5C13.3699 4.12 13.8699 4.62 14.4899 4.62H17.7699L11.6899 10.7C11.2499 11.14 11.2499 11.85 11.6899 12.29L11.6999 12.3Z" fill="currentColor"/><path d="M6.99988 21.63H15.9999C18.5499 21.63 20.6199 19.55 20.6199 17.01V13.51C20.6199 12.89 20.1199 12.39 19.4999 12.39C18.8799 12.39 18.3799 12.89 18.3799 13.51V17.01C18.3799 18.32 17.3099 19.39 15.9999 19.39H6.99988C5.68988 19.39 4.61988 18.32 4.61988 17.01V8.01C4.61988 6.70001 5.68988 5.63 6.99988 5.63H10.4999C11.1199 5.63 11.6199 5.13 11.6199 4.51C11.6199 3.89 11.1199 3.39 10.4999 3.39H6.99988C4.44988 3.39 2.37988 5.47001 2.37988 8.01V17.01C2.37988 19.56 4.44988 21.63 6.99988 21.63Z" fill="currentColor"/></svg>;
function sendLikeTransactionType(e) {
    return e === B.Trade || e === B.Send || e === B.Inscribe || e === B.Delegate || e === B.Undelegate || e === B.ClaimRewards || e === B.Claim || e === B.Compound || e === B.Redelegate || e === B.CrossChainRedelegate;
}
export { shouldHideUnknownAssetReceive as A, isSwapTransaction as C, parseAnyTransaction as D, normalizeAssetIdForCompare as E, getFeeAssetIconUrl as M, getFeeAssetSymbol as N, parseApproveTransaction as O, isSupportTag as P, isRegularSwapTransaction as S, isUtxoTransaction as T, isApproveTransaction as _, isStakingTransactionType as a, isContractTransaction as b, checkEip1559Tx as c, decodeSetApprovalForAll as d, describeUnknownValue as f, getValueFromTransaction as g, getSwapLegs as h, isNonDelegateStakingTx as i, getFeeAssetDecimals as j, shouldHideAirdropTransaction as k, checkNativeToken as l, getSwapBridge as m, ExternalLinkIcon as n, isValidator as o, getAmountFromDappTx as p, getStakingType as r, checkContract as s, sendLikeTransactionType as t, decodeErc20TokenTransfer as u, isBridgeAwaitingDestination as v, isUtxoBlockchain as w, isCrossChainSwapEvent as x, isBurnTransaction as y };
