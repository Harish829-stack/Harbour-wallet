# Harbour Wallet security findings, explained in plain language

Each number matches the row in `SECURITY_FINDINGS.md`. Items 1 to 8 and 20 are fixed (first pass). Items 21 to 25 are fixed in the second pass, which also closed item 12 (see item 23). **Item 26 needs your approval: it is in a protected area (signing) and is the most serious open item.** Items 9 to 11, 13 to 19 and 27 to 29 are not fixed and say why.

How to read the status words: **Fixed** means the change is committed and was checked as far as this session allowed (stated in each item). **Not fixed** means I found it but could not or should not change it myself.

---

## 1. Hidden characters could make the approval screen lie (Fixed)

- **What was wrong:** When a website asks you to sign a message, Harbour shows you the text first. Some special characters are invisible, or tell the screen to draw the following text backwards. Harbour drew them exactly as the website sent them, so what you read was not always what you were signing.
- **How an attacker could abuse it:** A fake site sends a sign-in message where the domain line is written backwards plus a "draw this backwards" character. On screen it reads like a site you trust. You approve, and the attacker now holds a valid sign-in signature for something else.
- **What could have been lost or harmed:** Account access on services that accept "sign in with your wallet", and in the worst case approval of a typed message (for example a token permission) whose shown details were misleading.
- **How it was fixed:** Before anything is shown, every piece of text on the approval screen is checked. Invisible and text-reordering characters are replaced by a visible code such as `\u{202E}`, so they cannot hide or rearrange anything. A message that contains them also shows a warning, and the Approve button stays off until you tick "I understand the risk". The data that actually gets signed is not touched.
- **Did anything change for users?** Yes, slightly. Normal messages look the same (including Arabic, Hebrew, Japanese and emoji). A message with hidden characters now shows those codes, a warning and one extra checkbox.

## 2. App names from WalletConnect and page titles could carry hidden characters (Fixed)

- **What was wrong:** When an app connects through WalletConnect it tells Harbour its own name, description and web address. The page title of a website is also chosen by that website. Harbour removed only a small set of odd characters from them and stored the rest.
- **How an attacker could abuse it:** A scam app names itself so that, with hidden characters, the name displays like a well-known brand in the connection request and in your list of sessions.
- **What could have been lost or harmed:** Trust: you might connect to, or keep connected, an app you believe is a different one.
- **How it was fixed:** These names are now cleaned as they arrive: invisible and text-reordering characters are removed.
- **Did anything change for users?** No. Names saved before the fix keep their old text until that app is connected again.

## 3. The backend's build robot had more access than it needed (Fixed)

- **What was wrong:** Every time code is pushed, GitHub runs automatic checks ("CI"). Those checks get a temporary pass to the repository. For the backend checks, nobody had said how strong that pass should be, so on some repositories it can also write.
- **How an attacker could abuse it:** If any tool used during the checks were hijacked, it could use that pass to change your code or add a hidden change to a branch.
- **What could have been lost or harmed:** The integrity of the source code that later becomes the backend your users talk to.
- **How it was fixed:** The pass is now read-only for the backend checks, the same as the extension checks already had.
- **Did anything change for users?** No. Not run on GitHub from here; it will run on the next push.

## 4. Build steps were loaded by nickname instead of by exact version (Fixed)

- **What was wrong:** The automatic checks use ready-made steps written by others (for example "check out the code"). They were referenced by a version nickname like "v4". The owner of a step, or someone who steals their account, can silently point that nickname at different code.
- **How an attacker could abuse it:** This already happened to thousands of projects in 2025: a popular step was hijacked and printed every project's secrets. In Harbour's release job, such a step would run next to the key that signs the extension release. Stolen publishing credentials are also what let attackers ship a malicious Trust Wallet extension update in December 2025.
- **What could have been lost or harmed:** The release signing key and the build itself, which means a poisoned update could reach every user.
- **How it was fixed:** Each step is now referenced by its exact fingerprint (a commit hash), which cannot be repointed. A bot (Dependabot) will propose updates so they are reviewed before use.
- **Did anything change for users?** No. Not run on GitHub from here.

## 5. Two security scanners were always downloaded as "whatever is newest" (Fixed)

- **What was wrong:** The backend checks download two scanning tools at the newest available version every time.
- **How an attacker could abuse it:** If someone published a tampered new version of either tool, it would run inside your checks the same day, with access to the code.
- **What could have been lost or harmed:** Source code integrity and anything the check job can reach.
- **How it was fixed:** Both tools are fixed to a specific, known version. Updating them is now a deliberate, reviewable change.
- **Did anything change for users?** No.

