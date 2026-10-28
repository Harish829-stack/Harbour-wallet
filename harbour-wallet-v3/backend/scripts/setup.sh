#!/usr/bin/env bash
# Creates backend/.env from .env.example (if missing) and fills every empty
# "generated" secret. Safe to re-run: existing values are never changed.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || { cp .env.example .env; chmod 600 .env; echo "created .env from .env.example"; }

gen() { openssl rand -hex "$1"; }
fill() { # fill VAR with value if VAR= is empty
  local var=$1 val=$2
  if grep -qE "^${var}=[[:space:]]*(#.*)?$" .env; then
    VAL="$val" perl -pi -e "s|^${var}=[ \t]*(#.*)?\$|'${var}='.\$ENV{VAL}.(defined \$1 ? '   '.\$1 : '')|e" .env
    echo "generated $var"
  fi
}
fill POSTGRES_PASSWORD "$(gen 16)"
fill REDIS_PASSWORD "$(gen 16)"
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

# Put the Postgres password into POSTGRES_URL for host-side tools.
pw=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2 | awk '{print $1}')
PW="$pw" perl -pi -e 's|^POSTGRES_URL=postgres://harbour:\@|POSTGRES_URL=postgres://harbour:$ENV{PW}\@|' .env
echo "done; provider keys still to fill by hand if empty: ALCHEMY_API_KEY, INFURA_API_KEY"
