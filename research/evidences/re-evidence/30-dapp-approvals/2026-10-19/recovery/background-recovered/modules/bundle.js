const init_app = __esmMin(()=>{
    init_store$1();
});
let import_dist$38;
let import_lodash$15;
let getNotificationId;
let pendingApprovals;
let abandonPendingApprovals;
let safeRemoveWindow;
let getSenderOrigin;
let isInPopup;
let isExtensionUiSender;
let isVaultUnlocked;
let isRequestInternal;
let stripExternalTrustFlags;
let ASSET_HINT_METHODS;
let stripExternalAssetHint;
let showPopup;
let isNeedShowPopup;
let triggerPopup;
const init_popup = __esmMin(()=>{
    init_connection();
    init_constants$8();
    init_dapps$1();
    init_store$1();
    init_notification();
    init_ext_polyfill();
    init_logger$1();
    init_message$1();
    import_dist$38 = require_dist$15();
    init_base64$1();
    import_lodash$15 = require_lodash();
    init_app();
    getNotificationId = (ae, pe)=>encode$3(`${ae}_${pe}`);
    pendingApprovals = new Map;
    abandonPendingApprovals = async (ae, pe)=>{
        const ye = store.getState().notification ?? [];
        const es = pe === undefined ? undefined : new Set(pe);
        await Promise.all(ye.map(async (pe)=>{
            const ye = pe.id;
            if (!ye || es !== undefined && !es.has(ye)) {
                return;
            }
            const ss = pendingApprovals.get(ye);
            if (!(ae === "inline" && (ss?.hasOwnWindow ?? pe.window))) {
                if (ss) {
                    await ss.abandon();
                } else {
                    store.dispatch(notificationSlice.actions.removeNotification(ye));
                }
            }
        }));
    };
    safeRemoveWindow = async (ae)=>{
        const pe = typeof ae === "string" && /^\d+$/.test(ae) ? Number(ae) : ae;
        if (typeof pe === "number" && Number.isInteger(pe)) {
            try {
                await polyfill.windows.remove(pe);
            } catch  {}
        }
    };
    getSenderOrigin = (ae)=>{
        if (!ae) {
            return;
        }
        const ae_origin = ae.origin;
        if (ae_origin) {
            return ae_origin;
        }
        try {
            if (ae.url) {
                return new URL(ae.url).origin;
            }
            return undefined;
        } catch  {
            return;
        }
    };
    isInPopup = (ae)=>{
        const pe = getSenderOrigin(ae.remotePort?.sender);
        return !!pe && polyfill.runtime.getURL("").startsWith(pe);
    };
    isExtensionUiSender = (ae)=>{
        if (!ae || ae.id !== polyfill.runtime.id) {
            return false;
        }
        const pe = polyfill.runtime.getURL("");
        return !!ae.url && ae.url.startsWith(pe);
    };
    isVaultUnlocked = async ()=>{
        if (isMV3()) {
            try {
                const { password } = await polyfill.storage.session.get("password");
                return !!password;
            } catch (error) {
                logger_default.error("Failed to read session lock state", error);
            }
        }
        return store.getState().app.authenticated;
    };
    isRequestInternal = (ae)=>ae.params?.isInternal;
    stripExternalTrustFlags = (ae, pe)=>{
        if (pe) {
            return ae;
        }
        const ae_params = ae.params;
        if (ae_params && (ae_params.isInternal || "source" in ae_params)) {
            return {
                ...ae,
                params: {
                    ...ae_params,
                    isInternal: false,
                    source: undefined
                }
            };
        }
        return ae;
    };
    ASSET_HINT_METHODS = [
        events$20.ETH_SEND_TRANSACTION,
        events$20.ETH_SIGN_TRANSACTION
    ];
    stripExternalAssetHint = (ae, pe)=>{
        if (pe || !ASSET_HINT_METHODS.includes(ae.method)) {
            return ae;
        }
        const ae_params = ae.params;
        if (ae_params && "asset" in ae_params) {
            return {
                ...ae,
                params: {
                    ...ae_params,
                    asset: undefined
                }
            };
        }
        return ae;
    };
    showPopup = async ({ path, sender, method, params, skipWindow, keepWindowOpen, reuseWindow, onWindow })=>{
        const origin = getSenderOrigin(sender);
        if (!origin || origin === "null") {
            throw new NullOriginConnectionAttemptError("No origin");
        }
        const id = getNotificationId(origin, method);
        sender = {
            ...sender,
            origin
        };
        const cs = store.getState().notification || [];
        const us = cs.find((ae)=>ae.id === id);
        const blacklistedSites = store.getState().dapps.blacklistedSites;
        const sidePanelOpened = store.getState().app.sidePanelOpened;
        if (us) {
            try {
                if (us.window) {
                    await polyfill.windows.update(us.window.id, {
                        focused: true
                    });
                }
            } catch (error) {
                logger_default.error(error);
            }
            throw import_dist$38.ethErrors.rpc.resourceUnavailable(`Request of type '${method}' already pending for origin ${origin}. Please wait.`);
        }
        if (blacklistedSites.some((ae)=>ae.origin === origin)) {
            throw new BlacklistedConnectionAttemptError("Website blacklisted");
        }
        store.dispatch(notificationSlice.actions.updateNotification({
            id,
            method,
            sender,
            params
        }));
        let window = reuseWindow ?? cs[0]?.window;
        if (window) {
            try {
                await polyfill.windows.update(window.id, {
                    focused: true
                });
            } catch  {
                window = undefined;
            }
        }
        if (!(window || sidePanelOpened || skipWindow)) {
            window = await triggerPopup(path);
        }
        onWindow?.(window);
        store.dispatch(notificationSlice.actions.updateNotification({
            id,
            method,
            sender,
            params,
            window
        }));
        return new Promise((resolve, reject)=>{
            const removeListen = async ()=>{
                pendingApprovals.delete(id);
                ye();
                polyfill.windows.onRemoved.removeListener(onRemoveCb);
                if (!(keepWindowOpen || store.getState().notification.length !== 0)) {
                    await safeRemoveWindow(window?.id);
                }
            };
            const ye = listenOneTimeMessage(async (ye, es)=>{
                if (isExtensionUiSender(es)) {
                    if (ye.method === `${INTERNAL_MSG.notificationConfirmPrefix}${id}`) {
                        const pe = import_lodash$15.isPlainObject(ye.data.params) ? Object.values(ye.data.params) : [];
                        if (pe.length !== 0) {
                            resolve(pe[0]);
                        } else {
                            resolve(ye.data.params);
                        }
                        return void await removeListen();
                    }
                    if (ye.method === `${INTERNAL_MSG.notificationCancelPrefix}${id}`) {
                        reject(ye.data.error);
                        await removeListen();
                    }
                }
            });
            const onRemoveCb = async (ae)=>{
                if (ae === window?.id) {
                    store.dispatch(notificationSlice.actions.removeNotification(id));
                    reject(import_dist$38.ethErrors.provider.userRejectedRequest());
                    await removeListen();
                }
            };
            polyfill.windows.onRemoved.addListener(onRemoveCb);
            pendingApprovals.set(id, {
                hasOwnWindow: !!window,
                abandon: async ()=>{
                    reject(import_dist$38.ethErrors.provider.userRejectedRequest());
                    store.dispatch(notificationSlice.actions.removeNotification(id));
                    await removeListen();
                }
            });
        });
    };
    isNeedShowPopup = async (ae)=>{
        let sender = ae.remotePort?.sender;
        if (!sender) {
            logger_default.error("No sender found");
            throw import_dist$38.ethErrors.provider.unauthorized("Unattributable request: missing sender");
        }
        const ye = isInPopup(ae);
        ae = stripExternalTrustFlags(ae, ye);
        ae = stripExternalAssetHint(ae, ye);
        const es = isRequestInternal(ae);
        if (ye && !es) {
            return;
        }
        if (!isAppInitialized()) {
            await (async (url)=>{
                const pe = (await polyfill.tabs.query({})).find((pe)=>pe.url === url);
                if (!pe || !pe.windowId || pe.index === undefined) {
                    return await polyfill.tabs.create({
                        url
                    });
                }
                try {
                    return await polyfill.tabs.highlight({
                        windowId: pe.windowId,
                        tabs: [
                            pe.index
                        ]
                    });
                } catch (error) {
                    logger_default.error("Failed to highlight tab, creating new one:", error);
                    return await polyfill.tabs.create({
                        url
                    });
                }
            })(`${polyfill.runtime.getURL("popup.html")}#/onboarding`);
            throw import_dist$38.ethErrors.provider.unauthorized("Wallet is not set up yet; complete onboarding first");
        }
        const ss = ae.params?.source;
        let reuseWindow;
        if (ss && ye && es) {
            sender = {
                ...sender,
                origin: ss.origin,
                url: ss.url,
                tab: {
                    ...sender.tab,
                    favIconUrl: ss.favIconUrl,
                    title: ss.title,
                    url: ss.url
                }
            };
        }
        if (!(ae.method === events$20.UNLOCK_POPUP || await isVaultUnlocked())) {
            await showPopup({
                path: "/notification",
                method: events$20.UNLOCK_POPUP,
                params: ae.params,
                sender,
                skipWindow: ye && es,
                keepWindowOpen: true,
                onWindow: (ae)=>{
                    reuseWindow = ae;
                }
            });
        }
        try {
            return await showPopup({
                path: "/notification",
                method: ae.method,
                params: ae.params,
                sender,
                reuseWindow,
                skipWindow: ye && es
            });
        } catch (error) {
            if (store.getState().notification.length === 0) {
                await safeRemoveWindow(reuseWindow?.id);
            }
            throw error;
        }
    };
    triggerPopup = async (ae)=>{
        const pe = await polyfill.windows.getLastFocused();
        let left;
        let top;
        try {
            if (!pe || typeof pe.top !== "number" || typeof pe.left !== "number" || typeof pe.width !== "number") {
                throw new Error;
            }
            top = pe.top;
            left = pe.left + (pe.width - 375);
        } catch (_) {
            const pe = globalThis;
            if (typeof pe.screenY === "number" && typeof pe.screenX === "number") {
                top = Math.max(pe.screenY, 0);
                left = Math.max(pe.screenX + ((pe.outerWidth ?? 375) - 375), 0);
            }
        }
        const ss = {
            url: `${polyfill.runtime.getURL("popup.html?notification=1")}#${ae}`,
            type: "popup",
            width: 375,
            height: 600
        };
        let ns;
        try {
            ns = await polyfill.windows.create({
                ...ss,
                ...left !== undefined && top !== undefined ? {
                    left,
                    top
                } : {}
            });
        } catch (error) {
            logger_default.error("Popup create with computed bounds failed; retrying with default placement", error);
            left = undefined;
            top = undefined;
            ns = await polyfill.windows.create(ss);
        }
        if (left !== undefined && ns.left !== left && pe?.state !== "fullscreen") {
            try {
                await polyfill.windows.update(ns.id, {
                    left,
                    top
                });
            } catch (error) {
                logger_default.error("Popup reposition failed; keeping the default placement", error);
            }
        }
        return ns;
    };
});
