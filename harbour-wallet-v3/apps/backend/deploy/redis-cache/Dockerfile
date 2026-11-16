# Disposable response cache (no persistence, bounded memory, LRU eviction), for platforms where you cannot pass redis flags (Railway).
# Mirrors the `redis-cache` service in docker-compose.yml. Set REDIS_PASSWORD on the service; nonces, quotas and idempotency
# records stay on the persistent Redis, where eviction can never drop them.
FROM redis:7.4-alpine
# Fail closed: with an empty password redis-server would start with authentication switched off, and anything that can reach the
# service could read and poison the cached API answers. No password, no server.
CMD ["sh", "-c", "[ -n \"${REDIS_PASSWORD:-}\" ] || { echo 'redis-cache: REDIS_PASSWORD is not set; refusing to start without authentication' >&2; exit 64; }; exec redis-server --requirepass \"$REDIS_PASSWORD\" --save '' --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru"]