## 6. Some server images were never checked for updates (Fixed)

- **What was wrong:** A bot proposes updates for the building blocks Harbour uses. It was not told about four server pieces: the live-updates server, the message queue, the database image and the cache.
- **How an attacker could abuse it:** A known hole in an old version of one of those pieces stays open because nobody is told a fix exists.
- **What could have been lost or harmed:** Server reliability and, depending on the hole, the data those services hold.
- **How it was fixed:** The bot now watches those four as well.
- **Did anything change for users?** No.

## 7. The cache server could start with no password (Fixed)

- **What was wrong:** Harbour's servers keep recent answers (prices, swap quotes) in a small cache server. Its start-up line took the password from a setting. If that setting was forgotten or left empty on the hosting platform, the cache started with the lock switched off, without any error.
- **How an attacker could abuse it:** Anything that can reach that server on the internal network could read the cached answers or replace them, for example with a wrong price or a misleading swap quote that the app then shows.
- **What could have been lost or harmed:** Mostly correctness of what users see; a bad quote could lead to a bad trade. No keys are stored there.
- **How it was fixed:** The cache now refuses to start when the password is missing and says why.
- **Did anything change for users?** No. For whoever deploys: a missing `REDIS_PASSWORD` now shows up as a failed start instead of a silent open cache. Checked by running the start-up line with a stand-in program; the real image was not built here.

## 8. The release robot could write to the code, and the access pass was left lying around (Fixed)

- **What was wrong:** Two small things in the automatic jobs. First, the step that downloads the code leaves the temporary access pass inside the downloaded folder, where all later steps can read it. Second, the job that builds the release was allowed to change the repository, although it never needs to.
- **How an attacker could abuse it:** A hijacked build tool could pick up the pass and, in the release job, rewrite code or history.
- **What could have been lost or harmed:** Source code integrity around the most sensitive moment, the release build.
- **How it was fixed:** The pass is no longer left in the folder, and the release job can only read the code (it keeps the two rights it needs to produce the signed proof of where the build came from).
- **Did anything change for users?** No. Not run on GitHub from here.

## 9. Real key files sit inside the project folder (Not fixed: your action)

- **What was wrong:** Several real secret files are stored in the project folder on this computer: service keys, the key that signs Harbour's remote settings, the key that signs releases and a Firebase admin key. They are correctly excluded from git and have never been committed, but they live next to the code.
- **How an attacker could abuse it:** The folder gets synced to a cloud drive, zipped and sent to a colleague, or backed up somewhere shared. Whoever opens that copy has the keys.
- **What could have been lost or harmed:** With the release key, someone could sign a fake Harbour update. With the settings key, they could switch features or networks for all users. With the service keys, they could run up bills or read push-notification data.
- **How it was fixed:** It was not. These are your files and I did not move, open or print them.
- **Did anything change for users?** No. Recommended: move them to a password manager or the hosting platform's secret storage, and replace any key that was ever synced or shared.

## 10. An old leaked service key still needs replacing (Not fixed: your action)

- **What was wrong:** An earlier review found a service key (Infura) inside old packaged builds. A leaked key stays usable until it is replaced at the provider.
- **How an attacker could abuse it:** Use your key for their own traffic, exhausting your quota or running up cost.
- **What could have been lost or harmed:** Money and service availability; not user funds.
- **How it was fixed:** It cannot be fixed in code. I checked that the current files do not contain such keys outside the research folder.
- **Did anything change for users?** No. Replace the key in the provider's dashboard and delete old packaged builds.

## 11. Server building blocks are named by label, not by exact fingerprint (Not fixed)

- **What was wrong:** The server images are built on top of public base images named by a label such as "redis 7.4". The publisher can replace what that label points to.
- **How an attacker could abuse it:** If a publisher's account were taken over, a rebuilt Harbour server could silently include their code.
- **What could have been lost or harmed:** Control of the servers.
- **How it was fixed:** It was not: looking up the exact fingerprints needs access to the image registries, which this session does not have.
- **Did anything change for users?** No. It takes a few minutes on a computer with Docker; finding 6 then keeps them updated.

## 12. Strangers can make the server look things up before it says no (Fixed in the second pass: see item 23)

