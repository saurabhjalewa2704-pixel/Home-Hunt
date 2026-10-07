"use client";
import Link from "next/link";
import { useState } from "react";
import { TIER_COLOR, TIER_LABELS, NEXT_STEP } from "@/lib/derive";
import { fmtDay, gbp, sqftAndSqm, splitAddress } from "@/lib/format";
import { store } from "@/lib/store";
import { ACTIVE_STATUSES, RULE_OUT_REASONS, STATUSES, STATUS_LABELS, type Status } from "@/lib/types";
import { IBack, IPinned } from "../icons";
import { Avatar, Cover, Dialog, ScoreRing, cx } from "../ui";
import type { Ctx } from "./ctx";
import { ViewingForm } from "./ViewingsTab";

function facts(p: import("@/lib/types").Property): string {
  const parts: string[] = [];
  if (p.beds != null) parts.push(p.beds === 0 ? "Studio" : `${p.beds} ${p.beds === 1 ? "bedroom" : "bedrooms"}`);
  if (p.baths != null) parts.push(`${p.baths} ${p.baths === 1 ? "bathroom" : "bathrooms"}`);
  if (p.floor_area_sqft) parts.push(sqftAndSqm(p.floor_area_sqft));
  let out = parts.join(", ");
  const extra: string[] = [];
  if (p.tenure) extra.push(`${p.tenure === "share_of_freehold" ? "Share of freehold" : p.tenure[0].toUpperCase() + p.tenure.slice(1)}${p.lease_years ? `, ${p.lease_years} years left` : ""}`);
  if (p.epc) extra.push(`EPC ${p.epc}`);
  if (p.council_tax_band) extra.push(`Council tax band ${p.council_tax_band}`);
  if (extra.length) out += (out ? ". " : "") + extra.join(". ");
  return out ? out + "." : "";
}

const QUAL: Record<string, string> = { guide: "Guide price", offers_over: "Offers over", offers_in_excess: "Offers in excess of", fixed: "Fixed price" };

