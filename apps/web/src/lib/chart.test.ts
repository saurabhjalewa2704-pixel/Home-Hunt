import { describe, expect, it } from "vitest";
import { linePath, niceCeil, niceTicks, scale } from "./chart";

describe("chart helpers", () => {
  it("niceCeil rounds up to 1, 2, 2.5, 5 or 10 times a power of ten", () => {
    expect([0.8, 1.2, 2.2, 3, 7, 130, 640_000].map(niceCeil)).toEqual([1, 2, 2.5, 5, 10, 200, 1_000_000]);
    expect(niceCeil(0)).toBe(1);
  });
  it("niceTicks covers the range with round steps", () => {
    const t = niceTicks(440_000, 660_000, 4);
    expect(t[0]).toBeLessThanOrEqual(440_000);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(660_000);
    expect(new Set(t.slice(1).map((v, i) => v - t[i])).size).toBe(1);
    expect(niceTicks(5, 5)).toEqual([5]);
  });
  it("scale maps a domain to a range, and a flat domain to the middle", () => {
    expect(scale(0, 10, 0, 100)(5)).toBe(50);
    expect(scale(0, 10, 100, 0)(2)).toBe(80);
    expect(scale(3, 3, 0, 100)(3)).toBe(50);
  });
  it("linePath draws a move then lines", () => {
    expect(linePath([[0, 1], [2, 3.25]])).toBe("M0.0 1.0 L2.0 3.3");
  });
});
