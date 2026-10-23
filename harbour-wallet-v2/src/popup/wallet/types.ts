// Shared contracts for wallet screens. Lives apart from screens.tsx so feature modules can import types without depending on the screen registry.
export type Nav = { push: (name: string, params?: any) => void; pop: () => void; home: () => void; lock?: () => void; backup?: () => void };
export interface Account { derivationIndex: number; name: string; addresses: Record<string, string> }
export interface Ctx { addrs: Record<string, string>; balances: Record<string, any>; bg: (m: any) => Promise<any>; params: any; nav: Nav; accounts?: Account[]; activeAccount?: number; hiddenAssets?: string[]; networkFilter?: string | null; refresh?: () => void }
