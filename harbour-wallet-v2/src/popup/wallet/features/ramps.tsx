// Screens for feature "ramps": Fund menu, Buy/Sell/P2P/Recurring, Deposit from exchange, Ramp API keys.
import React, { useState } from 'react';
import type { Ctx } from '../screens';
import { Screen } from '../ui';
import { RampFlow } from './rampFlow';
import { FundScreen, FundCexScreen, FundCexPlatformScreen, FundCexAssetsScreen, FundCexQrScreen, RampApiKeysScreen, Tabs } from './rampFund';

const Buy: React.FC<Ctx> = (c) => <RampFlow {...c} />;
const Sell: React.FC<Ctx> = (c) => <RampFlow {...c} forced="sell" />;
/** TW /fiat-ramps: tabbed Buy | Sell. */
const FiatRamps: React.FC<Ctx> = (c) => {
  const [t, setT] = useState<'buy' | 'sell'>(c.params?.mode === 'sell' ? 'sell' : 'buy');
  return <Screen title="Buy & Sell" onBack={c.nav.pop}><Tabs value={t} onChange={setT} /><RampFlow key={t} {...c} forced={t} embedded /></Screen>;
};
export const SCREENS_ramps: Record<string, React.FC<Ctx>> = {
  fund: FundScreen, buy: Buy, sell: Sell, fiatRamps: FiatRamps,
  fundCex: FundCexScreen, fundCexPlatform: FundCexPlatformScreen, fundCexAssets: FundCexAssetsScreen, fundCexQr: FundCexQrScreen,
  rampApiKeys: RampApiKeysScreen,
};
