import { t as t_1 } from "./logger-BMfNJZDI.js";
import { In, Ln } from "./store-cAVdfWrK.js";
(()=>{
    try {
        const e = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
        e.SENTRY_RELEASE = {
            id: "26.41.0"
        };
        const n = (new e.Error).stack;
        if (n) {
            e._sentryDebugIds = e._sentryDebugIds || {};
            e._sentryDebugIds[n] = "0feb4206-7606-4c5d-a640-c7c10ec1d056";
            e._sentryDebugIdIdentifier = "sentry-dbid-0feb4206-7606-4c5d-a640-c7c10ec1d056";
        }
    } catch (e) {}
})();
const openInNewTab = (e)=>Ln.tabs.create({
        url: Ln.runtime.getURL(`home.html#${e || ""}`)
    });
const openExternal = (url)=>Ln.tabs.create({
        url
    });
const isPopupOpened = ()=>!!Ln.extension.getViews({
        type: "popup"
    })[0];
const isNotificationOpened = ()=>new URLSearchParams(window.location.search).get("notification") === "1";
function openSidePanel() {
    const a = Ln;
    if (In() || !a.sidebarAction?.open) {
        chrome.windows.getCurrent({
            populate: true
        }, (e)=>{
            a.sidePanel?.open({
                windowId: e.id
            });
        });
    } else {
        a.sidebarAction.open().catch((n)=>t_1.error("Error opening sidebar", n));
    }
}
async function toggleSidePanel() {
    openSidePanel();
    await async function closeSidePanel() {
        try {
            await chrome.runtime.sendMessage({
                action: "closeSidePanel"
            });
        } catch (error) {
            t_1.error("Error closing side panel", error);
        }
    }();
}
export { openSidePanel as a, openInNewTab as i, isPopupOpened as n, toggleSidePanel as o, openExternal as r, isNotificationOpened as t };
