const Page = ()=>{
    const { formatMessage } = l();
    const t = _();
    const s = g();
    return ot.jsx(b, {
        loose: true,
        altTheme: true,
        children: <M><A loose><div className="flex my-11 justify-center">{ot.jsx(de, {
            onClick: ()=>t(i.DEFAULT),
            children: ot.jsx(z, {})
        })}</div><div className="flex flex-1 relative flex-col flex-grow-0 self-center bg-tw3-background-primary border border-tw3-line-divider rounded p-0 lg-max:min-h-auto lg-max:w-min lg-max:mb-6 lg-min:h-[540px] lg-min:max-w-[925px] sm-max:!w-full">{s.state?.showBackButton && <div className="absolute -top-8 left-0 z-10">{ot.jsx(c, {
            testid: "back-navigation-button",
            size: k.SMALL,
            shape: f.ICON_SQUARE,
            theme: F.TRANSPARENT,
            noPadding: true,
            onClick: ()=>{
                t(-1);
            },
            children: <H width={24} height={24} colorClass="text-tw3-label-secondary"/>
        })}</div>}<div className="flex h-15 border-b border-tw3-line-divider space-x-8 px-6"><Pe isSelected={s.pathname.includes(i.BUY)} onClick={()=>t(i.BUY)} testid="buy-option">{formatMessage({
            id: "generic.buy"
        })}</Pe><Pe isSelected={s.pathname.includes(i.SELL)} onClick={()=>t(i.SELL)} testid="sell-option">{formatMessage({
            id: "generic.sell"
        })}</Pe></div><E><S path="/buy/:assetId?" element=<BuyCryptoTab/>/><S path="/sell/:assetId?" element=<SellCryptoTab/>/></E></div></A></M>
    });
};
