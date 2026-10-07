"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { haversine } from "@homehunt/geo";
import { IPhone, IPin, ITrain, IWalk } from "@/components/icons";
import { Avatar, Cover, EmptyState, PageHeader } from "@/components/ui";
import { deriveAll, type Derived } from "@/lib/derive";
import { clashes, downloadText, viewingIcs } from "@/lib/ics";
import { dayKey, fmtLongDay, fmtTime, plural, splitAddress } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Member, Viewing } from "@/lib/types";
import { TIER_LABELS } from "@/lib/derive";

interface Entry { v: Viewing; d: Derived }

function leg(a: Entry, b: Entry): { walk: boolean; min: number; label: string } | null {
  const pa = a.d.property, pb = b.d.property;
  if (pa.lat == null || pb.lat == null || pa.lng == null || pb.lng == null) return null;
  const m = haversine({ lat: pa.lat, lng: pa.lng }, { lat: pb.lat, lng: pb.lng });
  if (m < 1800) {
    const min = Math.max(2, Math.round((m * 1.3) / 80));
    return { walk: true, min, label: `${min} min walk` };
  }
  const min = Math.round(10 + (m * 1.3) / 400);
  return { walk: false, min, label: `About ${min} min by train or bus` };
}

const mapsUrl = (d: Derived) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${d.property.address} ${d.property.postcode ?? ""}`)}&travelmode=transit`;

