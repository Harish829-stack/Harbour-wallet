// Command realtime-bridge relays balance and transaction events from NATS to
// Centrifugo channels the extension subscribes to.
package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"

	"harbour/backend/internal/config"
	"harbour/backend/internal/events"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/realtime"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("realtime-bridge")
	fail := func(msg string, err error) { log.Error(msg, "err", err); os.Exit(1) }
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	u := os.Getenv("NATS_URL")
	if u == "" {
		fail("nats", events.ErrNoBus)
	}
	bus, err := events.Connect(ctx, u, "realtime-bridge", log)
	if err != nil {
		fail("nats", err)
	}
	defer bus.Close()
	key := os.Getenv("CENTRIFUGO_API_KEY")
	if key == "" {
		fail("centrifugo", os.ErrInvalid)
	}
	b := &realtime.Bridge{Bus: bus, APIURL: config.Env("CENTRIFUGO_API_URL", "http://localhost:8000"), APIKey: key, Log: log}
	log.Info("relaying events to centrifugo")
	if err := b.Run(ctx); err != nil && ctx.Err() == nil {
		fail("bridge", err)
	}
}
