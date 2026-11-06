# Disposable response cache (no persistence, bounded memory, LRU eviction), for platforms where you cannot pass redis flags (Railway).
# Mirrors the `redis-cache` service in docker-compose.yml. Set REDIS_PASSWORD on the service; nonces, quotas and idempotency
# records stay on the persistent Redis, where eviction can never drop them.
FROM redis:7.4-alpine
CMD ["sh", "-c", "exec redis-server --requirepass \"$REDIS_PASSWORD\" --save '' --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru"]
