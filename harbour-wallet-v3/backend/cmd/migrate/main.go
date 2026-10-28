// Command migrate applies schema migrations and, with -maintain, premakes
// monthly partitions (run it daily from a scheduler).
package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
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
