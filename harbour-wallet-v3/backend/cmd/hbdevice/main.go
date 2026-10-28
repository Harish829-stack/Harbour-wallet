// Command hbdevice acts like the extension from a terminal: it keeps a device
// key in a local file, registers it, and makes signed API calls.
//
//	hbdevice -api http://localhost:8080 register
//	hbdevice me
//	hbdevice addresses '{"add":[{"chain":"base","address":"0x..."}]}'
//	hbdevice rpc base '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}'
//	hbdevice get /v1/me/portfolio'
package main

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"flag"
	"fmt"
	"os"
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
		fmt.Fprintln(os.Stderr, "usage: hbdevice [-api URL] register | me | addresses JSON | list | get PATH | rpc CHAIN JSON")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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
