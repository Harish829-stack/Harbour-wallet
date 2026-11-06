const init_password_service = __esmMin(()=>{
    init_dist$6();
    init_injectable_decorator();
    init_use_decorator();
    init_walletcore_service();
    init_decorateMetadata();
    init_decorate();
    _PasswordService = class PasswordService {
        hash(ae, pe, ye = _PasswordService1.DEFAULT_ITERATIONS) {
            const es = Buffer$1.from(ae, "utf8");
            return this.walletCoreService.hmacSha512(es, pe, ye, _PasswordService1.DEFAULT_BIT_KEY_LEN);
        }
        generateSalt(ae = 32) {
            const pe = new Uint8Array(ae);
            crypto.getRandomValues(pe);
            return pe;
        }
    };
    _PasswordService1 = _PasswordService;
    _PasswordService.DEFAULT_ITERATIONS = 20000;
    _PasswordService.UNLOCK_ITERATIONS = 210000;
    _PasswordService.DEFAULT_BIT_KEY_LEN = 512;
    PasswordService = _PasswordService;
    __decorate([
        Use(WalletCoreService),
        __decorateMetadata("design:type", WalletCoreService === undefined ? Object : WalletCoreService)
    ], PasswordService.prototype, "walletCoreService", undefined);
    PasswordService = _PasswordService1 = __decorate([
        Injectable()
    ], PasswordService);
});
const init_vault_service = __esmMin(()=>{
    init_logger$1();
    init_injectable_decorator();
    init_use_decorator();
    import_dist$31 = __toESM(require_dist$14(), 1);
    import_dist_browser$11 = require_dist_browser();
    init_ext_polyfill();
    init_storage_service();
    init_store();
    init_actions$11();
    init_vault_reducer();
    init_walletcore_service();
    init_password_service();
    init_unlockThrottle_service();
    init_InvalidVaultOperationException();
    init_codes$3();
    init_hex_utils();
    init_decorateMetadata();
    init_decorate();
    _VaultService = class VaultService {
        async onUpdate() {
            const ae = await this.getUnlockKey();
            if (ae) {
                try {
                    const pe = await this.getEncryptionStrategy().encrypt(ae, this.store.getState());
                    await this.storageService.set(_VaultService1.STORAGE_KEY, pe);
                } catch (error) {
                    logger_default.error(error);
                }
            }
        }
        getEncryptionStrategy() {
            return this.encryptionStrategy || import_dist$31.default;
        }
        setEncryptionStrategy(ae) {
            this.encryptionStrategy = ae;
        }
        async getPassword() {
            if (isMV3()) {
                const { password } = await polyfill.storage.session.get(_VaultService1.PASSWORD_KEY);
                return password;
            }
            return this.password;
        }
        setPassword(ae) {
            if (isMV3()) {
                return polyfill.storage.session.set({
                    [_VaultService1.PASSWORD_KEY]: ae
                });
            }
            this.password = ae;
        }
        async getUnlockKey() {
            if (isMV3()) {
                const { [_VaultService1.UNLOCK_KEY]: ae } = await polyfill.storage.session.get(_VaultService1.UNLOCK_KEY);
                return ae;
            }
            return this.unlockKey ?? undefined;
        }
        setUnlockKey(ae) {
            if (isMV3()) {
                return polyfill.storage.session.set({
                    [_VaultService1.UNLOCK_KEY]: ae
                });
            }
            this.unlockKey = ae;
        }
        clearPassword() {
            if (isMV3()) {
                return polyfill.storage.session.remove([
                    _VaultService1.PASSWORD_KEY,
                    _VaultService1.UNLOCK_KEY
                ]);
            }
            this.password = null;
            this.unlockKey = null;
        }
        deriveKey(ae, pe, ye) {
            return this.walletCoreService.decodeUIntToHex(this.passwordService.hash(ae, pe, ye));
        }
        async getPbkdf2() {
            const ae = (await this.storageService.get(_VaultService1.PBKDF2_KEY))[_VaultService1.PBKDF2_KEY];
            if (!ae?.salt) {
                throw new Error(_VaultService1.MISSING_SALT_ERROR);
            }
            return {
                salt: this.walletCoreService.encodeHexToUint(ae.salt),
                iterations: ae.iterations
            };
        }
        async exists() {
            const ae = await this.storageService.get(_VaultService1.STORAGE_KEY);
            return Boolean(ae?.[_VaultService1.STORAGE_KEY]);
        }
        async create(ae) {
            if (await this.exists()) {
                throw new InvalidVaultOperationException(FORBIDDEN_REQUEST);
            }
            const pe = this.passwordService.generateSalt();
            const ye = this.deriveKey(ae, pe, PasswordService.DEFAULT_ITERATIONS);
            const es = this.deriveKey(ae, pe, PasswordService.UNLOCK_ITERATIONS);
            await this.persistSalt(pe, PasswordService.UNLOCK_ITERATIONS);
            await this.setPassword(ye);
            await this.setUnlockKey(es);
            const ss = crypto.randomUUID();
            await this.storageService.set(_VaultService1.VAULT_ID_KEY, {
                vaultId: ss
            });
            return this.store.dispatch({
                type: Actions.INIT,
                payload: {
                    vaultId: ss,
                    walletIdsKey: StorageService.walletIdsKey(ss)
                }
            });
        }
        persistSalt(ae, iterations) {
            const ye = this.walletCoreService.decodeUIntToHex(ae);
            return this.storageService.set(_VaultService1.PBKDF2_KEY, {
                salt: ye,
                iterations
            });
        }
        async decryptVault(ae) {
            const pe = await this.storageService.get(_VaultService1.STORAGE_KEY);
            if (!pe || !pe[_VaultService1.STORAGE_KEY]) {
                throw new InvalidVaultOperationException(VAULT_IS_EMPTY);
            }
            const { salt, iterations } = await this.getPbkdf2();
            const ss = JSON.stringify(pe[_VaultService1.STORAGE_KEY]);
            const ns = [
                iterations ?? PasswordService.DEFAULT_ITERATIONS,
                PasswordService.DEFAULT_ITERATIONS,
                PasswordService.UNLOCK_ITERATIONS
            ].filter((ae, pe, ye)=>ye.indexOf(ae) === pe);
            let ts;
            for (const iterations_1 of ns){
                const vaultKey = this.deriveKey(ae, salt, iterations_1);
                try {
                    return {
                        payload: await this.getEncryptionStrategy().decrypt(vaultKey, ss),
                        salt,
                        recordedIterations: iterations,
                        iterations: iterations_1,
                        vaultKey
                    };
                } catch (error) {
                    ts = error;
                }
            }
            throw ts;
        }
        isPasswordGuessFailure(ae) {
            return !(ae instanceof InvalidVaultOperationException && ae.message === "VAULT_IS_EMPTY") && !(ae instanceof Error && ae.message === _VaultService1.MISSING_SALT_ERROR);
        }
        decryptVaultGuarded(ae) {
            return this.unlockThrottle.guard(()=>this.decryptVault(ae), (ae)=>this.isPasswordGuessFailure(ae));
        }
        async load(ae, pe = false) {
            if (pe) {
                return this.loadWithKeystoreSecret(ae);
            }
            return this.loadWithPassword(ae);
        }
        async loadWithPassword(ae) {
            const { payload, salt, recordedIterations, iterations, vaultKey } = await this.decryptVaultGuarded(ae);
            const ts = iterations === PasswordService.DEFAULT_ITERATIONS ? vaultKey : this.deriveKey(ae, salt, PasswordService.DEFAULT_ITERATIONS);
            await this.setPassword(ts);
            await this.storageService.set(_VaultService1.VAULT_ID_KEY, {
                vaultId: payload.vaultId
            });
            let rs = vaultKey;
            if (!(recordedIterations === PasswordService.UNLOCK_ITERATIONS && iterations === PasswordService.UNLOCK_ITERATIONS)) {
                const es = iterations === PasswordService.UNLOCK_ITERATIONS ? vaultKey : this.deriveKey(ae, salt, PasswordService.UNLOCK_ITERATIONS);
                try {
                    const ae = await this.getEncryptionStrategy().encrypt(es, payload);
                    const ss = this.walletCoreService.decodeUIntToHex(salt);
                    await this.storageService.setMany({
                        [_VaultService1.STORAGE_KEY]: ae,
                        [_VaultService1.PBKDF2_KEY]: {
                            salt: ss,
                            iterations: PasswordService.UNLOCK_ITERATIONS
                        }
                    });
                    rs = es;
                } catch (error) {
                    logger_default.error("Vault KDF repair failed; keeping the current gate for the next unlock", error);
                }
            }
            await this.setUnlockKey(rs);
            return this.store.dispatch({
                type: Actions.INIT,
                payload
            });
        }
        async loadWithKeystoreSecret(ae) {
            const pe = await this.resolveVaultId(ae);
            await this.setPassword(ae);
            return this.store.dispatch({
                type: Actions.INIT,
                payload: {
                    vaultId: pe,
                    walletIdsKey: StorageService.walletIdsKey(pe)
                }
            });
        }
        async resolveVaultId(ae) {
            const pe = (await this.storageService.get(_VaultService1.VAULT_ID_KEY))?.[_VaultService1.VAULT_ID_KEY]?.vaultId;
            if (pe) {
                return pe;
            }
            const ye = await this.storageService.get(_VaultService1.STORAGE_KEY);
            if (!ye || !ye[_VaultService1.STORAGE_KEY]) {
                throw new InvalidVaultOperationException(VAULT_IS_EMPTY);
            }
            const es = await this.getEncryptionStrategy().decrypt(ae, JSON.stringify(ye[_VaultService1.STORAGE_KEY]));
            await this.storageService.set(_VaultService1.VAULT_ID_KEY, {
                vaultId: es.vaultId
            });
            return es.vaultId;
        }
        async verifyPasswordAgainstVault(ae) {
            const { payload } = await this.decryptVaultGuarded(ae);
            await this.store.dispatch({
                type: Actions.INIT,
                payload
            });
        }
        getVaultData() {
            return this.store.getState();
        }
        lock() {
            return this.clearPassword();
        }
        async reset() {
            await this.clearPassword();
            return this.storageService.clear();
        }
        async migrate(ae) {
            const pe = await this.storageService.getLegacyStore();
            if (pe && Object.keys(pe).length > 0) {
                if ((await this.storageService.get(_VaultService1.MIGRATION_KEY))[_VaultService1.MIGRATION_KEY]) {
                    return void await this.purgeLegacyVaultSecret();
                }
                return await this.fetchLegacyMnemonic(ae, pe?.store?.keyring);
            }
        }
        async purgeLegacyVaultSecret() {
            try {
                const ae = (await this.storageService.getLegacyStore())?.store;
                const pe = ae?.keyring;
                if (!pe?.value?.vault) {
                    return;
                }
                delete pe.value.vault;
                await this.storageService.setLegacyStore(ae);
            } catch (error) {
                logger_default.error("Failed to purge the legacy vault secret", error);
            }
        }
        async fetchLegacyMnemonic(ae, pe) {
            if (!pe?.value?.vault) {
                return null;
            }
            const ye = this.hashLegacyPassword(ae);
            const [es] = Object.values(pe.value.vault);
            const ss = await this.getEncryptionStrategy().decrypt(ye, es);
            if (ss) {
                return ss[0].data.mnemonic;
            }
        }
        hashLegacyPassword(ae) {
            return import_dist_browser$11.keccakFromHexString(toHex(ae)).toString("hex");
        }
        migrated(ae) {
            return this.storageService.set(_VaultService1.MIGRATION_KEY, ae.toString());
        }
        async withPassword(ae) {
            const pe = await this.getPassword();
            if (!pe) {
                throw new InvalidVaultOperationException(FORBIDDEN_REQUEST);
            }
            return ae(pe);
        }
        async unlocked() {
            return !!await this.getPassword();
        }
        async verifyPassword(ae, pe = false) {
            if (!await this.unlocked()) {
                throw new Error("Invalid password state");
            }
            if ((pe ? ae : await this.hashPassword(ae)) !== await this.getPassword()) {
                throw new Error("Invalid password");
            }
        }
        async hashPassword(ae) {
            const { salt } = await this.getPbkdf2();
            return this.deriveKey(ae, salt, PasswordService.DEFAULT_ITERATIONS);
        }
        constructor(){
            this.store = new Store(vaultReducer);
            this.store.subscribe(this.onUpdate.bind(this));
        }
    };
    _VaultService1 = _VaultService;
    _VaultService.STORAGE_KEY = "trust:vault";
    _VaultService.MIGRATION_KEY = "trust:migrated";
    _VaultService.PBKDF2_KEY = "trust:pbkdf2";
    _VaultService.PASSWORD_KEY = "password";
    _VaultService.VAULT_ID_KEY = "trust:vaultId";
    _VaultService.UNLOCK_KEY = "unlockKey";
    _VaultService.MISSING_SALT_ERROR = "Missing salt for password verification";
    VaultService = _VaultService;
    __decorate([
        Use(StorageService),
        __decorateMetadata("design:type", StorageService === undefined ? Object : StorageService)
    ], VaultService.prototype, "storageService", undefined);
    __decorate([
        Use(WalletCoreService),
        __decorateMetadata("design:type", WalletCoreService === undefined ? Object : WalletCoreService)
    ], VaultService.prototype, "walletCoreService", undefined);
    __decorate([
        Use(PasswordService),
        __decorateMetadata("design:type", PasswordService === undefined ? Object : PasswordService)
    ], VaultService.prototype, "passwordService", undefined);
    __decorate([
        Use(UnlockThrottleService),
        __decorateMetadata("design:type", UnlockThrottleService === undefined ? Object : UnlockThrottleService)
    ], VaultService.prototype, "unlockThrottle", undefined);
    VaultService = _VaultService1 = __decorate([
        Injectable(),
        __decorateMetadata("design:paramtypes", [])
    ], VaultService);
});
const init_onboarding_service = __esmMin(()=>{
    init_codes$3();
    init_vault_service();
    init_injectable_decorator();
    init_use_decorator();
    init_decorateMetadata();
    init_decorate();
    OnboardingService = class OnboardingService {
        async handlePassword(ae) {
            if (!ae) {
                throw new Error(FORBIDDEN_REQUEST);
            }
            if (await this.vaultService.exists()) {
                return await this.vaultService.load(ae);
            }
            return await this.vaultService.create(ae);
        }
    };
    __decorate([
        Use(VaultService),
        __decorateMetadata("design:type", VaultService === undefined ? Object : VaultService)
    ], OnboardingService.prototype, "vaultService", undefined);
    OnboardingService = __decorate([
        Injectable()
    ], OnboardingService);
});
var init_unlockThrottle_service = __esmMin(()=>{
    init_injectable_decorator();
    init_use_decorator();
    init_storage_service();
    init_InvalidVaultOperationException();
    init_codes$3();
    init_decorateMetadata();
    init_decorate();
    EMPTY_STATE = {
        failedAttempts: 0,
        lockedUntil: 0
    };
    _UnlockThrottleService = class UnlockThrottleService {
        now() {
            return Date.now();
        }
        serialize(ae) {
            const pe = this.pending.then(ae, ae);
            this.pending = pe.then(()=>{}, ()=>{});
            return pe;
        }
        async read() {
            return (await this.storageService.get(_UnlockThrottleService1.STORAGE_KEY))[_UnlockThrottleService1.STORAGE_KEY] ?? EMPTY_STATE;
        }
        remainingMs(ae) {
            return Math.max(0, ae.lockedUntil - this.now());
        }
        async armNextLockout(ae) {
            const failedAttempts = ae.failedAttempts + 1;
            const ye = failedAttempts - _UnlockThrottleService1.FREE_ATTEMPTS;
            const lockedUntil = ye > 0 ? this.now() + Math.min(_UnlockThrottleService1.BASE_DELAY_MS * 2 ** (ye - 1), _UnlockThrottleService1.MAX_DELAY_MS) : 0;
            await this.storageService.set(_UnlockThrottleService1.STORAGE_KEY, {
                failedAttempts,
                lockedUntil
            });
        }
        lockedError(ae) {
            return new InvalidVaultOperationException(`${TOO_MANY_ATTEMPTS}:${Math.ceil(ae / 1000)}`);
        }
        async assertNotLocked() {
            const ae = this.remainingMs(await this.read());
            if (ae > 0) {
                throw this.lockedError(ae);
            }
        }
        async recordFailure() {
            await this.serialize(async ()=>{
                await this.armNextLockout(await this.read());
            });
        }
        async reset() {
            await this.serialize(()=>this.storageService.set(_UnlockThrottleService1.STORAGE_KEY, EMPTY_STATE));
        }
        async guard(ae, pe) {
            return this.serialize(async ()=>{
                const ye = await this.read();
                const es = this.remainingMs(ye);
                if (es > 0) {
                    throw this.lockedError(es);
                }
                try {
                    const pe = await ae();
                    if (!(ye.failedAttempts === 0 && ye.lockedUntil === 0)) {
                        await this.storageService.set(_UnlockThrottleService1.STORAGE_KEY, EMPTY_STATE);
                    }
                    return pe;
                } catch (error) {
                    if (pe(error)) {
                        await this.armNextLockout(ye);
                    }
                    throw error;
                }
            });
        }
        constructor(){
            this.pending = Promise.resolve();
        }
    };
    _UnlockThrottleService1 = _UnlockThrottleService;
    _UnlockThrottleService.STORAGE_KEY = "trust:unlock-throttle";
    _UnlockThrottleService.FREE_ATTEMPTS = 5;
    _UnlockThrottleService.BASE_DELAY_MS = 5000;
    _UnlockThrottleService.MAX_DELAY_MS = 300000;
    UnlockThrottleService = _UnlockThrottleService;
    __decorate([
        Use(StorageService),
        __decorateMetadata("design:type", StorageService === undefined ? Object : StorageService)
    ], UnlockThrottleService.prototype, "storageService", undefined);
    UnlockThrottleService = _UnlockThrottleService1 = __decorate([
        Injectable()
    ], UnlockThrottleService);
});
var require_dist$14 = __commonJSMin((ae, pe)=>{
    function encryptWithKey(ae, pe) {
        const ye = JSON.stringify(pe);
        const es = Buffer$1.from(ye, "utf-8");
        const ss = global.crypto.getRandomValues(new Uint8Array(16));
        return global.crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: ss
        }, ae, es).then((ae)=>{
            const pe = new Uint8Array(ae);
            const ye = Buffer$1.from(ss).toString("base64");
            return {
                data: Buffer$1.from(pe).toString("base64"),
                iv: ye
            };
        });
    }
    function decryptWithKey(ae, pe) {
        const ye = Buffer$1.from(pe.data, "base64");
        const es = Buffer$1.from(pe.iv, "base64");
        return crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: es
        }, ae, ye).then((ae)=>{
            const pe = new Uint8Array(ae);
            const ye = Buffer$1.from(pe).toString("utf-8");
            return JSON.parse(ye);
        }).catch((ae)=>{
            throw new Error("Incorrect password");
        });
    }
    function keyFromPassword(ae, pe) {
        const ye = Buffer$1.from(ae, "utf-8");
        const es = Buffer$1.from(pe, "base64");
        return global.crypto.subtle.importKey("raw", ye, {
            name: "PBKDF2"
        }, false, [
            "deriveBits",
            "deriveKey"
        ]).then((ae)=>global.crypto.subtle.deriveKey({
                name: "PBKDF2",
                salt: es,
                iterations: 10000,
                hash: "SHA-256"
            }, ae, {
                name: "AES-GCM",
                length: 256
            }, false, [
                "encrypt",
                "decrypt"
            ]));
    }
    function unprefixedHex(ae) {
        let pe = ae.toString(16);
        while(pe.length < 2){
            pe = `0${pe}`;
        }
        return pe;
    }
    function generateSalt(ae = 32) {
        const pe = new Uint8Array(ae);
        global.crypto.getRandomValues(pe);
        return btoa(String.fromCharCode.apply(null, pe));
    }
    init_dist$6();
    init_dist$8();
    pe.exports = {
        encrypt: function encrypt(ae, pe) {
            const ye = generateSalt();
            return keyFromPassword(ae, ye).then((ae)=>encryptWithKey(ae, pe)).then((ae)=>{
                ae.salt = ye;
                return JSON.stringify(ae);
            });
        },
        decrypt: function decrypt(ae, pe) {
            const ye = JSON.parse(pe);
            const { salt } = ye;
            return keyFromPassword(ae, salt).then((ae)=>decryptWithKey(ae, ye));
        },
        keyFromPassword,
        encryptWithKey,
        decryptWithKey,
        serializeBufferForStorage: function serializeBufferForStorage(ae) {
            let pe = "0x";
            const ye = ae.length || ae.byteLength;
            for(let es = 0; es < ye; es++){
                pe += unprefixedHex(ae[es]);
            }
            return pe;
        },
        serializeBufferFromStorage: function serializeBufferFromStorage(ae) {
            const pe = ae.slice(0, 2) === "0x" ? ae.slice(2) : ae;
            const ye = new Uint8Array(pe.length / 2);
            for(let es = 0; es < pe.length; es += 2){
                const ae = pe.substr(es, 2);
                ye[es / 2] = parseInt(ae, 16);
            }
            return ye;
        },
        generateSalt
    };
});
var require_dist$14 = __commonJSMin((ae, pe)=>{
    function encryptWithKey(ae, pe) {
        const ye = JSON.stringify(pe);
        const es = Buffer$1.from(ye, "utf-8");
        const ss = global.crypto.getRandomValues(new Uint8Array(16));
        return global.crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: ss
        }, ae, es).then((ae)=>{
            const pe = new Uint8Array(ae);
            const ye = Buffer$1.from(ss).toString("base64");
            return {
                data: Buffer$1.from(pe).toString("base64"),
                iv: ye
            };
        });
    }
    function decryptWithKey(ae, pe) {
        const ye = Buffer$1.from(pe.data, "base64");
        const es = Buffer$1.from(pe.iv, "base64");
        return crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: es
        }, ae, ye).then((ae)=>{
            const pe = new Uint8Array(ae);
            const ye = Buffer$1.from(pe).toString("utf-8");
            return JSON.parse(ye);
        }).catch((ae)=>{
            throw new Error("Incorrect password");
        });
    }
    function keyFromPassword(ae, pe) {
        const ye = Buffer$1.from(ae, "utf-8");
        const es = Buffer$1.from(pe, "base64");
        return global.crypto.subtle.importKey("raw", ye, {
            name: "PBKDF2"
        }, false, [
            "deriveBits",
            "deriveKey"
        ]).then((ae)=>global.crypto.subtle.deriveKey({
                name: "PBKDF2",
                salt: es,
                iterations: 10000,
                hash: "SHA-256"
            }, ae, {
                name: "AES-GCM",
                length: 256
            }, false, [
                "encrypt",
                "decrypt"
            ]));
    }
    function unprefixedHex(ae) {
        let pe = ae.toString(16);
        while(pe.length < 2){
            pe = `0${pe}`;
        }
        return pe;
    }
    function generateSalt(ae = 32) {
        const pe = new Uint8Array(ae);
        global.crypto.getRandomValues(pe);
        return btoa(String.fromCharCode.apply(null, pe));
    }
    init_dist$6();
    init_dist$8();
    pe.exports = {
        encrypt: function encrypt(ae, pe) {
            const ye = generateSalt();
            return keyFromPassword(ae, ye).then((ae)=>encryptWithKey(ae, pe)).then((ae)=>{
                ae.salt = ye;
                return JSON.stringify(ae);
            });
        },
        decrypt: function decrypt(ae, pe) {
            const ye = JSON.parse(pe);
            const { salt } = ye;
            return keyFromPassword(ae, salt).then((ae)=>decryptWithKey(ae, ye));
        },
        keyFromPassword,
        encryptWithKey,
        decryptWithKey,
        serializeBufferForStorage: function serializeBufferForStorage(ae) {
            let pe = "0x";
            const ye = ae.length || ae.byteLength;
            for(let es = 0; es < ye; es++){
                pe += unprefixedHex(ae[es]);
            }
            return pe;
        },
        serializeBufferFromStorage: function serializeBufferFromStorage(ae) {
            const pe = ae.slice(0, 2) === "0x" ? ae.slice(2) : ae;
            const ye = new Uint8Array(pe.length / 2);
            for(let es = 0; es < pe.length; es += 2){
                const ae = pe.substr(es, 2);
                ye[es / 2] = parseInt(ae, 16);
            }
            return ye;
        },
        generateSalt
    };
});