- **What was wrong:** When a request arrives claiming to be from an unknown device, the server asks its database whether that device exists before rejecting it, and there is no limit on how often one sender can do that.
- **How an attacker could abuse it:** Send a flood of requests with made-up device numbers to keep the database busy.
- **What could have been lost or harmed:** Speed and availability for real users. No data is exposed.
- **How it was fixed:** It was not. It needs a change in the server's Go code, which I cannot compile or test here, and I do not want to hand you untested server code.
- **Did anything change for users?** No.

## 13. Rate limits may see every user as the same visitor (Not fixed: needs a live check)

- **What was wrong:** The server limits abuse per internet address. Behind a hosting platform's front door it only learns the real address if it trusts that front door. The trusted list is a default that may not match the platform Harbour is deployed on.
- **How an attacker could abuse it:** If it does not match, everyone looks like one visitor. A handful of new installs per hour would use up the shared allowance and block further sign-ups, and one abuser would be indistinguishable from everyone else.
- **What could have been lost or harmed:** New users being unable to set up the wallet; weaker abuse protection.
- **How it was fixed:** It was not: it can only be confirmed on the running deployment.
- **Did anything change for users?** No.

## 14. The server learns which addresses belong to the same wallet (Not fixed: product decision)

- **What was wrong:** To show balances and send notifications, the extension tells Harbour's server all of your public addresses under one device number. Public addresses are not secret, but the grouping is private information.
- **How an attacker could abuse it:** Someone who broke into the server and also obtained its encryption key could see which addresses belong together.
- **What could have been lost or harmed:** Privacy. Not funds: I checked that seed phrases, private keys and passwords never leave the device.
- **How it was fixed:** It was not. Making this optional is an open product decision from an earlier review.
- **Did anything change for users?** No.

## 15. Two third-party code libraries have known weaknesses without a usable fix (Not fixed)

