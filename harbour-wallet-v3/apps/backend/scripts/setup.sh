#!/usr/bin/env bash
# Creates backend/.env from .env.example (if missing) and fills every empty
# "generated" secret. Safe to re-run: existing values are never changed.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || { cp .env.example .env; chmod 600 .env; echo "created .env from .env.example"; }

gen() { openssl rand -hex "$1"; }
ensure() { grep -qE "^$1=" .env || { printf '%s=\n' "$1" >> .env; }; } # older .env files lack newer keys
fill() { # fill VAR with value if VAR= is empty
  local var=$1 val=$2
  if grep -qE "^${var}=[[:space:]]*(#.*)?$" .env; then
    VAL="$val" perl -pi -e "s|^${var}=[ \t]*(#.*)?\$|'${var}='.\$ENV{VAL}.(defined \$1 ? '   '.\$1 : '')|e" .env
    echo "generated $var"
  fi
}
fill POSTGRES_PASSWORD "$(gen 16)"
ensure POSTGRES_APP_PASSWORD; fill POSTGRES_APP_PASSWORD "$(gen 16)"
ensure NATS_PASSWORD; fill NATS_PASSWORD "$(gen 16)"
fill REDIS_PASSWORD "$(gen 16)"
# Per-service logins (audit V3-07 / V3-17): one Postgres login and one NATS login per service.
for v in PG_PW_API PG_PW_INDEXER PG_PW_WEBHOOK PG_PW_PRICES PG_PW_TXTRACK PG_PW_NOTIFIER NATS_PW_API NATS_PW_INDEXER NATS_PW_WEBHOOK NATS_PW_PRICES NATS_PW_TXTRACK NATS_PW_REALTIME NATS_PW_NOTIFIER; do
  ensure "$v"; fill "$v" "$(gen 16)"
done
fill CENTRIFUGO_API_KEY "$(gen 24)"
fill CENTRIFUGO_TOKEN_HMAC_SECRET "$(gen 32)"
fill ADDRESS_LINK_ENCRYPTION_KEY "$(gen 32)"
fill GATEWAY_INTERNAL_TOKEN "$(gen 24)"

# Web Push (VAPID) key pair: P-256, base64url (private scalar, uncompressed public key).
if grep -qE '^VAPID_PRIVATE_KEY=[[:space:]]*(#.*)?$' .env; then
  b64u() { perl -ne 'print pack("H*", $_)' | base64 | tr '+/' '-_' | tr -d '=\n'; }
  txt=$(openssl ecparam -name prime256v1 -genkey -noout 2>/dev/null | openssl ec -text -noout 2>/dev/null)
  hexpriv=$(printf '%s\n' "$txt" | awk '/^priv:/{f=1;next} /^pub:/{f=0} f' | tr -d ' :\n')
  hexpub=$(printf '%s\n' "$txt" | awk '/^pub:/{f=1;next} /^[A-Z]/{f=0} f' | tr -d ' :\n')
  hexpriv=${hexpriv: -64}
  if [ ${#hexpriv} -eq 64 ] && [ ${#hexpub} -eq 130 ]; then
    perl -pi -e 's|^VAPID_PUBLIC_KEY=.*$|VAPID_PUBLIC_KEY=|' .env
    fill VAPID_PRIVATE_KEY "$(printf %s "$hexpriv" | b64u)"
    fill VAPID_PUBLIC_KEY "$(printf %s "$hexpub" | b64u)"
  else
    echo "could not generate VAPID keys with openssl; run: go run ./cmd/hbkeys vapid  and paste them into .env"
  fi
fi

# Networks served: testnets only for now (older .env files predate this setting).
grep -q '^ENABLED_CHAINS=' .env || { printf '\n# Networks served (chains.yaml names). Empty = all.\nENABLED_CHAINS=\n' >> .env; echo "added ENABLED_CHAINS="; }

# HW-2026-007: Postgres TLS certificates, and host-side URLs upgraded from sslmode=disable to verify-full.
./scripts/pg-certs.sh
perl -pi -e 's|^(POSTGRES_URL=postgres://[^?\s]*)\?sslmode=disable|$1?sslmode=verify-full&sslrootcert=deploy/postgres/certs/ca.crt|' .env

# Put the Postgres password into POSTGRES_URL for host-side tools.
pw=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2 | awk '{print $1}')
PW="$pw" perl -pi -e 's|^POSTGRES_URL=postgres://harbour:\@|POSTGRES_URL=postgres://harbour:$ENV{PW}\@|' .env
# Put the NATS password into NATS_URL for host-side tools.
np=$(grep -E '^NATS_PASSWORD=' .env | cut -d= -f2 | awk '{print $1}')
NP="$np" perl -pi -e 's|^NATS_URL=nats://(harbour:)?\@?localhost:4222|NATS_URL=nats://harbour:$ENV{NP}\@localhost:4222|' .env
echo "done; provider keys still to fill by hand if empty: ALCHEMY_API_KEY, INFURA_API_KEY"
