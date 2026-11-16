# Harbour Wallet security findings, explained in plain language

Each number matches the row in `SECURITY_FINDINGS.md`. Items 1 to 8 are fixed. Items 9 to 19 are not fixed and say why; none of them needed your approval for a protected area (see item 18).

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

## 12. Strangers can make the server look things up before it says no (Not fixed)

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

- **What was wrong:** Some things cannot be judged from code on this computer: the server code was read but not built or tested (the Go tools could not be downloaded here); the automatic jobs were not run on GitHub; server images were not built; nothing was tried in a real browser, with a real fingerprint reader or with a Ledger; and account security for the Chrome Web Store and GitHub is outside the code.
- **How an attacker could abuse it:** Problems in those areas would not have been seen by this review. Taking over the store publishing account is exactly how the Trust Wallet extension was attacked in 2025.
- **What could have been lost or harmed:** Unknown until checked.
- **How it was fixed:** It was not. Before real funds are at stake: run the backend tests and scanners in CI, test on real devices, protect the store and GitHub accounts with two-step sign-in and required reviewers, and have an independent firm audit the wallet.
- **Did anything change for users?** No.
