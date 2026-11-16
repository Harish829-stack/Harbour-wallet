#!/bin/sh
set -eu

# The official Postgres entrypoint writes pg_hba.conf during first initialization,
# after the Compose entrypoint has run. Apply the same rule to new volumes.
# Portable on purpose (no `sed -i`): BSD/macOS sed reads `-i -E` as "backup suffix -E" and then fails, which broke
# `make test` on macOS. The file is rewritten in place with `cat >` so its owner and mode stay as Postgres requires.
hb_hba="$PGDATA/pg_hba.conf"
hb_tmp="$(mktemp "$hb_hba.XXXXXX")"
sed -E 's/^host([[:space:]]+)/hostssl\1/' "$hb_hba" > "$hb_tmp"
cat "$hb_tmp" > "$hb_hba"
rm -f "$hb_tmp"