export function PropertyHeader({ ctx }: { ctx: Ctx }) {
  const { d, me, other, config } = ctx;
  const p = d.property;
  const [ruleOpen, setRuleOpen] = useState(false);
  const [reason, setReason] = useState(RULE_OUT_REASONS[0]);
  const [custom, setCustom] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinText, setPinText] = useState("");
  const { street, area } = splitAddress(p.address);
  const tier = d.provisional ? "to_view" : d.tier;
  const isOut = p.status === "ruled_out" || d.tier === "ruled_out";
  const iRated = d.iSubmitted;
  const myScore = d.result.memberScores[me.id];

  return (
    <section className="flex flex-col gap-6" aria-label="Summary">
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold no-underline"><IBack width={16} height={16} />Board</Link>
      <div className="flex flex-wrap gap-7">
        <div className="relative min-h-[200px] flex-[1_1_380px] md:min-h-[280px]">
          <Cover src={p.cover_image_path} tint={p.tint ?? "#D6CFC4"} width="100%" height="100%" radius={16} alt={`Listing photo of ${street}`} />
        </div>
        <div className="flex min-w-[280px] flex-[1_1_460px] flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="chip">{STATUS_LABELS[p.status]}</span>
            {p.portal && <span className="chip">{p.portal === "onthemarket" ? "OnTheMarket" : p.portal[0].toUpperCase() + p.portal.slice(1)}</span>}
            {p.pinned_by && <span className="chip"><IPinned />Pinned{p.pin_reason ? `: ${p.pin_reason}` : ""}</span>}
            {d.result.hardGate && <span className="chip chip-danger">{d.result.hardGate.detail}</span>}
          </div>
          <h1 className={cx("m-0 text-[28px] leading-8 font-extrabold tracking-[-0.025em] md:text-[38px] md:leading-[42px]", isOut && "line-through decoration-2")}>{street}</h1>
          <p className="m-0 text-base text-muted">{area}{p.postcode && !area.includes(p.postcode.split(" ")[0]) ? ` ${p.postcode}` : ""}</p>
          <div className="flex flex-wrap items-baseline gap-3"><span className="text-[28px] font-extrabold md:text-[32px]">{gbp(p.asking_price)}</span><span className="text-[15px] text-muted">{QUAL[p.price_qualifier ?? "guide"]}</span></div>
          <p className="m-0 text-[15px] leading-[22px] text-ink-2">{facts(p)}</p>

          <div className="flex items-center gap-[18px] rounded-[14px] border border-line bg-surface p-[18px]">
            <ScoreRing score={d.result.combined} tier={tier} provisional={d.provisional} size={84} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-lg font-bold" style={{ color: TIER_COLOR[tier] }}>{d.provisional ? `${TIER_LABELS[d.tier]} so far` : TIER_LABELS[d.tier]}</span>
              <span className="text-sm text-muted">
                {d.provisional ? `Provisional: scored from the listing and walking times only${d.result.missing.length ? `. Missing: ${d.result.missing.join(", ").toLowerCase()}` : ""}.` : `${ctx.rankOf ? `Rank ${ctx.rankOf} of ${ctx.rankedCount}. ` : ""}Combined score ${d.result.combined.toFixed(1)}.${d.result.ratedCount === 1 ? " 1 of 2 rated." : ""}`}
              </span>
              {!d.provisional && (
                <span className="flex gap-3.5 text-sm">
                  {ctx.members.map((m) => {
                    const ms = d.result.memberScores[m.id];
                    return ms ? <span key={m.id} className="inline-flex items-center gap-1.5"><Avatar member={m} />{ms.score.toFixed(1)}</span> : null;
                  })}
                </span>
              )}
              {!isOut && !d.provisional && <span className="text-[13px] text-muted">Next: {NEXT_STEP[d.tier]}</span>}
            </span>
          </div>

          {d.result.disagreement && (
            <p role="note" className="m-0 rounded-xl p-3 text-sm font-semibold chip-split">You see this one differently, talk it through. ({d.result.disagreementPoints.toFixed(1)} points apart)</p>
          )}
          {!iRated && !isOut && (
            <p className="m-0 text-sm text-muted">{other?.display_name}'s ratings stay hidden until you submit yours.</p>
          )}

          <div className="flex flex-wrap gap-2.5">
            {!iRated && !isOut && <Link className="btn btn-p" href={`/property/${p.id}/rate`}>{myScore || store.myAssessment(p.id) ? "Continue rating" : "Rate this viewing"}</Link>}
            {iRated && <Link className="btn" href={`/property/${p.id}/rate`}>Edit my rating</Link>}
            {d.tier === "top_pick" || d.tier === "strong" ? <button className="btn btn-p" onClick={() => setBookOpen(true)}>Book second viewing</button> : <button className="btn" onClick={() => setBookOpen(true)}>Book a viewing</button>}
            {p.listing_url && <a className="btn" href={p.listing_url} target="_blank" rel="noopener noreferrer">Open on {p.portal === "onthemarket" ? "OnTheMarket" : p.portal ? p.portal[0].toUpperCase() + p.portal.slice(1) : "listing"}</a>}
            {isOut ? (
              <button className="btn" onClick={() => void store.setStatus(p.id, "shortlisted")}>Bring back</button>
            ) : (
              <button className="btn" onClick={() => setRuleOpen(true)}>Rule out</button>
            )}
            <button className="btn" onClick={() => (p.pinned_by ? void store.pin(p.id, null) : setPinOpen(true))}>{p.pinned_by ? "Unpin" : "Pin"}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="status-sel" className="text-sm font-semibold text-ink-2">Status</label>
            <select id="status-sel" className="inp !w-auto !min-h-10" value={p.status} onChange={(e) => void store.setStatus(p.id, e.target.value as Status, e.target.value === "ruled_out" ? "Ruled out" : undefined)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            {!ACTIVE_STATUSES.includes(p.status) && <span className="text-[13px] text-muted">Not ranked while {STATUS_LABELS[p.status].toLowerCase()}.</span>}
          </div>
        </div>
      </div>

      <Dialog open={ruleOpen} onClose={() => setRuleOpen(false)} title={`Rule out ${street}`}>
        <p className="m-0 text-sm text-muted">It stays on the board under Ruled out, with its score greyed. You can bring it back later.</p>
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="ro-reason">Reason</label>
          <select id="ro-reason" className="inp" value={reason} onChange={(e) => setReason(e.target.value)}>{RULE_OUT_REASONS.map((r) => <option key={r}>{r}</option>)}<option value="__other">Something else…</option></select></div>
        {reason === "__other" && <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="ro-custom">In your words</label><input id="ro-custom" className="inp" value={custom} onChange={(e) => setCustom(e.target.value)} /></div>}
        <div className="flex justify-end gap-2.5"><button className="btn" onClick={() => setRuleOpen(false)}>Cancel</button>
          <button className="btn btn-p" disabled={reason === "__other" && !custom.trim()} onClick={() => { void store.setStatus(p.id, "ruled_out", reason === "__other" ? custom.trim() : reason); setRuleOpen(false); }}>Rule out</button></div>
      </Dialog>

      <Dialog open={pinOpen} onClose={() => setPinOpen(false)} title="Pin to the top of its tier">
        <p className="m-0 text-sm text-muted">Pins never move a home to a different tier. Say why, so you both remember.</p>
        <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="pin-why">Reason</label><input id="pin-why" className="inp" placeholder="We both loved the light" value={pinText} onChange={(e) => setPinText(e.target.value)} /></div>
        <div className="flex justify-end gap-2.5"><button className="btn" onClick={() => setPinOpen(false)}>Cancel</button>
          <button className="btn btn-p" disabled={!pinText.trim()} onClick={() => { void store.pin(p.id, pinText.trim()); setPinOpen(false); setPinText(""); }}>Pin</button></div>
      </Dialog>

      <Dialog open={bookOpen} onClose={() => setBookOpen(false)} title={`Book a viewing for ${street}`}>
        <ViewingForm ctx={ctx} defaultKind={d.viewings.some((v) => v.status === "done") ? "second" : "first"} onDone={() => setBookOpen(false)} />
      </Dialog>
    </section>
  );
}
