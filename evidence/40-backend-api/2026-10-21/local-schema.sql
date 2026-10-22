-- background.js bytes 15468666..15468919; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    iconUrl TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0
);

-- background.js bytes 15469010..15469925; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapCrossChainAvailable INTEGER DEFAULT 0 NOT NULL,
    isStakeAvailable INTEGER DEFAULT 0 NOT NULL,
    defaultSwapPairFromAssetID TEXT,
    defaultSwapPairToAssetID TEXT,
    defaultSwapCrossChainPairFromAssetID TEXT,
    defaultSwapCrossChainPairToAssetID TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    -- ERC-8056 / BEP-677 scaled UI amount. Defaults preserve identity behaviour
    -- for rows written before sc-137829/sc-137837 landed, and for assets the
    -- backend does not flag. Display-only; raw amounts stay canonical.
    isScaledUIAmount INTEGER NOT NULL DEFAULT 0,
    uiMultiplier TEXT,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15470016..15470352; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalStatus (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    walletID TEXT NOT NULL,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15470443..15470845; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetMessage (
    id TEXT NOT NULL PRIMARY KEY,
    assetID TEXT NOT NULL,
    messageType TEXT,
    format TEXT,
    title TEXT,
    description TEXT NOT NULL,
    imageUrl TEXT,
    alwaysShow INTEGER DEFAULT 0 NOT NULL,
    metadataType TEXT,
    linkType TEXT,
    linkUrl TEXT,
    FOREIGN KEY(assetID) REFERENCES AssetStatus(assetID) ON DELETE CASCADE
);

-- background.js bytes 15470936..15471305; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalMessage (
    walletID TEXT NOT NULL,
    messageID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    isClosed INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (walletID, messageID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,
    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE
);

-- background.js bytes 15471396..15471668; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetTicker (
    assetID TEXT NOT NULL PRIMARY KEY,
    updatedTime INTEGER NOT NULL,
    price TEXT NOT NULL,
    percentChange24h TEXT NOT NULL,
    currencyCode TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15471759..15472543; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    investedBalance TEXT,
    earnedBalance TEXT,
    energyBalance TEXT,
    bandwidthBalance TEXT,
    energyLimitBalance TEXT,
    bandwidthLimitBalance TEXT,
    reservedBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15472634..15473043; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    isScanned INTEGER NOT NULL,
    provider TEXT,
    contractSecurityNumRisks INTEGER,
    contractSecurityNumWarnings INTEGER,
    honeypotRiskNumRisks INTEGER,
    honeypotRiskNumWarnings INTEGER,
    buyTax REAL,
    sellTax REAL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15473134..15473408; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (
    assetID TEXT NOT NULL,
    itemType INTEGER NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15473500..15473724; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS EarnPortfolio (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    portfolio_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- background.js bytes 15473817..15474146; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS FeePriority (
    assetID TEXT NOT NULL PRIMARY KEY,
    priceLow TEXT NOT NULL,
    timeLow INTEGER NOT NULL,
    priceMedium TEXT NOT NULL,
    timeMedium INTEGER NOT NULL,
    priceHigh TEXT NOT NULL,
    timeHigh INTEGER NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15474239..15474458; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS HomepageCache (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- background.js bytes 15474551..15474795; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    campaign TEXT NOT NULL
);

-- background.js bytes 15474888..15475015; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    rewardsInfo TEXT NOT NULL
);

-- background.js bytes 15475108..15475288; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (
    rewardAssetId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    accumulated TEXT NOT NULL,
    unclaimed TEXT NOT NULL
);

-- background.js bytes 15475381..15475495; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (
    rewardAssetId TEXT NOT NULL,
    proof TEXT NOT NULL
);

-- background.js bytes 15475588..15476185; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfo (
    assetID TEXT NOT NULL,
    currency TEXT NOT NULL,
    provider TEXT DEFAULT NULL,
    providerUrl TEXT DEFAULT NULL,
    volume24 REAL DEFAULT 0,
    marketCap REAL DEFAULT 0,
    circulatingSupply REAL DEFAULT 0,
    totalSupply REAL DEFAULT 0,
    website TEXT DEFAULT NULL,
    explorer TEXT DEFAULT NULL,
    research TEXT DEFAULT NULL,
    shortDescription TEXT DEFAULT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, currency),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15476278..15476542; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfoLink (
    assetID TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    handle TEXT DEFAULT NULL,
    PRIMARY KEY (assetID, name),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15476635..15476760; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (
    symbol TEXT NOT NULL PRIMARY KEY,
    leverage INTEGER NOT NULL
);

-- background.js bytes 15476853..15477367; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualExchangeSymbol (
    symbol TEXT NOT NULL PRIMARY KEY,
    pair TEXT NOT NULL,
    status TEXT NOT NULL,
    baseAsset TEXT NOT NULL,
    quoteAsset TEXT NOT NULL,
    marginAsset TEXT NOT NULL,
    quantityPrecision INTEGER NOT NULL,
    baseAssetPrecision INTEGER NOT NULL,
    quotePrecision INTEGER,
    name TEXT NOT NULL,
    filtersJson TEXT NOT NULL,
    symbolSubtypes TEXT NOT NULL,
    symbolSchedule INTEGER NOT NULL,
    stepSize INTEGER NOT NULL
);

-- background.js bytes 15477460..15477581; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (
    assetCode TEXT NOT NULL PRIMARY KEY,
    logoUrl TEXT NOT NULL
);

-- background.js bytes 15477674..15477802; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (
    orderIndex INTEGER NOT NULL PRIMARY KEY,
    symbol TEXT NOT NULL
);

-- background.js bytes 15477895..15478271; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualBracketRisk (
    symbol TEXT NOT NULL,
    level INTEGER NOT NULL,
    maintenanceMarginRate REAL NOT NULL,
    notionalCap REAL NOT NULL,
    notionalFloor REAL NOT NULL,
    cumMaintenanceAmount REAL NOT NULL,
    maxOpenPosLeverage INTEGER NOT NULL,
    minOpenPosLeverage INTEGER NOT NULL,
    PRIMARY KEY (symbol, level)
);

-- background.js bytes 15478364..15478459; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (
    symbol TEXT NOT NULL PRIMARY KEY
);

-- background.js bytes 15478552..15478666; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PriceAlert (
    assetID TEXT NOT NULL PRIMARY KEY,
    enabled INTEGER NOT NULL
);

-- background.js bytes 15478759..15479000; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_available_balance TEXT NOT NULL,
    last_balance_increasing_date INTEGER,
    PRIMARY KEY (wallet_id, asset_id)
);

-- background.js bytes 15479093..15479324; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_shown_date INTEGER,
    dont_remind_me INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wallet_id, asset_id)
);

-- background.js bytes 15479417..15479608; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS SwapSelectedPair (
    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,
    fromAssetID TEXT,
    fromNetwork INTEGER,
    toAssetID TEXT,
    toNetwork INTEGER
);

-- background.js bytes 15479701..15479885; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS TokenLockerPosition (
    assetId TEXT NOT NULL,
    tokenLockerId TEXT NOT NULL,
    amount TEXT NOT NULL,
    unlockableTimestamp INTEGER NOT NULL
);

-- background.js bytes 15479978..15480052; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID);

-- background.js bytes 15480145..15480229; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID);

-- background.js bytes 15480322..15480414; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID);

