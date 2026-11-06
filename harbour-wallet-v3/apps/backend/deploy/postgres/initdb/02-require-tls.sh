#!/bin/sh
set -eu

# The official Postgres entrypoint writes pg_hba.conf during first initialization,
# after the Compose entrypoint has run. Apply the same rule to new volumes.
sed -i -E 's/^host([[:space:]]+)/hostssl\1/' "$PGDATA/pg_hba.conf"
