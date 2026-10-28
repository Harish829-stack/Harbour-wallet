// Package notify defines push delivery channels (Web Push, FCM ...).
package notify

import "context"

// Message is one notification.
type Message struct {
	Title    string
	Body     string
	Data     map[string]string
	DedupKey string // e.g. tx hash; delivery is deduplicated on this
}

// Target is an opaque per-device subscription (Web Push subscription JSON,
// FCM token ...).
type Target struct {
	Channel string
	Token   string
}

// ErrGone means the target is no longer valid and should be deleted.
type ErrGone struct{ Reason string }

func (e ErrGone) Error() string { return "notify target gone: " + e.Reason }

// Channel sends messages.
type Channel interface {
	Name() string
	Send(ctx context.Context, t Target, m Message) error
}

// ChannelFactory constructs a Channel.
type ChannelFactory func(options map[string]string) (Channel, error)
