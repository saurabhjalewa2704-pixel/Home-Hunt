"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ICheck } from "@/components/icons";
import { Cover, EmptyState, PageHeader, ScoreRing } from "@/components/ui";
import { TIER_COLOR, TIER_LABELS, deriveAll, visibleFor, type Derived } from "@/lib/derive";
import { gbp, oneDp, splitAddress } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Data } from "@/lib/types";

const IMPACT = { minor: 1, moderate: 2, major: 3 } as const;
const mean = (xs: Array<number | null | undefined>) => {
  const v = xs.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 5);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function ratings(data: Data, d: Derived, me: string) {
  const a = visibleFor(data, d.property.id, me).assessments;
  return {
    space: mean(a.flatMap((x) => [x.ratings.living_room, x.ratings.kitchen, x.space_living, x.space_kitchen])),
    gut: mean(a.map((x) => x.gut_feel)),
  };
}

function top(data: Data, d: Derived, me: string, kind: "pro" | "con") {
  const items = visibleFor(data, d.property.id, me).proCons.filter((c) => c.kind === kind).sort((a, b) => IMPACT[b.impact] - IMPACT[a.impact]);
  return [...new Set(items.map((c) => c.text))].slice(0, 2);
}

type Row = { label: string; cell: (d: Derived) => { text: string; value: number | null; note?: string }; best?: "min" | "max"; list?: false };

export default function ComparePage() {
  const s = useStore();
  const me = s.me!;
  const all = useMemo(() => deriveAll(s.data, me).filter((d) => d.active && d.tier !== "ruled_out"), [s.data, me]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const ids = picked ?? all.filter((d) => !d.provisional).slice(0, 3).map((d) => d.property.id);
  const chosen = ids.map((id) => all.find((d) => d.property.id === id)).filter((d): d is Derived => !!d);

  if (all.length < 2) return <div className="mx-auto max-w-[760px] px-4 py-9 md:px-10"><PageHeader title="Compare" /><div className="mt-6"><EmptyState title="Add a second home to compare" body="Compare shows two to four homes side by side once you have at least two on the board." action={<Link href="/add" className="btn btn-p">Add a home</Link>} /></div></div>;

  const prox = (cat: string) => (d: Derived) => {
    const r = d.proximity.find((x) => x.category === cat);
    return { text: r ? `${r.walk_min} min${cat === "station" ? `, ${r.place_name}` : ""}` : "–", value: r ? r.walk_min : null };
  };
  const rows: Row[] = [
    { label: "Price", best: "min", cell: (d) => ({ text: gbp(d.result.effectivePrice), value: d.result.effectivePrice }) },
    { label: "Stamp duty estimate", best: "min", cell: (d) => ({ text: gbp(d.stampDuty), value: d.stampDuty }) },
    { label: "Floor area", best: "max", cell: (d) => ({ text: d.property.floor_area_sqft ? `${Math.round(d.property.floor_area_sqft).toLocaleString("en-GB")} sq ft` : "–", value: d.property.floor_area_sqft }) },
    { label: "Bedrooms and bathrooms", cell: (d) => ({ text: `${d.property.beds ?? "?"} bed, ${d.property.baths ?? "?"} bath`, value: null }) },
    { label: "Station walk", best: "min", cell: prox("station") },
    { label: "Park walk", best: "min", cell: prox("park") },
    { label: "Supermarket walk", best: "min", cell: prox("supermarket") },
    { label: "Living room and kitchen", best: "max", cell: (d) => { const r = ratings(s.data, d, me).space; return { text: r ? `${oneDp(r)} of 5` : "Not rated", value: r }; } },
    { label: "Gut feel", best: "max", cell: (d) => { const r = ratings(s.data, d, me).gut; return { text: r ? `${oneDp(r)} of 5` : "Not rated", value: r }; } },
    { label: "Tenure", cell: (d) => ({ text: d.property.tenure ? `${d.property.tenure === "share_of_freehold" ? "Share of freehold" : d.property.tenure[0].toUpperCase() + d.property.tenure.slice(1)}${d.property.lease_years ? `, ${d.property.lease_years} years` : ""}` : "–", value: null }) },
  ];

  const bestSet = (r: Row) => {
    if (!r.best || chosen.length < 2) return new Set<string>();
    const vals = chosen.map((d) => ({ id: d.property.id, v: r.cell(d).value })).filter((x): x is { id: string; v: number } => x.v !== null);
    if (vals.length < 2) return new Set<string>();
    const target = r.best === "min" ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v));
    if (vals.every((x) => x.v === target)) return new Set<string>();
    return new Set(vals.filter((x) => x.v === target).map((x) => x.id));
  };

  const toggle = (id: string) => {
    const cur = ids;
    if (cur.includes(id)) setPicked(cur.filter((x) => x !== id));
    else if (cur.length < 4) setPicked([...cur, id]);
  };

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pt-6 pb-10 md:px-10 md:pt-9">
      <PageHeader title="Compare">{`Your top ${chosen.length} side by side. Highlighted cells mark the best in each row.`}</PageHeader>
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold text-ink-2">Choose two to four homes</legend>
        {all.map((d) => (
          <label key={d.property.id} className="filter has-[:checked]:border-[var(--ink)] has-[:checked]:bg-[var(--ink)] has-[:checked]:text-[var(--bg)]">
            <input type="checkbox" className="sr-only" checked={ids.includes(d.property.id)} disabled={!ids.includes(d.property.id) && ids.length >= 4} onChange={() => toggle(d.property.id)} />
            {splitAddress(d.property.address).street}
          </label>
        ))}
      </fieldset>
      {chosen.length < 2 ? <p className="m-0 text-muted">Pick at least two homes.</p> : (
        <div className="panel overflow-x-auto">
          <table className="cmp">
            <thead>
              <tr>
                <td style={{ borderTop: 0 }} />
                {chosen.map((d) => {
                  const t = d.provisional ? "to_view" : d.tier;
                  return (
                    <th key={d.property.id} scope="col" style={{ borderTop: 0, paddingTop: 20 }}>
                      <div className="flex flex-col gap-3">
                        <Link href={`/property/${d.property.id}`}><Cover src={d.property.cover_image_path} tint={d.property.tint} width="100%" height={120} /></Link>
                        <span className="flex items-center justify-between gap-3">
                          <span className="flex flex-col gap-1">
                            <Link href={`/property/${d.property.id}`} className="text-lg font-bold text-ink no-underline">{splitAddress(d.property.address).street}</Link>
                            <span className="text-[13px] font-semibold" style={{ color: TIER_COLOR[t] }}>{d.rank ? `${d.rank}. ` : ""}{TIER_LABELS[t]}</span>
                          </span>
                          <ScoreRing score={d.result.combined} tier={t} provisional={d.provisional} size={52} label={false} />
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const best = bestSet(r);
                return (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {chosen.map((d) => {
                      const c = r.cell(d);
                      const isBest = best.has(d.property.id);
                      return <td key={d.property.id} className={isBest ? "best" : undefined}>{c.text}{isBest && <><ICheck className="ml-1.5 inline" aria-hidden /><span className="sr-only"> (best)</span></>}</td>;
                    })}
                  </tr>
                );
              })}
              {(["pro", "con"] as const).map((k) => (
                <tr key={k}>
                  <th scope="row">{k === "pro" ? "Biggest pro" : "Biggest con"}</th>
                  {chosen.map((d) => { const items = top(s.data, d, me, k); return <td key={d.property.id}>{items.length ? <ul className="m-0 list-disc pl-4">{items.map((t) => <li key={t}>{t}</li>)}</ul> : <span className="text-muted">–</span>}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
