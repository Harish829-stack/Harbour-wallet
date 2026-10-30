// HW-2026-004 (CCSS D-01): a new wallet must not be shown an address to receive or buy into until its secret phrase is backed up.
// Every route that reveals a deposit address or starts a fiat/exchange deposit is redirected to the backup flow while the
// active wallet is flagged `seedPhraseBackupRequired`.
export const FUNDING_ROUTES: ReadonlySet<string> = new Set(['receive', 'receiveChain', 'receiveAsset', 'fund', 'fundCex', 'fundCexAssets', 'fundCexQr', 'buy']);

export type Route = { name: string; params?: any };

export function gateRoute(route: Route, backupRequired: boolean): Route {
  if (!backupRequired || !FUNDING_ROUTES.has(route.name)) return route;
  return { name: 'backup', params: { required: true, reason: 'receive' } };
}
