import type { ScoringConfig } from "@homehunt/scoring";
import type { Derived } from "@/lib/derive";
import type { Data, Member } from "@/lib/types";

export interface Ctx {
  d: Derived;
  data: Data;
  me: Member;
  other: Member | undefined;
  members: Member[];
  config: ScoringConfig;
  /** Rank position among ranked homes, and how many there are. */
  rankOf: number | null;
  rankedCount: number;
}

export const memberOf = (ctx: Ctx, id: string) => ctx.members.find((m) => m.id === id);
