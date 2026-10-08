"use client";
import { useState } from "react";
import { clashes, downloadText, viewingIcs } from "@/lib/ics";
import { bestPhone, fmtLongDay, fmtTime, fmtWhen, splitAddress, telHref } from "@/lib/format";
import { store } from "@/lib/store";
import type { Viewing, ViewingKind, ViewingStatus } from "@/lib/types";
import { IPhone, IWarn } from "../icons";
import { Avatar, cx } from "../ui";
import type { Ctx } from "./ctx";

const KIND: Record<ViewingKind, string> = { first: "First viewing", second: "Second viewing", survey: "Survey" };
const STATUS: Record<ViewingStatus, string> = { booked: "Booked", done: "Done", cancelled: "Cancelled", no_show: "No-show" };

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ViewingForm({ ctx, viewing, defaultKind = "first", onDone }: { ctx: Ctx; viewing?: Viewing; defaultKind?: ViewingKind; onDone: () => void }) {
  const p = ctx.d.property;
  const [when, setWhen] = useState(viewing ? toLocalInput(viewing.starts_at) : "");
  const [kind, setKind] = useState<ViewingKind>(viewing?.kind ?? defaultKind);
  const [dur, setDur] = useState(String(viewing?.duration_min ?? 30));
  const [agent, setAgent] = useState(viewing?.agent_id ?? p.default_agent_id ?? "");
  const [att, setAtt] = useState<string[]>(viewing?.attendees ?? ctx.members.map((m) => m.id));
  const [notes, setNotes] = useState(viewing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const candidate: Viewing | null = when ? { id: viewing?.id ?? "new", property_id: p.id, agent_id: agent || null, starts_at: new Date(when).toISOString(), duration_min: Number(dur) || 30, status: "booked", attendees: att, notes: null, kind } : null;
  const others = ctx.data.viewings.filter((v) => v.id !== viewing?.id);
  const conflict = candidate ? clashes([...others, candidate]).find(([a, b]) => a.id === candidate.id || b.id === candidate.id) : undefined;
  const other = conflict ? (conflict[0].id === candidate!.id ? conflict[1] : conflict[0]) : null;
  const otherProp = other && ctx.data.properties.find((x) => x.id === other.property_id);

  return (
    <form className="flex flex-col gap-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!when || busy) return;
      setBusy(true);
      await store.saveViewing({ ...(viewing ?? {}), property_id: p.id, agent_id: agent || null, starts_at: new Date(when).toISOString(), duration_min: Number(dur) || 30, attendees: att, notes: notes || null, kind });
      setBusy(false);
      onDone();
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="vf-when">Date and time</label><input id="vf-when" className="inp" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="vf-kind">Type</label>
          <select id="vf-kind" className="inp" value={kind} onChange={(e) => setKind(e.target.value as ViewingKind)}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="vf-dur">Length (minutes)</label><input id="vf-dur" className="inp" type="number" min={10} step={5} value={dur} onChange={(e) => setDur(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="vf-agent">Agent</label>
          <select id="vf-agent" className="inp" value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">No agent</option>{ctx.data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.agency ? `, ${a.agency}` : ""}</option>)}</select></div>
      </div>
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0"><legend className="lab mb-1.5">Who is going</legend>
        {ctx.members.map((m) => (
          <label key={m.id} className="inline-flex min-h-11 items-center gap-2 text-[15px]">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={att.includes(m.id)} onChange={(e) => setAtt((a) => (e.target.checked ? [...a, m.id] : a.filter((x) => x !== m.id)))} />
            <Avatar member={m} />{m.display_name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="vf-notes">Things to check</label><textarea id="vf-notes" className="inp" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {conflict && other && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-xl p-3 text-sm chip-warn"><IWarn className="mt-0.5 flex-none" />
          {conflict[2] === "overlap" ? "This overlaps with" : "This is less than 15 minutes after or before"} {splitAddress(otherProp?.address ?? "another viewing").street} at {fmtTime(other.starts_at)}. Allow time to travel between them.
        </p>
      )}
      <div className="flex justify-end gap-2.5"><button type="button" className="btn" onClick={onDone}>Cancel</button><button className="btn btn-p" disabled={!when || busy}>{viewing ? "Save viewing" : "Book viewing"}</button></div>
    </form>
  );
}

export function ViewingsTab({ ctx }: { ctx: Ctx }) {
  const { d, data } = ctx;
  const p = d.property;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const list = [...d.viewings].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const iRatedIt = d.iSubmitted;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">Viewings</h2>
        {editing !== "new" && <button className="btn btn-p" onClick={() => setEditing("new")}>Add a viewing</button>}
      </div>
      {editing === "new" && <div className="panel p-5"><ViewingForm ctx={ctx} onDone={() => setEditing(null)} defaultKind={d.viewings.length ? "second" : "first"} /></div>}
      {!list.length && editing !== "new" && <p className="m-0 text-muted">No viewings yet. Book one when the agent confirms a time.</p>}
      {list.map((v) => {
        const agent = data.agents.find((a) => a.id === v.agent_id);
        const past = new Date(v.starts_at).getTime() < Date.now();
        return (
          <div key={v.id} className="panel flex flex-col gap-3 p-5">
            {editing === v.id ? (
              <ViewingForm ctx={ctx} viewing={v} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-bold">{fmtLongDay(v.starts_at)}, {fmtTime(v.starts_at)}</span>
                    <span className="text-sm text-muted">{KIND[v.kind]}, {v.duration_min} minutes{agent ? `, with ${agent.name}` : ""}</span>
                  </div>
                  <span className={cx("chip", v.status === "cancelled" || v.status === "no_show" ? "chip-warn" : "")}>{STATUS[v.status]}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">Going: {v.attendees.map((id) => <Avatar key={id} member={ctx.members.find((m) => m.id === id)} />)}</div>
                {v.notes && <p className="m-0 text-sm leading-5 text-ink-2">{v.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  {agent && v.status === "booked" && !past && telHref(bestPhone(agent)) && <a className="btn" href={`tel:${telHref(bestPhone(agent))}`}><IPhone />Call {agent.name.split(" ")[0]}</a>}
                  {v.status === "booked" && <button className="btn" onClick={() => downloadText(`viewing-${splitAddress(p.address).street.replace(/\W+/g, "-").toLowerCase()}.ics`, viewingIcs(v, p, agent ?? null))}>Add to calendar (.ics)</button>}
                  {past && v.status === "booked" && !iRatedIt && <a className="btn btn-p" href={`/property/${p.id}/rate`}>Rate now</a>}
                  <button className="btn" onClick={() => setEditing(v.id)}>Edit</button>
                  {v.status === "booked" && <button className="btn" onClick={() => void store.saveViewing({ ...v, status: "cancelled" })}>Cancel viewing</button>}
                  {v.status === "booked" && past && <button className="btn" onClick={() => void store.saveViewing({ ...v, status: "no_show" })}>No-show</button>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
