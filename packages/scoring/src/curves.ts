import type { Curve } from "./types";

/**
 * Piecewise-linear interpolation. Below the first breakpoint the first value
 * applies; beyond the last breakpoint the last value applies.
 */
export function interpolate(curve: Curve, x: number): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Mean of valid 1-5 answers, or null when none. */
export function meanRating(values: Array<number | null | undefined>): number | null {
  const v = values.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 5);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** (mean - 1) / 4, per PRD 6.3. */
export const normaliseRating = (mean: number) => (mean - 1) / 4;
