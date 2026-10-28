// Command api serves the extension-facing HTTP API.
package main

import (
	"context"
	"errors"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	_ "harbour/backend/adapters/risk/all"
	"harbour/backend/internal/api"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/risk"
	"harbour/backend/internal/events"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	addr := flag.String("addr", config.Env("API_ADDR", ":8080"), "listen address")
	migrate := flag.Bool("migrate", false, "apply migrations before serving (dev convenience)")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("api")
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
	if *migrate {
		if applied, err := st.Migrate(ctx); err != nil {
			fail("migrate", err)
		} else if len(applied) > 0 {
			log.Info("migrations applied", "versions", applied)
		}
	}
	fams := map[string]string{}
	for n, c := range cfg.Chains {
		fams[n] = c.Family
	}
	if err := st.UpsertChains(ctx, fams); err != nil {
		fail("sync chains", err)
	}
	ropt, err := redis.ParseURL(config.Env("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		fail("redis url", err)
	}
	if p := os.Getenv("REDIS_PASSWORD"); p != "" && ropt.Password == "" {
		ropt.Password = p
	}
	rdb := redis.NewClient(ropt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		fail("redis", err)
	}
	key, err := config.DecodeKey("ADDRESS_LINK_ENCRYPTION_KEY", os.Getenv("ADDRESS_LINK_ENCRYPTION_KEY"), 32)
	if err != nil {
		fail("secrets", err)
	}
	lc, err := store.NewLinkCrypto(key)
	if err != nil {
		fail("secrets", err)
	}
	var pub api.Publisher
	if u := os.Getenv("NATS_URL"); u != "" {
		bus, err := events.Connect(ctx, u, "api", log)
		if err != nil {
			fail("nats", err)
		}
		defer bus.Close()
		pub = bus
	} else {
		log.Warn("NATS_URL not set: address.added is only logged; the indexer still picks pending addresses up within 30s")
	}
	pow, _ := strconv.Atoi(os.Getenv("POW_DIFFICULTY"))
	var sim risk.Simulator
	if cfg.Risk.Adapter != "" {
		chains := map[string]map[string]string{}
		for name, ch := range cfg.Chains {
			if o, ok := ch.Risk[cfg.Risk.Adapter]; ok {
				chains[name] = o
			}
		}
		f, err := registry.RiskSimulator.Get(cfg.Risk.Adapter)
		if err == nil {
			sim, err = f(risk.SimulatorConfig{Options: cfg.Risk.Options, Chains: chains, Getenv: os.Getenv})
		}
		if err != nil {
			log.Warn("transaction simulator disabled; using basic checks", "err", err)
			sim = nil
		}
	}
	srv := api.New(api.Options{
		Config: cfg, Store: st, Redis: rdb, LinkCrypto: lc, Log: log, Events: pub,
		GatewayURL:     config.Env("RPC_GATEWAY_URL", "http://localhost:8081"),
		GatewayToken:   os.Getenv("GATEWAY_INTERNAL_TOKEN"),
		TrustProxy:     os.Getenv("TRUST_PROXY_HEADERS") == "1",
		PowDifficulty:  pow,
		Simulator:      sim,
		RealtimeSecret: []byte(os.Getenv("CENTRIFUGO_TOKEN_HMAC_SECRET")),
		RealtimeURL:    config.Env("REALTIME_PUBLIC_URL", "ws://localhost:8000/connection/websocket"),
		VAPIDPublicKey: os.Getenv("VAPID_PUBLIC_KEY"),
	})
	hs := &http.Server{Addr: *addr, Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout: 30 * time.Second, WriteTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		hs.Shutdown(sctx)
	}()
	log.Info("listening", "addr", *addr)
	if err := hs.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fail("serve", err)
	}
}
