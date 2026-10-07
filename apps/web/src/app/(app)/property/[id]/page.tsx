"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AgentTab } from "@/components/property/AgentTab";
import { CostsTab } from "@/components/property/CostsTab";
import type { Ctx } from "@/components/property/ctx";
import { PropertyHeader } from "@/components/property/Header";
import { LocationTab } from "@/components/property/LocationTab";
import { OverviewTab } from "@/components/property/OverviewTab";
import { ProsConsTab } from "@/components/property/ProsConsTab";
import { RatingsTab } from "@/components/property/RatingsTab";
import { ScoreTab } from "@/components/property/ScoreTab";
import { ViewingsTab } from "@/components/property/ViewingsTab";
import { EmptyState } from "@/components/ui";
import { activeConfig, deriveAll } from "@/lib/derive";
import { useStore } from "@/lib/store";

const TABS = [
  ["overview", "Overview"],
  ["viewings", "Viewings"],
  ["ratings", "Our ratings"],
  ["proscons", "Pros and cons"],
  ["location", "Location"],
  ["agent", "Agent"],
  ["score", "Score"],
  ["costs", "Costs"],
] as const;
type Tab = (typeof TABS)[number][0];

function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>("score");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some(([k]) => k === h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return [tab, (t) => { setTab(t); history.replaceState(null, "", `#${t}`); }];
}

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const s = useStore();
  const [tab, setTab] = useHashTab();
  const all = useMemo(() => deriveAll(s.data, s.me!), [s.data, s.me]);
  const d = all.find((x) => x.property.id === id);

  if (!d) {
    return <div className="mx-auto max-w-[760px] px-4 py-10"><EmptyState title="We can't find that home" body="It may have been deleted, or it belongs to a different household." action={<Link className="btn btn-p" href="/">Back to the board</Link>} /></div>;
  }

  const me = s.data.members.find((m) => m.id === s.me)!;
  const ctx: Ctx = {
    d,
    data: s.data,
    me,
    other: s.data.members.find((m) => m.id !== s.me),
    members: s.data.members,
    config: activeConfig(s.data).config,
    rankOf: d.rank,
    rankedCount: all.filter((x) => x.rank).length,
  };

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pt-4 pb-10 md:px-10 md:pt-7">
      <PropertyHeader ctx={ctx} />
      <nav aria-label="Property sections" className="-mx-4 flex overflow-x-auto border-b border-line px-4 md:mx-0 md:flex-wrap md:px-0">
        {TABS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="tab" aria-current={tab === k ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(k); }}>{label}</a>
        ))}
      </nav>
      <div id={`tab-${tab}`}>
        {tab === "overview" && <OverviewTab ctx={ctx} />}
        {tab === "viewings" && <ViewingsTab ctx={ctx} />}
        {tab === "ratings" && <RatingsTab ctx={ctx} />}
        {tab === "proscons" && <ProsConsTab ctx={ctx} />}
        {tab === "location" && <LocationTab ctx={ctx} />}
        {tab === "agent" && <AgentTab ctx={ctx} />}
        {tab === "score" && <ScoreTab ctx={ctx} />}
        {tab === "costs" && <CostsTab ctx={ctx} />}
      </div>
    </div>
  );
}
