package onramper

import (
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// Canonicalize serialises a JSON value per RFC 8785 (JCS): object keys sorted by UTF-16 code units, no whitespace,
// ECMAScript number formatting and JSON.stringify string escaping. Onramper hashes the request body this way, so Harbour
// sends exactly these bytes. Supported values: map[string]any, []any, string, bool, nil, float64 and Go integers.
func Canonicalize(v any) ([]byte, error) {
	var b strings.Builder
	if err := writeJCS(&b, v); err != nil {
		return nil, err
	}
	return []byte(b.String()), nil
}

func writeJCS(b *strings.Builder, v any) error {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if x {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case string:
		return writeJSONString(b, x)
	case float64:
		s, err := esNumber(x)
		if err != nil {
			return err
		}
		b.WriteString(s)
	case int:
		return writeJCS(b, float64(x))
	case int64:
		return writeJCS(b, float64(x))
	case []any:
		b.WriteByte('[')
		for i, e := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeJCS(b, e); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool { return lessUTF16(keys[i], keys[j]) })
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeJSONString(b, k); err != nil {
				return err
			}
			b.WriteByte(':')
			if err := writeJCS(b, x[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	default:
		return errors.New("onramper: unsupported JSON value")
	}
	return nil
}

func lessUTF16(a, b string) bool {
	ua, ub := utf16.Encode([]rune(a)), utf16.Encode([]rune(b))
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			return ua[i] < ub[i]
		}
	}
	return len(ua) < len(ub)
}

func writeJSONString(b *strings.Builder, s string) error {
	if !utf8.ValidString(s) {
		return errors.New("onramper: invalid UTF-8 in JSON string")
	}
	const hexd = "0123456789abcdef"
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				b.WriteString(`\u00`)
				b.WriteByte(hexd[r>>4])
				b.WriteByte(hexd[r&15])
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return nil
}

// esNumber formats like ECMAScript Number.prototype.toString (shortest round-trip digits).
func esNumber(f float64) (string, error) {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return "", errors.New("onramper: number is not finite")
	}
	if f == 0 {
		return "0", nil
	}
	if a := math.Abs(f); a >= 1e-6 && a < 1e21 {
		return strconv.FormatFloat(f, 'f', -1, 64), nil
	}
	s := strconv.FormatFloat(f, 'e', -1, 64) // e.g. 1.5e-07, 1e+21
	mant, exp, _ := strings.Cut(s, "e")
	sign := exp[0]
	exp = strings.TrimLeft(exp[1:], "0")
	if exp == "" {
		exp = "0"
	}
	return mant + "e" + string(sign) + exp, nil
}
