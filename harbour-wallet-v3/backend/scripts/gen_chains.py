#!/usr/bin/env python3
"""Regenerates the EVM mainnet block of config/chains.yaml from the extension's chain registry.

  python3 scripts/gen_chains.py            # rewrite the block between the BEGIN/END GENERATED markers
  python3 scripts/gen_chains.py --check    # exit 1 if chains.yaml is out of date

ethereum and base stay hand-written above the markers. Every other EVM chain in
src/core/chains/registry*.json (enabled ones) is emitted here with:
  - keyed upstreams (Alchemy / Infura) where those providers serve the network, and
  - the chain's own public RPCs from the registry as `public` upstreams (no secrets).
Chains with an Alchemy `sources:` entry are fully indexed (history, live activity, NFTs);
the others are balance/send/fee only, served straight from RPC.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REG = os.path.join(ROOT, '..', 'src', 'core', 'chains')
OUT = os.path.join(ROOT, 'config', 'chains.yaml')
TS_OUT = os.path.join(ROOT, '..', 'src', 'core', 'harbour', 'chainList.gen.ts')
BEGIN, END = '# BEGIN GENERATED (scripts/gen_chains.py)', '# END GENERATED'

HAND = {'ethereum', 'base'}
# id -> (alchemy network, alchemy webhook network, infura network, coingecko asset platform, geckoterminal network, finality, block_time)
# finality: 'tag' = node serves the "finalized" tag; int = depth in blocks.
T = {
  'polygon':       ('polygon-mainnet', 'MATIC_MAINNET', 'polygon-mainnet', 'polygon-pos', 'polygon_pos', 'tag', '2s'),
  'arbitrum':      ('arb-mainnet', 'ARB_MAINNET', 'arbitrum-mainnet', 'arbitrum-one', 'arbitrum', 'tag', '250ms'),
  'optimism':      ('opt-mainnet', 'OPT_MAINNET', 'optimism-mainnet', 'optimistic-ethereum', 'optimism', 'tag', '2s'),
  'smartchain':    ('bnb-mainnet', 'BNB_MAINNET', 'bsc-mainnet', 'binance-smart-chain', 'bsc', 'tag', '1s'),
  'avalanchec':    ('avax-mainnet', 'AVAX_MAINNET', 'avalanche-mainnet', 'avalanche', 'avax', 10, '2s'),
  'linea':         ('linea-mainnet', 'LINEA_MAINNET', 'linea-mainnet', 'linea', 'linea', 'tag', '2s'),
  'scroll':        ('scroll-mainnet', 'SCROLL_MAINNET', 'scroll-mainnet', 'scroll', 'scroll', 20, '3s'),
  'zksync':        ('zksync-mainnet', 'ZKSYNC_MAINNET', 'zksync-mainnet', 'zksync', 'zksync', 'tag', '1s'),
  'blast':         ('blast-mainnet', 'BLAST_MAINNET', 'blast-mainnet', 'blast', 'blast', 'tag', '2s'),
  'mantle':        ('mantle-mainnet', 'MANTLE_MAINNET', 'mantle-mainnet', 'mantle', 'mantle', 'tag', '2s'),
  'celo':          ('celo-mainnet', 'CELO_MAINNET', 'celo-mainnet', 'celo', 'celo', 'tag', '1s'),
  'xdai':          ('gnosis-mainnet', 'GNOSIS_MAINNET', None, 'xdai', 'xdai', 'tag', '5s'),
  'opbnb':         ('opbnb-mainnet', 'OPBNB_MAINNET', 'opbnb-mainnet', 'opbnb', 'opbnb', 'tag', '1s'),
  'sonic':         ('sonic-mainnet', 'SONIC_MAINNET', None, 'sonic', 'sonic', 10, '1s'),
  'metis':         ('metis-mainnet', None, None, 'metis-andromeda', 'metis', 20, '4s'),
  'polygonzkevm':  ('polygonzkevm-mainnet', None, None, 'polygon-zkevm', 'polygon-zkevm', 20, '3s'),
  'arbitrumnova':  ('arbnova-mainnet', None, None, 'arbitrum-nova', 'arbitrum_nova', 'tag', '250ms'),
  'ronin':         ('ronin-mainnet', None, None, 'ronin', 'ronin', 20, '3s'),
  'monad':         ('monad-mainnet', None, 'monad-mainnet', None, None, 20, '400ms'),
  'seievm':        ('sei-mainnet', None, 'sei-mainnet', None, None, 20, '400ms'),
  'hyperevm':      (None, None, 'hyperevm-mainnet', None, None, 30, '1s'),
  'megaeth':       (None, None, 'megaeth-mainnet', None, None, 60, '1s'),
  'arc':           (None, None, 'arc-mainnet', None, None, 10, '1s'),
  'robinhoodchain':(None, None, 'robinhood-mainnet', None, None, 30, '250ms'),
  # public-RPC only
  'classic':       (None, None, None, 'ethereum-classic', 'etc', 400, '13s'),
  'fantom':        (None, None, None, 'fantom', 'ftm', 10, '1s'),
  'cronos':        (None, None, None, 'cronos', 'cro', 20, '6s'),
  'aurora':        (None, None, None, 'aurora', 'aurora', 30, '1s'),
  'moonbeam':      (None, None, None, 'moonbeam', 'glmr', 20, '6s'),
  'moonriver':     (None, None, None, 'moonriver', 'movr', 20, '6s'),
  'klaytn':        (None, None, None, 'klay-token', 'klaytn', 10, '1s'),
  'kavaevm':       (None, None, None, 'kava', 'kava', 20, '6s'),
  'boba':          (None, None, None, 'boba', 'boba', 30, '1s'),
  'kcc':           (None, None, None, 'kucoin-community-chain', 'kcc', 20, '3s'),
  'cfxevm':        (None, None, None, 'conflux', 'conflux', 60, '1s'),
  'rootstock':     (None, None, None, 'rootstock', 'rsk', 40, '30s'),
  'zetaevm':       (None, None, None, 'zetachain', 'zeta', 20, '6s'),
  'manta':         (None, None, None, 'manta-pacific', 'manta-pacific', 30, '2s'),
  'merlin':        (None, None, None, 'merlin-chain', 'merlin', 30, '3s'),
}
DEFAULT = (None, None, None, None, None, 30, '3s')
# Alchemy Transfers + Address Activity (indexed chains). "internal" transfers only where Alchemy offers them.
INDEXED = {'polygon', 'arbitrum', 'optimism', 'smartchain', 'avalanchec', 'linea', 'scroll', 'zksync', 'blast', 'mantle', 'celo', 'xdai', 'opbnb', 'sonic'}
INTERNAL = {'polygon', 'arbitrum', 'optimism', 'smartchain', 'avalanchec'}


def load():
    reg = json.load(open(os.path.join(REG, 'registry.json')))
    extra = json.load(open(os.path.join(REG, 'registry.extra.json')))
    enabled = set(json.load(open(os.path.join(REG, 'extra-enabled.json'))))
    return [c for c in reg + [e for e in extra if e['id'] in enabled] if c['kind'] == 'evm' and c['id'] not in HAND]


def entry(c):
    cid = c['id']
    al, wh, inf, cgp, gt, fin, bt = T.get(cid, DEFAULT)
    L = [f"  {cid}:", "    family: evm", f"    evm_chain_id: {c['evmChainId']}", f"    block_time: {bt}", "    logs_max_range: 1000"]
    L.append('    finality: {policy: finalized-tag}' if fin == 'tag' else f'    finality: {{policy: depth, options: {{confirmations: {fin}}}}}')
    price = {}
    if c.get('cg'):
        price['coingecko'] = c['cg']
    if al:
        price['alchemy'] = c['symbol']
    pid = ', '.join(f'{k}: {v}' for k, v in price.items())
    L.append(f"    native: {{symbol: {json.dumps(c['symbol'])}, decimals: {c['decimals']}{', price_ids: {' + pid + '}' if pid else ''}}}")
    ups = []
    if al:
        ups += [f"      - {{provider: alchemy, key: alchemy-a, network: {al}, weight: 4}}", f"      - {{provider: alchemy, key: alchemy-b, network: {al}, weight: 2}}"]
    if inf:
        ups += [f"      - {{provider: infura, key: infura-a, network: {inf}, weight: 3}}", f"      - {{provider: infura, key: infura-b, network: {inf}, weight: 2}}"]
    for i, u in enumerate(c.get('rpcs', [])[:3]):
        ups.append(f"      - {{provider: public, key: public, url: {json.dumps(u)}, weight: {1 if i == 0 else 0.5}}}")
    L += ["    upstreams:"] + ups
    if cid in INDEXED and al and wh:
        cats = 'external,internal,erc20,erc721,erc1155' if cid in INTERNAL else 'external,erc20,erc721,erc1155'
        L += ["    sources:", f'      alchemy: {{network: {al}, webhook_network: {wh}, categories: "{cats}"}}']
    if cgp:
        pr = f'platform: {cgp}' + (f', onchain_network: {gt}' if gt else '')
        L += ["    prices:", f"      coingecko: {{{pr}}}"] + ([f"      alchemy: {{network: {al}}}"] if al else [])
    return '\n'.join(L)


def ts_list():
    """The extension's view of what the backend serves: every chain in chains.yaml (hand-written + generated + testnets)."""
    import re
    reg = json.load(open(os.path.join(REG, 'registry.json'))) + json.load(open(os.path.join(REG, 'registry.extra.json')))
    evm = {c['id']: c['evmChainId'] for c in reg if c['kind'] == 'evm'}
    text = open(OUT).read()
    rows = []
    for m in re.finditer(r'^  ([a-z0-9-]+):\n((?:    .*\n|\n)*)', text.split('chains:', 1)[1], re.M):
        name, body = m.group(1), m.group(2)
        cid = int(re.search(r'evm_chain_id: (\d+)', body).group(1))
        rows.append((name, cid, 'sources:' in body, 'testnet: true' in body))
    out = ['// GENERATED by backend/scripts/gen_chains.py from backend/config/chains.yaml. Do not edit.',
           '// id = extension registry id = backend chain name. indexed = the backend indexes history, activity and NFTs for it (an Alchemy `sources:` entry);',
           '// other chains are served by the RPC proxy only (balances, fees, send), and history/NFTs come from public explorers.',
           'export const HARBOUR_CHAIN_LIST: ReadonlyArray<{ id: string; backend: string; evmChainId: number; indexed: boolean; testnet: boolean }> = [']
    for name, cid, idx, tn in rows:
        out.append(f"  {{ id: '{name}', backend: '{name}', evmChainId: {cid}, indexed: {'true' if idx else 'false'}, testnet: {'true' if tn else 'false'} }},")
    out.append('];')
    return '\n'.join(out) + '\n'


def main():
    cur = open(OUT).read()
    block = BEGIN + '\n' + '\n'.join(entry(c) for c in load()) + '\n' + END
    if BEGIN in cur:
        head, rest = cur.split(BEGIN, 1)
        tail = rest.split(END, 1)[1]
        new = head + block + tail
    else:
        new = cur.rstrip('\n') + '\n' + block + '\n'
    if '--check' in sys.argv:
        ok = new == cur
        open(OUT, 'w').write(new); ts = ts_list(); open(OUT, 'w').write(cur)
        ok = ok and os.path.exists(TS_OUT) and open(TS_OUT).read() == ts
        sys.exit(0 if ok else 1)
    open(OUT, 'w').write(new)
    open(TS_OUT, 'w').write(ts_list())
    print('wrote', len(load()), 'chains')

main()
