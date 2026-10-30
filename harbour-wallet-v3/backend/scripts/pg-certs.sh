#!/usr/bin/env bash
# HW-2026-007: local TLS for Postgres. Creates a private CA and a server certificate for the Compose host names
# (postgres, localhost, 127.0.0.1) in deploy/postgres/certs. Services connect with sslmode=verify-full against ca.crt.
# Safe to re-run: existing certificates are kept unless --force is given. In production use your provider's CA
# (for RDS: the AWS RDS CA bundle) instead of this script.
set -euo pipefail
cd "$(dirname "$0")/.."
dir=deploy/postgres/certs
# Docker creates empty DIRECTORIES for missing bind-mount sources if `make up` ran before this script: remove those.
for f in server.crt server.key ca.crt; do if [[ -d "$dir/$f" ]]; then rmdir "$dir/$f"; fi; done
[[ "${1:-}" == "--force" ]] && rm -f "$dir"/*.crt "$dir"/*.key "$dir"/*.srl "$dir"/*.csr
if [[ -f "$dir/server.crt" && -f "$dir/ca.crt" ]]; then echo "postgres TLS certificates already present in $dir"; exit 0; fi
mkdir -p "$dir"; chmod 700 "$dir"
umask 077
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 825 \
  -subj "/CN=Harbour local Postgres CA" -keyout "$dir/ca.key" -out "$dir/ca.crt" 2>/dev/null
openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -subj "/CN=postgres" \
  -keyout "$dir/server.key" -out "$dir/server.csr" 2>/dev/null
printf 'subjectAltName=DNS:postgres,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n' > "$dir/ext.cnf"
openssl x509 -req -in "$dir/server.csr" -CA "$dir/ca.crt" -CAkey "$dir/ca.key" -CAcreateserial -days 825 \
  -extfile "$dir/ext.cnf" -out "$dir/server.crt" 2>/dev/null
rm -f "$dir/server.csr" "$dir/ext.cnf"
chmod 644 "$dir/ca.crt" "$dir/server.crt"; chmod 600 "$dir/ca.key" "$dir/server.key"
echo "created Postgres TLS certificates in $dir (CA: ca.crt)"
