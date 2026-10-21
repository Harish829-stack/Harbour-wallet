import { failover } from '../failover';
import { gatewayEnabled, gatewayJson } from '../gateway';
import { coingeckoPrices, type SimplePrice } from '../providers/coingecko';
import { defillamaPrices } from '../providers/defillama';

/** USD prices by CoinGecko id: gateway (cached) -> CoinGecko -> DefiLlama. */
export async function getPrices(ids: string[]): Promise<Record<string, SimplePrice>> {
  if (!ids.length) return {};
  const slots = [
    ...(gatewayEnabled() ? [{ name: 'gateway', run: () => gatewayJson<Record<string, SimplePrice>>(`/v2/market/prices?ids=${ids.join(',')}`) }] : []),
    { name: 'coingecko', run: () => coingeckoPrices(ids) },
    { name: 'defillama', run: () => defillamaPrices(ids) },
  ];
  return (await failover(slots)).value;
}
