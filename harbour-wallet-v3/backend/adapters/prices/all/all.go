// Package all links every price source adapter into a binary (cmd/ only).
package all

import (
	_ "harbour/backend/adapters/prices/alchemy"
	_ "harbour/backend/adapters/prices/coingecko"
)
