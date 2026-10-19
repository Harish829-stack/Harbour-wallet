function MarketSentiment() {
    const { formatMessage } = ne();
    const M = dt();
    const { state, pathname } = gt();
    const assetSymbol = Tt()["*"]?.split("/")[1] ?? "BTC";
    const { data, isPending } = He({
        queryKey: [
            "marketSentiment",
            assetSymbol
        ],
        queryFn: ()=>aa.emit(Oo.FETCH_MARKET_SENTIMENT, assetSymbol),
        refetchOnWindowFocus: false,
        initialData: state?.sentiment,
        enabled: !state?.sentiment
    });
    const trackClick = function useMarketSentimentAnalytics({ pathname, assetSymbol, pageViewSource }) {
        const { trackAnalytics } = Ee();
        const L = pathname.includes(X.SOCIAL_POSTS) ? $.MARKET_SENTIMENT_POSTS : $.MARKET_SENTIMENT_ARTICLES;
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
                event: pathname.includes(X.SOCIAL_POSTS) ? G.CLICK_MARKET_SENTIMENT_POST : G.CLICK_MARKET_SENTIMENT_ARTICLE,
                props: {
                    assetSymbol: M.assetSymbol,
                    pageViewSource: L
                }
            });
        };
    }({
        pathname,
        assetSymbol,
        pageViewSource: state?.pageViewSource
    });
    return bd.jsx(vt, {
        loose: true,
        altTheme: true,
        children: bd.jsx(ut, {
            children: <Et loose><div className="flex my-11 justify-center">{bd.jsx(gs, {
                onClick: ()=>M(X.DEFAULT),
                children: bd.jsx(ma, {})
            })}</div><div className="w-[600px] mx-auto my-4"><Jn theme={Yn.INFO_ALT}>{bd.jsx(te, {
                children: formatMessage({
                    id: "market-sentiment.description.header",
                    defaultMessage: "Market Sentiment"
                })
            })}{bd.jsx(te, {
                type: Z.FOOTNOTE,
                children: formatMessage({
                    id: "market-sentiment.description.body",
                    defaultMessage: "Trust Wallet now shows market sentiment - a score that reflects how positive or negative the latest news and social discussions are about your assets. For example, if there are an equal number of positive and negative mentions, the sentiment score would be 50%."
                })
            })}</Jn></div>{isPending ? <div className="mx-auto">{bd.jsx(de, {})}</div> : <div className="flex flex-1 flex-col flex-grow-0 self-center bg-tw3-background-primary border border-tw3-line-divider rounded p-0 container"><div className="flex h-15 border-b border-tw3-line-divider space-x-8 px-6"><Kc isSelected={pathname.includes(X.NEWS_ARTICLES)} onClick={()=>M(`${X.NEWS_ARTICLES}/${assetSymbol}`, {
                    state: {
                        pageViewSource: $.MARKET_SENTIMENT_POSTS
                    }
                })} testid="news-articles-tab-button">{formatMessage({
                id: "market-sentiment.articles",
                defaultMessage: "News Articles"
            })}</Kc><Kc isSelected={pathname.includes(X.SOCIAL_POSTS)} onClick={()=>M(`${X.SOCIAL_POSTS}/${assetSymbol}`, {
                    state: {
                        pageViewSource: $.MARKET_SENTIMENT_ARTICLES
                    }
                })} testid="social-posts-tab-button">{formatMessage({
                id: "market-sentiment.posts",
                defaultMessage: "Social Posts"
            })}</Kc></div>{bd.jsxs(yt, {
                children: [
                    <Ct path="/articles/:symbol?" element=<SentimentPanel negative={data?.negative.articles} neutral={data?.neutral.articles} positive={data?.positive.articles} postType={AC.ARTICLE} trackClick={trackClick}/>/>,
                    <Ct path="/posts/:symbol?" element=<SentimentPanel negative={data?.negative.posts} neutral={data?.neutral.posts} positive={data?.positive.posts} postType={AC.POST} trackClick={trackClick}/>/>
                ]
            })}</div>}</Et>
        })
    });
}
;
const App$5 = ()=>{
    const { enabled } = Eo(FC);
    return bd.jsxs(yt, {
        children: [
            <Ct index element=<SelectAsset/>/>,
            <Ct element=<ContextLayout/>><Ct path="/:assetId" element=<Prepare/>/><Ct path="/:collectionId/:nftId" element=<Prepare/>/><Ct path="/:assetId/inscriptions" element=<Inscriptions/>/><Ct path="/:assetId/inscribe" element=<Inscribe/>/>{enabled && <Ct path="/bridge" element=<Bridge/>/>}<Ct path="/confirm" element=<Confirm/>/></Ct>
        ]
    });
};
const Receive = ()=>bd.jsxs(yt, {
        children: [
            <Ct index element=<SelectChain/>/>,
            <Ct path="/chain/:blockchainId" element=<ReceiveAsset/>/>,
            <Ct path="/:assetId" element=<ReceiveAsset/>/>
        ]
    });
