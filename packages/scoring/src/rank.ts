import type { ScoreResult, ScoringConfig, Tier } from "./types";

export const TIER_ORDER: Tier[] = ["top_pick", "strong", "maybe", "unlikely", "ruled_out"];

export interface RankItem {
  id: string;
  result: ScoreResult;
  stationMinutes: number | null;
  /** Epoch ms of the most recent viewing, or null. */
  lastViewingAt: number | null;
  pinned?: boolean;
}

export interface Ranked {
  id: string;
  tier: Tier;
  /** 1-based across all viewed active homes; null for provisional and ruled-out homes. */
  rank: number | null;
  provisional: boolean;
}

const stationKey = (n: number | null) => (n === null ? Infinity : n);

function tieBreak(a: RankItem, b: RankItem): number {
  return (
    stationKey(a.stationMinutes) - stationKey(b.stationMinutes) ||
    a.result.effectivePrice - b.result.effectivePrice ||
    (b.lastViewingAt ?? 0) - (a.lastViewingAt ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

/** Order within one tier: pins first, then score with a tie window (PRD 7). */
function orderTier(items: RankItem[], window: number): RankItem[] {
  const pinned = items.filter((i) => i.pinned).sort((a, b) => b.result.combined - a.result.combined || tieBreak(a, b));
  const rest = items.filter((i) => !i.pinned).sort((a, b) => b.result.combined - a.result.combined);
  const out: RankItem[] = [];
  let i = 0;
  while (i < rest.length) {
    // A tie group is every home within `window` points of the group's best score.
    let j = i + 1;
    while (j < rest.length && rest[i].result.combined - rest[j].result.combined <= window) j++;
    out.push(...rest.slice(i, j).sort(tieBreak));
    i = j;
  }
  return [...pinned, ...out];
}

/**
 * Rank active homes. Provisional (not yet viewed) homes sit in a separate
 * "To view" group and get no rank; ruled-out homes are not ranked.
 * Returns viewed homes in display order, then the provisional ones.
 */
export function rankHomes(items: RankItem[], config: ScoringConfig): Ranked[] {
  const out: Ranked[] = [];
  let rank = 1;
  const viewed = items.filter((i) => !i.result.provisional && i.result.tier !== "ruled_out");
  for (const tier of TIER_ORDER) {
    for (const it of orderTier(viewed.filter((i) => i.result.tier === tier), config.tieWindow)) {
      out.push({ id: it.id, tier, rank: rank++, provisional: false });
    }
  }
  const prov = items
    .filter((i) => i.result.provisional && i.result.tier !== "ruled_out")
    .sort((a, b) => b.result.combined - a.result.combined || tieBreak(a, b));
  for (const it of prov) out.push({ id: it.id, tier: it.result.tier, rank: null, provisional: true });
  return out;
}
