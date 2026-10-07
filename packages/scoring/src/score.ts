import { clamp, interpolate, meanRating, normaliseRating } from "./curves";
import {
  CRITERIA,
  CRITERION_NAMES,
  type BreakdownLine,
  type CriterionKey,
  type MemberScore,
  type ScoreAssessment,
  type ScoreInput,
  type ScoreProCon,
  type ScoreProperty,
  type ScoreProximity,
  type ScoreResult,
  type ScoringConfig,
  type SoftGateKey,
  type Tier,
} from "./types";

const fmt1 = (n: number) => n.toFixed(1);
const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/**
 * The price the budget criterion scores against: accepted offer, else the
 * latest live offer, else the asking price (PRD 6.3).
 */
export function effectivePrice(p: ScoreProperty): number {
  const accepted = [...p.offers].reverse().find((o) => o.outcome === "accepted");
  if (accepted) return accepted.amount;
  const live = [...p.offers].reverse().find((o) => o.outcome === "pending" || o.outcome === "countered");
  if (live) return live.amount;
  return p.askingPrice;
}

function budgetSubScore(p: ScoreProperty, c: ScoringConfig): { sub: number; price: number } {
  const eff = effectivePrice(p);
  const hasOffer = eff !== p.askingPrice || p.offers.some((o) => o.outcome === "accepted");
  const uplift = !hasOffer && (p.priceQualifier === "offers_over" || p.priceQualifier === "offers_in_excess");
  const price = uplift ? Math.min(c.budget, eff * (1 + c.qualifierUplift)) : eff;
  return { sub: interpolate(c.budgetCurve, price), price };
}

function over(min: number | null | undefined, max: number): boolean {
  return typeof min === "number" && min > max;
}

export function sharedSoftGates(prox: ScoreProximity, c: ScoringConfig): SoftGateKey[] {
  const g: SoftGateKey[] = [];
  if (over(prox.station, c.softGates.stationMax)) g.push("station");
  if (over(prox.park, c.softGates.parkMax)) g.push("park");
  if (over(prox.supermarket, c.softGates.supermarketMax)) g.push("supermarket");
  return g;
}

function spaceRating(a: ScoreAssessment | undefined): number | null {
  if (!a) return null;
  const m = meanRating([a.ratings.living_room, a.ratings.kitchen, a.spaceLiving, a.spaceKitchen]);
  return m === null ? null : normaliseRating(m);
}

function areaSub(area: number | null, c: ScoringConfig): number | null {
  return area && area > 0 ? interpolate(c.curves.area, area) : null;
}

function restMean(a: ScoreAssessment): number | null {
  const r = a.ratings;
  // Bedrooms and any extra bathrooms (bathroom_2 = en suite) join the mean.
  const rooms = Object.entries(r)
    .filter(([k]) => k.startsWith("bedroom_") || k.startsWith("bathroom_"))
    .map(([, v]) => v);
  return meanRating([...rooms, r.bathrooms, r.outdoor, r.storage, r.light, r.condition, r.noise, r.layout, r.street]);
}

function prosConsAdjustment(items: ScoreProCon[], c: ScoringConfig): number {
  let total = 0;
  for (const it of items) {
    const base = c.prosCons[it.impact];
    const value = it.criterion ? base * c.prosCons.linkedFactor : base;
    total += it.kind === "pro" ? value : -value;
  }
  return clamp(total, -c.prosCons.cap, c.prosCons.cap);
}

interface Shared {
  budget: { sub: number; price: number };
  station: number | null;
  park: number | null;
  supermarket: number | null;
  extras: number | null;
  area: number | null;
}

function sharedSubs(p: ScoreProperty, prox: ScoreProximity, c: ScoringConfig): Shared {
  const station = typeof prox.station === "number" ? interpolate(c.curves.station, prox.station) : null;
  const park = typeof prox.park === "number" ? interpolate(c.curves.park, prox.park) : null;
  let supermarket: number | null = null;
  if (typeof prox.supermarket === "number") {
    supermarket = interpolate(c.curves.supermarket, prox.supermarket);
    const b = c.convenienceBonus;
    if (
      prox.supermarket > b.supermarketOverMin &&
      typeof prox.convenience === "number" &&
      prox.convenience <= b.convenienceWithinMin
    ) {
      supermarket = Math.min(1, supermarket + b.bonus);
    }
  }
  const ex = [prox.gym, prox.restaurants]
    .filter((m): m is number => typeof m === "number")
    .map((m) => interpolate(c.curves.gymRestaurants, m));
  const extras = ex.length ? ex.reduce((a, b) => a + b, 0) / ex.length : null;
  return { budget: budgetSubScore(p, c), station, park, supermarket, extras, area: areaSub(p.floorAreaSqft, c) };
}

