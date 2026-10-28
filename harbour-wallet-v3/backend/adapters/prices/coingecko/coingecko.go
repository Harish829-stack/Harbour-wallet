// Package coingecko is the primary price.Source. Native coins use
// /simple/price, listed tokens /simple/token_price (liquidity = 24h volume),
// and long-tail DEX tokens the onchain endpoint (liquidity = pool reserves).
package coingecko

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"harbour/backend/internal/core/price"
	"harbour/backend/internal/ratelimit"
	"harbour/backend/internal/registry"
)

// Name is the adapter name used in providers.yaml.
const Name = "coingecko"

func init() { registry.PriceSources.Register(Name, New) }

const (
	tokenBatch   = 100 // well under the documented 515 per call
	onchainBatch = 30  // demo-plan cap for the onchain endpoint
)

// Source implements price.Source.
type Source struct {
	base   string
	header string
	key    string
	chains map[string]map[string]string
	lim    *ratelimit.Limiter
	http   *http.Client
	now    func() time.Time
}

// New builds the source. With no key it still works on the keyless public
// tier, which is heavily rate limited; a Demo key is recommended.
func New(cfg price.SourceConfig) (price.Source, error) {
	getenv := cfg.Getenv
	if getenv == nil {
		return nil, errors.New("coingecko: Getenv is required")
	}
	keyEnv := cfg.Options["key_env"]
	if keyEnv == "" {
		keyEnv = "COINGECKO_API_KEY"
	}
	plan := "demo"
	if e := cfg.Options["plan_env"]; e != "" && getenv(e) != "" {
		plan = strings.ToLower(strings.TrimSpace(getenv(e)))
	}
	s := &Source{key: strings.TrimSpace(getenv(keyEnv)), chains: cfg.Chains, http: &http.Client{Timeout: 20 * time.Second}, now: time.Now}
	switch plan {
	case "pro":
		s.base, s.header = "https://pro-api.coingecko.com/api/v3", "x-cg-pro-api-key"
	default:
		s.base, s.header = "https://api.coingecko.com/api/v3", "x-cg-demo-api-key"
	}
	if b := cfg.Options["base_url"]; b != "" {
		s.base = b
	}
	rps, _ := strconv.ParseFloat(cfg.Options["rps"], 64)
	s.lim = ratelimit.New(rps)
	return s, nil
}

func (s *Source) Name() string { return Name }

func (s *Source) get(ctx context.Context, path string, q url.Values, out any) error {
	if err := s.lim.Wait(ctx); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.base+path+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if s.key != "" {
		req.Header.Set(s.header, s.key)
	}
	resp, err := s.http.Do(req)
	if err != nil {
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err
		}
		return fmt.Errorf("coingecko: %w", err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		if len(b) > 200 {
			b = b[:200]
		}
		return fmt.Errorf("coingecko: http %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return json.Unmarshal(b, out)
}

// Quotes prices the assets it can; unknown ones are simply omitted.
func (s *Source) Quotes(ctx context.Context, assets []price.AssetKey) ([]price.Quote, error) {
	out := []price.Quote{}
	now := s.now()
	// Native coins by coin id.
	coinFor := map[string][]price.AssetKey{}
	tokens := map[string][]price.AssetKey{} // chain -> tokens
	for _, a := range assets {
		if a.AssetRef == "native" {
			if a.ExternalID != "" {
				coinFor[a.ExternalID] = append(coinFor[a.ExternalID], a)
			}
			continue
		}
		if s.chains[a.Chain]["platform"] != "" || s.chains[a.Chain]["onchain_network"] != "" {
			tokens[a.Chain] = append(tokens[a.Chain], a)
		}
	}
	var firstErr error
	keep := func(err error) {
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if len(coinFor) > 0 {
		ids := make([]string, 0, len(coinFor))
		for id := range coinFor {
			ids = append(ids, id)
		}
		var r map[string]map[string]float64
		err := s.get(ctx, "/simple/price", url.Values{"ids": {strings.Join(ids, ",")}, "vs_currencies": {"usd"}, "include_24hr_vol": {"true"}}, &r)
		keep(err)
		for id, v := range r {
			if p := v["usd"]; p > 0 {
				for _, a := range coinFor[id] {
					out = append(out, price.Quote{Asset: a, PriceUSD: p, LiquidityUSD: v["usd_24h_vol"], At: now})
				}
			}
		}
	}
	for chain, list := range tokens {
		opts := s.chains[chain]
		missing := list
		if pf := opts["platform"]; pf != "" {
			missing = nil
			for i := 0; i < len(list); i += tokenBatch {
				batch := list[i:min(i+tokenBatch, len(list))]
				addrs := make([]string, len(batch))
				for j, a := range batch {
					addrs[j] = strings.ToLower(a.AssetRef)
				}
				var r map[string]map[string]float64
				err := s.get(ctx, "/simple/token_price/"+url.PathEscape(pf), url.Values{"contract_addresses": {strings.Join(addrs, ",")},
					"vs_currencies": {"usd"}, "include_24hr_vol": {"true"}}, &r)
				keep(err)
				for _, a := range batch {
					v, ok := r[strings.ToLower(a.AssetRef)]
					if !ok || v["usd"] <= 0 {
						missing = append(missing, a)
						continue
					}
					out = append(out, price.Quote{Asset: a, PriceUSD: v["usd"], LiquidityUSD: v["usd_24h_vol"], At: now})
				}
			}
		}
		// Long tail: DEX pools via the onchain endpoint.
		if nw := opts["onchain_network"]; nw != "" {
			for i := 0; i < len(missing); i += onchainBatch {
				batch := missing[i:min(i+onchainBatch, len(missing))]
				addrs := make([]string, len(batch))
				for j, a := range batch {
					addrs[j] = strings.ToLower(a.AssetRef)
				}
				var r struct {
					Data struct {
						Attributes struct {
							TokenPrices map[string]string `json:"token_prices"`
							Reserves    map[string]string `json:"total_reserve_in_usd"`
						} `json:"attributes"`
					} `json:"data"`
				}
				err := s.get(ctx, "/onchain/simple/networks/"+url.PathEscape(nw)+"/token_price/"+strings.Join(addrs, ","),
					url.Values{"include_total_reserve_in_usd": {"true"}}, &r)
				keep(err)
				for _, a := range batch {
					ps := r.Data.Attributes.TokenPrices[strings.ToLower(a.AssetRef)]
					p, _ := strconv.ParseFloat(ps, 64)
					if p <= 0 {
						continue
					}
					liq, _ := strconv.ParseFloat(r.Data.Attributes.Reserves[strings.ToLower(a.AssetRef)], 64)
					out = append(out, price.Quote{Asset: a, PriceUSD: p, LiquidityUSD: liq, At: now})
				}
			}
		}
	}
	if len(out) == 0 && firstErr != nil {
		return nil, firstErr
	}
	return out, nil
}
