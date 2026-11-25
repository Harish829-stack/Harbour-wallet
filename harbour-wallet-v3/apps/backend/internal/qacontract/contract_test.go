// Package qacontract holds cross-package contract tests (QA, T-IDX-060): every NATS payload a producer publishes carries,
// with the same JSON name and kind, every field its consumers decode; the wire shape of each producer is pinned by a golden
// file; Centrifugo channel names match what the extension listens for. Consumer structs are unexported, so their JSON tags are
// read from the source with go/ast.
package qacontract

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"harbour/backend/internal/api"
	"harbour/backend/internal/indexer"
	"harbour/backend/internal/prices"
	"harbour/backend/internal/realtime"
	"harbour/backend/internal/txtrack"
)

// jsonFields of a Go type: name -> kind ("string", "number", "bool", "object", "array", "time").
func jsonFields(t reflect.Type) map[string]string {
	out := map[string]string{}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		name := strings.Split(f.Tag.Get("json"), ",")[0]
		if name == "" || name == "-" {
			continue
		}
		out[name] = kindOf(f.Type)
	}
	return out
}
func kindOf(t reflect.Type) string {
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t == reflect.TypeOf(time.Time{}) {
		return "time"
	}
	if t == reflect.TypeOf(json.RawMessage{}) {
		return "raw"
	}
	switch t.Kind() {
	case reflect.String:
		return "string"
	case reflect.Bool:
		return "bool"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Float32, reflect.Float64:
		return "number"
	case reflect.Slice, reflect.Array:
		return "array"
	default:
		return "object"
	}
}

// astFields reads an (unexported) struct's JSON tags from a source file.
func astFields(t *testing.T, file, typ string) map[string]string {
	t.Helper()
	f, err := parser.ParseFile(token.NewFileSet(), file, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]string{}
	ast.Inspect(f, func(n ast.Node) bool {
		ts, ok := n.(*ast.TypeSpec)
		if !ok || ts.Name.Name != typ {
			return true
		}
		for _, fld := range ts.Type.(*ast.StructType).Fields.List {
			if fld.Tag == nil {
				continue
			}
			tag := reflect.StructTag(strings.Trim(fld.Tag.Value, "`"))
			name := strings.Split(tag.Get("json"), ",")[0]
			k := "object"
			switch x := fld.Type.(type) {
			case *ast.Ident:
				switch {
				case x.Name == "string":
					k = "string"
				case x.Name == "bool":
					k = "bool"
				case strings.HasPrefix(x.Name, "int") || strings.HasPrefix(x.Name, "uint") || strings.HasPrefix(x.Name, "float"):
					k = "number"
				}
			case *ast.StarExpr:
				if id, ok := x.X.(*ast.Ident); ok && (strings.HasPrefix(id.Name, "int") || strings.HasPrefix(id.Name, "uint")) {
					k = "number"
				}
			case *ast.ArrayType:
				k = "array"
			case *ast.SelectorExpr:
				if x.Sel.Name == "Time" {
					k = "time"
				} else if x.Sel.Name == "RawMessage" {
					k = "raw"
				}
			}
			out[name] = k
		}
		return false
	})
	if len(out) == 0 {
		t.Fatalf("type %s not found in %s", typ, file)
	}
	return out
}

