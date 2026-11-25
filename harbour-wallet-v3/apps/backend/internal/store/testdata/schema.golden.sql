CREATE SCHEMA public;
COMMENT ON SCHEMA public IS 'standard public schema';
CREATE FUNCTION public.harbour_ensure_monthly_partitions(parent text, months_back integer, months_ahead integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    m DATE;
    pname TEXT;
BEGIN
    IF to_regclass('partman.part_config') IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM partman.part_config WHERE parent_table = 'public.' || parent) THEN
            RETURN;  -- pg_partman owns this table
        END IF;
    END IF;
    FOR i IN -months_back..months_ahead LOOP
        m := (date_trunc('month', now()) + make_interval(months => i))::date;
        pname := parent || '_p' || to_char(m, 'YYYYMM');
        IF to_regclass(pname) IS NULL THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                           pname, parent, m, (m + interval '1 month')::date);
        END IF;
    END LOOP;
END $$;
CREATE FUNCTION public.harbour_ensure_partition(parent text, ts timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET "TimeZone" TO 'UTC'
    AS $$
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
END $$;
CREATE FUNCTION public.hb_ref(t text) RETURNS bytea
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
    SELECT CASE
        WHEN t = '' THEN ''::bytea
        WHEN t ~ '^0[xX]([0-9a-fA-F]{2})+$' THEN '\x01'::bytea || decode(substr(t, 3), 'hex')
        ELSE '\x00'::bytea || convert_to(t, 'UTF8')
    END
$_$;
CREATE FUNCTION public.hb_ref_text(b bytea) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
    SELECT CASE
        WHEN length(b) = 0 THEN ''
        WHEN get_byte(b, 0) = 1 THEN '0x' || encode(substr(b, 2), 'hex')
        ELSE convert_from(substr(b, 2), 'UTF8')
    END
$$;
CREATE FUNCTION public.hb_refs(t text[]) RETURNS bytea[]
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
    SELECT COALESCE(array_agg(hb_ref(x) ORDER BY o), '{}') FROM unnest(t) WITH ORDINALITY AS u(x, o)
$$;
CREATE TABLE public.address_activity (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
)
PARTITION BY HASH (tracked_address_id);
CREATE TABLE public.address_activity_p00 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p01 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p02 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p03 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p04 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p05 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p06 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p07 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p08 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p09 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p10 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p11 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p12 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p13 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p14 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p15 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p16 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p17 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p18 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p19 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p20 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p21 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p22 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p23 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p24 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p25 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p26 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p27 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p28 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p29 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p30 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.address_activity_p31 (
    tracked_address_id bigint NOT NULL,
    block_time timestamp with time zone NOT NULL,
    tx_hash bytea NOT NULL,
    chain_id text NOT NULL,
    direction text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT address_activity_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text, 'self'::text])))
);
CREATE TABLE public.assets (
    id bigint NOT NULL,
    chain_id text NOT NULL,
    asset_ref bytea NOT NULL,
    symbol text,
    name text,
    decimals integer,
    logo_url text,
    spam_score smallint DEFAULT 0 NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    kind text DEFAULT 'token'::text NOT NULL,
    CONSTRAINT assets_kind_check CHECK ((kind = ANY (ARRAY['native'::text, 'token'::text, 'nft'::text, 'multi'::text])))
);
CREATE SEQUENCE public.assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;
CREATE TABLE public.balance_snapshots (
    tracked_address_id bigint NOT NULL,
    day date NOT NULL,
    asset_id bigint NOT NULL,
    amount_raw numeric(78,0) NOT NULL
);
CREATE TABLE public.balances (
    tracked_address_id bigint NOT NULL,
    asset_id bigint NOT NULL,
    amount_raw numeric(78,0) NOT NULL,
    as_of_block bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.chains (
    chain_id text NOT NULL,
    family text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.device_addresses (
    link_hash bytea NOT NULL,
    device_id uuid NOT NULL,
    enc_tracked_ref bytea NOT NULL,
    added_at timestamp with time zone DEFAULT date_trunc('day'::text, now()) NOT NULL
);
CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_key bytea NOT NULL,
    attestation jsonb,
    quota_tier text DEFAULT 'default'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT devices_public_key_check CHECK ((length(public_key) = 32))
);
CREATE TABLE public.event_keys (
    chain_id text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL
);
CREATE TABLE public.nft_holdings (
    tracked_address_id bigint NOT NULL,
    asset_id bigint NOT NULL,
    token_id numeric(78,0) NOT NULL,
    amount numeric(78,0) DEFAULT 1 NOT NULL,
    media_key text,
    as_of_block bigint,
    name text,
    image_src text
);
CREATE TABLE public.pending_transactions (
    chain_id text NOT NULL,
    tx_hash bytea NOT NULL,
    "from" bytea NOT NULL,
    nonce numeric(78,0),
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    device_id uuid,
    checks integer DEFAULT 0 NOT NULL,
    next_check_at timestamp with time zone DEFAULT now() NOT NULL,
    block_number bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pending_transactions_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'confirmed'::text, 'failed'::text, 'dropped'::text, 'replaced'::text])))
);
CREATE TABLE public.price_ticks (
    asset_id bigint NOT NULL,
    ts timestamp with time zone NOT NULL,
    price_usd numeric NOT NULL,
    liquidity_usd numeric
);
CREATE TABLE public.push_routes (
    route_tag bytea NOT NULL,
    device_id uuid NOT NULL
);
CREATE TABLE public.push_subscriptions (
    device_id uuid NOT NULL,
    channel text DEFAULT 'webpush'::text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.service_heartbeats (
    service text NOT NULL,
    last_beat timestamp with time zone NOT NULL
);
CREATE TABLE public.tracked_addresses (
    id bigint NOT NULL,
    chain_id text NOT NULL,
    address text NOT NULL,
    synced_to_block bigint,
    last_seen_block bigint,
    backfill_state text DEFAULT 'pending'::text NOT NULL,
    backfill_cursor text,
    deny_backfill boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    backfill_started_at timestamp with time zone,
    backfill_error text,
    history_from_block bigint,
    history_complete boolean DEFAULT false NOT NULL,
    balances_refreshed_at timestamp with time zone,
    device_count integer DEFAULT 0 NOT NULL,
    webhook_id text,
    last_activity_at timestamp with time zone,
    nft_dirty boolean DEFAULT true NOT NULL,
    nft_synced_at timestamp with time zone,
    CONSTRAINT tracked_addresses_backfill_state_check CHECK ((backfill_state = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'capped'::text, 'skipped'::text, 'failed'::text, 'dormant'::text])))
);
CREATE SEQUENCE public.tracked_addresses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tracked_addresses_id_seq OWNED BY public.tracked_addresses.id;
CREATE TABLE public.transactions (
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
)
PARTITION BY RANGE (block_time);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    "from" bytea,
    "to" bytea,
    fee_raw numeric(78,0),
    status smallint,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transactions_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
