// Deterministic ZIP writer (store order sorted, fixed 1980-01-01 timestamps, deflate level 9, no extra fields), so the same dist/
// always yields byte-identical archives. Used by release.mjs and repro.mjs.
import * as zlib from 'node:zlib';
const { deflateRawSync } = zlib;
const TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = zlib.crc32 ?? ((buf) => { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }); // zlib.crc32 needs Node 22.2+
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === '.DS_Store' || name.startsWith('._')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base)); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}
export function zipDir(dir) {
  const files = listFiles(dir); const locals = []; const centrals = []; let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01 00:00
  for (const rel of files) {
    const data = readFileSync(path.join(dir, rel)); const name = Buffer.from(rel, 'utf8');
    const comp = deflateRawSync(data, { level: 9 }); const crc = crc32(data) >>> 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42); centrals.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return { zip: Buffer.concat([...locals, cd, end]), files };
}
