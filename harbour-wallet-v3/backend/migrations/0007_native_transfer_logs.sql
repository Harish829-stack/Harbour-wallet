-- EIP-7708 chains (Sepolia first) emit a Transfer log from 0xff..fe for every native ETH transfer. The indexer used to
-- store it as a token transfer next to the native one, so each ETH transfer showed twice. Sources now drop it; this
-- removes what was already stored. event_keys rows stay so a replayed delivery can't bring them back.
DO $$
DECLARE ids BIGINT[];
BEGIN
    SELECT array_agg(id) INTO ids FROM assets WHERE asset_ref = '0xfffffffffffffffffffffffffffffffffffffffe';
    IF ids IS NULL THEN RETURN; END IF;
    DELETE FROM transfers WHERE asset_id = ANY(ids);
    DELETE FROM balances WHERE asset_id = ANY(ids);
    UPDATE assets SET spam_score = 100 WHERE id = ANY(ids);
    UPDATE address_activity SET summary = jsonb_set(summary, '{transfers}', COALESCE((
            SELECT jsonb_agg(x) FROM jsonb_array_elements(summary->'transfers') x
            WHERE x->>'asset' <> '0xfffffffffffffffffffffffffffffffffffffffe'), '[]'::jsonb))
     WHERE summary->'transfers' @> '[{"asset":"0xfffffffffffffffffffffffffffffffffffffffe"}]';
END $$;
