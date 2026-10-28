// Command indexer backfills tracked addresses, refreshes balances from chain
// and syncs NFT holdings.
package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "harbour/backend/adapters/chains/all"
	_ "harbour/backend/adapters/sources/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/events"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	addr := flag.String("addr", config.Env("INDEXER_ADDR", ":8083"), "health listen address")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("indexer")
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
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		fail("nats", events.ErrNoBus)
	}
	bus, err := events.Connect(ctx, natsURL, "indexer", log)
	if err != nil {
		fail("nats", err)
	}
	defer bus.Close()
	chains, err := indexer.BuildChains(cfg, config.Env("RPC_GATEWAY_URL", "http://localhost:8081"),
		os.Getenv("GATEWAY_INTERNAL_TOKEN"), os.Getenv)
	if err != nil {
		fail("chains", err)
	}
	names := make([]string, 0, len(chains))
	for n := range chains {
		names = append(names, n)
	}
	log.Info("indexing", "chains", names)
	ix := indexer.New(st, cfg.Indexer, bus, chains, log)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		cctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := st.Pool.Ping(cctx); err != nil {
			http.Error(w, `{"ok":false}`, http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte(`{"ok":true}`))
	})
	hs := &http.Server{Addr: *addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() { _ = hs.ListenAndServe() }()
	go func() { <-ctx.Done(); hs.Close() }()
	ix.Run(ctx)
}
