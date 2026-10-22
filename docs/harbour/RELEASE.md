# Releasing Harbour

1. Run `npm ci`, then `node scripts/verify.mjs`. This type-checks, runs the tests, builds and scans the bundle for secrets.
2. Run `node scripts/repro.mjs`. It must report "reproducible".
3. Bump `version` in `package.json` and the manifest, then commit.
4. Run `node scripts/release.mjs`. The first run creates `../harbour-release-key.json`; back it up offline and never commit it. The run writes the following to `releases/`:
   - `harbour-<v>.zip`
   - `harbour-<v>.zip.sha256`
   - `harbour-<v>.zip.sig`
   - `harbour-<v>.release.json`
5. Verify with `node scripts/verify-release.mjs releases/harbour-<v>.zip <trusted signer key>`.
6. Upload the zip to the Chrome Web Store dashboard, using `docs/harbour/STORE-LISTING.md` for the listing.
7. Publish `release.json` and `.sig` with the release notes, so anyone can rebuild from the commit and compare hashes.
