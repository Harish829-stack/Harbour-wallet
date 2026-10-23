// Screens for feature "send": register { screenName: Component } here; they are merged into the wallet's SCREENS registry.
// Implementation lives in popup/wallet/send/*; `send` with params.assetId opens Prepare directly (callers such as wallet migration use it).
import type React from 'react';
import type { Ctx } from '../types';
import { SendScreen } from '../send';
import { SendSelect } from '../send/select';
import { SendPrepare } from '../send/prepare';
import { SendConfirm } from '../send/confirm';
import { TransactionScreen } from '../send/transaction';
import { ReceiveScreen, ReceiveSelect, ReceiveChain, ReceiveAsset } from '../send/receive';
import { SendNft, SendBridge, SendInscriptions, SendInscribe } from '../send/extras';
export const SCREENS_send: Record<string, React.FC<Ctx>> = {
  send: SendScreen, sendSelect: SendSelect, sendPrepare: SendPrepare, sendConfirm: SendConfirm, sendNft: SendNft, sendBridge: SendBridge, sendInscriptions: SendInscriptions, sendInscribe: SendInscribe,
  receive: ReceiveScreen, receiveSelect: ReceiveSelect, receiveChain: ReceiveChain, receiveAsset: ReceiveAsset, transaction: TransactionScreen,
};
