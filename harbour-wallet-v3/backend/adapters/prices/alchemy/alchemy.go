// Package alchemy is the fallback price.Source (Alchemy Prices API). It
// reports no liquidity, so callers treat its prices as unverified for
// tokens that look like spam.
package alchemy

import (
	"bytes"
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
const Name = "alchemy-prices"

func init() { registry.PriceSources.Register(Name, New) }

const batch = 25

// Source implements price.Source.
type Source struct {
	base   string
	key    string
	chains map[string]map[string]string
	lim    *ratelimit.Limiter
	http   *http.Client
	now    func() time.Time
}

// New builds the source.
func New(cfg price.SourceConfig) (price.Source, error) {
	if cfg.Getenv == nil {
		return nil, errors.New("alchemy-prices: Getenv is required")
	}
	keyEnv := cfg.Options["key_env"]
	if keyEnv == "" {
		keyEnv = "ALCHEMY_API_KEY"
	}
	key := strings.TrimSpace(cfg.Getenv(keyEnv))
	if key == "" {
		return nil, fmt.Errorf("alchemy-prices: %s is empty", keyEnv)
	}
	base := cfg.Options["base_url"]
	if base == "" {
		base = "https://api.g.alchemy.com/prices/v1"
	}
	rps, _ := strconv.ParseFloat(cfg.Options["rps"], 64)
	return &Source{base: strings.TrimRight(base, "/"), key: key, chains: cfg.Chains, lim: ratelimit.New(rps),
		http: &http.Client{Timeout: 20 * time.Second}, now: time.Now}, nil
}

func (s *Source) Name() string { return Name }

type priceRow struct {
	Symbol  string `json:"symbol"`
	Network string `json:"network"`
	Address string `json:"address"`
	Prices  []struct {
		Currency string `json:"currency"`
		Value    string `json:"value"`
	} `json:"prices"`
	Error any `json:"error"`
}

func (s *Source) do(ctx context.Context, method, path string, body any) ([]priceRow, error) {
	if err := s.lim.Wait(ctx); err != nil {
		return nil, err
	}
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, s.base+path, rd)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.http.Do(req)
	if err != nil {
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err
		}
		return nil, fmt.Errorf("alchemy-prices: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alchemy-prices: http %d", resp.StatusCode)
	}
	var r struct {
		Data []priceRow `json:"data"`
	}
	return r.Data, json.Unmarshal(b, &r)
}

func usd(r priceRow) float64 {
	if r.Error != nil {
		return 0
	}
	for _, p := range r.Prices {
		if strings.EqualFold(p.Currency, "usd") {
			v, _ := strconv.ParseFloat(p.Value, 64)
			return v
		}
	}
	return 0
}

// Quotes prices native coins by symbol and tokens by address.
func (s *Source) Quotes(ctx context.Context, assets []price.AssetKey) ([]price.Quote, error) {
	out := []price.Quote{}
	now := s.now()
	bySym := map[string][]price.AssetKey{}
	var toks []price.AssetKey
	for _, a := range assets {
		if a.AssetRef == "native" {
			if a.ExternalID != "" {
				bySym[strings.ToUpper(a.ExternalID)] = append(bySym[strings.ToUpper(a.ExternalID)], a)
			}
		} else if s.chains[a.Chain]["network"] != "" {
			toks = append(toks, a)
		}
	}
	var firstErr error
	if len(bySym) > 0 {
		q := url.Values{}
		for sym := range bySym {
			q.Add("symbols", sym)
		}
		rows, err := s.do(ctx, http.MethodGet, "/tokens/by-symbol?"+q.Encode(), nil)
		if err != nil {
			firstErr = err
		}
		for _, r := range rows {
			if p := usd(r); p > 0 {
				for _, a := range bySym[strings.ToUpper(r.Symbol)] {
					out = append(out, price.Quote{Asset: a, PriceUSD: p, At: now})
				}
			}
		}
	}
	for i := 0; i < len(toks); i += batch {
		b := toks[i:min(i+batch, len(toks))]
		type addr struct {
			Network string `json:"network"`
			Address string `json:"address"`
		}
		req := struct {
			Addresses []addr `json:"addresses"`
		}{}
		idx := map[string]price.AssetKey{}
		for _, a := range b {
			nw := s.chains[a.Chain]["network"]
			req.Addresses = append(req.Addresses, addr{nw, strings.ToLower(a.AssetRef)})
			idx[nw+"|"+strings.ToLower(a.AssetRef)] = a
		}
		rows, err := s.do(ctx, http.MethodPost, "/tokens/by-address", req)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		for _, r := range rows {
			a, ok := idx[r.Network+"|"+strings.ToLower(r.Address)]
			if p := usd(r); ok && p > 0 {
				out = append(out, price.Quote{Asset: a, PriceUSD: p, At: now})
			}
		}
	}
	if len(out) == 0 && firstErr != nil {
		return nil, firstErr
	}
	return out, nil
}
