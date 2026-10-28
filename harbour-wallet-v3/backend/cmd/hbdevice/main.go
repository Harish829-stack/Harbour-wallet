// Command hbdevice acts like the extension from a terminal: it keeps a device
// key in a local file, registers it, and makes signed API calls.
//
//	hbdevice -api http://localhost:8080 register
//	hbdevice me
//	hbdevice addresses '{"add":[{"chain":"base","address":"0x..."}]}'
//	hbdevice rpc base '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}'
//	hbdevice get /v1/me/portfolio
//	HB_DEV_PRIVATE_KEY=0x... hbdevice send base-sepolia 0xTO 1000000000000   (testnets only)
//	hbdevice watch 120                                                        (live updates for 120s)
package main

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strconv"
	"time"

	"harbour/backend/internal/devicesig"
	"harbour/backend/internal/hbclient"
)

type keyFile struct {
	API      string `json:"api"`
	DeviceID string `json:"device_id"`
	Seed     string `json:"seed"` // base64url Ed25519 seed; local dev only
}

func main() {
	api := flag.String("api", "http://localhost:8080", "API base URL")
	file := flag.String("key", ".hbdevice.json", "device key file (dev only; the extension keeps a non-extractable key)")
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: hbdevice [-api URL] register | me | addresses JSON | list | get PATH | rpc CHAIN JSON | addr | send CHAIN TO WEI | watch [SECONDS]")
		os.Exit(2)
	}
	if args[0] == "addr" {
		check(printAddr())
		return
	}
	timeout := 2 * time.Minute
	if args[0] == "watch" {
		timeout = 30 * time.Second
		if len(args) > 1 {
			if n, err := strconv.Atoi(args[1]); err == nil && n > 0 {
				timeout = time.Duration(n) * time.Second
			}
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	c := hbclient.New(*api)
	if args[0] != "register" {
		b, err := os.ReadFile(*file)
		check(err)
		var kf keyFile
		check(json.Unmarshal(b, &kf))
		seed, err := devicesig.UnB64(kf.Seed)
		check(err)
		c = hbclient.New(kf.API)
		c.Priv = ed25519.NewKeyFromSeed(seed)
		c.DeviceID = kf.DeviceID
	}
	var out any
	var err error
	switch args[0] {
	case "register":
		start := time.Now()
		out, err = c.Register(ctx)
		check(err)
		b, _ := json.MarshalIndent(keyFile{API: *api, DeviceID: c.DeviceID, Seed: devicesig.B64(c.Priv.Seed())}, "", "  ")
		check(os.WriteFile(*file, b, 0o600))
		fmt.Fprintf(os.Stderr, "registered in %s; key saved to %s\n", time.Since(start).Round(time.Millisecond), *file)
	case "me":
		_, err = c.Do(ctx, "GET", "/v1/me", nil, &out, nil)
	case "list":
		_, err = c.Do(ctx, "GET", "/v1/me/addresses", nil, &out, nil)
	case "addresses":
		need(args, 2)
		_, err = c.Do(ctx, "PUT", "/v1/me/addresses", []byte(args[1]), &out, nil)
	case "get":
		need(args, 2)
		_, err = c.Do(ctx, "GET", args[1], nil, &out, nil)
	case "rpc":
		need(args, 3)
		_, err = c.Do(ctx, "POST", "/v1/rpc/"+args[1], []byte(args[2]), &out, nil)
	case "send":
		need(args, 4)
		out, err = send(ctx, c, args[1], args[2], args[3])
	case "watch":
		check(watch(ctx, c))
		return
	default:
		err = fmt.Errorf("unknown command %q", args[0])
	}
	check(err)
	b, _ := json.MarshalIndent(out, "", "  ")
	fmt.Println(string(b))
}

func need(a []string, n int) {
	if len(a) < n {
		fmt.Fprintln(os.Stderr, "missing arguments")
		os.Exit(2)
	}
}

func check(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
