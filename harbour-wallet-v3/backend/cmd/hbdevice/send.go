package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"

	"github.com/coder/websocket"

	"harbour/backend/internal/evmtx/devsign"
	"harbour/backend/internal/hbclient"
)

// printAddr prints the address of HB_DEV_PRIVATE_KEY.
func printAddr() error {
	key, err := devsign.ParseKey(os.Getenv("HB_DEV_PRIVATE_KEY"))
	if err != nil {
		return err
	}
	fmt.Println(devsign.Address(key))
	return nil
}

// send signs locally (like the extension) and relays through the API.
// Testnets only: the key comes from HB_DEV_PRIVATE_KEY and never leaves this process.
func send(ctx context.Context, c *hbclient.Client, chain, to, wei string) (any, error) {
	if !strings.Contains(chain, "sepolia") && !strings.Contains(chain, "testnet") {
		return nil, errors.New("send is for testnets only")
	}
	key, err := devsign.ParseKey(os.Getenv("HB_DEV_PRIVATE_KEY"))
	if err != nil {
		return nil, fmt.Errorf("set HB_DEV_PRIVATE_KEY to a funded testnet key: %w", err)
	}
	value, ok := new(big.Int).SetString(wei, 10)
	if !ok {
		return nil, errors.New("amount must be in wei (a whole number)")
	}
	from := devsign.Address(key)
	sb := make([]byte, 8)
	rand.Read(sb)
	hdr := http.Header{"X-Hb-Session": {"send-" + hex.EncodeToString(sb)}}
	var est struct {
		ChainID  uint64 `json:"chain_id"`
		Nonce    string `json:"nonce"`
		GasLimit string `json:"gas_limit"`
		Fees     struct {
			Type   string            `json:"type"`
			Normal map[string]string `json:"normal"`
		} `json:"fees"`
	}
	if _, err := c.Do(ctx, "POST", "/v1/tx/"+chain+"/estimate", map[string]string{"from": from, "to": to, "value": value.String()}, &est, hdr); err != nil {
		return nil, err
	}
	if est.Fees.Type != "eip1559" {
		return nil, errors.New("this tool only sends EIP-1559 transactions")
	}
	big10 := func(s string) *big.Int { n, _ := new(big.Int).SetString(s, 10); return n }
	nonce, gas := big10(est.Nonce), big10(est.GasLimit)
	raw, err := devsign.Sign(key, devsign.Tx{ChainID: est.ChainID, Nonce: nonce.Uint64(), TipCap: big10(est.Fees.Normal["max_priority_fee"]),
		FeeCap: big10(est.Fees.Normal["max_fee"]), Gas: gas.Uint64(), To: to, Value: value})
	if err != nil {
		return nil, err
	}
	hdr.Set("Idempotency-Key", "send-"+hex.EncodeToString(raw[len(raw)-8:]))
	var out map[string]any
	_, err = c.Do(ctx, "POST", "/v1/tx/"+chain+"/broadcast", map[string]string{"raw": "0x" + hex.EncodeToString(raw)}, &out, hdr)
	if out != nil {
		delete(out, "channel_token")
		out["from"] = from
	}
	return out, err
}

// watch connects to Centrifugo with the API's tokens and prints pushes.
func watch(ctx context.Context, c *hbclient.Client) error {
	var tok struct {
		URL           string `json:"url"`
		Token         string `json:"token"`
		Subscriptions []struct {
			Channel string `json:"channel"`
			Token   string `json:"token"`
		} `json:"subscriptions"`
	}
	if _, err := c.Do(ctx, "POST", "/v1/realtime/token", map[string]string{}, &tok, nil); err != nil {
		return err
	}
	ws, _, err := websocket.Dial(ctx, tok.URL, nil)
	if err != nil {
		return fmt.Errorf("realtime connect: %w", err)
	}
	defer ws.CloseNow()
	write := func(v any) error { b, _ := json.Marshal(v); return ws.Write(ctx, websocket.MessageText, b) }
	if err := write(map[string]any{"id": 1, "connect": map[string]any{"token": tok.Token, "name": "hbdevice"}}); err != nil {
		return err
	}
	for i, s := range tok.Subscriptions {
		if err := write(map[string]any{"id": i + 2, "subscribe": map[string]any{"channel": s.Channel, "token": s.Token}}); err != nil {
			return err
		}
	}
	fmt.Fprintf(os.Stderr, "watching %d channels (Ctrl-C to stop)\n", len(tok.Subscriptions))
	for {
		_, data, err := ws.Read(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return err
		}
		for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
			if line == "{}" { // server ping: answer with pong
				_ = ws.Write(ctx, websocket.MessageText, []byte("{}"))
				continue
			}
			var m struct {
				ID    int             `json:"id"`
				Error json.RawMessage `json:"error"`
				Push  *struct {
					Channel string `json:"channel"`
					Pub     *struct {
						Data json.RawMessage `json:"data"`
					} `json:"pub"`
				} `json:"push"`
			}
			if json.Unmarshal([]byte(line), &m) != nil {
				continue
			}
			switch {
			case len(m.Error) > 0:
				fmt.Fprintf(os.Stderr, "realtime error (request %d): %s\n", m.ID, m.Error)
			case m.Push != nil && m.Push.Pub != nil:
				fmt.Printf("%s %s\n", m.Push.Channel, m.Push.Pub.Data)
			}
		}
	}
}
