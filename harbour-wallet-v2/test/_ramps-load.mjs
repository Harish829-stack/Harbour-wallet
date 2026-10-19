// Test helper: bundles a core entry with esbuild (same pattern as test/history.test.js) and returns its exports.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
export async function load(entry) {
  const dir = fileURLToPath(new URL('../src/core/', import.meta.url));
  const out = await build({ stdin: { contents: `export * from '${entry}';`, resolveDir: dir, sourcefile: 'entry.ts', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}
export const jsonRes = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
export const fakeFetch = (routes, calls = []) => async (url, init = {}) => {
  calls.push({ url: String(url), init });
  for (const [m, fn] of routes) if (String(url).includes(m)) return fn(String(url), init);
  return jsonRes({}, 404);
};
