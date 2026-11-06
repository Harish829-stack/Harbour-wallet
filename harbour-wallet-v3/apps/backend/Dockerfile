# syntax=docker/dockerfile:1
#
# Harbour backend image: one source tree, one image build, nine service binaries (+ three operator tools).
#
# Stages
#   build    compiles every binary in ./cmd/...
#   local    distroless image holding ALL binaries in /app/bin. Docker Compose builds this one (`target: local`) and starts each
#            service with an explicit `command`, e.g.  docker run harbour-backend:local /app/bin/api -config /app/config
#   railway  LAST stage, so it is what a plain `docker build .` and Railway produce. One service per container; the binary is
#            chosen by the SERVICE variable (see docker-entrypoint.sh), so every Railway service uses this same Dockerfile.
#
#   docker build -t harbour-backend --build-arg SERVICE=api .      # plain build; SERVICE can also be set at run time
#
FROM golang:1.26.10-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOTOLCHAIN=local
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Reproducible: the build uses go.mod/go.sum exactly as committed (-mod=readonly) and never rewrites them (audit V3-23).
# CI checks `go mod tidy` leaves no diff. If go.sum is behind, run `go mod tidy` locally and commit it; for a one-off local
# build only: docker build --build-arg ALLOW_TIDY=1 .
ARG ALLOW_TIDY=0
RUN if [ "$ALLOW_TIDY" = "1" ]; then go mod tidy; fi \
 && go build -mod=readonly -trimpath -ldflags="-s -w" -o /out/ ./cmd/... \
 && chmod -R a+rX /src/config

FROM gcr.io/distroless/static-debian12:nonroot AS local
WORKDIR /app
COPY --from=build /out/ /app/bin/
# Copied from the build stage so host file permissions never matter.
COPY --from=build /src/config/ /app/config/
USER nonroot

FROM alpine:3.21 AS railway
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 harbour
WORKDIR /app
COPY --from=build /out/ /app/bin/
COPY --from=build /src/config/ /app/config/
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
# The host file may be 0600 (private checkout); the non-root runtime user must still be able to run it.
RUN chmod 0755 /app/docker-entrypoint.sh
# Railway passes service variables to the build as build args when the Dockerfile declares them; at run time the same variable
# is in the environment. Set SERVICE on every Railway service (api, rpc-gateway, indexer, ...).
ARG SERVICE=api
ENV SERVICE=${SERVICE}
USER harbour
ENTRYPOINT ["/app/docker-entrypoint.sh"]