CREATE TABLE public.transfers (
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
)
PARTITION BY RANGE (block_time);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
    chain_id text NOT NULL,
    chain_family text NOT NULL,
    tx_hash bytea NOT NULL,
    event_ref text NOT NULL,
    block_number bigint NOT NULL,
    block_hash bytea NOT NULL,
    block_time timestamp with time zone NOT NULL,
    asset_id bigint NOT NULL,
    "from" bytea,
    "to" bytea,
    amount_raw numeric(78,0) NOT NULL,
    kind text NOT NULL,
    finality text DEFAULT 'pending'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT transfers_finality_check CHECK ((finality = ANY (ARRAY['pending'::text, 'confirmed'::text, 'finalized'::text])))
);
CREATE TABLE public.webhook_deliveries (
    source text NOT NULL,
    delivery_id text NOT NULL,
    webhook_id text,
    chain_id text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    body bytea NOT NULL
);
CREATE TABLE public.webhooks (
    id text NOT NULL,
    source text NOT NULL,
    chain_id text NOT NULL,
    url text NOT NULL,
    enc_signing_key bytea NOT NULL,
    address_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p00 FOR VALUES WITH (modulus 32, remainder 0);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p01 FOR VALUES WITH (modulus 32, remainder 1);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p02 FOR VALUES WITH (modulus 32, remainder 2);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p03 FOR VALUES WITH (modulus 32, remainder 3);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p04 FOR VALUES WITH (modulus 32, remainder 4);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p05 FOR VALUES WITH (modulus 32, remainder 5);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p06 FOR VALUES WITH (modulus 32, remainder 6);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p07 FOR VALUES WITH (modulus 32, remainder 7);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p08 FOR VALUES WITH (modulus 32, remainder 8);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p09 FOR VALUES WITH (modulus 32, remainder 9);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p10 FOR VALUES WITH (modulus 32, remainder 10);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p11 FOR VALUES WITH (modulus 32, remainder 11);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p12 FOR VALUES WITH (modulus 32, remainder 12);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p13 FOR VALUES WITH (modulus 32, remainder 13);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p14 FOR VALUES WITH (modulus 32, remainder 14);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p15 FOR VALUES WITH (modulus 32, remainder 15);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p16 FOR VALUES WITH (modulus 32, remainder 16);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p17 FOR VALUES WITH (modulus 32, remainder 17);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p18 FOR VALUES WITH (modulus 32, remainder 18);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p19 FOR VALUES WITH (modulus 32, remainder 19);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p20 FOR VALUES WITH (modulus 32, remainder 20);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p21 FOR VALUES WITH (modulus 32, remainder 21);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p22 FOR VALUES WITH (modulus 32, remainder 22);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p23 FOR VALUES WITH (modulus 32, remainder 23);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p24 FOR VALUES WITH (modulus 32, remainder 24);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p25 FOR VALUES WITH (modulus 32, remainder 25);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p26 FOR VALUES WITH (modulus 32, remainder 26);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p27 FOR VALUES WITH (modulus 32, remainder 27);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p28 FOR VALUES WITH (modulus 32, remainder 28);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p29 FOR VALUES WITH (modulus 32, remainder 29);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p30 FOR VALUES WITH (modulus 32, remainder 30);
ALTER TABLE ONLY public.address_activity ATTACH PARTITION public.address_activity_p31 FOR VALUES WITH (modulus 32, remainder 31);
ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);
ALTER TABLE ONLY public.tracked_addresses ALTER COLUMN id SET DEFAULT nextval('public.tracked_addresses_id_seq'::regclass);
ALTER TABLE ONLY public.address_activity
    ADD CONSTRAINT address_activity_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p00
    ADD CONSTRAINT address_activity_p00_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p01
    ADD CONSTRAINT address_activity_p01_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p02
    ADD CONSTRAINT address_activity_p02_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p03
    ADD CONSTRAINT address_activity_p03_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p04
    ADD CONSTRAINT address_activity_p04_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p05
    ADD CONSTRAINT address_activity_p05_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p06
    ADD CONSTRAINT address_activity_p06_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p07
    ADD CONSTRAINT address_activity_p07_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p08
    ADD CONSTRAINT address_activity_p08_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p09
    ADD CONSTRAINT address_activity_p09_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p10
    ADD CONSTRAINT address_activity_p10_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p11
    ADD CONSTRAINT address_activity_p11_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p12
    ADD CONSTRAINT address_activity_p12_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p13
    ADD CONSTRAINT address_activity_p13_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p14
    ADD CONSTRAINT address_activity_p14_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p15
    ADD CONSTRAINT address_activity_p15_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p16
    ADD CONSTRAINT address_activity_p16_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p17
    ADD CONSTRAINT address_activity_p17_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p18
    ADD CONSTRAINT address_activity_p18_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p19
    ADD CONSTRAINT address_activity_p19_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p20
    ADD CONSTRAINT address_activity_p20_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p21
    ADD CONSTRAINT address_activity_p21_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p22
    ADD CONSTRAINT address_activity_p22_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p23
    ADD CONSTRAINT address_activity_p23_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p24
    ADD CONSTRAINT address_activity_p24_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p25
    ADD CONSTRAINT address_activity_p25_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p26
    ADD CONSTRAINT address_activity_p26_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p27
    ADD CONSTRAINT address_activity_p27_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p28
    ADD CONSTRAINT address_activity_p28_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p29
    ADD CONSTRAINT address_activity_p29_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p30
    ADD CONSTRAINT address_activity_p30_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.address_activity_p31
    ADD CONSTRAINT address_activity_p31_pkey PRIMARY KEY (tracked_address_id, tx_hash);
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_chain_id_asset_ref_key UNIQUE (chain_id, asset_ref);
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.balance_snapshots
    ADD CONSTRAINT balance_snapshots_pkey PRIMARY KEY (tracked_address_id, day, asset_id);
ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_pkey PRIMARY KEY (tracked_address_id, asset_id);
ALTER TABLE ONLY public.chains
    ADD CONSTRAINT chains_pkey PRIMARY KEY (chain_id);
