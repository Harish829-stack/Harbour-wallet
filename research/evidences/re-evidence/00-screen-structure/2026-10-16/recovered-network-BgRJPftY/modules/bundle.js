const App = ()=>{
    const e = useDisableAddCustomNetwork();
    return <D>{Ot.jsx(j, {
        index: true,
        element: <Networks/>
    })}{!e && Ot.jsx(j, {
        path: "/custom",
        element: <AddCustomNetwork/>
    })}</D>;
};
