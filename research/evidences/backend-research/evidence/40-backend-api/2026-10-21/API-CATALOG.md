# API catalogue — static and historical observations

This is a bounded inventory, not proof that every bundled API is enabled or that every possible runtime endpoint is known. No recorded URL was fetched. Source target: supplied v26.41.0. Captures have historical, unverified runtime attribution.

## Historical HTTP routes

[OBSERVED-ONLY] All 237 host/method/templated-path groups, including unrelated browser resources, are retained below so capture scope is auditable. Different query strings share a route. Template normalization is lossy and does not establish a server router. See HAR-SCHEMAS.md and har-contracts.json for shapes, variants, source ordinals, MIME types, header names and status counts.

| # | Method | Host | Templated path | Query keys | Count | Status counts |
|---|---|---|---|---|---|---|
| 1 | POST | aag.twnodes.com | `/naas/session/{sessionToken}/v2` |  | 11 | {"400":11} |
| 2 | GET | aeternity.twnodes.com | `/naas/session/{sessionToken}/v2/accounts/{opaqueValue}` |  | 36 | {"404":36} |
| 3 | GET | agoric-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 4 | GET | agoric-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 5 | GET | agoric-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 6 | GET | agoric-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 7 | POST | aion.twnodes.com | `/naas/session/{sessionToken}` |  | 36 | {"404":36} |
| 8 | GET | akash-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 9 | GET | akash-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 10 | GET | akash-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 11 | GET | akash-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 12 | GET | algorand.twnodes.com | `/naas/session/{sessionToken}/v2/accounts/{opaqueValue}` |  | 1 | {"200":1} |
| 13 | GET | api.bnbchain.org | `/bnb-staking/v1/validator/all` | limit, offset | 7 | {"200":7} |
| 14 | POST | aptos.twnodes.com | `/naas/session/{sessionToken}/v1/view` |  | 1 | {"200":1} |
| 15 | POST | arb1.arbitrum.io | `/rpc` |  | 2 | {"200":2} |
| 16 | POST | arc.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"0":1,"200":1} |
| 17 | GET | assets-cdn.trustwallet.com | `/blockchains/ethereum/tokenlist.json` |  | 1 | {"304":1} |
| 18 | GET | assets-cdn.trustwallet.com | `/blockchains/smartchain/tokenlist.json` |  | 1 | {"304":1} |
| 19 | GET | assets-cdn.trustwallet.com | `/blockchains/smartchain/validators/list.json` |  | 4 | {"200":3,"304":1} |
| 20 | GET | assets-cdn.trustwallet.com | `/blockchains/solana/validators/list.json` |  | 2 | {"200":1,"304":1} |
| 21 | POST | aurora.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"200":2} |
| 22 | POST | avalanche.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 23 | GET | axelar-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 24 | GET | axelar-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 25 | GET | axelar-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 26 | GET | axelar-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 27 | POST | base.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"0":1,"200":1} |
| 28 | GET | bin.bnbstatic.com | `/api/i18n/-/web/cms/sp/86a37593e/en/translations` |  | 7 | {"0":1,"200":1,"304":5} |
| 29 | GET | bitcoincash-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 30 | POST | blast.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 31 | POST | boba.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 32 | POST | bouncebit.twnodes.com | `/naas/session/{sessionToken}` |  | 37 | {"0":2,"404":35} |
| 33 | POST | bsc.twnodes.com | `/naas/session/{sessionToken}` |  | 31 | {"0":8,"200":23} |
| 34 | GET | btc-book.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 208 | {"0":3,"200":205} |
| 35 | POST | callisto.twnodes.com | `/naas/session/{sessionToken}` |  | 36 | {"200":36} |
| 36 | POST | cardano-graphql.twnodes.com | `/naas/session/{sessionToken}` |  | 180 | {"200":180} |
| 37 | POST | celo.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 38 | POST | classic.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 39 | POST | conflux-evm.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 40 | GET | cosmos.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 41 | GET | cosmos.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 42 | GET | cosmos.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 43 | GET | cosmos.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 44 | POST | cronos.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 45 | GET | crypto-org-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 36 | {"200":36} |
| 46 | GET | crypto-org-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 36 | {"200":36} |
| 47 | GET | crypto-org-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 36 | {"200":36} |
| 48 | GET | crypto-org-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 36 | {"200":36} |
| 49 | GET | dash-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 50 | GET | decred-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 32 | {"200":32} |
| 51 | GET | digibyte-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 52 | GET | doge-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 53 | POST | ethereum-sepolia-rpc.publicnode.com | `/` |  | 83 | {"200":83} |
| 54 | POST | ethereum-sponsored.twnodes.com | `/naas/session/{sessionToken}/v2/` |  | 2 | {"200":2} |
| 55 | POST | ethereum.twnodes.com | `/naas/session/{sessionToken}` |  | 103 | {"0":2,"200":101} |
| 56 | GET | evmos-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 36 | {"0":2,"404":34} |
| 57 | GET | evmos-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 36 | {"0":4,"404":32} |
| 58 | GET | evmos-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 36 | {"0":2,"404":34} |
| 59 | GET | evmos-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 36 | {"0":3,"404":33} |
| 60 | POST | evmos-jsonrpc.twnodes.com | `/naas/session/{sessionToken}` |  | 36 | {"404":36} |
| 61 | POST | fantom.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 62 | POST | filecoin.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 63 | POST | fio.twnodes.com | `/naas/session/{sessionToken}/v1/chain/get_fio_balance` |  | 1 | {"404":1} |
| 64 | GET | firo-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 65 | GET | fonts.gstatic.com | `/s/googlesans/v62/{opaqueValue}` |  | 1 | {"200":1} |
| 66 | GET | fonts.gstatic.com | `/s/roboto/v48/{opaqueValue}` |  | 1 | {"200":1} |
| 67 | GET | gateway.trustwallet.com | `/v2/projects/{projectId}/nodes` | account-abstraction, sponsored | 33 | {"200":33} |
| 68 | GET | gateway.us.trustwallet.com | `/amber-api/v1/domains` | arc, ton | 2 | {"200":2} |
| 69 | GET | gateway.us.trustwallet.com | `/stream/ws` |  | 10 | {"101":10} |
| 70 | GET | gateway.us.trustwallet.com | `/v1/assets` | asset_ids | 3 | {"200":3} |
| 71 | GET | gateway.us.trustwallet.com | `/v1/assets/listings` | category_id, currency, limit, networks, sort_direction, sort_field, version | 13 | {"200":13} |
| 72 | GET | gateway.us.trustwallet.com | `/v1/assets/tabs-config` |  | 1 | {"200":1} |
| 73 | GET | gateway.us.trustwallet.com | `/v1/assets/trending-config` |  | 1 | {"200":1} |
| 74 | GET | gateway.us.trustwallet.com | `/v1/assets/{assetId}` |  | 33 | {"404":33} |
| 75 | GET | gateway.us.trustwallet.com | `/v1/balances/chains` |  | 4 | {"200":4} |
| 76 | GET | gateway.us.trustwallet.com | `/v1/buycrypto/screens/funding` |  | 1 | {"200":1} |
| 77 | GET | gateway.us.trustwallet.com | `/v1/cex-transfer/providers/binance-pay/assets` |  | 79 | {"200":79} |
| 78 | GET | gateway.us.trustwallet.com | `/v1/cex-transfer/providers/coinbase-pay/assets` |  | 79 | {"200":79} |
| 79 | GET | gateway.us.trustwallet.com | `/v1/coinstatus/{assetId}` | include_security_info, include_solana_security_info | 78 | {"0":6,"200":48,"404":24} |
| 80 | GET | gateway.us.trustwallet.com | `/v1/coinstatus/{opaqueValue}` | include_security_info | 21 | {"404":21} |
| 81 | GET | gateway.us.trustwallet.com | `/v1/discover/group/invest-staking` | currency | 4 | {"200":4} |
| 82 | GET | gateway.us.trustwallet.com | `/v1/discover/new` | content, currency, device_id, source, wallet_id | 1 | {"200":1} |
| 83 | GET | gateway.us.trustwallet.com | `/v1/invests/stablecoin/config` |  | 18 | {"200":18} |
| 84 | GET | gateway.us.trustwallet.com | `/v1/invests/staking` | currency | 1 | {"200":1} |
| 85 | GET | gateway.us.trustwallet.com | `/v1/search/assets` | exactQuery, include_pricing_info, limit, networks, offset, sortBy, type, version | 6 | {"200":6} |
| 86 | GET | gateway.us.trustwallet.com | `/v1/txhub/txs` | address, asset, chain, from, limit, to | 4 | {"400":4} |
| 87 | GET | gateway.us.trustwallet.com | `/v2/announcements` | device_id, platform, strategy, version | 79 | {"200":79} |
| 88 | GET | gateway.us.trustwallet.com | `/v2/coinstatus/{assetId}` | include_security_info, include_solana_security_info, platform, version | 6 | {"200":6} |
| 89 | GET | gateway.us.trustwallet.com | `/v2/coinstatus/{opaqueValue}` | include_security_info, include_solana_security_info, platform, version | 3 | {"404":3} |
| 90 | GET | gateway.us.trustwallet.com | `/v2/devices/{deviceId}` |  | 29 | {"200":29} |
| 91 | GET | gateway.us.trustwallet.com | `/v2/market/charts/{opaqueValue}` | currency, period | 5 | {"400":5} |
| 92 | GET | gateway.us.trustwallet.com | `/v2/market/info/{opaqueValue}` | currency | 2 | {"400":2} |
| 93 | GET | gateway.us.trustwallet.com | `/v2/market/rates` | currency | 179 | {"0":3,"200":176} |
| 94 | GET | gateway.us.trustwallet.com | `/v2/market/sentiment-assets` |  | 4 | {"200":4} |
| 95 | GET | gateway.us.trustwallet.com | `/v3/devices/{deviceId}/wallets/{opaqueValue}/meta` |  | 3 | {"404":3} |
| 96 | GET | gateway.us.trustwallet.com | `/v3/points/{hexValue}/vip` |  | 4 | {"200":4} |
| 97 | POST | gateway.us.trustwallet.com | `/v1/approvals/scan` |  | 3 | {"200":3} |
| 98 | POST | gateway.us.trustwallet.com | `/v1/assets` |  | 1302 | {"0":11,"200":1291} |
| 99 | POST | gateway.us.trustwallet.com | `/v1/balances/stream` |  | 225 | {"0":7,"200":217,"503":1} |
| 100 | POST | gateway.us.trustwallet.com | `/v1/centrifugo-hooks/token` |  | 51 | {"0":4,"200":47} |
| 101 | POST | gateway.us.trustwallet.com | `/v1/txhub/bulk_history` |  | 63 | {"200":63} |
| 102 | POST | gateway.us.trustwallet.com | `/v1/validate/address` |  | 6 | {"200":2,"400":4} |
| 103 | POST | gateway.us.trustwallet.com | `/v1/validate/url` |  | 7 | {"200":7} |
| 104 | POST | gateway.us.trustwallet.com | `/v2/devices/fingerprint` |  | 37 | {"200":37} |
| 105 | POST | gateway.us.trustwallet.com | `/v2/market/tickers` |  | 415 | {"0":9,"200":406} |
| 106 | POST | gateway.us.trustwallet.com | `/v3/devices/{deviceId}/wallets/{opaqueValue}/address_association` |  | 1 | {"200":1} |
| 107 | POST | gateway.us.trustwallet.com | `/v3/devices/{deviceId}/wallets/{opaqueValue}/register` |  | 7 | {"200":5,"429":1,"500":1} |
| 108 | POST | gateway.us.trustwallet.com | `/v3/nft/collections` | exclude_spam, page, pageSize | 29 | {"200":29} |
| 109 | PUT | gateway.us.trustwallet.com | `/v2/devices/{deviceId}/push-topics` |  | 1 | {"204":1} |
| 110 | POST | gnosis.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 111 | POST | gochain.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 112 | GET | greenfield.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{hexValue}` |  | 36 | {"200":36} |
| 113 | GET | groestlcoin-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 114 | POST | harmony.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 115 | POST | hyperevm.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 116 | POST | icon.twnodes.com | `/naas/session/{sessionToken}/api/v3` |  | 1 | {"200":1} |
| 117 | GET | injective-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 118 | GET | injective-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 119 | GET | injective-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 120 | GET | injective-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 121 | POST | internetcomputer.twnodes.com | `/naas/session/{sessionToken}/account/balance` |  | 1 | {"200":1} |
| 122 | POST | iotex-jsonrpc.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 123 | GET | juno-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 124 | GET | juno-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 125 | GET | juno-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 126 | GET | juno-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 127 | POST | kava-evm.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 128 | GET | kava.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 129 | GET | kava.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 130 | GET | kava.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 131 | GET | kava.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 132 | POST | kcc.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 133 | POST | klaytn.twnodes.com | `/naas/session/{sessionToken}` |  | 7 | {"200":7} |
| 134 | GET | kusama.twnodes.com | `/naas/session/{sessionToken}/accounts/{opaqueValue}/balance-info` |  | 7 | {"200":7} |
| 135 | POST | lb.routeme.sh | `/rpc/evm/{number}` |  | 1 | {"429":1} |
| 136 | GET | lh3.google.com | `/u/{number}/ogw/{opaqueValue}` |  | 1 | {"302":1} |
| 137 | GET | lh3.googleusercontent.com | `/a/{opaqueValue}` |  | 1 | {"200":1} |
| 138 | GET | lh3.googleusercontent.com | `/rd-ogw/{opaqueValue}` |  | 1 | {"200":1} |
| 139 | POST | linea.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 140 | GET | litecoin-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 141 | POST | manta.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 142 | POST | mantle.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 143 | POST | megaeth.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 144 | POST | merlin.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 145 | POST | metis.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 146 | POST | monad.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 147 | POST | moonbeam.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 148 | POST | moonriver.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 149 | GET | multiversx-api.twnodes.com | `/naas/session/{sessionToken}/accounts/{opaqueValue}/delegation` |  | 1 | {"200":1} |
| 150 | GET | multiversx-api.twnodes.com | `/naas/session/{sessionToken}/address/{opaqueValue}` |  | 1 | {"200":1} |
| 151 | POST | nano.twnodes.com | `/naas/session/{sessionToken}` |  | 44 | {"200":44} |
| 152 | POST | near.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"200":2} |
| 153 | POST | nebulas.twnodes.com | `/naas/session/{sessionToken}/v1/user/accountstate` |  | 68 | {"0":68} |
| 154 | POST | neon.twnodes.com | `/naas/session/{sessionToken}` |  | 53 | {"0":12,"400":20,"503":21} |
| 155 | GET | neutron-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 7 | {"200":7} |
| 156 | POST | nimiq.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 157 | POST | o4507686279512064.ingest.us.sentry.io | `/api/{number}/envelope/` | sentry_client, sentry_key, sentry_version | 10 | {"200":6,"429":4} |
| 158 | POST | ogads-pa.clients6.google.com | `/$rpc/{opaqueValue}/GetAsyncData` |  | 1 | {"200":1} |
| 159 | GET | ogs.google.com | `/u/{number}/widget/app` | awwd, cn, dpi, em, eom, gpa, hl, origin, pid, scv, spid, xstg | 1 | {"200":1} |
| 160 | POST | ontology.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"200":2} |
| 161 | POST | opbnb.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 162 | POST | optimism.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 163 | GET | osmosis-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 6 | {"200":6} |
| 164 | GET | osmosis-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 6 | {"200":6} |
| 165 | GET | osmosis-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 6 | {"200":6} |
| 166 | GET | osmosis-lcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 6 | {"200":6} |
| 167 | POST | plasma.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 168 | GET | platform.trustwallet.com | `/v1/defi/network-stats` | vaults | 2 | {"200":2} |
| 169 | GET | platform.trustwallet.com | `/v1/defi/stakes` | vaults, wallets | 4 | {"200":4} |
| 170 | POST | play.google.com | `/log` | authuser, format, hasfast | 1 | {"200":1} |
| 171 | GET | polkadot.twnodes.com | `/naas/session/{sessionToken}/accounts/{opaqueValue}/balance-info` |  | 7 | {"200":7} |
| 172 | POST | polygon-zkevm.twnodes.com | `/naas/session/{sessionToken}` |  | 36 | {"200":36} |
| 173 | POST | polygon.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"0":1,"200":1} |
| 174 | GET | qtum-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 175 | POST | query.thegraph.kiln.fi | `/subgraphs/name/vsuite` |  | 17 | {"0":2,"200":15} |
| 176 | GET | ravencoin-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 177 | POST | ripple.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"200":2} |
| 178 | POST | robinhood.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 179 | POST | ronin.twnodes.com | `/naas/session/{sessionToken}` |  | 4 | {"200":4} |
| 180 | POST | scroll.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 181 | GET | sei-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 182 | GET | sei-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 183 | GET | sei-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 184 | GET | sei-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 185 | POST | solana.twnodes.com | `/naas/session/{sessionToken}` |  | 12 | {"200":12} |
| 186 | POST | sonic.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 187 | GET | ssl.gstatic.com | `/gb/images/sprites/p_2x_1b5e24e4e18f.png` |  | 1 | {"200":1} |
| 188 | GET | stargaze-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 36 | {"0":2,"404":34} |
| 189 | GET | stargaze-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 36 | {"0":1,"404":35} |
| 190 | GET | stargaze-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 36 | {"0":2,"404":34} |
| 191 | GET | stargaze-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 36 | {"404":36} |
| 192 | GET | stellar.twnodes.com | `/naas/session/{sessionToken}/accounts/{opaqueValue}` |  | 1 | {"404":1} |
| 193 | GET | stride-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 194 | GET | stride-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 195 | GET | stride-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 196 | GET | stride-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 197 | POST | sui.twnodes.com | `/naas/session/{sessionToken}` |  | 2 | {"200":2} |
| 198 | GET | terra-classic-fcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 199 | GET | terra-classic-fcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 200 | GET | terra-classic-fcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 201 | GET | terra-classic-fcd.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 202 | GET | tezos.twnodes.com | `/naas/session/{sessionToken}/chains/main/blocks/head/context/contracts/{opaqueValue}` |  | 1 | {"200":1} |
| 203 | POST | theta.twnodes.com | `/naas/session/{sessionToken}/rpc` |  | 14 | {"200":14} |
| 204 | GET | thorchain.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 7 | {"200":7} |
| 205 | POST | thundertoken.twnodes.com | `/naas/session/{sessionToken}` |  | 41 | {"400":35,"503":6} |
| 206 | POST | tomochain.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 207 | GET | ton.twnodes.com | `/naas/session/{sessionToken}/getAddressBalance` | address | 2 | {"200":2} |
| 208 | POST | tron.twnodes.com | `/naas/session/{sessionToken}/wallet/getReward` |  | 1 | {"200":1} |
| 209 | POST | tron.twnodes.com | `/naas/session/{sessionToken}/wallet/getaccount` |  | 1 | {"200":1} |
| 210 | POST | tron.twnodes.com | `/naas/session/{sessionToken}/wallet/getaccountresource` |  | 1 | {"200":1} |
| 211 | GET | vechain.twnodes.com | `/naas/session/{sessionToken}/accounts/{hexValue}` |  | 1 | {"200":1} |
| 212 | POST | vechain.twnodes.com | `/naas/session/{sessionToken}/accounts/{hexValue}` | revision | 1 | {"200":1} |
| 213 | GET | viacoin-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 72 | {"429":72} |
| 214 | GET | wallet-kit.trustwallet.com | `/v1/apr/proxy/stakewiz` |  | 1 | {"200":1} |
| 215 | POST | wanchain.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 216 | GET | waves.twnodes.com | `/naas/session/{sessionToken}/addresses/balance/{opaqueValue}/{number}` |  | 1 | {"200":1} |
| 217 | GET | waves.twnodes.com | `/naas/session/{sessionToken}/assets/balance/{opaqueValue}` |  | 1 | {"200":1} |
| 218 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/excm=_b,_tp,appwidgetauthview/ed=1/dg=0/wt=2/ujg=1/{opaqueValue}/dti=1/m=_b,_tp` |  | 1 | {"200":1} |
| 219 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/exm=_b,_tp/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/{opaqueValue}` |  | 1 | {"200":1} |
| 220 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=IiCRgf` |  | 1 | {"200":1} |
| 221 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=P6sQOc` |  | 1 | {"200":1} |
| 222 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=p3hmRc,LvGhrf,RqjULd` |  | 1 | {"200":1} |
| 223 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/m=sOXFj,q0xTif,YOiC1e` |  | 1 | {"200":1} |
| 224 | GET | www.gstatic.com | `/_/mss/boq-one-google/_/js/{opaqueValue}/{opaqueValue}/am=AAAAAH4IAAAAgGw/d=1/{opaqueValue}/excm=_b,_tp,appwidgetauthview/ed=1/wt=2/ujg=1/{opaqueValue}/{opaqueValue}/dti=1/{opaqueValue}` |  | 2 | {"200":2} |
| 225 | GET | www.gstatic.com | `/images/branding/googlelogo/svg/{opaqueValue}` |  | 1 | {"200":1} |
| 226 | GET | www.gstatic.com | `/og/_/js/{opaqueValue}/rt=j/m=q_dnp,qmd,qcwid,qapid,qald,qads/{opaqueValue}/d=1/ed=1/{opaqueValue}` |  | 1 | {"200":1} |
| 227 | GET | www.gstatic.com | `/og/_/ss/{opaqueValue}/{opaqueValue}/{opaqueValue}/d=1/ed=1/ct=zgms/{opaqueValue}` |  | 1 | {"200":1} |
| 228 | GET | zcash-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 229 | GET | zelcash-blockbook.twnodes.com | `/naas/session/{sessionToken}/api/v2/address/{opaqueValue}` | details | 36 | {"200":36} |
| 230 | GET | zetachain-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/bank/v1beta1/balances/{opaqueValue}` |  | 1 | {"200":1} |
| 231 | GET | zetachain-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/distribution/v1beta1/delegators/{opaqueValue}/rewards` |  | 1 | {"200":1} |
| 232 | GET | zetachain-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegations/{opaqueValue}` |  | 1 | {"200":1} |
| 233 | GET | zetachain-api.twnodes.com | `/naas/session/{sessionToken}/cosmos/staking/v1beta1/delegators/{opaqueValue}/unbonding_delegations` |  | 1 | {"200":1} |
| 234 | POST | zetachain-evm.twnodes.com | `/naas/session/{sessionToken}` |  | 36 | {"200":36} |
| 235 | POST | zilliqa-api.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |
| 236 | POST | zklink-nova-evm.twnodes.com | `/naas/session/{sessionToken}` |  | 36 | {"0":1,"200":35} |
| 237 | POST | zksync.twnodes.com | `/naas/session/{sessionToken}` |  | 1 | {"200":1} |