const Fund = ()=>bd.jsxs(yt, {
        children: [
            <Ct index element=<FundingMethods/>/>,
            <Ct path="/cex" element=<CexFunding/>/>,
            <Ct path="/cex/:providerId" element=<CexFundingProvider/>/>,
            <Ct path="/cex/:providerId/platform" element=<CexFundingPlatform/>/>,
            <Ct path="/cex/:providerId/assets" element=<CexFundingAssets/>/>,
            <Ct path="/cex/:providerId/platform/assets" element=<CexFundingAssets/>/>,
            <Ct path="/cex/qr" element=<CexFundingQr/>/>
        ]
    });
const App$2 = ()=>bd.jsxs(yt, {
        children: [
            <Ct path="/staking" element=<StakingList/>/>,
            <Ct path="/staking/:assetId" element=<Staking/>/>,
            <Ct path="/stake/:assetId/:amount?/:validatorId?" element=<Stake/>/>,
            <Ct path="/unstake/:assetId" element=<Unstake/>/>,
            <Ct path="/redelegate/:assetId" element=<Redelegate/>/>,
            <Ct path="/compound/:assetId" element=<Compound/>/>,
            <Ct path="/claim-delegation/:assetId" element=<Claim/>/>
        ]
    });
const App$1 = ()=>bd.jsxs(yt, {
        children: [
            <Ct index element=<Settings/>/>,
            <Ct path="/help" element=<Help/>/>,
            <Ct path="/language" element=<Language/>/>,
            <Ct path="/currency" element=<Currency/>/>,
            <Ct path="/color-mode" element=<ColorMode/>/>,
            <Ct path="/preferences" element=<Preferences/>/>,
            <Ct path="/address-book" element=<AddressBook/>/>,
            <Ct path="/notifications" element=<Notifications/>/>,
            <Ct path="/security" element=<Security/>/>,
            <Ct path="/auto-lock" element=<AutoLock/>/>,
            <Ct path="/security/select-source-wallet" element=<MigrationRouteGuard><SelectSourceWallet/></MigrationRouteGuard>/>,
            <Ct path="/security/select-destination-wallet" element=<MigrationRouteGuard><SelectDestinationWallet/></MigrationRouteGuard>/>,
            <Ct path="/security/select-assets" element=<MigrationRouteGuard><SelectAssets/></MigrationRouteGuard>/>,
            <Ct path="/connections" element=<Connections/>/>,
            <Ct path="/connections-blacklist" element=<ConnectionsBlacklist/>/>,
            <Ct path="/connection/:id" element=<Connection/>/>,
            <Ct path="/wallets" element=<Wallets/>/>,
            <Ct path="/wallet/:id" element=<Wallet/>/>,
            <Ct path="/wallet/accounts/:id" element=<Accounts/>/>,
            <Ct path="/wallet/account/:walletId/:accountId" element=<Account/>/>,
            <Ct path="/developer" element=<DeveloperSettings/>/>,
            <Ct path="/developer/faucets" element=<Faucets/>/>,
            <Ct path="/utxo" element=<UtxoManagement/>/>
        ]
    });
