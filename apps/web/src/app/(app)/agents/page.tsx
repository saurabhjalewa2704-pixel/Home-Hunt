"use client";
import Link from "next/link";
import { useState } from "react";
import { AgentForm } from "@/components/AgentForm";
import { AgentContactButtons, AgentDetails } from "@/components/AgentContact";
import { EmptyState, PageHeader } from "@/components/ui";
import { plural, splitAddress } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function AgentsPage() {
  const s = useStore();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const agents = [...s.data.agents].sort((a, b) => (a.agency ?? "").localeCompare(b.agency ?? "") || a.name.localeCompare(b.name));
  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-6 px-4 pt-6 pb-10 md:px-10 md:pt-9">
      <PageHeader title="Agents" actions={editing !== "new" ? <button className="btn btn-p" onClick={() => setEditing("new")}>Add an agent</button> : undefined}>Everyone you are dealing with, and the homes each one is handling.</PageHeader>
      {editing === "new" && <div className="panel p-5"><AgentForm onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /></div>}
      {!agents.length && editing !== "new" && <EmptyState title="No agents yet" body="Agents are added when you save a home, or here." />}
      {agents.map((a) => {
        const homes = s.data.properties.filter((p) => p.default_agent_id === a.id || s.data.viewings.some((v) => v.property_id === p.id && v.agent_id === a.id));
        return (
          <section key={a.id} className="panel flex flex-col gap-3 p-5" aria-label={a.name}>
            {editing === a.id ? <AgentForm agent={a} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /> : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5"><h2 className="m-0 text-lg font-bold">{a.name}</h2><span className="text-sm text-muted">{[a.agency, a.branch].filter(Boolean).join(", ")}</span></div>
                  <div className="flex flex-wrap gap-2">
                    <AgentContactButtons agent={a} />
                    <button className="btn" onClick={() => setEditing(a.id)}>Edit</button>
                  </div>
                </div>
                <AgentDetails agent={a} />
                {a.notes && <p className="m-0 text-sm text-ink-2">{a.notes}</p>}
                <p className="m-0 text-sm text-muted">{homes.length ? <>{plural(homes.length, "home")}: {homes.map((p, i) => <span key={p.id}>{i ? ", " : ""}<Link href={`/property/${p.id}`}>{splitAddress(p.address).street}</Link></span>)}</> : "Not linked to any home yet."}</p>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
