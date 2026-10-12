/** A round number at or above `v`: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p + 1e-9) return m * p;
  return 10 * p;
}

/** About `count` evenly spaced round ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const step = niceCeil(raw);
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v < hi + step - 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Linear scale from a domain to a range. */
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

/** An SVG path through points. */
export const linePath = (pts: Array<[number, number]>) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
