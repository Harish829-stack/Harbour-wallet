// Internal wallet commands are available only to our own extension documents.
// Content scripts share the extension ID, so ID alone is not an authorization check.
export function isInternalWalletSender(
  sender: { id?: string; url?: string; tab?: unknown },
  extensionId: string,
): boolean {
  if (sender.id !== extensionId || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'chrome-extension:' && url.hostname === extensionId &&
      url.pathname === '/src/popup/index.html';
  } catch {
    return false;
  }
}
