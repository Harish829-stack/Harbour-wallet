// EIP-1193 / EIP-1474 error codes and a tiny error type that survives structured cloning (code + message + optional data only).
export const ERR = {
  USER_REJECTED: 4001, UNAUTHORIZED: 4100, UNSUPPORTED_METHOD: 4200, DISCONNECTED: 4900, CHAIN_DISCONNECTED: 4901, UNRECOGNIZED_CHAIN: 4902,
  PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603,
  RESOURCE_NOT_FOUND: -32001, RESOURCE_UNAVAILABLE: -32002, LIMIT_EXCEEDED: -32005,
} as const;

const DEFAULT_MESSAGE: Record<number, string> = {
  4001: 'User rejected the request.',
  4100: 'The requested account and/or method has not been authorized by the user.',
  4200: 'The requested method is not supported by this provider.',
  4900: 'The provider is disconnected from all chains.',
  4901: 'The provider is disconnected from the specified chain.',
  4902: 'Unrecognized chain ID. Try adding the chain using wallet_addEthereumChain first.',
  [-32700]: 'Parse error.', [-32600]: 'Invalid request.', [-32601]: 'The method does not exist or is not available.',
  [-32602]: 'Invalid method parameter(s).', [-32603]: 'Internal error.',
  [-32001]: 'Requested resource not found.', [-32002]: 'Request already pending. Check the Harbour approval window.',
  [-32005]: 'Request limit exceeded.',
};

export class ProviderError extends Error {
  code: number; data?: unknown;
  constructor(code: number, message?: string, data?: unknown) { super(message ?? DEFAULT_MESSAGE[code] ?? 'Unknown error.'); this.name = 'ProviderError'; this.code = code; this.data = data; }
}

export interface WireError { code: number; message: string; data?: unknown }
const MAX_MSG = 300;
/** Convert anything thrown into a wire error. Non-provider errors become -32603 and never carry stack traces. */
export function serializeError(e: unknown): WireError {
  if (e instanceof ProviderError) return { code: e.code, message: e.message.slice(0, MAX_MSG), ...(e.data !== undefined ? { data: e.data } : {}) };
  const any = e as any;
  if (any && typeof any.code === 'number' && Number.isInteger(any.code) && typeof any.message === 'string' && (any.code === 4001 || any.code === 4100 || any.code === 4200 || (any.code <= -32000 && any.code >= -32099) || any.code === -32700 || any.code === -32600 || any.code === -32601 || any.code === -32602 || any.code === -32603))
    return { code: any.code, message: String(any.message).slice(0, MAX_MSG) };
  const msg = typeof any?.shortMessage === 'string' ? any.shortMessage : typeof any?.message === 'string' ? any.message : DEFAULT_MESSAGE[ERR.INTERNAL];
  return { code: ERR.INTERNAL, message: msg.slice(0, MAX_MSG) };
}
