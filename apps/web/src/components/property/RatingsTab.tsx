"use client";
import Link from "next/link";
import { visibleFor } from "@/lib/derive";
import { QUALITY_ITEMS, RATING_WORDS, SPACE_QUESTIONS, STREET_ITEM, roomItems } from "@/lib/rooms";
import { Avatar, cx } from "../ui";
import type { Ctx } from "./ctx";

export function RatingsTab({ ctx }: { ctx: Ctx }) {
  const { d, data, me, other } = ctx;
  const p = d.property;
  const vis = visibleFor(data, p.id, me.id);
  const mine = vis.assessments.find((a) => a.member_id === me.id);
  const theirs = other ? vis.assessments.find((a) => a.member_id === other.id) : undefined;

  if (!vis.iSubmitted) {
    return (
      <div className="panel flex flex-col items-start gap-3 p-6">
        <h2 className="m-0 text-xl font-bold">Rate it first, then compare</h2>
        <p className="m-0 max-w-[60ch] text-muted">To keep your own first impressions honest, {other?.display_name ?? "your partner"}'s ratings stay hidden until you have submitted yours. It takes under five minutes.</p>
        <Link className="btn btn-p" href={`/property/${p.id}/rate`}>Rate this viewing</Link>
      </div>
    );
  }

  const rows: Array<{ label: string; get: (a: NonNullable<typeof mine>) => number | null | undefined }> = [
    ...roomItems(p).map((r) => ({ label: r.label, get: (a: NonNullable<typeof mine>) => a.ratings[r.key] })),
    ...SPACE_QUESTIONS.map((q) => ({ label: q.label, get: (a: NonNullable<typeof mine>) => a[q.key] })),
    ...QUALITY_ITEMS.map((r) => ({ label: r.label, get: (a: NonNullable<typeof mine>) => a.ratings[r.key] })),
    { label: STREET_ITEM.label, get: (a) => a.ratings.street },
    { label: "Could you see yourselves living here?", get: (a) => a.gut_feel },
  ];

  const cell = (v: number | null | undefined, other: number | null | undefined) => {
    if (v == null || v <= 0) return <span className="text-muted">{v === -1 ? "Not here" : "–"}</span>;
    const differs = other != null && other > 0 && Math.abs(v - other) >= 2;
    return (
      <span className={cx("inline-flex items-center gap-2", differs && "rounded-md px-1.5 font-bold")} style={differs ? { background: "var(--split-bg)", color: "var(--split-fg)" } : undefined}>
        {v} <span className="text-[12.5px] font-normal text-muted">{RATING_WORDS[v]}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">Our ratings</h2>
        <Link className="btn" href={`/property/${p.id}/rate`}>Edit my rating</Link>
      </div>
      {!theirs && <p className="m-0 text-sm text-muted">Waiting for {other?.display_name} to rate this one.</p>}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-[15px]">
          <thead><tr className="text-left text-[13px] text-muted">
            <th scope="col" className="px-5 py-3 font-semibold">Item</th>
            <th scope="col" className="px-3 py-3 font-semibold"><span className="inline-flex items-center gap-1.5"><Avatar member={me} />{me.display_name}</span></th>
            <th scope="col" className="px-3 py-3 font-semibold"><span className="inline-flex items-center gap-1.5"><Avatar member={other} />{other?.display_name}</span></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const a = mine && r.get(mine);
              const b = theirs ? r.get(theirs) : undefined;
              if ((a == null || a === 0) && (b == null || b === 0)) return null;
              return (
                <tr key={r.label} className="border-t border-line-2">
                  <th scope="row" className="px-5 py-3 text-left font-medium">{r.label}</th>
                  <td className="px-3 py-3">{cell(a, b)}</td>
                  <td className="px-3 py-3">{theirs ? cell(b, a) : <span className="text-muted">Not yet</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {[mine, theirs].map((a, i) => a?.note && (
        <p key={i} className="m-0 text-sm text-ink-2"><strong>{i === 0 ? me.display_name : other?.display_name}:</strong> {a.note}</p>
      ))}
      <p className="m-0 text-[13px] text-muted">Highlighted rows are two or more points apart.</p>
    </div>
  );
}
