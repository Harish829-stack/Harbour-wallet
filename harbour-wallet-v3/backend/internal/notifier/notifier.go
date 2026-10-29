// Package notifier turns indexer and tx-tracker events into push
// notifications: incoming transfers to a device's tracked addresses, and
// confirmation of transactions the device broadcast.
package notifier

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"harbour/backend/internal/core/notify"
	"harbour/backend/internal/events"
	"harbour/backend/internal/store"
)

// Notifier consumes events and delivers pushes.
type Notifier struct {
	St       *store.Store
	LC       *store.LinkCrypto
	Redis    *redis.Client
	Bus      events.Bus
	Channels map[string]notify.Channel
	Log      *slog.Logger
	// Dedupe is how long a (device, tx) push is remembered.
	Dedupe time.Duration
}

type activity struct {
	TrackedAddressID int64     `json:"tracked_address_id"`
	Chain            string    `json:"chain"`
	TxHash           string    `json:"tx_hash"`
	Asset            string    `json:"asset"`
	Kind             string    `json:"kind"`
	AmountRaw        string    `json:"amount_raw"`
	Symbol           string    `json:"symbol"`
	Decimals         *int      `json:"decimals"`
	SpamScore        int       `json:"spam_score"`
	BlockTime        time.Time `json:"block_time"`
}

type txStatus struct {
	Chain  string `json:"chain"`
	TxHash string `json:"tx_hash"`
	Status string `json:"status"`
}

// Run consumes until ctx ends.
func (n *Notifier) Run(ctx context.Context) error {
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	run := func(durable, subject string, h func(context.Context, []byte) error) {
		defer wg.Done()
		if err := n.Bus.Consume(ctx, durable, subject, h); err != nil {
			errs <- err
		}
	}
	wg.Add(2)
	go run("notifier-activity", events.SubjectActivityNew+".>", n.HandleActivity)
	go run("notifier-tx", events.SubjectTxStatus+".>", n.HandleTx)
	wg.Wait()
	close(errs)
	return <-errs
}

// HandleActivity notifies every device routed to the receiving address.
func (n *Notifier) HandleActivity(ctx context.Context, data []byte) error {
	var a activity
	if err := json.Unmarshal(data, &a); err != nil || a.TxHash == "" {
		return nil
	}
	if a.SpamScore >= 50 || time.Since(a.BlockTime) > time.Hour {
		return nil
	}
	subs, err := n.St.PushSubsForRoute(ctx, n.LC.RouteTag(a.TrackedAddressID))
	if err != nil || len(subs) == 0 {
		return err
	}
	title, body := "You received an NFT", "On "+chainLabel(a.Chain)
	switch a.Kind {
	case "nft", "multi":
	case "native", "internal":
		// The chain's own coin: amount and symbol come from chain config, not from the sender.
		title = "Received " + displayAmount(a.AmountRaw, a.Decimals) + " " + safeSymbol(a.Symbol, "coins")
	default:
		// Anyone can deploy a token called "USDC" and airdrop it: only verified tokens get amount and symbol in the
		// title, and the stored spam score (contract checks, provider flags) decides, not the per-event guess.
		t, err := n.St.AssetTrust(ctx, a.Chain, a.Asset)
		if err != nil && !errors.Is(err, store.ErrNotFound) {
			return err
		}
		if t.SpamScore >= 50 {
			return nil
		}
		if t.Verified {
			title = "Received " + displayAmount(a.AmountRaw, a.Decimals) + " " + safeSymbol(a.Symbol, "tokens")
		} else {
			title, body = "You received a token", "Unverified token · On "+chainLabel(a.Chain)
		}
	}
	msg := notify.Message{Title: title, Body: body,
		Data: map[string]string{"type": "incoming", "chain": a.Chain, "tx_hash": a.TxHash}}
	n.deliverAll(ctx, subs, "in:"+a.Chain+":"+a.TxHash, msg)
	return nil
}

