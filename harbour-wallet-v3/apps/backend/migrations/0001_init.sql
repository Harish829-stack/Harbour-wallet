-- Harbour schema v1. Chain-agnostic: positions are event_ref, assets are
-- (chain_id, asset_ref), chain-specific fields live in details JSONB.
-- No private keys, seeds or passwords are ever stored server-side.

-- ---------- reference data ----------
CREATE TABLE chains (
    chain_id     TEXT PRIMARY KEY,              -- slug from chains.yaml, e.g. "ethereum"
    family       TEXT NOT NULL,                 -- evm | solana | bitcoin | tron ...
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assets (
    id           BIGSERIAL PRIMARY KEY,
    chain_id     TEXT NOT NULL REFERENCES chains(chain_id),
    asset_ref    TEXT NOT NULL,                 -- contract, mint, or 'native'
    symbol       TEXT,
    name         TEXT,
    decimals     INT,
    logo_url     TEXT,
    spam_score   SMALLINT NOT NULL DEFAULT 0,
    verified     BOOLEAN NOT NULL DEFAULT false,
    details      JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (chain_id, asset_ref)
);

-- ---------- identity and tracking ----------
CREATE TABLE devices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key   BYTEA NOT NULL UNIQUE CHECK (length(public_key) = 32),  -- Ed25519
    attestation  JSONB,
    quota_tier   TEXT NOT NULL DEFAULT 'default',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at   TIMESTAMPTZ
);

CREATE TABLE tracked_addresses (
    id               BIGSERIAL PRIMARY KEY,
    chain_id         TEXT NOT NULL REFERENCES chains(chain_id),
    address          TEXT NOT NULL,             -- normalized (lowercase hex for EVM)
    synced_to_block  BIGINT,
    last_seen_block  BIGINT,
    backfill_state   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (backfill_state IN ('pending','running','done','capped','skipped','failed')),
    backfill_cursor  TEXT,
    deny_backfill    BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chain_id, address)
);

