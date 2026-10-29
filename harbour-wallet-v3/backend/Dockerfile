# Builds every binary; pick one with the container command, e.g.
#   docker build -t harbour-backend .
#   docker run harbour-backend /app/bin/api -config /app/config
FROM golang:1.26-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
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

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/ /app/bin/
# Copied from the build stage so host file permissions never matter.
COPY --from=build /src/config/ /app/config/
USER nonroot
