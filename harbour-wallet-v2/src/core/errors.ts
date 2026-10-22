// User-facing error text. Never shows stacks, URLs or provider details.
const NETWORK = /fetch|network|timeout|timed out|abort|429|rate.?limit|503|502|504|circuit open|failed to load|offline|ECONN/i;
export function friendlyMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (NETWORK.test(m)) return 'The network is unreachable or busy right now. Please check your connection and try again.';
  return 'Something went wrong. Your funds and recovery phrase are safe. Please try again.';
}