// deliverAll sends to every subscription concurrently with a bounded fan-out. A failing or slow endpoint is logged and
// left to its own dedupe key; it never fails (and so redelivers) the event for every other device.
func (n *Notifier) deliverAll(ctx context.Context, subs []store.PushSub, key string, msg notify.Message) {
	sem := make(chan struct{}, 16)
	var wg sync.WaitGroup
	for _, s := range subs {
		wg.Add(1)
		sem <- struct{}{}
		go func(s store.PushSub) {
			defer wg.Done()
			defer func() { <-sem }()
			if err := n.deliver(ctx, s, key, msg); err != nil {
				n.Log.Warn("push delivery failed", "err", err)
			}
		}(s)
	}
	wg.Wait()
}

// safeSymbol keeps a short, plain symbol (letters, digits, . _ -) for notification text.
func safeSymbol(sym, fallback string) string {
	var b strings.Builder
	for _, r := range sym {
		if r < 128 && (r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '_' || r == '-') {
			b.WriteRune(r)
		}
		if b.Len() >= 12 {
			break
		}
	}
	if b.Len() == 0 {
		return fallback
	}
	return b.String()
}

// HandleTx notifies the device that broadcast a transaction once it settles.
func (n *Notifier) HandleTx(ctx context.Context, data []byte) error {
	var t txStatus
	if err := json.Unmarshal(data, &t); err != nil || t.TxHash == "" {
		return nil
	}
	var title string
	switch t.Status {
	case "confirmed":
		title = "Transaction confirmed"
	case "failed":
		title = "Transaction failed"
	default:
		return nil
	}
	dev, err := n.St.PendingDevice(ctx, t.Chain, t.TxHash)
	if err != nil || dev == "" {
		return err
	}
	sub, err := n.St.PushSubForDevice(ctx, dev)
	if errors.Is(err, store.ErrNotFound) {
		return nil
	} else if err != nil {
		return err
	}
	return n.deliver(ctx, sub, "tx:"+t.Chain+":"+t.TxHash, notify.Message{Title: title, Body: "On " + chainLabel(t.Chain),
		Data: map[string]string{"type": "tx", "chain": t.Chain, "tx_hash": t.TxHash, "status": t.Status}})
}

func (n *Notifier) deliver(ctx context.Context, s store.PushSub, key string, m notify.Message) error {
	ch, ok := n.Channels[s.Channel]
	if !ok {
		return nil
	}
	ttl := n.Dedupe
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	rk := "hb:push:" + s.DeviceID + ":" + key
	first, err := n.Redis.SetNX(ctx, rk, 1, ttl).Result()
	if err != nil || !first {
		return err
	}
	tok, _ := json.Marshal(map[string]any{"endpoint": s.Endpoint, "keys": map[string]string{"p256dh": s.P256dh, "auth": s.Auth}})
	m.DedupKey = key
	err = ch.Send(ctx, notify.Target{Channel: s.Channel, Token: string(tok)}, m)
	var gone notify.ErrGone
	if errors.As(err, &gone) {
		n.Log.Info("push subscription gone; removing")
		return n.St.DeletePushSub(ctx, s.DeviceID)
	}
	if err != nil {
		n.Redis.Del(context.WithoutCancel(ctx), rk) // allow the redelivery to try again
		return err
	}
	return nil
}

// displayAmount shows up to 6 decimals.
func displayAmount(raw string, dec *int) string {
	v, ok := new(big.Int).SetString(raw, 10)
	if !ok {
		return ""
	}
	if dec == nil || *dec == 0 {
		return v.String()
	}
	s := v.String()
	for len(s) <= *dec {
		s = "0" + s
	}
	whole, frac := s[:len(s)-*dec], s[len(s)-*dec:]
	if len(frac) > 6 {
		frac = frac[:6]
	}
	frac = strings.TrimRight(frac, "0")
	if frac == "" {
		if whole == "0" && v.Sign() > 0 {
			return "<0.000001"
		}
		return whole
	}
	return whole + "." + frac
}

func chainLabel(c string) string {
	parts := strings.Split(c, "-")
	for i, p := range parts {
		if p != "" {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		}
	}
	return strings.Join(parts, " ")
}
