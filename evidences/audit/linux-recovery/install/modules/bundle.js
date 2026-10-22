let ONBOARDING_ROUTE;
let polyfill;
let logger_default;
let import_Reflect;
let bootstrap;
const SENTRY_CONTEXT = {
    BACKGROUND: 0
};
function __esmMin() {
    return {
        catch: function() {}
    };
}
function bootstrapWithMigrations() {
    return {
        catch: function() {}
    };
}
function bufferRelayStatusAlarms() {
    return {
        catch: function() {}
    };
}
function bufferSwapLegAlarms() {
    return {
        catch: function() {}
    };
}
function captureException() {
    return {
        catch: function() {}
    };
}
function flushSentry() {
    return {
        catch: function() {}
    };
}
function getDeviceId() {
    return {
        catch: function() {}
    };
}
function identifySentryUser() {
    return {
        catch: function() {}
    };
}
function initBackgroundStore() {
    return {
        catch: function() {}
    };
}
function init_app() {
    return {
        catch: function() {}
    };
}
function init_browser_service() {
    return {
        catch: function() {}
    };
}
function init_constants$6() {
    return {
        catch: function() {}
    };
}
function init_devtools() {
    return {
        catch: function() {}
    };
}
function init_ext_polyfill() {
    return {
        catch: function() {}
    };
}
function init_logger$1() {
    return {
        catch: function() {}
    };
}
function init_loggerBridge() {
    return {
        catch: function() {}
    };
}
function init_main() {
    return {
        catch: function() {}
    };
}
function init_migration() {
    return {
        catch: function() {}
    };
}
function init_registerWeb3() {
    return {
        catch: function() {}
    };
}
function init_relayStatusPoller() {
    return {
        catch: function() {}
    };
}
function init_sentry() {
    return {
        catch: function() {}
    };
}
function init_store$1() {
    return {
        catch: function() {}
    };
}
function init_swapLegAlarm() {
    return {
        catch: function() {}
    };
}
function initializeSentry() {
    return {
        catch: function() {}
    };
}
function installLoggerSentryBridge() {
    return {
        catch: function() {}
    };
}
function registerDevtools() {
    return {
        catch: function() {}
    };
}
function registerWeb3() {
    return {
        catch: function() {}
    };
}
function require_Reflect() {
    return {
        catch: function() {}
    };
}
function registerInstallListener() {
    polyfill.runtime.onInstalled.addListener((ae)=>{
        if (ae.reason === "install") {
            polyfill.tabs.create({
                url: ONBOARDING_ROUTE
            }).catch(logger_default.error);
        }
    });
}
async function init() {
    await bootstrapWithMigrations(await initBackgroundStore(), bootstrap);
    identifySentryUser(getDeviceId());
    registerDevtools().catch(logger_default.error);
}
const init_background = __esmMin(()=>{
    import_Reflect = require_Reflect();
    init_ext_polyfill();
    init_store$1();
    init_logger$1();
    init_registerWeb3();
    init_browser_service();
    init_main();
    init_migration();
    init_devtools();
    init_sentry();
    init_constants$6();
    init_loggerBridge();
    init_app();
    init_relayStatusPoller();
    init_swapLegAlarm();
    ONBOARDING_ROUTE = "/home.html#/onboarding";
    initializeSentry(SENTRY_CONTEXT.BACKGROUND);
    installLoggerSentryBridge((ae)=>captureException(ae, {
            context: "logger",
            tags: {
                source: "logger"
            }
        }));
    polyfill.runtime.onSuspend?.addListener(()=>{
        flushSentry();
    });
    BrowserService.attach();
    bufferRelayStatusAlarms();
    bufferSwapLegAlarms();
    registerInstallListener();
    registerWeb3().catch(logger_default.error);
    init().catch(logger_default.error);
});
