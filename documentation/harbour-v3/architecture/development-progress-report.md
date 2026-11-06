<!-- Exported from Claude Docs on 2026-11-02. Source: https://claude.ai/artifact/8aBZqg2gnsF9QJaXBCkDPo -->
> **Local copy.** Exported from the shared doc https://claude.ai/artifact/8aBZqg2gnsF9QJaXBCkDPo on 2026-11-02 (written 2026-10-28). Status: historical (written for v2; has unfilled placeholders). Embedded diagrams in the original appear here as text placeholders. Treat code as the source of truth; see `audit/HANDOFF.md`.

# Harbour Wallet — Development Progress Report

Oct 28, 2026 · Prepared by: @Harish

## Executive Summary

- **Done:** The Harbour Wallet browser extension (harbour-wallet-v2) works end to end. Users can create or import a wallet, hold assets on many blockchains, send, swap and connect to crypto apps. It is packaged as an installable zip.
- **In progress:** We are building our own backend so the wallet no longer depends on logic running inside the extension. Progress figure: **\[to be provided\]**.
- **Not started:** We have not yet had an independent security audit, full layer-by-layer security testing, a bug bounty, legal sign-off or store listings.
- **To launch:** We need to finish the backend, pass an external audit, get a legal opinion on which features need licences, and publish under a verified company account.
- **Today:** The build is for demos and internal testing only. It must not be used with real user funds yet.

Status labels used throughout: **Done** · **In progress** · **Not started**.

## 1. Wallet Extension Status (harbour-wallet-v2) — Done (functional build)

harbour-wallet-v2 is a fully working Chrome wallet extension, delivered as a zip file.

**Tech stack:** A Chrome Manifest V3 extension written in TypeScript and React. Keys and signing use Trust Wallet's open-source Wallet Core library. We chose Manifest V3 because Chrome now accepts only V3 extensions. We chose Wallet Core because it is proven at scale and covers dozens of blockchains with one library.

**No real backend yet.** A background worker inside the extension does a backend's job: it fetches balances and prices, builds transactions and talks to blockchain networks. A small cloud proxy only keeps our third-party API keys off users' devices.

**User flows that work end to end:**

- Create a new wallet or import one from a recovery phrase or private key
- Unlock by password, passkey or biometrics, with auto-lock
- View balances, token prices, NFTs and transaction history across EVM chains, Solana, Bitcoin, Cosmos, Sui, Aptos, TON and Tron
- Send and receive, with checks for look-alike and mistyped addresses
- Connect to crypto apps (dApps), including through WalletConnect, and approve or reject each signature and transaction
- Switch networks, add custom networks and use common testnets
- Swap and bridge tokens through third-party providers (LI.FI, Relay, THORChain, Jupiter)
- Review and revoke token spending approvals
- Use a Ledger hardware wallet
- Earn and staking flows, and push notifications for incoming funds

**Safety features already built in:** phishing-site and scam-address warnings, a preview of balance changes before signing, and a design where the recovery phrase and keys never reach the screen's code. Releases are signed and reproducible.

**Limitations:**

- It has **not** been end-to-end security tested at every layer. An internal review in October 2026 fixed the high-risk issues it found, but some items remain open.
- It has **not** been through an independent third-party security audit.
- It is therefore a functional build, not a production-ready one.

**What this means:** The build is ready for demos and internal testing. It is not ready to hold real user funds.

## 2. Backend Development Status — In progress

The backend will take over the heavy work the extension does today. It will make the wallet faster and more reliable, and let us run swaps, alerts and portfolio data on our own servers.

**Tech stack:** Go services with a PostgreSQL database, Redis caching and a messaging layer for real-time updates. Blockchain data comes from Alchemy, with Alchemy and Infura nodes behind an automatic fallback. We chose Go for speed and low running cost under heavy traffic, PostgreSQL for reliable records, and two node providers so one provider's outage does not take the wallet down. The design is modular, so we can add new chains and data providers with little new code.

**Done so far:**

