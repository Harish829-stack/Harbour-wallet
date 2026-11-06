// Command webhook-ingest receives provider webhooks: verify, store raw,
// publish to NATS, return 200.
package main

import (
	"context"
	"errors"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "harbour/backend/adapters/chains/all"
	_ "harbour/backend/adapters/sources/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/index"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/ingest"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	addr := flag.String("addr", config.Env("WEBHOOK_ADDR", ":8082"), "listen address")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("webhook-ingest")
	fail := func(msg string, err error) { log.Error(msg, "err", err); os.Exit(1) }

	cfg, err := config.Load(*cfgDir)
	if err != nil {
		fail("config", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	st, err := store.Open(ctx, os.Getenv("POSTGRES_URL"))
	if err != nil {
		fail("postgres", err)
	}
	defer st.Close()
	if os.Getenv("NATS_URL") == "" {
		fail("nats", events.ErrNoBus)
	}
	bus, err := events.Connect(ctx, os.Getenv("NATS_URL"), "webhook-ingest", log)
	if err != nil {
		fail("nats", err)
	}
	defer bus.Close()
	secret, err := config.DecodeKey("ADDRESS_LINK_ENCRYPTION_KEY", os.Getenv("ADDRESS_LINK_ENCRYPTION_KEY"), 32)
	if err != nil {
		fail("secrets", err)
	}
	box, err := store.NewSecretBox(secret, "webhook-signing-keys")
	if err != nil {
		fail("secrets", err)
	}
	chains, err := indexer.BuildChains(cfg, config.Env("RPC_GATEWAY_URL", "http://localhost:8081"), "", os.Getenv)
	if err != nil {
		fail("sources", err)
	}
	sources := map[string]index.Webhooks{}
	for _, c := range chains {
		if c.Webhooks != nil {
			sources[c.SourceName] = c.Webhooks
		}
	}
	// Keys of hand-made webhooks: "id:key,id:key" in the env var each source names.
	static := map[string]string{}
	for name := range sources {
		env := cfg.Sources[name].Options["signing_keys_env"]
		if env == "" {
			continue
		}
		for _, pair := range strings.Split(os.Getenv(env), ",") {
			if id, key, ok := strings.Cut(strings.TrimSpace(pair), ":"); ok && id != "" && key != "" {
				static[id] = key
			}
		}
	}
	in := ingest.New(ingest.Options{Store: st, Bus: bus, Log: log, Box: box, Sources: sources, StaticKeys: static})
	if err := in.Start(ctx); err != nil {
		fail("start", err)
	}
	go in.RunHeartbeat(ctx)
	hs := &http.Server{Addr: *addr, Handler: in.Handler(), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second}
	go func() {
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		hs.Shutdown(sctx)
	}()
	log.Info("listening", "addr", *addr, "sources", len(sources))
	if err := hs.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fail("serve", err)
	}
}
