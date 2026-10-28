// Command tx-tracker follows broadcast transactions to confirmation and
// publishes tx.status events.
package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"

	_ "harbour/backend/adapters/chains/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/events"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/store"
	"harbour/backend/internal/txtrack"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("tx-tracker")
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
	var bus events.Bus = events.Log{L: log}
	if u := os.Getenv("NATS_URL"); u != "" {
		nb, err := events.Connect(ctx, u, "tx-tracker", log)
		if err != nil {
			fail("nats", err)
		}
		defer nb.Close()
		bus = nb
	}
	chains, err := txtrack.BuildChains(cfg, config.Env("RPC_GATEWAY_URL", "http://localhost:8081"), os.Getenv("GATEWAY_INTERNAL_TOKEN"))
	if err != nil {
		fail("chains", err)
	}
	log.Info("tracking transactions", "chains", len(chains))
	(&txtrack.Tracker{St: st, Bus: bus, Chains: chains, Log: log}).Run(ctx)
}
