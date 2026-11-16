# Harbour backend. Requires Go 1.26.10 (go.mod) and Docker. ./run.sh is the main entry point; these targets are shortcuts.
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

up:               ## create .env/certs if needed, build and start every service, wait until healthy
	./run.sh up

down:
	$(COMPOSE) down

logs:
	./run.sh logs

migrate:
	go run ./cmd/migrate -maintain

run-api:          ## run the API on the host against Compose infra
	go run ./cmd/api -migrate

run-gateway:
	go run ./cmd/rpc-gateway

smoke:            ## register (or reuse) a test device, signed calls, testnet reads through the gateway
	./run.sh smoke