func TestQAProducersCarryEveryConsumerField(t *testing.T) {
	type pair struct {
		subject  string
		producer reflect.Type
		file     string
		consumer string
	}
	pairs := []pair{
		{"balance.changed.*", reflect.TypeOf(indexer.BalanceChanged{}), "../realtime/bridge.go", "balanceEvent"},
		{"tx.status.* (tracker)", reflect.TypeOf(txtrack.Status{}), "../realtime/bridge.go", "txEvent"},
		{"tx.status.* (API)", reflect.TypeOf(api.TxStatusEvent{}), "../realtime/bridge.go", "txEvent"},
		{"tx.status.* (tracker)", reflect.TypeOf(txtrack.Status{}), "../notifier/notifier.go", "txStatus"},
		{"tx.status.* (API)", reflect.TypeOf(api.TxStatusEvent{}), "../notifier/notifier.go", "txStatus"},
		{"activity.new.*", reflect.TypeOf(indexer.ActivityNew{}), "../notifier/notifier.go", "activity"},
	}
	for _, p := range pairs {
		prod := jsonFields(p.producer)
		for name, kind := range astFields(t, p.file, p.consumer) {
			pk, ok := prod[name]
			if !ok {
				t.Errorf("%s: consumer %s reads %q, producer %s never sends it", p.subject, p.consumer, name, p.producer)
				continue
			}
			if kind != pk && !(kind == "raw" || kind == "object" && pk == "object") && !(kind == "array" && pk == "array") {
				t.Errorf("%s: field %q is %s for the producer, %s for consumer %s", p.subject, name, pk, kind, p.consumer)
			}
		}
	}
	// two producers of tx.status must agree with each other
	a, b := jsonFields(reflect.TypeOf(txtrack.Status{})), jsonFields(reflect.TypeOf(api.TxStatusEvent{}))
	if !reflect.DeepEqual(a, b) {
		t.Errorf("tx.status producers differ: tracker %v, API %v", a, b)
	}
}

func TestQAEventPayloadGoldens(t *testing.T) {
	dec := 6
	when := time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC)
	samples := map[string]any{
		"address.added":    api.AddressAddedEvent{TrackedAddressID: 7, Chain: "base", Address: "0xab", DenyBackfill: true},
		"balance.changed":  indexer.BalanceChanged{TrackedAddressID: 7, Chain: "base", Address: "0xab", AsOfBlock: 9, Balances: []indexer.BalanceChange{{AssetRef: "native", AmountRaw: "1"}}},
		"activity.new":     indexer.ActivityNew{TrackedAddressID: 7, Chain: "base", TxHash: "0x1", Asset: "native", Kind: "native", AmountRaw: "5", Symbol: "ETH", Decimals: &dec, SpamScore: 0, BlockTime: when},
		"tx.status/track":  txtrack.Status{Chain: "base", TxHash: "0x1", Status: "confirmed", BlockNumber: 5, From: "0xab"},
		"tx.status/api":    api.TxStatusEvent{Chain: "base", TxHash: "0x1", Status: "pending", From: "0xab"},
		"chain.raw":        indexer.RawDelivery{Source: "alchemy", Body: json.RawMessage(`{"x":1}`)},
		"price.tick":       prices.TickMessage{At: when, Prices: map[string]float64{"1": 2.5}},
		"centrifugo.chans": []string{realtime.BalanceChannel("base", "0xAB"), realtime.TxChannel("base", "0xCD")},
	}
	keys := make([]string, 0, len(samples))
	for k := range samples {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, k := range keys {
		j, _ := json.Marshal(samples[k])
		b.WriteString(k + " " + string(j) + "\n")
	}
	golden := "testdata/events.golden"
	if os.Getenv("HB_UPDATE_GOLDEN") == "1" {
		if err := os.WriteFile(golden, []byte(b.String()), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(golden)
	if err != nil {
		t.Fatalf("%v (run with HB_UPDATE_GOLDEN=1 once)", err)
	}
	if string(want) != b.String() {
		t.Fatalf("event wire format changed (update consumers, then the golden):\n--- golden\n%s--- now\n%s", want, b.String())
	}
}

// The extension routes realtime publications by channel prefix (src/background/harbour.ts): balances: / tx:.
func TestQAChannelNamesMatchTheExtension(t *testing.T) {
	src, err := os.ReadFile("../../../extension/src/background/harbour.ts")
	if err != nil {
		t.Skip("extension sources not alongside the backend")
	}
	for _, ch := range []string{realtime.BalanceChannel("base", "0xAB"), realtime.TxChannel("base", "0xCD")} {
		prefix := ch[:strings.Index(ch, ":")+1]
		if !strings.Contains(string(src), "channel.startsWith('"+prefix+"')") {
			t.Errorf("channel %q: the extension does not route the %q prefix", ch, prefix)
		}
		if ch != strings.ToLower(ch) {
			t.Errorf("channel %q is not lower-case (addresses must be normalised)", ch)
		}
	}
}
