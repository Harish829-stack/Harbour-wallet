# Running the Go tests (including the new ones)

Run from `apps/backend`. Use the Docker Postgres/Redis on ports 55432/56379, never your project databases.

## 1. Services (once)

    docker start hb-pg hb-redis 2>/dev/null || {
      docker run -d --name hb-pg -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=harbour -p 55432:5432 postgres:16
      docker run -d --name hb-redis -p 56379:6379 redis:7.4-alpine
    }
    sleep 5
    docker exec hb-pg psql -U harbour -d postgres -c 'create database harbour_test' 2>/dev/null
    export HB_TEST_POSTGRES_URL='postgres://harbour@127.0.0.1:55432/harbour_test?sslmode=disable'
    export HB_TEST_REDIS_URL='redis://127.0.0.1:56379/13'

## 2. Everything, normal run (perf tests skip themselves)

    go test -race -count=1 ./...

## 3. Only the eight new items

    go test -race -count=1 ./internal/config ./internal/devicesig ./internal/hbclient ./internal/indexer -run 'QA'

## 4. Opt-in performance tests (no -race)

    HB_QA_PERF=1 go test -count=1 -v -run 'TestQALoadSignedMe200rps' ./internal/api
    HB_QA_PERF=1 go test -count=1 -v -run 'TestQAGatewayLoad1000rps' ./internal/gateway
    HB_QA_PERF=1 go test -count=1 -v -run 'TestQARealtimeBridgeSteadyLoad' ./internal/realtime
    HB_QA_PERF=1 go test -count=1 -v -run 'TestQASolvePowProductionDifficulty' ./internal/devicesig
    HB_QA_PERF=1 go test -count=1 -v -timeout 20m -run 'TestQAPerfHistoryAndIngestAtScale' ./internal/store

Shorter: add `HB_QA_PERF_SECS=10`. Bounds can be raised on a slow machine: `HB_QA_P99_MS`, `HB_QA_OVERHEAD_MS`, `HB_QA_PAGE_P95_MS`.

## 5. Fuzz the config loader

    go test ./internal/config -run xxx -fuzz=FuzzLoad -fuzztime=60s

## 6. Coverage

    go test -count=1 -coverpkg=./... -coverprofile=/tmp/c.out ./... && go tool cover -func=/tmp/c.out | tail -1

## 7. Optional: Go mutation testing

    go install github.com/go-gremlins/gremlins/cmd/gremlins@latest
    gremlins unleash ./internal/devicesig

## Extension side (already green here)

    cd apps/extension && node --test test/qa/pow-perf.test.js

## Clean-up

    docker rm -f hb-pg hb-redis
