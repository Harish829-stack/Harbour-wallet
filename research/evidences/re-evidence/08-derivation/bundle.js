const Blockchain = {};
const getBlockchainById = ()=>({});
const isFeatureEnabled = ()=>({});
const ChainDelistingExperiment = {};
const getBlockchains = ()=>[];
const import_lodash$12 = {
    uniqBy: (a)=>a
};
const SolanaAddressDerivationType = {
    DEFAULT: "default",
    PHANTOM: "phantom"
};
class DeriveSolanaAddress {
    async handle(ae) {
        const pe = getBlockchainById(Blockchain.solana);
        const ye = await this.vaultService.getPassword();
        const es = await this.keyStoreService.getHDWallet(ae, ye);
        const ss = es.getAddressForCoin(this.walletCoreService.CoinType.solana);
        const ns = es.getAddressDerivation(this.walletCoreService.CoinType.solana, this.walletCoreService.Derivation.solanaSolana);
        es.delete();
        const defaultEntry = (ae, ye = "0")=>({
                address: ss,
                balance: ye,
                type: SolanaAddressDerivationType.DEFAULT,
                symbol: pe.symbol,
                hasTransactions: ae
            });
        const phantomEntry = (ae, ye = "0")=>({
                address: ns,
                balance: ye,
                type: SolanaAddressDerivationType.PHANTOM,
                symbol: pe.symbol,
                hasTransactions: ae
            });
        let ts;
        let rs;
        try {
            [ts, rs] = await this.solanaService.hasTransactionHistory([
                ss,
                ns
            ]);
        } catch (error) {
            logger_default.warn("DeriveSolanaAddress: signature history lookup failed, falling back to Default", error);
            return {
                types: [
                    SolanaAddressDerivationType.DEFAULT
                ],
                accounts: [
                    defaultEntry(true)
                ]
            };
        }
        if (ts && rs) {
            const [ae, ye] = await Promise.all([
                this.balanceService.fetchCoinBalanceForAddress(pe, ss).then((ae)=>ae.balance).catch(()=>new Big(0)),
                this.balanceService.fetchCoinBalanceForAddress(pe, ns).then((ae)=>ae.balance).catch(()=>new Big(0))
            ]);
            return {
                types: [
                    SolanaAddressDerivationType.DEFAULT,
                    SolanaAddressDerivationType.PHANTOM
                ],
                accounts: [
                    defaultEntry(true, ae.toString()),
                    phantomEntry(true, ye.toString())
                ]
            };
        }
        if (ts) {
            return {
                types: [
                    SolanaAddressDerivationType.DEFAULT
                ],
                accounts: [
                    defaultEntry(true)
                ]
            };
        }
        if (rs) {
            return {
                types: [
                    SolanaAddressDerivationType.PHANTOM
                ],
                accounts: [
                    phantomEntry(true)
                ]
            };
        }
        return {
            types: [
                SolanaAddressDerivationType.PHANTOM
            ],
            accounts: [
                phantomEntry(false)
            ]
        };
    }
}
class WalletService {
    async onApplicationBoot() {
        (async ()=>{
            const ae = Object.values(getWallets());
            ae.forEach((ae)=>{
                if (!store.getState().wallet.balancesPerWalletAccount[ae.id]) {
                    store.dispatch(walletSlice.actions.addToBalancesArray({
                        id: ae.id
                    }));
                }
            });
            if (!(ae.length !== 1 || ae[0].name)) {
                store.dispatch(walletSlice.actions.changeWalletName({
                    id: ae[0].id,
                    name: "Mnemonic 1"
                }));
            }
            this.walletRegisterPoller.start(()=>this.registerWallet(WalletOperationType.IMPORT));
            await this.registerWallet(WalletOperationType.IMPORT);
            await this.fetchAllWalletsMeta();
            this.linkAssetsToWalletKit();
        })().catch(logger_default.error);
    }
    onApplicationShutdown() {
        this.walletRegisterPoller.stopAndRemoveListeners();
    }
    static walletTypeToPrefix(ae) {
        const pe = {
            [WalletType.HARDWARE]: RemoteWalletPrefix.M,
            [WalletType.MNEMONIC]: RemoteWalletPrefix.M,
            [WalletType.PRIVATE_KEY]: RemoteWalletPrefix.S,
            [WalletType.WATCH_ONLY]: RemoteWalletPrefix.W
        };
        if (!pe[ae]) {
            throw new Error(`Invalid wallet type ${ae}`);
        }
        return pe[ae];
    }
    getDefaultCoins() {
        return [
            this.walletCore.CoinType.aeternity,
            this.walletCore.CoinType.aion,
            this.walletCore.CoinType.binance,
            this.walletCore.CoinType.bitcoin,
            this.walletCore.CoinType.bitcoinCash,
            this.walletCore.CoinType.bitcoinGold,
            this.walletCore.CoinType.boba,
            this.walletCore.CoinType.callisto,
            this.walletCore.CoinType.cardano,
            this.walletCore.CoinType.confluxeSpace,
            this.walletCore.CoinType.cosmos,
            this.walletCore.CoinType.dash,
            this.walletCore.CoinType.decred,
            this.walletCore.CoinType.digiByte,
            this.walletCore.CoinType.dogecoin,
            this.walletCore.CoinType.eos,
            this.walletCore.CoinType.ethereum,
            this.walletCore.CoinType.ethereumClassic,
            this.walletCore.CoinType.fio,
            this.walletCore.CoinType.goChain,
            this.walletCore.CoinType.groestlcoin,
            this.walletCore.CoinType.icon,
            this.walletCore.CoinType.ioTeX,
            this.walletCore.CoinType.kava,
            this.walletCore.CoinType.kin,
            this.walletCore.CoinType.litecoin,
            this.walletCore.CoinType.mantle,
            this.walletCore.CoinType.merlin,
            this.walletCore.CoinType.metis,
            this.walletCore.CoinType.monacoin,
            this.walletCore.CoinType.nebulas,
            this.walletCore.CoinType.nuls,
            this.walletCore.CoinType.nano,
            this.walletCore.CoinType.near,
            this.walletCore.CoinType.nimiq,
            this.walletCore.CoinType.ontology,
            this.walletCore.CoinType.qtum,
            this.walletCore.CoinType.xrp,
            this.walletCore.CoinType.stellar,
            this.walletCore.CoinType.tezos,
            this.walletCore.CoinType.theta,
            this.walletCore.CoinType.thunderCore,
            this.walletCore.CoinType.neo,
            this.walletCore.CoinType.viction,
            this.walletCore.CoinType.tron,
            this.walletCore.CoinType.veChain,
            this.walletCore.CoinType.viacoin,
            this.walletCore.CoinType.wanchain,
            this.walletCore.CoinType.zcash,
            this.walletCore.CoinType.firo,
            this.walletCore.CoinType.zilliqa,
            this.walletCore.CoinType.zelcash,
            this.walletCore.CoinType.ravencoin,
            this.walletCore.CoinType.solana,
            this.walletCore.CoinType.waves,
            this.walletCore.CoinType.terra,
            this.walletCore.CoinType.terraV2,
            this.walletCore.CoinType.harmony,
            this.walletCore.CoinType.algorand,
            this.walletCore.CoinType.kusama,
            this.walletCore.CoinType.polkadot,
            this.walletCore.CoinType.filecoin,
            this.walletCore.CoinType.multiversX,
            this.walletCore.CoinType.bandChain,
            this.walletCore.CoinType.smartChainLegacy,
            this.walletCore.CoinType.smartChain,
            this.walletCore.CoinType.oasis,
            this.walletCore.CoinType.polygon,
            this.walletCore.CoinType.thorchain,
            this.walletCore.CoinType.bluzelle,
            this.walletCore.CoinType.optimism,
            this.walletCore.CoinType.arbitrum,
            this.walletCore.CoinType.ecochain,
            this.walletCore.CoinType.avalancheCChain,
            this.walletCore.CoinType.xdai,
            this.walletCore.CoinType.fantom,
            this.walletCore.CoinType.cryptoOrg,
            this.walletCore.CoinType.celo,
            this.walletCore.CoinType.ronin,
            this.walletCore.CoinType.osmosis,
            this.walletCore.CoinType.ecash,
            this.walletCore.CoinType.cronosChain,
            this.walletCore.CoinType.smartBitcoinCash,
            this.walletCore.CoinType.kuCoinCommunityChain,
            this.walletCore.CoinType.aurora,
            this.walletCore.CoinType.evmos,
            this.walletCore.CoinType.nativeEvmos,
            this.walletCore.CoinType.moonriver,
            this.walletCore.CoinType.moonbeam,
            this.walletCore.CoinType.kavaEvm,
            this.walletCore.CoinType.kaia,
            this.walletCore.CoinType.meter,
            this.walletCore.CoinType.okxchain,
            this.walletCore.CoinType.nervos,
            this.walletCore.CoinType.everscale,
            this.walletCore.CoinType.polygonzkEVM,
            this.walletCore.CoinType.aptos,
            this.walletCore.CoinType.sui,
            this.walletCore.CoinType.neutron,
            this.walletCore.CoinType.stride,
            this.walletCore.CoinType.nativeInjective,
            this.walletCore.CoinType.stargaze,
            this.walletCore.CoinType.sei,
            this.walletCore.CoinType.ton,
            this.walletCore.CoinType.opBNB,
            this.walletCore.CoinType.base,
            this.walletCore.CoinType.linea,
            this.walletCore.CoinType.greenfield,
            this.walletCore.CoinType.mantaPacific,
            this.walletCore.CoinType.nativeZetaChain,
            this.walletCore.CoinType.zetaEVM,
            this.walletCore.CoinType.tbinance,
            this.walletCore.CoinType.blast,
            this.walletCore.CoinType.scroll,
            this.walletCore.CoinType.internetComputer,
            this.walletCore.CoinType.bounceBit,
            this.walletCore.CoinType.zkLinkNova,
            this.walletCore.CoinType.zksync,
            this.walletCore.CoinType.agoric,
            this.walletCore.CoinType.neon,
            this.walletCore.CoinType.akash,
            this.walletCore.CoinType.ioTeXEVM,
            this.walletCore.CoinType.juno,
            this.walletCore.CoinType.axelar,
            this.walletCore.CoinType.sonic,
            this.walletCore.CoinType.plasma,
            this.walletCore.CoinType.monad,
            this.walletCore.CoinType.megaETH
        ];
    }
    getSupportedCoins() {
        const ae = this.blockchainService.getCoinTypesFromBlockchain();
        const pe = BlockchainService.getAllowedBlockchains().map((pe)=>ae[pe]).filter((ae)=>!!ae);
        return import_lodash$12.uniqBy([
            ...this.getDefaultCoins(),
            ...pe
        ], (ae)=>ae.value);
    }
    getMaintainedCoins() {
        return [
            this.walletCore.CoinType.bitcoin,
            this.walletCore.CoinType.ethereum,
            this.walletCore.CoinType.binance,
            this.walletCore.CoinType.dogecoin,
            this.walletCore.CoinType.cosmos,
            this.walletCore.CoinType.xrp,
            this.walletCore.CoinType.stellar,
            this.walletCore.CoinType.polkadot,
            this.walletCore.CoinType.algorand
        ];
    }
    getCurrentHardwareSupportedCoins() {
        const ae = this.blockchainService.getCoinTypesFromBlockchain();
        return {
            [SupportedLedgerApp.Ethereum]: [
                ...BlockchainService.getSupportedEvmChains()
            ].map((pe)=>ae[pe]),
            [SupportedLedgerApp.Solana]: [
                Blockchain.solana
            ].map((pe)=>ae[pe]),
            [SupportedLedgerApp.Binance]: [
                Blockchain.binance
            ].map((pe)=>ae[pe]),
            [SupportedLedgerApp.Bitcoin]: [
                Blockchain.bitcoin
            ].map((pe)=>ae[pe])
        };
    }
    getCurrentSupportedCoins() {
        const ae = this.blockchainService.getCoinTypesFromBlockchain();
        return [
            ...BlockchainService.getSupportedEvmChains(),
            Blockchain.solana,
            Blockchain.binance,
            Blockchain.aptos,
            Blockchain.tron,
            Blockchain.bitcoin,
            Blockchain.bitcoincash,
            Blockchain.litecoin,
            Blockchain.doge,
            Blockchain.dash,
            Blockchain.firo,
            Blockchain.qtum,
            Blockchain.viacoin,
            Blockchain.ravencoin,
            Blockchain.digibyte,
            Blockchain.groestlcoin,
            Blockchain.zcash,
            Blockchain.zelcash,
            Blockchain.decred,
            Blockchain.sui,
            ...BlockchainService.getSupportedCosmosChains(),
            Blockchain.ripple,
            Blockchain.tezos,
            Blockchain.algorand,
            Blockchain.cardano,
            Blockchain.ton,
            Blockchain.filecoin,
            Blockchain.harmony,
            Blockchain.multiversX,
            Blockchain.nano,
            Blockchain.near,
            Blockchain.nebulas,
            Blockchain.polkadot,
            Blockchain.stellar,
            Blockchain.waves,
            Blockchain.zilliqa,
            Blockchain.base,
            Blockchain.hyperevm,
            Blockchain.robinhoodchain,
            Blockchain.arc,
            Blockchain.kusama
        ].map((pe)=>ae[pe]);
    }
    isValidMnemonic(ae) {
        return this.walletCore.isValidMnemonic(ae);
    }
    async importMnemonic(ae) {
        if (!this.isValidMnemonic(ae)) {
            throw new Error(INVALID_MNEMONIC);
        }
        const pe = await this.vaultService.getPassword();
        const ye = this.walletCore.importMnemonicWallet(pe, ae);
        const es = crypto.randomUUID();
        const accountsPerWallet = store.getState().wallet.accountsPerWallet;
        const ns = await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).import(ye.mnemonic(), es, pe, this.getSupportedCoins());
        const ts = ns.activeAccounts.find((ae)=>ae.coin === this.walletCore.CoinType.ethereum.value);
        if (Object.values(accountsPerWallet).some((ae)=>Object.values(ae).some((ae)=>{
                const pe = ae.items[this.walletCore.CoinType.ethereum.value.toString()];
                return pe && pe.address === ts.address;
            }))) {
            await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).remove(ns.id, pe);
            throw new Error(MNEMONIC_ALREADY_EXISTS);
        }
        return {
            wallet: ns,
            mnemonic: ye.mnemonic()
        };
    }
    validatePrivateKey(ae, pe) {
        if (!ae) {
            return {
                isValid: false,
                privateKeyUint8Array: new Uint8Array
            };
        }
        const ye = ae.replace("0x", "");
        const es = this.blockchainService.getCoinTypeFromBlockchain(pe);
        const ss = this.walletCore.getCurveForCoinType(es);
        let privateKeyUint8Array = new Uint8Array;
        let isValid = false;
        if (pe === Blockchain.solana) {
            try {
                const ae = this.walletCore.decodeBase58(ye);
                if (!(ae === null || ae.length !== 32 && ae.length !== 64)) {
                    privateKeyUint8Array = ae.slice(0, 32);
                    isValid = this.walletCore.isValidPrivateKey(privateKeyUint8Array, ss);
                }
            } catch (e) {
                isValid = false;
            }
        } else {
            try {
                privateKeyUint8Array = isHex(ye) ? this.walletCore.encodeHexToUint(ye) : this.walletCore.decodeBech32(ye).slice(1);
                isValid = this.walletCore.isValidPrivateKey(privateKeyUint8Array, ss);
            } catch (e) {
                isValid = false;
            }
        }
        return {
            isValid,
            privateKeyUint8Array
        };
    }
    async importPrivateKey(ae, pe, ye) {
        const { isValid, privateKeyUint8Array } = this.validatePrivateKey(ae, pe);
        if (!isValid && !ye) {
            throw new Error(INVALID_PRIVATE_KEY);
        }
        const ns = ye || privateKeyUint8Array;
        const ts = this.blockchainService.getCoinTypeFromBlockchain(pe);
        const rs = await this.vaultService.getPassword();
        const os = crypto.randomUUID();
        const as = await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).importPrivateKey(ns, os, rs, ts);
        const accountsPerWallet = store.getState().wallet.accountsPerWallet;
        const us = as.activeAccounts[0];
        if (Object.values(accountsPerWallet).some((ae)=>Object.values(ae).some((ae)=>{
                const pe = ae.items[us.coin.toString()];
                return pe && pe.address === us.address;
            }))) {
            await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).remove(as.id, rs);
            throw new Error(PrivateKeyValidationErrors.DUPLICATED);
        }
        const ls = BlockchainService.getSupportedEvmChains();
        if (ls.includes(pe)) {
            for (const ms of ls){
                const ae = this.blockchainService.getCoinTypeFromBlockchain(ms);
                await this.keyStoreService.addAccountWithPrivateKey(as.id, privateKeyUint8Array, ae);
            }
        }
        return {
            wallet: as
        };
    }
    async create() {
        const ae = await this.vaultService.getPassword();
        return this.walletCore.generateMnemonicWallet(ae).mnemonic();
    }
    async addHardwareWallet(ae, pe) {
        const ye = getWallets();
        if (Object.keys(ye).length >= 30) {
            throw new Error("Maximum wallets amount reached");
        }
        const es = crypto.randomUUID();
        const ss = this.getCurrentHardwareSupportedCoins();
        const ns = [];
        ae.forEach(({ address, ledgerAccountIndex, publicKey, testnetAddress })=>{
            const as = crypto.randomUUID();
            const accounts = ss[pe].reduce((acc, item)=>({
                    ...acc,
                    [item.value]: {
                        address,
                        coin: item.value,
                        derivationPath: item.value === 0 ? `m/84'/0'/${ledgerAccountIndex}'/0/0` : undefined,
                        publicKey
                    }
                }), {});
            if (pe === SupportedLedgerApp.Binance && testnetAddress) {
                const ae = this.blockchainService.getCoinTypesFromBlockchain().tbinance;
                accounts[ae.value] = {
                    address: testnetAddress,
                    coin: ae.value
                };
            }
            ns.push({
                walletId: es,
                accounts,
                derivationIndex: ledgerAccountIndex,
                name: `Account ${ledgerAccountIndex + 1}`,
                accountId: as
            });
        });
        const [ts] = ns;
        store.dispatch(walletSlice.actions.addWallet({
            id: es,
            type: WalletType.HARDWARE,
            accountId: ts.accountId,
            isImported: true
        }));
        ns.forEach((ae)=>store.dispatch(walletSlice.actions.addAccounts(ae)));
        store.dispatch(walletSlice.actions.setWalletId({
            walletId: es,
            accountId: ts.accountId
        }));
        emit(QueueEvent.REFRESH_BALANCE);
        await this.fetchWalletMeta(es);
        return {
            walletId: es,
            accountId: ts.accountId
        };
    }
    async removeWallet(ae) {
        await this.vaultService.withPassword((pe)=>this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).remove(ae, pe));
        store.dispatch(walletSlice.actions.removeWallet(ae));
        const id = getActiveWalletId();
        const ye = getActiveAccountId();
        if (id) {
            await this.switchWallet({
                id
            }, ye);
            emit(QueueEvent.REFRESH_BALANCE);
        }
    }
    getDappAccount(ae) {
        return getAccounts$3()[this.blockchainService.getCoinTypesFromBlockchain()[ae].value];
    }
    async getPrivateKeyForWallet(ae, pe, ye) {
        const es = getWallet(ae);
        if (!es) {
            throw new Error("Wallet not found");
        }
        const ss = getAccountByWalletAndAccountId(ae, pe);
        if (es.type === WalletType.PRIVATE_KEY) {
            const { key } = await this.vaultService.withPassword((ae)=>this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).getKeyForCoin(es.id, ae, ye, es.type));
            this.assertKeyMatchesAccount(key, ye, ss);
            return {
                key,
                account: ss
            };
        }
        const ns = await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).getStoredKey(es.id);
        try {
            const ae = ss.derivationIndex === 0 ? (await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).getAccounts(es.id)).find(({ coin })=>coin === ye)?.derivationPath : undefined;
            const pe = await this.vaultService.withPassword(async (pe)=>{
                const es = ns.wallet(Buffer$1.from(pe));
                try {
                    const pe = this.walletCore.wrapCoinType(ye);
                    if (ae) {
                        return es.getKey(pe, ae);
                    }
                    const ns = blockchains_default.find((ae)=>ae.coinId === ye)?.derivation[0].path;
                    const ts = ns?.lastIndexOf("0");
                    const rs = `${ns?.substring(0, ts)}${ss.derivationIndex}${ns?.substring(ts + 1)}`;
                    return es.getKey(pe, rs);
                } finally{
                    es.delete();
                }
            });
            this.assertKeyMatchesAccount(pe, ye, ss);
            return {
                key: pe,
                account: ss
            };
        } finally{
            ns.delete();
        }
    }
    assertKeyMatchesAccount(ae, pe, ye) {
        const es = isEvmChainRecord(getBlockchainsByPrefixedCoinId()[`c${pe}`]) ? ye?.items?.[CoinId.Ethereum]?.address : undefined;
        const ss = ye?.items?.[pe]?.address ?? es;
        if (!ss) {
            return;
        }
        let ns;
        try {
            const ye = this.walletCore.wrapCoinType(pe);
            ns = this.walletCore.CoinTypeExt.deriveAddress(ye, ae);
        } catch (error) {
            return void logger_default.warn("assertKeyMatchesAccount: unable to derive signer address for comparison", error);
        }
        if (ns && !_WalletService1.addressesMatch(ns, ss)) {
            throw new Error(`Signing key (${ns}) does not match the account address (${ss}) [SC-156185/SC-145947]`);
        }
    }
    assertSolanaKeyMatchesAccount(ae, pe, ye) {
        this.assertKeyMatchesAccount(ae, pe, ye);
    }
    static addressesMatch(ae, pe) {
        if (ae === pe) {
            return true;
        }
        const ye = _WalletService1.canonicalizeEvmHexAddress(ae);
        const es = _WalletService1.canonicalizeEvmHexAddress(pe);
        return !!ye && ye === es;
    }
    static canonicalizeEvmHexAddress(ae) {
        const pe = ae.trim().replace(/^ronin:/i, "0x");
        if (/^0x[0-9a-fA-F]{40}$/.test(pe)) {
            return pe.toLowerCase();
        }
        return "";
    }
    async getPrivateKey(ae, pe) {
        const ye = pe?.walletId ?? getActiveWalletId();
        const es = pe?.accountId ?? getActiveAccountId();
        if (!ye) {
            throw new Error("No active wallet found");
        }
        if (!es) {
            throw new Error("No active account found");
        }
        const { key } = await this.getPrivateKeyForWallet(ye, es, ae);
        return {
            key
        };
    }
    async withPrivateKey(ae, pe, ye) {
        const { key } = ye ? await this.getPrivateKey(ae, ye) : await this.getPrivateKey(ae);
        try {
            return await pe(key);
        } finally{
            key.delete();
        }
    }
    mapAccounts(ae) {
        return ae.reduce((acc, item)=>({
                ...acc,
                [item.coin]: {
                    address: item.address,
                    coin: item.coin,
                    publicKey: item.publicKey
                }
            }), {});
    }
    async fetchAccountsForWallet(ae) {
        const pe = await this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).getAccounts(ae);
        return this.mapAccounts(pe);
    }
    getAccount(ae) {
        if (getActiveWalletId()) {
            return getAccounts$3()?.[ae];
        }
    }
    sign(ae, pe) {
        return this.walletCore.sign(ae, pe);
    }
    async getSeedPhrase(ae, pe, ye = false) {
        if (pe) {
            await this.vaultService.verifyPassword(ae, ye);
            return this.vaultService.withPassword((ae)=>this.keyStoreService.attach(this.vaultService.getVaultData().vaultId).export(pe, ae));
        }
        return null;
    }
    getWalletId(ae, pe, ye) {
        const es = store.getState().wallet?.accountsPerWallet[ae]?.[ye]?.items;
        const ss = _WalletService1.walletTypeToPrefix(pe);
        return this._getWalletId(ss, es);
    }
    _getWalletId(ae, pe) {
        const ye = Object.values(pe).filter((ae)=>this.getMaintainedCoins().map((ae)=>ae.value).includes(ae.coin));
        return `${ae}_${import_lodash$12.flow([
            (ae)=>ae.map((ae)=>ae.address.substring(ae.address.length - _WalletService1.ADDRESS_ID_SUFFIX_LEN)),
            (ae)=>ae.sort().join(""),
            (ae)=>Buffer$1.from(ae, "utf-8"),
            this.walletCore.hashSHA256.bind(this.walletCore),
            this.walletCore.decodeUIntToHex.bind(this.walletCore),
            (ae)=>ae.substring(ae.length - _WalletService1.REMOTE_ID_LEN)
        ])(ye)}`;
    }
    getAccountsOfSupportedCoins() {
        const ae = getAccounts$3();
        const pe = this.getCurrentSupportedCoins();
        return Object.keys(ae ?? {}).filter((ae)=>pe.map((ae)=>ae.value.toString()).includes(ae)).reduce((acc, key)=>({
                ...acc,
                [key]: ae[key]
            }), {});
    }
    async registerCoinAssoc(ae) {
        const pe = getActiveWallet();
        const ye = getActiveWalletAccounts();
        if (!pe || !ye) {
            return;
        }
        const es = getDeviceId();
        if (!es) {
            return;
        }
        const ss = getActiveAccountId();
        const ns = getAccount$1(ss);
        if (!ns) {
            return;
        }
        const ts = this.getAccountsOfSupportedCoins();
        const rs = this.getWalletId(pe.id, pe.type, ss);
        const os = ts[ae];
        if (!os) {
            return void logger_default.debug(`No account for coin ${ae}, skipping registration`);
        }
        if (ns.coinsRegisteredMap && ns.coinsRegisteredMap[ae]) {
            return void logger_default.debug(`Coin already registered ${ae}`);
        }
        let as;
        if (pe.type === WalletType.MNEMONIC && ns.derivationIndex > 0) {
            const ae = Object.values(store.getState().wallet.accountsPerWallet[pe.id]).find((ae)=>ae.derivationIndex === 0);
            if (ae) {
                as = this.getWalletId(pe.id, pe.type, ae.id);
            }
        }
        if ((await this.apiService.registerCoin(es, rs, os, as))?.status === 200) {
            store.dispatch(walletSlice.actions.setCoinsAsRegistered({
                walletId: pe.id,
                accountId: ss,
                records: {
                    [os.coin]: true
                }
            }));
        }
    }
    async registerWallet(ae) {
        const pe = getActiveWallet();
        const ye = getActiveWalletAccounts();
        if (!pe || !ye) {
            return void logger_default.debug("[registerWallet] No wallet or accounts found");
        }
        const es = getDeviceId();
        if (!es) {
            return void logger_default.debug("[registerWallet] No device ID found");
        }
        const ss = getActiveAccountId();
        const ns = getAccountsByAccountId(ss);
        if (ns?.registered) {
            return void logger_default.debug("[registerWallet] Account already registered", {
                accountId: ss
            });
        }
        logger_default.debug("[registerWallet] Proceeding with registration", {
            walletId: pe.id,
            accountId: ss,
            walletType: pe.type
        });
        const ts = this.getAccountsOfSupportedCoins();
        const rs = this.getWalletId(pe.id, pe.type, ss);
        let os;
        logger_default.debug("Wallet info", rs, es);
        if (pe.type === WalletType.MNEMONIC && ns.derivationIndex > 0) {
            const ae = Object.values(store.getState().wallet.accountsPerWallet[pe.id]).find((ae)=>ae.derivationIndex === 0);
            if (ae) {
                os = this.getWalletId(pe.id, pe.type, ae.id);
            }
        }
        if ((await this.apiService.registerWallet(es, rs, ts, ae, os))?.status === 200) {
            store.dispatch(walletSlice.actions.setWalletAsRegistered({
                walletId: pe.id,
                accountId: ss
            }));
            store.dispatch(walletSlice.actions.setWalletCoinsAsRegistered({
                walletId: pe.id,
                accountId: ss
            }));
        }
    }
    async fetchWalletMeta(ae) {
        const pe = getDeviceId();
        if (!pe) {
            return;
        }
        if (!getHashKey()) {
            return void logger_default.debug("Skipping wallet meta fetch: device auth not ready", {
                walletId: ae
            });
        }
        const ye = getWallet(ae);
        if (!ye) {
            return void logger_default.debug("Wallet not found", {
                walletId: ae
            });
        }
        if (ye.migrationRequired !== undefined) {
            return;
        }
        const es = store.getState().wallet.accountsPerWallet[ye.id];
        if (!es || Object.keys(es).length === 0) {
            return void logger_default.debug("No accounts found for wallet", {
                walletId: ye.id
            });
        }
        const ss = Object.keys(es)[0];
        const ns = this.getWalletId(ye.id, ye.type, ss);
        try {
            const ae = await this.apiService.getWalletMeta(pe, ns);
            if (ae?.data) {
                store.dispatch(walletSlice.actions.setMigrationRequired({
                    walletId: ye.id,
                    migrationRequired: ae.data.migrationRequired
                }));
            }
        } catch (error) {
            logger_default.debug("Failed to fetch wallet metadata for wallet", {
                walletId: ye.id,
                error
            });
        }
    }
    async fetchAllWalletsMeta() {
        if (!getDeviceId()) {
            return;
        }
        const ae = Object.values(getWallets());
        await Promise.all(ae.map((ae)=>this.fetchWalletMeta(ae.id)));
    }
    async notifyWarningDisplayed() {
        const ae = getDeviceId();
        const pe = getWarningDisplayedSent();
        if (ae && !pe) {
            try {
                if ((await this.apiService.warningDisplayed(ae)).status === 204) {
                    store.dispatch(appSlice.actions.setWarningDisplayedSent(true));
                }
            } catch (error) {
                logger_default.error(error);
            }
        }
    }
    async persistWallet(ae, accounts, type, isImported, name) {
        const ns = crypto.randomUUID();
        store.dispatch(walletSlice.actions.addWallet({
            id: ae,
            type,
            accountId: ns,
            isImported,
            name
        }));
        store.dispatch(assetSlice.actions.startWallet({
            walletId: ae
        }));
        store.dispatch(txSlice.actions.startWallet({
            walletId: ae,
            accountId: ns
        }));
        store.dispatch(walletSlice.actions.addAccounts({
            walletId: ae,
            accounts,
            accountId: ns,
            derivationIndex: 0,
            name: "Account 1"
        }));
        await this.fetchWalletMeta(ae);
        return {
            accountId: ns,
            walletId: ae
        };
    }
    async switchWallet(ae, pe) {
        store.dispatch(walletSlice.actions.setSwitching(true));
        try {
            logger_default.debug("Toggling balances");
            store.dispatch(walletSlice.actions.setWalletId({
                walletId: ae.id,
                accountId: pe
            }));
            await this.assetService.fetchAndPersistAssets();
            emit(QueueEvent.REFRESH_BALANCE);
            emit(QueueEvent.REFRESH_NFTS);
            emit(QueueEvent.BROADCAST_WALLETS_CHANGED);
        } catch (error) {
            captureException(error instanceof Error ? error : new Error(String(error)), {
                wallet: ae,
                accountId: pe
            });
            logger_default.error(error);
        } finally{
            store.dispatch(walletSlice.actions.setSwitching(false));
        }
    }
    broadcastWalletChanged(ae) {
        return Promise.all(Object.keys(ae).map(async (network)=>{
            const ye = ae[network];
            const es = await polyfill.tabs.query({});
            const ss = getActiveAccountId();
            const ns = (es ?? []).filter((ae)=>{
                if (!ae.url || !ae.id) {
                    return false;
                }
                const pe = getDAppByOrigin(new URL(ae.url).origin);
                return !!pe && getDAppConnections(pe?.id, ss).find((ae)=>ae.address === ye || ae.networkId === DAppBlockchain.cosmos);
            });
            return Promise.all(ns.map(async (ae)=>{
                if (getDAppByOrigin(new URL(ae.url).origin)) {
                    return broadcastMessageToTab(ae.id, {
                        method: events$21.ACCOUNT_CHANGED,
                        data: {
                            params: {
                                address: ye,
                                network
                            }
                        }
                    });
                }
                return null;
            }));
        }));
    }
    createWalletKitAsset(ae, pe, ye) {
        if (ae && ae.address) {
            const { address, decimals, nft, type } = ae;
            return new this.walletKitService.Asset.Token(pe, address, getTokenType(ye, type || nft?.type, {
                isEvmChain: !nft && isEvmChainRecord(getBlockchainById(ye))
            }), nft?.onChainId ? nft.onChainId : undefined, ae.symbol, decimals);
        }
        return new this.walletKitService.Asset.Coin(pe);
    }
    async createWalletKitAccount({ coinId, blockchainId, blockchain }) {
        const es = this.getAccount(blockchain?.isCustom ? this.walletCore.CoinType.ethereum.value : coinId) ?? (isEvmChainRecord(blockchain) ? this.getAccount(this.walletCore.CoinType.ethereum.value) : undefined);
        if (!es) {
            throw new Error(`Could not retrieve active account for ${blockchainId}.`);
        }
        let ss;
        if (blockchain && blockchain.isCustom) {
            const pe = {
                value: coinId
            };
            const es = BlockchainService.parsedChainId(blockchain.chainId);
            ss = new this.walletKitService.CustomChain(blockchain.id === Blockchain.tbinance ? pe : this.walletCore.CoinType.ethereum, es, "0", blockchain.symbol.toLowerCase(), blockchain?.isCustom ? this.walletCore.CoinType.ethereum.value.toString() : coinId.toString());
        } else {
            const ae = this.blockchainService.getCoinTypeFromBlockchain(blockchainId.toLowerCase());
            ss = new this.walletKitService.DefinedChain(ae);
        }
        const ns = this.formatAddressForWalletKit(es.address, blockchainId);
        return new this.walletKitService.Account(ns, this.walletCore.Derivation.default, es.publicKey ?? "", es.extendedPublicKey ?? "", es.derivationPath ?? "", ss);
    }
    getOrCreateAccountForAddress(ae, pe) {
        let ye = new this.walletKitService.DefinedChain(this.blockchainService.getCoinTypesFromBlockchain()[pe]);
        if (isCustomBlockchainId(pe)) {
            const ae = getCustomBlockchains()[pe];
            const es = BlockchainService.parsedChainId(ae.chainId);
            ye = new this.walletKitService.CustomChain(this.walletCore.CoinType.ethereum, es, "0", ae.symbol.toLowerCase(), ae.coinId.toString());
        }
        const es = this.formatAddressForWalletKit(ae, pe);
        return new this.walletKitService.Account(es, this.walletCore.Derivation.default, "", "", "", ye);
    }
    async refreshWalletContents(fullScan = false) {
        const pe = getRefreshLastRun();
        if (fullScan || !pe || Date.now() - pe > _WalletService1.WALLET_REFRESH_INTERVAL) {
            emit(QueueEvent.REFRESH_BALANCE, {
                fullScan
            });
            this.balanceService.resetBalancePoller();
            emit(QueueEvent.REFRESH_NFTS);
            this.nftService.resetNFTPoller();
            store.dispatch(walletSlice.actions.updateRefreshLastRun(Date.now()));
        }
    }
    formatAddressForWalletKit(ae, pe) {
        if (pe === Blockchain.ronin) {
            if (ae.startsWith("ronin:")) {
                const ye = this.blockchainService.getCoinTypeFromBlockchain(pe);
                const es = getAccounts$3()?.[ye.value];
                if (es?.publicKey && ae === es.address) {
                    const ae = this.walletCore.getPublicKey(es.publicKey);
                    return this.walletCore.createAddressFromPublicKey(ae, ye);
                }
                const ss = ae.replace("ronin:", "0x");
                if (!/^0x[0-9a-fA-F]{40}$/.test(ss)) {
                    throw new Error(`Invalid Ronin address: ${ae}`);
                }
                return import_dist_browser$8.toChecksumAddress(ss);
            }
            return ae;
        }
        return ae;
    }
    getAssetObject(ae) {
        const pe = getTokenType(ae.blockchainId, ae.type);
        const ye = this.getBalances(ae);
        const es = new import_trust_sdk$35.AssetInfo(ae.assetId, pe.name, ae.name, ae.symbol, ae.decimals, ae.iconUrl, false);
        let ss = getCoinId(ae.assetId, true);
        if (isCustomBlockchainId(ae.blockchainId)) {
            ss = this.walletCore.CoinType.ethereum.value;
        }
        const ns = this.getAccount(ss);
        if (!ns?.address) {
            throw new Error(`Unable to find address for ${ae.blockchainId}`);
        }
        const ts = this.getOrCreateAccountForAddress(ns.address, ae.blockchainId);
        const rs = new import_trust_sdk$35.AssetAccount(ae.assetId, ts, true, ye);
        const os = getFiat(ae.assetId);
        const as = getSelectedBaseCurrency();
        const cs = new import_trust_sdk$35.AssetTicker(ae.assetId, new Date, String(os?.price), String(os?.change_24h), as);
        return new import_trust_sdk$35.AssetObject(rs, ae.address, es, null, null, cs);
    }
    getBalances(ae) {
        const pe = getBalance$2(ae.assetId);
        if (pe) {
            return Object.entries(pe).map(([pe, ye])=>{
                let es = import_lodash$12.capitalize(pe);
                if ([
                    "bandwidth",
                    "energy"
                ].includes(pe)) {
                    return new import_trust_sdk$35.Balance(ye.amount, ye.limit, import_trust_sdk$35.BalanceType[es]);
                }
                if ([
                    "coinId",
                    "address",
                    "blockchainId"
                ].includes(pe) || isNaN(parseInt(ye))) {
                    return null;
                }
                if (pe === "balance") {
                    es = import_trust_sdk$35.BalanceType.Available.name;
                }
                const ss = import_trust_sdk$35.BalanceType[es];
                const ns = formatTokenTo(ye || 0, ae.decimals).toFixed();
                if (!ss || Big(ns).eq(0)) {
                    return null;
                }
                return new import_trust_sdk$35.Balance(ns, "", ss);
            }).filter(Boolean);
        }
        return [];
    }
    linkAssetsToWalletKit() {
        import_trust_sdk$35.FeatureModule.setAssetCache((ae)=>this.getTsdkAssets().find((pe)=>pe.info.assetID === ae) || null, (ae, pe)=>this.getTsdkAssetsForWallet(pe).find((pe)=>pe.info.assetID === ae) || null, (ae)=>this.getTsdkAssets().filter((pe)=>pe.info.name === ae), (ae)=>this.getTsdkAssets().filter((pe)=>pe.info.symbol === ae), ()=>this.getTsdkAssets(), (ae)=>this.getTsdkAssetsForWallet(ae), (ae)=>{
            const pe = getActiveWalletId();
            if (!pe) {
                return;
            }
            const item = this.convertAssetObjectToAssetV2(ae);
            store.dispatch(assetSlice.actions.setIsShownInHomeScreen({
                walletId: pe,
                item
            }));
            emit(QueueEvent.REFRESH_BALANCE);
        });
    }
    getTsdkAssetsForWallet(ae) {
        const pe = store.getState().asset?.assetsPerWallet[ae]?.itemsV2 || [];
        const ye = [];
        for (const es of pe){
            const ae = this.getAssetObject(es);
            ye.push(ae);
        }
        return ye;
    }
    convertAssetObjectToAssetV2(ae) {
        const pe = getBalance$2(ae.info.assetID)?.balance || "0";
        const ye = getPrefixedCoinId(ae.info.assetID);
        return {
            blockchainId: getBlockchainsByPrefixedCoinId()[ye]?.id || "",
            name: ae.info.name,
            address: ae.contract || undefined,
            symbol: ae.info.symbol,
            type: ae.info.type,
            decimals: Number(ae.info.decimals),
            iconUrl: ae.info.iconUrl || undefined,
            balance: pe,
            assetId: ae.info.assetID,
            isShownInHomeScreen: true,
            isRegistered: ae.account?.isRegistered
        };
    }
    getTsdkAssets() {
        const ae = getAssetsV2();
        const pe = [];
        for (const ye of ae){
            const ae = this.getAssetObject(ye);
            pe.push(ae);
        }
        return pe;
    }
    constructor(){
        this.walletRegisterPoller = new Poller({
            interval: _WalletService1.WALLET_REGISTER_POLLER
        });
    }
}
class KeyStoreService {
    setWalletCore(ae) {
        this.walletCore = ae;
    }
    attach(ae) {
        if (!this.keystore) {
            this.setStorageProvider(this.storageService.fetchKeystoreStorage(ae));
        }
        return this;
    }
    setStorageProvider(ae) {
        this.keystore = new import_dist$32.KeyStore.Default(this.walletCore, ae);
    }
    import(ae, pe, ye, es) {
        return this.keystore.import(ae, pe, ye, es, this.walletCore.StoredKeyEncryption.aes128Ctr);
    }
    importPrivateKey(ae, pe, ye, es) {
        return this.keystore.importKey(ae, pe, ye, es, this.walletCore.StoredKeyEncryption.aes128Ctr, this.walletCore.Derivation.default);
    }
    async getStoredKey(ae) {
        const pe = await this.keystore.load(ae);
        return this.keystore.mapStoredKey(pe);
    }
    async getHDWallet(ae, pe) {
        const ye = await this.getStoredKey(ae);
        try {
            return ye.wallet(Buffer$1.from(pe));
        } finally{
            ye.delete();
        }
    }
    async getAccounts(ae) {
        return (await this.keystore.load(ae)).activeAccounts.filter(Boolean);
    }
    async getKey(ae, pe, ye, es) {
        if (es === WalletType.PRIVATE_KEY) {
            const ye = await this.keystore.export(ae, pe);
            return this.walletCore.PrivateKey.createWithData(ye);
        }
        return this.keystore.getKey(ae, pe, ye);
    }
    async getKeyForCoin(ae, pe, ye, es) {
        const ss = (await this.getAccounts(ae)).find(({ coin })=>ye === coin);
        if (!ss) {
            throw new Error(`No account for coin ${ye}`);
        }
        return {
            key: await this.getKey(ae, pe, ss, es),
            account: ss
        };
    }
    async export(ae, pe) {
        if (!await this.keystore.hasWallet(ae)) {
            throw new Error(`Wallet not found ${ae}`);
        }
        return await this.keystore.export(ae, pe);
    }
    async updateAccountAddressForCoin(ae, pe) {
        const ye = await this.keystore.load(ae);
        const es = this.keystore.mapStoredKey(ye);
        try {
            es.updateAddress(pe);
        } finally{
            es.delete();
        }
    }
    addAccounts(ae, pe, ye) {
        return this.keystore.addAccounts(ae, pe, ye);
    }
    async customDerivation(ae, pe, ye, es) {
        const ss = [];
        const ns = await this.getStoredKey(ae);
        const ts = ns.wallet(Buffer$1.from(pe));
        try {
            for (const ae of ye){
                const pe = blockchains_default.find((pe)=>pe.coinId === ae.value)?.derivation[0].path;
                const ye = pe?.lastIndexOf("0");
                if (!ye) {
                    continue;
                }
                const derivationPath = `${pe?.substring(0, ye)}${es}${pe?.substring(ye + 1)}`;
                const rs = ts.getKey(ae, derivationPath);
                const os = rs.getPublicKey(ae);
                const as = this.walletCore.AnyAddress.createWithPublicKey(os, ae);
                ss.push({
                    address: as.description(),
                    derivationPath,
                    publicKey: os.description(),
                    coin: ae.value
                });
                rs.delete();
                os.delete();
                as.delete();
            }
        } finally{
            ts.delete();
            ns.delete();
        }
        return ss;
    }
    async addAccountDerivation(ae, pe, ye, es) {
        const ss = await this.getStoredKey(ae);
        const ns = ss.wallet(Buffer$1.from(pe));
        ss.removeAccountForCoin(ye);
        ss.accountForCoinDerivation(ye, es, ns);
        const ts = this.keystore.mapWallet(ss);
        ss.delete();
        ns.delete();
        await this.keystore.importWallet(ts);
    }
    async addAccountWithPrivateKey(ae, pe, ye) {
        const es = await this.getStoredKey(ae);
        const ss = this.walletCore.PrivateKey.createWithData(pe);
        const ns = ss.getPublicKey(ye);
        const ts = this.walletCore.CoinTypeExt.deriveAddress(ye, ss);
        const rs = this.walletCore.CoinTypeExt.derivationPathWithDerivation(ye, this.walletCore.Derivation.default);
        const os = ns.description();
        es.addAccount(ts, ye, rs, os, "");
        const as = this.keystore.mapWallet(es);
        es.delete();
        ss.delete();
        await this.keystore.importWallet(as);
    }
    async fixKeystoreForWallet(ae, pe) {
        const ye = await this.keystore.load(ae);
        const es = this.keystore.mapStoredKey(ye);
        try {
            const ae = Buffer$1.from(pe);
            const ye = es.fixEncryption(ae);
            const ss = es.fixAddresses(ae);
            if (ye || ss) {
                const ae = this.keystore.mapWallet(es);
                await this.keystore.importWallet(ae);
            }
        } finally{
            es.delete();
        }
    }
    remove(ae, pe) {
        return this.keystore.delete(ae, pe);
    }
}
