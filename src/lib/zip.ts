// Minimal ZIP writer: STORE method (no compression), CRC-32, UTF-8 names, no dependencies.
// Enough for text bundles; every archive opens in Finder, Explorer, unzip and git tooling.

export interface ZipEntry {
  /** Path inside the archive; forward slashes, never absolute, never containing '..'. */
  name: string;
  data: string | Uint8Array;
  /** Stored modification time; defaults to now. */
  modified?: Date;
}

let TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c >>> 0;
  }
  return TABLE;
}

export function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Normalise an archive path. Throws on anything that could escape the extraction folder. */
export function safeZipName(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/").filter((p) => p !== "" && p !== ".");
  if (!parts.length || parts.some((p) => p === ".." || /[\u0000-\u001f]/.test(p) || /^[A-Za-z]:$/.test(p))) throw new Error(`Unsafe file name in archive: ${name}`);
  return parts.join("/");
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length > 0xfffe) throw new Error("Too many files for a ZIP archive.");
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const prepared = entries.map((entry) => {
    const name = safeZipName(entry.name);
    if (seen.has(name)) throw new Error(`Duplicate file in archive: ${name}`);
    seen.add(name);
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    if (data.length > 0xfffffff0) throw new Error("File too large for a ZIP archive.");
    return { name: encoder.encode(name), data, crc: crc32(data), stamp: dosDateTime(entry.modified ?? new Date()) };
  });

  let total = 22;
  for (const p of prepared) total += 30 + p.name.length + p.data.length + 46 + p.name.length;
  if (total > 0xfffffff0) throw new Error("Archive too large.");
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => { view.setUint16(at, v, true); at += 2; };
  const u32 = (v: number) => { view.setUint32(at, v, true); at += 4; };

  const offsets: number[] = [];
  for (const p of prepared) {
    offsets.push(at);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(p.stamp.time); u16(p.stamp.date);
    u32(p.crc); u32(p.data.length); u32(p.data.length); u16(p.name.length); u16(0);
    out.set(p.name, at); at += p.name.length;
    out.set(p.data, at); at += p.data.length;
  }
  const centralStart = at;
  prepared.forEach((p, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(p.stamp.time); u16(p.stamp.date);
    u32(p.crc); u32(p.data.length); u32(p.data.length); u16(p.name.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(offsets[i]);
    out.set(p.name, at); at += p.name.length;
  });
  const centralSize = at - centralStart;
  u32(0x06054b50); u16(0); u16(0); u16(prepared.length); u16(prepared.length); u32(centralSize); u32(centralStart); u16(0);
  return out;
}
