"use client";
import Link from "next/link";
import { bedsBaths, gateNotes, TIER_COLOR, TIER_LABELS, type Derived } from "@/lib/derive";
import { fmtDay, fmtTime, gbp, splitAddress } from "@/lib/format";
import { STATUS_LABELS, type Member } from "@/lib/types";
import type { ScoringConfig } from "@homehunt/scoring";
import { IPinned, IWarn } from "./icons";
import { Avatar, Cover, ScoreRing, WalkLanes, cx } from "./ui";

export function statusLine(d: Derived): string {
  const p = d.property;
  if ((p.status === "viewing_booked" || p.status === "second_viewing") && d.nextViewing) {
    return `${STATUS_LABELS[p.status]} ${fmtDay(d.nextViewing.starts_at)}, ${fmtTime(d.nextViewing.starts_at)}`;
  }
  if (p.status === "viewed" && d.lastViewingAt) return `Viewed ${fmtDay(new Date(d.lastViewingAt).toISOString())}`;
  return STATUS_LABELS[p.status];
}

export function RankMove({ delta }: { delta: number }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span className="chip" style={{ background: up ? "var(--accent-soft)" : "var(--amber-bg)", color: up ? "var(--accent)" : "var(--amber-fg)" }} aria-label={`${up ? "Up" : "Down"} ${Math.abs(delta)} places since you last looked`}>
      {up ? "▲" : "▼"}{Math.abs(delta)}
    </span>
  );
}

function Chips({ d, config, delta }: { d: Derived; config: ScoringConfig; delta: number }) {
  const gates = gateNotes(d, config);
  const r = d.result;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1.5">
      <span className="chip">{statusLine(d)}</span>
      {r.hardGate && <span className="chip chip-danger">{r.hardGate.detail}</span>}
      {gates.map((g) => (
        <span key={g.key} className="chip chip-warn"><IWarn />{g.text}</span>
      ))}
      {r.disagreement && <span className="chip chip-split">You differ by {Math.round(r.disagreementPoints)} points</span>}
      {!r.provisional && r.ratedCount === 1 && <span className="chip">1 of 2 rated</span>}
      {d.property.pinned_by && <span className="chip" title={d.property.pin_reason ?? undefined}><IPinned />Pinned{d.property.pin_reason ? `: ${d.property.pin_reason}` : ""}</span>}
      <RankMove delta={delta} />
    </span>
  );
}

function PersonScores({ d, members }: { d: Derived; members: Member[] }) {
  return (
    <span className="flex w-16 flex-col gap-1.5 text-[13px] text-muted">
      {members.map((m) => {
        const ms = d.result.memberScores[m.id];
        return (
          <span key={m.id} className="inline-flex items-center gap-1.5">
            <Avatar member={m} />{ms && !d.provisional ? Math.round(ms.score) : "–"}
          </span>
        );
      })}
    </span>
  );
}

export function PropertyRow({ d, members, config, delta = 0 }: { d: Derived; members: Member[]; config: ScoringConfig; delta?: number }) {
  const p = d.property;
  const { street, area } = splitAddress(p.address);
  const tier = d.provisional ? "to_view" : d.tier;
  const struck = d.tier === "ruled_out";
  return (
    <Link href={`/property/${p.id}`} className="block text-ink no-underline hover:bg-surface-2 focus-visible:bg-surface-2" aria-label={`${street}, ${gbp(p.asking_price)}, score ${Math.round(d.result.combined)}${d.provisional ? " so far" : ""}, ${TIER_LABELS[tier]}`}>
      {/* Phone: compact card */}
      <span className="flex flex-col gap-3 p-3.5 md:hidden">
        <span className="flex items-center gap-3">
          <Cover src={p.cover_image_path} tint={p.tint} width={72} height={56} radius={8} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cx("text-base font-bold", struck && "line-through")}>{d.rank ? `${d.rank}. ` : ""}{street}</span>
            <span className="text-[13px] text-muted">{gbp(p.asking_price)}, {bedsBaths(p)}</span>
          </span>
          <ScoreRing score={d.result.combined} tier={tier} provisional={d.provisional} size={52} label={false} />
        </span>
        <WalkLanes station={d.minutes.station} park={d.minutes.park} shops={d.minutes.supermarket} compact />
        <Chips d={d} config={config} delta={delta} />
      </span>

      {/* Laptop: full row */}
      <span className="hidden flex-wrap items-center gap-x-6 gap-y-5 px-6 py-[18px] md:flex">
        <span className="w-[34px] text-[28px] font-extrabold tracking-[-0.03em]" style={{ color: TIER_COLOR[tier] }} aria-label={d.rank ? `Rank ${d.rank}` : "Not ranked yet"}>{d.rank ?? "–"}</span>
        <Cover src={p.cover_image_path} tint={p.tint} width={120} height={84} />
        <span className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className={cx("text-lg font-bold tracking-[-0.01em]", struck && "line-through")}>{street}</span>
          <span className="text-sm text-muted">{area}</span>
          <Chips d={d} config={config} delta={delta} />
        </span>
        <span className="flex w-[150px] flex-col gap-1">
          <span className="text-xl font-bold">{gbp(p.asking_price)}</span>
          <span className="text-[13px] text-muted">{bedsBaths(p)}</span>
        </span>
        <span className="w-[250px]"><WalkLanes station={d.minutes.station} park={d.minutes.park} shops={d.minutes.supermarket} /></span>
        <PersonScores d={d} members={members} />
        <ScoreRing score={d.result.combined} tier={tier} provisional={d.provisional} />
      </span>
    </Link>
  );
}
