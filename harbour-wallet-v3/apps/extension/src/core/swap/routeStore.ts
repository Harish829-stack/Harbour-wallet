// Worker-held swap routes (audit H3/M5). The popup only ever gets copies of routes to display and sends back the route id;
// everything that decides what is signed (the route, the user's slippage at quote time, the owner, expiry) stays here.
import type { SwapRoute } from './types';
import { swapError } from './errors';

export interface HeldRoute {
  route: SwapRoute;
  /** Slippage (percent) the quote was requested with, already normalised and capped. */
  slippagePct: number;
  /** The selling account's address when the quote was made. */
  owner: string;
  /** Worker clock; after this the route must be quoted again. */
  expiresAt: number;
  /** One-shot confirmation issued by preview() and required by approve()/submit(). */
  confirm?: { id: string; expiresAt: number };
  /** History entry created by the approval step, reused by the swap step. */
  historyId?: string;
}

/** Extra time after the quote's own expiry during which a confirmed route may still be sent (the fresh transaction is re-checked). */
export const ROUTE_GRACE_MS = 5 * 60_000;
export const CONFIRM_TTL_MS = 3 * 60_000;
const MAX_ROUTES = 60;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class SwapRouteStore {
  private readonly routes = new Map<string, HeldRoute>();
  private busy = false;

  /** Store routes under ids minted here; returns display copies carrying those ids. */
  put(routes: SwapRoute[], o: { slippagePct: number; owner: string }, now = Date.now()): SwapRoute[] {
    this.prune(now);
    return routes.map((r) => {
      const id = crypto.randomUUID();
      const held: SwapRoute = clone({ ...r, id });
      this.routes.set(id, { route: held, slippagePct: o.slippagePct, owner: o.owner.toLowerCase(), expiresAt: held.expiresAt + ROUTE_GRACE_MS });
      while (this.routes.size > MAX_ROUTES) this.routes.delete(this.routes.keys().next().value as string);
      return clone(held);
    });
  }

  /** A held route for this owner, or a "quote again" error. The returned route is a private copy. */
  get(id: unknown, owner: string, now = Date.now()): HeldRoute {
    const h = typeof id === 'string' ? this.routes.get(id) : undefined;
    if (!h || h.expiresAt <= now) { if (typeof id === 'string') this.routes.delete(id); throw swapError('price_moved'); }
    if (h.owner !== owner.toLowerCase()) throw swapError('price_moved');
    return h;
  }

  /** Read without checks (to find which account a route belongs to). */
  peek(id: unknown): HeldRoute | undefined { return typeof id === 'string' ? this.routes.get(id) : undefined; }

  /** preview() passed: issue a fresh confirmation id for this route. */
  issueConfirm(id: string, now = Date.now()): string {
    const h = this.routes.get(id); if (!h) throw swapError('price_moved');
    h.confirm = { id: crypto.randomUUID(), expiresAt: now + CONFIRM_TTL_MS };
    return h.confirm.id;
  }

  /** The confirmation must match the last preview of this route. */
  checkConfirm(h: HeldRoute, confirmId: unknown, now = Date.now()): void {
    if (!h.confirm || typeof confirmId !== 'string' || h.confirm.id !== confirmId || h.confirm.expiresAt <= now) throw swapError('price_moved');
  }

  /** Single use: a submitted route (successful or not) can never be sent again. */
  consume(id: string): void { this.routes.delete(id); }

  /** One signing flow at a time (double clicks, two popups). */
  async exclusive<T>(f: () => Promise<T>): Promise<T> {
    if (this.busy) throw swapError('busy');
    this.busy = true;
    try { return await f(); } finally { this.busy = false; }
  }

  private prune(now: number) { for (const [k, v] of this.routes) if (v.expiresAt <= now) this.routes.delete(k); }
}
