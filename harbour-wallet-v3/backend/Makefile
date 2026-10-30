# Harbour backend. Requires Go 1.23+ and Docker.
SHELL := /bin/bash
envval = $(shell ./scripts/envval.sh $(1))

PG_TEST    ?= postgres://harbour:$(call envval,POSTGRES_PASSWORD)@localhost:5432/harbour_test?sslmode=verify-full&sslrootcert=$(CURDIR)/deploy/postgres/certs/ca.crt
REDIS_TEST ?= redis://:$(call envval,REDIS_PASSWORD)@localhost:6379/15
COMPOSE := docker compose --env-file .env -f deploy/docker-compose.yml

.PHONY: setup deps build test test-integration lint up down logs migrate run-api run-gateway smoke

setup:            ## create .env and generate local secrets
	./scripts/setup.sh

deps:             ## resolve modules and go.sum
	go mod tidy

build:
	go build -o bin/ ./cmd/...

test:             ## unit + gateway + contract tests (no services needed)
	go test -race ./...

test-integration: ## phase 1, 3, 4 and 5 exit tests against the Compose Postgres and Redis
	@HB_TEST_POSTGRES_URL='$(PG_TEST)' HB_TEST_REDIS_URL='$(REDIS_TEST)' go test -count=1 -v ./internal/api/ ./internal/indexer/ ./internal/prices/

lint:             ## golangci-lint (depguard) + provider-name check
	golangci-lint run ./...
	./scripts/check-provider-names.sh

up:               ## start Postgres, Redis, NATS, Centrifugo, migrate, rpc-gateway, api
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f api rpc-gateway indexer webhook-ingest price-poller

migrate:
	go run ./cmd/migrate -maintain

run-api:          ## run the API on the host against Compose infra
	go run ./cmd/api -migrate

run-gateway:
	go run ./cmd/rpc-gateway

smoke:            ## register a device, make signed calls, read a block through the gateway
	go run ./cmd/hbdevice register
	go run ./cmd/hbdevice me
	go run ./cmd/hbdevice rpc base '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}'
	go run ./cmd/hbdevice rpc ethereum '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","latest"]}'
	@curl -s -H "Authorization: Bearer $(call envval,GATEWAY_INTERNAL_TOKEN)" localhost:8081/status | head -c 2000; echo
