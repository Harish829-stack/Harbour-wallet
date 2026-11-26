//go:build live

package earnsvc

import (
	"bufio"
	"os"
	"strings"
)

// HB_LIVE_ENV_FILE points at a backend .env file to read the provider keys from (for runs in a container without a shell).
// Values already in the environment win. Inline comments after whitespace and surrounding quotes are stripped.
func init() {
	path := os.Getenv("HB_LIVE_ENV_FILE")
	if path == "" {
		return
	}
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		k, v, ok := strings.Cut(line, "=")
		if !ok || strings.HasPrefix(line, "#") || strings.ContainsAny(k, " \t") {
			continue
		}
		if i := strings.Index(v, " #"); i >= 0 {
			v = v[:i]
		}
		v = strings.Trim(strings.TrimSpace(v), "\"'")
		if _, set := os.LookupEnv(k); !set {
			os.Setenv(k, v)
		}
	}
}