ALTER TABLE ONLY public.device_addresses
    ADD CONSTRAINT device_addresses_pkey PRIMARY KEY (link_hash);
ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_public_key_key UNIQUE (public_key);
ALTER TABLE ONLY public.event_keys
    ADD CONSTRAINT event_keys_pkey PRIMARY KEY (chain_id, tx_hash, event_ref);
ALTER TABLE ONLY public.nft_holdings
    ADD CONSTRAINT nft_holdings_pkey PRIMARY KEY (tracked_address_id, asset_id, token_id);
ALTER TABLE ONLY public.pending_transactions
    ADD CONSTRAINT pending_transactions_pkey PRIMARY KEY (chain_id, tx_hash);
ALTER TABLE ONLY public.price_ticks
    ADD CONSTRAINT price_ticks_pkey PRIMARY KEY (asset_id, ts);
ALTER TABLE ONLY public.push_routes
    ADD CONSTRAINT push_routes_pkey PRIMARY KEY (route_tag, device_id);
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (device_id);
ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);
ALTER TABLE ONLY public.service_heartbeats
    ADD CONSTRAINT service_heartbeats_pkey PRIMARY KEY (service);
ALTER TABLE ONLY public.tracked_addresses
    ADD CONSTRAINT tracked_addresses_chain_id_address_key UNIQUE (chain_id, address);
