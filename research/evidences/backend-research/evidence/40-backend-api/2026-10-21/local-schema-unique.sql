-- DDL-01; original background.js UTF-8 bytes 15468666..15468919
CREATE TABLE IF NOT EXISTS AssetInfo (
    assetID TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    iconUrl TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0
);

-- DDL-02; original background.js UTF-8 bytes 15469010..15469925
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

-- DDL-03; original background.js UTF-8 bytes 15470016..15470352
CREATE TABLE IF NOT EXISTS AssetLocalStatus (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    walletID TEXT NOT NULL,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- DDL-04; original background.js UTF-8 bytes 15470443..15470845
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

-- DDL-05; original background.js UTF-8 bytes 15470936..15471305
CREATE TABLE IF NOT EXISTS AssetLocalMessage (
    walletID TEXT NOT NULL,
    messageID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    isClosed INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (walletID, messageID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE,
    FOREIGN KEY(messageID) REFERENCES AssetMessage(id) ON DELETE CASCADE
);

-- DDL-06; original background.js UTF-8 bytes 15471396..15471668
CREATE TABLE IF NOT EXISTS AssetTicker (
    assetID TEXT NOT NULL PRIMARY KEY,
    updatedTime INTEGER NOT NULL,
    price TEXT NOT NULL,
    percentChange24h TEXT NOT NULL,
    currencyCode TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- DDL-07; original background.js UTF-8 bytes 15471759..15472543
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

-- DDL-08; original background.js UTF-8 bytes 15472634..15473043
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

-- DDL-09; original background.js UTF-8 bytes 15473134..15473408
CREATE TABLE IF NOT EXISTS AssetSecurityInfoItem (
    assetID TEXT NOT NULL,
    itemType INTEGER NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- DDL-10; original background.js UTF-8 bytes 15473500..15473724
CREATE TABLE IF NOT EXISTS EarnPortfolio (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    portfolio_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- DDL-11; original background.js UTF-8 bytes 15473817..15474146
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

-- DDL-12; original background.js UTF-8 bytes 15474239..15474458
CREATE TABLE IF NOT EXISTS HomepageCache (
    wallet_id TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (wallet_id, currency_code)
);

-- DDL-13; original background.js UTF-8 bytes 15474551..15474795
CREATE TABLE IF NOT EXISTS LaunchpoolCampaign (
    id TEXT NOT NULL PRIMARY KEY,
    tokenLockerId TEXT NOT NULL,
    groupId INTEGER NOT NULL,
    timeStart INTEGER NOT NULL,
    timeEnd INTEGER NOT NULL,
    campaign TEXT NOT NULL
);

-- DDL-14; original background.js UTF-8 bytes 15474888..15475015
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    rewardsInfo TEXT NOT NULL
);

-- DDL-15; original background.js UTF-8 bytes 15475108..15475288
CREATE TABLE IF NOT EXISTS LaunchpoolRewardItem (
    rewardAssetId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    accumulated TEXT NOT NULL,
    unclaimed TEXT NOT NULL
);

-- DDL-16; original background.js UTF-8 bytes 15475381..15475495
CREATE TABLE IF NOT EXISTS LaunchpoolRewardProof (
    rewardAssetId TEXT NOT NULL,
    proof TEXT NOT NULL
);

-- DDL-17; original background.js UTF-8 bytes 15475588..15476185
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

-- DDL-18; original background.js UTF-8 bytes 15476278..15476542
CREATE TABLE IF NOT EXISTS MarketInfoLink (
    assetID TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    handle TEXT DEFAULT NULL,
    PRIMARY KEY (assetID, name),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- DDL-19; original background.js UTF-8 bytes 15476635..15476760
CREATE TABLE IF NOT EXISTS PerpetualUserLeverage (
    symbol TEXT NOT NULL PRIMARY KEY,
    leverage INTEGER NOT NULL
);

-- DDL-20; original background.js UTF-8 bytes 15476853..15477367
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

-- DDL-21; original background.js UTF-8 bytes 15477460..15477581
CREATE TABLE IF NOT EXISTS PerpetualAssetIcon (
    assetCode TEXT NOT NULL PRIMARY KEY,
    logoUrl TEXT NOT NULL
);

-- DDL-22; original background.js UTF-8 bytes 15477674..15477802
CREATE TABLE IF NOT EXISTS PerpetualOrderedSymbol (
    orderIndex INTEGER NOT NULL PRIMARY KEY,
    symbol TEXT NOT NULL
);

-- DDL-23; original background.js UTF-8 bytes 15477895..15478271
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

-- DDL-24; original background.js UTF-8 bytes 15478364..15478459
CREATE TABLE IF NOT EXISTS PerpetualFavoriteSymbol (
    symbol TEXT NOT NULL PRIMARY KEY
);

-- DDL-25; original background.js UTF-8 bytes 15478552..15478666
CREATE TABLE IF NOT EXISTS PriceAlert (
    assetID TEXT NOT NULL PRIMARY KEY,
    enabled INTEGER NOT NULL
);

-- DDL-26; original background.js UTF-8 bytes 15478759..15479000
CREATE TABLE IF NOT EXISTS StablecoinBalanceChange (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_available_balance TEXT NOT NULL,
    last_balance_increasing_date INTEGER,
    PRIMARY KEY (wallet_id, asset_id)
);

-- DDL-27; original background.js UTF-8 bytes 15479093..15479324
CREATE TABLE IF NOT EXISTS StablecoinPopupStatus (
    wallet_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_shown_date INTEGER,
    dont_remind_me INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wallet_id, asset_id)
);

-- DDL-28; original background.js UTF-8 bytes 15479417..15479608
CREATE TABLE IF NOT EXISTS SwapSelectedPair (
    id INTEGER DEFAULT 1 NOT NULL PRIMARY KEY,
    fromAssetID TEXT,
    fromNetwork INTEGER,
    toAssetID TEXT,
    toNetwork INTEGER
);

-- DDL-29; original background.js UTF-8 bytes 15479701..15479885
CREATE TABLE IF NOT EXISTS TokenLockerPosition (
    assetId TEXT NOT NULL,
    tokenLockerId TEXT NOT NULL,
    amount TEXT NOT NULL,
    unlockableTimestamp INTEGER NOT NULL
);

-- DDL-30; original background.js UTF-8 bytes 15479978..15480052
CREATE INDEX IF NOT EXISTS AssetMessage_assetID ON AssetMessage(assetID);

-- DDL-31; original background.js UTF-8 bytes 15480145..15480229
CREATE INDEX IF NOT EXISTS AssetLocalMessage_assetID ON AssetLocalMessage(assetID);

-- DDL-32; original background.js UTF-8 bytes 15480322..15480414
CREATE INDEX IF NOT EXISTS AssetSecurityInfoItem_assetID ON AssetSecurityInfoItem(assetID);

-- DDL-33; original background.js UTF-8 bytes 15480507..15480575
CREATE INDEX IF NOT EXISTS group_id ON LaunchpoolCampaign(groupId);

-- DDL-34; original background.js UTF-8 bytes 15480668..15480745
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardItem(rewardAssetId);

-- DDL-35; original background.js UTF-8 bytes 15480838..15480916
CREATE INDEX IF NOT EXISTS reward_id ON LaunchpoolRewardProof(rewardAssetId);

-- DDL-36; original background.js UTF-8 bytes 15481009..15481078
CREATE INDEX IF NOT EXISTS asset_id ON TokenLockerPosition(assetId);

-- DDL-37; original background.js UTF-8 bytes 15481972..15482518
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

-- DDL-38; original background.js UTF-8 bytes 15482609..15482851
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- DDL-39; original background.js UTF-8 bytes 15483558..15483851
CREATE TABLE IF NOT EXISTS AssetLocalStatus (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    walletID TEXT NOT NULL,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- DDL-40; original background.js UTF-8 bytes 15484468..15484725
CREATE TABLE IF NOT EXISTS AssetInfo_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    iconUrl TEXT,
    updatedAt INTEGER NOT NULL DEFAULT 0
);

-- DDL-41; original background.js UTF-8 bytes 15485424..15485709
CREATE TABLE IF NOT EXISTS AssetStatus_new (
    assetID TEXT NOT NULL PRIMARY KEY,
    isBuyAvailable INTEGER DEFAULT 0 NOT NULL,
    isSellAvailable INTEGER DEFAULT 0 NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- DDL-42; original background.js UTF-8 bytes 15486352..15486692
CREATE TABLE IF NOT EXISTS AssetLocalStatus_new (
    assetID TEXT NOT NULL,
    isAddedManually INTEGER DEFAULT 0 NOT NULL,
    isEnabled INTEGER DEFAULT 1 NOT NULL,
    walletID TEXT NOT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assetID, walletID),
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID)
);

-- DDL-43; original background.js UTF-8 bytes 15487380..15487973
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

-- DDL-44; original background.js UTF-8 bytes 15489185..15489796
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

-- DDL-45; original background.js UTF-8 bytes 15491870..15492631
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

-- DDL-46; original background.js UTF-8 bytes 15494408..15495196
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

-- DDL-47; original background.js UTF-8 bytes 15496749..15497138
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

-- DDL-48; original background.js UTF-8 bytes 15499078..15499597
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

-- DDL-49; original background.js UTF-8 bytes 15500314..15500481
CREATE TABLE IF NOT EXISTS LaunchpoolReward (
    rewardAssetId TEXT NOT NULL PRIMARY KEY,
    tokenAccumulated TEXT NOT NULL,
    tokenUnclaimed TEXT NOT NULL
);

-- DDL-50; original background.js UTF-8 bytes 15501495..15501908
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

-- DDL-51; original background.js UTF-8 bytes 15502963..15503524
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

-- DDL-52; original background.js UTF-8 bytes 15504888..15505138
CREATE TABLE IF NOT EXISTS AssetHighlights (
    assetID TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(assetID) REFERENCES AssetInfo(assetID) ON DELETE CASCADE
);

-- DDL-53; original background.js UTF-8 bytes 37545199..37545815
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

-- DDL-54; original background.js UTF-8 bytes 37546560..37547194
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

-- DDL-55; original background.js UTF-8 bytes 38443840..38444320
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

-- DDL-56; original background.js UTF-8 bytes 38444411..38444590
CREATE TABLE PriceAlertSettings (
    id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    isEnabled INTEGER NOT NULL DEFAULT 0,
    lastSyncTimestamp INTEGER NOT NULL DEFAULT 0
);
