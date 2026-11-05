-- Backend optimization (2026-11-05).
--
-- 1. 'dormant' backfill state: an address with no transactions, no native balance and no incoming transfers on a chain
--    is not backfilled, gap-filled or swept. It stays on the chain's webhook; its first activity promotes it to 'pending'
--    and a normal backfill runs (industry practice: index only the chains a wallet uses).
-- 2. NFT holdings are synced when the user looks at NFTs (or when an NFT moves for an address whose NFTs were viewed
--    recently), not for every address on every backfill. nft_dirty marks a list that may be stale.

DO $$
DECLARE c text;
BEGIN
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'tracked_addresses'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%backfill_state%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE tracked_addresses DROP CONSTRAINT %I', c);
    END IF;
END $$;
ALTER TABLE tracked_addresses ADD CONSTRAINT tracked_addresses_backfill_state_check
    CHECK (backfill_state IN ('pending','running','done','capped','skipped','failed','dormant'));

ALTER TABLE tracked_addresses
    ADD COLUMN nft_dirty      BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN nft_synced_at  TIMESTAMPTZ;
-- Existing synced addresses had their NFTs synced during backfill.
UPDATE tracked_addresses SET nft_dirty = false, nft_synced_at = now() WHERE backfill_state IN ('done','capped');