## Historical JSON-RPC methods

[OBSERVED-ONLY] The following records name an RPC method; HTTP success does not prove the RPC response was successful. Parameters and response shapes are in the contract JSON.

| Host | RPC method | Occurrences |
|---|---|---|
| aag.twnodes.com | `eth_getUserOperationReceipt` | 11 |
| aion.twnodes.com | `eth_getBalance` | 36 |
| arb1.arbitrum.io | `eth_chainId` | 1 |
| arb1.arbitrum.io | `eth_getBalance` | 1 |
| arc.twnodes.com | `eth_call` | 1 |
| arc.twnodes.com | `eth_getBalance` | 1 |
| aurora.twnodes.com | `eth_getBalance` | 2 |
| avalanche.twnodes.com | `eth_getBalance` | 1 |
| base.twnodes.com | `eth_call` | 1 |
| base.twnodes.com | `eth_getBalance` | 1 |
| blast.twnodes.com | `eth_getBalance` | 1 |
| boba.twnodes.com | `eth_getBalance` | 1 |
| bouncebit.twnodes.com | `eth_getBalance` | 37 |
| bsc.twnodes.com | `eth_call` | 61 |
| bsc.twnodes.com | `eth_getBalance` | 3 |
| callisto.twnodes.com | `eth_getBalance` | 36 |
| celo.twnodes.com | `eth_getBalance` | 1 |
| classic.twnodes.com | `eth_getBalance` | 1 |
| conflux-evm.twnodes.com | `eth_getBalance` | 1 |
| cronos.twnodes.com | `eth_getBalance` | 1 |
| ethereum-sepolia-rpc.publicnode.com | `eth_call` | 19 |
| ethereum-sepolia-rpc.publicnode.com | `eth_chainId` | 9 |
| ethereum-sepolia-rpc.publicnode.com | `eth_estimateGas` | 6 |
| ethereum-sepolia-rpc.publicnode.com | `eth_gasPrice` | 6 |
| ethereum-sepolia-rpc.publicnode.com | `eth_getBalance` | 22 |
| ethereum-sepolia-rpc.publicnode.com | `eth_getTransactionByHash` | 11 |
| ethereum-sepolia-rpc.publicnode.com | `eth_getTransactionCount` | 6 |
| ethereum-sepolia-rpc.publicnode.com | `eth_getTransactionReceipt` | 2 |
| ethereum-sepolia-rpc.publicnode.com | `eth_sendRawTransaction` | 2 |
| ethereum-sponsored.twnodes.com | `pm_isSponsorable` | 2 |
| ethereum.twnodes.com | `eth_call` | 98 |
| ethereum.twnodes.com | `eth_getBalance` | 5 |
| evmos-jsonrpc.twnodes.com | `eth_getBalance` | 36 |
| fantom.twnodes.com | `eth_getBalance` | 1 |
| filecoin.twnodes.com | `Filecoin.WalletBalance` | 1 |
| gnosis.twnodes.com | `eth_getBalance` | 1 |
| gochain.twnodes.com | `eth_getBalance` | 1 |
| harmony.twnodes.com | `hmy_getBalance` | 1 |
| hyperevm.twnodes.com | `eth_getBalance` | 1 |
| icon.twnodes.com | `icx_getBalance` | 1 |
| iotex-jsonrpc.twnodes.com | `eth_getBalance` | 1 |
| kava-evm.twnodes.com | `eth_getBalance` | 1 |
| kcc.twnodes.com | `eth_getBalance` | 1 |
| klaytn.twnodes.com | `eth_getBalance` | 7 |
| lb.routeme.sh | `eth_chainId` | 1 |
| linea.twnodes.com | `eth_getBalance` | 1 |
| manta.twnodes.com | `eth_getBalance` | 1 |
| mantle.twnodes.com | `eth_getBalance` | 1 |
| megaeth.twnodes.com | `eth_getBalance` | 1 |
| merlin.twnodes.com | `eth_getBalance` | 1 |
| metis.twnodes.com | `eth_getBalance` | 1 |
| monad.twnodes.com | `eth_getBalance` | 1 |
| moonbeam.twnodes.com | `eth_getBalance` | 1 |
| moonriver.twnodes.com | `eth_getBalance` | 1 |
| near.twnodes.com | `query` | 2 |
| neon.twnodes.com | `eth_getBalance` | 53 |
| nimiq.twnodes.com | `getAccountByAddress` | 1 |
| ontology.twnodes.com | `getbalance` | 2 |
| opbnb.twnodes.com | `eth_getBalance` | 1 |
| optimism.twnodes.com | `eth_getBalance` | 1 |
| plasma.twnodes.com | `eth_getBalance` | 1 |
| polygon-zkevm.twnodes.com | `eth_getBalance` | 36 |
| polygon.twnodes.com | `eth_getBalance` | 2 |
| ripple.twnodes.com | `account_info` | 1 |
| ripple.twnodes.com | `server_state` | 1 |
| robinhood.twnodes.com | `eth_getBalance` | 1 |
| ronin.twnodes.com | `eth_getBalance` | 4 |
| scroll.twnodes.com | `eth_getBalance` | 1 |
| solana.twnodes.com | `getBalance` | 2 |
| solana.twnodes.com | `getEpochInfo` | 1 |
| solana.twnodes.com | `getInflationRate` | 2 |
| solana.twnodes.com | `getMinimumBalanceForRentExemption` | 1 |
| solana.twnodes.com | `getProgramAccounts` | 3 |
| solana.twnodes.com | `getStakeMinimumDelegation` | 1 |
| solana.twnodes.com | `getVoteAccounts` | 2 |
| sonic.twnodes.com | `eth_getBalance` | 1 |
| sui.twnodes.com | `suix_getAllBalances` | 1 |
| sui.twnodes.com | `suix_getStakes` | 1 |
| theta.twnodes.com | `theta.GetAccount` | 14 |
| thundertoken.twnodes.com | `eth_getBalance` | 41 |
| tomochain.twnodes.com | `eth_getBalance` | 1 |
| wanchain.twnodes.com | `eth_getBalance` | 1 |
| zetachain-evm.twnodes.com | `eth_getBalance` | 36 |
| zilliqa-api.twnodes.com | `GetBalance` | 1 |
| zklink-nova-evm.twnodes.com | `eth_getBalance` | 36 |
| zksync.twnodes.com | `eth_getBalance` | 1 |

## Static path literal candidates

[Discovery only] Every selected path-literal occurrence is retained, including SDK internals, duplicates in background/UI, templates, paths not proven to be HTTP, and documentation examples. Original zero-based UTF-8 byte offsets are supplied. An owner label is a discovery aid, not proof of a request method or reachable caller. Decimal API versions are supplemented in static-supplement.json. No HTTP method is guessed from a name.

