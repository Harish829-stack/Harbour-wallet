const Buy = ()=>{
    const [e] = I();
    const t = e.get("mode");
    const mode = t === "p2p" ? Be.P2P : Be.REGULAR;
    const isRecurringFlow = t === "recurring";
    const { enabled } = ie(ue);
    if (enabled) {
        return <BuyProvider mode={mode} isRecurringFlow={isRecurringFlow}><B><T index element=<BuySelectCrypto/>/><T path="/enter-amount" element=<BuyEnterAmount/>/><T path="/select-fiat" element=<BuySelectFiat/>/><T path="/select-crypto" element=<BuySelectCrypto/>/><T path="/select-network" element=<BuySelectNetwork/>/><T path="/select-provider" element=<BuySelectProvider/>/><T path="/select-payment-method" element=<BuySelectPaymentMethod/>/><T path="/recurring-setup" element=<RecurringBuySetup/>/></B></BuyProvider>;
    }
    return <L to={n.BUY} state={{
        showBackButton: true
    }}/>;
};
