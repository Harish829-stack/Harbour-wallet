// Package config loads chains.yaml, providers.yaml and api.yaml and resolves
// secrets from the environment. Provider keys never appear in these files.
package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/goccy/go-yaml"

	"harbour/backend/internal/core/rpc"
)

// Chain is one entry of chains.yaml.
type Chain struct {
	Family       string                       `yaml:"family"`
	EVMChainID   uint64                       `yaml:"evm_chain_id"`
	Testnet      bool                         `yaml:"testnet"`
	BlockTime    time.Duration                `yaml:"block_time"`
	LogsMaxRange uint64                       `yaml:"logs_max_range"`
	Finality     Finality                     `yaml:"finality"`
	Native       Native                       `yaml:"native"`
	Upstreams    []UpstreamRef                `yaml:"upstreams"`
	Sources      map[string]map[string]string `yaml:"sources"` // source name -> per-chain options
	Prices       map[string]map[string]string `yaml:"prices"`  // price source name -> per-chain options
	Risk         map[string]map[string]string `yaml:"risk"`    // simulator name -> per-chain options
	Extra        map[string]any               `yaml:"extra"`
}

// Finality config for one chain.
type Finality struct {
	Policy  string         `yaml:"policy"`
	Options map[string]any `yaml:"options"`
}

// Native coin of a chain.
type Native struct {
	Symbol   string            `yaml:"symbol"`
	Decimals int               `yaml:"decimals"`
	PriceIDs map[string]string `yaml:"price_ids"`
}

// UpstreamRef points at one provider key, in priority order.
type UpstreamRef struct {
	Provider string  `yaml:"provider"`
	Key      string  `yaml:"key"`
	Network  string  `yaml:"network"`
	Weight   float64 `yaml:"weight"`
}

// Provider is one entry of providers.yaml.
type Provider struct {
	Adapter     string        `yaml:"adapter"`
	URLTemplate string        `yaml:"url_template"`
	Timeout     time.Duration `yaml:"timeout"`
	Keys        []Key         `yaml:"keys"`
}

// Key is one provider key (one rate budget).
type Key struct {
	ID        string            `yaml:"id"`
	KeyEnv    string            `yaml:"key_env"`
	SecretEnv string            `yaml:"secret_env"`
	URLEnv    map[string]string `yaml:"url_env"` // chain -> env var holding a full URL
	RPS       float64           `yaml:"rps"`
}

// SourceDef is one indexer source in providers.yaml "sources:".
type SourceDef struct {
	Adapter string            `yaml:"adapter"`
	Options map[string]string `yaml:"options"`
}

// PriceSourceDef is one price source in providers.yaml "price_sources:" (priority order).
type PriceSourceDef struct {
	Name    string            `yaml:"name"`
	Adapter string            `yaml:"adapter"`
	Options map[string]string `yaml:"options"`
}

// Prices tuning (providers.yaml "prices:").
type Prices struct {
	TopEvery        time.Duration `yaml:"top_every"`
	TopN            int           `yaml:"top_n"`
	TailEvery       time.Duration `yaml:"tail_every"`
	MinLiquidityUSD float64       `yaml:"min_liquidity_usd"`
	CacheTTL        time.Duration `yaml:"cache_ttl"`
}

// RiskDef is the transaction simulator (providers.yaml "risk:").
type RiskDef struct {
	Adapter string            `yaml:"adapter"`
	Options map[string]string `yaml:"options"`
}

// Indexer tuning (providers.yaml "indexer:").
type Indexer struct {
	BackfillMaxAge       time.Duration `yaml:"backfill_max_age"`
	BackfillMaxTransfers int           `yaml:"backfill_max_transfers"`
	OlderPageTransfers   int           `yaml:"older_page_transfers"`
	RefreshDebounce      time.Duration `yaml:"refresh_debounce"`
	IdleSweepAfter       time.Duration `yaml:"idle_sweep_after"`
	NFTMaxPages          int           `yaml:"nft_max_pages"`
	Workers              int           `yaml:"workers"`
}

// Gateway tuning (providers.yaml "gateway:").
type Gateway struct {
	CacheMaxEntries   int           `yaml:"cache_max_entries"`
	WindowSize        int           `yaml:"window_size"`
	WindowAge         time.Duration `yaml:"window_age"`
	BreakerErrorRate  float64       `yaml:"breaker_error_rate"`
	BreakerMinSamples int           `yaml:"breaker_min_samples"`
	BreakerCooldown   time.Duration `yaml:"breaker_cooldown"`
	BreakerProbes     int           `yaml:"breaker_probes"`
	HedgeMin          time.Duration `yaml:"hedge_min"`
	HedgeMax          time.Duration `yaml:"hedge_max"`
	MaxAttempts       int           `yaml:"max_attempts"`
	BudgetWait        time.Duration `yaml:"budget_wait"`
	StickyTTL         time.Duration `yaml:"sticky_ttl"`
	MaxBatch          int           `yaml:"max_batch"`
	BroadcastFanout   int           `yaml:"broadcast_fanout"`
	HeadPollMin       time.Duration `yaml:"head_poll_min"`
}