const App = ()=>{
    const g = function useDisableStaking() {
        const g = q();
        return yd.useMemo(()=>g?.type === ar.HARDWARE, [
            g
        ]);
    }();
    const M = Pr((g)=>g.app.deviceId);
    yd.useEffect(()=>{
        z(M);
    }, [
        M
    ]);
    yd.useEffect(()=>{
        recordFirstPaintEvent({
            view: "shell",
            phase: "ui-ready"
        });
    }, []);
    yd.useEffect(()=>preloadScreensWhenIdle(), []);
    yd.useEffect(()=>{
        aa.emit(ia.APP_DISPLAYED);
        const g = Ft((g)=>{
            if (!(g.method !== ia.LOCK_CALLBACK || window.location.hash.startsWith("#/onboarding"))) {
                window.location.reload();
            }
        });
        return ()=>{
            g();
        };
    }, []);
    return <We client={$e}><Ae><InitializeCustomPeoplePropertyOnMount>{bd.jsx(ca, {
        children: <Ga><AlertDistribution/><Toasts/>{bd.jsx(hl, {
            children: <Mt><RouteTracker/><GenericErrorBoundary><UIStateProvider><ScrollPositionProvider>{bd.jsx(kt, {
                children: <ConnectionProvider><yd.Suspense fallback={bd.jsx(ya, {})}><RouteErrorBoundary>{bd.jsx(yt, {
                    children: <Ct element=<RequireLatestBrowserVersion/>><Ct element=<RequireUnlock/>><Ct path="/network/*" element=<PS/>/><Ct path="/notification" element=<RS/>/><Ct path="/send/*" element={withFlowBoundary("send", <App$5/>)}/><Ct path="/receive/*" element=<Receive/>/><Ct path="/swap/*" element={withFlowBoundary("swap", <App$3/>)}/><Ct path="/fund/*" element=<Fund/>/><Ct path="/buy/*" element={withFlowBoundary("buy", <WS/>)}/><Ct path="/sell/*" element={withFlowBoundary("sell", <HS/>)}/><Ct path="/fiat-ramps/*" element=<OS/>/>{!g && <Ct path="/earn/*" element={withFlowBoundary("earn", <App$2/>)}/>}<Ct path="/settings/*" element=<App$1/>/><Ct path="/transaction/:id" element=<KS/>/><Ct path="/collections/:collectionId" element={bd.jsx(zS, {})}/><Ct path="/collections/reported" element=<VS/>/><Ct path="/collections/:collectionId/nfts/:nftId" element=<BS/>/><Ct path="/manage-crypto" element=<FS/>/><Ct path="/approval" element=<NS/>/><Ct path="/asset/:assetId" element=<DS/>/><Ct path="/gas-station/:assetId" element={bd.jsx(jS, {})}/><Ct path="/custom-asset/*" element=<_S/>/><Ct path="/history" element=<History/>/><Ct path="/market-sentiment/*" element=<MarketSentiment/>/><Ct path="/trending-tokens/*" element=<Component/>/><Ct path="*" element=<Home/>/></Ct><Ct path="/unlock" element={withFlowBoundary("unlock", <ZS/>)}/><Ct path="/onboarding" element={withFlowBoundary("onboarding", <US/>)}/></Ct>
                })}</RouteErrorBoundary></yd.Suspense></ConnectionProvider>
            })}</ScrollPositionProvider></UIStateProvider></GenericErrorBoundary></Mt>
        })}</Ga>
    })}</InitializeCustomPeoplePropertyOnMount></Ae></We>;
};
