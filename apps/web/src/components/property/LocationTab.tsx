"use client";
import { useState } from "react";
import { CATEGORY_LABEL } from "@/lib/rooms";
import { refreshProximity } from "@/lib/proximity-client";
import { store } from "@/lib/store";
import type { Proximity } from "@/lib/types";
import { IWalk } from "../icons";
import { cx } from "../ui";
import type { Ctx } from "./ctx";
import { memberOf } from "./ctx";

const ORDER = ["station", "park", "supermarket", "convenience", "gym", "restaurants"] as const;
const LIMIT: Record<string, "stationMax" | "parkMax" | "supermarketMax" | undefined> = { station: "stationMax", park: "parkMax", supermarket: "supermarketMax" };

export function WalkList({ ctx, compact }: { ctx: Ctx; compact?: boolean }) {
  const rows = ORDER.map((c) => ctx.d.proximity.find((p) => p.category === c)).filter((x): x is Proximity => !!x && (!compact || x.category !== "convenience"));
  return (
    <div>
      {rows.map((r) => {
        const lim = LIMIT[r.category] ? ctx.config.softGates[LIMIT[r.category]!] : null;
        const over = lim != null && r.walk_min > lim;
        const editor = r.source === "manual" ? memberOf(ctx, r.edited_by ?? "")?.display_name : null;
        return (
          <div key={r.id} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2 border-t border-line-2 py-2.5 text-sm first:border-t-0">
            <span className="font-semibold">{CATEGORY_LABEL[r.category]}</span>
            <span>{r.place_name} <span className="badge" style={r.source === "manual" ? { background: "var(--split-bg)", color: "var(--split-fg)" } : undefined}>{editor ? `Edited by ${editor}` : r.source === "manual" ? "Edited" : r.method === "estimated" ? "Estimate" : "Auto"}</span></span>
            <span className={cx("num font-bold", over && "text-[color:var(--amber-fg)]")} style={over ? { background: "var(--amber-bg)", borderRadius: 6, padding: "1px 6px" } : undefined}>{r.walk_min} min</span>
          </div>
        );
      })}
      {!rows.length && <p className="m-0 py-2 text-sm text-muted">No walking times yet.</p>}
    </div>
  );
}

function Locator({ ctx }: { ctx: Ctx }) {
  const p = ctx.d.property;
  const pts = ctx.d.proximity.filter((x) => x.place_lat != null && x.place_lng != null);
  if (p.lat == null || p.lng == null || !pts.length) return null;
  const S = 260;
  const cos = Math.cos((p.lat * Math.PI) / 180);
  const dx = pts.map((x) => (x.place_lng! - p.lng!) * cos);
  const dy = pts.map((x) => x.place_lat! - p.lat!);
  const r = Math.max(...dx.map(Math.abs), ...dy.map(Math.abs), 0.002);
  const k = (S / 2 - 26) / r;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[320px] rounded-xl border border-line" style={{ background: "var(--surface-2)" }} role="img" aria-label="Diagram of nearby places around the home">
      <circle cx={S / 2} cy={S / 2} r={(S / 2 - 26) * 0.5} fill="none" stroke="var(--line)" strokeDasharray="3 4" />
      <circle cx={S / 2} cy={S / 2} r={S / 2 - 26} fill="none" stroke="var(--line)" strokeDasharray="3 4" />
      {pts.map((x, i) => (
        <g key={x.id}>
          <line x1={S / 2} y1={S / 2} x2={S / 2 + dx[i] * k} y2={S / 2 - dy[i] * k} stroke="var(--line)" />
          <circle cx={S / 2 + dx[i] * k} cy={S / 2 - dy[i] * k} r="5" fill="var(--accent)" />
          <text x={S / 2 + dx[i] * k + 8} y={S / 2 - dy[i] * k + 4} fontSize="10.5" fill="var(--ink-2)">{CATEGORY_LABEL[x.category]}</text>
        </g>
      ))}
      <circle cx={S / 2} cy={S / 2} r="7" fill="var(--ink)" /><text x={S / 2 + 10} y={S / 2 - 8} fontSize="10.5" fontWeight="700" fill="var(--ink)">Home</text>
    </svg>
  );
}

