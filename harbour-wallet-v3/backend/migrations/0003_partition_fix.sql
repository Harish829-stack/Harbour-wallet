-- pg_partman creates the child starting at the exact time it is given, so
-- ask for the month boundary (it skips a child that already exists).
CREATE OR REPLACE FUNCTION harbour_ensure_partition(parent TEXT, ts TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET TimeZone = 'UTC' AS $fn$
DECLARE
    month_start TIMESTAMPTZ := date_trunc('month', ts);
    m DATE := date_trunc('month', ts)::date;
    pname TEXT := parent || '_p' || to_char(date_trunc('month', ts), 'YYYYMM');
BEGIN
    IF parent NOT IN ('transactions', 'transfers') THEN
        RAISE EXCEPTION 'not a partitioned fact table: %', parent;
    END IF;
    IF to_regclass('partman.part_config') IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM partman.part_config WHERE parent_table = 'public.' || parent) THEN
            -- Skip if a child already starts at this month (bounds print in UTC here).
            IF EXISTS (
                SELECT 1 FROM pg_inherits i
                JOIN pg_class c ON c.oid = i.inhrelid
                WHERE i.inhparent = ('public.' || parent)::regclass
                  AND pg_get_expr(c.relpartbound, c.oid) <> 'DEFAULT'
                  AND pg_get_expr(c.relpartbound, c.oid) LIKE 'FOR VALUES FROM (''' || to_char(month_start, 'YYYY-MM-DD') || '%') THEN
                RETURN;
            END IF;
            PERFORM partman.create_partition_time('public.' || parent, ARRAY[month_start]);
            RETURN;
        END IF;
    END IF;
    IF to_regclass(pname) IS NULL THEN
        BEGIN
            EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                           pname, parent, m, (m + interval '1 month')::date);
        EXCEPTION WHEN duplicate_table THEN
            NULL;
        END;
    END IF;
END $fn$;

-- Backfills that failed on the old function retry now.
UPDATE tracked_addresses SET backfill_state = 'pending', backfill_error = NULL WHERE backfill_state = 'failed';