function Stop({ e, now, members }: { e: Entry; now: number; members: Member[] }) {
  const { v, d } = e;
  const p = d.property;
  const past = new Date(v.starts_at).getTime() + v.duration_min * 60_000 < now;
  const rated = d.iSubmitted;
  const tel = (d.agent?.mobile || d.agent?.phone || "").replace(/\s+/g, "");
  const att = v.attendees;
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 md:grid-cols-[64px_minmax(0,1fr)]">
      <span className="pt-3.5 text-[15px] font-bold" style={{ color: past ? "var(--muted)" : undefined }}>{fmtTime(v.starts_at)}</span>
      <div className="panel flex flex-col gap-3 p-3.5" style={past && !rated ? { borderColor: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" } : undefined}>
        <div className="flex items-center gap-3">
          <Cover src={p.cover_image_path} tint={p.tint} width={56} height={44} radius={8} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link href={`/property/${p.id}`} className="text-base font-bold text-ink no-underline">{splitAddress(p.address).street}</Link>
            <span className="text-[13px] text-muted">
              {v.status === "cancelled" ? "Cancelled. " : v.status === "no_show" ? "No-show. " : ""}
              {v.kind === "second" ? "Second viewing" : v.kind === "survey" ? "Survey" : "First viewing"}
              {!d.provisional && v.kind === "second" ? `. ${TIER_LABELS[d.tier]}, score ${Math.round(d.result.combined)}` : ""}
              {past && !rated ? ". Neither of you has rated it yet." : ""}
            </span>
          </span>
          <span className="flex -space-x-1.5">{att.map((id) => <Avatar key={id} member={members.find((m) => m.id === id)} />)}</span>
        </div>
        {v.notes && <p className="m-0 text-sm leading-5 text-ink-2">Your notes: {v.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {past && !rated && v.status !== "cancelled" && <Link className="btn btn-p flex-1" href={`/property/${p.id}/rate`}>Rate now</Link>}
          {tel && <a className="btn flex-1" href={`tel:${tel}`}><IPhone />Call {d.agent?.name.split(" ")[0]}</a>}
          <a className="btn flex-1" href={mapsUrl(d)} target="_blank" rel="noopener noreferrer"><IPin />Directions</a>
          {!past && v.status === "booked" && <button className="btn" onClick={() => downloadText(`viewing-${splitAddress(p.address).street.replace(/\W+/g, "-").toLowerCase()}.ics`, viewingIcs(v, p, d.agent))}>.ics</button>}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ days, onPick }: { days: Map<string, number>; onPick: (k: string) => void }) {
  const [off, setOff] = useState(0);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + off);
  const y = base.getFullYear(), m = base.getMonth();
  const lead = (base.getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: lead + n }, (_, i) => (i < lead ? null : i - lead + 1));
  const today = dayKey(new Date());
  return (
    <section className="panel hidden p-5 md:block" aria-label="Month calendar">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-lg font-bold">{base.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        <span className="flex gap-1.5"><button className="btn !min-h-9" onClick={() => setOff(off - 1)} aria-label="Previous month">‹</button><button className="btn !min-h-9" onClick={() => setOff(off + 1)} aria-label="Next month">›</button></span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[12.5px] font-semibold text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <span key={i} />;
          const k = dayKey(new Date(y, m, c));
          const count = days.get(k) ?? 0;
          return (
            <button key={i} disabled={!count} onClick={() => onPick(k)} aria-label={`${c} ${base.toLocaleDateString("en-GB", { month: "long" })}${count ? `, ${plural(count, "viewing")}` : ""}`}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm" style={{ borderColor: k === today ? "var(--accent)" : "var(--line-2)", background: count ? "var(--accent-soft)" : "transparent", fontWeight: count ? 700 : 400, color: count ? "var(--ink)" : "var(--muted)" }}>
              {c}{count > 0 && <span className="text-[10.5px]">{count}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function SchedulePage() {
  const s = useStore();
  const me = s.me!;
  const all = useMemo(() => deriveAll(s.data, me), [s.data, me]);
  const now = Date.now();
  const entries: Entry[] = all.flatMap((d) => d.viewings.map((v) => ({ v, d }))).sort((a, b) => a.v.starts_at.localeCompare(b.v.starts_at));
  const today = dayKey(new Date());

  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.v.status === "cancelled") continue;
    const k = dayKey(e.v.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const todayList = byDay.get(today) ?? [];
  // Past viewings without both assessments keep a "Rate now" entry until they're rated (FR-V2).
  const overdue = entries.filter((e) => dayKey(e.v.starts_at) < today && e.v.status !== "cancelled" && !e.d.iSubmitted && e.v.kind !== "survey");
  const upcomingDays = [...byDay.keys()].filter((k) => k > today).sort();
  const counts = new Map([...byDay].map(([k, v]) => [k, v.length]));
  const clash = clashes(entries.map((e) => e.v));

  if (!entries.length) {
    return <div className="mx-auto max-w-[760px] px-4 py-9 md:px-10"><PageHeader title="Schedule">Your viewings, by day.</PageHeader><div className="mt-6"><EmptyState title="No viewings booked" body="Open a home and choose Book a viewing once the agent confirms a time." action={<Link className="btn btn-p" href="/">Go to the board</Link>} /></div></div>;
  }

  const day = (k: string, list: Entry[], pinned = false) => (
    <section key={k} id={`day-${k}`} className="flex flex-col gap-2" aria-label={fmtLongDay(list[0].v.starts_at)}>
      <h2 className="m-0 text-lg font-bold">{pinned ? "Today" : fmtLongDay(list[0].v.starts_at)}<span className="ml-2 text-sm font-normal text-muted">{pinned ? `${fmtLongDay(list[0].v.starts_at)}, ` : ""}{plural(list.length, "viewing")}</span></h2>
      {list.map((e, i) => {
        const nxt = list[i + 1];
        const l = nxt ? leg(e, nxt) : null;
        const leaveBy = l && nxt ? new Date(new Date(nxt.v.starts_at).getTime() - (l.min + 5) * 60_000) : null;
        return (
          <div key={e.v.id} className="flex flex-col gap-2">
            <Stop e={e} now={now} members={s.data.members} />
            {l && leaveBy && (
              <div className="flex items-center gap-2 py-0.5 pl-[64px] text-[13px] text-muted">{l.walk ? <IWalk /> : <ITrain />}{l.label}. Leave by {fmtTime(leaveBy.toISOString())}. <span className="opacity-70">Estimate</span></div>
            )}
          </div>
        );
      })}
    </section>
  );

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pt-5 pb-8 md:px-10 md:pt-9">
      <PageHeader title={todayList.length ? "Today" : "Schedule"}>{todayList.length ? `${fmtLongDay(new Date().toISOString())}, ${plural(todayList.length, "viewing")}` : "Your viewings, by day."}</PageHeader>
      {clash.length > 0 && (
        <p role="alert" className="m-0 rounded-xl p-3 text-sm chip-warn">{clash.length === 1 ? "Two viewings are too close together." : `${clash.length} pairs of viewings are too close together.`} Check the travel time between {splitAddress(s.data.properties.find((p) => p.id === clash[0][0].property_id)?.address ?? "").street} and {splitAddress(s.data.properties.find((p) => p.id === clash[0][1].property_id)?.address ?? "").street}.</p>
      )}
      <MonthGrid days={counts} onPick={(k) => { document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      {overdue.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Rate now">
          <h2 className="m-0 text-lg font-bold">Rate now</h2>
          {overdue.map((e) => <Stop key={e.v.id} e={e} now={now} members={s.data.members} />)}
        </section>
      )}
      {todayList.length > 0 ? day(today, todayList, true) : <p className="m-0 text-muted">Nothing booked for today.</p>}
      {upcomingDays.map((k) => day(k, byDay.get(k)!))}
      <p className="m-0 flex items-center gap-2 text-[13px] text-muted"><span aria-hidden>✓</span>Your upcoming viewings are saved on this device, so they open without signal.</p>
    </div>
  );
}
