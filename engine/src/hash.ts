/** Canonical JSON + Keccak-256 (pure TS, zero deps). */

const RC_HI = [
  0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000,
  0x80000000, 0x80000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000,
];
const RC_LO = [
  0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001, 0x80008081, 0x00008009,
  0x0000008a, 0x00000088, 0x80008009, 0x8000000a, 0x8000808b, 0x0000008b, 0x00008089, 0x00008003,
  0x00008002, 0x00000080, 0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008,
];
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const PI_DEST: number[] = [];
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) PI_DEST[x + 5 * y] = y + 5 * ((2 * x + 3 * y) % 5);

function keccakF(lo: Int32Array, hi: Int32Array) {
  const cLo = new Int32Array(5), cHi = new Int32Array(5);
  const bLo = new Int32Array(25), bHi = new Int32Array(25);
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) {
      cLo[x] = lo[x] ^ lo[x + 5] ^ lo[x + 10] ^ lo[x + 15] ^ lo[x + 20];
      cHi[x] = hi[x] ^ hi[x + 5] ^ hi[x + 10] ^ hi[x + 15] ^ hi[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const nLo = cLo[(x + 1) % 5], nHi = cHi[(x + 1) % 5];
      const dLo = cLo[(x + 4) % 5] ^ ((nLo << 1) | (nHi >>> 31));
      const dHi = cHi[(x + 4) % 5] ^ ((nHi << 1) | (nLo >>> 31));
      for (let y = 0; y < 25; y += 5) {
        lo[x + y] ^= dLo;
        hi[x + y] ^= dHi;
      }
    }
    for (let i = 0; i < 25; i++) {
      let l = lo[i], h = hi[i];
      let n = ROT[i];
      if (n >= 32) {
        const t = l; l = h; h = t; n -= 32;
      }
      let rl = l, rh = h;
      if (n !== 0) {
        rl = (l << n) | (h >>> (32 - n));
        rh = (h << n) | (l >>> (32 - n));
      }
      bLo[PI_DEST[i]] = rl;
      bHi[PI_DEST[i]] = rh;
    }
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        lo[x + y] = bLo[x + y] ^ (~bLo[((x + 1) % 5) + y] & bLo[((x + 2) % 5) + y]);
        hi[x + y] = bHi[x + y] ^ (~bHi[((x + 1) % 5) + y] & bHi[((x + 2) % 5) + y]);
      }
    }
    lo[0] ^= RC_LO[round];
    hi[0] ^= RC_HI[round];
  }
}

export function keccak256Bytes(data: Uint8Array): Uint8Array {
  const rate = 136;
  const lo = new Int32Array(25), hi = new Int32Array(25);
  const padLen = rate - (data.length % rate);
  const msg = new Uint8Array(data.length + padLen);
  msg.set(data);
  msg[data.length] ^= 0x01;
  msg[msg.length - 1] ^= 0x80;
  for (let off = 0; off < msg.length; off += rate) {
    for (let j = 0; j < rate; j++) {
      const lane = j >> 3, k = j & 7;
      if (k < 4) lo[lane] ^= msg[off + j] << (8 * k);
      else hi[lane] ^= msg[off + j] << (8 * (k - 4));
    }
    keccakF(lo, hi);
  }
  const out = new Uint8Array(32);
  for (let j = 0; j < 32; j++) {
    const lane = j >> 3, k = j & 7;
    out[j] = k < 4 ? (lo[lane] >>> (8 * k)) & 0xff : (hi[lane] >>> (8 * (k - 4))) & 0xff;
  }
  return out;
}

export function toHex(b: Uint8Array): string {
  let s = '0x';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

export function keccak256(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return toHex(keccak256Bytes(bytes));
}

/** Canonical JSON: sorted keys, no whitespace, finite numbers only. */
export function canonical(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('canonical: non-finite number');
    return JSON.stringify(v === 0 ? 0 : v);
  }
  if (typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
  if (ArrayBuffer.isView(v)) return canonical(Array.from(v as unknown as ArrayLike<number>));
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  throw new Error('canonical: unsupported type ' + typeof v);
}

export function hashObject(v: unknown): string {
  return keccak256(canonical(v));
}
