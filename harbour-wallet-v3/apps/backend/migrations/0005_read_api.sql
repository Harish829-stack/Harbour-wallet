-- Phase 5: read API, prices, NFT media.

ALTER TABLE nft_holdings
    ADD COLUMN name      TEXT,
    ADD COLUMN image_src TEXT;              -- source URL; only the media proxy fetches it
CREATE INDEX nft_holdings_media ON nft_holdings (media_key) WHERE media_key IS NOT NULL;

-- Portfolio chart: snapshot rows per day; price lookups by asset and time.
CREATE INDEX balance_snapshots_day ON balance_snapshots (tracked_address_id, day);
CREATE INDEX balances_held ON balances (asset_id) WHERE amount_raw > 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'harbour_prices') THEN
        CREATE ROLE harbour_prices NOLOGIN;
    END IF;
    GRANT SELECT ON assets, balances, tracked_addresses, chains TO harbour_prices;
    GRANT INSERT, UPDATE ON price_ticks, balance_snapshots TO harbour_prices;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping role setup';
END $$;
