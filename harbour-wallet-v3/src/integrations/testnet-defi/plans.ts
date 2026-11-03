/** Worker-only review storage: the popup can submit an ID, never arbitrary calldata. */
export class ReviewStore<T extends { expiresAt: number; owner: string }> {
  private readonly plans = new Map<string, T>();
  put(id: string, plan: T, now = Date.now()): void {
    for (const [key, value] of this.plans) if (value.expiresAt <= now) this.plans.delete(key);
    if (this.plans.size >= 30) throw new Error('Too many pending reviews. Wait a moment and try again.');
    this.plans.set(id, plan);
  }
  take(id: string, owner: string, now = Date.now()): T {
    const plan = this.plans.get(id);
    if (!plan || plan.expiresAt <= now) { this.plans.delete(id); throw new Error('This review expired. Review the transaction again.'); }
    if (plan.owner !== owner) throw new Error('Your active account changed. Review the transaction again.');
    this.plans.delete(id); // Single use, including failed attempts; prevents replay/double-clicks.
    return plan;
  }
}
