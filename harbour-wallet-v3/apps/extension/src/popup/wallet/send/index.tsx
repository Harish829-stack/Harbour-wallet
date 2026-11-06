import React from 'react';
import type { Ctx } from '../screens';
import { SendSelect } from './select';
import { SendPrepare } from './prepare';
import { ReceiveScreen } from './receive';
/** `/send` shows the asset list; `/send/:assetId` (params.assetId) goes straight to Prepare. */
export const SendScreen: React.FC<Ctx> = (c) => (c.params?.assetId ? <SendPrepare {...c} /> : <SendSelect {...c} />);
export { ReceiveScreen };
