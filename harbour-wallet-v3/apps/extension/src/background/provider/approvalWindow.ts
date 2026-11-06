// The approval window (TW: `/notification`; `/approval` manages token allowances): a small chrome.windows popup that hosts the extension UI at #/notification.
// One window serves every queued request; closing it rejects whatever is still pending.
import { PKEYS, type KV, type PendingStore } from '../../core/provider/store';

export interface WindowsApi {
  create(o: { url: string; type: 'popup'; width: number; height: number; left?: number; top?: number; focused: boolean }): Promise<{ id?: number } | undefined>;
  get(id: number): Promise<{ id?: number } | undefined>;
  update(id: number, o: { focused?: boolean; drawAttention?: boolean }): Promise<unknown>;
  remove(id: number): Promise<unknown>;
  getLastFocused(): Promise<{ left?: number; top?: number; width?: number } | undefined>;
}
export const APPROVAL_W = 375; export const APPROVAL_H = 600;

export class ApprovalWindow {
  private opening: Promise<void> | null = null;
  constructor(private w: WindowsApi, private kv: KV, private pending: PendingStore, private url: string) {}
  async windowId(): Promise<number | undefined> { return this.kv.get<number>(PKEYS.WINDOW); }
  open(): Promise<void> { return (this.opening ??= this.doOpen().finally(() => { this.opening = null; })); }
  private async doOpen(): Promise<void> {
    const id = await this.windowId();
    if (id !== undefined) { try { if (await this.w.get(id)) { await this.w.update(id, { focused: true, drawAttention: true }); return; } } catch { /* window is gone */ } }
    let left: number | undefined, top: number | undefined;
    try { const l = await this.w.getLastFocused(); if (l && l.left !== undefined && l.width !== undefined) { left = Math.max(0, l.left + l.width - APPROVAL_W - 16); top = Math.max(0, (l.top ?? 0) + 72); } } catch { /* default position */ }
    const created = await this.w.create({ url: this.url, type: 'popup', width: APPROVAL_W, height: APPROVAL_H, left, top, focused: true });
    if (created?.id !== undefined) await this.kv.set(PKEYS.WINDOW, created.id);
  }
  /** Close the window when nothing is waiting any more. */
  async closeIfIdle(): Promise<void> {
    if ((await this.pending.list()).some((p) => !p.internal)) return;
    const id = await this.windowId(); if (id === undefined) return;
    await this.kv.remove(PKEYS.WINDOW); try { await this.w.remove(id); } catch { /* already closed */ }
  }
  /** Returns true when the removed window was ours (the caller then rejects the leftovers). */
  async handleRemoved(id: number): Promise<boolean> { if ((await this.windowId()) !== id) return false; await this.kv.remove(PKEYS.WINDOW); return true; }
}
