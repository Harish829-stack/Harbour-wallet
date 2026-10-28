// Command hbkeys generates keys for .env. Usage: hbkeys vapid
package main

import (
	"fmt"
	"os"

	"harbour/backend/adapters/notify/webpush"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "vapid" {
		fmt.Fprintln(os.Stderr, "usage: hbkeys vapid")
		os.Exit(2)
	}
	priv, pub, err := webpush.GenerateKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("VAPID_PRIVATE_KEY=%s\nVAPID_PUBLIC_KEY=%s\n", priv, pub)
}
