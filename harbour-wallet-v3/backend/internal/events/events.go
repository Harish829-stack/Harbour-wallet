// Package events is Harbour's internal event bus (NATS JetStream). Services
// never push to clients directly; realtime-bridge relays to Centrifugo.
package events

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

// Subjects from the plan.
const (
	SubjectAddressAdded = "address.added"
	SubjectHistoryMore  = "address.history.more"
	SubjectBalance      = "balance.changed" // + "." + chain
	SubjectActivityNew  = "activity.new"    // + "." + chain: incoming transfers (push)
	SubjectTxStatus     = "tx.status"       // + "." + chain
	StreamName          = "HARBOUR"
)

// Bus publishes and consumes durable events.
type Bus interface {
	Publish(ctx context.Context, subject string, data []byte) error
	// Consume delivers messages on subject to h until ctx ends. A durable
	// name shares work across replicas; h returning an error redelivers.
	Consume(ctx context.Context, durable, subject string, h func(ctx context.Context, data []byte) error) error
	Close()
}

// NATS is a JetStream-backed Bus.
type NATS struct {
	nc  *nats.Conn
	js  jetstream.JetStream
	log *slog.Logger
}

// Connect connects and ensures the HARBOUR stream exists.
func Connect(ctx context.Context, url, name string, log *slog.Logger) (*NATS, error) {
	nc, err := nats.Connect(url, nats.Name(name), nats.MaxReconnects(-1), nats.ReconnectWait(time.Second))
	if err != nil {
		return nil, fmt.Errorf("nats: %w", err)
	}
	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, err
	}
	_, err = js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:     StreamName,
		Subjects: []string{"address.>", "balance.>", "chain.>", "tx.>", "price.>", "activity.>"},
		Storage:  jetstream.FileStorage,
		MaxAge:   7 * 24 * time.Hour,
	})
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("nats stream: %w", err)
	}
	return &NATS{nc: nc, js: js, log: log}, nil
}

// Publish waits for the stream to persist the message.
func (n *NATS) Publish(ctx context.Context, subject string, data []byte) error {
	_, err := n.js.Publish(ctx, subject, data)
	return err
}

// Consume runs a durable pull consumer.
func (n *NATS) Consume(ctx context.Context, durable, subject string, h func(context.Context, []byte) error) error {
	c, err := n.js.CreateOrUpdateConsumer(ctx, StreamName, jetstream.ConsumerConfig{
		Durable: durable, FilterSubject: subject, AckPolicy: jetstream.AckExplicitPolicy,
		AckWait: 2 * time.Minute, MaxDeliver: 20, DeliverPolicy: jetstream.DeliverAllPolicy,
	})
	if err != nil {
		return fmt.Errorf("nats consumer %s: %w", durable, err)
	}
	cc, err := c.Consume(func(m jetstream.Msg) {
		if err := h(ctx, m.Data()); err != nil {
			n.log.Warn("event handler failed; will redeliver", "subject", m.Subject(), "err", err)
			_ = m.NakWithDelay(10 * time.Second)
			return
		}
		_ = m.Ack()
	})
	if err != nil {
		return err
	}
	<-ctx.Done()
	cc.Stop()
	return nil
}

// Close drains the connection.
func (n *NATS) Close() { _ = n.nc.Drain() }

// Log is a Bus that only logs (tests and NATS-less local runs).
type Log struct{ L *slog.Logger }

func (l Log) Publish(_ context.Context, subject string, data []byte) error {
	l.L.Debug("event", "subject", subject, "bytes", len(data))
	return nil
}
func (l Log) Consume(ctx context.Context, _, _ string, _ func(context.Context, []byte) error) error {
	<-ctx.Done()
	return nil
}
func (l Log) Close() {}

// ErrNoBus is returned when NATS_URL is not set where it is required.
var ErrNoBus = errors.New("events: NATS_URL is not set")