function line(
  key: CriterionKey,
  c: ScoringConfig,
  sub: number | null,
  sentence: (points: number, weight: number) => string,
  missingText: string,
): BreakdownLine {
  const weight = c.weights[key];
  if (sub === null) return { key, name: CRITERION_NAMES[key], weight, sub: null, points: null, sentence: missingText };
  const points = sub * weight;
  return { key, name: CRITERION_NAMES[key], weight, sub, points, sentence: sentence(points, weight) };
}

function memberLines(
  sh: Shared,
  prox: ScoreProximity,
  p: ScoreProperty,
  a: ScoreAssessment | undefined,
  c: ScoringConfig,
): { lines: BreakdownLine[]; R: number | null } {
  const R = spaceRating(a);
  let space: number | null;
  if (R !== null && sh.area !== null) space = c.spaceMix.ratings * R + c.spaceMix.area * sh.area;
  else if (R !== null) space = R;
  else space = sh.area; // provisional: floor area alone

  const rest = a ? restMean(a) : null;
  const gut = a ? meanRating([a.gutFeel]) : null;
  const pts = (n: number, w: number) => `${fmt1(n)} of ${w}`;

  const lines: BreakdownLine[] = [
    line(
      "budget",
      c,
      sh.budget.sub,
      (n, w) => `${gbp(sh.budget.price)} leaves ${gbp(Math.max(0, c.budget - sh.budget.price))} under your limit: ${pts(n, w)}.`,
      "Price missing.",
    ),
    line("station", c, sh.station, (n, w) => `Station ${prox.station} min walk: ${pts(n, w)}.`, "Station walk not worked out yet."),
    line(
      "space",
      c,
      space,
      (n, w) =>
        R !== null
          ? `Space ratings ${fmt1(1 + R * 4)} of 5${p.floorAreaSqft ? `, ${Math.round(p.floorAreaSqft)} sq ft` : ""}: ${pts(n, w)}.`
          : `${Math.round(p.floorAreaSqft ?? 0)} sq ft, not yet rated: ${pts(n, w)}.`,
      "Add the floor area or rate the rooms.",
    ),
    line("park", c, sh.park, (n, w) => `Park ${prox.park} min walk: ${pts(n, w)}.`, "Park walk not worked out yet."),
    line(
      "supermarket",
      c,
      sh.supermarket,
      (n, w) => `Supermarket ${prox.supermarket} min walk: ${pts(n, w)}.`,
      "Supermarket walk not worked out yet.",
    ),
    line(
      "rest",
      c,
      rest === null ? null : normaliseRating(rest),
      (n, w) => `Average rating ${fmt1(rest ?? 0)} of 5: ${pts(n, w)}.`,
      "Not rated yet.",
    ),
    line(
      "extras",
      c,
      sh.extras,
      (n, w) =>
        `Gym ${prox.gym ?? "?"} min, restaurants ${prox.restaurants ?? "?"} min: ${pts(n, w)}.`,
      "Gym and restaurant walks not worked out yet.",
    ),
    line(
      "gut",
      c,
      gut === null ? null : normaliseRating(gut),
      (n, w) => `Gut feel ${gut} of 5: ${pts(n, w)}.`,
      "Not rated yet.",
    ),
  ];
  return { lines, R };
}