// Tier is one quota tier (api.yaml).
type Tier struct {
	MaxAddresses      int `yaml:"max_addresses"`
	BackfillsPerDay   int `yaml:"backfills_per_day"`
	RequestsPerMinute int `yaml:"requests_per_minute"`
	RPCPerMinute      int `yaml:"rpc_per_minute"`
}

// API is api.yaml.
type API struct {
	PowDifficulty     int             `yaml:"pow_difficulty"`
	PowTTL            time.Duration   `yaml:"pow_ttl"`
	ChallengesPerHour int             `yaml:"challenges_per_ip_per_hour"`
	ClockSkew         time.Duration   `yaml:"clock_skew"`
	DefaultTier       string          `yaml:"default_tier"`
	Tiers             map[string]Tier `yaml:"tiers"`
	RPCAllowedMethods []string        `yaml:"rpc_allowed_methods"`
	BackfillDenyList  []string        `yaml:"backfill_deny_list"`
	IdempotencyTTL    time.Duration   `yaml:"idempotency_ttl"`
}

// Config is all static configuration.
type Config struct {
	Chains       map[string]Chain     `yaml:"chains"`
	Providers    map[string]Provider  `yaml:"providers"`
	Gateway      Gateway              `yaml:"gateway"`
	Sources      map[string]SourceDef `yaml:"sources"`
	Indexer      Indexer              `yaml:"indexer"`
	PriceSources []PriceSourceDef     `yaml:"price_sources"`
	Risk         RiskDef              `yaml:"risk"`
	// NotifyChannels are push delivery channels by name (push_subscriptions.channel).
	NotifyChannels map[string]SourceDef `yaml:"notify_channels"`
	Prices         Prices               `yaml:"prices"`
	API            API                  `yaml:"api"`
}

// Load reads chains.yaml, providers.yaml and api.yaml from dir.
func Load(dir string) (*Config, error) {
	c := &Config{}
	for _, f := range []string{"chains.yaml", "providers.yaml", "api.yaml"} {
		b, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			return nil, fmt.Errorf("config: %w", err)
		}
		if err := yaml.Unmarshal(b, c); err != nil {
			return nil, fmt.Errorf("config %s: %w", f, err)
		}
	}
	if err := c.restrictChains(os.Getenv("ENABLED_CHAINS")); err != nil {
		return nil, err
	}
	c.defaults()
	return c, c.validate()
}

// restrictChains keeps only the listed chains (comma-separated chains.yaml names). Empty keeps all. Every service
// (gateway pools, indexer, API) then behaves as if the others weren't configured.
func (c *Config) restrictChains(list string) error {
	if strings.TrimSpace(list) == "" {
		return nil
	}
	keep := map[string]bool{}
	for _, n := range strings.Split(list, ",") {
		n = strings.TrimSpace(n)
		if n == "" {
			continue
		}
		if _, ok := c.Chains[n]; !ok {
			return fmt.Errorf("config: ENABLED_CHAINS names unknown chain %q", n)
		}
		keep[n] = true
	}
	for n := range c.Chains {
		if !keep[n] {
			delete(c.Chains, n)
		}
	}
	return nil
}

// ApplyDefaults fills unset values (Load calls it; tests building a Config by hand do too).
func (c *Config) ApplyDefaults() { c.defaults() }

func (c *Config) defaults() {
	g := &c.Gateway
	def := func(p *int, v int) {
		if *p == 0 {
			*p = v
		}
	}
	defD := func(p *time.Duration, v time.Duration) {
		if *p == 0 {
			*p = v
		}
	}
	def(&g.CacheMaxEntries, 100_000)
	def(&g.WindowSize, 200)
	defD(&g.WindowAge, time.Minute)
	if g.BreakerErrorRate == 0 {
		g.BreakerErrorRate = 0.5
	}
	def(&g.BreakerMinSamples, 10)
	defD(&g.BreakerCooldown, 30*time.Second)
	def(&g.BreakerProbes, 3)
	defD(&g.HedgeMin, 50*time.Millisecond)
	defD(&g.HedgeMax, 2*time.Second)
	def(&g.MaxAttempts, 4)
	defD(&g.BudgetWait, 250*time.Millisecond)
	defD(&g.StickyTTL, time.Minute)
	def(&g.MaxBatch, 100)
	def(&g.BroadcastFanout, 2)
	defD(&g.HeadPollMin, 4*time.Second)
	pr := &c.Prices
	defD(&pr.TopEvery, time.Minute)
	def(&pr.TopN, 2000)
	defD(&pr.TailEvery, 5*time.Minute)
	if pr.MinLiquidityUSD == 0 {
		pr.MinLiquidityUSD = 10_000
	}
	defD(&pr.CacheTTL, 15*time.Minute)
	ix := &c.Indexer
	defD(&ix.BackfillMaxAge, 90*24*time.Hour)
	def(&ix.BackfillMaxTransfers, 5000)
	def(&ix.OlderPageTransfers, 1000)
	defD(&ix.RefreshDebounce, 2*time.Second)
	defD(&ix.IdleSweepAfter, 24*time.Hour)
	def(&ix.NFTMaxPages, 10)
	def(&ix.Workers, 4)
	a := &c.API
	def(&a.PowDifficulty, 20)
	defD(&a.PowTTL, 5*time.Minute)
	def(&a.ChallengesPerHour, 30)
	defD(&a.ClockSkew, 5*time.Minute)
	defD(&a.IdempotencyTTL, 24*time.Hour)
	if a.DefaultTier == "" {
		a.DefaultTier = "default"
	}
	for name, ch := range c.Chains {
		if ch.BlockTime == 0 {
			ch.BlockTime = 2 * time.Second
		}
		if ch.LogsMaxRange == 0 {
			ch.LogsMaxRange = 2000
		}
		c.Chains[name] = ch
	}
	for name, p := range c.Providers {
		if p.Timeout == 0 {
			p.Timeout = 10 * time.Second
		}
		c.Providers[name] = p
	}
}