-- background.js bytes 15480507..15480575; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- background.js bytes 15480668..15480745; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId);

-- background.js bytes 15480838..15480916; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId);

-- background.js bytes 15481009..15481078; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId);

-- background.js bytes 15481972..15482518; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15482609..15482851; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15483558..15483851; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalStatus (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    walletID TEXT NOT NULL,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15484062..15484253; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS SwapSelectedPair (
    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,
    fromAssetID TEXT,
    fromNetwork INTEGER,
    toAssetID TEXT,
    toNetwork INTEGER
);

-- background.js bytes 15484468..15484725; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetInfo_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    iconUrl TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0
);

-- background.js bytes 15485424..15485709; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15486352..15486692; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalStatus_new (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    walletID TEXT NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15487380..15487973; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount_new (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15489185..15489796; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapCrossChainAvailable INTEGER DEFAULT 0 NOT NULL,
    isStakeAvailable INTEGER DEFAULT 0 NOT NULL,
    defaultSwapPairFromAssetID TEXT,
    defaultSwapPairToAssetID TEXT,
    defaultSwapCrossChainPairFromAssetID TEXT,
    defaultSwapCrossChainPairToAssetID TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15490471..15490873; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetMessage (
    id TEXT NOT NULL PRIMARY KEY,
    assetID TEXT NOT NULL,
    messageType TEXT,
    format TEXT,
    title TEXT,
    description TEXT NOT NULL,
    imageUrl TEXT,
    alwaysShow INTEGER DEFAULT 0 NOT NULL,
    metadataType TEXT,
    linkType TEXT,
    linkUrl TEXT,
    FOREIGN KEY(assetID) REFERENCES AssetStatus(assetID) ON DELETE CASCADE
);

-- background.js bytes 15490966..15491040; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID);

-- background.js bytes 15491133..15491502; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalMessage (
    walletID TEXT NOT NULL,
    messageID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    isClosed INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (walletID, messageID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,
    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE
);

-- background.js bytes 15491595..15491679; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID);

-- background.js bytes 15491870..15492631; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount_new (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    investedBalance TEXT,
    earnedBalance TEXT,
    energyBalance TEXT,
    bandwidthBalance TEXT,
    energyLimitBalance TEXT,
    bandwidthLimitBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15494079..15494193; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PriceAlert (
    assetID TEXT NOT NULL PRIMARY KEY,
    enabled INTEGER NOT NULL
);

-- background.js bytes 15494408..15495196; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount_new (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    investedBalance TEXT,
    earnedBalance TEXT,
    energyBalance TEXT,
    bandwidthBalance TEXT,
    energyLimitBalance TEXT,
    bandwidthLimitBalance TEXT,
    reservedBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- background.js bytes 15496749..15497138; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    isScanned INTEGER NOT NULL,
    contractSecurityNumRisks INTEGER,
    contractSecurityNumWarnings INTEGER,
    honeypotRiskNumRisks INTEGER,
    honeypotRiskNumWarnings INTEGER,
    buyTax REAL,
    sellTax REAL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15497255..15497529; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (
    assetID TEXT NOT NULL,
    itemType INTEGER NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15497622..15497714; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID);

-- background.js bytes 15497907..15498504; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfo (
    assetID TEXT NOT NULL,
    currency TEXT NOT NULL,
    provider TEXT DEFAULT NULL,
    providerUrl TEXT DEFAULT NULL,
    volume24 REAL DEFAULT 0,
    marketCap REAL DEFAULT 0,
    circulatingSupply REAL DEFAULT 0,
    totalSupply REAL DEFAULT 0,
    website TEXT DEFAULT NULL,
    explorer TEXT DEFAULT NULL,
    research TEXT DEFAULT NULL,
    shortDescription TEXT DEFAULT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, currency),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15498621..15498885; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfoLink (
    assetID TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    handle TEXT DEFAULT NULL,
    PRIMARY KEY (assetID, name),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15499078..15499597; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    campaignUrl TEXT,
    howToUrl TEXT,
    reward TEXT NOT NULL,
    participantsNumber INTEGER NOT NULL,
    lockPeriod INTEGER NOT NULL,
    lockAssetId TEXT NOT NULL,
    rewardAssetId TEXT NOT NULL,
    canSwapReward INTEGER NOT NULL
);

-- background.js bytes 15499714..15499782; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- background.js bytes 15499875..15500059; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS TokenLockerPosition (
    assetId TEXT NOT NULL,
    tokenLockerId TEXT NOT NULL,
    amount TEXT NOT NULL,
    unlockableTimestamp INTEGER NOT NULL
);

-- background.js bytes 15500152..15500221; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId);

-- background.js bytes 15500314..15500481; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    tokenAccumulated TEXT NOT NULL,
    tokenUnclaimed TEXT NOT NULL
);

-- background.js bytes 15500574..15500754; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (
    rewardAssetId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    accumulated TEXT NOT NULL,
    unclaimed TEXT NOT NULL
);

-- background.js bytes 15500847..15500924; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId);