- **What was wrong:** The dependency check reports one library that can be made to use too much memory (only through the TON network's responses) and one older cryptography library used only by the Ledger connector.
- **How an attacker could abuse it:** At worst, crash or slow the wallet's background process. Neither exposes keys.
- **What could have been lost or harmed:** Availability only.
- **How it was fixed:** It was not: the libraries that depend on them have not released compatible fixes. The first one already has a dated, documented exception.
- **Did anything change for users?** No.

## 16. The live-updates server accepts connections from any browser extension (Not fixed)

- **What was wrong:** The server that pushes live balance updates accepts a connection attempt from any extension, not only Harbour, and exposes its control interface on the same public address.
- **How an attacker could abuse it:** They would still need a valid, signed token or the control password, so on its own this gives nothing.
- **What could have been lost or harmed:** Nothing directly; it is a second lock that is missing.
- **How it was fixed:** It was not: Harbour's extension does not have a fixed identity yet, so there is nothing to restrict it to.
- **Did anything change for users?** No.

## 17. The secret scanner skips two folders (Not fixed)

- **What was wrong:** The tool that looks for accidentally committed secrets ignores the research and documentation folders.
- **How an attacker could abuse it:** Not an attack; a key pasted into a note there would go unnoticed and end up on GitHub.
- **What could have been lost or harmed:** Whatever that key protects.
- **How it was fixed:** It was not: the research folder holds copies of other software that are full of key-looking text, so narrowing the rule needs a careful pass first.
- **Did anything change for users?** No.

## 18. Protected areas: reviewed, nothing changed, no approval needed

- **What was wrong:** Nothing found. I read the parts you asked me not to change without telling you: how keys and seed phrases are created, how the vault is encrypted and how the password is turned into a key, locking and unlocking, signing, and website permissions.
- **How an attacker could abuse it:** Not applicable.
- **What could have been lost or harmed:** Not applicable.
- **How it was fixed:** No change. Finding 1 touches only what the approval screen draws; what gets signed is unchanged, and a test proves that.
- **Did anything change for users?** No.

## 19. What this review could not check

- **What was wrong:** Some things cannot be judged from code alone. Since the first version of this file, you ran the server on your Mac: it builds, every service starts, the smoke test passes and the server's automatic tests pass (one Mac-only test failure is item 20). Still not checked: the two server security scanners, the automatic jobs on GitHub, the images used on Railway, real-browser use, real fingerprint readers, Ledger, and account security for the Chrome Web Store and GitHub.
- **How an attacker could abuse it:** Problems in those areas would not have been seen by this review. Taking over the store publishing account is exactly how the Trust Wallet extension was attacked in 2025.
- **What could have been lost or harmed:** Unknown until checked.
- **How it was fixed:** It was not. Before real funds are at stake: run the scanners in CI, test on real devices, protect the store and GitHub accounts with two-step sign-in and required reviewers, and have an independent firm audit the wallet.
- **Did anything change for users?** No.

## 20. A database safety check failed its own test on Macs (Fixed)

- **What was wrong:** A small script makes the database refuse any connection that is not encrypted. The script worked on the servers, but it used a text-editing command that behaves differently on a Mac, so its test failed when you ran the tests on your Mac.
- **How an attacker could abuse it:** Not directly. The danger is human: when a security test is always red on developers' machines, people learn to ignore it, and a real break in that check could slip through.
- **What could have been lost or harmed:** Nothing so far; the servers were never affected.
- **How it was fixed:** The script now edits the file in a way that works the same on Linux and on a Mac, and it stops without touching the file if anything goes wrong. Checked on Linux; please rerun `make test` on your Mac to confirm it is green there.
- **Did anything change for users?** No.

## 21. A trick in how a request is written let anyone ask the blockchain node for everything (Fixed)

- **What was wrong:** The wallet's server passes "show me the event log" questions on to a blockchain node. To keep those questions small it insists on two things: name a contract or event, and ask for at most 2,000 blocks. The server and the node read the same request slightly differently. By writing a field twice with different capital letters (`address` and `ADDRESS`), a caller could show the server a small, well-behaved question while the node read a different one: every event, from the first block.
- **How an attacker could abuse it:** Anyone with the extension installed (or a script pretending to be one) sends that request in a loop. I did exactly this against a running copy of the server, and the node received the unlimited question.
- **What could have been lost or harmed:** No funds and no private data. The cost is yours: these questions are the most expensive ones a node provider bills for, so the provider budget drains and the wallet becomes slow or stops loading balances for everyone.
- **How it was fixed:** The server now reads the filter strictly (only the five standard fields, spelled exactly, each at most once), rebuilds the request itself and sends that rebuilt version on. What it checked is now exactly what the node gets. I repeated the attack afterwards and it was refused; normal requests still work.
- **Did anything change for users?** No.

## 22. A handful of computers could stop every new user from setting up the wallet (Fixed)

- **What was wrong:** To stop mass sign-ups, the server allows 2,000 new installs per hour in total. Setting up has two steps: first the extension asks for a puzzle, then it solves the puzzle and registers. The server counted the 2,000 at the first step, the asking, which is free.
- **How an attacker could abuse it:** A script asks for puzzles from about 70 different internet addresses (cheap to rent) and never solves any. The hourly allowance is gone, and every real person installing Harbour that hour sees "Harbour is busy setting up new devices".
- **What could have been lost or harmed:** New users could not finish setup for as long as the script ran. Existing users were not affected, and no funds were at risk.
- **How it was fixed:** The allowance is now counted at the second step, after the puzzle is solved and the install has proved it holds its key. Using up a slot now costs real computing work each time.
- **Did anything change for users?** No.

## 23. Strangers could make the server do database work before it said no (Fixed; this was item 12)

- **What was wrong:** Every request to the server names the install it comes from. If the name was unknown, the server looked it up in the database before refusing. Nothing limited how often one caller could do that.
- **How an attacker could abuse it:** A script sends thousands of requests per second with made-up install names. Each one becomes a database lookup, slowing the server for real users.
- **What could have been lost or harmed:** Speed and availability only.
- **How it was fixed:** Each internet address gets 30 failed attempts per minute. After that the server refuses further unknown callers from that address straight away, without touching the database, until the minute is over. Installs the server already knows keep working even if they share that address (for example in an office).
- **Did anything change for users?** No. A real install that somehow fails 30 times in a minute waits up to a minute.

## 24. A few server counters stored install ids in the clear (Fixed)

- **What was wrong:** The server keeps short-lived counters to limit how fast each install can act. Everywhere else it labels those counters with a scrambled tag instead of the install's real id, so the counter store never holds a list of who did what. Three counters (preparing, previewing and sending a transaction) used the real id.
- **How an attacker could abuse it:** Someone who gets read access to that counter store (a misconfiguration, a leaked password) could see which installs were sending transactions and when.
- **What could have been lost or harmed:** Privacy of activity timing. No funds, no addresses.
- **How it was fixed:** Those three counters use the scrambled tag like all the others. The old entries disappear by themselves within two minutes.
- **Did anything change for users?** No.

## 25. The server read any file a certain kind of setting pointed to, and refused to start if one was missing (Fixed)

- **What was wrong:** Secrets can be given to the server as files: a setting named `SOMETHING_FILE` means "read the secret from this file". The server applied that rule to every setting ending in `_FILE`, including ones that belong to other programs on the same machine and have nothing to do with Harbour.
- **How an attacker could abuse it:** Not directly from outside. The practical harm: on a machine that happens to have such a setting pointing at a file that does not exist, no Harbour service starts, and two of the server's own tests fail (this is how I found it). It also copied unrelated files' contents into the server's settings for no reason.
- **What could have been lost or harmed:** Uptime, and trust in the test results.
- **How it was fixed:** The rule now applies only to settings that look like Harbour secrets (names ending in `_KEY`, `_PASSWORD`, `_TOKEN`, `_URL` and a few more). A missing file for one of those still stops the server, as it should.
- **Did anything change for users?** No.

## 26. A website can make you pay a far higher network fee than the one you chose (NEEDS YOUR APPROVAL, not fixed)

- **What was wrong:** When a website asks you to send a transaction, the approval screen lets you choose a fee level (safe, average, fast) and shows the fee that goes with it. The website may also send its own fee. In one combination (the site sends an old-style fee, the wallet offers a new-style one, which is the normal case on Ethereum today) the wallet signs the transaction with the website's fee and ignores the one you chose.
- **How an attacker could abuse it:** A malicious site asks you to approve something that looks ordinary and attaches a fee thousands of times above normal. You pick "average" and see about 0.003 ETH as the highest possible fee. I ran the wallet's real signing code this way: the signed transaction carried a fee of 50 ETH (in practice, as much as your balance covers). The overpayment goes to whoever builds the block, who can be the attacker's partner. One other line on the screen ("Estimated network fee") does show the site's number, so the screen disagrees with itself; nothing warns you, and changing the fee level does nothing.
- **What could have been lost or harmed:** Funds: up to your whole balance of the network's coin, in one approved transaction.
- **How it would be fixed:** Two small changes. The signing step uses only the fee you approved on the screen and ignores the website's fee. The screen computes every fee line from that same choice. This touches signing, which you asked me not to change without telling you first, so nothing was changed. The risk of the change is small: a site that wants a faster transaction can no longer force a higher fee; you choose "fast" yourself.
- **Did anything change for users?** Not yet. After the fix: the fee you pick is always the fee you pay.

## 27. Some outside services see your IP address together with your wallet address (Not fixed: product decision)

- **What was wrong:** I recorded everything the extension sent over the network while creating and unlocking a wallet. Good news first: no secret phrase, password or key ever left the device. But for Bitcoin, Tron and Solana balances and for some prices, the extension talks directly to public services (mempool.space, blockstream.info, trongrid, public Solana servers, CoinGecko, DefiLlama) instead of going through Harbour's server.
- **How an attacker could abuse it:** Not an attack by a stranger. Those services, or anyone who obtains their logs, can link your internet address to your wallet address.
- **What could have been lost or harmed:** Privacy.
- **How it was fixed:** It was not. This is how most wallets work, and changing it means sending those requests through Harbour's server (which hides your IP from them but costs server budget). It is your decision; at minimum the privacy policy should say it.
- **Did anything change for users?** No.

## 28. A file the build check needs is deleted on your computer (Not fixed: your action)

- **What was wrong:** The file `audit-exceptions.json` in the extension folder shows as deleted in your working copy (not committed). It was already like that when I started. The automatic dependency check in CI reads this file first.
- **How an attacker could abuse it:** They cannot. But if the deletion gets committed, the dependency check crashes instead of checking, and a vulnerable library could slip in unnoticed.
- **What could have been lost or harmed:** A safety net in the build.
- **How it was fixed:** I left it as I found it, because it is not my change. To restore it: `git checkout -- harbour-wallet-v3/apps/extension/audit-exceptions.json`.
- **Did anything change for users?** No.

## 29. What the second pass covered and what it did not

- **What was done:** I built and ran the server myself, with a real database, and attacked it. I built the extension, loaded it in a real browser, created a wallet, looked at everything it stored and everything it sent, and attacked it from a web page the way a malicious site would. The approval logic for websites held up against every trick I tried except item 26.
- **What was not done:** I did not read every line of the extension. The security-critical paths were read in full; the rest (about 300 files: swap, earn, perps, buy/sell, staking, most screens) was searched for dangerous patterns only. The popup was driven through its internal messages, not by clicking. Vulnerability scanners for Go, the GitHub build pipelines, the production images, biometrics and Ledger were not run. My server ran without real provider keys and without database encryption in transit, so those parts are as the first pass left them.
- **What this means:** Treat this as two careful internal reviews, not as a guarantee. Before real money depends on it, get an independent audit, and decide item 26 first.
