"use client";
import { useState } from "react";
import { isEmail, telHref } from "@/lib/format";
import { store } from "@/lib/store";
import type { Agent } from "@/lib/types";

type Key = "name" | "agency" | "branch" | "mobile" | "phone" | "email";
const FIELDS: Array<{ k: Key; label: string; type: string; hint?: string; auto?: string }> = [
  { k: "name", label: "Name", type: "text", auto: "off" },
  { k: "agency", label: "Agency", type: "text", auto: "off" },
  { k: "branch", label: "Branch", type: "text", auto: "off" },
  { k: "mobile", label: "Mobile", type: "tel", hint: "The Call and Text buttons use this first.", auto: "off" },
  { k: "phone", label: "Office phone", type: "tel", auto: "off" },
  { k: "email", label: "Email", type: "email", auto: "off" },
];

export function AgentForm({ agent, onSaved, onCancel }: { agent?: Agent; onSaved: (a: Agent) => void | Promise<void>; onCancel?: () => void }) {
  const [f, setF] = useState({ name: agent?.name ?? "", agency: agent?.agency ?? "", branch: agent?.branch ?? "", phone: agent?.phone ?? "", mobile: agent?.mobile ?? "", email: agent?.email ?? "", notes: agent?.notes ?? "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const id = agent?.id ?? "new";
  const bad = (k: Key) => (k === "mobile" || k === "phone" ? !!f[k].trim() && !telHref(f[k]) : k === "email" ? !!f.email.trim() && !isEmail(f.email) : false);
  const invalid = FIELDS.some(({ k }) => bad(k));
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      if (invalid) return;
      const a = await store.saveAgent({ id: agent?.id, name: f.name.trim(), agency: f.agency.trim() || null, branch: f.branch.trim() || null, phone: f.phone.trim() || null, mobile: f.mobile.trim() || null, email: f.email.trim() || null, notes: f.notes.trim() || null });
      await onSaved(a);
    }}>
      {FIELDS.map(({ k, label, type, hint, auto }) => (
        <div key={k} className="flex flex-col gap-1.5">
          <label className="lab" htmlFor={`ag-${id}-${k}`}>{label}</label>
          <input id={`ag-${id}-${k}`} className="inp" type={type} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} autoComplete={auto} required={k === "name"} value={f[k]} onChange={set(k)} aria-invalid={bad(k) || undefined} aria-describedby={bad(k) || hint ? `ag-${id}-${k}-note` : undefined} />
          {(bad(k) || hint) && <span id={`ag-${id}-${k}-note`} className="text-[13px]" style={bad(k) ? { color: "var(--danger)" } : { color: "var(--muted)" }}>{bad(k) ? (k === "email" ? "That doesn't look like an email address." : "That doesn't look like a phone number.") : hint}</span>}
        </div>
      ))}
      <div className="flex flex-col gap-1.5 sm:col-span-2"><label className="lab" htmlFor={`ag-${id}-notes`}>Notes</label><textarea id={`ag-${id}-notes`} className="inp" rows={2} value={f.notes} onChange={set("notes")} /></div>
      <div className="flex gap-2.5 sm:col-span-2"><button className="btn btn-p" disabled={!f.name.trim() || invalid}>Save agent</button>{onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}</div>
    </form>
  );
}
