// Smart account messages (UI only: the router enforces isInternalWalletSender before dispatch, so a web page can never reach them).
// Approve and Reject carry only a requestId. See background/smartAccountService.ts and documentation/smart-accounts.
import type { HandlerMap } from './types';
import * as svc from '../smartAccountService';

export const handlers: HandlerMap = {
  smartAccountStatus: (m, ctx) => svc.status(ctx, { chainId: m.chainId }),
  smartAccountGrants: (_m, ctx) => svc.grants(ctx),
  smartAccountPrepare: (m, ctx) => svc.prepare(ctx, { kind: m.kind, chainId: m.chainId, grantId: m.grantId }),
  smartAccountApprove: (m, ctx) => svc.approve(ctx, { requestId: m.requestId }),
  smartAccountReject: (m) => svc.reject({ requestId: m.requestId }),
};
