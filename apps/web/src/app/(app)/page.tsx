"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PropertyRow } from "@/components/PropertyRow";
import { IChevron, IDown, IPlus } from "@/components/icons";
import { Avatar, EmptyState, LinkButton, PageHeader, ScoreRing, cx } from "@/components/ui";
import { activeConfig, deriveAll, TIER_COLOR, TIER_LABELS, TIER_RULES, bedsBaths, type Derived } from "@/lib/derive";
import { fmtDay, fmtTime, gbp, plural, splitAddress } from "@/lib/format";
import { store, useStore } from "@/lib/store";
import { ACTIVE_STATUSES, STATUS_LABELS, STATUSES, type Status } from "@/lib/types";
import type { Tier } from "@homehunt/scoring";
import { statusLine } from "@/components/PropertyRow";

const BASELINE = "hh.ranks.v1";
const TIERS: Tier[] = ["top_pick", "strong", "maybe", "unlikely"];

type Sort = "rank" | "score" | "price" | "viewing" | "added";

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="filter relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer appearance-none border-0 bg-transparent pr-5 outline-none" aria-label={label}>
        {children}
      </select>
      <IDown className="pointer-events-none absolute right-3" />
    </label>
  );
}

export default function BoardPage() {
  const s = useStore();
  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("all");
  const [price, setPrice] = useState("all");
  const [beds, setBeds] = useState("any");
  const [sort, setSort] = useState<Sort>("rank");
  const [view, setView] = useState<"list" | "table">("list");
  const [showOut, setShowOut] = useState(false);
  const [baseline] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(BASELINE) ?? "{}");
    } catch {
      return {};
    }
  });

  const me = s.me!;
  const { config } = activeConfig(s.data);
  const all = useMemo(() => deriveAll(s.data, me), [s.data, me]);

  // Remember today's ranks so the next visit shows what moved (PRD 7, rank movement).
  const latest = useRef<Record<string, number>>({});
  latest.current = Object.fromEntries(all.filter((d) => d.rank).map((d) => [d.property.id, d.rank!]));
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(BASELINE, JSON.stringify(latest.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, []);
  const delta = (d: Derived) => (d.rank && baseline[d.property.id] ? baseline[d.property.id] - d.rank : 0);

  const matches = (d: Derived) => {
    const p = d.property;
    if (status !== "all" && p.status !== status) return false;
    if (tier !== "all" && (d.provisional ? "to_view" : d.tier) !== tier) return false;
    if (price !== "all") {
      const [lo, hi] = price.split("-").map(Number);
      if (p.asking_price < lo || p.asking_price >= hi) return false;
    }
    if (beds !== "any" && (p.beds ?? 0) < Number(beds)) return false;
    return true;
  };

  const inPlay = all.filter((d) => d.active);
  const ruledOut = all.filter((d) => d.tier === "ruled_out" && !d.active || d.property.status === "ruled_out").filter(matches);
  const shown = inPlay.filter((d) => d.tier !== "ruled_out").filter(matches);
  const viewed = inPlay.filter((d) => !d.provisional && d.tier !== "ruled_out").length;
  const autoOut = inPlay.filter((d) => d.tier === "ruled_out" && d.property.status !== "ruled_out").filter(matches);
  const outAll = [...ruledOut, ...autoOut];

  const flat = useMemo(() => {
    const arr = [...shown];
    const t = (d: Derived) => d.nextViewing ? new Date(d.nextViewing.starts_at).getTime() : d.lastViewingAt ?? Infinity;
    if (sort === "score") arr.sort((a, b) => b.result.combined - a.result.combined);
    if (sort === "price") arr.sort((a, b) => a.result.effectivePrice - b.result.effectivePrice);
    if (sort === "viewing") arr.sort((a, b) => t(a) - t(b));
    if (sort === "added") arr.sort((a, b) => b.property.created_at.localeCompare(a.property.created_at));
    return arr;
  }, [shown, sort]);

  const upcoming = all.filter((d) => d.nextViewing).sort((a, b) => a.nextViewing!.starts_at.localeCompare(b.nextViewing!.starts_at));
  const next = upcoming[0];
  const after = upcoming[1];

  if (!s.data.properties.length) {
    return (
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-9 md:px-10">
        <PageHeader title="Board">Every home you are considering will be ranked here.</PageHeader>
        <EmptyState title="Paste your first listing link" body="Copy a link from Rightmove, Zoopla or OnTheMarket and we'll pull in the photo, price and size. You can also enter a home by hand." action={<LinkButton href="/add" primary><IPlus />Add a home</LinkButton>} />
      </div>
    );
  }

  const sections: Array<{ key: string; tier: Tier | "to_view"; items: Derived[] }> = [
    ...TIERS.map((t) => ({ key: t, tier: t, items: shown.filter((d) => !d.provisional && d.tier === t) })),
    { key: "to_view", tier: "to_view" as const, items: shown.filter((d) => d.provisional) },
  ].filter((x) => x.items.length);

  const summary = `${plural(inPlay.filter((d) => d.tier !== "ruled_out").length, "home")} in play, ${viewed} already viewed.${next ? ` Next viewing: ${splitAddress(next.property.address).street}, ${fmtDay(next.nextViewing!.starts_at)} at ${fmtTime(next.nextViewing!.starts_at)}.` : ""}`;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pt-5 pb-8 md:px-10 md:pt-9">
      <div className="flex items-center justify-between md:hidden">
        <h1 className="m-0 text-[32px] leading-9 font-extrabold tracking-[-0.025em]">Board</h1>
        <span className="flex">
          {s.data.members.map((m, i) => <Avatar key={m.id} member={m} size={32} className={i ? "-ml-2.5 shadow-[0_0_0_2px_var(--bg)]" : ""} />)}
        </span>
      </div>
      <div className="hidden md:block">
        <PageHeader title="Board" actions={<LinkButton href="/add" primary><IPlus />Add a home</LinkButton>}>{summary}</PageHeader>
      </div>

      {next && (
        <Link href="/schedule" className="flex items-center gap-3 rounded-[14px] p-3.5 no-underline md:hidden" style={{ background: "var(--dark-card)", color: "var(--dark-card-fg)" }}>
          <span className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-[10px] leading-none" style={{ background: "var(--dark-card-2)" }}>
            <span className="text-[11px] opacity-80">{new Date(next.nextViewing!.starts_at).toLocaleDateString("en-GB", { weekday: "short" })}</span>
            <span className="text-lg font-extrabold">{new Date(next.nextViewing!.starts_at).getDate()}</span>
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">Next: {splitAddress(next.property.address).street}, {fmtTime(next.nextViewing!.starts_at)}</span>
            {after && <span className="text-[13px] opacity-80">Then {splitAddress(after.property.address).street}, {fmtTime(after.nextViewing!.starts_at)}</span>}
          </span>
          <IChevron />
        </Link>
      )}

      <div className="-mx-4 flex flex-nowrap items-center gap-2.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Filters">
        <Select label="Status" value={status} onChange={setStatus}>
          <option value="all">All statuses</option>
          {STATUSES.filter((x: Status) => ACTIVE_STATUSES.includes(x)).map((x) => <option key={x} value={x}>{STATUS_LABELS[x]}</option>)}
        </Select>
        <Select label="Tier" value={tier} onChange={setTier}>
          <option value="all">All tiers</option>
          {[...TIERS, "to_view" as const].map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </Select>
        <Select label="Price" value={price} onChange={setPrice}>
          <option value="all">Any price</option>
          <option value="0-650000">Under £650,000</option>
          <option value="650000-700000">£650,000 to £700,000</option>
          <option value="700000-751000">£700,000 to £750,000</option>
        </Select>
        <Select label="Bedrooms" value={beds} onChange={setBeds}>
          <option value="any">Any bedrooms</option>
          <option value="2">2+ bedrooms</option>
          <option value="3">3+ bedrooms</option>
        </Select>
        <span className="flex-1" />
        <Select label="Sort by" value={sort} onChange={(v) => setSort(v as Sort)}>
          <option value="rank">Sort: rank</option>
          <option value="score">Sort: score</option>
          <option value="price">Sort: price</option>
          <option value="viewing">Sort: viewing date</option>
          <option value="added">Sort: recently added</option>
        </Select>
        <span className="hidden gap-1 md:flex" role="group" aria-label="Layout">
          <button className="filter" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          <button className="filter" aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
        </span>
      </div>
      <p className="m-0 hidden text-[13px] text-muted md:block">Walk bars show minutes on foot; the dashed line is your 15-minute limit.</p>

      {view === "table" ? (
        <BoardTable items={sort === "rank" ? sections.flatMap((x) => x.items) : flat} members={s.data.members} />
      ) : sort !== "rank" ? (
        <Group title="All homes" rule={`Sorted by ${sort === "viewing" ? "viewing date" : sort === "added" ? "most recently added" : sort}`} color="var(--muted)" items={flat} members={s.data.members} config={config} delta={delta} />
      ) : (
        sections.map((sec) => (
          <Group key={sec.key} title={TIER_LABELS[sec.tier]} rule={TIER_RULES[sec.tier]} color={TIER_COLOR[sec.tier]} items={sec.items} members={s.data.members} config={config} delta={delta} />
        ))
      )}

      {!shown.length && <EmptyState title="Nothing matches those filters" body="Try clearing a filter to see more homes." action={<button className="btn" onClick={() => { setStatus("all"); setTier("all"); setPrice("all"); setBeds("any"); }}>Clear filters</button>} />}

      {outAll.length > 0 && (
        <section className="flex flex-col gap-3">
          <button type="button" aria-expanded={showOut} onClick={() => setShowOut((v) => !v)} className="flex min-h-14 items-center justify-between gap-4 rounded-[14px] border border-dashed bg-transparent px-6 text-left" style={{ borderColor: "var(--btn-border)" }}>
            <span className="flex flex-wrap items-center gap-x-3">
              <span className="text-base font-bold text-ink-2">Ruled out ({outAll.length})</span>
              <span className="text-sm text-muted">{outAll.map((d) => splitAddress(d.property.address).street).join(", ")}</span>
            </span>
            <span className="text-sm font-semibold text-accent">{showOut ? "Hide" : "Show"}</span>
          </button>
          {showOut && (
            <div className="panel divide-y divide-line-2 overflow-hidden opacity-90">
              {outAll.map((d) => (
                <div key={d.property.id}>
                  <PropertyRow d={d} members={s.data.members} config={config} />
                  <div className="flex flex-wrap items-center gap-3 px-6 pb-4 text-sm text-muted">
                    {d.property.ruled_out_reason ?? d.result.hardGate?.detail}
                    <button className="btn !min-h-9 !px-3" onClick={() => void store.setStatus(d.property.id, "shortlisted")}>Bring back</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Group({ title, rule, color, items, members, config, delta }: { title: string; rule: string; color: string; items: Derived[]; members: ReturnType<typeof useStore>["data"]["members"]; config: ReturnType<typeof activeConfig>["config"]; delta: (d: Derived) => number }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="m-0 inline-flex items-center gap-2.5 text-base font-bold md:text-xl"><span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: color }} />{title}</h2>
        <span className="hidden text-sm text-muted md:inline">{rule}</span>
      </div>
      <div className="flex flex-col gap-2 md:gap-0 md:overflow-hidden md:rounded-[14px] md:border md:border-line md:bg-surface">
        {items.map((d) => (
          <div key={d.property.id} className="rounded-[14px] border border-line bg-surface md:rounded-none md:border-0 md:border-t md:border-line-2 md:first:border-t-0">
            <PropertyRow d={d} members={members} config={config} delta={delta(d)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BoardTable({ items, members }: { items: Derived[]; members: ReturnType<typeof useStore>["data"]["members"] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-[15px]">
        <thead>
          <tr className="text-left text-[13px] text-muted">
            {["Rank", "Home", "Status", "Price", "Size", "Station", ...members.map((m) => m.display_name), "Score"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.property.id} className="border-t border-line-2 hover:bg-surface-2">
              <td className="px-4 py-3 font-bold">{d.rank ?? "–"}</td>
              <th scope="row" className="px-4 py-3 text-left font-semibold"><Link href={`/property/${d.property.id}`} className="text-ink">{splitAddress(d.property.address).street}</Link></th>
              <td className="px-4 py-3">{statusLine(d)}</td>
              <td className="px-4 py-3">{gbp(d.property.asking_price)}</td>
              <td className="px-4 py-3">{bedsBaths(d.property)}</td>
              <td className="px-4 py-3">{d.minutes.station != null ? `${d.minutes.station} min` : "–"}</td>
              {members.map((m) => <td key={m.id} className="px-4 py-3">{d.result.memberScores[m.id] && !d.provisional ? Math.round(d.result.memberScores[m.id].score) : "–"}</td>)}
              <td className="px-4 py-3"><ScoreRing score={d.result.combined} tier={d.provisional ? "to_view" : d.tier} provisional={d.provisional} size={40} label={false} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

void cx;
