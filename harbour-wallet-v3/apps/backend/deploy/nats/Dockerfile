# NATS with the Harbour auth/permissions config baked in, for platforms without bind mounts (Railway).
# Docker Compose does not use this file: it runs the stock image and mounts nats.conf.
# Passwords come from the service environment (NATS_PASSWORD, NATS_PW_API, NATS_PW_INDEXER, NATS_PW_WEBHOOK, NATS_PW_PRICES,
# NATS_PW_TXTRACK, NATS_PW_REALTIME, NATS_PW_NOTIFIER). Attach a volume at /data: JetStream keeps the HARBOUR stream there.
FROM nats:2.10-alpine
COPY nats.conf /etc/nats/nats.conf
CMD ["-c", "/etc/nats/nats.conf"]
