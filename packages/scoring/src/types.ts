export const CRITERIA = [
  "budget",
  "station",
  "space",
  "park",
  "supermarket",
  "rest",
  "extras",
  "gut",
] as const;
export type CriterionKey = (typeof CRITERIA)[number];

export const CRITERION_NAMES: Record<CriterionKey, string> = {
  budget: "Budget fit",
  station: "Station walk",
  space: "Living room and kitchen space",
  park: "Park nearby",
  supermarket: "Supermarket nearby",
  rest: "Rest of the home",
  extras: "Gym and restaurants",
  gut: "Gut feel",
};

export type Curve = ReadonlyArray<readonly [number, number]>;

export type PriceQualifier = "guide" | "offers_over" | "offers_in_excess" | "fixed";
export type OfferOutcome = "pending" | "accepted" | "rejected" | "countered";
export type Impact = "minor" | "moderate" | "major";
export type Tier = "top_pick" | "strong" | "maybe" | "unlikely" | "ruled_out";

export interface ScoringConfig {
  version: number;
  budget: number;
  qualifierUplift: number;
  budgetCurve: Curve;
  weights: Record<CriterionKey, number>;
  curves: { station: Curve; park: Curve; supermarket: Curve; gymRestaurants: Curve; area: Curve };
  spaceMix: { ratings: number; area: number };
  convenienceBonus: { supermarketOverMin: number; convenienceWithinMin: number; bonus: number };
  softGates: { stationMax: number; parkMax: number; supermarketMax: number; spaceMaxR: number; penalty: number };
  amberMinutes: number;
  prosCons: { minor: number; moderate: number; major: number; linkedFactor: number; cap: number };
  tierCutoffs: { top: number; strong: number; maybe: number };
  disagreementThreshold: number;
  tieWindow: number;
  sdlt: SdltConfig;
}

export interface SdltBand {
  /** Upper bound of the band; null for the open top band. */
  upTo: number | null;
  rate: number;
}
export interface SdltConfig {
  standard: SdltBand[];
  firstTime: { maxPrice: number; bands: SdltBand[] };
}

export interface Offer {
  amount: number;
  outcome: OfferOutcome;
  madeAt?: string;
}

export interface ScoreProperty {
  askingPrice: number;
  priceQualifier: PriceQualifier;
  floorAreaSqft: number | null;
  offers: Offer[];
  manuallyRuledOut: boolean;
}

/** Walking minutes per category. null/undefined means unknown. */
export interface ScoreProximity {
  station?: number | null;
  park?: number | null;
  supermarket?: number | null;
  /** Nearest convenience-format store; recorded separately from full-size supermarkets. */
  convenience?: number | null;
  gym?: number | null;
  restaurants?: number | null;
}

export type RatingKey =
  | "living_room"
  | "kitchen"
  | "bathrooms"
  | "outdoor"
  | "storage"
  | "light"
  | "condition"
  | "noise"
  | "layout"
  | "street"
  | `bedroom_${number}`;

export interface ScoreAssessment {
  memberId: string;
  /** 1-5. null/undefined/0 = N/A or not answered; excluded from means. */
  ratings: Partial<Record<RatingKey, number | null>>;
  spaceLiving?: number | null;
  spaceKitchen?: number | null;
  gutFeel?: number | null;
  /** Only submitted assessments are scored. */
  submitted: boolean;
}

export interface ScoreProCon {
  memberId: string;
  kind: "pro" | "con";
  impact: Impact;
  criterion: CriterionKey | null;
  dealBreaker: boolean;
}

export interface ScoreInput {
  property: ScoreProperty;
  proximity: ScoreProximity;
  assessments: ScoreAssessment[];
  prosCons: ScoreProCon[];
  memberIds: string[];
  config: ScoringConfig;
}

export type SoftGateKey = "station" | "park" | "supermarket" | "space";

export interface BreakdownLine {
  key: CriterionKey;
  name: string;
  weight: number;
  /** Sub-score 0..1, or null when there is no data. */
  sub: number | null;
  points: number | null;
  /** One sentence explaining the line, e.g. "Station 12 min walk: 15.0 of 20." */
  sentence: string;
}

export interface MemberScore {
  memberId: string;
  rated: boolean;
  lines: BreakdownLine[];
  subtotal: number;
  prosConsAdjustment: number;
  softGates: SoftGateKey[];
  score: number;
}

export interface ScoreResult {
  memberScores: Record<string, MemberScore>;
  combined: number;
  ratedCount: number;
  provisional: boolean;
  /** Inputs that are missing, shown with a provisional score. */
  missing: string[];
  softGates: SoftGateKey[];
  amberFlags: Array<"park" | "supermarket">;
  hardGate: null | { reason: "over_budget" | "deal_breaker" | "manual"; detail: string };
  tier: Tier;
  effectivePrice: number;
  disagreement: boolean;
  disagreementPoints: number;
  /** Budget headroom under the limit, using the effective price. */
  headroom: number;
}
