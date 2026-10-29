// Command migrate applies schema migrations and, with -maintain, premakes
// monthly partitions (run it daily from a scheduler).
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"harbour/backend/internal/config"
	"harbour/backend/internal/logx"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file (ignored if missing)")
	maintain := flag.Bool("maintain", false, "also run partition maintenance")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	log := logx.New("migrate")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	st, err := store.Open(ctx, os.Getenv("POSTGRES_URL"))
	if err != nil {
		die(log, "postgres", err)
	}
	defer st.Close()
	applied, err := st.Migrate(ctx)
	if err != nil {
		die(log, "migrate", err)
	}
	log.Info("migrations", "applied", applied)
	// The services connect as this user (a member of harbour_app), never as the owner that runs migrations.
	if u, p := os.Getenv("POSTGRES_APP_USER"), os.Getenv("POSTGRES_APP_PASSWORD"); u != "" || p != "" {
		if err := st.EnsureAppLogin(ctx, u, p); err != nil {
			die(log, "app user", err)
		}
		log.Info("app database user ready", "user", u)
	}
	// One login per service ("user:password,user:password"), each a member of harbour_app, so credentials are isolated per service.
	if list := os.Getenv("POSTGRES_SERVICE_USERS"); list != "" {
		for _, kv := range strings.Split(list, ",") {
			u, p, ok := strings.Cut(strings.TrimSpace(kv), ":")
			if !ok || u == "" || p == "" {
				die(log, "service users", fmt.Errorf("POSTGRES_SERVICE_USERS entries must look like user:password"))
			}
			if err := st.EnsureAppLogin(ctx, u, p); err != nil {
				die(log, "service user "+u, err)
			}
			log.Info("service database user ready", "user", u)
		}
	}
	if *maintain {
		if err := st.MaintainPartitions(ctx); err != nil {
			die(log, "maintain", err)
		}
		log.Info("partitions maintained")
	}
}

func die(log *slog.Logger, msg string, err error) {
	log.Error(msg, "err", err)
	os.Exit(1)
}
