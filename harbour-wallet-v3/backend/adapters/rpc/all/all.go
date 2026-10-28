// Package all links every RPC adapter into a binary. Import it for side
// effects from cmd/ only.
package all

import (
	_ "harbour/backend/adapters/rpc/alchemy"
	_ "harbour/backend/adapters/rpc/infura"
	_ "harbour/backend/adapters/rpc/url"
)