export function LocationTab({ ctx }: { ctx: Ctx }) {
  const p = ctx.d.property;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [min, setMin] = useState("");
  const [place, setPlace] = useState("");

  async function recalc(reset: boolean) {
    setBusy(true);
    setMsg(null);
    const r = await refreshProximity(p, reset);
    setBusy(false);
    setMsg(r.ok ? (r.unresolved.length ? `Couldn't find: ${r.unresolved.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(", ")}. You can enter those by hand.` : "Walking times updated.") : (r.message ?? "Couldn't update."));
  }

  const dest = ctx.d.proximity[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">Walking times</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => void recalc(false)}>{busy ? "Working it out…" : ctx.d.proximity.length ? "Recalculate" : "Work out walking times"}</button>
          {ctx.d.proximity.some((x) => x.source === "manual") && <button className="btn" disabled={busy} onClick={() => void recalc(true)}>Reset my edits</button>}
        </div>
      </div>
      <span role="status" className="text-sm text-muted">{msg}</span>
      {p.address_precision === "approximate" && (
        <p role="note" className="m-0 rounded-xl p-3 text-sm chip-info">Approximate: the listing only gave a partial postcode, so walking times are approximate until you confirm the exact address after the viewing.</p>
      )}
      <div className="flex flex-wrap gap-6">
        <div className="panel min-w-[300px] flex-[2_1_420px] p-5">
          {ORDER.map((c) => {
            const r = ctx.d.proximity.find((x) => x.category === c);
            if (!r && c === "convenience") return null;
            const lim = LIMIT[c] ? ctx.config.softGates[LIMIT[c]!] : null;
            const over = r && lim != null && r.walk_min > lim;
            const editor = r?.source === "manual" ? memberOf(ctx, r.edited_by ?? "")?.display_name : null;
            return (
              <div key={c} className="flex flex-col gap-2 border-t border-line-2 py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-28 font-semibold">{CATEGORY_LABEL[c]}</span>
                  <span className="min-w-0 flex-1 text-[15px]">{r ? r.place_name : <span className="text-muted">Not found yet</span>}</span>
                  {r && <span className="badge" style={r.source === "manual" ? { background: "var(--split-bg)", color: "var(--split-fg)" } : undefined}>{editor ? `Edited by ${editor}` : r.source === "manual" ? "Edited" : r.method === "estimated" ? "Estimate" : "Auto"}</span>}
                  {r && <span className="inline-flex items-center gap-1.5 font-bold" style={over ? { background: "var(--amber-bg)", color: "var(--amber-fg)", borderRadius: 6, padding: "1px 8px" } : undefined}><IWalk />{r.walk_min} min{r.walk_m ? <span className="text-[12.5px] font-normal text-muted"> · {Math.round(r.walk_m)} m</span> : null}</span>}
                  <button className="btn !min-h-9 !px-3 !text-[13px]" aria-expanded={edit === c} onClick={() => { setEdit(edit === c ? null : c); setMin(String(r?.walk_min ?? "")); setPlace(r?.place_name ?? ""); }}>{r ? "Edit" : "Enter"}</button>
                </div>
                {edit === c && (
                  <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); const n = Number(min); if (!Number.isFinite(n) || n < 0) return; await store.setOverride(p.id, c, place.trim(), Math.round(n)); setEdit(null); }}>
                    <label className="flex flex-col gap-1 text-[13px] font-semibold">Place<input className="inp !min-h-10" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
                    <label className="flex flex-col gap-1 text-[13px] font-semibold">Minutes on foot<input className="inp !min-h-10 !w-28" type="number" min={0} required value={min} onChange={(e) => setMin(e.target.value)} /></label>
                    <button className="btn btn-p !min-h-10">Save</button>
                    <span className="basis-full text-[12.5px] text-muted">Shared with {ctx.other?.display_name}: distances are facts, not opinions.</span>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex min-w-[260px] flex-1 flex-col gap-3">
          <Locator ctx={ctx} />
          {p.lat != null && p.lng != null && (
            <a className="btn w-fit" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}>Open in Maps</a>
          )}
          {!p.lat && dest === undefined && <p className="m-0 text-sm text-muted">Add a full postcode to see this on a map.</p>}
        </div>
      </div>
    </div>
  );
}
