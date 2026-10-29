-- Security audit 2026-10-28 (V3-07, V3-09).
--
-- 1. Runtime services stop using the owner/superuser. harbour_app gets data access only (no DDL, no roles, no
--    COPY ... PROGRAM): SELECT/INSERT/UPDATE/DELETE on tables, sequences, and EXECUTE on functions. New partitions are
--    created by the SECURITY DEFINER harbour_ensure_partition as the owner, and default privileges cover them.
--    cmd/migrate creates the LOGIN user (POSTGRES_APP_USER / POSTGRES_APP_PASSWORD) as a member of harbour_app.
-- 2. Privacy: device_addresses.added_at equalled tracked_addresses.created_at to the microsecond for every address a
--    device was first to track, which re-linked devices to addresses without the encryption key. Keep the day only.

UPDATE device_addresses SET added_at = date_trunc('day', added_at);
ALTER TABLE device_addresses ALTER COLUMN added_at SET DEFAULT date_trunc('day', now());

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'harbour_app') THEN
        CREATE ROLE harbour_app NOLOGIN;
    END IF;
    GRANT USAGE ON SCHEMA public TO harbour_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO harbour_app;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO harbour_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO harbour_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO harbour_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO harbour_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO harbour_app;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'partman') THEN
        GRANT USAGE ON SCHEMA partman TO harbour_app;
        GRANT SELECT ON ALL TABLES IN SCHEMA partman TO harbour_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping harbour_app role setup: migration user lacks CREATEROLE';
END $$;