- **\[To be provided — completed outcome 1\]**
- **\[To be provided — completed outcome 2\]**
- **\[To be provided — completed outcome 3\]**

**Remaining:**

- **\[To be provided — remaining outcome 1\]**
- **\[To be provided — remaining outcome 2\]**
- **\[To be provided — remaining outcome 3\]**

**Overall progress:** roughly **\[X\]%** complete. Next milestone: **\[milestone and date — to be provided\]**.

*Placeholders flagged: completed work, remaining work, the progress figure and the next milestone were not supplied, so they are left blank rather than estimated.*

## 3. Production Readiness & Launch Requirements

### 3a. Technical readiness once the backend is complete

The main gaps are external verification, a hardened release process and store approval. Recent incidents show why each one matters.

**Why this matters now.** In December 2025, attackers stole Trust Wallet's Chrome Web Store publishing key through an npm supply-chain attack. They pushed a malicious extension update that drained about $8.5M from 2,520 wallets ([Trust Wallet update](https://trustwallet.com/blog/announcements/trust-wallet-browser-extension-v268-incident-community-update), [The Hacker News](https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html)). Separately, Chainalysis counted $3.4B in crypto stolen in 2025 ([Fortune](https://www.fortune.com/2025/12/18/north-korea-stole-a-record-amount-of-crypto)).

