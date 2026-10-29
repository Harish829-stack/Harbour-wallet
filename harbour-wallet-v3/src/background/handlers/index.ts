// Pluggable background message handlers. The core router (background/index.ts) keeps wallet/vault/balance/swap cases;
// every other feature registers its messages in its own module here, so features stay modular and independently testable.
import type { Msg, HandlerCtx, HandlerMap } from './types';
import { handlers as provider } from './provider';
import { handlers as chainSend } from './chainSend';
import { handlers as chainData } from './chainData';
import { handlers as earn } from './earn';
import { handlers as nfts } from './nfts';
import { handlers as ramps } from './ramps';
import { handlers as discover } from './discover';
import { handlers as onboardingExtra } from './onboardingExtra';
import { handlers as settingsExtra } from './settingsExtra';
import { handlers as walletconnect } from './walletconnect';
import { handlers as ledger } from './ledger';
import { handlers as kitEvents } from './kitEvents';
import { handlers as perps } from './perps';
import { handlers as predictions } from './predictions';
import { handlers as approvals } from './approvals';
import { handlers as secrets } from './secrets';
import { featureEnabled } from '../../core/harbour/policy';

// Value-moving third-party features are registered only when core/harbour/policy.ts enables them (off in the testnet-only build).
const on = (f: Parameters<typeof featureEnabled>[0], m: HandlerMap): HandlerMap => (featureEnabled(f) ? m : {});
const ALL: HandlerMap = { ...provider, ...chainSend, ...chainData, ...on('earn', earn), ...nfts, ...on('ramps', ramps), ...discover, ...onboardingExtra, ...settingsExtra, ...on('walletconnect', walletconnect), ...ledger, ...kitEvents, ...on('perps', perps), ...on('predictions', predictions), ...approvals, ...secrets };
export const allExtraHandlers = (): HandlerMap => ALL;
export async function runExtraHandler(msg: Msg, ctx: HandlerCtx): Promise<any> {
  const h = Object.prototype.hasOwnProperty.call(ALL, msg.type) ? ALL[msg.type] : undefined;
  if (!h) return { error: 'unknown_message' };
  try { return await h(msg, ctx); } catch (e: any) { return { ok: false, error: e?.message ?? 'handler failed' }; }
}
