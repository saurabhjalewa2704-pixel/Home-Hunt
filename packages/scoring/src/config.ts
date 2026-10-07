import type { ScoringConfig } from "./types";

/** Defaults from PRD section 6. Everything the scorer uses lives here so Settings can edit it. */
export const DEFAULT_CONFIG: ScoringConfig = {
  version: 1,
  budget: 750_000,
  parkMinHectares: 1,
  qualifierUplift: 0.02,
  budgetCurve: [
    [650_000, 1.0],
    [700_000, 0.85],
    [750_000, 0.6],
  ],
  weights: { budget: 20, station: 20, space: 20, park: 12, supermarket: 12, rest: 8, extras: 4, gut: 4 },
  curves: {
    station: [[5, 1], [10, 0.85], [15, 0.6], [20, 0.1], [25, 0]],
    park: [[5, 1], [10, 0.7], [15, 0.3], [20, 0]],
    supermarket: [[5, 1], [10, 0.75], [15, 0.35], [25, 0]],
    gymRestaurants: [[5, 1], [10, 0.7], [20, 0.2], [30, 0]],
    area: [[550, 0.1], [650, 0.4], [800, 0.7], [1000, 1]],
  },
  spaceMix: { ratings: 0.6, area: 0.4 },
  convenienceBonus: { supermarketOverMin: 10, convenienceWithinMin: 5, bonus: 0.1 },
  softGates: { stationMax: 15, parkMax: 15, supermarketMax: 15, spaceMaxR: 0.25, penalty: 5 },
  amberMinutes: 10,
  prosCons: { minor: 1, moderate: 2.5, major: 5, linkedFactor: 0.5, cap: 10 },
  tierCutoffs: { top: 80, strong: 70, maybe: 55 },
  disagreementThreshold: 10,
  tieWindow: 0.5,
  sdlt: {
    standard: [
      { upTo: 125_000, rate: 0 },
      { upTo: 250_000, rate: 0.02 },
      { upTo: 925_000, rate: 0.05 },
      { upTo: 1_500_000, rate: 0.1 },
      { upTo: null, rate: 0.12 },
    ],
    firstTime: {
      maxPrice: 500_000,
      bands: [
        { upTo: 300_000, rate: 0 },
        { upTo: 500_000, rate: 0.05 },
      ],
    },
  },
};

export function totalWeight(c: ScoringConfig): number {
  return Object.values(c.weights).reduce((a, b) => a + b, 0);
}
