// Must be the background entry's FIRST import: the TON/Aptos SDKs touch the Node `Buffer` global while their modules evaluate,
// and an MV3 service worker has none (a throw here fails service-worker registration, status code 15).
import { Buffer } from 'buffer';

const g = globalThis as { Buffer?: unknown };
if (g.Buffer === undefined) g.Buffer = Buffer;
