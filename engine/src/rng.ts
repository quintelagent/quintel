import { dlog, dexp, dsqrt } from './math';

/** splitmix32 — expands seed words into well-mixed PRNG state. */
function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

const INV32 = 2.3283064365386963e-10; // 2^-32

/**
 * xoshiro128** seeded PRNG plus normal (Marsaglia polar) and Poisson samplers.
 * 32-bit integer ops only => identical in every JS engine, no BigInt.
 */
export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private spare = 0;
  private hasSpare = false;

  /** seedHex: 16+ hex chars. stream: independent stream index (e.g. model id). */
  constructor(seedHex: string, stream = 0) {
    const a = parseInt(seedHex.slice(0, 8), 16) >>> 0;
    const b = parseInt(seedHex.slice(8, 16), 16) >>> 0;
    const sm = splitmix32((a ^ Math.imul(stream + 1, 0x85ebca6b)) >>> 0);
    const sm2 = splitmix32((b ^ Math.imul(stream + 1, 0xc2b2ae35)) >>> 0);
    this.s0 = sm() ^ sm2();
    this.s1 = sm() ^ sm2();
    this.s2 = sm() ^ sm2();
    this.s3 = sm() ^ sm2();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  nextU32(): number {
    const s1 = this.s1;
    const m = Math.imul(s1, 5);
    const result = Math.imul((m << 7) | (m >>> 25), 9) >>> 0;
    const t = s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = (this.s3 << 11) | (this.s3 >>> 21);
    return result;
  }

  /** Uniform in (0,1), never exactly 0 or 1. */
  uniform(): number {
    return (this.nextU32() + 0.5) * INV32;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.uniform() * n);
  }

  /** Standard normal via Marsaglia polar method (log + sqrt only). */
  normal(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    let u: number, v: number, s: number;
    do {
      u = 2 * this.uniform() - 1;
      v = 2 * this.uniform() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = dsqrt((-2 * dlog(s)) / s);
    this.spare = v * m;
    this.hasSpare = true;
    return u * m;
  }

  /** Poisson(lambda) via Knuth (lambda is small in our use: < 30). */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const L = dexp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.uniform();
    } while (p > L && k < 1000);
    return k - 1;
  }
}
