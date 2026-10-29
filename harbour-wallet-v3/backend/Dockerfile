# Builds every binary; pick one with the container command, e.g.
#   docker build -t harbour-backend .
#   docker run harbour-backend /app/bin/api -config /app/config
FROM golang:1.26-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
COPY go.mod go.sum ./
RUN go mod download || true
COPY . .
# tidy adds any go.sum lines missing from the checkout (golang.org/x modules).
RUN go mod tidy && go build -trimpath -ldflags="-s -w" -o /out/ ./cmd/... \
 && chmod -R a+rX /src/config

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/ /app/bin/
# Copied from the build stage so host file permissions never matter.
COPY --from=build /src/config/ /app/config/
USER nonroot
