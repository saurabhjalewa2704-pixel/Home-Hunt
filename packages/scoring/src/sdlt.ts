import type { SdltBand, SdltConfig } from "./types";

function tax(price: number, bands: SdltBand[]): number {
  let prev = 0;
  let total = 0;
  for (const b of bands) {
    const top = b.upTo ?? Infinity;
    if (price > prev) total += (Math.min(price, top) - prev) * b.rate;
    prev = top;
    if (price <= top) break;
  }
  return total;
}

/**
 * Stamp duty estimate for England. First-time buyer relief only applies at or
 * under its price cap; above it the standard rates apply to the whole price.
 * Planning estimate only, not advice.
 */
export function stampDuty(price: number, cfg: SdltConfig, firstTimeBuyer = true): number {
  if (firstTimeBuyer && price <= cfg.firstTime.maxPrice) return Math.round(tax(price, cfg.firstTime.bands));
  return Math.round(tax(price, cfg.standard));
}