-- The only owner link. Which address a device tracks is encrypted
-- (AES-256-GCM of tracked_address_id); link_hash is a keyed HMAC blind index
-- so ownership checks don't need decryption. No wallet grouping server-side.
CREATE TABLE device_addresses (
    link_hash          BYTEA PRIMARY KEY,       -- HMAC(key, device_id || tracked_address_id)
    device_id          UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    enc_tracked_ref    BYTEA NOT NULL,          -- nonce || ciphertext
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX device_addresses_device ON device_addresses (device_id);

-- ---------- facts ----------
-- Dedupe source of truth; unpartitioned so it holds whichever block/time an
-- event later lands in after a reorg.
CREATE TABLE event_keys (
    chain_id   TEXT NOT NULL,
    tx_hash    TEXT NOT NULL,
    event_ref  TEXT NOT NULL,
    PRIMARY KEY (chain_id, tx_hash, event_ref)
);

CREATE TABLE transactions (
    chain_id      TEXT NOT NULL,
    chain_family  TEXT NOT NULL,
    tx_hash       TEXT NOT NULL,
    block_number  BIGINT NOT NULL,
    block_hash    TEXT NOT NULL,
    block_time    TIMESTAMPTZ NOT NULL,
    "from"        TEXT,
    "to"          TEXT,
    fee_raw       NUMERIC(78,0),
    status        SMALLINT,
    finality      TEXT NOT NULL DEFAULT 'pending' CHECK (finality IN ('pending','confirmed','finalized')),
    details       JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (block_time);
CREATE INDEX transactions_hash ON transactions (chain_id, tx_hash);
CREATE INDEX transactions_block ON transactions (chain_id, block_number);

CREATE TABLE transfers (
    chain_id      TEXT NOT NULL,
    chain_family  TEXT NOT NULL,
    tx_hash       TEXT NOT NULL,
    event_ref     TEXT NOT NULL,
    block_number  BIGINT NOT NULL,
    block_hash    TEXT NOT NULL,
    block_time    TIMESTAMPTZ NOT NULL,
    asset_id      BIGINT NOT NULL REFERENCES assets(id),
    "from"        TEXT,
    "to"          TEXT,
    amount_raw    NUMERIC(78,0) NOT NULL,
    kind          TEXT NOT NULL,
    finality      TEXT NOT NULL DEFAULT 'pending' CHECK (finality IN ('pending','confirmed','finalized')),
    details       JSONB NOT NULL DEFAULT '{}'::jsonb
) PARTITION BY RANGE (block_time);
CREATE INDEX transfers_hash ON transfers (chain_id, tx_hash);
CREATE INDEX transfers_block ON transfers (chain_id, block_number);

CREATE TABLE price_ticks (
    asset_id       BIGINT NOT NULL REFERENCES assets(id),
    ts             TIMESTAMPTZ NOT NULL,
    price_usd      NUMERIC NOT NULL,
    liquidity_usd  NUMERIC,
    PRIMARY KEY (asset_id, ts)
);

-- ---------- projections ----------
CREATE TABLE balances (
    tracked_address_id  BIGINT NOT NULL REFERENCES tracked_addresses(id) ON DELETE CASCADE,
    asset_id            BIGINT NOT NULL REFERENCES assets(id),
    amount_raw          NUMERIC(78,0) NOT NULL,
    as_of_block         BIGINT NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tracked_address_id, asset_id)
);

CREATE TABLE nft_holdings (
    tracked_address_id  BIGINT NOT NULL REFERENCES tracked_addresses(id) ON DELETE CASCADE,
    asset_id            BIGINT NOT NULL REFERENCES assets(id),
    token_id            NUMERIC(78,0) NOT NULL,
    amount              NUMERIC(78,0) NOT NULL DEFAULT 1,
    media_key           TEXT,
    as_of_block         BIGINT,
    PRIMARY KEY (tracked_address_id, asset_id, token_id)
);

-- Always read by address, so hash-partitioned by address (not by time).
CREATE TABLE address_activity (
    tracked_address_id  BIGINT NOT NULL,
    block_time          TIMESTAMPTZ NOT NULL,
    tx_hash             TEXT NOT NULL,
    chain_id            TEXT NOT NULL,
    direction           TEXT NOT NULL CHECK (direction IN ('in','out','self')),
    summary             JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (tracked_address_id, tx_hash)
) PARTITION BY HASH (tracked_address_id);
CREATE INDEX address_activity_page ON address_activity (tracked_address_id, block_time DESC, tx_hash);
DO $$
BEGIN
    FOR i IN 0..31 LOOP
        EXECUTE format('CREATE TABLE address_activity_p%s PARTITION OF address_activity FOR VALUES WITH (MODULUS 32, REMAINDER %s)', lpad(i::text, 2, '0'), i);
    END LOOP;
END $$;

CREATE TABLE balance_snapshots (
    tracked_address_id  BIGINT NOT NULL REFERENCES tracked_addresses(id) ON DELETE CASCADE,
    day                 DATE NOT NULL,
    asset_id            BIGINT NOT NULL REFERENCES assets(id),
    amount_raw          NUMERIC(78,0) NOT NULL,
    PRIMARY KEY (tracked_address_id, day, asset_id)
);

CREATE TABLE pending_transactions (
    chain_id      TEXT NOT NULL,
    tx_hash       TEXT NOT NULL,
    "from"        TEXT NOT NULL,
    nonce         NUMERIC(78,0),
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    state         TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','confirmed','failed','dropped','replaced')),
    PRIMARY KEY (chain_id, tx_hash)
);

-- ---------- monthly partitions ----------
-- pg_partman (RDS and the Compose image) when available; otherwise
-- harbour_ensure_monthly_partitions(), run daily by `migrate -maintain` as the owner.
CREATE OR REPLACE FUNCTION harbour_ensure_monthly_partitions(parent TEXT, months_back INT, months_ahead INT)
RETURNS VOID LANGUAGE plpgsql AS $fn$
DECLARE
    m DATE;
    pname TEXT;
BEGIN
    IF to_regclass('partman.part_config') IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM partman.part_config WHERE parent_table = 'public.' || parent) THEN
            RETURN;  -- pg_partman owns this table
        END IF;
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I DEFAULT', parent || '_default', parent);
    FOR i IN -months_back..months_ahead LOOP
        m := (date_trunc('month', now()) + make_interval(months => i))::date;
        pname := parent || '_p' || to_char(m, 'YYYYMM');
        IF to_regclass(pname) IS NULL THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                           pname, parent, m, (m + interval '1 month')::date);
        END IF;
    END LOOP;
END $fn$;

DO $$
DECLARE
    use_partman BOOLEAN := false;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_partman') THEN
        BEGIN
            CREATE SCHEMA IF NOT EXISTS partman;
            CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;
            -- pg_partman 5.x signature.
            PERFORM partman.create_parent(p_parent_table => 'public.transactions', p_control => 'block_time', p_interval => '1 month', p_premake => 4);
            PERFORM partman.create_parent(p_parent_table => 'public.transfers',    p_control => 'block_time', p_interval => '1 month', p_premake => 4);
            use_partman := true;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_partman unavailable (%); using harbour_ensure_monthly_partitions', SQLERRM;
        END;
    END IF;
    IF NOT use_partman THEN
        -- History backfill reaches 90 days back, so premake 4 months back.
        PERFORM harbour_ensure_monthly_partitions('transactions', 4, 4);
        PERFORM harbour_ensure_monthly_partitions('transfers', 4, 4);
    END IF;
END $$;

-- ---------- least-privilege roles (NOLOGIN; map service users into them) ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'harbour_api') THEN
        CREATE ROLE harbour_api NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'harbour_indexer') THEN
        CREATE ROLE harbour_indexer NOLOGIN;
    END IF;
    -- API reads everything but cannot write facts.
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO harbour_api;
    GRANT INSERT, UPDATE, DELETE ON devices, tracked_addresses, device_addresses, pending_transactions TO harbour_api;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO harbour_api;
    -- Indexer writes facts and projections, reads identity.
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO harbour_indexer;
    GRANT INSERT, UPDATE, DELETE ON event_keys, transactions, transfers, assets, balances, nft_holdings,
        address_activity, balance_snapshots, price_ticks, pending_transactions, tracked_addresses TO harbour_indexer;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO harbour_indexer;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping role setup: migration user lacks CREATEROLE';
END $$;