-- background.js bytes 15501017..15501131; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (
    rewardAssetId TEXT NOT NULL,
    proof TEXT NOT NULL
);

-- background.js bytes 15501224..15501302; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId);

-- background.js bytes 15501495..15501908; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfo_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isScanned INTEGER NOT NULL,
    provider TEXT,
    contractSecurityNumRisks INTEGER,
    contractSecurityNumWarnings INTEGER,
    honeypotRiskNumRisks INTEGER,
    honeypotRiskNumWarnings INTEGER,
    buyTax REAL,
    sellTax REAL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15502963..15503524; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign_new (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    campaignUrl TEXT,
    howToUrl TEXT,
    reward TEXT NOT NULL,
    participantsNumber INTEGER NOT NULL,
    lockPeriod INTEGER NOT NULL,
    lockAssetId TEXT NOT NULL,
    rewardAssetId TEXT NOT NULL,
    canSwapReward INTEGER NOT NULL,
    isUserEligible INTEGER NOT NULL
);

-- background.js bytes 15504627..15504695; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- background.js bytes 15504888..15505138; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetHighlights (
    assetID TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- background.js bytes 15505513..15505757; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    campaign TEXT NOT NULL
);

-- background.js bytes 15505850..15505918; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- background.js bytes 15506393..15506617; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS EarnPortfolio (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    portfolio_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- background.js bytes 15506990..15507117; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    rewardsInfo TEXT NOT NULL
);

