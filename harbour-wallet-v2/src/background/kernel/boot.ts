import { logWarn } from '../../core/logger';
// Boot loop, persisted work queue and WASM self-heal guard (plan A6).
import browser from 'webextension-polyfill';
import { local } from '../../core/storage';

export const BOOT_MAX_ATTEMPTS = 20;
export const BOOT_RETRY_MS = 2000;
const HEAL_KEY = 'wallet:selfHeal';
const HEAL_GUARD_MS = 60 * 60 * 1000; // at most one self-heal reload per hour
const QUEUE_KEY = 'wallet:queue';

type Step = { name: string; run: () => Promise<unknown> };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs the boot steps in order; each step is retried up to BOOT_MAX_ATTEMPTS. Resolves when all succeed, rejects after the last failure. */
export async function bootWith(steps: Step[], attempts = BOOT_MAX_ATTEMPTS, delayMs = BOOT_RETRY_MS): Promise<void> {
  for (const step of steps) {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try { await step.run(); last = undefined; break; } catch (e) { last = e; if (i < attempts - 1) await sleep(delayMs); }
    }
    if (last !== undefined) throw new Error(`boot step "${step.name}" failed: ${(last as Error)?.message ?? last}`);
  }
}

/** Reloads the extension once per hour when the WASM runtime desyncs (e.g. after an update killed the worker mid-call). */
export async function selfHeal(reason: string): Promise<boolean> {
  const last = (await local.get<number>(HEAL_KEY)) ?? 0;
  if (Date.now() - last < HEAL_GUARD_MS) return false;
  await local.set(HEAL_KEY, Date.now());
  logWarn('self-heal reload', reason);
  browser.runtime.reload();
  return true;
}

// Persisted queue: jobs survive worker restarts and are replayed on boot (onApplicationBoot).
export type Job = { id: string; kind: string; payload?: unknown; createdAt: number };
const handlers = new Map<string, (job: Job) => Promise<void>>();
export const queue = {
  register(kind: string, fn: (job: Job) => Promise<void>) { handlers.set(kind, fn); },
  async list(): Promise<Job[]> { return (await local.get<Job[]>(QUEUE_KEY)) ?? []; },
  async enqueue(kind: string, payload?: unknown): Promise<Job> {
    const job: Job = { id: crypto.randomUUID(), kind, payload, createdAt: Date.now() };
    await local.set(QUEUE_KEY, [...(await queue.list()), job]);
    return job;
  },
  async drain(): Promise<void> {
    for (const job of await queue.list()) {
      const fn = handlers.get(job.kind);
      if (!fn) continue; // keep jobs whose handler is not registered yet
      try { await fn(job); } catch { continue; } // keep failed jobs for the next boot
      await local.set(QUEUE_KEY, (await queue.list()).filter((j) => j.id !== job.id));
    }
  },
};
