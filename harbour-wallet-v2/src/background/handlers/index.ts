// Pluggable background message handlers. The core router (background/index.ts) keeps wallet/vault/balance/swap cases;
// every other feature registers its messages in its own module here, so features stay modular and independently testable.
import type { HandlerMap } from './types';
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

const ALL: HandlerMap = { ...provider, ...chainSend, ...chainData, ...earn, ...nfts, ...ramps, ...discover, ...onboardingExtra, ...settingsExtra, ...walletconnect, ...ledger, ...kitEvents, ...perps, ...predictions, ...approvals };
export const allExtraHandlers = (): HandlerMap => ALL;
