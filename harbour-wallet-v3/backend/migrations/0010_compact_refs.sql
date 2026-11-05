-- Compact chain identifiers (2026-11-05).
--
-- Transaction hashes, block hashes, sender/receiver addresses and asset refs (token / NFT contract, or 'native') were
-- stored as text ("0x" + 40 or 64 hex characters, repeated in every row and index). They are now BYTEA:
--   0x01 || raw bytes   for 0x-prefixed even-length hex (EVM addresses and hashes: 21 / 33 bytes instead of 42 / 66)
--   0x00 || UTF-8 text  for anything else ('native', Solana / Tron / TON addresses, test fixtures), so non-EVM chains
--                       need no further migration.
--   ''                  for the empty string (block_hash of rows backfilled without one).
-- hb_ref(text) encodes and hb_ref_text(bytea) decodes; both are IMMUTABLE SQL functions (inlined by the planner), so
-- queries compare encoded values and indexes stay usable. Hex is normalised to lowercase.
-- The per-address activity summary is also compacted: the asset ref becomes the asset id and the keys shrink to one
-- letter (e: event_ref, a: asset_id, v: amount_raw, k: kind, d: direction, t: token_id, c: counterparty).

CREATE OR REPLACE FUNCTION hb_ref(t text) RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT CASE
        WHEN t = '' THEN ''::bytea
        WHEN t ~ '^0[xX]([0-9a-fA-F]{2})+$' THEN '\x01'::bytea || decode(substr(t, 3), 'hex')
        ELSE '\x00'::bytea || convert_to(t, 'UTF8')
    END
$$;

CREATE OR REPLACE FUNCTION hb_ref_text(b bytea) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT CASE
        WHEN length(b) = 0 THEN ''
        WHEN get_byte(b, 0) = 1 THEN '0x' || encode(substr(b, 2), 'hex')
        ELSE convert_from(substr(b, 2), 'UTF8')
    END
$$;

CREATE OR REPLACE FUNCTION hb_refs(t text[]) RETURNS bytea[]
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT COALESCE(array_agg(hb_ref(x) ORDER BY o), '{}') FROM unnest(t) WITH ORDINALITY AS u(x, o)
$$;

-- 1. Activity summaries -> compact form (needs the text asset_ref, so before step 2).
UPDATE address_activity aa SET summary = jsonb_build_object('transfers', COALESCE((
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'e', e->>'event_ref', 'a', a.id, 'v', e->>'amount_raw', 'k', e->>'kind', 'd', e->>'direction',
        't', NULLIF(e->>'token_id', ''), 'c', NULLIF(e->>'counterparty', ''))) ORDER BY o)
    FROM jsonb_array_elements(aa.summary->'transfers') WITH ORDINALITY AS x(e, o)
    LEFT JOIN assets a ON a.chain_id = aa.chain_id AND a.asset_ref = e->>'asset'), '[]'::jsonb))
WHERE jsonb_typeof(aa.summary->'transfers') = 'array';

-- 2. Columns -> BYTEA (indexes and primary keys are rebuilt by ALTER TYPE; partitions follow their parent).
ALTER TABLE assets               ALTER COLUMN asset_ref TYPE bytea USING hb_ref(asset_ref);
ALTER TABLE event_keys           ALTER COLUMN tx_hash   TYPE bytea USING hb_ref(tx_hash);
ALTER TABLE transactions         ALTER COLUMN tx_hash   TYPE bytea USING hb_ref(tx_hash),
                                 ALTER COLUMN block_hash TYPE bytea USING hb_ref(block_hash),
                                 ALTER COLUMN "from"    TYPE bytea USING hb_ref("from"),
                                 ALTER COLUMN "to"      TYPE bytea USING hb_ref("to");
ALTER TABLE transfers            ALTER COLUMN tx_hash   TYPE bytea USING hb_ref(tx_hash),
                                 ALTER COLUMN block_hash TYPE bytea USING hb_ref(block_hash),
                                 ALTER COLUMN "from"    TYPE bytea USING hb_ref("from"),
                                 ALTER COLUMN "to"      TYPE bytea USING hb_ref("to");
ALTER TABLE address_activity     ALTER COLUMN tx_hash   TYPE bytea USING hb_ref(tx_hash);
ALTER TABLE pending_transactions ALTER COLUMN tx_hash   TYPE bytea USING hb_ref(tx_hash),
                                 ALTER COLUMN "from"    TYPE bytea USING hb_ref("from");

-- Runtime services may call the codec.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'harbour_app') THEN
        GRANT EXECUTE ON FUNCTION hb_ref(text), hb_ref_text(bytea), hb_refs(text[]) TO harbour_app;
    END IF;
END $$;
