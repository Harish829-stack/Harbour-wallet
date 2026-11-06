// Command notifier delivers push notifications for incoming transfers and
// settled transactions.
package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"

	_ "harbour/backend/adapters/notify/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/events"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/notifier"
	"harbour/backend/internal/registry"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("notifier")
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
	key, err := config.DecodeKey("ADDRESS_LINK_ENCRYPTION_KEY", os.Getenv("ADDRESS_LINK_ENCRYPTION_KEY"), 32)
	if err != nil {
		fail("link key", err)
	}
	lc, err := store.NewLinkCrypto(key)
	if err != nil {
		fail("link key", err)
	}
	ropt, err := redis.ParseURL(config.Env("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		fail("redis", err)
	}
	if p := os.Getenv("REDIS_PASSWORD"); p != "" && ropt.Password == "" {
		ropt.Password = p
	}
	u := os.Getenv("NATS_URL")
	if u == "" {
		fail("nats", events.ErrNoBus)
	}
	bus, err := events.Connect(ctx, u, "notifier", log)
	if err != nil {
		fail("nats", err)
	}
	defer bus.Close()
	channels := map[string]notify.Channel{}
	for name, def := range cfg.NotifyChannels {
		f, err := registry.NotifyChannel.Get(def.Adapter)
		if err != nil {
			fail("notify channel", err)
		}
		ch, err := f(def.Options)
		if err != nil {
			log.Warn("notify channel disabled", "channel", name, "err", err)
			continue
		}
		channels[name] = ch
	}
	if len(channels) == 0 {
		log.Warn("no notify channels configured; events are consumed but nothing is sent")
	}
	n := &notifier.Notifier{St: st, LC: lc, Redis: redis.NewClient(ropt), Bus: bus, Channels: channels, Log: log}
	log.Info("delivering notifications", "channels", len(channels))
	if err := n.Run(ctx); err != nil && ctx.Err() == nil {
		fail("notifier", err)
	}
}
