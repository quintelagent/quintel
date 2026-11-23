/**
 * Deterministic elementary functions.
 *
 * Browsers are allowed to implement Math.exp / Math.log with slightly different
 * last-bit rounding. To guarantee byte-identical results in every JS engine we
 * use straight ports of fdlibm's __ieee754_exp and __ieee754_log, which only use
 * +, -, *, / (all exactly rounded by IEEE-754) and bit manipulation.
 * Math.sqrt is IEEE-exact everywhere and may be used directly.
 */

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
const i32 = new Int32Array(f64.buffer);
const LE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const HI = LE ? 1 : 0;
const LO = LE ? 0 : 1;

// ---------- log ----------
const ln2_hi = 6.93147180369123816490e-1;
const ln2_lo = 1.90821492927058770002e-10;
const two54 = 1.8014398509481984e16;
const Lg1 = 6.666666666666735130e-1;
const Lg2 = 3.999999999940941908e-1;
const Lg3 = 2.857142874366239149e-1;
const Lg4 = 2.222219843214978396e-1;
const Lg5 = 1.818357216161805012e-1;
const Lg6 = 1.531383769920937332e-1;
const Lg7 = 1.479819860511658591e-1;

export function dlog(x: number): number {
  f64[0] = x;
  let hx = i32[HI];
  const lx = u32[LO];
  let k = 0;
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= two54;
    f64[0] = x;
    hx = i32[HI];
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  f64[0] = x;
  i32[HI] = hx | (i ^ 0x3ff00000);
  x = f64[0];
  k += i >> 20;
  const f = x - 1.0;
  let dk: number;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) {
      if (k === 0) return 0;
      dk = k;
      return dk * ln2_hi + dk * ln2_lo;
    }
    const R = f * f * (0.5 - 0.33333333333333333 * f);
    if (k === 0) return f - R;
    dk = k;
    return dk * ln2_hi - ((R - dk * ln2_lo) - f);
  }
  const s = f / (2.0 + f);
  dk = k;
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * ln2_hi - ((hfsq - (s * (hfsq + R) + dk * ln2_lo)) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * ln2_hi - ((s * (f - R) - dk * ln2_lo) - f);
}

// ---------- exp ----------
const o_threshold = 7.09782712893383973096e2;
const u_threshold = -7.45133219101941108420e2;
const invln2 = 1.44269504088896338700e0;
const twom1000 = 9.33263618503218878990e-302;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;

export function dexp(x: number): number {
  f64[0] = x;
  let hx = u32[HI];
  const xsb = (hx >>> 31) & 1;
  hx &= 0x7fffffff;
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | u32[LO]) !== 0) return x + x;
      return xsb === 0 ? x : 0.0;
    }
    if (x > o_threshold) return Infinity;
    if (x < u_threshold) return 0;
  }
  if (hx > 0x3fd62e42) {
    if (hx < 0x3ff0a2b2) {
      if (xsb === 0) {
        hi = x - ln2_hi;
        lo = ln2_lo;
        k = 1;
      } else {
        hi = x + ln2_hi;
        lo = -ln2_lo;
        k = -1;
      }
    } else {
      k = Math.trunc(invln2 * x + (xsb === 0 ? 0.5 : -0.5));
      const t = k;
      hi = x - t * ln2_hi;
      lo = t * ln2_lo;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    return 1.0 + x;
  } else {
    k = 0;
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1.0 - ((x * c) / (c - 2.0) - x);
  let y = 1.0 - ((lo - (x * c) / (2.0 - c)) - hi);
  if (k >= -1021) {
    f64[0] = y;
    i32[HI] = i32[HI] + (k << 20);
    return f64[0];
  }
  f64[0] = y;
  i32[HI] = i32[HI] + ((k + 1000) << 20);
  y = f64[0];
  return y * twom1000;
}

export const dsqrt = Math.sqrt;

/** Round to 6 decimals (exact IEEE ops only). */
export function r6(x: number): number {
  if (!Number.isFinite(x)) throw new Error('non-finite value in output');
  const v = Math.round(x * 1e6) / 1e6;
  return v === 0 ? 0 : v; // normalise -0
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
