// Package alchemy is the first risk.Simulator: alchemy_simulateAssetChanges.
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

	"harbour/backend/internal/core/risk"
	"harbour/backend/internal/registry"
)

// Name is the adapter name used in providers.yaml.
const Name = "alchemy-simulate"

func init() { registry.RiskSimulator.Register(Name, New) }

// Simulator implements risk.Simulator.
type Simulator struct {
	key    string
	base   string // template with {network}
	chains map[string]map[string]string
	http   *http.Client
}

// New builds the simulator.
func New(cfg risk.SimulatorConfig) (risk.Simulator, error) {
	if cfg.Getenv == nil {
		return nil, errors.New("alchemy-simulate: Getenv is required")
	}
	env := cfg.Options["key_env"]
	if env == "" {
		env = "ALCHEMY_API_KEY"
	}
	key := strings.TrimSpace(cfg.Getenv(env))
	if key == "" {
		return nil, fmt.Errorf("alchemy-simulate: %s is empty", env)
	}
	base := cfg.Options["base_url"]
	if base == "" {
		base = "https://{network}.g.alchemy.com"
	}
	return &Simulator{key: key, base: base, chains: cfg.Chains, http: &http.Client{Timeout: 20 * time.Second}}, nil
}

func (s *Simulator) Name() string { return Name }

const maxUint256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

// Simulate runs the transaction against the latest state.
func (s *Simulator) Simulate(ctx context.Context, chain string, tx map[string]any) (risk.Result, error) {
	nw := s.chains[chain]["network"]
	if nw == "" {
		return risk.Result{}, risk.ErrUnsupported
	}
	body, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": "alchemy_simulateAssetChanges", "params": []any{tx}})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.ReplaceAll(s.base, "{network}", nw)+"/v2/"+s.key, bytes.NewReader(body))
	if err != nil {
		return risk.Result{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.http.Do(req)
	if err != nil {
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err
		}
		return risk.Result{}, fmt.Errorf("alchemy-simulate: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode != http.StatusOK {
		return risk.Result{}, fmt.Errorf("alchemy-simulate: http %d", resp.StatusCode)
	}
	var env struct {
		Result *struct {
			Changes []struct {
				AssetType       string          `json:"assetType"`
				ChangeType      string          `json:"changeType"`
				From            string          `json:"from"`
				To              string          `json:"to"`
				RawAmount       string          `json:"rawAmount"`
				ContractAddress string          `json:"contractAddress"`
				TokenID         string          `json:"tokenId"`
				Symbol          string          `json:"symbol"`
				Decimals        json.RawMessage `json:"decimals"`
			} `json:"changes"`
			GasUsed string `json:"gasUsed"`
			Error   *struct {
				Message string `json:"message"`
			} `json:"error"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(b, &env); err != nil {
		return risk.Result{}, err
	}
	if env.Error != nil {
		if strings.Contains(strings.ToLower(env.Error.Message), "not supported") || env.Error.Code == -32601 {
			return risk.Result{}, risk.ErrUnsupported
		}
		return risk.Result{}, fmt.Errorf("alchemy-simulate: %s", env.Error.Message)
	}
	if env.Result == nil {
		return risk.Result{}, errors.New("alchemy-simulate: empty result")
	}
	r := risk.Result{}
	if env.Result.Error != nil {
		r.Reverted, r.Error = true, env.Result.Error.Message
	}
	if g := strings.TrimPrefix(env.Result.GasUsed, "0x"); g != "" {
		r.GasUsed, _ = strconv.ParseUint(g, 16, 64)
	}
	for _, c := range env.Result.Changes {
		kind := map[string]string{"NATIVE": "native", "ERC20": "token", "ERC721": "nft", "ERC1155": "multi", "SPECIAL_NFT": "nft"}[strings.ToUpper(c.AssetType)]
		if kind == "" {
			kind = strings.ToLower(c.AssetType)
		}
		ref := strings.ToLower(c.ContractAddress)
		if kind == "native" {
			ref = "native"
		}
		dec := -1
		if len(c.Decimals) > 0 {
			_ = json.Unmarshal(c.Decimals, &dec)
		}
		ch := risk.AssetChange{AssetRef: ref, Kind: kind, ChangeType: strings.ToLower(c.ChangeType), From: strings.ToLower(c.From),
			To: strings.ToLower(c.To), AmountRaw: c.RawAmount, TokenID: c.TokenID, Symbol: c.Symbol, Decimals: dec}
		if ch.ChangeType == "approve" {
			if c.RawAmount == maxUint256 {
				r.Warnings = append(r.Warnings, "unlimited_approval")
			} else {
				r.Warnings = append(r.Warnings, "approval")
			}
		}
		r.Changes = append(r.Changes, ch)
	}
	return r, nil
}
