// Command rpc-gateway is the only Harbour process that talks JSON-RPC to
// providers. Bind it to the private network only.
package main

import (
	"context"
	"errors"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "harbour/backend/adapters/rpc/all"
	"harbour/backend/internal/config"
	"harbour/backend/internal/gateway"
	"harbour/backend/internal/logx"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	cfgDir := flag.String("config", "config", "config directory")
	addr := flag.String("addr", config.Env("GATEWAY_ADDR", ":8081"), "listen address")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("rpc-gateway")
	cfg, err := config.Load(*cfgDir)
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}
	g, err := gateway.New(cfg, os.Getenv, log)
	if err != nil {
		log.Error("gateway", "err", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go g.Run(ctx)
	hs := &http.Server{Addr: *addr, Handler: g.Handler(os.Getenv("GATEWAY_INTERNAL_TOKEN")),
		ReadHeaderTimeout: 10 * time.Second, WriteTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		hs.Shutdown(sctx)
	}()
	log.Info("listening", "addr", *addr)
	if err := hs.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("serve", "err", err)
		os.Exit(1)
	}
}