- **Independent security audit and penetration test — Not started.** We need one firm to review the extension, key handling and backend. For scale, Trust Wallet's 2023 extension audit by Cure53 took four senior testers ten days ([Cure53 report](https://trustwallet.com/assets/files/cure53_tw_browser_extension_04.2023.pdf)). MetaMask has used Cure53, Least Authority and OtterSec ([MetaMask security program](https://metamask.com/security/metamask-security-program)). Public price data is thin: one wallet-extension audit was quoted at $20k in 2022 ([forum quote](https://forum.scrt.network/t/starshell-security-audit-funding-request/6667)), so budget roughly $20k–$100k+ and get firm quotes.
- **End-to-end and layer-by-layer security testing — Not started.** We need to test the extension, the backend, the connection to crypto apps and the signing of every chain together, not just each part alone.
- **Key management review — In progress.** An internal review is done and recovery phrases never reach the screen's code. The external audit must still confirm key storage, password strength rules and recovery.
- **Release and supply-chain security — In progress.** Signed and reproducible releases already exist. We still need two-person release approval, locked-down store publishing keys, pinned dependencies and monitoring of what is live in the store. The npm attack of September 2025 swapped crypto addresses inside wallet front-ends ([Blockaid](https://blockaid.io/blog/attack-report-the-september-2025-npm-supply-chain-attack)).
- **Infrastructure — Not started.** We need uptime monitoring, a public status page, an incident-response and user-reimbursement plan, and at least two node providers. Alchemy advises buyers to look for 99.99% uptime commitments backed by service credits ([Alchemy guide](https://www.alchemy.com/blog/blockchain-rpc-infrastructure-evaluation-guide-for-enterprises)). Infura's 2020 outage took MetaMask down for hours ([QuickNode](https://www.quicknode.com/blog/the-importance-of-web3-provider-redundancy)).
- **Bug bounty — Not started.** Peers pay up to $100k for critical bugs: Phantom on Cantina ([Phantom bounty](https://cantina.xyz/bounties/5314819f-b0b2-4d39-b953-d02ec74cac1a)) and Trust Wallet through Binance's Bugcrowd program ([Binance bounty](https://bugcrowd.com/binance/updates/d39d4605-8c06-4fe3-b947-d1cda0cd7b9e)). We can start smaller and raise limits after launch.
- **Browser store requirements — Not started.**
  - **Chrome:** Manifest V3, no remotely loaded code, the narrowest permissions possible, an accurate privacy policy and no impersonation. Reviews take days to weeks ([Chrome policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [review process](https://developer.chrome.com/docs/webstore/review-process)). Chrome bans real-money prediction markets, so our Polymarket feature needs a decision before submission.
  - **Firefox:** We must submit buildable source code, and new extensions must declare any data collection ([source submission](https://extensionworkshop.com/documentation/publish/source-code-submission/), [Mozilla](https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/)).
  - **Edge:** Crypto wallets may only be published by verified company accounts ([Edge policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)).
- **Mobile app stores (later) — Not started.**
  - **Apple:** Wallet apps must come from a developer enrolled as an organisation ([App Store guideline 3.1.5](https://developer.apple.com/app-store/review/guidelines/)).
  - **Google Play:** Non-custodial wallets are outside its crypto licensing rule, but still need a Financial Features Declaration ([Google Play policy](https://support.google.com/googleplay/android-developer/answer/16329703?hl=en)).

### 3b. Legal, licensing & compliance

A pure self-custodial wallet usually needs no financial licence in our main markets. The risk grows with each feature that earns fees on trades or touches user funds. The table covers each feature, and the notes below it give the sources.

| Feature | India (PMLA / FIU-IND) | EU (MiCA) | US (FinCEN, SEC, states) |
| --- | --- | --- | --- |
| Pure self-custodial wallet (user holds keys; we build and relay transactions) | Likely outside scope. The rules cover services done "for or on behalf of another", but there is no official carve-out, so get a written opinion. | No licence. Non-custodial wallet providers are outside MiCA. | No licence. Unhosted-wallet software is not money transmission. |
| Built-in swaps / DEX aggregation, especially with a fee | Grey area. VDA-to-VDA exchange "on behalf of another" is a listed activity. | Unclear for a fee-charging aggregator; counsel needed. | Lower risk since April 2026 SEC staff guidance, if fees are fixed, we don't recommend trades and we never take custody. |
| Fiat on/off-ramp (buy or sell with cash) | Use a registered partner. Transak says it is FIU-IND registered. | Use a licensed partner. MoonPay holds a MiCA licence. | Use a licensed partner. MoonPay and Transak hold state licences. |
| Staking / earn / yield | Treat any pooled product as a regulated service. | Pooled or custodial staking needs a licence. | Plain protocol staking is not a securities offering, per 2025 SEC staff statements; promised yields are. |
| Cross-chain bridging | Routing to a third-party bridge is like swaps. Running our own bridge is like custody. | Same as India. | Same as India. |
| Any feature where we hold or control user funds, even briefly | FIU-IND registration and full anti-money-laundering duties. | Licence required (CASP). | FinCEN registration plus state licences, e.g. California's DFAL from July 2026 and New York's BitLicense. |

**Notes and sources:**

- **US:**
  - FinCEN's 2019 guidance treats unhosted wallets as outside money transmission ([FinCEN FIN-2019-G001](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf)).
  - In August 2025, the DOJ said it will not charge developers of truly decentralised, non-custodial software ([WilmerHale](https://www.wilmerhale.com/en/insights/client-alerts/20250910-doj-signals-approach-to-digital-assets-what-it-means-for-developers-and-platforms)).
  - The Samourai Wallet founders were still jailed in 2025 over mixing services ([US DOJ](https://www.justice.gov/usao-sdny/pr/founders-samourai-wallet-cryptocurrency-mixing-service-sentenced-five-and-four-years)), so we should avoid mixing and privacy-routing features.
  - Swap fees were the core of the SEC's 2024 case against MetaMask's maker, which was later dropped ([Blockworks](https://www.blockworks.com/news/sec-lawsuit-against-consensys-securities)). The April 2026 SEC staff statement sets the safe conditions, but it is non-binding ([CoinDesk](https://www.coindesk.com/policy/2026/04/13/u-s-sec-says-software-allowing-crypto-wallet-transactions-aren-t-considered-brokers)).
  - Liquid staking guidance: [Fenwick](https://www.fenwick.com/insights/publications/sec-statement-on-liquid-staking). California DFAL: [DFPI](https://dfpi.ca.gov/digital-financial-assets/).
  - The broader market-structure bill (CLARITY Act) remains stalled as of October 2026 ([The Block](https://theblock.co/news/regulation/2026-10-22-jpmorgan-crypto-regulatory-moves-clarity-act-failure-risks-423473)).
- **EU:** MiCA defines custody as controlling clients' assets or keys ([Dfns](https://dfns.co/article/custodial-or-non-custodial-under-micar)). MiCA's transition period ended on 1 July 2026.
- **India:**
  - The PMLA notification of 7 March 2023 lists five covered activities. FIU-IND updated its registration and AML guidelines in September 2025 and January 2026 ([CryptoSlate](https://cryptoslate.com/crypto-laws/india-pmla-vda-service-provider-aml-cft-regime/)).
  - In September 2026 it acted against 15 offshore platforms. It treats the activity, not a physical presence in India, as what triggers registration ([News On AIR](https://newsonair.gov.in/fiu-ind-cracks-down-on-15-vda-service-providers-over-pmla-non-compliance/)).
- **Other markets:**
  - **UAE (Dubai):** non-custodial wallets fall outside VARA licensing, but custody and brokerage do not ([Neolegal](https://neolegal.ae/insights/can-i-run-crypto-dubai-without-vara)).
  - **UK:** a new crypto regime starts in October 2027. It covers safeguarding, dealing and arranging staking ([FCA](https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation)).
  - **Singapore:** since June 2025, firms serving only overseas clients need a licence that is rarely granted ([Sumsub](https://sumsub.com/blog/singapore-crypto-firms-without-dtsp-licenses-to-cease-overseas-operations)).

**How wallets usually avoid licensing burdens:** never hold keys or funds, and route regulated activity to licensed partners. Fiat goes through MoonPay ([MiCA licence](https://www.amf-france.org/en/warnings/white-lists/daspcasp/moonpay-europe-bv), [NY BitLicense](https://www.moonpay.com/newsroom/ny-bitlicense)) or Transak ([compliance](https://transak.com/compliance), [FIU-IND](https://transak.com/blog/transak-registers-with-fiu-india-as-a-virtual-digital-assets-service-provider)). Swaps and bridges go through third-party providers, and we get a legal opinion before charging any fee.

**Non-licence requirements:**

- **Company structure:** a registered legal entity that owns the product, and verified organisation accounts on the browser and app stores.
- **Terms of Service:** make clear that users hold their own keys and that lost recovery phrases cannot be recovered.
- **Privacy Policy:** it must match the store privacy disclosures.
- **India DPDP Act:** the rules were notified in November 2025, and core duties apply from 13 May 2027 ([AZB & Partners](https://www.azbpartners.com/bank/indias-digital-personal-data-protection-act-phased-rollout-and-key-compliance-milestones/)).
- **GDPR:** applies if we have EU users.
- **Sanctions screening:** OFAC liability is strict, and its guidance recommends blocking by location ([White & Case](https://www.whitecase.com/insight-alert/ofac-sanctions-compliance-guidance-virtual-currency-industry)).
- **EU Travel Rule:** obligations fall on exchanges, not on self-hosted wallet software ([21 Analytics](https://www.21analytics.co/blog/regulatory-frameworks-self-hosted-wallets/)).
- **Trademark:** register "Harbour" and the logo in India and in our target markets.
- **Disclaimers:** state that we give no financial advice and do not custody funds.

*This is research, not legal advice. Local counsel in India and in each launch market must confirm these points before launch.*

### 3c. Why MetaMask, Trust Wallet and Phantom succeeded

Each wallet became the default wallet for one blockchain's apps early on, then turned built-in swaps into its main business.

|  | MetaMask | Trust Wallet | Phantom |
| --- | --- | --- | --- |
| Launched | 2016, Ethereum | 2017, mobile first | 2021, Solana |
| Scale | Claims 100M+ users ([Wikipedia](https://en.wikipedia.org/wiki/MetaMask)) | 200M downloads, 100+ chains (Mar 2025, [Business Wire](https://www.businesswire.com/news/home/20250325066589/en/Trust-Wallet-Reaches-200-Million-Downloads-Milestone)) | 15M monthly users; $3B valuation (Jan 2025, [The Block](https://www.theblock.co/post/335305/phantom-wallet-raises-150-million-at-3-billion-valuation)) |
| Code | Source-available (open source until 2020) | Core library open source ([Wikipedia](https://en.wikipedia.org/wiki/Trust_Wallet)) | Listed as open source ([ethereum.org](https://ethereum.org/wallets/find-wallet/phantom/)) |
| Distribution edge | First mover; became the standard way apps connect to a wallet | Bought by Binance in 2018 | Owned Solana's consumer wave |
| Revenue model | 0.875% swap fee, a stablecoin and a payment card ([Cointelegraph](https://cointelegraph.com/news/metamask-musd-stablecoin-launch-ethereum-linea-2025)) | Swap and on-ramp fees; TWT token discounts | 0.85% swap fee; \~$553M lifetime revenue ([DefiLlama](https://defillama.com/protocol/phantom-wallet)) |

**The real drivers of adoption and trust:**

- **Early mover and developer lock-in.** MetaMask defined how websites talk to a wallet. Every crypto app tested against it first, and newer standards now let several wallets coexist in one browser ([EIP-6963](https://eips.ethereum.org/EIPS/eip-6963)).
- **Open code and audits.** Public code and published audit reports let experts check the wallet, and this builds trust ([MetaMask security program](https://metamask.com/security/metamask-security-program)).
- **Ecosystem integrations.** WalletConnect connects 700+ wallets to about 85,000 apps. Being listed there is part of distribution ([WalletConnect 2025](https://walletconnect.com/blog/walletconnect-2025-year-in-review)).
- **Multi-chain support and simple onboarding.** Trust Wallet covers 100+ chains. Phantom made Solana feel as simple as a consumer app.
- **Visible safety.** Transaction previews and scam alerts are now expected. MetaMask enables Blockaid alerts by default ([MetaMask support](https://support.metamask.io/ms/privacy-and-security/how-to-turn-on-security-alerts)), and Phantom blocks known drainer sites ([Decrypt](https://decrypt.co/304965/what-is-phantom-a-guide-to-solanas-most-popular-crypto-wallet?amp=1)).
- **Brand, community and backing.** Binance's distribution, Consensys's and Sequoia/Paradigm's funding, and an active user community.
- **Honest incident handling.** Trust Wallet kept user trust after its 2022 key-generation bug ([Ledger](https://www.ledger.com/blog/Funds-of-every-wallet-created-with-the-Trust-Wallet-browser-extension-could-have-been-stolen)) and its 2025 extension hack by reimbursing affected users.

### 3d. How Harbour Wallet can stand out (2026 trends)

Safety and simplicity are where users still feel pain, and where a new wallet can win trust fastest. Several of these features are already partly built into harbour-wallet-v2.

| Priority | Differentiator | Why it matters |
| --- | --- | --- |
| Must-have | Transaction simulation and scam/phishing protection (partly built) | Signature-phishing scams took $84M in 2025, and permit-style approvals caused 38% of large losses ([Scam Sniffer](https://drops.scamsniffer.io/scam-sniffer-2025-crypto-phishing-losses-fall-83-to-84-million/)). MetaMask has made this the baseline. |
| Must-have | Built-in swaps and bridges with clear, fixed fees (built) | This is the main revenue line for every leading wallet (0.85–0.875%). Fixed fees also fit the 2026 SEC guidance. |
| Must-have | Smart accounts (ERC-4337, EIP-7702) with safe-delegation checks | EIP-7702 went live in May 2025 and is used in millions of transactions ([growthepie](https://www.growthepie.com/answers/most-smart-account-activity-ethereum-l2)). Research found over 63% of early 7702 authorisations were malicious, so built-in guarding is a real selling point ([USENIX 2026](https://www.usenix.org/system/files/conference/usenixsecurity26/sec26_prepub_huang-mingyuan.pdf)). |
| Should-have | Passkey or social recovery instead of seed phrases | Lost seed phrases are the top onboarding fear. Coinbase uses passkeys ([Coinbase](https://help.coinbase.com/en-gb/wallet/getting-started/smart-wallet-passkeys)), and Stripe bought Privy, which has 75M+ seedless accounts ([SiliconANGLE](https://siliconangle.com/2025/06/11/stripe-acquires-crypto-wallet-infrastructure-provider-privy/)). |
| Should-have | Gas sponsorship and paying fees in stablecoins | New users often hold USDC but not the network's own token. Circle's paymaster lets them pay fees in USDC ([Circle](https://www.circle.com/blog/introducing-circle-paymaster)). |
| Should-have | Chain abstraction and one unified balance across chains | Users shouldn't have to think about which chain their money is on. This is backed by the ERC-7683 intents standard ([Blockworks](https://blockworks.co/news/ethereum-cross-chain-transactions)) and funded startups like OneBalance ([Blockchain Capital](https://blockchaincapital.com/blog/onebalance-bringing-one-click-ux-to-onchain-transactions)). |
| Nice-to-have | AI-assisted transaction explanations and agent permissions | This is early but moving: Trust Wallet launched an AI agent kit in March 2026 ([Bitcoin Magazine](https://bitcoinmagazine.com/news/trust-wallet-launches-agent-kit)). Plain-English "what will this do" summaries cut user errors. |
| Nice-to-have | MPC key option alongside hardware wallets (Ledger is built) | It appeals to users who want no single point of failure. The trade-off is reliance on the MPC provider ([Cobo](https://www.cobo.com/post/best-non-custodial-wallet)). |

Stablecoin payments are a further opening now that the US GENIUS Act (July 2025) sets clear rules for stablecoin issuers ([Debevoise](https://www.debevoise.com/insights/publications/2025/07/genius-act-progresses-in-congress-as-stablecoin)).

### Launch-readiness checklist

Critical items gate a public launch with real funds. Owners are left as TBD for assignment. Blank status cells are items whose current state was not confirmed.

| Requirement | Category | Status | Owner | Priority |
| --- | --- | --- | --- | --- |
| Complete the backend | Engineering | In progress | TBD | Critical |
| Independent security audit and penetration test | Security | Not started | TBD | Critical |
| End-to-end security testing at every layer | Security | Not started | TBD | Critical |
| External review of key management and storage | Security | In progress | TBD | Critical |
| Release pipeline hardening (two-person approval, protected store keys) | Security | In progress | TBD | Critical |
| Legal opinion on licensing, by feature and market | Legal | Not started | TBD | Critical |
| Terms of Service, Privacy Policy and disclaimers | Legal |  | TBD | Critical |
| Verified company accounts on browser stores | Distribution |  | TBD | Critical |
| Chrome Web Store submission (incl. decision on Polymarket feature) | Distribution | Not started | TBD | Critical |
| Internal security review and fixes | Security | Done | TBD | High |
| Node/RPC redundancy, monitoring and status page | Infrastructure | Not started | TBD | High |
| Incident-response and user-reimbursement plan | Operations | Not started | TBD | High |
| Bug bounty program | Security | Not started | TBD | High |
| India DPDP Act and GDPR compliance | Legal |  | TBD | High |
| Sanctions screening and geo-blocking | Compliance |  | TBD | High |
| Trademark registration for "Harbour" | Legal |  | TBD | High |
| Licensed fiat on-ramp partner (e.g. MoonPay, Transak) | Partnerships | Not started | TBD | Medium |
| Firefox and Edge store submissions | Distribution | Not started | TBD | Medium |
| Mobile apps (Apple, Google Play) | Distribution | Not started | TBD | Low |

## 4. Deliverable

**Download:** harbour-wallet-v2 extension zip — **\[paste link here\]** *(placeholder: link not yet provided)*

**Install steps for reviewers (Chrome):**

1. Download and unzip the file.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the unzipped folder. Harbour Wallet appears in the extensions toolbar.

**Reminder:** This build is for testing only. Do not use it with real funds. Use a fresh test wallet and testnet tokens, and never import a recovery phrase that controls real assets.
