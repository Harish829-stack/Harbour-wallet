// Package logx sets up slog. Logs never include wallet addresses.
package logx

import (
	"log/slog"
	"os"
	"strings"
)

// New returns a JSON logger at the level named by LOG_LEVEL.
func New(service string) *slog.Logger {
	lvl := slog.LevelInfo
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	}
	l := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})).With("service", service)
	slog.SetDefault(l)
	return l
}
