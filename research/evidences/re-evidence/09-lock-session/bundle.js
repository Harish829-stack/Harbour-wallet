const store = {
    dispatch () {}
};
const appSlice = {
    actions: {
        setPreventAutoTriggerBiometrics: ()=>{}
    }
};
const logger_default = {
    error () {}
};
let AUTO_LOCK_NEVER;
let DEFAULT_LOCK_TIME_IN_MINUTES;
let AUTO_LOCK_OPTIONS;
let isAutoLockEnabled;
let sanitizeLockTime;
const init_autoLock = __esmMin(()=>{
    AUTO_LOCK_NEVER = 0;
    DEFAULT_LOCK_TIME_IN_MINUTES = 5;
    AUTO_LOCK_OPTIONS = [
        1,
        5,
        10,
        15,
        30,
        60,
        0
    ];
    isAutoLockEnabled = (ae)=>ae !== 0;
    sanitizeLockTime = (ae)=>{
        if (AUTO_LOCK_OPTIONS.includes(ae)) {
            return ae;
        }
        return 10;
    };
});
class AppService {
    onApplicationBoot() {
        (async ()=>{
            await this.setToolbarText();
            if (!getAppAlreadyMigrated()) {
                const ae = await this.storageService.getLegacyStore();
                if (ae && Object.keys(ae).length > 0 && ae?.store?.keyring) {
                    const pe = ae?.store?.keyring?.firstTimeOpening;
                    store.dispatch(appSlice.actions.setFirstTime(Boolean(pe)));
                    store.dispatch(appSlice.actions.setMigrationStatus(true));
                }
            }
            if (this.appIsStale()) {
                await this.deviceService.deviceSync();
                emit(QueueEvent.REGISTER_WALLET, {
                    operationType: WalletOperationType.VERSION_UPDATE
                });
                store.dispatch(appSlice.actions.setStorageVersion(this.getAppVersion()));
            }
        })().catch(logger_default.error);
    }
    async setToolbarText() {
        if ([
            "beta",
            "alpha"
        ].includes("production")) {
            await polyfill.action.setBadgeText({
                text: "production".toUpperCase()
            }).catch((ae)=>logger_default.error(ae));
        }
    }
    async lock() {
        store.dispatch(appSlice.actions.setPreventAutoTriggerBiometrics(true));
        await this.vaultService.lock();
        await sendOneTimeMessage({
            method: events$22.LOCK_CALLBACK,
            data: {}
        });
    }
    appIsStale() {
        return this.getLastStorageVersion() !== this.getAppVersion();
    }
    getAppVersion() {
        return polyfill.runtime.getManifest()?.version;
    }
    async fetchAnnouncements() {
        const deviceId = store.getState().app.deviceId;
        const pe = this.getAppVersion();
        if (!deviceId || !pe) {
            return void logger_default.warn("No deviceId or appVersion found while fetching announcements");
        }
        const ye = await this.apiService.getAnnouncements(pe, deviceId);
        if (ye) {
            return objectArrayKeysToCamelCase(ye.data.announcements);
        }
    }
    setAnnouncementDisplayed(ae) {
        const deviceId = store.getState().app.deviceId;
        if (deviceId) {
            if (ae.length) {
                return this.apiService.setSeenAnnouncements(deviceId, ae);
            }
            logger_default.warn("No ids passed to setting announcement displayed");
        } else {
            logger_default.warn("No device id found while fetching announcements");
        }
    }
    getLastStorageVersion() {
        return getAppStorageVersion();
    }
}