ALTER TABLE ONLY public.tracked_addresses
    ADD CONSTRAINT tracked_addresses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (source, delivery_id);
ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);
CREATE INDEX address_activity_page ON ONLY public.address_activity USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p00_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p00 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p01_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p01 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p02_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p02 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p03_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p03 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p04_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p04 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p05_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p05 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p06_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p06 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p07_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p07 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p08_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p08 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p09_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p09 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p10_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p10 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p11_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p11 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p12_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p12 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p13_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p13 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p14_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p14 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p15_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p15 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p16_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p16 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p17_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p17 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p18_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p18 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p19_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p19 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p20_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p20 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p21_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p21 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p22_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p22 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p23_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p23 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p24_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p24 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p25_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p25 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p26_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p26 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p27_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p27 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p28_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p28 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p29_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p29 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p30_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p30 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX address_activity_p31_tracked_address_id_block_time_tx_hash_idx ON public.address_activity_p31 USING btree (tracked_address_id, block_time DESC, tx_hash);
CREATE INDEX balance_snapshots_day ON public.balance_snapshots USING btree (tracked_address_id, day);
CREATE INDEX balances_asset ON public.balances USING btree (asset_id);
CREATE INDEX balances_held ON public.balances USING btree (asset_id) WHERE (amount_raw > (0)::numeric);
CREATE INDEX device_addresses_device ON public.device_addresses USING btree (device_id);
CREATE INDEX nft_holdings_media ON public.nft_holdings USING btree (media_key) WHERE (media_key IS NOT NULL);
CREATE INDEX pending_due ON public.pending_transactions USING btree (next_check_at) WHERE (state = 'pending'::text);
CREATE INDEX push_routes_device ON public.push_routes USING btree (device_id);
CREATE INDEX tracked_addresses_backfill ON public.tracked_addresses USING btree (backfill_state) WHERE (backfill_state = ANY (ARRAY['pending'::text, 'running'::text]));
CREATE INDEX tracked_addresses_subscribe ON public.tracked_addresses USING btree (chain_id) WHERE ((webhook_id IS NULL) AND (device_count > 0));
CREATE INDEX tracked_addresses_sweep ON public.tracked_addresses USING btree (balances_refreshed_at NULLS FIRST);
CREATE INDEX tracked_addresses_unsubscribe ON public.tracked_addresses USING btree (chain_id) WHERE ((webhook_id IS NOT NULL) AND (device_count = 0));
CREATE INDEX transactions_block ON ONLY public.transactions USING btree (chain_id, block_number);
CREATE INDEX transactions_hash ON ONLY public.transactions USING btree (chain_id, tx_hash);
CREATE INDEX transfers_block ON ONLY public.transfers USING btree (chain_id, block_number);
CREATE INDEX transfers_unfinal ON ONLY public.transfers USING btree (chain_id, block_number) WHERE (finality <> 'finalized'::text);
CREATE INDEX transfers_hash ON ONLY public.transfers USING btree (chain_id, tx_hash);
CREATE INDEX webhook_deliveries_received ON public.webhook_deliveries USING btree (received_at);
CREATE INDEX webhooks_chain ON public.webhooks USING btree (source, chain_id);
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p00_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p00_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p01_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p01_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p02_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p02_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p03_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p03_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p04_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p04_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p05_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p05_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p06_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p06_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p07_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p07_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p08_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p08_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p09_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p09_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p10_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p10_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p11_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p11_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p12_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p12_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p13_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p13_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p14_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p14_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p15_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p15_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p16_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p16_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p17_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p17_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p18_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p18_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p19_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p19_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p20_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p20_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p21_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p21_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p22_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p22_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p23_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p23_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p24_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p24_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p25_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p25_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p26_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p26_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p27_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p27_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p28_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p28_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p29_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p29_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p30_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p30_tracked_address_id_block_time_tx_hash_idx;
ALTER INDEX public.address_activity_pkey ATTACH PARTITION public.address_activity_p31_pkey;
ALTER INDEX public.address_activity_page ATTACH PARTITION public.address_activity_p31_tracked_address_id_block_time_tx_hash_idx;
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(chain_id);
ALTER TABLE ONLY public.balance_snapshots
    ADD CONSTRAINT balance_snapshots_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.balance_snapshots
    ADD CONSTRAINT balance_snapshots_tracked_address_id_fkey FOREIGN KEY (tracked_address_id) REFERENCES public.tracked_addresses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_tracked_address_id_fkey FOREIGN KEY (tracked_address_id) REFERENCES public.tracked_addresses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.device_addresses
    ADD CONSTRAINT device_addresses_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.nft_holdings
    ADD CONSTRAINT nft_holdings_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.nft_holdings
    ADD CONSTRAINT nft_holdings_tracked_address_id_fkey FOREIGN KEY (tracked_address_id) REFERENCES public.tracked_addresses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pending_transactions
    ADD CONSTRAINT pending_transactions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.price_ticks
    ADD CONSTRAINT price_ticks_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.push_routes
    ADD CONSTRAINT push_routes_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tracked_addresses
    ADD CONSTRAINT tracked_addresses_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(chain_id);
ALTER TABLE ONLY public.tracked_addresses
    ADD CONSTRAINT tracked_addresses_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE SET NULL;
ALTER TABLE public.transfers
    ADD CONSTRAINT transfers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_chain_id_fkey FOREIGN KEY (chain_id) REFERENCES public.chains(chain_id);
