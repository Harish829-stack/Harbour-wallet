package api

// QA (property): the API's amount rendering is exact big-integer arithmetic up to 2^256-1 at 0/18/36 decimals; USD values are a
// float for display only and stay within float64 relative precision of the exact rational. TEST_PLAN: T-X-001 (backend part).

import (
	"math"
	"math/big"
	"math/rand"
	"strings"
	"testing"
)

// oracle: raw → canonical decimal string, built with string slicing only.
func qaOracleFormat(raw *big.Int, d int) string {
	s := raw.String()
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	if d == 0 {
		if neg {
			return "-" + s
		}
		return s
	}
	for len(s) < d+1 {
		s = "0" + s
	}
	w, f := s[:len(s)-d], strings.TrimRight(s[len(s)-d:], "0")
	out := w
	if f != "" {
		out += "." + f
	}
	if neg {
		out = "-" + out
	}
	return out
}

func TestQAFormatUnitsExactTo2Pow256(t *testing.T) {
	max := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1))
	rng := rand.New(rand.NewSource(20261120))
	decs := []int{0, 6, 8, 18, 24, 36}
	edges := []*big.Int{big.NewInt(0), big.NewInt(1), max, new(big.Int).Sub(max, big.NewInt(1)), new(big.Int).Exp(big.NewInt(10), big.NewInt(36), nil), new(big.Int).Lsh(big.NewInt(1), 53)}
	for i := 0; i < 2000; i++ {
		var v *big.Int
		if i < len(edges) {
			v = edges[i]
		} else {
			v = new(big.Int).Rand(rng, new(big.Int).Add(max, big.NewInt(1)))
		}
		for _, d := range decs {
			d := d
			if got, want := formatUnits(v.String(), &d), qaOracleFormat(v, d); got != want {
				t.Fatalf("formatUnits(%s, %d) = %q, want %q", v, d, got, want)
			}
		}
		if got := formatUnits(v.String(), nil); got != v.String() {
			t.Fatalf("formatUnits(%s, nil) = %q", v, got)
		}
		neg := new(big.Int).Neg(v)
		d := 18
		if got, want := formatUnits(neg.String(), &d), qaOracleFormat(neg, 18); got != want {
			t.Fatalf("negative: %q want %q", got, want)
		}
	}
	for _, bad := range []string{"", "1e18", "0x10", "1.5", " 1", "abc"} {
		d := 18
		if got := formatUnits(bad, &d); got != "" {
			t.Fatalf("formatUnits(%q) = %q, want empty", bad, got)
		}
	}
}

func TestQAValueUSDWithinFloatPrecision(t *testing.T) {
	max := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1))
	rng := rand.New(rand.NewSource(7))
	for i := 0; i < 2000; i++ {
		v := new(big.Int).Rand(rng, max)
		d := []int{0, 6, 18, 36}[i%4]
		px := []float64{0, 1, 0.000123, 3456.78, 1e-9}[i%5]
		got := valueUSD(v.String(), &d, px)
		// exact rational, then rounded once
		exact := new(big.Rat).SetFrac(v, new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(d)), nil))
		exact.Mul(exact, new(big.Rat).SetFloat64(px))
		want, _ := exact.Float64()
		if math.IsInf(got, 0) || math.IsNaN(got) || got < 0 {
			t.Fatalf("valueUSD(%s,%d,%g) = %g", v, d, px, got)
		}
		if want != 0 && math.Abs(got-want)/want > 1e-12 {
			t.Fatalf("valueUSD(%s,%d,%g) = %g, exact %g", v, d, px, got, want)
		}
	}
	d := 18
	if valueUSD("not a number", &d, 1) != 0 || valueUSD("1", nil, 1) != 0 {
		t.Fatal("malformed input must value at 0")
	}
}
