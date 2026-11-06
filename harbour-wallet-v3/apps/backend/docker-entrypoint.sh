#!/bin/sh
# Starts the Harbour service named by $SERVICE. One image, one binary per container: every Railway (or other PaaS) service uses
# the same Dockerfile and differs only in SERVICE. Docker Compose does not use this script (it builds the `local` stage).
set -eu
svc="${SERVICE:-}"
case "$svc" in
  api|rpc-gateway|indexer|webhook-ingest|price-poller|tx-tracker|notifier)
    exec "/app/bin/$svc" -config /app/config ;;
  realtime-bridge)
    exec /app/bin/realtime-bridge ;;
  migrate)
    # Applies migrations, creates the services' database logins, premakes partitions, then exits.
    exec /app/bin/migrate -maintain ;;
  *)
    echo "SERVICE must be one of: api rpc-gateway indexer webhook-ingest price-poller tx-tracker notifier realtime-bridge migrate (got '${svc}')" >&2
    exit 64 ;;
esac
