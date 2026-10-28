-- Phase 4: live webhooks, gap-fill and reorg repair.

-- One row per provider webhook. The signing key is encrypted (AES-GCM, key
-- derived from ADDRESS_LINK_ENCRYPTION_KEY) because it authenticates deliveries.
CREATE TABLE webhooks (
    id               TEXT PRIMARY KEY,          -- provider's webhook id
    source           TEXT NOT NULL,             -- index source name from providers.yaml
    chain_id         TEXT NOT NULL REFERENCES chains(chain_id),
    url              TEXT NOT NULL,
    enc_signing_key  BYTEA NOT NULL,
    address_count    INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhooks_chain ON webhooks (source, chain_id);

-- device_count: how many devices track the address (maintained by the API;
-- device links are encrypted, so the count can't be derived by a join).
-- webhook_id: the webhook currently delivering this address (NULL = not subscribed).
ALTER TABLE tracked_addresses
    ADD COLUMN device_count     INT NOT NULL DEFAULT 0,
    ADD COLUMN webhook_id       TEXT REFERENCES webhooks(id) ON DELETE SET NULL,
    ADD COLUMN last_activity_at TIMESTAMPTZ;
UPDATE tracked_addresses SET device_count = 1;   -- rows so far were all added by a device
CREATE INDEX tracked_addresses_subscribe ON tracked_addresses (chain_id) WHERE webhook_id IS NULL AND device_count > 0;
CREATE INDEX tracked_addresses_unsubscribe ON tracked_addresses (chain_id) WHERE webhook_id IS NOT NULL AND device_count = 0;

-- Raw deliveries, kept 7 days for replay.
CREATE TABLE webhook_deliveries (
    source        TEXT NOT NULL,
    delivery_id   TEXT NOT NULL,
    webhook_id    TEXT,
    chain_id      TEXT,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    body          BYTEA NOT NULL,
    PRIMARY KEY (source, delivery_id)
);
CREATE INDEX webhook_deliveries_received ON webhook_deliveries (received_at);

-- Liveness of webhook-ingest; a gap since the last beat triggers a full gap-fill.
CREATE TABLE service_heartbeats (
    service    TEXT PRIMARY KEY,
    last_beat  TIMESTAMPTZ NOT NULL
);

CREATE INDEX transfers_unfinal ON transfers (chain_id, block_number) WHERE finality <> 'finalized';

DO $$
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON webhooks, webhook_deliveries, service_heartbeats TO harbour_indexer;
    GRANT UPDATE ON tracked_addresses TO harbour_api;
EXCEPTION WHEN undefined_object OR insufficient_privilege THEN
    RAISE NOTICE 'skipping grants';
END $$;
