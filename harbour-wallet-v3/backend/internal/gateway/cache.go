package gateway

import (
	"container/list"
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// cache is an in-process LRU with per-entry expiry. Finalized results never
// expire (only evicted); results at latest live about one block.
type cache struct {
	mu    sync.Mutex
	max   int
	ll    *list.List
	items map[string]*list.Element
	hits  atomic.Uint64
	miss  atomic.Uint64
}

type centry struct {
	key     string
	val     json.RawMessage
	expires time.Time // zero = never
}

func newCache(max int) *cache {
	return &cache{max: max, ll: list.New(), items: map[string]*list.Element{}}
}

func (c *cache) get(key string) (json.RawMessage, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.items[key]
	if !ok {
		c.miss.Add(1)
		return nil, false
	}
	e := el.Value.(*centry)
	if !e.expires.IsZero() && time.Now().After(e.expires) {
		c.ll.Remove(el)
		delete(c.items, key)
		c.miss.Add(1)
		return nil, false
	}
	c.ll.MoveToFront(el)
	c.hits.Add(1)
	return e.val, true
}

func (c *cache) put(key string, val json.RawMessage, ttl time.Duration, forever bool) {
	if c.max <= 0 {
		return
	}
	var exp time.Time
	if !forever {
		exp = time.Now().Add(ttl)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		el.Value = &centry{key, val, exp}
		c.ll.MoveToFront(el)
		return
	}
	c.items[key] = c.ll.PushFront(&centry{key, val, exp})
	for c.ll.Len() > c.max {
		last := c.ll.Back()
		c.ll.Remove(last)
		delete(c.items, last.Value.(*centry).key)
	}
}

func (c *cache) len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ll.Len()
}

// ---------- block parameters ----------

// blockRef is a parsed block parameter.
type blockRef struct {
	tag  string // latest, pending, safe, finalized, earliest, "" if numeric/hash
	num  uint64
	hash bool
}

func (b blockRef) numeric() bool { return b.tag == "" && !b.hash }

func parseBlockRef(raw json.RawMessage) blockRef {
	if len(raw) == 0 || string(raw) == "null" {
		return blockRef{tag: "latest"}
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		if strings.HasPrefix(s, "0x") {
			if n, err := strconv.ParseUint(s[2:], 16, 64); err == nil {
				return blockRef{num: n}
			}
			if len(s) == 66 {
				return blockRef{hash: true}
			}
		}
		if s == "" {
			return blockRef{tag: "latest"}
		}
		return blockRef{tag: s}
	}
	var obj struct {
		BlockHash   string `json:"blockHash"`
		BlockNumber string `json:"blockNumber"`
	}
	if json.Unmarshal(raw, &obj) == nil {
		if obj.BlockHash != "" {
			return blockRef{hash: true}
		}
		if obj.BlockNumber != "" {
			return parseBlockRef(json.RawMessage(strconv.Quote(obj.BlockNumber)))
		}
	}
	return blockRef{tag: "latest"}
}

// blockParamIndex is where each method takes its block parameter.
var blockParamIndex = map[string]int{
	"eth_getBalance":                          1,
	"eth_getCode":                             1,
	"eth_getTransactionCount":                 1,
	"eth_call":                                1,
	"eth_estimateGas":                         1,
	"eth_getStorageAt":                        2,
	"eth_getBlockByNumber":                    0,
	"eth_getBlockTransactionCountByNumber":    0,
	"eth_getTransactionByBlockNumberAndIndex": 0,
	"eth_getBlockReceipts":                    0,
	"eth_feeHistory":                          1,
	"eth_getProof":                            2,
}

func splitParams(raw json.RawMessage) []json.RawMessage {
	var ps []json.RawMessage
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &ps)
	}
	return ps
}

// requestBlock returns the block a request reads, if any.
func requestBlock(method string, params []json.RawMessage) (blockRef, bool) {
	if method == "eth_getLogs" {
		if len(params) == 0 {
			return blockRef{tag: "latest"}, true
		}
		var f logFilter
		if json.Unmarshal(params[0], &f) != nil {
			return blockRef{tag: "latest"}, true
		}
		if f.BlockHash != "" {
			return blockRef{hash: true}, true
		}
		return parseBlockRef(f.ToBlock), true
	}
	i, ok := blockParamIndex[method]
	if !ok {
		return blockRef{}, false
	}
	if i < len(params) {
		return parseBlockRef(params[i]), true
	}
	return blockRef{tag: "latest"}, true
}

type logFilter struct {
	FromBlock json.RawMessage `json:"fromBlock,omitempty"`
	ToBlock   json.RawMessage `json:"toBlock,omitempty"`
	BlockHash string          `json:"blockHash,omitempty"`
	Address   json.RawMessage `json:"address,omitempty"`
	Topics    json.RawMessage `json:"topics,omitempty"`
}

var latestTTLMethods = map[string]bool{
	"eth_blockNumber": true, "eth_gasPrice": true, "eth_maxPriorityFeePerGas": true, "eth_blobBaseFee": true,
}

var foreverMethods = map[string]bool{"eth_chainId": true, "net_version": true}

// cachePolicy decides how long a successful result may be cached.
func cachePolicy(method string, params []json.RawMessage, result json.RawMessage, finalized uint64, blockTime time.Duration) (ttl time.Duration, forever, ok bool) {
	if blockTime < time.Second {
		blockTime = time.Second
	}
	if foreverMethods[method] {
		return 0, true, true
	}
	if latestTTLMethods[method] {
		return blockTime, false, true
	}
	isNull := len(result) == 0 || string(result) == "null"
	switch method {
	case "eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_getBlockByHash", "eth_getTransactionByBlockHashAndIndex":
		if isNull {
			return 0, false, false
		}
		var r struct {
			BlockNumber string `json:"blockNumber"`
			Number      string `json:"number"`
		}
		_ = json.Unmarshal(result, &r)
		bn := r.BlockNumber
		if bn == "" {
			bn = r.Number
		}
		if bn == "" {
			return 0, false, false // pending
		}
		n, err := strconv.ParseUint(strings.TrimPrefix(bn, "0x"), 16, 64)
		if err == nil && finalized > 0 && n <= finalized {
			return 0, true, true
		}
		return blockTime, false, true
	}
	ref, has := requestBlock(method, params)
	if !has {
		return 0, false, false
	}
	switch {
	case ref.tag == "pending":
		return 0, false, false
	case ref.hash, ref.tag == "earliest":
		return 0, true, true
	case ref.numeric() && finalized > 0 && ref.num <= finalized:
		if method == "eth_getBlockByNumber" && isNull {
			return 0, false, false
		}
		return 0, true, true
	default:
		return blockTime, false, true
	}
}
