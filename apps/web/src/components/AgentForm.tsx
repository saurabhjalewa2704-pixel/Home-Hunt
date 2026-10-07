"use client";
import { useState } from "react";
import { store } from "@/lib/store";
import type { Agent } from "@/lib/types";

export function AgentForm({ agent, onSaved, onCancel }: { agent?: Agent; onSaved: (a: Agent) => void | Promise<void>; onCancel?: () => void }) {
  const [f, setF] = useState({ name: agent?.name ?? "", agency: agent?.agency ?? "", branch: agent?.branch ?? "", phone: agent?.phone ?? "", mobile: agent?.mobile ?? "", email: agent?.email ?? "", notes: agent?.notes ?? "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const id = agent?.id ?? "new";
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const a = await store.saveAgent({ id: agent?.id, name: f.name.trim(), agency: f.agency || null, branch: f.branch || null, phone: f.phone || null, mobile: f.mobile || null, email: f.email || null, notes: f.notes || null });
      await onSaved(a);
    }}>
      {([["name", "Name", "text", true], ["agency", "Agency", "text"], ["branch", "Branch", "text"], ["phone", "Phone", "tel"], ["mobile", "Mobile", "tel"], ["email", "Email", "email"]] as const).map(([k, l, t, req]) => (
        <div key={k} className="flex flex-col gap-1.5"><label className="lab" htmlFor={`ag-${id}-${k}`}>{l}</label><input id={`ag-${id}-${k}`} className="inp" type={t} required={!!req} value={f[k]} onChange={set(k)} /></div>
      ))}
      <div className="flex flex-col gap-1.5 sm:col-span-2"><label className="lab" htmlFor={`ag-${id}-notes`}>Notes</label><textarea id={`ag-${id}-notes`} className="inp" rows={2} value={f.notes} onChange={set("notes")} /></div>
      <div className="flex gap-2.5 sm:col-span-2"><button className="btn btn-p" disabled={!f.name.trim()}>Save agent</button>{onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}</div>
    </form>
  );
}
