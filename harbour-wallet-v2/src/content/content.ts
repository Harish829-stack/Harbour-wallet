// Harbour content script (ISOLATED world, document_start, all frames). It is a narrow, validating relay between the page's provider (MAIN world)
// and the background provider router:
//   page  --MessageChannel-->  content  --runtime port "harbour-provider"-->  background
// Rules: strict request schema + method allowlist before anything is forwarded; the page can never choose the sender identity (the browser reports
// origin/tab/frame for the port); responses/events go back only over the private channel; page payloads are never sent to the internal wallet router
// (that router rejects content scripts by sender URL; this script never calls runtime.sendMessage).
import { isAllowedEvent, parsePageRequest, type OutMessage, type PageRequest } from '../core/provider/protocol';
import { specFor, UNSUPPORTED_EVM } from '../core/provider/methods';
import { ERR } from '../core/provider/errors';
import { isBlockedDomain } from '../core/provider/origin';

const HELLO = 'HARBOUR_INPAGE_HELLO';
const PORT_NAME = 'harbour-provider';
const MAX_INFLIGHT = 200;

(function main() {
  if (!window.isSecureContext || isBlockedDomain(location.hostname)) return;
  let page: MessagePort | null = null;
  let bg: chrome.runtime.Port | null = null;
  let lastInit: OutMessage | null = null;
  let retry = 0; let dead = false;
  const inflight = new Map<string, PageRequest>();

  const toPage = (m: OutMessage) => { try { page?.postMessage(m); } catch { /* page gone */ } };
  const reply = (id: string, code: number, message: string) => toPage({ t: 'res', id, error: { code, message } });

  function onBackground(m: any) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'res' && typeof m.id === 'string') {
      if (!inflight.delete(m.id)) return;
      if (m.error && typeof m.error === 'object') toPage({ t: 'res', id: m.id, error: { code: Number(m.error.code) || ERR.INTERNAL, message: String(m.error.message ?? 'Request failed').slice(0, 500), ...(m.error.data !== undefined ? { data: m.error.data } : {}) } });
      else toPage({ t: 'res', id: m.id, result: m.result });
    } else if (m.t === 'evt' && isAllowedEvent(m.ns, m.name)) toPage({ t: 'evt', ns: m.ns, name: m.name, data: m.data });
    else if (m.t === 'init' && m.state && typeof m.state === 'object') { lastInit = { t: 'init', state: m.state }; toPage(lastInit); }
  }
  function connect() {
    if (dead || bg) return;
    try {
      if (!chrome.runtime?.id) throw new Error('invalidated');
      const port = chrome.runtime.connect({ name: PORT_NAME }); bg = port; retry = 0;
      port.onMessage.addListener(onBackground);
      port.onDisconnect.addListener(() => {
        void chrome.runtime?.lastError; bg = null;
        if (dead) return;
        // Service worker restart (or extension update): reconnect straight away only if something is still unanswered (the background de-duplicates by
        // request id); an idle page reconnects lazily on its next request / when it becomes visible, so idle tabs never keep waking the worker.
        if (inflight.size === 0) return;
        const delay = Math.min(2000, 100 * 2 ** Math.min(retry++, 5));
        setTimeout(() => { connect(); }, delay);
      });
      for (const req of inflight.values()) { try { port.postMessage({ t: 'req', ...req }); } catch { /* retried on next reconnect */ } }
    } catch {
      bg = null;
      if (++retry > 6 || !chrome.runtime?.id) { dead = true; for (const id of inflight.keys()) reply(id, ERR.INTERNAL, 'Harbour was reloaded or updated. Refresh this page.'); inflight.clear(); toPage({ t: 'fatal', message: 'Harbour was reloaded or updated. Refresh this page.' } as any); return; }
      setTimeout(connect, 200 * retry);
    }
  }

  function onPageMessage(ev: MessageEvent) {
    const parsed = parsePageRequest(ev.data);
    if (!parsed.ok) { if (parsed.id) reply(parsed.id, parsed.error.code, parsed.error.message); return; }
    const req = parsed.req;
    if (inflight.has(req.id)) { reply(req.id, ERR.INVALID_REQUEST, 'Duplicate request id.'); return; }
    if (req.ns === 'evm' && UNSUPPORTED_EVM.has(req.method)) { reply(req.id, ERR.UNSUPPORTED_METHOD, `Harbour does not support ${req.method}.`); return; }
    if (!specFor(req.ns, req.method)) { reply(req.id, ERR.METHOD_NOT_FOUND, `The method ${req.method} does not exist or is not available.`); return; }
    if (inflight.size >= MAX_INFLIGHT) { reply(req.id, ERR.LIMIT_EXCEEDED, 'Too many pending requests.'); return; }
    inflight.set(req.id, req);
    if (bg) { try { bg.postMessage({ t: 'req', ...req }); } catch { /* reconnect will resend */ } } else connect();
  }

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window || !e.data || e.data.type !== HELLO || e.ports.length !== 1) return;
    if (location.origin !== 'null' && e.origin !== location.origin) return;
    if (typeof e.data.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(e.data.nonce)) return; // handshake must carry the page load's nonce
    if (page) return; // first channel wins (the provider keeps offering new ones until it is acknowledged)
    page = e.ports[0]; page.onmessage = onPageMessage;
    try { page.postMessage({ t: 'ack', nonce: e.data.nonce }); } catch { /* ignore */ }
    if (lastInit) toPage(lastInit);
    connect();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !bg && !dead) connect(); });
  connect();
})();
