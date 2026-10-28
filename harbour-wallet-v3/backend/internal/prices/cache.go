// Package prices polls price sources for held assets (never per user
// request), caches the result in Redis and records price_ticks.
package prices

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// Flags on a cached price.
const (
	FlagOK   = "ok"
	FlagThin = "thin" // liquidity too low (or unknown) to trust: show "no price"
)

// Cached is one asset's current price as the API reads it.
type Cached struct {
	USD          float64   `json:"usd"`
	LiquidityUSD float64   `json:"liq,omitempty"`
	Source       string    `json:"src"`
	Flag         string    `json:"flag"`
	At           time.Time `json:"at"`
}

// Key is the Redis key for an asset id.
func Key(assetID int64) string { return "hb:price:" + strconv.FormatInt(assetID, 10) }

// Get reads cached prices for many assets (missing ones are absent).
func Get(ctx context.Context, rdb *redis.Client, ids []int64) (map[int64]Cached, error) {
	out := map[int64]Cached{}
	if len(ids) == 0 {
		return out, nil
	}
	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = Key(id)
	}
	vals, err := rdb.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}
	for i, v := range vals {
		s, ok := v.(string)
		if !ok {
			continue
		}
		var c Cached
		if json.Unmarshal([]byte(s), &c) == nil {
			out[ids[i]] = c
		}
	}
	return out, nil
}
