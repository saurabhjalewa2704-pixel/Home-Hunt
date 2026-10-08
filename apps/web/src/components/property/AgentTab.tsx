"use client";
import { useState } from "react";
import { store } from "@/lib/store";
import { AgentContactButtons, AgentDetails } from "../AgentContact";
import type { Ctx } from "./ctx";
import { AgentForm } from "../AgentForm";

export function AgentCard({ a }: { a: NonNullable<Ctx["d"]["agent"]> }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[15px] font-semibold">{a.name}</span>
      <span className="text-sm text-muted">{[a.agency, a.branch ? `${a.branch} branch` : null].filter(Boolean).join(", ")}</span>
      <AgentDetails agent={a} />
      <div className="flex flex-wrap gap-2"><AgentContactButtons agent={a} showNumber /></div>
      {a.notes && <p className="m-0 text-sm text-muted">{a.notes}</p>}
    </div>
  );
}

export function AgentTab({ ctx }: { ctx: Ctx }) {
  const { d, data } = ctx;
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-xl font-bold">Agent</h2>
      <div className="panel flex flex-col gap-4 p-5">
        {d.agent ? <AgentCard a={d.agent} /> : <p className="m-0 text-muted">No agent linked to this home yet.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[240px] flex-col gap-1.5 text-[13.5px] font-semibold text-ink-2">Default agent for this home
            <select className="inp" value={d.property.default_agent_id ?? ""} onChange={(e) => void store.saveProperty({ ...d.property, default_agent_id: e.target.value || null })}>
              <option value="">None</option>{data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.agency ? `, ${a.agency}` : ""}</option>)}
            </select></label>
          <button className="btn" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add a new agent"}</button>
        </div>
        {adding && <AgentForm onSaved={async (a) => { await store.saveProperty({ ...d.property, default_agent_id: a.id }); setAdding(false); }} />}
      </div>
    </div>
  );
}
