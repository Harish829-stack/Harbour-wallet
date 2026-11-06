// viem transport backed by the Kit NodeRepository: nodes are tried in order (custom, gateway, public), failures are scored,
// and the next request prefers healthier nodes (plan A7). A single node degrades to a plain http transport.
import { fallback, http, type Transport } from 'viem';
import { NodeRepository } from './nodeRepository';
import { rpcUrlList } from '../core/rpc';

const repos = new Map<number, NodeRepository>();

/** One repository per chain. URLs arrive pre-ordered (override, gateway, public); that order is the tier, health reorders within a tier. */
export function nodesFor(chainId: number): NodeRepository {
  let repo = repos.get(chainId);
  if (!repo) { repo = new NodeRepository(); repos.set(chainId, repo); }
  repo.set(rpcUrlList(chainId).map((url, i) => ({ url, source: url.includes('/alchemy/') ? 'gateway' : 'default', rank: i })));
  return repo;
}

export function evmTransport(chainId: number, timeout = 15000): Transport {
  const repo = nodesFor(chainId);
  const urls = repo.ordered();
  const mk = (u: string) => http(u, { timeout, retryCount: 0, onFetchResponse: (r) => repo.report(u, r.ok) });
  return urls.length > 1 ? fallback(urls.map(mk), { retryCount: 0 }) : http(urls[0], { timeout, retryCount: 1 });
}
