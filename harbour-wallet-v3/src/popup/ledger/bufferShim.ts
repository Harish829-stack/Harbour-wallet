// Buffer global for the Ledger libraries in extension pages. Imported first by device.ts.
import { Buffer } from 'buffer';
const g = globalThis as { Buffer?: unknown };
if (g.Buffer === undefined) g.Buffer = Buffer;
