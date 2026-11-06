// Package all registers every notify channel adapter.
package all

import (
	_ "harbour/backend/adapters/notify/webpush" // Web Push (VAPID + aes128gcm)
)
