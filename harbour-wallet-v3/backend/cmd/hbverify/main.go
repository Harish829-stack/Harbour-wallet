// Command hbverify is the phase 3 live exit check: it compares every balance
// the indexer stored for an address with an independent read from chain at
// the same block (single eth_getBalance / balanceOf calls, not Multicall3).
//
//	go run ./cmd/hbverify -chain ethereum -address 0x... [-wait 5m]
package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"harbour/backend/adapters/chains/evm"
	"harbour/backend/internal/config"
	"harbour/backend/internal/core/chain"
	"harbour/backend/internal/store"
)

func main() {
	envFile := flag.String("env", ".env", "dotenv file")
	chainName := flag.String("chain", "ethereum", "chain slug")
	address := flag.String("address", "", "tracked address")
	wait := flag.Duration("wait", 5*time.Minute, "wait this long for the backfill to finish")
	flag.Parse()
	_ = config.LoadDotEnv(*envFile)
	addr := strings.ToLower(*address)
	if addr == "" {
		die("-address is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), *wait+2*time.Minute)
	defer cancel()
	st, err := store.Open(ctx, os.Getenv("POSTGRES_URL"))
	if err != nil {
		die(err.Error())
	}
	defer st.Close()

	// A dev tool: retry a previously failed backfill right away.
	if _, err := st.Pool.Exec(ctx, `UPDATE tracked_addresses SET backfill_state = 'pending', backfill_error = NULL
		WHERE chain_id = $1 AND address = $2 AND backfill_state = 'failed'`, *chainName, addr); err != nil {
		die(err.Error())
	}
	var id int64
	deadline := time.Now().Add(*wait)
	for {
		id, err = st.TrackedID(ctx, *chainName, addr)
		if err == nil {
			j, err := st.GetTracked(ctx, id)
			if err != nil {
				die(err.Error())
			}
			if j.BackfillState == "failed" {
				var msg *string
				_ = st.Pool.QueryRow(ctx, `SELECT backfill_error FROM tracked_addresses WHERE id=$1`, id).Scan(&msg)
				if msg != nil {
					die("backfill failed: " + *msg)
				}
				die("backfill failed")
			}
			if j.BackfillState != "pending" && j.BackfillState != "running" {
				fmt.Printf("backfill %s (synced to block %d)\n", j.BackfillState, deref(j.SyncedTo))
				break
			}
		}
		if time.Now().After(deadline) {
			die("timed out waiting for the backfill (is the indexer running? ./run.sh logs)")
		}
		time.Sleep(2 * time.Second)
	}
	// Re-read balances first so the comparison is against a fresh block.
	bals, err := st.Balances(ctx, id)
	if err != nil {
		die(err.Error())
	}
	if len(bals) == 0 {
		die("no balances stored")
	}
	c, err := evm.New(chain.ClientConfig{Chain: *chainName, RPCURL: config.Env("RPC_GATEWAY_URL", "http://localhost:8081"),
		RPCToken: os.Getenv("GATEWAY_INTERNAL_TOKEN")})
	if err != nil {
		die(err.Error())
	}
	ec := c.(*evm.Client)
	bad := 0
	fmt.Printf("%-44s %-10s %32s %32s\n", "asset", "symbol", "stored", "chain (same block)")
	for _, b := range bals {
		if b.Kind != "native" && b.Kind != "token" {
			continue
		}
		block := "0x" + strconv.FormatInt(b.AsOfBlock, 16)
		var raw json.RawMessage
		if b.AssetRef == "native" {
			raw, err = ec.Call(ctx, "eth_getBalance", addr, block)
		} else {
			data := "0x70a08231" + strings.Repeat("0", 24) + strings.TrimPrefix(addr, "0x")
			raw, err = ec.Call(ctx, "eth_call", map[string]string{"to": b.AssetRef, "data": data}, block)
		}
		chainVal := "error"
		if err == nil {
			var s string
			_ = json.Unmarshal(raw, &s)
			h := strings.TrimPrefix(s, "0x")
			if len(h) > 64 {
				h = h[:64]
			}
			if _, derr := hex.DecodeString(strings.Repeat("0", len(h)%2) + h); derr == nil {
				v, _ := new(big.Int).SetString("0"+h, 16)
				chainVal = v.String()
			}
		}
		sym := "-"
		if b.Symbol != nil {
			sym = *b.Symbol
			if len(sym) > 10 {
				sym = sym[:10]
			}
		}
		mark := "ok"
		if chainVal != b.AmountRaw {
			mark = "MISMATCH"
			bad++
		}
		if b.SpamScore >= 50 {
			mark += " (spam)"
		}
		fmt.Printf("%-44s %-10s %32s %32s  %s\n", b.AssetRef, sym, b.AmountRaw, chainVal, mark)
	}
	if bad > 0 {
		die(fmt.Sprintf("%d balance(s) differ from chain", bad))
	}
	fmt.Println("PASS: every stored balance equals the chain at its block")
}

func deref(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

func die(msg string) {
	fmt.Fprintln(os.Stderr, "FAIL:", msg)
	os.Exit(1)
}
