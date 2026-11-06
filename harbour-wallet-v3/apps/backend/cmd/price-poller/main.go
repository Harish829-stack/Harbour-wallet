// Command price-poller fetches prices for held tokens on a schedule, caches
// them in Redis, records price_ticks and takes daily balance snapshots.
package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"

	_ "harbour/backend/adapters/prices/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/price"
	"harbour/backend/internal/events"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/prices"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("price-poller")
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
	ropt, err := redis.ParseURL(config.Env("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		fail("redis", err)
	}
	if p := os.Getenv("REDIS_PASSWORD"); p != "" && ropt.Password == "" {
		ropt.Password = p
	}
	rdb := redis.NewClient(ropt)
	var bus events.Bus = events.Log{L: log}
	if u := os.Getenv("NATS_URL"); u != "" {
		nb, err := events.Connect(ctx, u, "price-poller", log)
		if err != nil {
			fail("nats", err)
		}
		defer nb.Close()
		bus = nb
	}
	var sources []prices.Named
	for _, def := range cfg.PriceSources {
		f, err := registry.PriceSources.Get(def.Adapter)
		if err != nil {
			fail("price source", err)
		}
		chains := map[string]map[string]string{}
		for name, ch := range cfg.Chains {
			if o, ok := ch.Prices[def.Name]; ok {
				chains[name] = o
			}
		}
		s, err := f(price.SourceConfig{Name: def.Name, Options: def.Options, Chains: chains, Getenv: os.Getenv})
		if err != nil {
			log.Warn("price source disabled", "source", def.Name, "err", err)
			continue
		}
		sources = append(sources, prices.Named{Name: def.Name, Source: s})
	}
	if len(sources) == 0 {
		fail("price sources", os.ErrNotExist)
	}
	for _, def := range cfg.PriceSources {
		if env := def.Options["key_env"]; env != "" && os.Getenv(env) == "" {
			log.Warn("price source has no API key; it may run on a keyless, heavily rate-limited tier", "source", def.Name, "env", env)
		}
	}
	p := &prices.Poller{St: st, Redis: rdb, Bus: bus, Sources: sources, Chains: cfg.Chains, Cfg: cfg.Prices, Log: log}
	log.Info("polling prices", "sources", len(sources))
	p.Run(ctx)
}