-- background.js bytes 15507310..15507551; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_available_balance TEXT NOT NULL,
    last_balance_increasing_date INTEGER,
    PRIMARY KEY (wallet_id, asset_id)
);

-- background.js bytes 15507668..15507899; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_shown_date INTEGER,
    dont_remind_me INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wallet_id, asset_id)
);

-- background.js bytes 15508092..15508217; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (
    symbol TEXT NOT NULL PRIMARY KEY,
    leverage INTEGER NOT NULL
);

-- background.js bytes 15508335..15508849; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualExchangeSymbol (
    symbol TEXT NOT NULL PRIMARY KEY,
    pair TEXT NOT NULL,
    status TEXT NOT NULL,
    baseAsset TEXT NOT NULL,
    quoteAsset TEXT NOT NULL,
    marginAsset TEXT NOT NULL,
    quantityPrecision INTEGER NOT NULL,
    baseAssetPrecision INTEGER NOT NULL,
    quotePrecision INTEGER,
    name TEXT NOT NULL,
    filtersJson TEXT NOT NULL,
    symbolSubtypes TEXT NOT NULL,
    symbolSchedule INTEGER NOT NULL,
    stepSize INTEGER NOT NULL
);

-- background.js bytes 15508942..15509063; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (
    assetCode TEXT NOT NULL PRIMARY KEY,
    logoUrl TEXT NOT NULL
);

-- background.js bytes 15509156..15509251; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (
    symbol TEXT NOT NULL PRIMARY KEY
);

-- background.js bytes 15509344..15509472; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (
    orderIndex INTEGER NOT NULL PRIMARY KEY,
    symbol TEXT NOT NULL
);

-- background.js bytes 15509565..15509941; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualBracketRisk (
    symbol TEXT NOT NULL,
    level INTEGER NOT NULL,
    maintenanceMarginRate REAL NOT NULL,
    notionalCap REAL NOT NULL,
    notionalFloor REAL NOT NULL,
    cumMaintenanceAmount REAL NOT NULL,
    maxOpenPosLeverage INTEGER NOT NULL,
    minOpenPosLeverage INTEGER NOT NULL,
    PRIMARY KEY (symbol, level)
);