function scoreOne(
  memberId: string,
  rated: boolean,
  sh: Shared,
  input: ScoreInput,
  shared: SoftGateKey[],
): { member: MemberScore; spaceGate: boolean } {
  const { property, proximity, config: c } = input;
  const assessment = input.assessments.find((x) => x.memberId === memberId && x.submitted);
  const { lines, R } = memberLines(sh, proximity, property, assessment, c);
  const available = lines.filter((l) => l.points !== null);
  const sumPts = available.reduce((s, l) => s + (l.points ?? 0), 0);
  const sumW = available.reduce((s, l) => s + l.weight, 0);
  const subtotal = sumW > 0 ? (sumPts / sumW) * 100 : 0;
  const mine = input.prosCons.filter((x) => x.memberId === memberId);
  const adj = rated ? prosConsAdjustment(mine, c) : 0;
  const spaceGate = rated && R !== null && R <= c.softGates.spaceMaxR;
  const gates: SoftGateKey[] = spaceGate ? [...shared, "space"] : [...shared];
  const score = clamp(subtotal + adj - c.softGates.penalty * gates.length, 0, 100);
  return {
    member: { memberId, rated, lines, subtotal, prosConsAdjustment: adj, softGates: gates, score },
    spaceGate,
  };
}

export function tierFor(score: number, softGateBreached: boolean, c: ScoringConfig): Tier {
  if (score >= c.tierCutoffs.top && !softGateBreached) return "top_pick";
  if (score >= c.tierCutoffs.strong || score >= c.tierCutoffs.top) return "strong";
  if (score >= c.tierCutoffs.maybe) return "maybe";
  return "unlikely";
}

/**
 * Home Score for one property (PRD section 6). Pure and deterministic: no
 * clocks, no randomness, no I/O.
 */
export function score(input: ScoreInput): ScoreResult {
  const { property, proximity, config: c } = input;
  const sh = sharedSubs(property, proximity, c);
  const sharedGates = sharedSoftGates(proximity, c);

  const submitted = new Set(input.assessments.filter((a) => a.submitted).map((a) => a.memberId));
  const raters = input.memberIds.filter((id) => submitted.has(id));
  const ratedCount = raters.length;
  const provisional = ratedCount === 0;

  const memberScores: Record<string, MemberScore> = {};
  let anySpaceGate = false;
  const scored = provisional ? [input.memberIds[0] ?? "household"] : raters;
  for (const id of scored) {
    const r = scoreOne(id, !provisional, sh, input, sharedGates);
    memberScores[id] = r.member;
    anySpaceGate ||= r.spaceGate;
  }
  const combined = scored.reduce((s, id) => s + memberScores[id].score, 0) / scored.length;

  const missing: string[] = [];
  const first = memberScores[scored[0]];
  for (const l of first.lines) if (l.points === null) missing.push(CRITERION_NAMES[l.key]);

  const softGates: SoftGateKey[] = anySpaceGate ? [...sharedGates, "space"] : sharedGates;

  const amberFlags: Array<"park" | "supermarket"> = [];
  if (over(proximity.park, c.amberMinutes)) amberFlags.push("park");
  if (over(proximity.supermarket, c.amberMinutes)) amberFlags.push("supermarket");

  // Hard gates. The budget gate follows the figure in play: an accepted offer
  // at or under the limit lifts it; otherwise the live offer, else the asking
  // price. "Offers over" listings are gated on the asking price itself.
  const eff = effectivePrice(property);
  const hardGate = (() => {
    if (property.manuallyRuledOut) return { reason: "manual" as const, detail: "Ruled out by you" };
    const db = input.prosCons.find((x) => x.kind === "con" && x.dealBreaker);
    if (db) return { reason: "deal_breaker" as const, detail: "Deal-breaker flagged" };
    if (eff > c.budget) return { reason: "over_budget" as const, detail: `${gbp(eff)} is over the ${gbp(c.budget)} limit` };
    return null;
  })();

  const tier: Tier = hardGate ? "ruled_out" : tierFor(combined, softGates.length > 0, c);
  const diffPts = ratedCount >= 2 ? Math.abs(memberScores[raters[0]].score - memberScores[raters[1]].score) : 0;

  return {
    memberScores,
    combined,
    ratedCount,
    provisional,
    missing,
    softGates,
    amberFlags,
    hardGate,
    tier,
    effectivePrice: eff,
    disagreement: ratedCount >= 2 && diffPts >= c.disagreementThreshold,
    disagreementPoints: diffPts,
    headroom: c.budget - eff,
  };
}

export { CRITERIA };
