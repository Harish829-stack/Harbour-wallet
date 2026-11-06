const Sell = ()=>{
    const { enabled } = J(ae);
    if (enabled) {
        return <SellProvider>{je.jsxs(w, {
            children: [
                <C index element=<SellSelectCrypto/>/>,
                <C path="/enter-amount" element=<SellEnterAmount/>/>,
                <C path="/select-fiat" element=<SellSelectFiat/>/>,
                <C path="/select-provider" element=<SellSelectProvider/>/>,
                <C path="/select-network" element=<SellSelectNetwork/>/>
            ]
        })}</SellProvider>;
    }
    return je.jsx(j, {
        to: n.SELL,
        state: {
            showBackButton: true
        }
    });
};
