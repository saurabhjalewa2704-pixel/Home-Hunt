import {
  DEFAULT_CONFIG,
  rankHomes,
  score,
  stampDuty,
  type CriterionKey,
  type RankItem,
  type ScoreAssessment,
  type ScoreProCon,
  type ScoreProximity,
  type ScoreResult,
  type ScoringConfig,
  type Tier,
} from "@homehunt/scoring";
import { ACTIVE_STATUSES, type Agent, type Assessment, type Data, type Offer, type ProCon, type Property, type Proximity, type Viewing } from "./types";

export function activeConfig(data: Data): { config: ScoringConfig; buyerType: "first_time" | "standard"; version: number } {
  const row = [...data.scoring_config].sort((a, b) => b.version - a.version)[0];
  return row
    ? { config: { ...DEFAULT_CONFIG, ...row.config, version: row.version }, buyerType: row.buyer_type, version: row.version }
    : { config: DEFAULT_CONFIG, buyerType: "first_time", version: DEFAULT_CONFIG.version };
}

/**
 * Neither buyer sees the other's ratings, pros or cons until they have
 * submitted their own (FR-R1), so anchoring cannot creep in. Drafts are never
 * scored.
 */
export const EVERYONE = "*";

export function visibleFor(data: Data, propertyId: string, viewerId: string) {
  const all = data.assessments.filter((a) => a.property_id === propertyId && a.submitted_at);
  // "*" is the household's own view, used for score snapshots.
  const iSubmitted = viewerId === EVERYONE || all.some((a) => a.member_id === viewerId);
  const assessments = all.filter((a) => a.member_id === viewerId || iSubmitted);
  const proCons = data.pro_cons.filter((c) => c.property_id === propertyId && (c.member_id === viewerId || iSubmitted));
  return { assessments, proCons, iSubmitted };
}

const toScoreAssessment = (a: Assessment): ScoreAssessment => ({
  memberId: a.member_id,
  ratings: a.ratings as ScoreAssessment["ratings"],
  spaceLiving: a.space_living,
  spaceKitchen: a.space_kitchen,
  gutFeel: a.gut_feel,
  submitted: !!a.submitted_at,
});

const toScoreProCon = (c: ProCon): ScoreProCon => ({
  memberId: c.member_id,
  kind: c.kind,
  impact: c.impact,
  criterion: c.criterion as CriterionKey | null,
  dealBreaker: c.deal_breaker,
});

export function proximityMinutes(rows: Proximity[]): ScoreProximity {
  const m = (c: string) => rows.find((r) => r.category === c)?.walk_min;
  return { station: m("station"), park: m("park"), supermarket: m("supermarket"), convenience: m("convenience"), gym: m("gym"), restaurants: m("restaurants") };
}

export interface Derived {
  property: Property;
  result: ScoreResult;
  tier: Tier;
  rank: number | null;
  provisional: boolean;
  proximity: Proximity[];
  minutes: ScoreProximity;
  viewings: Viewing[];
  lastViewingAt: number | null;
  nextViewing: Viewing | null;
  offers: Offer[];
  agent: Agent | null;
  ratedBy: string[];
  iSubmitted: boolean;
  /** True when the home is in play (Shortlisted to Offer accepted). */
  active: boolean;
  stampDuty: number;
}

export function scoreOne(data: Data, p: Property, viewerId: string): { result: ScoreResult; iSubmitted: boolean } {
  const { config } = activeConfig(data);
  const vis = visibleFor(data, p.id, viewerId);
  const prox = proximityMinutes(data.proximity.filter((x) => x.property_id === p.id));
  const result = score({
    property: {
      askingPrice: p.asking_price,
      priceQualifier: p.price_qualifier ?? "guide",
      floorAreaSqft: p.floor_area_sqft,
      offers: data.offers.filter((o) => o.property_id === p.id).map((o) => ({ amount: o.amount, outcome: o.outcome, madeAt: o.made_at })),
      manuallyRuledOut: p.status === "ruled_out",
    },
    proximity: prox,
    assessments: vis.assessments.map(toScoreAssessment),
    prosCons: vis.proCons.map(toScoreProCon),
    memberIds: data.members.map((m) => m.id),
    config,
  });
  return { result, iSubmitted: vis.iSubmitted };
}

