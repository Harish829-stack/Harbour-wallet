package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"harbour/backend/internal/events"
)

// Bridge relays internal events to Centrifugo channels. It is the only
// service that pushes to clients.
type Bridge struct {
	Bus    events.Bus
	APIURL string // e.g. http://centrifugo:8000/api (a trailing /api is optional)
	APIKey string
	Log    *slog.Logger
	HTTP   *http.Client
}

type balanceEvent struct {
	Chain     string            `json:"chain"`
	Address   string            `json:"address"`
	AsOfBlock uint64            `json:"as_of_block"`
	Balances  []json.RawMessage `json:"balances"`
}

type txEvent struct {
	Chain       string `json:"chain"`
	TxHash      string `json:"tx_hash"`
	Status      string `json:"status"`
	BlockNumber uint64 `json:"block_number,omitempty"`
}

// Run consumes until ctx ends.
func (b *Bridge) Run(ctx context.Context) error {
	if b.HTTP == nil {
		b.HTTP = &http.Client{Timeout: 10 * time.Second}
	}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	run := func(durable, subject string, h func(context.Context, []byte) error) {
		defer wg.Done()
		if err := b.Bus.Consume(ctx, durable, subject, h); err != nil {
			errs <- err
		}
	}
	wg.Add(2)
	go run("realtime-balances", events.SubjectBalance+".>", b.HandleBalance)
	go run("realtime-tx", "tx.status.>", b.HandleTx)
	wg.Wait()
	close(errs)
	return <-errs
}

// HandleBalance publishes a balance change (no internal ids leave the backend).
func (b *Bridge) HandleBalance(ctx context.Context, data []byte) error {
	var e balanceEvent
	if err := json.Unmarshal(data, &e); err != nil || e.Chain == "" || e.Address == "" {
		return nil // malformed: drop
	}
	return b.Publish(ctx, BalanceChannel(e.Chain, e.Address), map[string]any{"type": "balance", "chain": e.Chain,
		"address": strings.ToLower(e.Address), "as_of_block": e.AsOfBlock, "balances": e.Balances})
}

// HandleTx publishes a transaction status change.
func (b *Bridge) HandleTx(ctx context.Context, data []byte) error {
	var e txEvent
	if err := json.Unmarshal(data, &e); err != nil || e.Chain == "" || e.TxHash == "" {
		return nil
	}
	return b.Publish(ctx, TxChannel(e.Chain, e.TxHash), map[string]any{"type": "tx", "chain": e.Chain,
		"tx_hash": strings.ToLower(e.TxHash), "status": e.Status, "block_number": e.BlockNumber})
}

// Publish sends one message through Centrifugo's server API.
func (b *Bridge) Publish(ctx context.Context, channel string, data any) error {
	body, _ := json.Marshal(map[string]any{"channel": channel, "data": data})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSuffix(strings.TrimRight(b.APIURL, "/"), "/api")+"/api/publish", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", b.APIKey)
	hc := b.HTTP
	if hc == nil {
		hc = http.DefaultClient
	}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("centrifugo: http %d", resp.StatusCode)
	}
	var r struct {
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(rb, &r) == nil && r.Error != nil {
		return fmt.Errorf("centrifugo: %d %s", r.Error.Code, r.Error.Message)
	}
	return nil
}
