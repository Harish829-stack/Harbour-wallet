-- Phase 3: indexer bookkeeping.

ALTER TABLE tracked_addresses
    ADD COLUMN backfill_started_at   TIMESTAMPTZ,
    ADD COLUMN backfill_error        TEXT,
    ADD COLUMN history_from_block    BIGINT,              -- oldest block covered by stored history
    ADD COLUMN history_complete      BOOLEAN NOT NULL DEFAULT false,  -- true when history reaches the first transfer
    ADD COLUMN balances_refreshed_at TIMESTAMPTZ;
CREATE INDEX tracked_addresses_backfill ON tracked_addresses (backfill_state) WHERE backfill_state IN ('pending','running');
CREATE INDEX tracked_addresses_sweep ON tracked_addresses (balances_refreshed_at NULLS FIRST);

ALTER TABLE assets
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'token' CHECK (kind IN ('native','token','nft','multi'));

CREATE INDEX balances_asset ON balances (asset_id);

-- Creates the month partition for ts on demand (backfills and older pages
-- reach past the premade window). SECURITY DEFINER so the indexer role can
-- call it without owning the tables.
CREATE OR REPLACE FUNCTION harbour_ensure_partition(parent TEXT, ts TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
    m DATE := date_trunc('month', ts)::date;
    pname TEXT := parent || '_p' || to_char(date_trunc('month', ts), 'YYYYMM');
BEGIN
    IF parent NOT IN ('transactions', 'transfers') THEN
        RAISE EXCEPTION 'not a partitioned fact table: %', parent;
    END IF;
    IF to_regclass('partman.part_config') IS NOT NULL THEN  -- nested: the inner query only plans when partman exists
        IF EXISTS (SELECT 1 FROM partman.part_config WHERE parent_table = 'public.' || parent) THEN
            -- pg_partman owns it: ask it for the child covering ts (no-op if present).
            PERFORM partman.create_partition_time('public.' || parent, ARRAY[ts]);
            RETURN;
        END IF;
    END IF;
    IF to_regclass(pname) IS NULL THEN
        BEGIN
            EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                           pname, parent, m, (m + interval '1 month')::date);
        EXCEPTION WHEN duplicate_table THEN
            NULL; -- created concurrently
        END;
    END IF;
END $fn$;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION harbour_ensure_partition(TEXT, TIMESTAMPTZ) TO harbour_indexer;
    GRANT UPDATE ON tracked_addresses TO harbour_indexer;
EXCEPTION WHEN undefined_object OR insufficient_privilege THEN
    RAISE NOTICE 'skipping grants';
END $$;
