-- Fiat on/off-ramp orders (Onramper). One row per checkout Harbour opened for a device; Onramper webhooks move it
-- forward (matched by partner context = id). Privacy: the wallet address is deliberately NOT stored (device_addresses
-- keeps device-to-address links encrypted); a row links a device only to an asset, a network and amounts.
CREATE TABLE IF NOT EXISTS ramp_orders (
    id               UUID PRIMARY KEY,                       -- Harbour order id, sent to Onramper as partnerContext
    device_id        UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    type             TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    status           TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'completed', 'canceled', 'failed')),
    provider         TEXT NOT NULL,                          -- onramp picked in Harbour, e.g. banxa
    payment_method   TEXT NOT NULL,
    chain            TEXT NOT NULL,                          -- Harbour network id, e.g. base
    crypto           TEXT NOT NULL,                          -- Onramper crypto id, e.g. usdc_base
    fiat             TEXT NOT NULL,                          -- ISO 4217, lower case
    fiat_amount      NUMERIC,
    crypto_amount    NUMERIC,
    onramper_session TEXT,
    onramper_tx_id   TEXT UNIQUE,
    provider_tx_id   TEXT,
    tx_hash          TEXT,
    status_reason    TEXT,
    status_at        TIMESTAMPTZ,                            -- statusDate of the last applied webhook (ordering guard)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ramp_orders_device_created ON ramp_orders (device_id, created_at DESC);
