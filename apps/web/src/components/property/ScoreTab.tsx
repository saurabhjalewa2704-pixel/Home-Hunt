"use client";
import { CRITERION_NAMES, type BreakdownLine, type CriterionKey } from "@homehunt/scoring";
import { gateNotes } from "@/lib/derive";
import { fmtDay, gbp, oneDp, signed1 } from "@/lib/format";
import { Avatar } from "../ui";
import type { Ctx } from "./ctx";
import { ProConRow } from "./ProsConsTab";
import { AgentCard } from "./AgentTab";
import { WalkList } from "./LocationTab";
import { TIER_LABELS } from "@/lib/derive";
import { visibleFor } from "@/lib/derive";

const strip = (s: string) => s.replace(/:\s*[\d.]+ of \d+\.?$/, ".").replace(/\.\.$/, ".");
const fitColor = (f: number) => (f >= 0.8 ? "var(--accent)" : f >= 0.6 ? "color-mix(in srgb, var(--accent) 70%, var(--amber))" : "var(--amber)");

export function ScoreTab({ ctx }: { ctx: Ctx }) {
  const { d, config, members } = ctx;
  const r = d.result;
  const cols = r.provisional ? [{ id: Object.keys(r.memberScores)[0], name: "So far", member: undefined }] : members.filter((m) => r.memberScores[m.id]).map((m) => ({ id: m.id, name: m.display_name, member: m }));
  const keys = Object.keys(CRITERION_NAMES) as CriterionKey[];
  const line = (colId: string, k: CriterionKey): BreakdownLine => r.memberScores[colId].lines.find((l) => l.key === k)!;

  const rows = keys.map((k) => {
    const lines = cols.map((c) => ({ c, l: line(c.id, k) }));
    const subs = lines.map((x) => x.l.sub).filter((s): s is number => s !== null);
    const fit = subs.length ? subs.reduce((a, b) => a + b, 0) / subs.length : null;
    const sentences = [...new Set(lines.map((x) => strip(x.l.sentence)))];
    const found = sentences.length === 1 || cols.length === 1 ? sentences[0] : lines.map((x) => `${x.c.name}: ${strip(x.l.sentence)}`).join(" ");
    return { k, name: CRITERION_NAMES[k], weight: config.weights[k], fit, found, lines };
  });

  const SHARED = ["budget", "station", "park", "supermarket", "extras"];
  const drag = rows.filter((x) => x.fit !== null && SHARED.includes(x.k)).sort((a, b) => b.weight * (1 - b.fit!) - a.weight * (1 - a.fit!))[0];
  const gates = gateNotes(d, config).filter((g) => g.level === "soft");
  const history = ctx.data.score_snapshots.filter((s) => s.property_id === d.property.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const vis = visibleFor(ctx.data, d.property.id, ctx.me.id);
  const items = vis.proCons.sort((a, b) => a.position - b.position);

  const cell = (v: string | null | undefined, bold?: boolean) => <span className="num text-right" style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 16 : undefined }}>{v ?? "–"}</span>;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="panel min-w-0 flex-[999_1_600px] overflow-x-auto" aria-label="Score breakdown">
        <div className="flex flex-col gap-1.5 px-6 pt-[22px] pb-2">
          <h2 className="m-0 text-xl font-bold">How this score adds up</h2>
          {r.provisional && <p className="m-0 text-sm text-muted">Provisional: scored from the listing and walking times only. Missing: {r.missing.join(", ").toLowerCase() || "nothing"}.</p>}
          {drag && drag.weight * (1 - drag.fit!) > 3 && <p className="m-0 text-sm leading-5 text-muted">The biggest drag is {drag.name.toLowerCase()}: {drag.found}</p>}
        </div>
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_90px_repeat(var(--n),56px)] items-center gap-3 border-t border-line-2 px-6 py-3 text-[12.5px] font-semibold text-muted" style={{ ["--n" as string]: cols.length }}>
            <span>Criterion and weight</span><span>What we found</span><span>Fit</span>
            {cols.map((c) => <span key={c.id} className="flex justify-end">{c.member ? <Avatar member={c.member} /> : c.name}</span>)}
          </div>
          {rows.map((x) => (
            <div key={x.k} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_90px_repeat(var(--n),56px)] items-center gap-3 border-t border-line-2 px-6 py-3 text-sm" style={{ ["--n" as string]: cols.length }}>
              <span className="flex flex-col gap-0.5"><span className="font-semibold">{x.name}</span><span className="text-[12.5px] text-muted">{x.weight} points</span></span>
              <span className="leading-5 text-ink-2">{x.found}</span>
              <span className="relative h-1.5 rounded-[3px]" style={{ background: "var(--track)" }} role="img" aria-label={`${x.name} fit ${x.fit === null ? "unknown" : Math.round(x.fit * 100) + " percent"}`}>
                {x.fit !== null && <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${Math.round(x.fit * 100)}%`, background: fitColor(x.fit) }} />}
              </span>
              {x.lines.map(({ c, l }) => <span key={c.id}>{cell(l.points === null ? null : l.points.toFixed(1))}</span>)}
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_90px_repeat(var(--n),56px)] items-center gap-3 border-t border-line-2 px-6 py-3 text-sm" style={{ background: "var(--surface-2)", ["--n" as string]: cols.length }}>
            <span className="font-bold">Weighted subtotal</span><span className="text-muted">Out of 100</span><span />
            {cols.map((c) => <span key={c.id}>{cell(r.memberScores[c.id].subtotal.toFixed(1))}</span>)}
          </div>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_90px_repeat(var(--n),56px)] items-center gap-3 border-t border-line-2 px-6 py-3 text-sm" style={{ ["--n" as string]: cols.length }}>
            <span className="font-semibold">Pros and cons</span><span className="leading-5 text-ink-2">Capped at plus or minus {config.prosCons.cap}. Cons tied to a scored item count half.</span><span />
            {cols.map((c) => <span key={c.id}>{cell(r.provisional ? "0" : signed1(r.memberScores[c.id].prosConsAdjustment))}</span>)}
          </div>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_90px_repeat(var(--n),56px)] items-center gap-3 border-t border-line-2 px-6 py-3 text-sm" style={{ ["--n" as string]: cols.length }}>
            <span className="font-semibold">Must-haves</span>
            <span className="text-ink-2">{gates.length ? `${gates.map((g) => g.text).join(", ")}. Each costs ${config.softGates.penalty} points and caps the tier at Strong contender.` : "All met. No penalty."}</span><span />
            {cols.map((c) => <span key={c.id}>{cell(String(-config.softGates.penalty * r.memberScores[c.id].softGates.length || 0).replace("-", "−"))}</span>)}
          </div>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_90px_repeat(var(--n),56px)] items-center gap-3 border-t border-line px-6 py-3.5 text-sm" style={{ background: "var(--accent-soft)", ["--n" as string]: cols.length }}>
            <span className="text-base font-extrabold">{r.provisional ? "Score so far" : "Your scores"}</span>
            <span className="font-semibold">{cols.length > 1 ? `Combined (${cols.map((c) => r.memberScores[c.id].score.toFixed(1)).join(" + ")}) ÷ ${cols.length} = ${r.combined.toFixed(1)}` : `Combined ${r.combined.toFixed(1)}${!r.provisional ? " (1 of 2 rated)" : ""}`}</span><span />
            {cols.map((c) => <span key={c.id}>{cell(r.memberScores[c.id].score.toFixed(1), true)}</span>)}
          </div>
        </div>
        {history.length > 1 && (
          <div className="border-t border-line-2 px-6 py-4">
            <h3 className="m-0 mb-2 text-sm font-bold">Score history</h3>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[13px] text-muted">
              {history.map((h) => <li key={h.id}>{fmtDay(h.created_at)}: <strong className="text-ink">{oneDp(h.combined)}</strong> {TIER_LABELS[h.tier as keyof typeof TIER_LABELS] ?? h.tier}{h.provisional ? " (so far)" : ""}</li>)}
            </ul>
          </div>
        )}
      </section>

      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
        <section className="panel px-[22px] py-5">
          <h2 className="m-0 mb-1.5 text-lg font-bold">Pros and cons</h2>
          {items.length ? items.map((c) => <ProConRow key={c.id} c={c} ctx={ctx} />) : <p className="m-0 text-sm text-muted">None yet.</p>}
        </section>
        <section className="panel px-[22px] py-5">
          <h2 className="m-0 mb-1.5 text-lg font-bold">Walking times</h2>
          <WalkList ctx={ctx} compact />
        </section>
        <section className="panel flex flex-col gap-2.5 px-[22px] py-5">
          <h2 className="m-0 text-lg font-bold">Agent</h2>
          {d.agent ? <AgentCard a={d.agent} /> : <p className="m-0 text-sm text-muted">No agent linked yet.</p>}
        </section>
      </div>
    </div>
  );
}
