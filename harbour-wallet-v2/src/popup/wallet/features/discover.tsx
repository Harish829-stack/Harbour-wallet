// Screens for feature "discover": dApp directory, market sentiment, help.
import React from 'react';
import type { Ctx } from '../types';
import { Screen, IconBtn } from '../ui';
import { DappsPanel } from './dappsPanel';
import { MarketSentimentScreen, HelpScreen } from './sentimentHelp';

export { DappsPanel };
const DiscoverScreen: React.FC<Ctx> = (c) => (
  <Screen title="Discover" onBack={c.nav.pop} right={<IconBtn icon="search" title="Search" onClick={() => c.nav.push('search')} />}><DappsPanel c={c} /></Screen>);
export const SCREENS_discover: Record<string, React.FC<Ctx>> = { discover: DiscoverScreen, marketSentiment: MarketSentimentScreen, help: HelpScreen };
