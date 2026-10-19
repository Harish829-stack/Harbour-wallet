import type { VaultService } from '../../core/vaultService';
import type { WalletService } from '../../core/walletService';
export interface HandlerCtx { core: any; vault: VaultService; wallet: WalletService; sender: any }
export type Msg = { type: string; [k: string]: any };
export type Handler = (msg: Msg, ctx: HandlerCtx) => Promise<any> | any;
export type HandlerMap = Record<string, Handler>;
