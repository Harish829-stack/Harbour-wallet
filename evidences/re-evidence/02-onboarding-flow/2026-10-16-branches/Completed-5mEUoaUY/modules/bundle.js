const PinHintContent = ({ size = "small" })=>{
    const { formatMessage } = a();
    return <div className={`flex ${C[size]} items-center`}><E height={M[size].height} width={M[size].width}/><div className={`flex flex-col ${F[size]}`}>{P.jsx(y, {
        type: w[size],
        children: "Pin Trust Wallet"
    })}{P.jsx(y, {
        type: j.small,
        children: <span className="flex items-center gap-1.5 text-tw3-label-secondary">{formatMessage({
            id: "onboarding.explore.pin-hint-description",
            defaultMessage: "Click on extension {puzzle} then pin it {pin}"
        }, {
            puzzle: <PuzzleIcon key="puzzle" width={T[size]} height={T[size]}/>,
            pin: <PinIcon key="pin" width={T[size]} height={T[size]}/>
        })}</span>
    })}</div></div>;
};
const Completed = ()=>{
    const { formatMessage } = a();
    const { currentFlow, setupType, setIsPasswordVerified, setFlowCompleted } = S();
    const { clear } = V.useContext(v);
    const isPinned = (()=>{
        const [t, setT] = V.useState(false);
        V.useEffect(()=>{
            const checkIfPinned = async (t)=>{
                try {
                    setT(t.isOnToolbar ?? false);
                } catch (o) {
                    setT(false);
                }
            };
            (async ()=>{
                checkIfPinned(await m.action.getUserSettings());
            })();
            if (chrome.action?.onUserSettingsChanged) {
                chrome.action.onUserSettingsChanged.addListener(checkIfPinned);
            }
            return ()=>{
                if (chrome.action?.onUserSettingsChanged) {
                    chrome.action.onUserSettingsChanged.removeListener(checkIfPinned);
                }
            };
        }, []);
        return t;
    })();
    const [G, setG] = V.useState(false);
    const disabled = useIsSidePanelOpened();
    const D = (({ isPinned, setShowPinOverlay })=>{
        const { formatMessage } = a();
        const n = useIsSidePanelOpened();
        return [
            {
                id: "explore-slides-1",
                header: formatMessage({
                    id: "onboarding.explore.top-app",
                    defaultMessage: "Top app right now"
                }),
                subHeader: "PancakeSwap",
                description: formatMessage({
                    id: "onboarding.explore.dapp-description",
                    defaultMessage: "Trade, earn, and farm across chains"
                }),
                cta: P.jsxs(s, {
                    onClick: ()=>window.open("https://pancakeswap.finance/", "_blank"),
                    theme: k.TRANSPARENT,
                    noPadding: true,
                    className: "gap-1 justify-start",
                    children: [
                        P.jsx(y, {
                            type: o.EMPHASIS,
                            theme: r.BRAND,
                            children: formatMessage({
                                id: "onboarding.explore.dapp-cta",
                                defaultMessage: "Go to app"
                            })
                        }),
                        P.jsx(p, {
                            colorClass: "text-tw3-brand-foreground-secondary",
                            width: 16,
                            height: 16
                        })
                    ]
                }),
                image: <img src="/assets/pancakeswap-banner-DZpaafr7.png" alt="screenshot" width={466} height={360}/>
            },
            {
                id: "explore-slides-2",
                header: formatMessage({
                    id: "onboarding.explore.side-panel-header",
                    defaultMessage: "Did you know"
                }),
                subHeader: formatMessage({
                    id: "onboarding.explore.side-panel-subheader",
                    defaultMessage: "<p>Extension</p> - in a Side Panel"
                }, {
                    p: (t)=><span key={Math.random()}>{t}<br/></span>
                }),
                description: formatMessage({
                    id: "onboarding.explore.side-panel-description",
                    defaultMessage: "Interact without losing context"
                }),
                cta: P.jsxs(s, {
                    onClick: d,
                    theme: k.TRANSPARENT,
                    noPadding: true,
                    className: "gap-1 justify-start",
                    children: [
                        P.jsx(y, {
                            type: o.EMPHASIS,
                            theme: r.BRAND,
                            children: formatMessage({
                                id: n ? "onboarding.explore.close-side-panel" : "onboarding.explore.open-side-panel",
                                defaultMessage: n ? "Hide Side Panel" : "Open Side Panel"
                            })
                        }),
                        P.jsx(p, {
                            colorClass: "text-tw3-brand-foreground-secondary",
                            width: 16,
                            height: 16
                        })
                    ]
                }),
                image: <div className="flex justify-center items-center w-full h-full bg-tw3-background-tertiary"><div className="bg-tw3-background-primary w-[389px] h-[252px] rounded-6 flex justify-end items-center"><div className="bg-tw3-button-secondary-default w-[102px] h-[232px] rounded-3 mr-3"/></div></div>
            },
            {
                id: "explore-slides-3",
                header: formatMessage({
                    id: "onboarding.explore.pin",
                    defaultMessage: "Keep it handy"
                }),
                subHeader: formatMessage({
                    id: "onboarding.explore.pin-subheader",
                    defaultMessage: "Pin us to your Toolbar"
                }),
                description: formatMessage({
                    id: "onboarding.explore.pin-description",
                    defaultMessage: "Access it instantly in one click"
                }),
                cta: isPinned ? P.jsx(y, {
                    type: o.EMPHASIS,
                    theme: r.BRAND,
                    children: formatMessage({
                        id: "onboarding.explore.extension-pinned",
                        defaultMessage: "It's pinned 🎉"
                    })
                }) : P.jsxs(s, {
                    onClick: ()=>setShowPinOverlay(true),
                    theme: k.TRANSPARENT,
                    noPadding: true,
                    className: "gap-1 justify-start",
                    children: [
                        P.jsx(y, {
                            type: o.EMPHASIS,
                            theme: r.BRAND,
                            children: formatMessage({
                                id: "onboarding.explore.pin-cta",
                                defaultMessage: "Guide me"
                            })
                        }),
                        P.jsx(p, {
                            colorClass: "text-tw3-brand-foreground-secondary",
                            width: 16,
                            height: 16
                        })
                    ]
                }),
                image: <div className="flex justify-end items-center w-full h-full bg-tw3-background-tertiary"><div className="bg-tw3-background-primary w-[413px] h-[104px] rounded-[24px_0px_0px_24px] flex justify-center items-center"><PinHintContent size={B.LARGE}/></div></div>
            }
        ];
    })({
        isPinned,
        setShowPinOverlay: setG
    });
    const [w, setW] = V.useState(0);
    const F = D[w];
    V.useEffect(()=>{
        clear();
        setFlowCompleted(true);
    }, []);
    V.useEffect(()=>{
        if (isPinned) {
            setG(false);
        }
    }, [
        isPinned
    ]);
    e({
        event: x.ONBOARDING_COMPLETED,
        props: {
            setupType
        }
    });
    return <>{G && !isPinned && <PinHint onClose={()=>setG(false)}/>}{P.jsxs(b, {
        heading: formatMessage({
            id: "onboarding.completed.heading",
            defaultMessage: "<p>Brilliant,</p> your wallet is ready!"
        }, {
            p: (t)=><span key={Math.random()}>{t}<br/></span>
        }),
        subHeading: formatMessage({
            id: "onboarding.completed.subheading",
            defaultMessage: "Start exploring"
        }),
        confetti: <ConfettiAnimation/>,
        animation: currentFlow === f.CREATE_MNEMONIC ? <EmptyWalletAnimation/> : <WalletCreation/>,
        children: [
            <div className="flex h-[360px] rounded-5xl overflow-hidden"><div className="min-w-[466px]">{F.image}</div><div className="flex-1 min-w-[253px] bg-tw3-background-secondary pt-[59px] pl-11 pr-[56px]"><div className="flex flex-col gap-4">{P.jsx(y, {
                type: o.FOOTNOTE,
                children: F.header.toUpperCase()
            })}{P.jsx(y, {
                type: o.TITLE1,
                lineHeight: o.TITLE2,
                children: F.subHeader
            })}{P.jsx(y, {
                type: o.FOOTNOTE,
                lineHeight: o.TITLE1,
                children: F.description
            })}{F.cta}</div></div></div>,
            <div className="flex justify-center items-center mt-4"><CarouselControlWithAutoplay slideIds={D.map((t)=>t.id)} selectedSlideIndex={w} setSelectedSlideIndex={setW}/></div>,
            <div className="flex justify-end mt-12"><div className="w-[350px]">{P.jsx(s, {
                onClick: ()=>{
                    setIsPasswordVerified(false);
                    h();
                },
                theme: k.PRIMARY,
                disabled,
                children: formatMessage({
                    id: "onboarding.completed.confirm",
                    defaultMessage: "Open my wallet"
                })
            })}</div></div>
        ]
    })}</>;
};
