-- Phase 6: send path, realtime and push.

ALTER TABLE pending_transactions
    ADD COLUMN device_id      UUID REFERENCES devices(id) ON DELETE SET NULL,
    ADD COLUMN checks         INT NOT NULL DEFAULT 0,
    ADD COLUMN next_check_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN block_number   BIGINT,
    ADD COLUMN updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX pending_due ON pending_transactions (next_check_at) WHERE state = 'pending';

-- Web Push subscriptions (one per device; the browser may rotate it).
CREATE TABLE push_subscriptions (
    device_id   UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    channel     TEXT NOT NULL DEFAULT 'webpush',
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which devices to notify for a tracked address. route_tag is a keyed HMAC of
-- the tracked address id (same key family as device_addresses), so the table
-- alone doesn't reveal which address belongs to which device.
CREATE TABLE push_routes (
    route_tag   BYTEA NOT NULL,
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    PRIMARY KEY (route_tag, device_id)
);
CREATE INDEX push_routes_device ON push_routes (device_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'harbour_tracker') THEN
        CREATE ROLE harbour_tracker NOLOGIN;
    END IF;
    GRANT SELECT, UPDATE ON pending_transactions TO harbour_tracker;
    GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions, push_routes TO harbour_api;
    GRANT INSERT ON pending_transactions TO harbour_api;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'skipping role setup';
END $$;
