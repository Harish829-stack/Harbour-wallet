// Deterministic in-process EVM ledger behind a JSON-RPC endpoint, used as the "upstream node" in full-stack and browser E2E tests
// (core rule 4: no real network, no real funds). It is NOT an EVM: it tracks balances and nonces, accepts signed transfers that
// decode and recover correctly (@ethereumjs/tx), mines one block per transaction and serves receipts. Contract calls return empty data.
//
//   const chain = await startMockChain({ port: 0, chains: { sepolia: 11155111 }, funded: { '0x…': 10n ** 18n } });
//   chain.url  → http://127.0.0.1:<port>      POST /rpc/<chain>   (the path the Harbour API uses for its rpc-gateway)
//   chain.txs  → accepted transactions (decoded)          chain.calls → every JSON-RPC call received
//   chain.fail(method, n) → the next n calls of `method` fail with HTTP 503 (resilience tests)
import http from 'node:http';
import { TransactionFactory } from '@ethereumjs/tx';

const hex = (n) => '0x' + BigInt(n).toString(16);
const BASE_FEE = 1_000_000_000n; const TIP = 1_000_000_000n;

export async function startMockChain({ port = 0, chains = { sepolia: 11155111 }, funded = {} } = {}) {
  const state = { balances: new Map(), nonces: new Map(), block: 100n, receipts: new Map(), byHash: new Map(), txs: [], calls: [], failures: new Map(), tokens: new Map() };
  // ERC-20 metadata for registered token contracts: symbol() 0x95d89b41, decimals() 0x313ce567, name() 0x06fdde03 (ABI-encoded).
  const abiString = (str) => { const b = Buffer.from(str, 'utf8'); return '0x' + (32n).toString(16).padStart(64, '0') + b.length.toString(16).padStart(64, '0') + b.toString('hex').padEnd(Math.ceil(b.length / 32) * 64 || 64, '0'); };
  const tokenCall = (to, data) => { const t = state.tokens.get(String(to).toLowerCase()); if (!t) return null; const sel = String(data).slice(0, 10); if (sel === '0x95d89b41') return abiString(t.symbol); if (sel === '0x06fdde03') return abiString(t.name); if (sel === '0x313ce567') return '0x' + t.decimals.toString(16).padStart(64, '0'); if (sel === '0x70a08231') return '0x' + '0'.repeat(64); return null; };
  for (const [a, v] of Object.entries(funded)) state.balances.set(a.toLowerCase(), BigInt(v));
  const bal = (a) => state.balances.get(String(a).toLowerCase()) ?? 0n;
  const nonce = (a) => state.nonces.get(String(a).toLowerCase()) ?? 0;
  const block = (n) => ({ number: hex(n), hash: '0x' + n.toString(16).padStart(64, '0'), parentHash: '0x' + (n - 1n).toString(16).padStart(64, '0'), timestamp: hex(1_700_000_000n + n * 12n), baseFeePerGas: hex(BASE_FEE), gasLimit: hex(30_000_000), gasUsed: '0x0', transactions: [] });

  function call(chainName, { method, params = [], id }) {
    state.calls.push({ chain: chainName, method, params });
    const chainId = chains[chainName];
    const ok = (result) => ({ jsonrpc: '2.0', id, result });
    const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    switch (method) {
      case 'eth_chainId': return ok(hex(chainId));
      case 'net_version': return ok(String(chainId));
      case 'eth_blockNumber': return ok(hex(state.block));
      case 'eth_getBalance': return ok(hex(bal(params[0])));
      case 'eth_getTransactionCount': return ok(hex(nonce(params[0])));
      case 'eth_gasPrice': return ok(hex(BASE_FEE + TIP));
      case 'eth_maxPriorityFeePerGas': return ok(hex(TIP));
      case 'eth_feeHistory': { const n = Number(params[0] ?? 1) || 1; return ok({ oldestBlock: hex(state.block - BigInt(n) + 1n), baseFeePerGas: Array(n + 1).fill(hex(BASE_FEE)), gasUsedRatio: Array(n).fill(0.5), reward: Array(n).fill((params[2] ?? [50]).map(() => hex(TIP))) }); }
      case 'eth_getBlockByNumber': return ok(block(params[0] === 'latest' || params[0] === 'pending' || params[0] === 'finalized' || params[0] === 'safe' ? state.block : BigInt(params[0])));
      case 'eth_getBlockByHash': { const n = BigInt('0x' + String(params[0]).slice(2).replace(/^0+/, '') || '0'); return ok(n > 0n && n <= state.block ? block(n) : null); }
      case 'eth_estimateGas': return ok(params[0]?.data && params[0].data !== '0x' ? hex(65_000) : hex(21_000));
      case 'eth_getCode': return ok(state.tokens.has(String(params[0]).toLowerCase()) ? '0x6080' : '0x');
      case 'eth_call': return ok(tokenCall(params[0]?.to, params[0]?.data ?? params[0]?.input) ?? '0x' + '0'.repeat(64));
      case 'eth_getTransactionReceipt': return ok(state.receipts.get(String(params[0]).toLowerCase()) ?? null);
      case 'eth_getTransactionByHash': return ok(state.byHash.get(String(params[0]).toLowerCase()) ?? null);
      case 'eth_getLogs': return ok([]);
      case 'eth_sendRawTransaction': {
        let tx; try { tx = TransactionFactory.fromSerializedData(Buffer.from(String(params[0]).slice(2), 'hex')); } catch (e) { return err(-32602, 'rlp: invalid transaction'); }
        if (!tx.isSigned()) return err(-32000, 'transaction not signed');
        if (Number(tx.common.chainId()) !== chainId) return err(-32000, 'invalid chain id for signer');
        const from = tx.getSenderAddress().toString().toLowerCase(); const hash = '0x' + Buffer.from(tx.hash()).toString('hex');
        if (state.receipts.has(hash)) return err(-32000, 'already known');
        if (Number(tx.nonce) < nonce(from)) return err(-32000, 'nonce too low');
        if (Number(tx.nonce) > nonce(from)) return err(-32000, 'nonce too high');
        const price = tx.type === 2 ? tx.maxFeePerGas : tx.gasPrice; const cost = tx.value + tx.gasLimit * price;
        if (bal(from) < cost) return err(-32000, 'insufficient funds for gas * price + value');
        const gasUsed = tx.data.length ? 65_000n : 21_000n; const eff = tx.type === 2 ? BASE_FEE + (tx.maxPriorityFeePerGas < tx.maxFeePerGas - BASE_FEE ? tx.maxPriorityFeePerGas : tx.maxFeePerGas - BASE_FEE) : tx.gasPrice;
        state.balances.set(from, bal(from) - tx.value - gasUsed * eff);
        const to = tx.to ? tx.to.toString().toLowerCase() : null; if (to) state.balances.set(to, bal(to) + tx.value);
        state.nonces.set(from, nonce(from) + 1); state.block += 1n;
        const view = { hash, from, to, nonce: hex(tx.nonce), value: hex(tx.value), gas: hex(tx.gasLimit), input: '0x' + Buffer.from(tx.data).toString('hex'), blockNumber: hex(state.block), blockHash: block(state.block).hash, transactionIndex: '0x0', type: hex(tx.type), chainId: hex(chainId) };
        state.byHash.set(hash, view);
        state.receipts.set(hash, { transactionHash: hash, from, to, status: '0x1', blockNumber: hex(state.block), blockHash: view.blockHash, gasUsed: hex(gasUsed), effectiveGasPrice: hex(eff), cumulativeGasUsed: hex(gasUsed), logs: [], logsBloom: '0x' + '0'.repeat(512), transactionIndex: '0x0', contractAddress: null, type: hex(tx.type) });
        state.txs.push({ chain: chainName, hash, from, to, value: tx.value, nonce: Number(tx.nonce), type: tx.type, raw: params[0] });
        return ok(hash);
      }
      default: return err(-32601, `method ${method} not supported by the mock chain`);
    }
  }

  const server = http.createServer((req, res) => {
    const m = req.url.match(/^\/rpc\/([a-z0-9-]+)\/?$/);
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (!m || !chains[m[1]]) { res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'unknown_chain', message: 'unknown chain' } })); return; }
      let parsed; try { parsed = JSON.parse(body); } catch { res.writeHead(400).end('bad json'); return; }
      const first = Array.isArray(parsed) ? parsed[0]?.method : parsed?.method;
      const f = state.failures.get(first); if (f > 0) { state.failures.set(first, f - 1); res.writeHead(503, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'upstream', message: 'busy' } })); return; }
      const out = Array.isArray(parsed) ? parsed.map((r) => call(m[1], r)) : call(m[1], parsed);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
    });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`, txs: state.txs, calls: state.calls, balance: bal, nonce,
    fund: (a, v) => state.balances.set(a.toLowerCase(), BigInt(v)), fail: (method, n = 1) => state.failures.set(method, n),
    addToken: (address, { symbol, name = symbol, decimals = 18 }) => state.tokens.set(address.toLowerCase(), { symbol, name, decimals }),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}
