"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { SyncBadge } from "@/components/Shell";
import { ImpactDots, ScoreRing, cx } from "@/components/ui";
import { TIER_COLOR, TIER_LABELS, deriveAll, scoreOne, visibleFor } from "@/lib/derive";
import { splitAddress } from "@/lib/format";
import { refreshProximity } from "@/lib/proximity-client";
import { CATEGORY_LABEL, CRITERION_OPTIONS, QUALITY_ITEMS, RATING_WORDS, SPACE_QUESTIONS, STREET_ITEM, roomItems } from "@/lib/rooms";
import { store, useStore } from "@/lib/store";
import type { ProCon } from "@/lib/types";

const STEPS = [
  { title: "How were the rooms?", short: "rooms", next: "space" },
  { title: "Is there enough space?", short: "space", next: "home quality" },
  { title: "How is the home itself?", short: "home quality", next: "location" },
  { title: "Check the location", short: "location", next: "pros and cons" },
  { title: "What stood out?", short: "pros and cons", next: "gut feel" },
  { title: "Could you live here?", short: "gut feel", next: "" },
] as const;

function Segs({ label, value, onPick, skip }: { label: string; value: number | null | undefined; onPick: (n: number) => void; skip?: () => void }) {
  const v = value ?? 0;
  return (
    <div className="flex flex-col gap-2 border-t border-line-2 py-3 first:border-t-0" role="group" aria-label={label}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-bold">{label}</span>
        <span className="inline-flex items-center gap-1">
          <span className="text-sm font-semibold" style={{ color: v > 0 ? "var(--accent)" : "var(--muted)" }}>{v === -1 ? "Not in this home" : v > 0 ? RATING_WORDS[v] : "Not rated"}</span>
          {skip && <button type="button" className="min-h-8 px-1.5 text-[13px] font-semibold text-muted underline" onClick={skip}>{v === -1 ? "Undo" : "Not here"}</button>}
        </span>
      </div>
      <div className="segs">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className="seg" aria-label={`${label}: ${RATING_WORDS[n]}`} aria-pressed={v === n} data-below={v > 0 && n < v} onClick={() => onPick(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

export default function RatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const s = useStore();
  const me = s.me!;
  const p = s.data.properties.find((x) => x.id === id);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<"pro" | "con">("pro");
  const [text, setText] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const started = useRef(false);

  const a = s.data.assessments.find((x) => x.property_id === id && x.member_id === me);
  const ratings = a?.ratings ?? {};
  const prox = useMemo(() => s.data.proximity.filter((x) => x.property_id === id), [s.data.proximity, id]);
  const mine = s.data.pro_cons.filter((c) => c.property_id === id && c.member_id === me).sort((x, y) => x.position - y.position);
  const other = s.data.members.find((m) => m.id !== me);

  // Pick the viewing this rating belongs to: the latest one that has already happened.
  const viewing = useMemo(() => {
    const vs = s.data.viewings.filter((v) => v.property_id === id && v.status !== "cancelled" && new Date(v.starts_at).getTime() <= Date.now() + 60 * 60_000);
    return vs.sort((x, y) => y.starts_at.localeCompare(x.starts_at))[0] ?? null;
  }, [s.data.viewings, id]);

  useEffect(() => {
    if (p && !started.current) started.current = true;
  }, [p]);

  if (!p) return <div className="p-6">We can't find that home. <Link href="/">Back to the board</Link></div>;
  const street = splitAddress(p.address).street;

  const setRating = (key: string, v: number | null) => void store.saveAssessment(id, { ratings: { ...ratings, [key]: v } }, viewing?.id);
  const setField = (patch: Parameters<typeof store.saveAssessment>[1]) => void store.saveAssessment(id, patch, viewing?.id);

  async function submit() {
    setBusy(true);
    await store.saveAssessment(id, {}, viewing?.id);
    await store.submitAssessment(id);
    setBusy(false);
    setDone(true);
  }

  if (done) {
    const { result } = scoreOne(s.data, p, me);
    const d = deriveAll(s.data, me).find((x) => x.property.id === id)!;
    const t = d.provisional ? "to_view" : d.tier;
    return (
      <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center gap-5 px-6 py-10">
        <h1 className="m-0 text-[28px] leading-8 font-extrabold tracking-[-0.02em]">Saved. Here's where {street} stands.</h1>
        <div className="flex items-center gap-4 rounded-[14px] border border-line bg-surface p-4">
          <ScoreRing score={result.memberScores[me]?.score ?? result.combined} tier={t} size={84} />
          <div className="flex flex-col gap-1">
            <span className="text-lg font-bold" style={{ color: TIER_COLOR[t] }}>{TIER_LABELS[t]}</span>
            <span className="text-sm text-muted">Your score {result.memberScores[me]?.score.toFixed(1)}.{result.ratedCount === 2 ? ` Combined ${result.combined.toFixed(1)}.` : ` ${other?.display_name ?? "Your partner"} hasn't rated it yet, so this is your score alone.`}</span>
            {d.rank && <span className="text-sm text-muted">Rank {d.rank} on your board.</span>}
          </div>
        </div>
        <div className="flex flex-col gap-3"><Link href={`/property/${id}#score`} className="btn btn-p btn-lg">See the score breakdown</Link><Link href="/" className="btn btn-lg">Back to the board</Link></div>
      </div>
    );
  }

  const last = step === STEPS.length - 1;
  const counts = { pro: mine.filter((c) => c.kind === "pro").length, con: mine.filter((c) => c.kind === "con").length };
  const shown = mine.filter((c) => c.kind === list);

  const addBullets = async () => {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (const t of lines) await store.saveProCon({ property_id: id, kind: list, text: t });
    setText("");
  };
  const cycle = (c: ProCon) => void store.put("pro_cons", { ...c, impact: c.impact === "minor" ? "moderate" : c.impact === "moderate" ? "major" : "minor" });

  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
      <header className="sticky top-0 z-20 flex flex-col gap-2.5 border-b border-line px-4 pt-3.5 pb-3" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-between">
          <Link href={`/property/${id}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold no-underline">Close</Link>
          <SyncBadge />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted">{street}, your rating</span>
          <h1 className="m-0 text-[26px] leading-[30px] font-extrabold tracking-[-0.02em]">{STEPS[step].title}</h1>
        </div>
        <div className="grid grid-cols-6 gap-1" role="img" aria-label={`Step ${step + 1} of 6`}>
          {STEPS.map((_, i) => <span key={i} className="h-1 rounded-sm" style={{ background: i <= step ? "var(--accent)" : "var(--line)" }} />)}
        </div>
        {step === 0 && <span className="text-[12.5px] text-muted">Step 1 of 6: rooms. {other?.display_name}'s ratings stay hidden until you submit yours.</span>}
        {step > 0 && <span className="text-[12.5px] text-muted">Step {step + 1} of 6: {STEPS[step].short}.</span>}
      </header>

      <div className="flex-1 px-4 pt-1 pb-36">
        {step === 0 && roomItems(p).map((r) => <Segs key={r.key} label={r.label} value={ratings[r.key]} onPick={(n) => setRating(r.key, n)} skip={() => setRating(r.key, ratings[r.key] === -1 ? null : -1)} />)}

        {step === 1 && (
          <>
            {SPACE_QUESTIONS.map((q) => <Segs key={q.key} label={q.label} value={a?.[q.key]} onPick={(n) => setField({ [q.key]: n })} />)}
            <p className="mt-3 text-sm text-muted">These two answers, plus your living room and kitchen ratings, set the space score{p.floor_area_sqft ? ` alongside the ${Math.round(p.floor_area_sqft)} sq ft floor area` : ""}.</p>
          </>
        )}

        {step === 2 && QUALITY_ITEMS.map((r) => <Segs key={r.key} label={r.label} value={ratings[r.key]} onPick={(n) => setRating(r.key, n)} />)}

        {step === 3 && (
          <>
            <p className="mt-2 mb-1 text-sm text-muted">Walking times we worked out from the address. Tap one to change it if what you saw differs. Changes are shared with {other?.display_name}.</p>
            {(["station", "park", "supermarket", "gym", "restaurants"] as const).map((c) => {
              const r = prox.find((x) => x.category === c);
              return (
                <div key={c} className="border-t border-line-2 py-2.5 first:border-t-0">
                  <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-lg border-0 bg-transparent p-0 text-left" onClick={() => { setEdit(edit === c ? null : c); setMinutes(String(r?.walk_min ?? "")); }} aria-expanded={edit === c}>
                    <span className="w-28 text-[15px] font-bold">{CATEGORY_LABEL[c]}</span>
                    <span className="min-w-0 flex-1 text-sm text-ink-2">{r?.place_name ?? "Not worked out yet"}{r?.source === "manual" && <span className="badge ml-1.5">Edited</span>}</span>
                    <span className="text-base font-bold">{r ? `${r.walk_min} min` : "Add"}</span>
                  </button>
                  {edit === c && (
                    <form className="mt-2 flex items-end gap-2" onSubmit={async (e) => { e.preventDefault(); const n = Number(minutes); if (n >= 0 && Number.isFinite(n)) { await store.setOverride(id, c, r?.place_name ?? "", Math.round(n)); setEdit(null); } }}>
                      <label className="flex flex-col gap-1 text-[13px] font-semibold">Minutes on foot<input className="inp !w-28" type="number" inputMode="numeric" min={0} autoFocus value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
                      <button className="btn btn-p">Save</button>
                    </form>
                  )}
                </div>
              );
            })}
            {!prox.length && <button className="btn mt-2" onClick={() => void refreshProximity(p)}>Work out walking times</button>}
            <div className="mt-4"><Segs label={STREET_ITEM.label} value={ratings.street} onPick={(n) => setRating("street", n)} /></div>
          </>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3 pt-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: "var(--track)" }} role="group" aria-label="List">
              {(["pro", "con"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={list === k} onClick={() => setList(k)} className="min-h-10 rounded-[9px] border-0 text-[15px] font-semibold" style={list === k ? { background: "var(--surface)", color: "var(--ink)" } : { background: "transparent", color: "var(--ink-2)" }}>{k === "pro" ? "Pros" : "Cons"} ({counts[k]})</button>
              ))}
            </div>
            <label className="lab" htmlFor="new-item">Type a {list}. Each new line becomes a bullet.</label>
            <textarea id="new-item" rows={2} className="inp resize-none" style={{ borderColor: "var(--accent)", borderWidth: 1.5 }} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="button" className="btn w-fit" disabled={!text.trim()} onClick={() => void addBullets()}>Add {list === "pro" ? "pro" : "con"}</button>
            {shown.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-xl border bg-surface p-3" style={c.deal_breaker ? { borderColor: "var(--danger)", background: "var(--danger-bg)" } : { borderColor: "var(--line)" }}>
                <span className="text-[15px] leading-[21px] font-semibold">{c.text}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <button type="button" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--field-border)] bg-surface px-2.5 text-[13px] font-semibold" onClick={() => cycle(c)}>
                    <ImpactDots impact={c.impact} kind={c.kind} />{c.impact[0].toUpperCase() + c.impact.slice(1)}
                  </button>
                  <label className="sr-only" htmlFor={`link-${c.id}`}>Linked to</label>
                  <select id={`link-${c.id}`} className="min-h-8 rounded-lg border border-[var(--field-border)] bg-surface px-2 text-[13px] font-semibold" value={c.criterion ?? ""} onChange={(e) => void store.put("pro_cons", { ...c, criterion: (e.target.value || null) as ProCon["criterion"] })}>
                    <option value="">Not linked</option>{CRITERION_OPTIONS.map(([k, l]) => <option key={k} value={k}>Linked to {l}</option>)}
                  </select>
                  {c.kind === "con" && <button type="button" aria-pressed={c.deal_breaker} className="min-h-8 rounded-lg border px-2.5 text-[13px] font-semibold" style={c.deal_breaker ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" } : { background: "var(--surface)", borderColor: "var(--field-border)" }} onClick={() => void store.put("pro_cons", { ...c, deal_breaker: !c.deal_breaker })}>Deal-breaker</button>}
                  <button type="button" className="ml-auto min-h-8 px-1.5 text-[13px] text-muted underline" onClick={() => void store.del("pro_cons", c.id)}>Remove</button>
                </span>
                {c.deal_breaker && <span className="text-[13px] leading-[18px]" style={{ color: "var(--danger-fg)" }}>A deal-breaker rules this home out for both of you. You can lift it later.</span>}
              </div>
            ))}
          </div>
        )}

        {step === 5 && (
          <>
            <Segs label="Could you see yourselves living here?" value={a?.gut_feel} onPick={(n) => setField({ gut_feel: n })} />
            <div className="mt-4 flex flex-col gap-1.5"><label className="lab" htmlFor="gut-note">Anything else to remember? (optional)</label>
              <textarea id="gut-note" className="inp" rows={3} value={a?.note ?? ""} onChange={(e) => setField({ note: e.target.value })} /></div>
            {visibleFor(s.data, id, me).iSubmitted && <p className="text-sm text-muted">You've already submitted this rating. Saving updates your score.</p>}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[640px] gap-2.5 border-t border-line bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]">
        {step === 0 ? (
          <Link href={`/property/${id}`} className="btn btn-lg flex-1">Back</Link>
        ) : (
          <button type="button" className="btn btn-lg flex-1" onClick={() => setStep(step - 1)}>Back</button>
        )}
        {!last ? (
          <button type="button" className={cx("btn btn-p btn-lg flex-[2]")} onClick={() => setStep(step + 1)}>Next: {STEPS[step].next}</button>
        ) : (
          <button type="button" className="btn btn-p btn-lg flex-[2]" disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Submit and see the score"}</button>
        )}
      </div>
    </div>
  );
}
