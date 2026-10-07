"use client";
import { useState } from "react";
import { visibleFor } from "@/lib/derive";
import { CRITERION_OPTIONS } from "@/lib/rooms";
import { store } from "@/lib/store";
import type { ProCon } from "@/lib/types";
import { Avatar, ImpactDots, cx } from "../ui";
import type { Ctx } from "./ctx";
import { memberOf } from "./ctx";

const CRIT: Record<string, string> = Object.fromEntries(CRITERION_OPTIONS);

export function ProConRow({ c, ctx, editable }: { c: ProCon; ctx: Ctx; editable?: boolean }) {
  const mine = c.member_id === ctx.me.id;
  const [open, setOpen] = useState(false);
  const agreed = ctx.data.pro_cons.some((x) => x.member_id === ctx.me.id && x.agreed_from_id === c.id);
  const mineAgreed = mine && !!c.agreed_from_id;
  const agreedWithMe = !mine && ctx.data.pro_cons.some((x) => x.id === c.agreed_from_id && x.member_id === ctx.me.id);
  return (
    <div className={cx("flex flex-col gap-2 border-t border-line-2 py-3 first:border-t-0", c.deal_breaker && "rounded-lg px-2")} style={c.deal_breaker ? { background: "var(--danger-bg)" } : undefined}>
      <div className="flex items-start gap-3">
        <Avatar member={memberOf(ctx, c.member_id)} className="mt-0.5" />
        <span className="flex-1 text-[15px] leading-5">
          {c.text}
          {c.criterion && <span className="badge ml-2">{CRIT[c.criterion]}</span>}
          {c.deal_breaker && <span className="chip chip-danger ml-2">Deal-breaker</span>}
        </span>
        <ImpactDots impact={c.impact} kind={c.kind} />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-[34px]">
        {!mine && !agreed && !agreedWithMe && <button className="btn !min-h-9 !px-3 !text-[13px]" onClick={() => void store.agree(c)}>Agree</button>}
        {agreedWithMe && <span className="text-[13px] text-muted">{memberOf(ctx, c.member_id)?.display_name} agreed with you</span>}
        {!mine && agreed && <span className="text-[13px] text-muted">You agreed</span>}
        {mine && mineAgreed && <span className="text-[13px] text-muted">Agreed with {ctx.other?.display_name}</span>}
        {editable && mine && (
          <>
            <button className="btn !min-h-9 !px-3 !text-[13px]" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Done" : "Edit"}</button>
            <button className="btn !min-h-9 !px-3 !text-[13px]" aria-label={`Move up: ${c.text}`} onClick={() => void move(c, ctx, -1)}>Up</button>
            <button className="btn !min-h-9 !px-3 !text-[13px]" aria-label={`Move down: ${c.text}`} onClick={() => void move(c, ctx, 1)}>Down</button>
            <button className="btn !min-h-9 !px-3 !text-[13px]" onClick={() => void store.del("pro_cons", c.id)}>Delete</button>
          </>
        )}
      </div>
      {open && mine && (
        <div className="grid gap-2 pl-[34px] sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Impact
            <select className="inp !min-h-10" value={c.impact} onChange={(e) => void store.put("pro_cons", { ...c, impact: e.target.value as ProCon["impact"] })}>
              <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="major">Major</option>
            </select></label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">Linked to
            <select className="inp !min-h-10" value={c.criterion ?? ""} onChange={(e) => void store.put("pro_cons", { ...c, criterion: (e.target.value || null) as ProCon["criterion"] })}>
              <option value="">Nothing in particular</option>{CRITERION_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          {c.kind === "con" && (
            <label className="flex min-h-10 items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[var(--danger)]" checked={c.deal_breaker} onChange={(e) => void store.put("pro_cons", { ...c, deal_breaker: e.target.checked })} />Deal-breaker</label>
          )}
        </div>
      )}
    </div>
  );
}

async function move(c: ProCon, ctx: Ctx, dir: -1 | 1) {
  const list = ctx.data.pro_cons.filter((x) => x.property_id === c.property_id && x.member_id === c.member_id && x.kind === c.kind).sort((a, b) => a.position - b.position);
  const i = list.findIndex((x) => x.id === c.id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  await store.put("pro_cons", { ...list[i], position: list[j].position });
  await store.put("pro_cons", { ...list[j], position: list[i].position });
}

function AddBox({ ctx, kind }: { ctx: Ctx; kind: "pro" | "con" }) {
  const [text, setText] = useState("");
  const id = `add-${kind}`;
  return (
    <form className="flex flex-col gap-2 pt-3" onSubmit={async (e) => {
      e.preventDefault();
      const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      for (const t of lines) await store.saveProCon({ property_id: ctx.d.property.id, kind, text: t });
      setText("");
    }}>
      <label className="lab" htmlFor={id}>Add a {kind}. Each new line becomes a bullet.</label>
      <textarea id={id} className="inp" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn w-fit" disabled={!text.trim()}>Add</button>
    </form>
  );
}

export function ProsConsTab({ ctx }: { ctx: Ctx }) {
  const vis = visibleFor(ctx.data, ctx.d.property.id, ctx.me.id);
  const own = ctx.data.pro_cons.filter((c) => c.property_id === ctx.d.property.id && c.member_id === ctx.me.id);
  const items = [...new Map([...own, ...vis.proCons].map((c) => [c.id, c])).values()].sort((a, b) => a.position - b.position);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-xl font-bold">Pros and cons</h2>
      {!vis.iSubmitted && ctx.other && <p className="m-0 text-sm text-muted">{ctx.other.display_name}'s pros and cons appear once you have submitted your own rating.</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {(["pro", "con"] as const).map((k) => (
          <section key={k} className="panel p-5" aria-label={k === "pro" ? "Pros" : "Cons"}>
            <h3 className="m-0 mb-1 text-lg font-bold">{k === "pro" ? "Pros" : "Cons"}</h3>
            {items.filter((c) => c.kind === k).map((c) => <ProConRow key={c.id} c={c} ctx={ctx} editable />)}
            {!items.some((c) => c.kind === k) && <p className="m-0 py-2 text-sm text-muted">None yet.</p>}
            <AddBox ctx={ctx} kind={k} />
          </section>
        ))}
      </div>
    </div>
  );
}
