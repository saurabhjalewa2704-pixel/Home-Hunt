"use client";
import { useState } from "react";
import { stampDuty } from "@homehunt/scoring";
import { activeConfig } from "@/lib/derive";
import { fmtDay, gbp } from "@/lib/format";
import { store } from "@/lib/store";
import type { Offer } from "@/lib/types";
import type { Ctx } from "./ctx";

const OUTCOME: Record<Offer["outcome"], string> = { pending: "Waiting", accepted: "Accepted", rejected: "Rejected", countered: "Counter-offer" };

export function CostsTab({ ctx }: { ctx: Ctx }) {
  const { d, data, config } = ctx;
  const { buyerType } = activeConfig(data);
  const p = d.property;
  const [amount, setAmount] = useState("");
  const [cond, setCond] = useState("");
  const eff = d.result.effectivePrice;
  const offers = [...d.offers].sort((a, b) => b.made_at.localeCompare(a.made_at));
  const rows: Array<[string, string, string?]> = [
    ["Asking price", gbp(p.asking_price)],
    ...(eff !== p.asking_price ? ([["Scored on", gbp(eff), "The latest live or accepted offer, in place of the asking price."]] as Array<[string, string, string?]>) : []),
    ["Budget headroom", d.result.headroom >= 0 ? gbp(d.result.headroom) : `${gbp(-d.result.headroom)} over`, `Limit ${gbp(config.budget)}`],
    ["Stamp duty estimate", gbp(d.stampDuty), buyerType === "first_time" ? (eff > config.sdlt.firstTime.maxPrice ? `First-time buyer relief doesn't apply above ${gbp(config.sdlt.firstTime.maxPrice)}, so standard rates are used.` : "With first-time buyer relief.") : "Standard rates."],
    ...(p.service_charge ? ([["Service charge", `${gbp(p.service_charge)} a year`]] as Array<[string, string, string?]>) : []),
    ...(p.ground_rent ? ([["Ground rent", `${gbp(p.ground_rent)} a year`]] as Array<[string, string, string?]>) : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      <h2 className="m-0 text-xl font-bold">Costs and offers</h2>
      <dl className="panel m-0 divide-y divide-line-2">
        {rows.map(([k, v, note]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5"><dt className="font-semibold">{k}</dt><dd className="m-0 text-right"><span className="text-lg font-bold">{v}</span>{note && <span className="block text-[13px] font-normal text-muted">{note}</span>}</dd></div>
        ))}
      </dl>
      <p className="m-0 text-[13px] text-muted">Estimates for planning only, not financial advice. Rates live in configuration so they can be updated.</p>

      <h3 className="m-0 text-lg font-bold">Offers</h3>
      {!offers.length && <p className="m-0 text-muted">No offers yet.</p>}
      {offers.map((o) => (
        <div key={o.id} className="panel flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
          <span className="text-lg font-bold">{gbp(o.amount)}</span>
          <span className="text-sm text-muted">{fmtDay(o.made_at)}{o.conditions ? `, ${o.conditions}` : ""}</span>
          <span className="chip">{OUTCOME[o.outcome]}</span>
          <span className="flex-1" />
          <label className="sr-only" htmlFor={`oc-${o.id}`}>Outcome</label>
          <select id={`oc-${o.id}`} className="inp !min-h-10 !w-auto" value={o.outcome} onChange={(e) => void store.saveOffer({ ...o, outcome: e.target.value as Offer["outcome"], responded_at: e.target.value === "pending" ? null : new Date().toISOString() })}>
            {Object.entries(OUTCOME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      ))}
      <form className="panel flex flex-wrap items-end gap-3 p-4" onSubmit={async (e) => { e.preventDefault(); const n = Number(amount); if (!(n > 0)) return; await store.saveOffer({ property_id: p.id, amount: n, conditions: cond || null }); setAmount(""); setCond(""); }}>
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="of-amt">Offer (£)</label><input id="of-amt" className="inp !w-40" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5"><label className="lab" htmlFor="of-cond">Conditions</label><input id="of-cond" className="inp" value={cond} onChange={(e) => setCond(e.target.value)} placeholder="Subject to survey" /></div>
        <button className="btn btn-p" disabled={!(Number(amount) > 0)}>Record offer</button>
      </form>
      <p className="m-0 text-[13px] text-muted">An offer re-scores the budget criterion against the offer price. If the home was ruled out for being over budget, an accepted offer at or under {gbp(config.budget)} brings it back.</p>
    </div>
  );
}