-- background.js bytes 15510137..15510356; As(Adapter,"Adapter"),As(Adapter_0,"Adapter"),As(Adapter_1,"Adapter"),As(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS HomepageCache (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- background.js bytes 37545199..37545815; Ss(Companion),As(ApprovalsDB,"ApprovalsDB",Cs,Cs,Cs,[2]),zs(sam$kotlin_Comparator$0,"sam$kotlin_Comp
CREATE TABLE Approval (
    walletId TEXT NOT NULL,
    address TEXT NOT NULL,
    chainName TEXT NOT NULL,
    chainIconUrl TEXT,
    spenderAddress TEXT NOT NULL,
    spenderName TEXT,
    spenderExplorerUrl TEXT,
    assetId TEXT NOT NULL,
    riskLevel TEXT NOT NULL,
    isUnlimited INTEGER NOT NULL,
    allowanceAmount TEXT,
    allowanceAmountInCurrency TEXT,
    allowanceCurrencyCode TEXT,
    pendingTimestamp INTEGER,
    pendingTransactionHash TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (walletId, address, spenderAddress, assetId)
);

-- background.js bytes 37546560..37547194; Ss(Companion),As(ApprovalsDB,"ApprovalsDB",Cs,Cs,Cs,[2]),zs(sam$kotlin_Comparator$0,"sam$kotlin_Comp
CREATE TABLE IF NOT EXISTS Approval_new (
    walletId TEXT NOT NULL,
    address TEXT NOT NULL,
    chainName TEXT NOT NULL,
    chainIconUrl TEXT,
    spenderAddress TEXT NOT NULL,
    spenderName TEXT,
    spenderExplorerUrl TEXT,
    assetId TEXT NOT NULL,
    riskLevel TEXT NOT NULL,
    isUnlimited INTEGER NOT NULL,
    allowanceAmount TEXT,
    allowanceAmountInCurrency TEXT,
    allowanceCurrencyCode TEXT,
    pendingTimestamp INTEGER,
    pendingTransactionHash TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (walletId, address, spenderAddress, assetId)
);

-- background.js bytes 38443840..38444320; ls(Companion),ms(PriceAlertsDB,"PriceAlertsDB",gs,gs,gs,[2]),vs(PriceAlertsDBImpl$Schema$create$slam
CREATE TABLE PriceAlertAssets (
    assetId TEXT NOT NULL PRIMARY KEY,
    isInWatchList INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    syncStatus INTEGER NOT NULL DEFAULT 0, -- 0 = needs sync, 1 = synced
    lastStateChangeTime INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    lastFailureTime INTEGER DEFAULT NULL,
    syncAttempts INTEGER NOT NULL DEFAULT 0,
    nextRetryTime INTEGER DEFAULT NULL
);

-- background.js bytes 38444411..38444590; ls(Companion),ms(PriceAlertsDB,"PriceAlertsDB",gs,gs,gs,[2]),vs(PriceAlertsDBImpl$Schema$create$slam
CREATE TABLE PriceAlertSettings (
    id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    isEnabled INTEGER NOT NULL DEFAULT 0,
    lastSyncTimestamp INTEGER NOT NULL DEFAULT 0
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13412107..13412360; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    iconUrl TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13412451..13413366; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapCrossChainAvailable INTEGER DEFAULT 0 NOT NULL,
    isStakeAvailable INTEGER DEFAULT 0 NOT NULL,
    defaultSwapPairFromAssetID TEXT,
    defaultSwapPairToAssetID TEXT,
    defaultSwapCrossChainPairFromAssetID TEXT,
    defaultSwapCrossChainPairToAssetID TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    -- ERC-8056 / BEP-677 scaled UI amount. Defaults preserve identity behaviour
    -- for rows written before sc-137829/sc-137837 landed, and for assets the
    -- backend does not flag. Display-only; raw amounts stay canonical.
    isScaledUIAmount INTEGER NOT NULL DEFAULT 0,
    uiMultiplier TEXT,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13413457..13413793; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalStatus (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    walletID TEXT NOT NULL,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13413884..13414286; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetMessage (
    id TEXT NOT NULL PRIMARY KEY,
    assetID TEXT NOT NULL,
    messageType TEXT,
    format TEXT,
    title TEXT,
    description TEXT NOT NULL,
    imageUrl TEXT,
    alwaysShow INTEGER DEFAULT 0 NOT NULL,
    metadataType TEXT,
    linkType TEXT,
    linkUrl TEXT,
    FOREIGN KEY(assetID) REFERENCES AssetStatus(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13414377..13414746; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalMessage (
    walletID TEXT NOT NULL,
    messageID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    isClosed INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (walletID, messageID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,
    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13414837..13415109; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetTicker (
    assetID TEXT NOT NULL PRIMARY KEY,
    updatedTime INTEGER NOT NULL,
    price TEXT NOT NULL,
    percentChange24h TEXT NOT NULL,
    currencyCode TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13415200..13415984; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    investedBalance TEXT,
    earnedBalance TEXT,
    energyBalance TEXT,
    bandwidthBalance TEXT,
    energyLimitBalance TEXT,
    bandwidthLimitBalance TEXT,
    reservedBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13416075..13416484; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    isScanned INTEGER NOT NULL,
    provider TEXT,
    contractSecurityNumRisks INTEGER,
    contractSecurityNumWarnings INTEGER,
    honeypotRiskNumRisks INTEGER,
    honeypotRiskNumWarnings INTEGER,
    buyTax REAL,
    sellTax REAL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13416575..13416849; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (
    assetID TEXT NOT NULL,
    itemType INTEGER NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13416941..13417165; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS EarnPortfolio (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    portfolio_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13417258..13417587; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS FeePriority (
    assetID TEXT NOT NULL PRIMARY KEY,
    priceLow TEXT NOT NULL,
    timeLow INTEGER NOT NULL,
    priceMedium TEXT NOT NULL,
    timeMedium INTEGER NOT NULL,
    priceHigh TEXT NOT NULL,
    timeHigh INTEGER NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13417680..13417899; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS HomepageCache (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13417992..13418236; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    campaign TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13418329..13418456; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    rewardsInfo TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13418549..13418729; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (
    rewardAssetId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    accumulated TEXT NOT NULL,
    unclaimed TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13418822..13418936; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (
    rewardAssetId TEXT NOT NULL,
    proof TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13419029..13419626; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfo (
    assetID TEXT NOT NULL,
    currency TEXT NOT NULL,
    provider TEXT DEFAULT NULL,
    providerUrl TEXT DEFAULT NULL,
    volume24 REAL DEFAULT 0,
    marketCap REAL DEFAULT 0,
    circulatingSupply REAL DEFAULT 0,
    totalSupply REAL DEFAULT 0,
    website TEXT DEFAULT NULL,
    explorer TEXT DEFAULT NULL,
    research TEXT DEFAULT NULL,
    shortDescription TEXT DEFAULT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, currency),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13419719..13419983; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfoLink (
    assetID TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    handle TEXT DEFAULT NULL,
    PRIMARY KEY (assetID, name),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13420076..13420201; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (
    symbol TEXT NOT NULL PRIMARY KEY,
    leverage INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13420294..13420808; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualExchangeSymbol (
    symbol TEXT NOT NULL PRIMARY KEY,
    pair TEXT NOT NULL,
    status TEXT NOT NULL,
    baseAsset TEXT NOT NULL,
    quoteAsset TEXT NOT NULL,
    marginAsset TEXT NOT NULL,
    quantityPrecision INTEGER NOT NULL,
    baseAssetPrecision INTEGER NOT NULL,
    quotePrecision INTEGER,
    name TEXT NOT NULL,
    filtersJson TEXT NOT NULL,
    symbolSubtypes TEXT NOT NULL,
    symbolSchedule INTEGER NOT NULL,
    stepSize INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13420901..13421022; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (
    assetCode TEXT NOT NULL PRIMARY KEY,
    logoUrl TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13421115..13421243; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (
    orderIndex INTEGER NOT NULL PRIMARY KEY,
    symbol TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13421336..13421712; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualBracketRisk (
    symbol TEXT NOT NULL,
    level INTEGER NOT NULL,
    maintenanceMarginRate REAL NOT NULL,
    notionalCap REAL NOT NULL,
    notionalFloor REAL NOT NULL,
    cumMaintenanceAmount REAL NOT NULL,
    maxOpenPosLeverage INTEGER NOT NULL,
    minOpenPosLeverage INTEGER NOT NULL,
    PRIMARY KEY (symbol, level)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13421805..13421900; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (
    symbol TEXT NOT NULL PRIMARY KEY
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13421993..13422107; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PriceAlert (
    assetID TEXT NOT NULL PRIMARY KEY,
    enabled INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13422200..13422441; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_available_balance TEXT NOT NULL,
    last_balance_increasing_date INTEGER,
    PRIMARY KEY (wallet_id, asset_id)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13422534..13422765; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_shown_date INTEGER,
    dont_remind_me INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wallet_id, asset_id)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13422858..13423049; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS SwapSelectedPair (
    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,
    fromAssetID TEXT,
    fromNetwork INTEGER,
    toAssetID TEXT,
    toNetwork INTEGER
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13423142..13423326; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS TokenLockerPosition (
    assetId TEXT NOT NULL,
    tokenLockerId TEXT NOT NULL,
    amount TEXT NOT NULL,
    unlockableTimestamp INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13423419..13423493; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13423586..13423670; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13423763..13423855; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13423948..13424016; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13424109..13424186; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13424279..13424357; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13424450..13424519; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13425413..13425959; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13426050..13426292; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13426999..13427292; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalStatus (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    walletID TEXT NOT NULL,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13427503..13427694; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS SwapSelectedPair (
    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,
    fromAssetID TEXT,
    fromNetwork INTEGER,
    toAssetID TEXT,
    toNetwork INTEGER
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13427909..13428166; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetInfo_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    iconUrl TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13428865..13429150; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13429793..13430133; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalStatus_new (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    walletID TEXT NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13430821..13431414; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount_new (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13432626..13433237; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapAvailable INTEGER DEFAULT 0 NOT NULL,
    isSwapCrossChainAvailable INTEGER DEFAULT 0 NOT NULL,
    isStakeAvailable INTEGER DEFAULT 0 NOT NULL,
    defaultSwapPairFromAssetID TEXT,
    defaultSwapPairToAssetID TEXT,
    defaultSwapCrossChainPairFromAssetID TEXT,
    defaultSwapCrossChainPairToAssetID TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13433912..13434314; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetMessage (
    id TEXT NOT NULL PRIMARY KEY,
    assetID TEXT NOT NULL,
    messageType TEXT,
    format TEXT,
    title TEXT,
    description TEXT NOT NULL,
    imageUrl TEXT,
    alwaysShow INTEGER DEFAULT 0 NOT NULL,
    metadataType TEXT,
    linkType TEXT,
    linkUrl TEXT,
    FOREIGN KEY(assetID) REFERENCES AssetStatus(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13434407..13434481; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13434574..13434943; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetLocalMessage (
    walletID TEXT NOT NULL,
    messageID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    isClosed INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (walletID, messageID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,
    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13435036..13435120; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13435311..13436072; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount_new (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    investedBalance TEXT,
    earnedBalance TEXT,
    energyBalance TEXT,
    bandwidthBalance TEXT,
    energyLimitBalance TEXT,
    bandwidthLimitBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13437520..13437634; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PriceAlert (
    assetID TEXT NOT NULL PRIMARY KEY,
    enabled INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13437849..13438637; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetAccount_new (
    assetID TEXT NOT NULL,
    accountAddress TEXT NOT NULL,
    availableBalance TEXT,
    frozenBalance TEXT,
    lockedBalance TEXT,
    rewardsBalance TEXT,
    stakedBalance TEXT,
    pendingBalance TEXT,
    blockedBalance TEXT,
    claimableBalance TEXT,
    transferableBalance TEXT,
    inscribedBalance TEXT,
    dustBalance TEXT,
    investedBalance TEXT,
    earnedBalance TEXT,
    energyBalance TEXT,
    bandwidthBalance TEXT,
    energyLimitBalance TEXT,
    bandwidthLimitBalance TEXT,
    reservedBalance TEXT,
    isRegistered INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, accountAddress),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13440190..13440579; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    isScanned INTEGER NOT NULL,
    contractSecurityNumRisks INTEGER,
    contractSecurityNumWarnings INTEGER,
    honeypotRiskNumRisks INTEGER,
    honeypotRiskNumWarnings INTEGER,
    buyTax REAL,
    sellTax REAL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13440696..13440970; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (
    assetID TEXT NOT NULL,
    itemType INTEGER NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13441063..13441155; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13441348..13441945; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfo (
    assetID TEXT NOT NULL,
    currency TEXT NOT NULL,
    provider TEXT DEFAULT NULL,
    providerUrl TEXT DEFAULT NULL,
    volume24 REAL DEFAULT 0,
    marketCap REAL DEFAULT 0,
    circulatingSupply REAL DEFAULT 0,
    totalSupply REAL DEFAULT 0,
    website TEXT DEFAULT NULL,
    explorer TEXT DEFAULT NULL,
    research TEXT DEFAULT NULL,
    shortDescription TEXT DEFAULT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, currency),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13442062..13442326; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS MarketInfoLink (
    assetID TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    handle TEXT DEFAULT NULL,
    PRIMARY KEY (assetID, name),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13442519..13443038; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    campaignUrl TEXT,
    howToUrl TEXT,
    reward TEXT NOT NULL,
    participantsNumber INTEGER NOT NULL,
    lockPeriod INTEGER NOT NULL,
    lockAssetId TEXT NOT NULL,
    rewardAssetId TEXT NOT NULL,
    canSwapReward INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13443155..13443223; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13443316..13443500; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS TokenLockerPosition (
    assetId TEXT NOT NULL,
    tokenLockerId TEXT NOT NULL,
    amount TEXT NOT NULL,
    unlockableTimestamp INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13443593..13443662; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13443755..13443922; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    tokenAccumulated TEXT NOT NULL,
    tokenUnclaimed TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13444015..13444195; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (
    rewardAssetId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    accumulated TEXT NOT NULL,
    unclaimed TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13444288..13444365; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13444458..13444572; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (
    rewardAssetId TEXT NOT NULL,
    proof TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13444665..13444743; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13444936..13445349; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetSecurityInfo_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isScanned INTEGER NOT NULL,
    provider TEXT,
    contractSecurityNumRisks INTEGER,
    contractSecurityNumWarnings INTEGER,
    honeypotRiskNumRisks INTEGER,
    honeypotRiskNumWarnings INTEGER,
    buyTax REAL,
    sellTax REAL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13446404..13446965; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign_new (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    campaignUrl TEXT,
    howToUrl TEXT,
    reward TEXT NOT NULL,
    participantsNumber INTEGER NOT NULL,
    lockPeriod INTEGER NOT NULL,
    lockAssetId TEXT NOT NULL,
    rewardAssetId TEXT NOT NULL,
    canSwapReward INTEGER NOT NULL,
    isUserEligible INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13448068..13448136; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13448329..13448579; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS AssetHighlights (
    assetID TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13448954..13449198; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    campaign TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13449291..13449359; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13449834..13450058; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS EarnPortfolio (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    portfolio_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13450431..13450558; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    rewardsInfo TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13450751..13450992; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_available_balance TEXT NOT NULL,
    last_balance_increasing_date INTEGER,
    PRIMARY KEY (wallet_id, asset_id)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13451109..13451340; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_shown_date INTEGER,
    dont_remind_me INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wallet_id, asset_id)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13451533..13451658; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (
    symbol TEXT NOT NULL PRIMARY KEY,
    leverage INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13451776..13452290; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualExchangeSymbol (
    symbol TEXT NOT NULL PRIMARY KEY,
    pair TEXT NOT NULL,
    status TEXT NOT NULL,
    baseAsset TEXT NOT NULL,
    quoteAsset TEXT NOT NULL,
    marginAsset TEXT NOT NULL,
    quantityPrecision INTEGER NOT NULL,
    baseAssetPrecision INTEGER NOT NULL,
    quotePrecision INTEGER,
    name TEXT NOT NULL,
    filtersJson TEXT NOT NULL,
    symbolSubtypes TEXT NOT NULL,
    symbolSchedule INTEGER NOT NULL,
    stepSize INTEGER NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13452383..13452504; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (
    assetCode TEXT NOT NULL PRIMARY KEY,
    logoUrl TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13452597..13452692; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (
    symbol TEXT NOT NULL PRIMARY KEY
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13452785..13452913; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (
    orderIndex INTEGER NOT NULL PRIMARY KEY,
    symbol TEXT NOT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13453006..13453382; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS PerpetualBracketRisk (
    symbol TEXT NOT NULL,
    level INTEGER NOT NULL,
    maintenanceMarginRate REAL NOT NULL,
    notionalCap REAL NOT NULL,
    notionalFloor REAL NOT NULL,
    cumMaintenanceAmount REAL NOT NULL,
    maxOpenPosLeverage INTEGER NOT NULL,
    minOpenPosLeverage INTEGER NOT NULL,
    PRIMARY KEY (symbol, level)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 13453578..13453797; Te(Adapter,"Adapter"),Te(Adapter_0,"Adapter"),Te(Adapter_1,"Adapter"),Te(AssetQueries,"AssetQueries"
CREATE TABLE IF NOT EXISTS HomepageCache (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 35487949..35488565; Ce(Companion),Te(ApprovalsDB,"ApprovalsDB",Ae,Ae,Ae,[2]),je(sam$kotlin_Comparator$0,"sam$kotlin_Comp
CREATE TABLE Approval (
    walletId TEXT NOT NULL,
    address TEXT NOT NULL,
    chainName TEXT NOT NULL,
    chainIconUrl TEXT,
    spenderAddress TEXT NOT NULL,
    spenderName TEXT,
    spenderExplorerUrl TEXT,
    assetId TEXT NOT NULL,
    riskLevel TEXT NOT NULL,
    isUnlimited INTEGER NOT NULL,
    allowanceAmount TEXT,
    allowanceAmountInCurrency TEXT,
    allowanceCurrencyCode TEXT,
    pendingTimestamp INTEGER,
    pendingTransactionHash TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (walletId, address, spenderAddress, assetId)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 35489310..35489944; Ce(Companion),Te(ApprovalsDB,"ApprovalsDB",Ae,Ae,Ae,[2]),je(sam$kotlin_Comparator$0,"sam$kotlin_Comp
CREATE TABLE IF NOT EXISTS Approval_new (
    walletId TEXT NOT NULL,
    address TEXT NOT NULL,
    chainName TEXT NOT NULL,
    chainIconUrl TEXT,
    spenderAddress TEXT NOT NULL,
    spenderName TEXT,
    spenderExplorerUrl TEXT,
    assetId TEXT NOT NULL,
    riskLevel TEXT NOT NULL,
    isUnlimited INTEGER NOT NULL,
    allowanceAmount TEXT,
    allowanceAmountInCurrency TEXT,
    allowanceCurrencyCode TEXT,
    pendingTimestamp INTEGER,
    pendingTransactionHash TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (walletId, address, spenderAddress, assetId)
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 36386408..36386888; me(Companion),ge(PriceAlertsDB,"PriceAlertsDB",_e,_e,_e,[2]),pe(PriceAlertsDBImpl$Schema$create$slam
CREATE TABLE PriceAlertAssets (
    assetId TEXT NOT NULL PRIMARY KEY,
    isInWatchList INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    syncStatus INTEGER NOT NULL DEFAULT 0, -- 0 = needs sync, 1 = synced
    lastStateChangeTime INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    lastFailureTime INTEGER DEFAULT NULL,
    syncAttempts INTEGER NOT NULL DEFAULT 0,
    nextRetryTime INTEGER DEFAULT NULL
);

-- chunks/walletkit.service-C_NgWHzp.js bytes 36386979..36387158; me(Companion),ge(PriceAlertsDB,"PriceAlertsDB",_e,_e,_e,[2]),pe(PriceAlertsDBImpl$Schema$create$slam
CREATE TABLE PriceAlertSettings (
    id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    isEnabled INTEGER NOT NULL DEFAULT 0,
    lastSyncTimestamp INTEGER NOT NULL DEFAULT 0
);
