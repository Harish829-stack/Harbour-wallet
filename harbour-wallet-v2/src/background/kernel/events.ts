// Event registry: every background message is a named event in the INTERNAL_ (popup only) or PUBLIC_ (provider port) namespace (plan A1/A2).
export type EventCtx = { sender: any; [k: string]: any };
export type EventHandler = (msg: any, ctx: EventCtx) => Promise<any> | any;
export type Namespace = 'INTERNAL' | 'PUBLIC';

const registry = new Map<string, EventHandler>();
export const eventName = (ns: Namespace, name: string) => `${ns}_${name}`;

export function registerEvent(ns: Namespace, name: string, handler: EventHandler): void {
  const key = eventName(ns, name);
  if (registry.has(key)) throw new Error(`duplicate event ${key}`);
  registry.set(key, handler);
}
export function registerEvents(ns: Namespace, map: Record<string, EventHandler>): void {
  for (const [name, h] of Object.entries(map)) registerEvent(ns, name, h);
}
export const hasEvent = (ns: Namespace, name: string) => registry.has(eventName(ns, name));
export const listEvents = () => [...registry.keys()];

// Senders outside our own UI must never be able to claim internal status (mirrors TW stripExternalTrustFlags).
export function stripExternalFlags<T extends Record<string, any>>(msg: T): T {
  const copy: Record<string, any> = { ...msg };
  delete copy.isInternal; delete copy.source; delete copy.internal;
  return copy as T;
}

export async function dispatchEvent(ns: Namespace, name: string, msg: any, ctx: EventCtx): Promise<any> {
  const h = registry.get(eventName(ns, name));
  if (!h) return undefined; // caller falls back to the legacy router
  try { return await h(msg, ctx); } catch (e: any) { return { ok: false, error: e?.message ?? 'handler failed' }; }
}
