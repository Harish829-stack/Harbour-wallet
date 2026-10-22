// Service-worker wiring for the activity engine: durable storage, the broadcast tap that records every EVM transaction this wallet
// sends, and the alarm that settles pending transactions while no popup is open.
import browser from 'webextension-polyfill';
import { local } from '../core/storage';
import { startActivityEngine } from '../core/activity/index';
import { installBroadcastTap } from '../core/activity/broadcastTap';

export const ACTIVITY_PENDING_ALARM = 'harbour:activity-pending';
const store = { get: <T,>(k: string) => local.get<T>(k), set: (k: string, v: unknown) => local.set(k, v) };
export const activityEngine = () => startActivityEngine(store, (has) => {
  if (has) void browser.alarms.create(ACTIVITY_PENDING_ALARM, { delayInMinutes: 0.5, periodInMinutes: 1 }); else void browser.alarms.clear(ACTIVITY_PENDING_ALARM);
});
/** Call once, AFTER installFailoverFetch(), so the tap observes the final response of every broadcast. */
export const startActivityRecording = (): void => { activityEngine(); installBroadcastTap((info) => activityEngine().recordBroadcast(info)); };
export const reconcilePendingActivity = (): Promise<void> => activityEngine().reconcilePending().catch(() => undefined);