export function deriveAll(data: Data, viewerId: string, now = Date.now()): Derived[] {
  const { config, buyerType } = activeConfig(data);
  const props = data.properties.filter((p) => !p.archived_at);
  const items: Derived[] = props.map((p) => {
    const { result, iSubmitted } = scoreOne(data, p, viewerId);
    const viewings = data.viewings.filter((v) => v.property_id === p.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const done = viewings.filter((v) => v.status === "done" || (v.status === "booked" && new Date(v.starts_at).getTime() < now));
    const next = viewings.find((v) => v.status === "booked" && new Date(v.starts_at).getTime() >= now) ?? null;
    const proximity = data.proximity.filter((x) => x.property_id === p.id);
    const eff = result.effectivePrice;
    return {
      property: p,
      result,
      tier: result.tier,
      rank: null,
      provisional: result.provisional,
      proximity,
      minutes: proximityMinutes(proximity),
      viewings,
      lastViewingAt: done.length ? new Date(done[done.length - 1].starts_at).getTime() : null,
      nextViewing: next,
      offers: data.offers.filter((o) => o.property_id === p.id),
      agent: data.agents.find((a) => a.id === p.default_agent_id) ?? null,
      ratedBy: result.provisional ? [] : Object.keys(result.memberScores),
      iSubmitted,
      active: ACTIVE_STATUSES.includes(p.status),
      stampDuty: stampDuty(eff, config.sdlt, buyerType === "first_time"),
    };
  });

  const rankItems: RankItem[] = items
    .filter((i) => i.active)
    .map((i) => ({
      id: i.property.id,
      result: i.result,
      stationMinutes: i.minutes.station ?? null,
      lastViewingAt: i.lastViewingAt,
      pinned: !!i.property.pinned_by,
    }));
  const ranked = rankHomes(rankItems, config);
  const order = new Map(ranked.map((r, idx) => [r.id, { ...r, idx }]));
  for (const it of items) {
    const r = order.get(it.property.id);
    if (r) it.rank = r.rank;
  }
  // Display order: ranked homes (tier, then rank), provisional, then the rest.
  return items.sort((a, b) => {
    const ra = order.get(a.property.id)?.idx ?? 1e6;
    const rb = order.get(b.property.id)?.idx ?? 1e6;
    return ra - rb || b.result.combined - a.result.combined;
  });
}

export const TIER_LABELS: Record<Tier | "to_view", string> = {
  top_pick: "Top pick",
  strong: "Strong contender",
  maybe: "Maybe",
  unlikely: "Unlikely",
  ruled_out: "Ruled out",
  to_view: "To view",
};
export const TIER_RULES: Record<Tier | "to_view", string> = {
  top_pick: "Combined score 80 or more, every must-have met",
  strong: "70 to 79.9, or 80+ with a must-have missed",
  maybe: "55 to 69.9",
  unlikely: "Below 55",
  ruled_out: "Over budget, a deal-breaker, or ruled out by you",
  to_view: "Scored from the listing and walking times only",
};
export const TIER_COLOR: Record<Tier | "to_view", string> = {
  top_pick: "var(--tier-top)",
  strong: "var(--tier-strong)",
  maybe: "var(--tier-maybe)",
  unlikely: "var(--tier-unlikely)",
  ruled_out: "var(--tier-out)",
  to_view: "var(--muted)",
};
export const NEXT_STEP: Record<Tier, string> = {
  top_pick: "Book a second viewing or prepare an offer",
  strong: "Second viewing; check the weak criterion",
  maybe: "Keep as back-up; revisit if the market is thin",
  unlikely: "Consider ruling out",
  ruled_out: "Kept for reference",
};

export interface GateNote {
  key: string;
  text: string;
  level: "soft" | "amber";
}

/** Plain-language notes for breached must-haves and early warnings (PRD 6.5). */
export function gateNotes(d: Derived, config: ScoringConfig): GateNote[] {
  const out: GateNote[] = [];
  const g = config.softGates;
  for (const k of d.result.softGates) {
    if (k === "station") out.push({ key: k, text: `Station over ${g.stationMax} min`, level: "soft" });
    if (k === "park") out.push({ key: k, text: `Park over ${g.parkMax} min`, level: "soft" });
    if (k === "supermarket") out.push({ key: k, text: `Supermarket over ${g.supermarketMax} min`, level: "soft" });
    if (k === "space") out.push({ key: k, text: "Space rated low", level: "soft" });
  }
  for (const k of d.result.amberFlags) {
    if (!d.result.softGates.includes(k)) out.push({ key: `${k}-amber`, text: `${k === "park" ? "Park" : "Supermarket"} over ${config.amberMinutes} min`, level: "amber" });
  }
  return out;
}

export function bedsBaths(p: Property): string {
  const parts: string[] = [];
  if (p.beds != null) parts.push(p.beds === 0 ? "Studio" : `${p.beds} bed`);
  if (p.baths != null) parts.push(`${p.baths} bath`);
  if (p.floor_area_sqft) parts.push(`${Math.round(p.floor_area_sqft).toLocaleString("en-GB")} sq ft`);
  return parts.join(", ");
}
