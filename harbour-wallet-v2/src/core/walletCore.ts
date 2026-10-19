import { initWasm } from '@trustwallet/wallet-core';
let corePromise: Promise<any> | undefined;
export function getCore(): Promise<any> { return (corePromise ??= (initWasm as any)()); }
