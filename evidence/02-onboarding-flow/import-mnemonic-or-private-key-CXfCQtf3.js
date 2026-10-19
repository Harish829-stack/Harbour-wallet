import { f, i } from "./preload-helper-C61CWiqK.js";
import { A, B as B_1, D as D_1, E, L as L_1, P, V as V_1, W as W_1, ct, dt, ft, t, z } from "./useAnalytics-COpZR7i2.js";
import { n } from "./constants-CV-R2xp4.js";
import { t as t_2 } from "./jsx-runtime-C2w7GV0M.js";
import { K as K_1, L as L_2, mn, un, vn, xn as onClick } from "./store-cAVdfWrK.js";
import { i as i_2, t as Y1 } from "./QrCodeIcon-DyHe5kLn.js";
import { t as t_3 } from "./useAnalyticsCaptureOnMount-BJcdtAcr.js";
import { a, i as I, t as M } from "./Alert-Hvaga4Yx.js";
import { t as S } from "./AssetImage-BQ2Pnx9g.js";
import { t as t_4 } from "./blockchain-DRDWqNiT.js";
import { t as t_5 } from "./useBlockchains-CyglC5V0.js";
import { t as t_6 } from "./formatTruncatedString-CZ8GNKMv.js";
import { t as L } from "./ClickableArea-BE_vFWHj.js";
import { n as K1, t as _ } from "./InputText--Q-rwLzs.js";
import { t as R } from "./transition-B174DQ7a.js";
import { n as D, r as B, t as W } from "./popover-C4NHkoPs.js";
import { i as V, r as K, t as U } from "./tabs-DqgailPo.js";
import { t as t_7 } from "./src-CzMAtq-j.js";
import { t as G } from "./CheckIcon-EcHbjY0b.js";
import { t as F } from "./SettingsIcon-BMRm4vwX.js";
import { t as H } from "./CaretDownIcon-qWhOaTgi.js";
import { t as t_8 } from "./useWallets-BE-S4cY7.js";
import { t as t_9 } from "./PrivateDataProvider-8vglgSNV.js";
import { n as n_2 } from "./useOnboardingType-C_Lvvffu.js";
import { n as Q, t as t_10 } from "./CarouselControl-MPn6Zgxk.js";
import { t as Q1 } from "./EmptySearchContent-BPhzgYFK.js";
import { a as J, i as Ee1 } from "./InputPassword-D9sGWGS1.js";
import { t as Te } from "./NetworkIcon-CNKOmZnW.js";
import { t as Se } from "./SearchInput-BIldQfbO.js";
import { n as n_3 } from "./popularChains-kJ9npbND.js";
import { t as t_11 } from "./useWalletName-DIkqlJED.js";
import { n as n_4, t as t_12 } from "./types-DrDwy2JA.js";
import { n as n_5, t as Ne1 } from "./OnboardingBoxContent-DcFJIaKL.js";
import { a as a_2, i as i_3, o, r, s, t as t_13 } from "./useSetupAuthentication-EZlruew7.js";
import { o as o_2 } from "./SelectImportMethod-ClL8FjcB.js";
import { globalSteps } from "./onboarding-BHcKddMJ.js";
import { t as t_14 } from "./privateKeyErrors-gzTHkPk1.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const t = (new e.Error).stack;
        if (t) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[t] = "bf0a73dd-7ae2-4e7b-b198-3433c937f9b4";
            e._sentryDebugIdIdentifier = "sentry-dbid-bf0a73dd-7ae2-4e7b-b198-3433c937f9b4";
        }
    } catch (e) {}
})();
const we = f(i(), 1);
const be = t_2();
const PasswordTextarea = ({ value, label, onChange, onEnterClicked, placeholder, error, testid, autoFocus, isMnemonic = false })=>{
    const [m, setM] = we.useState(false);
    const uRef = we.useRef(null);
    const [f, setF] = we.useState(!value);
    const [x, setX] = we.useState(value);
    we.useEffect(()=>{
        if (value) {
            setF(false);
        }
    }, [
        value
    ]);
    const b = f ? "" : error;
    const v = isMnemonic && String(x).split(" ").length === 1;
    const changeValue = (t)=>{
        if (!(isMnemonic && String(value).endsWith(" ") && t.endsWith(" "))) {
            setX(t);
            onChange(t.trim());
        }
    };
    return <div className="relative text-left">{label && <div className="mb-3"><K1>{label}</K1></div>}<div className="input-field space-x-1 pr-[30px] relative"><textarea data-testid={testid} ref={uRef} value={(()=>{
        if (m) {
            return x;
        }
        if (!isMnemonic) {
            return "•".repeat(String(x).length);
        }
        const e = String(x).split(" ");
        return [
            ...e.slice(0, -1).map(()=>"•".repeat(8)),
            e[e.length - 1]
        ].join(" ");
    })()} onChange={(e)=>{
        const value = e.target.value;
        if (m) {
            return void changeValue(value);
        }
        if (!isMnemonic) {
            const e = String(x).split("");
            let s = 0;
            return void changeValue(value.split("").map((t)=>{
                if (t === "•") {
                    return e[s++] ?? "";
                }
                return t;
            }).join(""));
        }
        const s = value.split(" ");
        const a = String(x).split(" ");
        changeValue(s.map((e, t)=>{
            if (/^•+$/.test(e)) {
                return a[t] || "";
            }
            return e;
        }).join(" "));
    }} onPaste={(e)=>{
        e.preventDefault();
        const t = e.clipboardData.getData("text");
        setX(`${t} `);
        onChange(t);
    }} onKeyDown={(e)=>{
        if (e.key === "Enter" && onEnterClicked) {
            e.preventDefault();
            onEnterClicked();
        }
    }} placeholder={placeholder} className="ph-no-capture w-full block flex-1 tw-scrollbar outline-none bg-transparent text-tw3-paragraph-subtitle font-medium resize-none pr-10" rows={6} autoComplete="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" style={isMnemonic ? undefined : {
        WebkitTextSecurity: m ? "none" : "disc"
    }} autoFocus={autoFocus}/>{!v && <button type="button" data-testid={`${testid}-show-hide-button`} onClick={()=>{
        setM(!m);
        uRef.current.focus();
    }} className="absolute right-5 bottom-4">{m ? <Ee1 width={16} height={16} colorClass="text-tw3-brand-foreground-secondary"/> : <J width={16} height={16} colorClass="text-tw3-brand-foreground-secondary"/>}</button>}</div><div className="mt-2"><L_1 testid="input-error" type={B_1.FOOTNOTE} theme={z.ERROR}>{b}</L_1></div></div>;
};
const ve = [
    mn.decred
];
const Ce = "Ethereum";
const Ee = [
    n.Ethereum,
    n.SmartChain,
    n.Base,
    n.Arbitrum
];
const matches = (e, t)=>((e)=>(e.displayName ?? e.name).toLowerCase())(e).includes(t) || e.symbol.toLowerCase().includes(t);
const je = n_3((e)=>e.coinId, (e)=>e.displayName ?? e.name);
const StackedIcons = ({ iconUrls })=><div className="flex">{iconUrls.map((e, t)=><div key={e} className={t === 0 ? "" : "-ml-2"}><S name="" size={ct.XSMALL} src={e}/></div>)}</div>;
const PrivateKeyNetworkSelect = ({ selectedNetworks, onSelect, label })=>{
    const { formatMessage } = P();
    const [l, setL] = we.useState("");
    const c = t_5(true);
    const m = we.useMemo(()=>c.filter((e)=>!ve.includes(e.id)), [
        c
    ]);
    const p = we.useMemo(()=>(function buildPrivateKeyNetworkOptions(e, t) {
            const s = t.trim().toLowerCase();
            const a = e.filter((e)=>e.blockchain === Ce);
            const i = e.filter((e)=>e.blockchain !== Ce);
            const l = [];
            const r = s ? a.find((e)=>matches(e, s)) : undefined;
            const o = !s || s.includes("evm") || Boolean(r);
            if (a.length > 0 && o) {
                if (r) {
                    l.push({
                        kind: "evm-group",
                        importBlockchainId: mn.ethereum,
                        label: `${r.displayName ?? r.name} & EVM chains`,
                        iconUrls: [
                            r.iconUrl
                        ].filter(Boolean)
                    });
                } else {
                    const iconUrls = Ee.map((e)=>a.find((t)=>t.coinId === e)?.iconUrl).filter(Boolean);
                    l.push({
                        kind: "evm-group",
                        importBlockchainId: mn.ethereum,
                        label: "EVM chains",
                        iconUrls
                    });
                }
            }
            const n = i.filter((e)=>!s || matches(e, s)).sort(je).map((e)=>({
                    kind: "chain",
                    blockchain: e
                }));
            return [
                ...l,
                ...n
            ];
        })(m, l), [
        m,
        l
    ]);
    const u = selectedNetworks?.[0]?.blockchainId;
    const h = we.useMemo(()=>m.find((e)=>e.id === u), [
        m,
        u
    ]);
    const f = h?.blockchain === "Ethereum";
    return <B className="w-full">{({ open })=><>{label && <div className="mb-3 text-left"><K1>{label}</K1></div>}<W className="outline-none bg-tw3-background-secondary py-4 px-6 rounded-4 w-full"><div className="flex items-center"><div className="pr-2">{h ? <S name={h.name} size={ct.XSMALL} src={h.iconUrl}/> : <Te width={20} height={20}/>}</div><div className="whitespace-nowrap"><L_1 type={B_1.EMPHASIS}>{h ? f ? `${h.displayName ?? h.name} & EVM chains` : h.displayName ?? h.name : formatMessage({
            id: "import-private-key.blockchain.label",
            defaultMessage: "Select Network"
        })}</L_1></div><div className="pl-1 ml-auto"><H width={18} height={18} colorClass={`text-tw3-label-secondary transition-transform ${open ? "rotate-180" : "rotate-0"}`}/></div></div></W><R enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1" afterLeave={()=>setL("")}><D className="absolute min-w-full mt-2 left-0 z-10 shadow-lg rounded-4 bg-tw3-background-secondary cursor-default" onClick={(e)=>e.stopPropagation()}>{({ close })=><div className="mr-1 my-2 px-2 tw-scrollbar max-h-[250px]"><div className="px-3 mb-2 pt-1"><Se testid="pk-network-select-search" value={l} onChange={(e)=>{
                setL(e.target.value);
                e.stopPropagation();
            }} placeholder={formatMessage({
                id: "component.input-networks-search.placeholder",
                defaultMessage: "Search"
            })}/></div>{p.length === 0 && <Q1/>}{p.map((s)=>{
                const i = s.kind === "evm-group" ? `evm:${s.label}` : s.blockchain.id;
                const l = s.kind === "evm-group" ? s.label : s.blockchain.displayName ?? s.blockchain.name;
                return <L key={i} onClick={()=>((e, close_1)=>{
                        if (e.kind === "evm-group") {
                            onSelect([
                                {
                                    prefixedCoinId: K_1(m.find((t)=>t.id === e.importBlockchainId)?.coinId ?? 60),
                                    blockchainId: e.importBlockchainId
                                }
                            ]);
                        } else {
                            onSelect([
                                {
                                    prefixedCoinId: K_1(e.blockchain.coinId),
                                    blockchainId: e.blockchain.id
                                }
                            ]);
                        }
                        setL("");
                        close_1();
                    })(s, close)}><div className="flex items-center text-left mb-1 py-1.5 px-4 rounded-3 hover:bg-tw3-action-hover"><div>{s.kind === "evm-group" ? <StackedIcons iconUrls={s.iconUrls}/> : <S name={s.blockchain.name} size={ct.XSMALL} src={s.blockchain.iconUrl}/>}</div><div className="pl-2 flex-grow"><L_1 type={B_1.EMPHASIS}>{l}</L_1></div></div></L>;
            })}</div>}</D></R></>}</B>;
};
function useValidatePrivateKey({ value, blockchain }) {
    const { formatMessage } = P();
    const [a, setA] = we.useState(false);
    const [l, setL] = we.useState("");
    we.useEffect(()=>{
        if (blockchain && value) {
            (async function validatePrivateKey() {
                const a = await vn.emit(t_4.VALIDATE_PRIVATE_KEY, {
                    privateKey: value,
                    blockchain
                });
                setA(a);
                setL(a ? "" : formatMessage({
                    id: "validate-private-key.invalid",
                    defaultMessage: "Invalid private key"
                }));
            })();
        }
    }, [
        value,
        blockchain
    ]);
    return {
        isValid: a,
        error: l
    };
}
const ye = f(t_7(), 1);
const useValidateSeedPhrase = ({ value, selectedWordCount })=>{
    const { formatMessage } = P();
    const a = we.useMemo(()=>(({ value, selectedWordCount })=>{
            const s = {
                length: true,
                mnemonic: false,
                hideError: true
            };
            if (!value || value.length < 8) {
                return {
                    ...s,
                    isValid: false
                };
            }
            const a = value?.match(/\w+/g)?.join(" ").split(new RegExp("\\s"))?.length ?? 0;
            if (value && (a === 18 && selectedWordCount === 18 || a === 12 && selectedWordCount === 12 || a === 24 && selectedWordCount === 24)) {
                s.length = true;
                s.mnemonic = ye.validateMnemonic(un(value).toLowerCase());
                s.hideError = false;
            } else if (a > 24) {
                s.length = false;
            } else {
                s.hideError = true;
            }
            const i = s.length && s.mnemonic;
            return {
                ...s,
                isValid: i
            };
        })({
            value,
            selectedWordCount
        }), [
        value,
        selectedWordCount
    ]);
    const i = we.useMemo(()=>{
        if (a.length) {
            if (a.mnemonic || a.hideError) {
                return undefined;
            }
            return formatMessage({
                id: "validate-seed-phrase.generic"
            });
        }
        return formatMessage({
            id: "validate-seed-phrase.length"
        });
    }, [
        formatMessage,
        a
    ]);
    return {
        isValid: a.isValid,
        error: i
    };
};
const MenuVerticalIcon = ({ width = 24, height = 24, colorClass })=><svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={colorClass}><path d="M12.5748 2.31446C10.7648 1.90446 9.15477 3.51446 9.56477 5.32446C9.77477 6.24446 10.5148 6.98446 11.4248 7.18446C13.2448 7.59446 14.8448 5.99446 14.4348 4.17446C14.2248 3.25446 13.4848 2.51446 12.5748 2.31446ZM12.5748 9.31446C10.7548 8.90446 9.15477 10.5045 9.56477 12.3245C9.77477 13.2445 10.5148 13.9845 11.4248 14.1845C13.2448 14.5945 14.8448 12.9945 14.4348 11.1745C14.2248 10.2545 13.4848 9.51446 12.5748 9.31446ZM12.5748 16.8145C10.7548 16.4045 9.15477 18.0045 9.56477 19.8245C9.77477 20.7445 10.5148 21.4845 11.4248 21.6845C13.2448 22.0945 14.8448 20.4945 14.4348 18.6745C14.2248 17.7545 13.4848 17.0145 12.5748 16.8145Z" fill="currentColor"/></svg>;
const ImportInstructions = ({ instructions })=>{
    const [t, setT] = we.useState(0);
    const { formatMessage } = P();
    const [l, setL] = we.useState(0);
    const d = we.useMemo(()=>instructions?.platforms[t]?.steps.map((e)=>e.id) ?? [], [
        instructions,
        t
    ]);
    const m = instructions?.platforms[t]?.steps?.[l];
    return <div className="flex flex-col gap-4"><U as={we.Fragment} onChange={(e)=>setT(e)} selectedIndex={t}><K className="flex gap-6">{instructions?.platforms.map((t, i)=><V key={`${instructions.product}-${t.title}`} className={`px-2 outline-none flex flex-col items-center ${instructions.product === "other" ? "hidden" : ""}`}>{({ selected })=><><div className="flex items-center h-full" onClick={()=>((e)=>{
                    setT(e);
                    setL(0);
                })(i)}><L_1 theme={selected ? z.LABEL_PRIMARY : z.LABEL_SECONDARY} type={B_1.SUBTITLE} weight={V_1.MEDIUM}>{t.title}</L_1></div><div data-selected={selected} className="w-full h-1 rounded-full data-[selected='true']:bg-tw3-brand-primary"/></>}</V>)}</K></U>{m?.image}<div className="flex flex-col"><div className="flex min-h-[54px]"><L_1 type={B_1.BODY}>{formatMessage(m?.messageConfig ?? {}, {
        bold: (e)=><span className="font-bold">{e}</span>,
        menuVertical: ()=><span className="inline-block"><MenuVerticalIcon colorClass="text-tw3-label-primary"/></span>,
        gearIcon: ()=><span className="inline-block"><F colorClass="text-tw3-label-primary" width={12} height={12}/></span>
    })}</L_1></div><div className="flex justify-center items-center"><Q spacing={t_10.SMALL} width={t_10.MEDIUM} disableNext={l === d.length - 1} disablePrevious={l === 0} onClickNext={()=>setL(l + 1)} onClickPrevious={()=>setL(l - 1)}>{d.map((e, t)=><Q.Step key={e} active={l === t}/>)}</Q></div></div></div>;
};
const ImportInstructionAnimation = ({ src, alt })=><div className="relative w-full h-full aspect-[2/1.48]"><div className="absolute inset-0 rounded-[4px] overflow-hidden"><img src={src} alt={alt}/></div></div>;
const Ne = {
    "trust-wallet": {
        product: o_2.TRUST_WALLET,
        header: {
            id: "import-wallet.trust-wallet.header",
            defaultMessage: "Locate your Secret Phrase on Trust Wallet"
        },
        subHeader: {
            id: "import-wallet.trust-wallet.sub-header",
            defaultMessage: "Import with Secret Phrase or Private Key"
        },
        inputLabel: {
            id: "import-wallet.trust-wallet.input-label",
            defaultMessage: "Enter Secret Phrase or Private Key"
        },
        inputInstructions: {
            id: "import-wallet.trust-wallet.input-instructions",
            defaultMessage: "Secret Phrase is typically 12 (sometimes 18, 24) words separated by single spaces {br} Private Key is a long alphanumeric code"
        },
        platforms: [
            {
                title: "Mobile",
                steps: [
                    {
                        id: "tw-mobile-step-1",
                        image: <ImportInstructionAnimation src="/assets/trust-wallet-1-BsoWnpIo.gif" alt="Step 1"/>,
                        messageConfig: {
                            id: "import-wallet.mobile.step-1",
                            defaultMessage: "1. On your <bold>Trust Wallet</bold> mobile app Homepage click on your <bold>Wallet</bold>"
                        }
                    },
                    {
                        id: "tw-mobile-step-2",
                        image: <ImportInstructionAnimation src="/assets/trust-wallet-2-BcexborV.gif" alt="Step 2"/>,
                        messageConfig: {
                            id: "import-wallet.mobile.step-2",
                            defaultMessage: "2. Click on the “<menuVertical></menuVertical>“ and select “<bold>Back up now</bold>”"
                        }
                    },
                    {
                        id: "tw-mobile-step-3",
                        image: <ImportInstructionAnimation src="/assets/trust-wallet-3-Bhyn5ruu.gif" alt="Step 3"/>,
                        messageConfig: {
                            id: "import-wallet.mobile.step-3",
                            defaultMessage: "3. Follow the security steps to retrieve your <bold>Secret Phrase</bold>"
                        }
                    }
                ]
            },
            {
                title: "Extension",
                steps: [
                    {
                        id: "tw-extension-step-1",
                        image: <ImportInstructionAnimation src="/assets/trust-wallet-extension-1-BFRN1GFu.gif" alt="Step 1"/>,
                        messageConfig: {
                            id: "import-wallet.extension.step-1",
                            defaultMessage: '1. On your Trust Wallet extension Homepage click on your <bold>Wallet</bold> and "<bold>Manage Wallets</bold>"'
                        }
                    },
                    {
                        id: "tw-extension-step-2",
                        image: <ImportInstructionAnimation src="/assets/trust-wallet-extension-2-DPWgc1fl.gif" alt="Step 2"/>,
                        messageConfig: {
                            id: "import-wallet.extension.step-2",
                            defaultMessage: '2. Select your wallet and "<bold>Secret Phrase</bold>"'
                        }
                    },
                    {
                        id: "tw-extension-step-3",
                        image: <ImportInstructionAnimation src="/assets/trust-wallet-extension-3-5r-CgMms.gif" alt="Step 3"/>,
                        messageConfig: {
                            id: "import-wallet.extension.step-3",
                            defaultMessage: "3. Follow the security steps to retrieve your <bold>Secret Phrase</bold>"
                        }
                    }
                ]
            }
        ]
    },
    other: {
        product: o_2.OTHER,
        header: {
            id: "import-wallet.other.header",
            defaultMessage: "Locate your Secret Phrase or Private Key on wallets"
        },
        subHeader: {
            id: "import-wallet.other.sub-header",
            defaultMessage: "Import with Secret Phrase or Private Key"
        },
        inputLabel: {
            id: "import-wallet.trust-wallet.input-label",
            defaultMessage: "Enter Secret Phrase or Private Key"
        },
        inputInstructions: {
            id: "import-wallet.other.input-instructions",
            defaultMessage: "Secret Recovery Phrase is typically 12 (sometimes 18, 24) words separated by single spaces {br} Private Key is a long alphanumeric code"
        },
        platforms: [
            {
                title: "Mobile",
                steps: [
                    {
                        id: "other-mobile-step-1",
                        image: <ImportInstructionAnimation src="/assets/generic-1-BMQaBaYP.gif" alt="Step 1"/>,
                        messageConfig: {
                            id: "import-wallet.other.mobile.step-1",
                            defaultMessage: "1. On your wallet Homepage, go to “<bold>Settings</bold>”"
                        }
                    },
                    {
                        id: "other-mobile-step-2",
                        image: <ImportInstructionAnimation src="/assets/generic-2-C7xANjS3.gif" alt="Step 2"/>,
                        messageConfig: {
                            id: "import-wallet.other.mobile.step-2",
                            defaultMessage: "2. Select “<bold>Security & Privacy</bold>” and look for “<bold>Secret Phrase</bold>” or “<bold>Private Key</bold>”"
                        }
                    },
                    {
                        id: "other-mobile-step-3",
                        image: <ImportInstructionAnimation src="/assets/generic-3-B4T264Cr.gif" alt="Step 3"/>,
                        messageConfig: {
                            id: "import-wallet.other.mobile.step-3",
                            defaultMessage: "3. Follow the verification steps to view your <bold>Secret Phrase</bold> or <bold>Private Key</bold>"
                        }
                    }
                ]
            }
        ]
    }
};
const ImportMnemonicOrPrivateKey = ({ setCurrentStep })=>{
    const { formatMessage } = P();
    const d = i_2();
    const p = n_2();
    t_3({
        event: D_1.ONBOARDING_IMPORT_MNEMONIC_OR_PRIVATE_KEY,
        props: {
            setupType: p
        }
    });
    const { selectedWallet, setCurrentFlow, setSelectedWallet } = n_5();
    const { data: { password, isPasswordGenerated, passkeyId, passkeyPassword }, update } = we.useContext(t_9);
    const { setupAuthentication } = t_13();
    const { importMnemonic } = (({ setCurrentStep })=>{
        const { trackAnalytics, setCustomPeoplePropertiesOnce } = t();
        const { data: { isPasswordGenerated }, clear } = we.useContext(t_9);
        const { setSolanaDerivationAddresses, setTempWalletId } = n_5();
        const d = n_2();
        const { selectedWallet } = n_5();
        return {
            importMnemonic: async (mnemonic, name)=>{
                const h = await vn.emit(o.INITIATE_IMPORT_MNEMONIC, {
                    mnemonic
                });
                const { types, accounts } = await vn.emit(o.DERIVE_SOLANA_ADDRESS, h);
                const length = mnemonic.trim().split(/\s+/).length;
                if (types.length === 1) {
                    await vn.emit(o.COMPLETE_IMPORT_MNEMONIC, {
                        walletId: h,
                        solanaDerivationType: types[0],
                        name
                    });
                    trackAnalytics({
                        event: E.WALLET_CREATED,
                        props: {
                            pageViewSource: D_1.ONBOARDING_IMPORT_MNEMONIC_OR_PRIVATE_KEY,
                            walletType: L_2.MNEMONIC,
                            mnemonicLength: length,
                            actionSourceType: "importwallet",
                            setupType: d
                        }
                    });
                    setCustomPeoplePropertiesOnce({
                        [A.ONBOARDING_AUTH_TYPE]: isPasswordGenerated ? r.BIOMETRICS : r.PASSWORD,
                        [A.ONBOARDING_SETUP_TYPE]: i_3.IMPORT,
                        [A.ONBOARDING_SELECTED_WALLET]: selectedWallet,
                        [A.ONBOARDING_WALLET_TYPE]: a_2.SEED_PHRASE
                    });
                    clear();
                    setCurrentStep(n_4.COMPLETED);
                } else {
                    setSolanaDerivationAddresses(accounts);
                    setTempWalletId(h);
                    setCurrentStep(n_4.DERIVE_SOLANA_ADDRESS);
                }
            }
        };
    })({
        setCurrentStep
    });
    const { importPrivateKey } = (({ setCurrentStep })=>{
        const { trackAnalytics, setCustomPeoplePropertiesOnce } = t();
        const { data: { isPasswordGenerated }, clear } = we.useContext(t_9);
        const n = n_2();
        const { selectedWallet } = n_5();
        return {
            importPrivateKey: async (privateKey, m, walletName_1)=>{
                const u = await vn.emit(o.INITIATE_IMPORT_PRIVATE_KEY, {
                    privateKey,
                    blockchain: m
                });
                if (!u) {
                    throw new Error("Private key import initiation failed");
                }
                await vn.emit(o.COMPLETE_IMPORT_PRIVATE_KEY, {
                    walletId: u,
                    walletName: walletName_1
                });
                clear();
                trackAnalytics({
                    event: E.WALLET_CREATED,
                    props: {
                        pageViewSource: D_1.ONBOARDING_IMPORT_MNEMONIC_OR_PRIVATE_KEY,
                        walletType: L_2.PRIVATE_KEY,
                        blockchain: m,
                        actionSourceType: "importwallet",
                        setupType: n
                    }
                });
                setCustomPeoplePropertiesOnce({
                    [A.ONBOARDING_AUTH_TYPE]: isPasswordGenerated ? r.BIOMETRICS : r.PASSWORD,
                    [A.ONBOARDING_SETUP_TYPE]: i_3.IMPORT,
                    [A.ONBOARDING_SELECTED_WALLET]: selectedWallet,
                    [A.ONBOARDING_WALLET_TYPE]: a_2.PRIVATE_KEY
                });
                clear();
                setCurrentStep(n_4.COMPLETED);
            }
        };
    })({
        setCurrentStep
    });
    const [R, setR] = we.useState("");
    const [B, setB] = we.useState(false);
    const [V, setV] = we.useState("");
    const [U, setU] = we.useState([]);
    const G = ((e)=>{
        const t = e.trim().split(/\s+/);
        return t.length > 1 || t.length === 1 && e.length <= 8;
    })(R);
    const F = R.trim().split(/\s+/).length === 1;
    const { walletName, setWalletName } = t_11();
    const validation = ((walletName_1)=>{
        const { formatMessage } = P();
        const s = t_8();
        const a = Object.values(s?.wallets ?? {}).map((e)=>e.name);
        const i = we.useMemo(()=>a.includes(walletName_1), [
            walletName_1
        ]);
        return {
            isValid: !i,
            error: i ? formatMessage({
                id: "onboarding.import-wallet.wallet-name-already-exists",
                defaultMessage: "Wallet name already exists"
            }) : undefined
        };
    })(walletName);
    const q = ((e, t, isPrivateKey, a)=>{
        const { isValid, error } = useValidateSeedPhrase({
            value: e,
            selectedWordCount: e.trim().split(/\s+/).length
        });
        const { isValid: isValid_1, error: error_1 } = useValidatePrivateKey({
            value: e,
            blockchain: a
        });
        let n;
        if (t) {
            n = error;
        } else if (isPrivateKey) {
            n = error_1;
        }
        return {
            isMnemonic: t,
            isPrivateKey,
            isValid: isValid || isValid_1,
            error: n
        };
    })(R, G, F, U?.[0]?.blockchainId);
    const J = q.isValid && validation.isValid;
    const instructions = Ne[selectedWallet ?? "other"];
    we.useEffect(()=>{
        if (V) {
            setV("");
        }
    }, [
        R
    ]);
    we.useEffect(()=>()=>{
            setSelectedWallet(undefined);
        }, [
        selectedWallet
    ]);
    const onSubmit = async (e)=>{
        e?.preventDefault();
        if (d || password) {
            setB(true);
            update({
                seedPhrase: G ? un(R).toLowerCase() : undefined,
                privateKey: F ? R : undefined,
                selectedBlockchain: F ? U?.[0]?.blockchainId : undefined
            });
            try {
                if (password) {
                    await setupAuthentication({
                        pageViewSource: D_1.ONBOARDING_IMPORT_MNEMONIC_OR_PRIVATE_KEY,
                        password,
                        passkeyId,
                        passkeyPassword,
                        isPasswordGenerated
                    });
                }
                if (G) {
                    await importMnemonic(un(R).toLowerCase(), walletName);
                } else {
                    await importPrivateKey(R, U?.[0]?.blockchainId, walletName);
                }
            } catch (error) {
                update({
                    seedPhrase: undefined,
                    privateKey: undefined
                });
                if (error?.message === "MNEMONIC_ALREADY_EXISTS") {
                    setV(formatMessage({
                        id: "import-wallet.seed-phrase.duplicated"
                    }));
                } else if (error?.message === t_14.DUPLICATED) {
                    setV(formatMessage({
                        id: "import-wallet.private-key.duplicated",
                        defaultMessage: "Wallet with such account already exists"
                    }));
                } else {
                    setV(error?.message ?? error);
                }
            }
            setB(false);
        }
    };
    const te = {
        importTypeUnknown: instructions.inputInstructions,
        mnemonic: {
            id: "import-wallet.mnemonic-or-private-key.mnemonic-caption",
            defaultMessage: "Secret Phrase detected"
        },
        privateKey: {
            id: "import-wallet.mnemonic-or-private-key.private-key-caption",
            defaultMessage: "Private Key detected"
        }
    };
    return <Ne1 heading={formatMessage({
        id: "import-wallet.heading",
        defaultMessage: "Import a wallet"
    })} subHeading={formatMessage(instructions.subHeader)} body=<div className="relative top-[110px]"><L_1 type={B_1.SUBTITLE} theme={z.LABEL_PRIMARY}>{formatMessage(instructions.header)}</L_1></div> animation=<ImportInstructions instructions={instructions}/> animationWrapperStyles="w-full h-full mt-[150px]" activeTab={3} subHeadingAction={selectedWallet === o_2.TRUST_WALLET ? <W_1 theme={dt.TRANSPARENT} onClick={()=>{
        setCurrentFlow(t_12.IMPORT_QR);
    }} className="text-tw3-brand-foreground-secondary flex items-center gap-2" fullWidth={false}><Y1 width={16} height={16} colorClass="text-tw3-brand-foreground-secondary"/>{formatMessage({
        id: "import-wallet.import-with-qr-code",
        defaultMessage: "Import with QR Code"
    })}</W_1> : null} onBackClick={()=>{
        if (selectedWallet !== o_2.TRUST_WALLET) {
            setCurrentStep(n_4.SELECT_IMPORT_METHOD);
        } else {
            setCurrentStep(n_4.SELECT_TRUST_WALLET_METHOD);
        }
    }}><form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden mb-10"><div className="flex-1 flex flex-col overflow-y-auto gap-6 tw-scrollbar"><div className="flex flex-col"><_ testid="wallet-name-input" label={formatMessage({
        id: "import-wallet.name.label",
        defaultMessage: "Wallet Name"
    })} actions={[
        {
            key: "clear",
            placeholder: <I width={16} height={16} colorClass="text-tw3-label-secondary"/>,
            onClick: ()=>setWalletName("")
        }
    ]} value={walletName} validation={validation} onChange={(e)=>setWalletName(e.target.value)}/>{!validation.error && <L_1 type={B_1.FOOTNOTE} theme={z.LABEL_SECONDARY} weight={V_1.MEDIUM}>{formatMessage({
        id: "import-wallet.mnemonic-or-private-key.name-description",
        defaultMessage: "You can edit this later"
    })}</L_1>}</div><div className="flex flex-col"><PasswordTextarea label={formatMessage(instructions.inputLabel)} onChange={setR} onEnterClicked={()=>J && onSubmit()} value={R} isMnemonic={G} error={q.error} autoFocus/>{!q.error && <L_1 type={B_1.FOOTNOTE} theme={z.LABEL_SECONDARY} weight={V_1.MEDIUM}>{formatMessage(te[G && F ? "importTypeUnknown" : G ? "mnemonic" : "privateKey"], {
        br: <br/>
    })}</L_1>}</div>{F && !G && <div className="flex relative w-full"><PrivateKeyNetworkSelect selectedNetworks={U} onSelect={setU} label={formatMessage({
        id: "import-private-key.blockchain.label",
        defaultMessage: "Select Network"
    })}/></div>}</div>{V && <div className="mt-4 shrink-0"><M theme={a.WARNING}>{V}</M></div>}<div className="w-1/2 ml-auto mt-4 shrink-0"><W_1 onClick={onSubmit} testid="import-wallet-submit" loadingData={formatMessage({
        id: "import-wallet.importing",
        defaultMessage: "Importing..."
    })} disabled={!J || B || !!V} loading={B}>{formatMessage({
        id: "generic.import",
        defaultMessage: "Import"
    })}</W_1></div></form></Ne1>;
};
const FlowNavigation = ({ buttonSubmitProps, buttonCancelProps })=>{
    const { formatMessage } = P();
    return <div className="flex w-full items-center justify-between mt-6 space-x-4"><W_1 theme={dt.TRANSPARENT} noPadding {...buttonCancelProps}><L_1 theme={z.LABEL_PRIMARY} type={B_1.SUBTITLE}>{buttonCancelProps?.children ?? formatMessage({
        id: "generic.back"
    })}</L_1></W_1><W_1 type={ft.SUBMIT} {...buttonSubmitProps} data-testid="next-button">{buttonSubmitProps.children ?? formatMessage({
        id: "generic.next"
    })}</W_1></div>;
};
const TrustIcon = ({ width = 24, height = 24, colorClass })=><svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={colorClass}><path d="M19.3999 4.45479L12.6299 2.2648C12.4299 2.1948 12.2099 2.16479 11.9999 2.16479C11.7899 2.16479 11.5699 2.1948 11.3699 2.2648L4.59995 4.45479C3.75995 4.72479 3.18994 5.51479 3.18994 6.39479V11.0548C3.18994 16.8048 8.80995 20.3848 11.0699 21.5948C11.3699 21.7548 11.6999 21.8348 12.0199 21.8348C12.3399 21.8348 12.6499 21.7648 12.9399 21.6148C15.2099 20.4548 20.8099 17.0248 20.8099 11.2848V6.39479C20.8099 5.50479 20.2399 4.72479 19.3999 4.45479ZM18.5599 11.2848C18.5599 15.6748 14.0799 18.4948 12.0299 19.5548C9.96995 18.4348 5.43994 15.4748 5.43994 11.0548V6.5448L11.9999 4.41479L18.5599 6.5448V11.2848Z" fill="currentColor"/><path d="M10.5199 6.9948L7.89994 7.84479C7.42994 7.99479 7.11994 8.43479 7.11994 8.92479V11.5148C7.11994 13.8648 8.80994 15.5548 10.1999 16.5548C10.9499 17.0948 11.9999 16.5648 11.9999 15.6448V8.08479C11.9999 7.31479 11.2499 6.77479 10.5199 7.00479V6.9948Z" fill="currentColor"/></svg>;
const PhantomWalletIcon = ({ width, height, colorClass })=><svg className={colorClass} fill="none" width={width ?? 593} height={height ?? 493} viewBox="0 0 593 493" xmlns="http://www.w3.org/2000/svg"><path d="M70.0546 493C145.604 493 202.38 427.297 236.263 375.378C232.142 386.865 229.852 398.351 229.852 409.378C229.852 439.703 247.252 461.297 281.592 461.297C328.753 461.297 379.119 419.946 405.218 375.378C403.386 381.811 402.471 387.784 402.471 393.297C402.471 414.432 414.375 427.757 438.643 427.757C515.108 427.757 592.03 292.216 592.03 173.676C592.03 81.3243 545.327 0 428.112 0C222.069 0 0 251.784 0 414.432C0 478.297 34.3405 493 70.0546 493ZM357.141 163.568C357.141 140.595 369.962 124.514 388.734 124.514C407.049 124.514 419.87 140.595 419.87 163.568C419.87 186.541 407.049 203.081 388.734 203.081C369.962 203.081 357.141 186.541 357.141 163.568ZM455.126 163.568C455.126 140.595 467.947 124.514 486.719 124.514C505.034 124.514 517.855 140.595 517.855 163.568C517.855 186.541 505.034 203.081 486.719 203.081C467.947 203.081 455.126 186.541 455.126 163.568Z" fill="currentColor"/></svg>;
const SolanaDerivation = ({ setCurrentStep })=>{
    const { formatMessage } = P();
    const { trackAnalytics } = t();
    const n = n_2();
    t_3({
        event: D_1.ONBOARDING_IMPORT_MNEMONIC_SOLANA_DERIVATION,
        props: {
            setupType: n
        }
    });
    const { tempWalletId, mnemonicLength, solanaDerivationAddresses } = n_5();
    const { clear } = we.useContext(t_9);
    const [f, setF] = we.useState(false);
    const [x, setX] = we.useState(solanaDerivationAddresses[0].type);
    const [v, setV] = we.useState("");
    return <Ne1 heading={formatMessage({
        id: "import-solana-derivation.heading",
        defaultMessage: "Select wallet for Solana"
    })} activeTab={2}><form onSubmit={async (t)=>{
        t.preventDefault();
        try {
            setF(true);
            await vn.emit(o.COMPLETE_IMPORT_MNEMONIC, {
                walletId: tempWalletId,
                solanaDerivationType: x
            });
            clear();
            trackAnalytics({
                event: E.WALLET_CREATED,
                props: {
                    pageViewSource: D_1.ONBOARDING_IMPORT_MNEMONIC_SOLANA_DERIVATION,
                    walletType: L_2.MNEMONIC,
                    mnemonicLength,
                    actionSourceType: "importwallet",
                    setupType: n
                }
            });
            setCurrentStep(n_4.COMPLETED);
        } catch (error) {
            setV(error?.message);
            setF(false);
        }
    }} className="flex flex-col space-y-6">{solanaDerivationAddresses.map((e)=><L key={e.type} onClick={()=>setX(e.type)}><div className="flex items-center"><div className="flex flex-1 items-center space-x-2"><div className="flex h-8 w-8 items-center justify-center">{e.type === s.DEFAULT ? <TrustIcon width={28} height={28}/> : <PhantomWalletIcon width={15} height={30}/>}</div><div className="pl-2 flex-grow"><div className="flex flex-col text-start"><L_1 type={B_1.SUBTITLE} theme={z.LABEL_PRIMARY}>{e.type === s.DEFAULT ? "Trust" : "Phantom"}</L_1><L_1 type={B_1.BODY} theme={z.LABEL_SECONDARY}>{t_6({
            value: e.address,
            maxCharsPerSide: 6
        })}</L_1></div></div></div><div className="flex items-center space-x-2"><L_1 type={B_1.SUBTITLE} theme={z.LABEL_PRIMARY}>{e.balance} {e.symbol}</L_1><div className="w-[20px] h-[20px]">{x === e.type && <G width={20} height={20} colorClass="text-tw3-label-primary"/>}</div></div></div></L>)}{v && <M theme={a.WARNING}>{v}</M>}<FlowNavigation buttonCancelProps={{
        onClick: ()=>{
            setCurrentStep(n_4.IMPORT_WALLET);
        },
        disabled: f
    }} buttonSubmitProps={{
        loading: f,
        onClick
    }}/></form></Ne1>;
};
const ImportMnemonicOrPrivateKeyFlow = ()=>{
    const e = i_2();
    const { data: { passkeyId, password } } = we.useContext(t_9);
    const { selectedWallet, selectedTrustWalletMethod } = n_5();
    const l = {
        [n_4.IMPORT_WALLET]: ImportMnemonicOrPrivateKey,
        [n_4.DERIVE_SOLANA_ADDRESS]: SolanaDerivation,
        ...globalSteps
    };
    const [r, setR] = we.useState(selectedWallet ? selectedTrustWalletMethod ? n_4.SELECT_TRUST_WALLET_METHOD : n_4.IMPORT_WALLET : e || passkeyId || password ? n_4.SELECT_IMPORT_METHOD : n_4.AUTHENTICATION);
    const N = l[r];
    return <N setCurrentStep={setR}/>;
};
export { ImportMnemonicOrPrivateKeyFlow as default };