func (c *Config) validate() error {
	if len(c.Chains) == 0 {
		return fmt.Errorf("config: no chains")
	}
	if _, ok := c.API.Tiers[c.API.DefaultTier]; !ok {
		return fmt.Errorf("config: default tier %q not defined", c.API.DefaultTier)
	}
	for name, ch := range c.Chains {
		if ch.Family == "" {
			return fmt.Errorf("config: chain %s has no family", name)
		}
		for src := range ch.Prices {
			found := false
			for _, ps := range c.PriceSources {
				found = found || ps.Name == src
			}
			if !found {
				return fmt.Errorf("config: chain %s uses unknown price source %q", name, src)
			}
		}
		for src := range ch.Sources {
			if _, ok := c.Sources[src]; !ok {
				return fmt.Errorf("config: chain %s uses unknown source %q", name, src)
			}
		}
		for _, u := range ch.Upstreams {
			p, ok := c.Providers[u.Provider]
			if !ok {
				return fmt.Errorf("config: chain %s uses unknown provider %q", name, u.Provider)
			}
			if p.key(u.Key) == nil {
				return fmt.Errorf("config: chain %s uses unknown key %q of provider %s", name, u.Key, u.Provider)
			}
		}
	}
	return nil
}

func (p Provider) key(id string) *Key {
	for i := range p.Keys {
		if p.Keys[i].ID == id {
			return &p.Keys[i]
		}
	}
	return nil
}

// ChainNames returns configured chain slugs, sorted.
func (c *Config) ChainNames() []string {
	out := make([]string, 0, len(c.Chains))
	for k := range c.Chains {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ResolvedUpstream is an upstream ready for its adapter factory.
type ResolvedUpstream struct {
	Adapter string
	Config  rpc.UpstreamConfig
	Weight  float64
	RPS     float64
}

// Upstreams resolves a chain's upstream list against the environment.
// Entries whose key env var is empty are skipped and reported.
func (c *Config) Upstreams(chainName string, getenv func(string) string) ([]ResolvedUpstream, []string) {
	ch := c.Chains[chainName]
	var out []ResolvedUpstream
	var skipped []string
	n := len(ch.Upstreams)
	for i, u := range ch.Upstreams {
		p := c.Providers[u.Provider]
		k := p.key(u.Key)
		uc := rpc.UpstreamConfig{
			ID: chainName + "/" + u.Key, Provider: u.Provider, Chain: chainName,
			Network: u.Network, URLTemplate: p.URLTemplate, Timeout: p.Timeout,
		}
		if k.KeyEnv != "" {
			uc.Key = strings.TrimSpace(getenv(k.KeyEnv))
		}
		if k.SecretEnv != "" {
			uc.Secret = strings.TrimSpace(getenv(k.SecretEnv))
		}
		if env := k.URLEnv[chainName]; env != "" {
			uc.URL = strings.TrimSpace(getenv(env))
		}
		if uc.Key == "" && uc.URL == "" {
			skipped = append(skipped, uc.ID)
			continue
		}
		w := u.Weight
		if w == 0 {
			w = float64(n - i) // priority order
		}
		out = append(out, ResolvedUpstream{Adapter: p.Adapter, Config: uc, Weight: w, RPS: k.RPS})
	}
	return out, skipped
}

// LoadDotEnv sets variables from a .env file that are not already set.
// Supports KEY=value, quotes, and trailing " # comments". Missing file is fine.
func LoadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(strings.TrimPrefix(k, "export "))
		v = strings.TrimSpace(v)
		if len(v) > 0 && (v[0] == '"' || v[0] == '\'') {
			if end := strings.IndexByte(v[1:], v[0]); end >= 0 {
				v = v[1 : end+1]
			}
		} else if i := strings.Index(v, " #"); i >= 0 {
			v = strings.TrimSpace(v[:i])
		} else if i := strings.Index(v, "\t#"); i >= 0 {
			v = strings.TrimSpace(v[:i])
		}
		if _, set := os.LookupEnv(k); !set {
			os.Setenv(k, v)
		}
	}
	return sc.Err()
}

// Env returns os.Getenv(k) or def.
func Env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