| File | Original byte start | Owner | Literal / template |
|---|---|---|---|
| background.js | 123637 | getBaseApiEndpoint | `${…}//${…}${…}${…}/api/` |
| background.js | 4469039 | parseAbiParameter2 | `/api/human.html#parseabiparameter-1` |
| background.js | 8290546 | ye | `https://o4507686279512064.ingest.us.sentry.io/api/4507883689476096/envelope/` |
| background.js | 8304172 | this.a1u1_1 | `https://o4507686279512064.ingest.us.sentry.io/api/4508601602736129/envelope/` |
| background.js | 8316904 | ls(Transaction,"Transaction"),ls(AnalyticError,"AnalyticError"),ls(NoOpEventLogger,"NoOpEventLogger" | `https://o4507686279512064.ingest.us.sentry.io/api/4508601602736129/envelope/` |
| background.js | 8359594 | getValidatorImageUrl | `/validators/assets/` |
| background.js | 8363487 | TrustFingerPrintRpcClient$getDeviceFingerPrint$lambda | `/v2/devices/fingerprint` |
| background.js | 8363880 | GasPriceRemoteService$execute$lambda | `/v1/gas/price/` |
| background.js | 8431645 | HttpNaasNodeRemoteStorage$loadNodes$lambda | `/v2/projects/` |
| background.js | 8665565 | this.bkx_1 | `/v2/nodes?network={redactedValue}` |
| background.js | 8852523 | BitcoinRemoteFeeService$execute$lambda | `/v1/fee/priority/` |
| background.js | 8855524 | BitcoinRemoteFeeTypeService$execute$lambda | `/v1/fee/type/` |
| background.js | 8864801 | BitcoinRpcClient$getBalance$lambda | `/api/v2/address/` |
| background.js | 8864838 | BitcoinRpcClient$getBalance$lambda | `/api/v2/xpub/` |
| background.js | 8864993 | BitcoinRpcClient$broadcastTransaction$lambda$lambda | `/api/v2/sendtx/` |
| background.js | 8865370 | BitcoinRpcClient$getTransaction$lambda | `/api/v2/tx/` |
| background.js | 8866123 | BitcoinRpcClient$getUnspentOutputs$lambda | `/api/v2/utxo/` |
| background.js | 8866374 | BitcoinRpcClient$estimateFee$lambda$lambda | `/api/v2/estimatefee/2` |
| background.js | 8866601 | BitcoinRpcClient$getZcashBranchId$lambda$lambda | `/api/v2` |
| background.js | 8942439 | this.n194_1 | `/api/v2` |
| background.js | 8945275 | this.oa_1 | `/api/v2` |
| background.js | 8977767 | BitcoinRpcClient$getBalance$lambda | `/api/v2/address/` |
| background.js | 8977925 | BitcoinRpcClient$broadcastTransaction$lambda$lambda | `/api/v2/sendtx/` |
| background.js | 8978302 | BitcoinRpcClient$getTransaction$lambda | `/api/v2/tx/` |
| background.js | 8978437 | BitcoinRpcClient$getUnspentOutputs$lambda$lambda | `/api/v2/utxo/` |
| background.js | 8978950 | BitcoinRpcClient$getDerivationPaths$lambda | `/api/v2/utxo/` |
| background.js | 8979183 | BitcoinRpcClient$getZcashBranchId$lambda$lambda | `/api/v2` |
| background.js | 8979381 | BitcoinRpcClient$estimateFee$lambda$lambda | `/api/v2/estimatefee/2` |
| background.js | 8992371 | BitcoinRemoteFeeService$execute$lambda | `/v1/fee/priority/` |
| background.js | 9043380 | this.f1a1_1 | `/api/v2` |
| background.js | 9046216 | this.oa_1 | `/api/v2` |
| background.js | 9189674 | BscRpcStakingClient$getValidators$lambda | `/v1/validator/all` |
| background.js | 9398663 | gl(Companion),bl($calculateFeeCOROUTINE$0,dl),El(AcalaEvmFeeService,"AcalaEvmFeeService",Pl,Pl,[Il], | `/v2` |
| background.js | 9466993 | gl(Companion),bl($calculateFeeCOROUTINE$0,dl),El(AcalaEvmFeeService,"AcalaEvmFeeService",Pl,Pl,[Il], | `/v1` |
| background.js | 9490113 | gl(Companion),bl($calculateFeeCOROUTINE$0,dl),El(AcalaEvmFeeService,"AcalaEvmFeeService",Pl,Pl,[Il], | `/v2/` |
| background.js | 9605570 | CosmosNodeRpcClient$isSynced$lambda | `/cosmos/base/tendermint/v1beta1/syncing` |
| background.js | 9606100 | CosmosRpcClient$getBalance$lambda | `/cosmos/bank/v1beta1/balances/` |
| background.js | 9606356 | CosmosRpcClient$getUnbondingDelegations$lambda | `/cosmos/staking/v1beta1/delegators/` |
| background.js | 9606616 | CosmosRpcClient$getRewards$lambda | `/cosmos/distribution/v1beta1/delegators/` |
| background.js | 9606881 | CosmosRpcClient$getAccountDetails$lambda | `/cosmos/auth/v1beta1/accounts/` |
| background.js | 9607119 | CosmosRpcClient$getNodeInfo$lambda$lambda | `/cosmos/base/tendermint/v1beta1/node_info` |
| background.js | 9607237 | CosmosRpcClient$simulate$lambda$lambda | `/cosmos/tx/v1beta1/simulate` |
| background.js | 9607486 | CosmosRpcClient$broadcastTransaction$lambda$lambda | `/cosmos/tx/v1beta1/txs` |
| background.js | 9607868 | CosmosRpcClient$findTransaction$lambda | `/cosmos/tx/v1beta1/txs/` |
| background.js | 9608129 | CosmosRpcClient$getEvmosFeeMarketParams$lambda$lambda | `/evmos/feemarket/v1/params` |
| background.js | 9608361 | CosmosRpcClient$getOsmosisBaseFee$lambda$lambda | `/osmosis/txfees/v1beta1/cur_eip_base_fee` |
| background.js | 9608589 | CosmosRpcClient$getDelegations$lambda | `/cosmos/staking/v1beta1/delegations/` |
| background.js | 9609030 | CosmosRpcClient$getContractBalance$lambda | `/cosmwasm/wasm/v1/contract/` |
| background.js | 9609305 | CosmosRpcClient$getNeutronMarketFee$lambda$lambda | `/feemarket/v1/gas_prices` |
| background.js | 9620043 | CosmosDefaultFeeRemoteServiceDelegate$execute$lambda | `/v1/fee/default/` |
| background.js | 9622922 | Pm(ye,["/v1/apr"]),Xd(ae,Jd().f6d_1); | `/v1/apr` |
| background.js | 9633976 | CosmosStakingRpcClient$getDelegations$lambda | `/cosmos/staking/v1beta1/delegations/` |
| background.js | 9634246 | CosmosStakingRpcClient$getUnbondingDelegations$lambda | `/cosmos/staking/v1beta1/delegators/` |
| background.js | 9634535 | CosmosStakingRpcClient$getCosmosValidators$lambda | `/cosmos/staking/v1beta1/validators` |
| background.js | 9634898 | CosmosStakingRpcClient$getCosmosValidator$lambda | `/cosmos/staking/v1beta1/validators/` |
| background.js | 9635144 | CosmosStakingRpcClient$getPool$lambda$lambda | `/cosmos/staking/v1beta1/pool` |
| background.js | 9635682 | CosmosStakingRpcClient$getProvisions$lambda | `/osmosis/mint/v1beta1/epoch_provisions` |
| background.js | 9635991 | CosmosStakingRpcClient$getEvmosInflation$lambda$lambda | `/evmos/inflation/v1/params` |
| background.js | 9636247 | CosmosStakingRpcClient$getCosmosInflation$lambda$lambda | `/cosmos/mint/v1beta1/inflation` |
| background.js | 9636783 | CosmosStakingRpcClient$getDistributionParams$lambda$lambda | `/cosmos/distribution/v1beta1/params` |
| background.js | 9637036 | es | `/osmosis/mint/v1beta1/params` |
| background.js | 9637417 | CosmosStakingRpcClient$getEvmosEpoch$lambda$lambda | `/evmos/inflation/v1/epoch_mint_provision` |
| background.js | 9637690 | CosmosStakingRpcClient$getAnnualProvisions$lambda$lambda | `/cosmos/mint/v1beta1/annual_provisions` |
| background.js | 9638202 | CosmosStakingRpcClient$getSommelierAPY$lambda$lambda | `/sommelier/incentives/v1/apy` |
| background.js | 9638731 | CosmosStakingRpcClient$getCelestiaInflation$lambda$lambda | `/cosmos/mint/v1beta1/inflation_rate` |
| background.js | 9655211 | TerraRpcClient$getTerraGasPrices$lambda$lambda | `/v1/txs/gas_prices` |
| background.js | 9882909 | Ol(CosmosAccountService$loadBalances$slambda$slambda$slambda,yl,xl,[1]),Ol(CosmosAccountService$load | `/cosmos/bank/v1beta1/supply` |
| background.js | 9983854 | FioNodeRpcClient$isSynced$lambda | `/v1/chain/get_info` |
| background.js | 9983946 | FioNodeRpcClient$blockNumber$lambda | `/v1/chain/get_info` |
| background.js | 9984399 | pe.a8g(function FioRpcClient$getCoinBalance$lambda$lambda(ae){return function(pe,ye){return ll(pe,[" | `/v1/chain/get_fio_balance` |
| background.js | 9985153 | es.a8g(function FioRpcClient$broadcastTransaction$lambda$lambda(ae,pe){return function(ye,es){return | `/v1/chain/` |
| background.js | 9985780 | pe.a8g(function FioRpcClient$estimateFee$lambda$lambda(ae){return function(pe,ye){return ll(pe,["/v1 | `/v1/chain/get_fee` |
| background.js | 9986433 | FioRpcClient$fetchChainParams$lambda$lambda | `/v1/chain/get_info` |
| background.js | 9986634 | pe.a8g(function FioRpcClient$fetchChainParams$lambda$lambda_0(ae){return function(pe,ye){return ll(p | `/v1/chain/get_block` |
| background.js | 9987386 | pe.a8g(function FioRpcClient$checkAvailability$lambda$lambda(ae){return function(pe,ye){return ll(pe | `/v1/chain/avail_check` |
| background.js | 9988105 | pe.a8g(function FioRpcClient$getAddresses$lambda$lambda(ae){return function(pe,ye){return ll(pe,["/v | `/v1/chain/get_fio_addresses` |
| background.js | 9988844 | pe.a8g(function FioRpcClient$getAllPublicKeys$lambda$lambda(ae){return function(pe,ye){return ll(pe, | `/v1/chain/get_pub_addresses` |
| background.js | 9989498 | FioRpcClient$registerFreeHandle$lambda | `/v1/fio/buy-address` |
| background.js | 10110297 | this.kwv_1 | `https://wallet-kit.trustwallet.com/v1/apr/proxy/stakewiz` |
| background.js | 10326174 | this.exj_1 | `https://wallet-kit.trustwallet.com/v1/apr/proxy/stakewiz` |
| background.js | 10396563 | $l(SolanaAccountService$loadBalancesForCoins$slambda$slambda,Zr,bl,[1]),$l(SolanaAccountService$load | `/corex/ga/v1` |
| background.js | 10454724 | AmberRpcClient$getDomains$lambda | `/v1/domains` |
| background.js | 10454877 | AmberRpcClient$getProviders$lambda | `/v1/providers` |
| background.js | 10455008 | AmberRpcClient$getBridgeProvider$lambda | `/v1/providers/bridge/` |
| background.js | 10455147 | AmberRpcClient$getDexProvider$lambda | `/v1/providers/dex/` |
| background.js | 10455275 | AmberRpcClient$getRoutes$lambda | `/v1/route` |
| background.js | 10455389 | AmberRpcClient$getStep$lambda | `/v1/route/step` |
| background.js | 10455518 | AmberRpcClient$createTransaction$lambda | `/v1/history/create` |
| background.js | 10455658 | AmberRpcClient$findTransaction$lambda | `/v1/history/status` |
| background.js | 10455832 | AmberRpcClient$submitTransaction$lambda | `/v1/transaction/submit` |
| background.js | 10765915 | AlgorandNodeRpcClient$isSynced$lambda | `/v2/status` |
| background.js | 10766004 | AlgorandNodeRpcClient$blockNumber$lambda | `/v2/status` |
| background.js | 10766429 | AlgorandRpcClient$getStatus$lambda$lambda | `/v2/status` |
| background.js | 10766834 | AlgorandRpcClient$getAccountData$lambda | `/v2/accounts/` |
| background.js | 10767065 | AlgorandRpcClient$getTransactionStatus$lambda | `/v2/transactions/pending/` |
| background.js | 10767325 | AlgorandRpcClient$getTransactionParams$lambda$lambda | `/v2/transactions/params` |
| background.js | 10767439 | AlgorandRpcClient$broadcastTransaction$lambda$lambda | `/v2/transactions` |
| background.js | 10768235 | AlgorandRpcClient$getAssetRegistered$lambda | `/v2/accounts/` |
| background.js | 10768254 | AlgorandRpcClient$getAssetRegistered$lambda | `/assets/` |
| background.js | 10828171 | AptosNodeRpcClient$isSynced$lambda | `/v1/-/healthy` |
| background.js | 10828260 | AptosNodeRpcClient$blockNumber$lambda | `/v1` |
| background.js | 10829738 | AptosRpcClient$fetchLedgerTimestamp$lambda$lambda | `/v1/` |
| background.js | 10829928 | AptosRpcClient$sequenceNumber$lambda | `/v1/accounts/` |
| background.js | 10830031 | AptosRpcClient$simulate$lambda$lambda | `/v1/transactions/simulate` |
| background.js | 10830481 | AptosRpcClient$estimateGasPrice$lambda$lambda | `/v1/estimate_gas_price` |
| background.js | 10830586 | AptosRpcClient$sendTransaction$lambda$lambda | `/v1/transactions` |
| background.js | 10830958 | AptosRpcClient$getTransactionByHash$lambda | `/v1/transactions/by_hash/` |
| background.js | 10831076 | AptosRpcClient$executeView$lambda$lambda | `/v1/view` |
| background.js | 11113597 | Mm(ye,["/v1/staking/chains/cardano/validator_aprs"]); | `/v1/staking/chains/cardano/validator_aprs` |
| background.js | 11481837 | EthKilnRpcStakingClient$getExitQueueEstimation$lambda | `/v1/pools/exit-queue/ticket/` |
| background.js | 11578816 | this.c15d_1 | `/v1/invests/stablecoin/config` |
| background.js | 11604069 | hn | `/v1/defi` |
| background.js | 11604092 | hn | `/v1/defi/network-stats` |
| background.js | 11604129 | hn | `/v1/defi/extra-rewards/morpho` |
| background.js | 11604173 | hn | `/v1/defi/extra-rewards/morpho/claim` |
| background.js | 11604223 | hn | `/v1/defi/stakes` |
| background.js | 11604685 | KilnVaultsRpcClient$positions$lambda | `/v1/defi/stakes` |
| background.js | 11604772 | KilnVaultsRpcClient$vaults$lambda | `/v1/defi/network-stats` |
| background.js | 11604878 | KilnVaultsRpcClient$morphoExtraRewards$lambda | `/v1/defi/extra-rewards/morpho` |
| background.js | 11604996 | KilnVaultsRpcClient$craftClaimMorphoRewards$lambda | `/v1/defi/extra-rewards/morpho/claim` |
| background.js | 11654686 | this.p14h_1 | `/v1/defi/angle/positions` |
| background.js | 11657318 | this.r14j_1 | `/v1/defi/angle/overview` |
| background.js | 11662683 | bn($getVaultCOROUTINE$0,kn),bn($fetchVaultOverviewFromRemoteCOROUTINE$1,kn),zn(AngleVaultOverviewCac | `/v1/defi/angle/deposit` |
| background.js | 11662947 | bn($getVaultCOROUTINE$0,kn),bn($fetchVaultOverviewFromRemoteCOROUTINE$1,kn),zn(AngleVaultOverviewCac | `/v1/defi/angle/withdraw` |
| background.js | 11714671 | this.p15d_1 | `/v1/invests/stablecoin/config` |
| background.js | 11909680 | this.n10e_1 | `/api/v2/tronRent` |
| background.js | 11909875 | TronifyApiClient$preorder$lambda | `/api/v2/tronRent` |
| background.js | 11909985 | TronifyApiClient$createOrder$lambda | `/api/v2/tronRent` |
| background.js | 11910094 | TronifyApiClient$uploadHash$lambda | `/api/v2/tronRent` |
| background.js | 11910197 | TronifyApiClient$orderStatus$lambda | `/api/v2/tronRent` |
| background.js | 12139544 | Vt(TronAccountService$loadBalances$slambda$slambda,Qn,Ht,[1]),Vt(TronAccountService$loadBalances$sla | `/v2/` |
| background.js | 12263882 | Qr(pe,["network/status"]); | `network/status` |
| background.js | 12265645 | Qr(ye,["search/transactions"]); | `search/transactions` |
| background.js | 12360148 | TezosNodeRpcClient$getHeadHeader$lambda | `/chains/main/blocks/head/header` |
| background.js | 12360760 | TezosRpcClient$getHead$lambda$lambda | `/chains/main/blocks/head` |
| background.js | 12360970 | TezosRpcClient$getAccountData$lambda | `/chains/main/blocks/head/context/contracts/` |
| background.js | 12361211 | TezosRpcClient$getManagerKey$lambda | `/chains/main/blocks/head/context/contracts/` |
| background.js | 12361464 | pe.a8g(function TezosRpcClient$forgeOperations$lambda$lambda(ae){return function(pe,ye){return Yl(pe | `/chains/main/blocks/head/helpers/forge/operations` |
| background.js | 12362182 | pe.a8g(function TezosRpcClient$runOperation$lambda$lambda(ae){return function(pe,ye){return Yl(pe,[" | `/chains/main/blocks/head/helpers/scripts/run_operation` |
| background.js | 12362910 | TezosRpcClient$getConstants$lambda$lambda | `/chains/main/blocks/head/context/constants` |
| background.js | 12363459 | TezosRpcClient$getBlockOperations$lambda | `/chains/main/blocks/` |
| background.js | 12363588 | TezosRpcClient$getBakers$lambda | `/v3/bakers` |
| background.js | 12504326 | this.c1jo_1 | `/rpc` |
| background.js | 12505342 | this.z1jo_1 | `/rpc` |
| background.js | 12506600 | this.w1jp_1 | `/rpc` |
| background.js | 12507365 | this.r1jq_1 | `/rpc` |
| background.js | 12508141 | this.n1jr_1 | `/rpc` |
| background.js | 12615077 | AeternityRpcClient$findTransaction$lambda | `/v2/transactions/` |
| background.js | 12615294 | AeternityRpcClient$getAccount$lambda | `/v2/accounts/` |
| background.js | 12615413 | AeternityRpcClient$broadcastTransaction$lambda$lambda | `/v2/transactions` |
| background.js | 12616221 | AeternityRpcClient$getBlockNumber$lambda$lambda | `/v2/blocks/top` |
| background.js | 12633544 | this.x1cp_1 | `/v2/status` |
| background.js | 12636382 | this.d1cs_1 | `/v2/blocks/top` |
| background.js | 12661812 | WavesNodeRpcClient$isSynced$lambda | `/node/status` |
| background.js | 12662620 | WavesRpcClient$getAssetBalances$lambda | `/assets/balance/` |
| background.js | 12662850 | WavesRpcClient$findTransactionByHash$lambda | `/transactions/info/` |
| background.js | 12662971 | WavesRpcClient$broadcastTransaction$lambda$lambda | `/transactions/broadcast` |
| background.js | 12663350 | WavesRpcClient$getTimeStamp$lambda$lambda | `/node/status` |
| background.js | 12798878 | MultiversXRpcClient$getAccount$lambda | `/address/` |
| background.js | 12799325 | MultiversXRpcClient$getTokens$lambda | `/address/` |
| background.js | 12799583 | MultiversXRpcClient$getTransactionStatus$lambda | `/status` |
| background.js | 13018291 | StellarRpcClient$findTransactionByHash$lambda | `/transactions/` |
| background.js | 13018595 | StellarRpcClient$broadcastTransaction$lambda$lambda | `/transactions` |
| background.js | 13088242 | NebulasRpcClient$getAccount$lambda$lambda | `/v1/user/accountstate` |
| background.js | 13088987 | NebulasRpcClient$getGasPrice$lambda$lambda | `/v1/user/getGasPrice` |
| background.js | 13089098 | NebulasRpcClient$getTransactionReceipt$lambda$lambda | `/v1/user/getTransactionReceipt` |
| background.js | 13089880 | NebulasRpcClient$getLatestBlock$lambda$lambda | `/v1/user/lib` |
| background.js | 13090095 | NebulasRpcClient$getNebulasState$lambda$lambda | `/v1/user/nebstate` |
| background.js | 13090202 | NebulasRpcClient$broadcastTransaction$lambda$lambda | `/v1/user/rawtransaction` |
| background.js | 13091445 | NebulasNodeRpcClient$isSynced$lambda | `/v1/user/nebstate` |
| background.js | 13091540 | NebulasNodeRpcClient$blockNumber$lambda | `/v1/user/nebstate` |
| background.js | 13213416 | IotexRpcClient$getAccountMeta$lambda | `/v1/accounts/` |
| background.js | 13213641 | IotexRpcClient$getTransactionByHash$lambda | `/v1/actions/hash/` |
| background.js | 13213873 | IotexRpcClient$broadcastTransaction$lambda | `/v1/actionbytes/` |
| background.js | 13261831 | Is($loadBalancesCOROUTINE$0,fs),js(IconAccountService,"IconAccountService",Ds,Ds,[Ns],[1,2]),Is($cal | `/api/v3` |
| background.js | 13328250 | PolkadotRpcClient$totalIssuance$lambda$lambda | `/pallets/balances/storage/totalIssuance` |
| background.js | 13544829 | VeChainRpcClient$sendRawTransaction$lambda$lambda | `/transactions` |
| background.js | 13545604 | VeChainRpcClient$getTransactionReceipt$lambda | `/transactions/` |
| background.js | 14881125 | ae | `/assets/` |
| background.js | 34169553 | AssetApiClientImpl$getAsset$lambda | `/v1/assets/` |
| background.js | 34169662 | AssetApiClientImpl$getAssets$lambda | `/v1/assets` |
| background.js | 34169818 | AssetApiClientImpl$getAssetStatus$lambda | `/v2/coinstatus/` |
| background.js | 34170190 | Iw(pe,["/v1/search/assets"]); | `/v1/search/assets` |
| background.js | 34170814 | AssetApiClientImpl$getPopularAssets$lambda | `/v1/assets/popular` |
| background.js | 34170951 | Iw(pe,["/v1/assets/listings"]),pe.r6m_1.w67("version",ae.e1ux_1.toString()),pe.r6m_1.w67("currency", | `/v1/assets/listings` |
| background.js | 34172191 | BalanceApiClientImpl$streamBalances$slambda$lambda | `/v1/balances/stream` |
| background.js | 34173214 | MarketApiClientImpl$getTickers$lambda | `/v2/market/tickers` |
| background.js | 34173334 | MarketApiClientImpl$getMarketInfo$lambda | `/v1/market/info/` |
| background.js | 34173486 | MarketApiClientImpl$getUsdExchangeRate$lambda | `/v2/market/rates` |
| background.js | 34475075 | this.h2jw_1 | `/v1/invests` |
| background.js | 34475101 | this.h2jw_1 | `/v1/invests/stablecoin/quotes` |
| background.js | 34475292 | q_(ye,["/v1/invests/staking"]),ye.r6m_1.w67("currency",ae); | `/v1/invests/staking` |
| background.js | 34475494 | q_(ye,["/v1/invests/stablecoin"]),ye.r6m_1.w67("currency",ae); | `/v1/invests/stablecoin` |
| background.js | 34475707 | q_(es,["/v1/invests/stablecoin/positions"]),es.r6m_1.w67("wallet_address",ae); | `/v1/invests/stablecoin/positions` |
| background.js | 34475967 | InvestApiClientImpl$createApproveQuote$lambda | `/v1/invests/stablecoin/quotes/approve` |
| background.js | 34476088 | InvestApiClientImpl$createDepositQuote$lambda | `/v1/invests/stablecoin/quotes/deposit` |
| background.js | 34476210 | InvestApiClientImpl$createWithdrawQuote$lambda | `/v1/invests/stablecoin/quotes/withdraw` |
| background.js | 34477284 | MerklRewardsClientImpl$merklRewards$lambda | `/v1/launchpool/userMultiChainRewards` |
| background.js | 35427191 | PerpetualApiClientImpl$getNonce$lambda | `/bapi/futures/v1/public/future/web3/get-nonce` |
| background.js | 35427310 | PerpetualApiClientImpl$login$lambda | `/bapi/futures/v1/public/future/web3/login` |
| background.js | 35427430 | PerpetualApiClientImpl$placeOrder$lambda | `/bapi/futures/v1/private/future/order/place-order` |
| background.js | 35427566 | PerpetualApiClientImpl$placeStrategyOrder$lambda | `/bapi/futures/v1/private/future/strategy/place-order` |
| background.js | 35427704 | PerpetualApiClientImpl$getWithdrawAssets$lambda | `/bapi/futures/v1/public/future/apx/withdraw/assets` |
| background.js | 35427869 | PerpetualApiClientImpl$getDepositAssets$lambda | `/bapi/futures/v1/public/future/apx/deposit/assets` |
| background.js | 35428058 | Kg(ns,["/bapi/futures/v1/public/future/apx/estimate-withdraw-fee"]); | `/bapi/futures/v1/public/future/apx/estimate-withdraw-fee` |
| background.js | 35428484 | PerpetualApiClientImpl$getChainWithdrawLimit$lambda | `/bapi/futures/v1/private/future/web3/chain-withdraw-limit` |
| background.js | 35428701 | PerpetualApiClientImpl$getLockedProfit$lambda | `/bapi/futures/v1/private/future/apx/limit/profit` |
| background.js | 35428999 | PerpetualApiClientImpl$requestWithdraw$lambda | `/bapi/futures/v1/private/future/apx/user-withdraw` |
| background.js | 35429153 | Kg(ye,["/bapi/futures/v1/private/future/user-data/getMaxWithdrawAmount"]); | `/bapi/futures/v1/private/future/user-data/getMaxWithdrawAmount` |
| background.js | 35429825 | Kg(es,["/bapi/futures/v1/private/future/user-data/adjust-margin-type"]); | `/bapi/futures/v1/private/future/user-data/adjust-margin-type` |
| background.js | 35430518 | Kg(pe,["/bapi/futures/v4/private/future/user-data/user-balance"]); | `/bapi/futures/v4/private/future/user-data/user-balance` |
| background.js | 35431162 | PerpetualApiClientImpl$getAssetIndex$lambda | `/fapi/v1/assetIndex` |
| background.js | 35431262 | PerpetualApiClientImpl$getTradeInfo$lambda | `/fapi/v1/premiumIndex` |
| background.js | 35431383 | Kg(pe,["/bapi/futures/v1/private/future/user-setting/get-optional-symbols"]); | `/bapi/futures/v1/private/future/user-setting/get-optional-symbols` |
| background.js | 35431772 | Kg(ye,["/bapi/futures/v1/private/future/user-setting/update-optional-symbols"]); | `/bapi/futures/v1/private/future/user-setting/update-optional-symbols` |
| background.js | 35432462 | Kg(es,["/bapi/futures/v1/private/future/user-data/adjustLeverage"]); | `/bapi/futures/v1/private/future/user-data/adjustLeverage` |
| background.js | 35433140 | Kg(pe,["/bapi/futures/v1/public/future/asset/ae/all-asset-logo"]); | `/bapi/futures/v1/public/future/asset/ae/all-asset-logo` |
| background.js | 35433499 | PerpetualApiClientImpl$getExchangeInfo$lambda | `/fapi/v1/astherusExchangeInfo` |
| background.js | 35433607 | PerpetualApiClientImpl$getTickers$lambda | `/fapi/v1/ticker/24hr` |
| background.js | 35433704 | PerpetualApiClientImpl$getPairs$lambda | `/bapi/future/v1/public/future/aster/ticker/pair` |
| background.js | 35433858 | PerpetualApiClientImpl$getKlines$lambda | `/fapi/v1/continuousKlines` |
| background.js | 35434164 | Kg(ye,["/bapi/futures/v1/friendly/future/common/brackets"]); | `/bapi/futures/v1/friendly/future/common/brackets` |
| background.js | 35434739 | Kg(ye,["/bapi/futures/v5/private/future/user-data/user-position"]); | `/bapi/futures/v5/private/future/user-data/user-position` |
| background.js | 35435316 | Kg(pe,["/bapi/futures/v2/private/future/order/open-orders"]); | `/bapi/futures/v2/private/future/order/open-orders` |
| background.js | 35435691 | Kg(es,["/bapi/futures/v1/private/future/strategy/query-open-strategy"]); | `/bapi/futures/v1/private/future/strategy/query-open-strategy` |
| background.js | 35436381 | Kg(es,["/bapi/futures/v1/private/future/order/cancel-order"]); | `/bapi/futures/v1/private/future/order/cancel-order` |
| background.js | 35437053 | Kg(ye,["/bapi/futures/v1/private/future/order/cancel-orders"]); | `/bapi/futures/v1/private/future/order/cancel-orders` |
| background.js | 35437630 | Kg(pe,["/bapi/futures/v2/private/future/order/clear-position"]); | `/bapi/futures/v2/private/future/order/clear-position` |
| background.js | 35438334 | Kg(pe,["/bapi/futures/v1/private/future/user-data/get-join-margin"]); | `/bapi/futures/v1/private/future/user-data/get-join-margin` |
| background.js | 35438713 | Kg(ye,["/bapi/futures/v1/private/future/user-data/change-join-margin"]); | `/bapi/futures/v1/private/future/user-data/change-join-margin` |
| background.js | 35439377 | Kg(pe,["/bapi/futures/v1/private/future/user-data/userLeverage"]); | `/bapi/futures/v1/private/future/user-data/userLeverage` |
| background.js | 35439765 | PerpetualApiClientImpl$getNetworkDepositAddress$lambda | `/bapi/futures/v1/private/future/web3/deposit-address` |
| background.js | 35439929 | PerpetualApiClientImpl$getOrderHistory$lambda | `/bapi/futures/v1/private/future/order/order-history` |
| background.js | 35440064 | PerpetualApiClientImpl$getTradeHistory$lambda | `/bapi/futures/v1/private/future/user-data/trade-history` |
| background.js | 35440209 | PerpetualApiClientImpl$getTransactionHistory$lambda | `/bapi/futures/v1/private/future/user-data/transaction-history` |
| background.js | 35440382 | Kg(ye,["/bapi/futures/v1/private/future/web3/ae/depositAndWithdraw/history"]); | `/bapi/futures/v1/private/future/web3/ae/depositAndWithdraw/history` |
| background.js | 35441042 | PerpetualApiClientImpl$getAccountTierCommission$lambda | `/bapi/futures/v1/private/future/user-data/account-tier-commission` |
| background.js | 35441211 | Kg(ye,["/bapi/futures/v1/private/future/user-data/user-listen-key"]); | `/bapi/futures/v1/private/future/user-data/user-listen-key` |
| background.js | 36734227 | GasStationClient$getFeeHistory$lambda | `/v1/fee/history/` |
| background.js | 36734355 | GasStationClient$getFeePriority$lambda | `/v1/fee/priority/` |
| background.js | 37434640 | TransactionApiClientImpl$getTransaction$lambda | `/v1/txhub/txs/` |
| background.js | 37851137 | ud(ye,["/v1/odd/portfolio"]),wd(ae,ld().f6d_1); | `/v1/odd/portfolio` |
| background.js | 37851776 | ud(ns,["/v1/odd/positions"]); | `/v1/odd/positions` |
| background.js | 37852465 | ud(es,["/v1/odd/trades"]),wd(ae,ld().f6d_1); | `/v1/odd/trades` |
| background.js | 37853100 | ud(ss,["/v1/odd/trades/create"]),wd(ae,ld().f6d_1); | `/v1/odd/trades/create` |
| background.js | 37853742 | PredictionApiClientImpl$getCategories$lambda | `/v1/odd/categories` |
| background.js | 37853841 | PredictionApiClientImpl$getNetworks$lambda | `/v1/odd/networks` |
| background.js | 37853959 | ud(ss,["/v1/odd/markets"]); | `/v1/odd/markets` |
| background.js | 37854295 | ud(ye,["/v1/odd/markets",ae]); | `/v1/odd/markets` |
| background.js | 37854586 | PredictionApiClientImpl$getQuote$lambda | `/v1/odd/markets/` |
| background.js | 37854956 | PredictionApiClientImpl$getOutcomePrices$lambda | `/v1/odd/markets` |
| background.js | 37855093 | PredictionApiClientImpl$getBatchOutcomes$lambda | `/v1/odd/markets/batch_outcomes` |
| background.js | 37855265 | ud(ye,["/v1/odd/auth"]),wd(ae,ld().f6d_1); | `/v1/odd/auth` |
| background.js | 37855856 | ud(ye,["/v1/odd/order"]),wd(ae,ld().f6d_1); | `/v1/odd/order` |
| background.js | 38251795 | NamingClient$lookup$lambda | `/v1/lookup` |
| background.js | 38356321 | getMultiCoinWalletIconUrl | `/assets/0x4B0F1812e5Df2A09796481Ff14017e6005508003/logo.png` |
| background.js | 38359009 | WalletAggregationApiClientImpl$getWalletMetaFromRegistry$lambda | `/v1/wallets/` |
| background.js | 38359173 | WalletAggregationApiClientImpl$getWalletMetaLegacy$lambda | `/v3/devices/` |
| background.js | 38669533 | qs(ye,["/analytics/v1/events"]); | `/analytics/v1/events` |
| background.js | 38947504 | ye | `/assets/` |
| background.js | 39375910 | init_authentication_interceptor(),init_app$3(),init_constants$8(),init_api_constants(),init_store$1( | `/v2/devices/fingerprint` |
| background.js | 39462520 | init_api_constants(),init_priceImpactLevels_utils(),init_logger$1(),AMBER_STEP_PATH | `/amber-api/v1/route` |
| background.js | 39606326 | es | `${…}/v1/wizard/${…}` |
| background.js | 39606764 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/devices/${…}` |
| background.js | 39607129 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/devices/fingerprint` |
| background.js | 39607266 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/devices/${…}` |
| background.js | 39607350 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/devices/${…}/metrics` |
| background.js | 39607475 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/devices/${…}/wallets/${…}/register` |
| background.js | 39607725 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/devices/${…}/wallets/${…}/address_association` |
| background.js | 39607908 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/devices/${…}/wallets/${…}/meta` |
| background.js | 39608498 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/search/assets?networks={redactedValue}&${…}` |
| background.js | 39608640 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/discover/new` |
| background.js | 39608823 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/discover/search` |
| background.js | 39608955 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/${…}` |
| background.js | 39609036 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets?asset_ids={redactedValue}` |
| background.js | 39609139 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/symbols/${…}` |
| background.js | 39609254 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/symbols?symbols={redactedValue}` |
| background.js | 39609484 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets` |
| background.js | 39609670 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/balances/stream` |
| background.js | 39609829 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `https://dex.binance.org/api/v1/tokens?limit={redactedValue}` |
| background.js | 39609933 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/market/charts/${…}?currency={redactedValue}&period={redactedValue}` |
| background.js | 39610092 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/listing-categories` |
| background.js | 39610199 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/tabs-config` |
| background.js | 39610301 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/trending-config` |
| background.js | 39610739 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/listings?${…}` |
| background.js | 39610888 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/market/info/${…}?currency={redactedValue}` |
| background.js | 39611010 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/symbols/similar/${…}/count` |
| background.js | 39611129 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/assets/symbols/similar/${…}` |
| background.js | 39611515 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/nft/collections?${…}` |
| background.js | 39611930 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/nft/chains/${…}/collections/${…}/tokens?${…}` |
| background.js | 39612067 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/nft/chains/${…}/contracts/${…}/tokens/${…}` |
| background.js | 39612196 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/request/${…}?address={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| background.js | 39612401 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/quotes/${…}?amount={redactedValue}&address={redactedValue}&currency={redactedValue}&twt_amount={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| background.js | 39612582 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/buycrypto/config/${…}?wallet_id={redactedValue}&is_asset_recommendation_required={redactedValue}` |
| background.js | 39612740 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/buycrypto/assets` |
| background.js | 39613275 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/buycrypto/${…}/routes` |
| background.js | 39613889 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/widget/quote?${…}` |
| background.js | 39614079 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/sellcrypto/quote/${…}?amount={redactedValue}&address={redactedValue}&currency={redactedValue}&twt_amount={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| background.js | 39614261 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/sellcrypto/request/${…}?address={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| background.js | 39614511 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/coinstatus/${…}?${…}` |
| background.js | 39614737 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/discover/group/invest-staking?currency={redactedValue}` |
| background.js | 39614875 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/validate/address` |
| background.js | 39615005 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/validate/url` |
| background.js | 39615106 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/validate/transaction` |
| background.js | 39615252 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/validate/message` |
| background.js | 39615413 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/txhub/txs` |
| background.js | 39615598 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/txhub/bulk_history` |
| background.js | 39615743 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/devices/${…}` |
| background.js | 39615885 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/devices/${…}/push-topics` |
| background.js | 39615990 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/centrifugo-hooks/token` |
| background.js | 39616090 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/balances/chains` |
| background.js | 39616181 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/amber-api/v2/session` |
| background.js | 39616282 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/amber-api/v2/session/status` |
| background.js | 39616386 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/amber-api/v2/session/close` |
| background.js | 39616490 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/amber-api/v1/history/status` |
| background.js | 39616629 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/amber-api/v2/route/step` |
| background.js | 39616740 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/market/sentiment-assets` |
| background.js | 39616838 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/market/sentiment/${…}` |
| background.js | 39616930 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/announcements?strategy={redactedValue}&version={redactedValue}&platform={redactedValue}&device_id={redactedValue}` |
| background.js | 39617102 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v2/announcements/seen` |
| background.js | 39617231 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/cex-transfer/providers/${…}/assets` |
| background.js | 39617355 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/cex-transfer/providers/${…}` |
| background.js | 39617596 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/cex-transfer/providers/${…}/transactions/${…}` |
| background.js | 39617723 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/homepage` |
| background.js | 39617911 | ye | `${…}/v1/lookup` |
| background.js | 39618197 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/approvals/scan` |
| background.js | 39618306 | VariableDeclarator | `${…}/v1/buycrypto/screens/funding` |
| background.js | 39618426 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v3/points/${…}/vip` |
| background.js | 39618524 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/p2p/config` |
| background.js | 39618669 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/p2p/quotes` |
| background.js | 39618858 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/p2p/checkout` |
| background.js | 39619003 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_math_utils(),init_api_constants(),init | `${…}/v1/buycrypto/route/recurring/checkout` |
| background.js | 39658646 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_fiat$1(),init_store$1(),init_asset$1() | `${…}/v2/market/tickers` |
| background.js | 39658704 | init_injectable_decorator(),init_logger$1(),init_fetch(),init_fiat$1(),init_store$1(),init_asset$1() | `${…}/v2/market/rates` |
| background.js | 39719999 | init_asset$1(),init_blockchains$1(),init_wallet$2(),init_ticker_service(),init_api_constants(),init_ | `${…}/v1/assets/${…}` |
| background.js | 40198943 | ye | `eth-mainnet.alchemyapi.io/v2/` |
| background.js | 40198997 | ye | `eth-goerli.g.alchemy.com/v2/` |
| background.js | 40199051 | ye | `eth-sepolia.g.alchemy.com/v2/` |
| background.js | 40199104 | ye | `polygon-mainnet.g.alchemy.com/v2/` |
| background.js | 40199164 | ye | `polygon-mumbai.g.alchemy.com/v2/` |
| background.js | 40199223 | ye | `arb-mainnet.g.alchemy.com/v2/` |
| background.js | 40199286 | ye | `arb-goerli.g.alchemy.com/v2/` |
| background.js | 40199349 | ye | `arb-sepolia.g.alchemy.com/v2/` |
| background.js | 40199405 | ye | `opt-mainnet.g.alchemy.com/v2/` |
| background.js | 40199468 | ye | `opt-goerli.g.alchemy.com/v2/` |
| background.js | 40199531 | ye | `opt-sepolia.g.alchemy.com/v2/` |
| background.js | 40206871 | init_lib_esm$29(),init_lib_esm$24(),init_lib_esm$15(),init_lib_esm$4(),init_formatter(),init_lib_esm | `${…}/api?module={redactedValue}` |
| background.js | 40206935 | init_lib_esm$29(),init_lib_esm$24(),init_lib_esm$15(),init_lib_esm$4(),init_formatter(),init_lib_esm | `${…}/api` |
| background.js | 40221333 | super(es.url.replace(/^http/i,"ws").replace("/v3/","/ws/v3/"),ae),defineReadOnly(this,"apiKey",ye.pr | `/v3/` |
| background.js | 40221340 | super(es.url.replace(/^http/i,"ws").replace("/v3/","/ws/v3/"),ae),defineReadOnly(this,"apiKey",ye.pr | `/ws/v3/` |
| background.js | 40223017 | es | `/v3/` |
| background.js | 40224992 | ye | `https://ethereum.api.nodesmith.io/v1/mainnet/jsonrpc` |
| background.js | 40225070 | ye | `https://ethereum.api.nodesmith.io/v1/ropsten/jsonrpc` |
| background.js | 40225148 | ye | `https://ethereum.api.nodesmith.io/v1/rinkeby/jsonrpc` |
| background.js | 40225225 | ye | `https://ethereum.api.nodesmith.io/v1/goerli/jsonrpc` |
| background.js | 40225300 | ye | `https://ethereum.api.nodesmith.io/v1/kovan/jsonrpc` |
| background.js | 40226781 | es | `https://${…}/v1/lb/${…}` |
| background.js | 42525639 | getRelayQuote | `/v1/perps/relay/quote` |
| background.js | 42525714 | getRelayWithdrawQuote | `/v1/perps/relay/quote` |
| background.js | 42525813 | VariableDeclarator | `${…}/v1/perps/relay/status` |
| background.js | 42525973 | relayAuthorize | `/v1/perps/relay/authorize` |
| background.js | 42653263 | this.btsFilename | `https://bin.bnbstatic.com/api/i18n/-/web/cms/sp/86a37593e` |
| background.js | 42701848 | init_dist$6(),init_injectable_decorator(),init_use_decorator(),import_crypto_browserify | `${…}/extdata/api` |
| chunks/App-D29UTaP5.js | 1495519 | vc.includes(T)?F(`/fund/cex/${T}/platform`,{state:{pageViewSource:L,assetId:g,walletAddress:M,return | `/fund/cex/${…}/platform/assets` |
| chunks/App-D29UTaP5.js | 1643432 | vc.includes(g)?M(`/fund/cex/${g}/platform`):M(`/fund/cex/${g}/assets`) | `/fund/cex/${…}/assets` |
| chunks/App-D29UTaP5.js | 1643862 | vc.includes(g)?M(`/fund/cex/${g}/platform`):M(`/fund/cex/${g}/assets`) | `/fund/cex/${…}/assets` |
| chunks/App-D29UTaP5.js | 1644060 | M&&Object.values(Cc).includes(M)?vc.includes(M)?g(`/fund/cex/${M}/platform`):g(`/fund/cex/${M}/asset | `/fund/cex/${…}/assets` |
| chunks/App-D29UTaP5.js | 1647346 | R?.assetId&&R?.pageViewSource&&R?.walletAddress?I({providerId:T,assetId:R.assetId,walletAddress:R.wa | `/fund/cex/${…}/platform/assets` |
| chunks/App-D29UTaP5.js | 1650948 | Fund | `/cex/:providerId/assets` |
| chunks/App-D29UTaP5.js | 1651036 | Fund | `/cex/:providerId/platform/assets` |
| chunks/Completed-5mEUoaUY.js | 521719 | D | `/assets/pancakeswap-banner-DZpaafr7.png` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 8628 | Q | `/assets/united-states-of-america-C9ERacrM.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 22231 | Q | `/assets/india-Csk9noVw.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 27845 | Q | `/assets/hong-kong-HcvRMPsC.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 40786 | Q | `/assets/sri-lanka-DgxnyHoc.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 41725 | Q | `/assets/cambodia-Bt6gDOGV.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 47825 | Q | `/assets/afghanistan-CsKYyZ-O.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 53763 | Q | `/assets/croatia-B0zsQ2vW.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 57008 | Q | `/assets/belarus-BVsKJ3k9.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 62759 | Q | `/assets/kazakhstan-DJNazIsM.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 62804 | Q | `/assets/kyrgyzstan-Bi9x4EJ9.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 62849 | Q | `/assets/tajikistan-BmaBD9og.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 62896 | Q | `/assets/turkmenistan-DblmPcwx.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 67948 | Q | `/assets/serbia-BUSu7EYB.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 67986 | Q | `/assets/albania-BjJ1avUQ.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 69707 | Q | `/assets/moldova-Bzo9LuiK.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 70543 | Q | `/assets/saudi-arabia-BZ_cx4GS.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 76874 | Q | `/assets/lebanon-HOKyPZ8n.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 78006 | Q | `/assets/iraq-BkkwHn7o.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 78039 | Q | `/assets/iran-BT1EUQ5H.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 79852 | Q | `/assets/egypt-ZjynIeoE.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 85191 | Q | `/assets/uganda-SiuVDWhy.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 98582 | Q | `/assets/mozambique-CkZqjPvY.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 98623 | Q | `/assets/zambia-B5r5a3c-.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 98662 | Q | `/assets/zimbabwe-Db4o2_PD.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 101552 | Q | `/assets/swaziland-q3iZyRpv.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 106000 | Q | `/assets/malawi-Civw-rQ3.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 113928 | Q | `/assets/eritrea-Eo9t8nA_.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 127550 | Q | `/assets/brazil-DTI3tvGv.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 127587 | Q | `/assets/mexico-BngtIIkt.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 127627 | Q | `/assets/argentina-Cg82Ylbx.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 129615 | Q | `/assets/peru-ChRzNXuO.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 133022 | Q | `/assets/guatemala-TBTmapAJ.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 134711 | Q | `/assets/nicaragua-BSnMObiw.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 136528 | Q | `/assets/paraguay-DgyvZ7TT.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 136568 | Q | `/assets/uruguay-CRpCZfTx.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 136620 | Q | `/assets/dominican-republic-BGSroZ64.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 137773 | Q | `/assets/haiti-DNSlBEht.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 142140 | Q | `/assets/belize-DcZw9n54.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 142184 | Q | `/assets/salvador-BKVcY04Y.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 147782 | Q | `/assets/cayman-islands-BaxbQge-.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 147828 | Q | `/assets/bermuda-DwIjt2EI.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 147878 | Q | `/assets/falkland-islands-CwbdmWD-.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 150810 | Q | `/assets/fiji-zQzdujBf.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 150857 | Q | `/assets/papua-new-guinea-UJ1OCN3W.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 155181 | Q | `/assets/vanuatu-BPYUiCYa.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 155231 | Q | `/assets/french-polynesia-yQmRf4iM.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 155278 | Q | `/assets/brunei-B-lIuWKT.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 156527 | Q | `/assets/mongolia-BTSpGoss.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 172168 | Q | `/assets/united-nations-CxCCch4j.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 173037 | Q | `/assets/isle-of-man-Cjan8YiI.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 173079 | Q | `/assets/jersey-BLZaUINV.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 173119 | Q | `/assets/gibraltar-Dwq5exM5.svg` |
| chunks/SelectProviderItem-dJ2hTZYn.js | 177515 | getAssetImageUrls | `${…}/blockchains/${…}/assets/${…}/logo.png` |
| chunks/TransactionSenderRow-ctp5_55S.js | 3697 | TransactionRecipientRow | `${…}/address/${…}` |
| chunks/TransactionSenderRow-ctp5_55S.js | 5088 | y | `/address/` |
| chunks/asset-COrXZQtQ.js | 59131 | AssetAbout | `${…}/address/${…}` |
| chunks/constants-BML4aAnK.js | 14993 | l | `/assets/P2P-A7NbmPSP.png` |
| chunks/constants-BML4aAnK.js | 48709 | l | `/assets/PSE-ByBkIjEB.png` |
| chunks/fetch-BWDPg6HI.js | 56479 | Rn | `/v2/devices/fingerprint` |
| chunks/fiat-ramps-BdoaGdC5.js | 141105 | VariableDeclarator | `${…}/v1/${…}/config/${…}` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 13187 | Ne | `/assets/trust-wallet-1-BsoWnpIo.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 13470 | Ne | `/assets/trust-wallet-2-BcexborV.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 13756 | Ne | `/assets/trust-wallet-3-Bhyn5ruu.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 14052 | Ne | `/assets/trust-wallet-extension-1-BFRN1GFu.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 14371 | Ne | `/assets/trust-wallet-extension-2-DPWgc1fl.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 14634 | Ne | `/assets/trust-wallet-extension-3-5r-CgMms.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 15519 | Ne | `/assets/generic-1-BMQaBaYP.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 15777 | Ne | `/assets/generic-2-C7xANjS3.gif` |
| chunks/import-mnemonic-or-private-key-CXfCQtf3.js | 16101 | Ne | `/assets/generic-3-B4T264Cr.gif` |
| chunks/ledger-9TVWcyBQ.js | 193726 | VariableDeclarator | `${…}/v1/dapps` |
| chunks/ledger-9TVWcyBQ.js | 362259 | Tc | `https://nft.api.live.ledger.com/v1/ethereum` |
| chunks/ledger-9TVWcyBQ.js | 400888 | Ro | `https://explorers.api.live.ledger.com/blockchain/v4/eth/ens/resolve/{name}` |
| chunks/ledger-9TVWcyBQ.js | 400973 | Ro | `https://explorers.api.live.ledger.com/blockchain/v4/eth/ens/reverse-resolve/{address}` |
| chunks/ledger-9TVWcyBQ.js | 401082 | Ro | `https://nft.api.live.ledger.com/v1/names/ens/forward/{name}?challenge={redactedValue}` |
| chunks/ledger-9TVWcyBQ.js | 401174 | Ro | `https://nft.api.live.ledger.com/v1/names/ens/reverse/{address}?challenge={redactedValue}` |
| chunks/ledger-9TVWcyBQ.js | 1302854 | q | `/api/v1/broadcast` |
| chunks/ledger-9TVWcyBQ.js | 1302883 | q | `/api/v1/node-info` |
| chunks/ledger-9TVWcyBQ.js | 1302914 | q | `/api/v1/account` |
| chunks/ledger-9TVWcyBQ.js | 1302943 | q | `/api/v1/markets` |
| chunks/ledger-9TVWcyBQ.js | 1302970 | q | `/api/v1/atomic-swaps` |
| chunks/ledger-9TVWcyBQ.js | 1303007 | q | `/api/v1/orders/open` |
| chunks/ledger-9TVWcyBQ.js | 1303038 | q | `/api/v1/depth` |
| chunks/ledger-9TVWcyBQ.js | 1303070 | q | `/api/v1/transactions` |
| chunks/ledger-9TVWcyBQ.js | 1303100 | q | `/bc/api/v1/txs` |
| chunks/ledger-9TVWcyBQ.js | 1303123 | q | `/api/v1/tx` |
| chunks/ledger-9TVWcyBQ.js | 1582554 | VariableDeclarator | `${…}/api/v1/account/${…}` |
| chunks/ledger-9TVWcyBQ.js | 1582603 | VariableDeclarator | `${…}/api/v1/node-info` |
| chunks/logger-BMfNJZDI.js | 37974 | getEnvelopeEndpointWithUrlEncodedAuth | `${…}//${…}${…}${…}/api/` |
| chunks/network-BgRJPftY.js | 142665 | s | `${…}/v1/wizard/${…}` |
| chunks/network-BgRJPftY.js | 143012 | xa | `${…}/v2/devices/${…}` |
| chunks/network-BgRJPftY.js | 143307 | xa | `${…}/v2/devices/fingerprint` |
| chunks/network-BgRJPftY.js | 143395 | xa | `${…}/v2/devices/${…}` |
| chunks/network-BgRJPftY.js | 143454 | xa | `${…}/v1/devices/${…}/metrics` |
| chunks/network-BgRJPftY.js | 143542 | xa | `${…}/v3/devices/${…}/wallets/${…}/register` |
| chunks/network-BgRJPftY.js | 143755 | xa | `${…}/v3/devices/${…}/wallets/${…}/address_association` |
| chunks/network-BgRJPftY.js | 143907 | xa | `${…}/v3/devices/${…}/wallets/${…}/meta` |
| chunks/network-BgRJPftY.js | 144367 | xa | `${…}/v1/search/assets?networks={redactedValue}&${…}` |
| chunks/network-BgRJPftY.js | 144481 | xa | `${…}/v1/discover/new` |
| chunks/network-BgRJPftY.js | 144637 | xa | `${…}/v1/discover/search` |
| chunks/network-BgRJPftY.js | 144744 | xa | `${…}/v1/assets/${…}` |
| chunks/network-BgRJPftY.js | 144800 | xa | `${…}/v1/assets?asset_ids={redactedValue}` |
| chunks/network-BgRJPftY.js | 144878 | xa | `${…}/v1/assets/symbols/${…}` |
| chunks/network-BgRJPftY.js | 144966 | xa | `${…}/v1/assets/symbols?symbols={redactedValue}` |
| chunks/network-BgRJPftY.js | 145162 | xa | `${…}/v1/assets` |
| chunks/network-BgRJPftY.js | 145308 | xa | `${…}/v1/balances/stream` |
| chunks/network-BgRJPftY.js | 145443 | xa | `https://dex.binance.org/api/v1/tokens?limit={redactedValue}` |
| chunks/network-BgRJPftY.js | 145541 | xa | `${…}/v2/market/charts/${…}?currency={redactedValue}&period={redactedValue}` |
| chunks/network-BgRJPftY.js | 145674 | xa | `${…}/v1/assets/listing-categories` |
| chunks/network-BgRJPftY.js | 145758 | xa | `${…}/v1/assets/tabs-config` |
| chunks/network-BgRJPftY.js | 145837 | xa | `${…}/v1/assets/trending-config` |
| chunks/network-BgRJPftY.js | 146196 | xa | `${…}/v1/assets/listings?${…}` |
| chunks/network-BgRJPftY.js | 146298 | xa | `${…}/v2/market/info/${…}?currency={redactedValue}` |
| chunks/network-BgRJPftY.js | 146394 | xa | `${…}/v1/assets/symbols/similar/${…}/count` |
| chunks/network-BgRJPftY.js | 146488 | xa | `${…}/v1/assets/symbols/similar/${…}` |
| chunks/network-BgRJPftY.js | 146780 | xa | `${…}/v3/nft/collections?${…}` |
| chunks/network-BgRJPftY.js | 147097 | xa | `${…}/v3/nft/chains/${…}/collections/${…}/tokens?${…}` |
| chunks/network-BgRJPftY.js | 147205 | xa | `${…}/v3/nft/chains/${…}/contracts/${…}/tokens/${…}` |
| chunks/network-BgRJPftY.js | 147304 | xa | `${…}/v1/buycrypto/request/${…}?address={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| chunks/network-BgRJPftY.js | 147475 | xa | `${…}/v1/buycrypto/quotes/${…}?amount={redactedValue}&address={redactedValue}&currency={redactedValue}&twt_amount={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| chunks/network-BgRJPftY.js | 147623 | xa | `${…}/v3/buycrypto/config/${…}?wallet_id={redactedValue}&is_asset_recommendation_required={redactedValue}` |
| chunks/network-BgRJPftY.js | 147754 | xa | `${…}/v2/buycrypto/assets` |
| chunks/network-BgRJPftY.js | 148243 | xa | `${…}/v3/buycrypto/${…}/routes` |
| chunks/network-BgRJPftY.js | 148805 | xa | `${…}/v1/buycrypto/widget/quote?${…}` |
| chunks/network-BgRJPftY.js | 148964 | xa | `${…}/v1/sellcrypto/quote/${…}?amount={redactedValue}&address={redactedValue}&currency={redactedValue}&twt_amount={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| chunks/network-BgRJPftY.js | 149112 | xa | `${…}/v1/sellcrypto/request/${…}?address={redactedValue}&ts={redactedValue}&sig={redactedValue}` |
| chunks/network-BgRJPftY.js | 149319 | xa | `${…}/v1/coinstatus/${…}?${…}` |
| chunks/network-BgRJPftY.js | 149499 | xa | `${…}/v1/discover/group/invest-staking?currency={redactedValue}` |
| chunks/network-BgRJPftY.js | 149611 | xa | `${…}/v1/validate/address` |
| chunks/network-BgRJPftY.js | 149714 | xa | `${…}/v1/validate/url` |
| chunks/network-BgRJPftY.js | 149790 | xa | `${…}/v1/validate/transaction` |
| chunks/network-BgRJPftY.js | 149891 | xa | `${…}/v1/validate/message` |
| chunks/network-BgRJPftY.js | 150001 | xa | `${…}/v1/txhub/txs` |
| chunks/network-BgRJPftY.js | 150152 | xa | `${…}/v1/txhub/bulk_history` |
| chunks/network-BgRJPftY.js | 150267 | xa | `${…}/v2/devices/${…}` |
| chunks/network-BgRJPftY.js | 150380 | xa | `${…}/v2/devices/${…}/push-topics` |
| chunks/network-BgRJPftY.js | 150460 | xa | `${…}/v1/centrifugo-hooks/token` |
| chunks/network-BgRJPftY.js | 150537 | xa | `${…}/v1/balances/chains` |
| chunks/network-BgRJPftY.js | 150604 | xa | `${…}/amber-api/v2/session` |
| chunks/network-BgRJPftY.js | 150680 | xa | `${…}/amber-api/v2/session/status` |
| chunks/network-BgRJPftY.js | 150759 | xa | `${…}/amber-api/v2/session/close` |
| chunks/network-BgRJPftY.js | 150838 | xa | `${…}/amber-api/v1/history/status` |
| chunks/network-BgRJPftY.js | 150952 | xa | `${…}/amber-api/v2/route/step` |
| chunks/network-BgRJPftY.js | 151039 | xa | `${…}/v2/market/sentiment-assets` |
| chunks/network-BgRJPftY.js | 151113 | xa | `${…}/v2/market/sentiment/${…}` |
| chunks/network-BgRJPftY.js | 151179 | xa | `${…}/v2/announcements?strategy={redactedValue}&version={redactedValue}&platform={redactedValue}&device_id={redactedValue}` |
| chunks/network-BgRJPftY.js | 151324 | xa | `${…}/v2/announcements/seen` |
| chunks/network-BgRJPftY.js | 151427 | xa | `${…}/v1/cex-transfer/providers/${…}/assets` |
| chunks/network-BgRJPftY.js | 151521 | xa | `${…}/v1/cex-transfer/providers/${…}` |
| chunks/network-BgRJPftY.js | 151729 | xa | `${…}/v1/cex-transfer/providers/${…}/transactions/${…}` |
| chunks/network-BgRJPftY.js | 151828 | xa | `${…}/v1/homepage` |
| chunks/network-BgRJPftY.js | 151987 | a | `${…}/v1/lookup` |
| chunks/network-BgRJPftY.js | 152228 | xa | `${…}/v1/approvals/scan` |
| chunks/network-BgRJPftY.js | 152312 | VariableDeclarator | `${…}/v1/buycrypto/screens/funding` |
| chunks/network-BgRJPftY.js | 152407 | xa | `${…}/v3/points/${…}/vip` |
| chunks/network-BgRJPftY.js | 152480 | xa | `${…}/v1/buycrypto/p2p/config` |
| chunks/network-BgRJPftY.js | 152596 | xa | `${…}/v1/buycrypto/p2p/quotes` |
| chunks/network-BgRJPftY.js | 152753 | xa | `${…}/v1/buycrypto/p2p/checkout` |
| chunks/network-BgRJPftY.js | 152870 | xa | `${…}/v1/buycrypto/route/recurring/checkout` |
| chunks/sell-DEKcDK89.js | 2749 | VariableDeclarator | `${…}/v1/sellcrypto/config/${…}?wallet_id={redactedValue}` |
| chunks/useAnalytics-COpZR7i2.js | 347595 | xo | `/sdk/v2/vardata?v={redactedValue}` |
| chunks/useAnalytics-COpZR7i2.js | 348725 | ko | `/sdk/v2/flags` |
| chunks/utils-CrqWOcqs.js | 168153 | parseAbiParameter2 | `/api/human.html#parseabiparameter-1` |
| chunks/walletkit.service-C_NgWHzp.js | 6284604 | ne | `https://o4507686279512064.ingest.us.sentry.io/api/4507883689476096/envelope/` |
| chunks/walletkit.service-C_NgWHzp.js | 6298217 | this.a1u1_1 | `https://o4507686279512064.ingest.us.sentry.io/api/4508601602736129/envelope/` |
| chunks/walletkit.service-C_NgWHzp.js | 6310949 | me(Transaction,"Transaction"),me(AnalyticError,"AnalyticError"),me(NoOpEventLogger,"NoOpEventLogger" | `https://o4507686279512064.ingest.us.sentry.io/api/4508601602736129/envelope/` |
| chunks/walletkit.service-C_NgWHzp.js | 6353574 | getValidatorImageUrl | `/validators/assets/` |
| chunks/walletkit.service-C_NgWHzp.js | 6357467 | TrustFingerPrintRpcClient$getDeviceFingerPrint$lambda | `/v2/devices/fingerprint` |
| chunks/walletkit.service-C_NgWHzp.js | 6357860 | GasPriceRemoteService$execute$lambda | `/v1/gas/price/` |
| chunks/walletkit.service-C_NgWHzp.js | 6425625 | HttpNaasNodeRemoteStorage$loadNodes$lambda | `/v2/projects/` |
| chunks/walletkit.service-C_NgWHzp.js | 6659545 | this.bkx_1 | `/v2/nodes?network={redactedValue}` |
| chunks/walletkit.service-C_NgWHzp.js | 6846386 | BitcoinRemoteFeeService$execute$lambda | `/v1/fee/priority/` |
| chunks/walletkit.service-C_NgWHzp.js | 6849387 | BitcoinRemoteFeeTypeService$execute$lambda | `/v1/fee/type/` |
| chunks/walletkit.service-C_NgWHzp.js | 6858664 | BitcoinRpcClient$getBalance$lambda | `/api/v2/address/` |
| chunks/walletkit.service-C_NgWHzp.js | 6858701 | BitcoinRpcClient$getBalance$lambda | `/api/v2/xpub/` |
| chunks/walletkit.service-C_NgWHzp.js | 6858856 | BitcoinRpcClient$broadcastTransaction$lambda$lambda | `/api/v2/sendtx/` |
| chunks/walletkit.service-C_NgWHzp.js | 6859233 | BitcoinRpcClient$getTransaction$lambda | `/api/v2/tx/` |
| chunks/walletkit.service-C_NgWHzp.js | 6859986 | BitcoinRpcClient$getUnspentOutputs$lambda | `/api/v2/utxo/` |
| chunks/walletkit.service-C_NgWHzp.js | 6860237 | BitcoinRpcClient$estimateFee$lambda$lambda | `/api/v2/estimatefee/2` |
| chunks/walletkit.service-C_NgWHzp.js | 6860464 | BitcoinRpcClient$getZcashBranchId$lambda$lambda | `/api/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 6936302 | this.n194_1 | `/api/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 6939138 | this.oa_1 | `/api/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 6971617 | BitcoinRpcClient$getBalance$lambda | `/api/v2/address/` |
| chunks/walletkit.service-C_NgWHzp.js | 6971775 | BitcoinRpcClient$broadcastTransaction$lambda$lambda | `/api/v2/sendtx/` |
| chunks/walletkit.service-C_NgWHzp.js | 6972152 | BitcoinRpcClient$getTransaction$lambda | `/api/v2/tx/` |
| chunks/walletkit.service-C_NgWHzp.js | 6972287 | BitcoinRpcClient$getUnspentOutputs$lambda$lambda | `/api/v2/utxo/` |
| chunks/walletkit.service-C_NgWHzp.js | 6972800 | BitcoinRpcClient$getDerivationPaths$lambda | `/api/v2/utxo/` |
| chunks/walletkit.service-C_NgWHzp.js | 6973033 | BitcoinRpcClient$getZcashBranchId$lambda$lambda | `/api/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 6973231 | BitcoinRpcClient$estimateFee$lambda$lambda | `/api/v2/estimatefee/2` |
| chunks/walletkit.service-C_NgWHzp.js | 6986221 | BitcoinRemoteFeeService$execute$lambda | `/v1/fee/priority/` |
| chunks/walletkit.service-C_NgWHzp.js | 7037230 | this.f1a1_1 | `/api/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 7040066 | this.oa_1 | `/api/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 7183498 | BscRpcStakingClient$getValidators$lambda | `/v1/validator/all` |
| chunks/walletkit.service-C_NgWHzp.js | 7392487 | $n(Companion),qn($calculateFeeCOROUTINE$0,Mn),Fn(AcalaEvmFeeService,"AcalaEvmFeeService",Ln,Ln,[Dn], | `/v2` |
| chunks/walletkit.service-C_NgWHzp.js | 7460817 | $n(Companion),qn($calculateFeeCOROUTINE$0,Mn),Fn(AcalaEvmFeeService,"AcalaEvmFeeService",Ln,Ln,[Dn], | `/v1` |
| chunks/walletkit.service-C_NgWHzp.js | 7483937 | $n(Companion),qn($calculateFeeCOROUTINE$0,Mn),Fn(AcalaEvmFeeService,"AcalaEvmFeeService",Ln,Ln,[Dn], | `/v2/` |
| chunks/walletkit.service-C_NgWHzp.js | 7599381 | CosmosNodeRpcClient$isSynced$lambda | `/cosmos/base/tendermint/v1beta1/syncing` |
| chunks/walletkit.service-C_NgWHzp.js | 7599911 | CosmosRpcClient$getBalance$lambda | `/cosmos/bank/v1beta1/balances/` |
| chunks/walletkit.service-C_NgWHzp.js | 7600167 | CosmosRpcClient$getUnbondingDelegations$lambda | `/cosmos/staking/v1beta1/delegators/` |
| chunks/walletkit.service-C_NgWHzp.js | 7600427 | CosmosRpcClient$getRewards$lambda | `/cosmos/distribution/v1beta1/delegators/` |
| chunks/walletkit.service-C_NgWHzp.js | 7600692 | CosmosRpcClient$getAccountDetails$lambda | `/cosmos/auth/v1beta1/accounts/` |
| chunks/walletkit.service-C_NgWHzp.js | 7600930 | CosmosRpcClient$getNodeInfo$lambda$lambda | `/cosmos/base/tendermint/v1beta1/node_info` |
| chunks/walletkit.service-C_NgWHzp.js | 7601048 | CosmosRpcClient$simulate$lambda$lambda | `/cosmos/tx/v1beta1/simulate` |
| chunks/walletkit.service-C_NgWHzp.js | 7601297 | CosmosRpcClient$broadcastTransaction$lambda$lambda | `/cosmos/tx/v1beta1/txs` |
| chunks/walletkit.service-C_NgWHzp.js | 7601679 | CosmosRpcClient$findTransaction$lambda | `/cosmos/tx/v1beta1/txs/` |
| chunks/walletkit.service-C_NgWHzp.js | 7601940 | CosmosRpcClient$getEvmosFeeMarketParams$lambda$lambda | `/evmos/feemarket/v1/params` |
| chunks/walletkit.service-C_NgWHzp.js | 7602172 | CosmosRpcClient$getOsmosisBaseFee$lambda$lambda | `/osmosis/txfees/v1beta1/cur_eip_base_fee` |
| chunks/walletkit.service-C_NgWHzp.js | 7602400 | CosmosRpcClient$getDelegations$lambda | `/cosmos/staking/v1beta1/delegations/` |
| chunks/walletkit.service-C_NgWHzp.js | 7602841 | CosmosRpcClient$getContractBalance$lambda | `/cosmwasm/wasm/v1/contract/` |
| chunks/walletkit.service-C_NgWHzp.js | 7603116 | CosmosRpcClient$getNeutronMarketFee$lambda$lambda | `/feemarket/v1/gas_prices` |
| chunks/walletkit.service-C_NgWHzp.js | 7613854 | CosmosDefaultFeeRemoteServiceDelegate$execute$lambda | `/v1/fee/default/` |
| chunks/walletkit.service-C_NgWHzp.js | 7616733 | Oo(ne,["/v1/apr"]),pu(ee,vu().f6d_1); | `/v1/apr` |
| chunks/walletkit.service-C_NgWHzp.js | 7627787 | CosmosStakingRpcClient$getDelegations$lambda | `/cosmos/staking/v1beta1/delegations/` |
| chunks/walletkit.service-C_NgWHzp.js | 7628057 | CosmosStakingRpcClient$getUnbondingDelegations$lambda | `/cosmos/staking/v1beta1/delegators/` |
| chunks/walletkit.service-C_NgWHzp.js | 7628346 | CosmosStakingRpcClient$getCosmosValidators$lambda | `/cosmos/staking/v1beta1/validators` |
| chunks/walletkit.service-C_NgWHzp.js | 7628709 | CosmosStakingRpcClient$getCosmosValidator$lambda | `/cosmos/staking/v1beta1/validators/` |
| chunks/walletkit.service-C_NgWHzp.js | 7628955 | CosmosStakingRpcClient$getPool$lambda$lambda | `/cosmos/staking/v1beta1/pool` |
| chunks/walletkit.service-C_NgWHzp.js | 7629493 | CosmosStakingRpcClient$getProvisions$lambda | `/osmosis/mint/v1beta1/epoch_provisions` |
| chunks/walletkit.service-C_NgWHzp.js | 7629802 | CosmosStakingRpcClient$getEvmosInflation$lambda$lambda | `/evmos/inflation/v1/params` |
| chunks/walletkit.service-C_NgWHzp.js | 7630058 | CosmosStakingRpcClient$getCosmosInflation$lambda$lambda | `/cosmos/mint/v1beta1/inflation` |
| chunks/walletkit.service-C_NgWHzp.js | 7630594 | CosmosStakingRpcClient$getDistributionParams$lambda$lambda | `/cosmos/distribution/v1beta1/params` |
| chunks/walletkit.service-C_NgWHzp.js | 7630847 | te | `/osmosis/mint/v1beta1/params` |
| chunks/walletkit.service-C_NgWHzp.js | 7631228 | CosmosStakingRpcClient$getEvmosEpoch$lambda$lambda | `/evmos/inflation/v1/epoch_mint_provision` |
| chunks/walletkit.service-C_NgWHzp.js | 7631501 | CosmosStakingRpcClient$getAnnualProvisions$lambda$lambda | `/cosmos/mint/v1beta1/annual_provisions` |
| chunks/walletkit.service-C_NgWHzp.js | 7632013 | CosmosStakingRpcClient$getSommelierAPY$lambda$lambda | `/sommelier/incentives/v1/apy` |
| chunks/walletkit.service-C_NgWHzp.js | 7632542 | CosmosStakingRpcClient$getCelestiaInflation$lambda$lambda | `/cosmos/mint/v1beta1/inflation_rate` |
| chunks/walletkit.service-C_NgWHzp.js | 7649022 | TerraRpcClient$getTerraGasPrices$lambda$lambda | `/v1/txs/gas_prices` |
| chunks/walletkit.service-C_NgWHzp.js | 7876720 | Bn(CosmosAccountService$loadBalances$slambda$slambda$slambda,On,Un,[1]),Bn(CosmosAccountService$load | `/cosmos/bank/v1beta1/supply` |
| chunks/walletkit.service-C_NgWHzp.js | 7977652 | FioNodeRpcClient$isSynced$lambda | `/v1/chain/get_info` |
| chunks/walletkit.service-C_NgWHzp.js | 7977744 | FioNodeRpcClient$blockNumber$lambda | `/v1/chain/get_info` |
| chunks/walletkit.service-C_NgWHzp.js | 7978197 | se.a8g(function FioRpcClient$getCoinBalance$lambda$lambda(ee){return function(se,ne){return fn(se,[" | `/v1/chain/get_fio_balance` |
| chunks/walletkit.service-C_NgWHzp.js | 7978951 | te.a8g(function FioRpcClient$broadcastTransaction$lambda$lambda(ee,se){return function(ne,te){return | `/v1/chain/` |
| chunks/walletkit.service-C_NgWHzp.js | 7979578 | se.a8g(function FioRpcClient$estimateFee$lambda$lambda(ee){return function(se,ne){return fn(se,["/v1 | `/v1/chain/get_fee` |
| chunks/walletkit.service-C_NgWHzp.js | 7980231 | FioRpcClient$fetchChainParams$lambda$lambda | `/v1/chain/get_info` |
| chunks/walletkit.service-C_NgWHzp.js | 7980432 | se.a8g(function FioRpcClient$fetchChainParams$lambda$lambda_0(ee){return function(se,ne){return fn(s | `/v1/chain/get_block` |
| chunks/walletkit.service-C_NgWHzp.js | 7981184 | se.a8g(function FioRpcClient$checkAvailability$lambda$lambda(ee){return function(se,ne){return fn(se | `/v1/chain/avail_check` |
| chunks/walletkit.service-C_NgWHzp.js | 7981903 | se.a8g(function FioRpcClient$getAddresses$lambda$lambda(ee){return function(se,ne){return fn(se,["/v | `/v1/chain/get_fio_addresses` |
| chunks/walletkit.service-C_NgWHzp.js | 7982642 | se.a8g(function FioRpcClient$getAllPublicKeys$lambda$lambda(ee){return function(se,ne){return fn(se, | `/v1/chain/get_pub_addresses` |
| chunks/walletkit.service-C_NgWHzp.js | 7983296 | FioRpcClient$registerFreeHandle$lambda | `/v1/fio/buy-address` |
| chunks/walletkit.service-C_NgWHzp.js | 8104082 | this.kwv_1 | `https://wallet-kit.trustwallet.com/v1/apr/proxy/stakewiz` |
| chunks/walletkit.service-C_NgWHzp.js | 8319959 | this.exj_1 | `https://wallet-kit.trustwallet.com/v1/apr/proxy/stakewiz` |
| chunks/walletkit.service-C_NgWHzp.js | 8390348 | Pn(SolanaAccountService$loadBalancesForCoins$slambda$slambda,wn,qn,[1]),Pn(SolanaAccountService$load | `/corex/ga/v1` |
| chunks/walletkit.service-C_NgWHzp.js | 8448483 | AmberRpcClient$getDomains$lambda | `/v1/domains` |
| chunks/walletkit.service-C_NgWHzp.js | 8448636 | AmberRpcClient$getProviders$lambda | `/v1/providers` |
| chunks/walletkit.service-C_NgWHzp.js | 8448767 | AmberRpcClient$getBridgeProvider$lambda | `/v1/providers/bridge/` |
| chunks/walletkit.service-C_NgWHzp.js | 8448906 | AmberRpcClient$getDexProvider$lambda | `/v1/providers/dex/` |
| chunks/walletkit.service-C_NgWHzp.js | 8449034 | AmberRpcClient$getRoutes$lambda | `/v1/route` |
| chunks/walletkit.service-C_NgWHzp.js | 8449148 | AmberRpcClient$getStep$lambda | `/v1/route/step` |
| chunks/walletkit.service-C_NgWHzp.js | 8449277 | AmberRpcClient$createTransaction$lambda | `/v1/history/create` |
| chunks/walletkit.service-C_NgWHzp.js | 8449417 | AmberRpcClient$findTransaction$lambda | `/v1/history/status` |
| chunks/walletkit.service-C_NgWHzp.js | 8449591 | AmberRpcClient$submitTransaction$lambda | `/v1/transaction/submit` |
| chunks/walletkit.service-C_NgWHzp.js | 8759648 | AlgorandNodeRpcClient$isSynced$lambda | `/v2/status` |
| chunks/walletkit.service-C_NgWHzp.js | 8759737 | AlgorandNodeRpcClient$blockNumber$lambda | `/v2/status` |
| chunks/walletkit.service-C_NgWHzp.js | 8760162 | AlgorandRpcClient$getStatus$lambda$lambda | `/v2/status` |
| chunks/walletkit.service-C_NgWHzp.js | 8760567 | AlgorandRpcClient$getAccountData$lambda | `/v2/accounts/` |
| chunks/walletkit.service-C_NgWHzp.js | 8760798 | AlgorandRpcClient$getTransactionStatus$lambda | `/v2/transactions/pending/` |
| chunks/walletkit.service-C_NgWHzp.js | 8761058 | AlgorandRpcClient$getTransactionParams$lambda$lambda | `/v2/transactions/params` |
| chunks/walletkit.service-C_NgWHzp.js | 8761172 | AlgorandRpcClient$broadcastTransaction$lambda$lambda | `/v2/transactions` |
| chunks/walletkit.service-C_NgWHzp.js | 8761968 | AlgorandRpcClient$getAssetRegistered$lambda | `/v2/accounts/` |
| chunks/walletkit.service-C_NgWHzp.js | 8761987 | AlgorandRpcClient$getAssetRegistered$lambda | `/assets/` |
| chunks/walletkit.service-C_NgWHzp.js | 8821891 | AptosNodeRpcClient$isSynced$lambda | `/v1/-/healthy` |
| chunks/walletkit.service-C_NgWHzp.js | 8821980 | AptosNodeRpcClient$blockNumber$lambda | `/v1` |
| chunks/walletkit.service-C_NgWHzp.js | 8823458 | AptosRpcClient$fetchLedgerTimestamp$lambda$lambda | `/v1/` |
| chunks/walletkit.service-C_NgWHzp.js | 8823648 | AptosRpcClient$sequenceNumber$lambda | `/v1/accounts/` |
| chunks/walletkit.service-C_NgWHzp.js | 8823751 | AptosRpcClient$simulate$lambda$lambda | `/v1/transactions/simulate` |
| chunks/walletkit.service-C_NgWHzp.js | 8824201 | AptosRpcClient$estimateGasPrice$lambda$lambda | `/v1/estimate_gas_price` |
| chunks/walletkit.service-C_NgWHzp.js | 8824306 | AptosRpcClient$sendTransaction$lambda$lambda | `/v1/transactions` |
| chunks/walletkit.service-C_NgWHzp.js | 8824678 | AptosRpcClient$getTransactionByHash$lambda | `/v1/transactions/by_hash/` |
| chunks/walletkit.service-C_NgWHzp.js | 8824796 | AptosRpcClient$executeView$lambda$lambda | `/v1/view` |
| chunks/walletkit.service-C_NgWHzp.js | 9107244 | So(ne,["/v1/staking/chains/cardano/validator_aprs"]); | `/v1/staking/chains/cardano/validator_aprs` |
| chunks/walletkit.service-C_NgWHzp.js | 9475458 | EthKilnRpcStakingClient$getExitQueueEstimation$lambda | `/v1/pools/exit-queue/ticket/` |
| chunks/walletkit.service-C_NgWHzp.js | 9572424 | this.c15d_1 | `/v1/invests/stablecoin/config` |
| chunks/walletkit.service-C_NgWHzp.js | 9597677 | ls | `/v1/defi` |
| chunks/walletkit.service-C_NgWHzp.js | 9597700 | ls | `/v1/defi/network-stats` |
| chunks/walletkit.service-C_NgWHzp.js | 9597737 | ls | `/v1/defi/extra-rewards/morpho` |
| chunks/walletkit.service-C_NgWHzp.js | 9597781 | ls | `/v1/defi/extra-rewards/morpho/claim` |
| chunks/walletkit.service-C_NgWHzp.js | 9597831 | ls | `/v1/defi/stakes` |
| chunks/walletkit.service-C_NgWHzp.js | 9598293 | KilnVaultsRpcClient$positions$lambda | `/v1/defi/stakes` |
| chunks/walletkit.service-C_NgWHzp.js | 9598380 | KilnVaultsRpcClient$vaults$lambda | `/v1/defi/network-stats` |
| chunks/walletkit.service-C_NgWHzp.js | 9598486 | KilnVaultsRpcClient$morphoExtraRewards$lambda | `/v1/defi/extra-rewards/morpho` |
| chunks/walletkit.service-C_NgWHzp.js | 9598604 | KilnVaultsRpcClient$craftClaimMorphoRewards$lambda | `/v1/defi/extra-rewards/morpho/claim` |
| chunks/walletkit.service-C_NgWHzp.js | 9648294 | this.p14h_1 | `/v1/defi/angle/positions` |
| chunks/walletkit.service-C_NgWHzp.js | 9650926 | this.r14j_1 | `/v1/defi/angle/overview` |
| chunks/walletkit.service-C_NgWHzp.js | 9656291 | hs($getVaultCOROUTINE$0,gs),hs($fetchVaultOverviewFromRemoteCOROUTINE$1,gs),As(AngleVaultOverviewCac | `/v1/defi/angle/deposit` |
| chunks/walletkit.service-C_NgWHzp.js | 9656555 | hs($getVaultCOROUTINE$0,gs),hs($fetchVaultOverviewFromRemoteCOROUTINE$1,gs),As(AngleVaultOverviewCac | `/v1/defi/angle/withdraw` |
| chunks/walletkit.service-C_NgWHzp.js | 9708279 | this.p15d_1 | `/v1/invests/stablecoin/config` |
| chunks/walletkit.service-C_NgWHzp.js | 9903249 | this.n10e_1 | `/api/v2/tronRent` |
| chunks/walletkit.service-C_NgWHzp.js | 9903444 | TronifyApiClient$preorder$lambda | `/api/v2/tronRent` |
| chunks/walletkit.service-C_NgWHzp.js | 9903554 | TronifyApiClient$createOrder$lambda | `/api/v2/tronRent` |
| chunks/walletkit.service-C_NgWHzp.js | 9903663 | TronifyApiClient$uploadHash$lambda | `/api/v2/tronRent` |
| chunks/walletkit.service-C_NgWHzp.js | 9903766 | TronifyApiClient$orderStatus$lambda | `/api/v2/tronRent` |
| chunks/walletkit.service-C_NgWHzp.js | 10133113 | Qs(TronAccountService$loadBalances$slambda$slambda,Ks,Ys,[1]),Qs(TronAccountService$loadBalances$sla | `/v2/` |
| chunks/walletkit.service-C_NgWHzp.js | 10257425 | gn(se,["network/status"]); | `network/status` |
| chunks/walletkit.service-C_NgWHzp.js | 10259188 | gn(ne,["search/transactions"]); | `search/transactions` |
| chunks/walletkit.service-C_NgWHzp.js | 10353678 | TezosNodeRpcClient$getHeadHeader$lambda | `/chains/main/blocks/head/header` |
| chunks/walletkit.service-C_NgWHzp.js | 10354290 | TezosRpcClient$getHead$lambda$lambda | `/chains/main/blocks/head` |
| chunks/walletkit.service-C_NgWHzp.js | 10354500 | TezosRpcClient$getAccountData$lambda | `/chains/main/blocks/head/context/contracts/` |
| chunks/walletkit.service-C_NgWHzp.js | 10354741 | TezosRpcClient$getManagerKey$lambda | `/chains/main/blocks/head/context/contracts/` |
| chunks/walletkit.service-C_NgWHzp.js | 10354994 | se.a8g(function TezosRpcClient$forgeOperations$lambda$lambda(ee){return function(se,ne){return Ht(se | `/chains/main/blocks/head/helpers/forge/operations` |
| chunks/walletkit.service-C_NgWHzp.js | 10355712 | se.a8g(function TezosRpcClient$runOperation$lambda$lambda(ee){return function(se,ne){return Ht(se,[" | `/chains/main/blocks/head/helpers/scripts/run_operation` |
| chunks/walletkit.service-C_NgWHzp.js | 10356440 | TezosRpcClient$getConstants$lambda$lambda | `/chains/main/blocks/head/context/constants` |
| chunks/walletkit.service-C_NgWHzp.js | 10356989 | TezosRpcClient$getBlockOperations$lambda | `/chains/main/blocks/` |
| chunks/walletkit.service-C_NgWHzp.js | 10357118 | TezosRpcClient$getBakers$lambda | `/v3/bakers` |
| chunks/walletkit.service-C_NgWHzp.js | 10497843 | this.c1jo_1 | `/rpc` |
| chunks/walletkit.service-C_NgWHzp.js | 10498859 | this.z1jo_1 | `/rpc` |
| chunks/walletkit.service-C_NgWHzp.js | 10500117 | this.w1jp_1 | `/rpc` |
| chunks/walletkit.service-C_NgWHzp.js | 10500882 | this.r1jq_1 | `/rpc` |
| chunks/walletkit.service-C_NgWHzp.js | 10501658 | this.n1jr_1 | `/rpc` |
| chunks/walletkit.service-C_NgWHzp.js | 10608568 | AeternityRpcClient$findTransaction$lambda | `/v2/transactions/` |
| chunks/walletkit.service-C_NgWHzp.js | 10608785 | AeternityRpcClient$getAccount$lambda | `/v2/accounts/` |
| chunks/walletkit.service-C_NgWHzp.js | 10608904 | AeternityRpcClient$broadcastTransaction$lambda$lambda | `/v2/transactions` |
| chunks/walletkit.service-C_NgWHzp.js | 10609712 | AeternityRpcClient$getBlockNumber$lambda$lambda | `/v2/blocks/top` |
| chunks/walletkit.service-C_NgWHzp.js | 10627035 | this.x1cp_1 | `/v2/status` |
| chunks/walletkit.service-C_NgWHzp.js | 10629873 | this.d1cs_1 | `/v2/blocks/top` |
| chunks/walletkit.service-C_NgWHzp.js | 10655290 | WavesNodeRpcClient$isSynced$lambda | `/node/status` |
| chunks/walletkit.service-C_NgWHzp.js | 10656098 | WavesRpcClient$getAssetBalances$lambda | `/assets/balance/` |
| chunks/walletkit.service-C_NgWHzp.js | 10656328 | WavesRpcClient$findTransactionByHash$lambda | `/transactions/info/` |
| chunks/walletkit.service-C_NgWHzp.js | 10656449 | WavesRpcClient$broadcastTransaction$lambda$lambda | `/transactions/broadcast` |
| chunks/walletkit.service-C_NgWHzp.js | 10656828 | WavesRpcClient$getTimeStamp$lambda$lambda | `/node/status` |
| chunks/walletkit.service-C_NgWHzp.js | 10792317 | MultiversXRpcClient$getAccount$lambda | `/address/` |
| chunks/walletkit.service-C_NgWHzp.js | 10792764 | MultiversXRpcClient$getTokens$lambda | `/address/` |
| chunks/walletkit.service-C_NgWHzp.js | 10793022 | MultiversXRpcClient$getTransactionStatus$lambda | `/status` |
| chunks/walletkit.service-C_NgWHzp.js | 11011704 | StellarRpcClient$findTransactionByHash$lambda | `/transactions/` |
| chunks/walletkit.service-C_NgWHzp.js | 11012008 | StellarRpcClient$broadcastTransaction$lambda$lambda | `/transactions` |
| chunks/walletkit.service-C_NgWHzp.js | 11081642 | NebulasRpcClient$getAccount$lambda$lambda | `/v1/user/accountstate` |
| chunks/walletkit.service-C_NgWHzp.js | 11082387 | NebulasRpcClient$getGasPrice$lambda$lambda | `/v1/user/getGasPrice` |
| chunks/walletkit.service-C_NgWHzp.js | 11082498 | NebulasRpcClient$getTransactionReceipt$lambda$lambda | `/v1/user/getTransactionReceipt` |
| chunks/walletkit.service-C_NgWHzp.js | 11083280 | NebulasRpcClient$getLatestBlock$lambda$lambda | `/v1/user/lib` |
| chunks/walletkit.service-C_NgWHzp.js | 11083495 | NebulasRpcClient$getNebulasState$lambda$lambda | `/v1/user/nebstate` |
| chunks/walletkit.service-C_NgWHzp.js | 11083602 | NebulasRpcClient$broadcastTransaction$lambda$lambda | `/v1/user/rawtransaction` |
| chunks/walletkit.service-C_NgWHzp.js | 11084845 | NebulasNodeRpcClient$isSynced$lambda | `/v1/user/nebstate` |
| chunks/walletkit.service-C_NgWHzp.js | 11084940 | NebulasNodeRpcClient$blockNumber$lambda | `/v1/user/nebstate` |
| chunks/walletkit.service-C_NgWHzp.js | 11206777 | IotexRpcClient$getAccountMeta$lambda | `/v1/accounts/` |
| chunks/walletkit.service-C_NgWHzp.js | 11207002 | IotexRpcClient$getTransactionByHash$lambda | `/v1/actions/hash/` |
| chunks/walletkit.service-C_NgWHzp.js | 11207234 | IotexRpcClient$broadcastTransaction$lambda | `/v1/actionbytes/` |
| chunks/walletkit.service-C_NgWHzp.js | 11255179 | Pe($loadBalancesCOROUTINE$0,ke),De(IconAccountService,"IconAccountService",Fe,Fe,[Ne],[1,2]),Pe($cal | `/api/v3` |
| chunks/walletkit.service-C_NgWHzp.js | 11321572 | PolkadotRpcClient$totalIssuance$lambda$lambda | `/pallets/balances/storage/totalIssuance` |
| chunks/walletkit.service-C_NgWHzp.js | 11538125 | VeChainRpcClient$sendRawTransaction$lambda$lambda | `/transactions` |
| chunks/walletkit.service-C_NgWHzp.js | 11538900 | VeChainRpcClient$getTransactionReceipt$lambda | `/transactions/` |
| chunks/walletkit.service-C_NgWHzp.js | 12874223 | ee | `/assets/` |
| chunks/walletkit.service-C_NgWHzp.js | 32112641 | AssetApiClientImpl$getAsset$lambda | `/v1/assets/` |
| chunks/walletkit.service-C_NgWHzp.js | 32112750 | AssetApiClientImpl$getAssets$lambda | `/v1/assets` |
| chunks/walletkit.service-C_NgWHzp.js | 32112906 | AssetApiClientImpl$getAssetStatus$lambda | `/v2/coinstatus/` |
| chunks/walletkit.service-C_NgWHzp.js | 32113278 | Ar(se,["/v1/search/assets"]); | `/v1/search/assets` |
| chunks/walletkit.service-C_NgWHzp.js | 32113902 | AssetApiClientImpl$getPopularAssets$lambda | `/v1/assets/popular` |
| chunks/walletkit.service-C_NgWHzp.js | 32114039 | Ar(se,["/v1/assets/listings"]),se.r6m_1.w67("version",ee.e1ux_1.toString()),se.r6m_1.w67("currency", | `/v1/assets/listings` |
| chunks/walletkit.service-C_NgWHzp.js | 32115279 | BalanceApiClientImpl$streamBalances$slambda$lambda | `/v1/balances/stream` |
| chunks/walletkit.service-C_NgWHzp.js | 32116302 | MarketApiClientImpl$getTickers$lambda | `/v2/market/tickers` |
| chunks/walletkit.service-C_NgWHzp.js | 32116422 | MarketApiClientImpl$getMarketInfo$lambda | `/v1/market/info/` |
| chunks/walletkit.service-C_NgWHzp.js | 32116574 | MarketApiClientImpl$getUsdExchangeRate$lambda | `/v2/market/rates` |
| chunks/walletkit.service-C_NgWHzp.js | 32418150 | this.h2jw_1 | `/v1/invests` |
| chunks/walletkit.service-C_NgWHzp.js | 32418176 | this.h2jw_1 | `/v1/invests/stablecoin/quotes` |
| chunks/walletkit.service-C_NgWHzp.js | 32418367 | nl(ne,["/v1/invests/staking"]),ne.r6m_1.w67("currency",ee); | `/v1/invests/staking` |
| chunks/walletkit.service-C_NgWHzp.js | 32418569 | nl(ne,["/v1/invests/stablecoin"]),ne.r6m_1.w67("currency",ee); | `/v1/invests/stablecoin` |
| chunks/walletkit.service-C_NgWHzp.js | 32418782 | nl(te,["/v1/invests/stablecoin/positions"]),te.r6m_1.w67("wallet_address",ee); | `/v1/invests/stablecoin/positions` |
| chunks/walletkit.service-C_NgWHzp.js | 32419042 | InvestApiClientImpl$createApproveQuote$lambda | `/v1/invests/stablecoin/quotes/approve` |
| chunks/walletkit.service-C_NgWHzp.js | 32419163 | InvestApiClientImpl$createDepositQuote$lambda | `/v1/invests/stablecoin/quotes/deposit` |
| chunks/walletkit.service-C_NgWHzp.js | 32419285 | InvestApiClientImpl$createWithdrawQuote$lambda | `/v1/invests/stablecoin/quotes/withdraw` |
| chunks/walletkit.service-C_NgWHzp.js | 32420359 | MerklRewardsClientImpl$merklRewards$lambda | `/v1/launchpool/userMultiChainRewards` |
| chunks/walletkit.service-C_NgWHzp.js | 33370188 | PerpetualApiClientImpl$getNonce$lambda | `/bapi/futures/v1/public/future/web3/get-nonce` |
| chunks/walletkit.service-C_NgWHzp.js | 33370307 | PerpetualApiClientImpl$login$lambda | `/bapi/futures/v1/public/future/web3/login` |
| chunks/walletkit.service-C_NgWHzp.js | 33370427 | PerpetualApiClientImpl$placeOrder$lambda | `/bapi/futures/v1/private/future/order/place-order` |
| chunks/walletkit.service-C_NgWHzp.js | 33370563 | PerpetualApiClientImpl$placeStrategyOrder$lambda | `/bapi/futures/v1/private/future/strategy/place-order` |
| chunks/walletkit.service-C_NgWHzp.js | 33370701 | PerpetualApiClientImpl$getWithdrawAssets$lambda | `/bapi/futures/v1/public/future/apx/withdraw/assets` |
| chunks/walletkit.service-C_NgWHzp.js | 33370866 | PerpetualApiClientImpl$getDepositAssets$lambda | `/bapi/futures/v1/public/future/apx/deposit/assets` |
| chunks/walletkit.service-C_NgWHzp.js | 33371055 | Si(oe,["/bapi/futures/v1/public/future/apx/estimate-withdraw-fee"]); | `/bapi/futures/v1/public/future/apx/estimate-withdraw-fee` |
| chunks/walletkit.service-C_NgWHzp.js | 33371481 | PerpetualApiClientImpl$getChainWithdrawLimit$lambda | `/bapi/futures/v1/private/future/web3/chain-withdraw-limit` |
| chunks/walletkit.service-C_NgWHzp.js | 33371698 | PerpetualApiClientImpl$getLockedProfit$lambda | `/bapi/futures/v1/private/future/apx/limit/profit` |
| chunks/walletkit.service-C_NgWHzp.js | 33371996 | PerpetualApiClientImpl$requestWithdraw$lambda | `/bapi/futures/v1/private/future/apx/user-withdraw` |
| chunks/walletkit.service-C_NgWHzp.js | 33372150 | Si(ne,["/bapi/futures/v1/private/future/user-data/getMaxWithdrawAmount"]); | `/bapi/futures/v1/private/future/user-data/getMaxWithdrawAmount` |
| chunks/walletkit.service-C_NgWHzp.js | 33372822 | Si(te,["/bapi/futures/v1/private/future/user-data/adjust-margin-type"]); | `/bapi/futures/v1/private/future/user-data/adjust-margin-type` |
| chunks/walletkit.service-C_NgWHzp.js | 33373515 | Si(se,["/bapi/futures/v4/private/future/user-data/user-balance"]); | `/bapi/futures/v4/private/future/user-data/user-balance` |
| chunks/walletkit.service-C_NgWHzp.js | 33374159 | PerpetualApiClientImpl$getAssetIndex$lambda | `/fapi/v1/assetIndex` |
| chunks/walletkit.service-C_NgWHzp.js | 33374259 | PerpetualApiClientImpl$getTradeInfo$lambda | `/fapi/v1/premiumIndex` |
| chunks/walletkit.service-C_NgWHzp.js | 33374380 | Si(se,["/bapi/futures/v1/private/future/user-setting/get-optional-symbols"]); | `/bapi/futures/v1/private/future/user-setting/get-optional-symbols` |
| chunks/walletkit.service-C_NgWHzp.js | 33374769 | Si(ne,["/bapi/futures/v1/private/future/user-setting/update-optional-symbols"]); | `/bapi/futures/v1/private/future/user-setting/update-optional-symbols` |
| chunks/walletkit.service-C_NgWHzp.js | 33375459 | Si(te,["/bapi/futures/v1/private/future/user-data/adjustLeverage"]); | `/bapi/futures/v1/private/future/user-data/adjustLeverage` |
| chunks/walletkit.service-C_NgWHzp.js | 33376137 | Si(se,["/bapi/futures/v1/public/future/asset/ae/all-asset-logo"]); | `/bapi/futures/v1/public/future/asset/ae/all-asset-logo` |
| chunks/walletkit.service-C_NgWHzp.js | 33376496 | PerpetualApiClientImpl$getExchangeInfo$lambda | `/fapi/v1/astherusExchangeInfo` |
| chunks/walletkit.service-C_NgWHzp.js | 33376604 | PerpetualApiClientImpl$getTickers$lambda | `/fapi/v1/ticker/24hr` |
| chunks/walletkit.service-C_NgWHzp.js | 33376701 | PerpetualApiClientImpl$getPairs$lambda | `/bapi/future/v1/public/future/aster/ticker/pair` |
| chunks/walletkit.service-C_NgWHzp.js | 33376855 | PerpetualApiClientImpl$getKlines$lambda | `/fapi/v1/continuousKlines` |
| chunks/walletkit.service-C_NgWHzp.js | 33377161 | Si(ne,["/bapi/futures/v1/friendly/future/common/brackets"]); | `/bapi/futures/v1/friendly/future/common/brackets` |
| chunks/walletkit.service-C_NgWHzp.js | 33377736 | Si(ne,["/bapi/futures/v5/private/future/user-data/user-position"]); | `/bapi/futures/v5/private/future/user-data/user-position` |
| chunks/walletkit.service-C_NgWHzp.js | 33378313 | Si(se,["/bapi/futures/v2/private/future/order/open-orders"]); | `/bapi/futures/v2/private/future/order/open-orders` |
| chunks/walletkit.service-C_NgWHzp.js | 33378688 | Si(te,["/bapi/futures/v1/private/future/strategy/query-open-strategy"]); | `/bapi/futures/v1/private/future/strategy/query-open-strategy` |
| chunks/walletkit.service-C_NgWHzp.js | 33379378 | Si(te,["/bapi/futures/v1/private/future/order/cancel-order"]); | `/bapi/futures/v1/private/future/order/cancel-order` |
| chunks/walletkit.service-C_NgWHzp.js | 33380050 | Si(ne,["/bapi/futures/v1/private/future/order/cancel-orders"]); | `/bapi/futures/v1/private/future/order/cancel-orders` |
| chunks/walletkit.service-C_NgWHzp.js | 33380627 | Si(se,["/bapi/futures/v2/private/future/order/clear-position"]); | `/bapi/futures/v2/private/future/order/clear-position` |
| chunks/walletkit.service-C_NgWHzp.js | 33381331 | Si(se,["/bapi/futures/v1/private/future/user-data/get-join-margin"]); | `/bapi/futures/v1/private/future/user-data/get-join-margin` |
| chunks/walletkit.service-C_NgWHzp.js | 33381710 | Si(ne,["/bapi/futures/v1/private/future/user-data/change-join-margin"]); | `/bapi/futures/v1/private/future/user-data/change-join-margin` |
| chunks/walletkit.service-C_NgWHzp.js | 33382374 | Si(se,["/bapi/futures/v1/private/future/user-data/userLeverage"]); | `/bapi/futures/v1/private/future/user-data/userLeverage` |
| chunks/walletkit.service-C_NgWHzp.js | 33382762 | PerpetualApiClientImpl$getNetworkDepositAddress$lambda | `/bapi/futures/v1/private/future/web3/deposit-address` |
| chunks/walletkit.service-C_NgWHzp.js | 33382926 | PerpetualApiClientImpl$getOrderHistory$lambda | `/bapi/futures/v1/private/future/order/order-history` |
| chunks/walletkit.service-C_NgWHzp.js | 33383061 | PerpetualApiClientImpl$getTradeHistory$lambda | `/bapi/futures/v1/private/future/user-data/trade-history` |
| chunks/walletkit.service-C_NgWHzp.js | 33383206 | PerpetualApiClientImpl$getTransactionHistory$lambda | `/bapi/futures/v1/private/future/user-data/transaction-history` |
| chunks/walletkit.service-C_NgWHzp.js | 33383379 | Si(ne,["/bapi/futures/v1/private/future/web3/ae/depositAndWithdraw/history"]); | `/bapi/futures/v1/private/future/web3/ae/depositAndWithdraw/history` |
| chunks/walletkit.service-C_NgWHzp.js | 33384039 | PerpetualApiClientImpl$getAccountTierCommission$lambda | `/bapi/futures/v1/private/future/user-data/account-tier-commission` |
| chunks/walletkit.service-C_NgWHzp.js | 33384208 | Si(ne,["/bapi/futures/v1/private/future/user-data/user-listen-key"]); | `/bapi/futures/v1/private/future/user-data/user-listen-key` |
| chunks/walletkit.service-C_NgWHzp.js | 34677107 | GasStationClient$getFeeHistory$lambda | `/v1/fee/history/` |
| chunks/walletkit.service-C_NgWHzp.js | 34677235 | GasStationClient$getFeePriority$lambda | `/v1/fee/priority/` |
| chunks/walletkit.service-C_NgWHzp.js | 35377416 | TransactionApiClientImpl$getTransaction$lambda | `/v1/txhub/txs/` |
| chunks/walletkit.service-C_NgWHzp.js | 35793861 | Bi(ne,["/v1/odd/portfolio"]),Ki(ee,Ui().f6d_1); | `/v1/odd/portfolio` |
| chunks/walletkit.service-C_NgWHzp.js | 35794500 | Bi(oe,["/v1/odd/positions"]); | `/v1/odd/positions` |
| chunks/walletkit.service-C_NgWHzp.js | 35795189 | Bi(te,["/v1/odd/trades"]),Ki(ee,Ui().f6d_1); | `/v1/odd/trades` |
| chunks/walletkit.service-C_NgWHzp.js | 35795824 | Bi(re,["/v1/odd/trades/create"]),Ki(ee,Ui().f6d_1); | `/v1/odd/trades/create` |
| chunks/walletkit.service-C_NgWHzp.js | 35796466 | PredictionApiClientImpl$getCategories$lambda | `/v1/odd/categories` |
| chunks/walletkit.service-C_NgWHzp.js | 35796565 | PredictionApiClientImpl$getNetworks$lambda | `/v1/odd/networks` |
| chunks/walletkit.service-C_NgWHzp.js | 35796683 | Bi(re,["/v1/odd/markets"]); | `/v1/odd/markets` |
| chunks/walletkit.service-C_NgWHzp.js | 35797019 | Bi(ne,["/v1/odd/markets",ee]); | `/v1/odd/markets` |
| chunks/walletkit.service-C_NgWHzp.js | 35797310 | PredictionApiClientImpl$getQuote$lambda | `/v1/odd/markets/` |
| chunks/walletkit.service-C_NgWHzp.js | 35797680 | PredictionApiClientImpl$getOutcomePrices$lambda | `/v1/odd/markets` |
| chunks/walletkit.service-C_NgWHzp.js | 35797817 | PredictionApiClientImpl$getBatchOutcomes$lambda | `/v1/odd/markets/batch_outcomes` |
| chunks/walletkit.service-C_NgWHzp.js | 35797989 | Bi(ne,["/v1/odd/auth"]),Ki(ee,Ui().f6d_1); | `/v1/odd/auth` |
| chunks/walletkit.service-C_NgWHzp.js | 35798580 | Bi(ne,["/v1/odd/order"]),Ki(ee,Ui().f6d_1); | `/v1/odd/order` |
| chunks/walletkit.service-C_NgWHzp.js | 36194506 | NamingClient$lookup$lambda | `/v1/lookup` |
| chunks/walletkit.service-C_NgWHzp.js | 36298980 | getMultiCoinWalletIconUrl | `/assets/0x4B0F1812e5Df2A09796481Ff14017e6005508003/logo.png` |
| chunks/walletkit.service-C_NgWHzp.js | 36301668 | WalletAggregationApiClientImpl$getWalletMetaFromRegistry$lambda | `/v1/wallets/` |
| chunks/walletkit.service-C_NgWHzp.js | 36301832 | WalletAggregationApiClientImpl$getWalletMetaLegacy$lambda | `/v3/devices/` |
| chunks/walletkit.service-C_NgWHzp.js | 36611984 | xe(ne,["/analytics/v1/events"]); | `/analytics/v1/events` |
| chunks/walletkit.service-C_NgWHzp.js | 36889903 | ne | `/assets/` |
| chunks/walletkit.service-C_NgWHzp.js | 37325539 | AMBER_ROUTE_PATH | `/amber-api/v1/route` |
| content-scripts/content.js | 33068 | ie(),he(),Mt(),de(),b(),$t(),xt | `trust-wallet/broadcast-channel/v1` |
| inpage.js | 68523 | init_esbrowser(),init_hmac$2(),init_sha256$1(),init_utils$7(),init_base$1(),init_logger(),CHANNEL_KE | `trust-wallet/broadcast-channel/v1` |
| inpage.js | 3143953 | init_tronweb(),init_utils(),init_providers(),Event$1 | `v1/transactions/${…}/events?${…}` |
| background.js | 13758086 | TrustSwapClient$getSwap$lambda | `/v2.1/swap` |
| background.js | 13758407 | TrustSwapClient$getSwapQuote$lambda | `/v2.1/swap/quote` |
| chunks/walletkit.service-C_NgWHzp.js | 11751330 | TrustSwapClient$getSwap$lambda | `/v2.1/swap` |
| chunks/walletkit.service-C_NgWHzp.js | 11751651 | TrustSwapClient$getSwapQuote$lambda | `/v2.1/swap/quote` |
| inpage.js | 3143483 | getEventsByContractAddress | `v1/contracts/${…}/events?${…}` |
| inpage.js | 3144423 | getEventsByBlockNumber | `v1/blocks/${…}/events?${…}` |
| inpage.js | 3144786 | getEventsOfLatestBlock | `v1/blocks/latest/events?${…}` |
