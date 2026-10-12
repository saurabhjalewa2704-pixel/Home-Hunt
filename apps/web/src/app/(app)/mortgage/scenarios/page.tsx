"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { compareScenarios, defaultCompletion, plainSummary, type CompareRow, type ScenarioResult, type VariantField } from "@homehunt/mortgage";
import { ICheck, IDuplicate, IPencil, IStar, ITrash } from "@/components/icons";
import { Estimate } from "@/components/mortgage/bits";
import { LinesChart, ScatterChart } from "@/components/mortgage/Charts";
import { EmptyState } from "@/components/ui";
import { cx } from "@/components/ui";
import { gbp, gbp2, splitAddress } from "@/lib/format";
import { downloadText } from "@/lib/ics";
import { MAX_COMPARE, MAX_SCENARIOS, SCENARIO_LETTERS, letterOf, mortgageSettings, orderedScenarios, resultOf, scColour } from "@/lib/mortgage";
import { comparisonCsv } from "@/lib/mortgage-csv";
import { describeRow } from "@/lib/mortgage-format";
import { store, useStore } from "@/lib/store";
import type { MortgageScenario } from "@/lib/types";

const KEY = "hh.mortgage.compare";

/** Which scenarios are ticked to compare. Remembered on this device (SC-8). */
function usePicked(ids: string[]): [string[], (next: string[]) => void] {
  const [stored, setStored] = useState<string[] | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setStored(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setStored([]);
    }
  }, []);
  const valid = (stored ?? []).filter((id) => ids.includes(id)).slice(0, MAX_COMPARE);
  // Nothing remembered yet: start with the first few so there is something to see.
  const picked = stored === null ? [] : valid.length || (stored ?? []).length ? valid : ids.slice(0, 4);
  const set = (next: string[]) => {
    setStored(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return [picked, set];
}

const FIELDS: Array<{ key: VariantField; label: string; unit: string; defaults: (base: MortgageScenario) => number[] }> = [
  { key: "term", label: "Term", unit: "years", defaults: () => [25, 30, 35] },
  { key: "deposit", label: "Deposit", unit: "% of the price", defaults: () => [10, 15, 25] },
  { key: "rate", label: "Interest rate", unit: "%", defaults: (b) => [Math.max(0.5, b.initial_rate - 0.5), b.initial_rate, b.initial_rate + 0.5].map((v) => Math.round(v * 100) / 100) },
  { key: "initialPeriod", label: "Fixed period", unit: "years", defaults: () => [2, 3, 5] },
];

function QuickVariants({ scenarios, onDone }: { scenarios: MortgageScenario[]; onDone: () => void }) {
  const s = useStore();
  const [baseId, setBaseId] = useState((scenarios.find((x) => x.is_preferred) ?? scenarios[0]).id);
  const base = scenarios.find((x) => x.id === baseId) ?? scenarios[0];
  const [field, setField] = useState<VariantField>("term");
  const def = FIELDS.find((f) => f.key === field)!;
  const [text, setText] = useState(def.defaults(base).join(", "));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(def.defaults(base).join(", ")), [field, baseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const values = [...new Set(text.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0))].slice(0, 6);
  const current = { term: base.term_months / 12, deposit: 0, rate: base.initial_rate, initialPeriod: base.initial_period_months / 12 }[field];
  const fresh = values.filter((v) => field === "deposit" || Math.abs(v - current) > 1e-9);
  const room = MAX_SCENARIOS - s.data.mortgage_scenarios.length;

  async function make() {
    setError(null);
    try {
      await store.createVariants(baseId, field, fresh);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make those scenarios.");
    }
  }
  return (
    <section className="panel flex flex-col gap-4 p-5" aria-label="Quick variants">
      <div className="flex flex-col gap-1"><h3 className="m-0 text-lg font-bold">Quick variants</h3><p className="m-0 text-sm text-muted">Copy a scenario and change just one thing, to see what it does. For example the term at 25, 30 and 35 years.</p></div>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5"><label className="lab" htmlFor="qv-base">Start from</label>
          <select id="qv-base" className="inp" value={baseId} onChange={(e) => setBaseId(e.target.value)}>{scenarios.map((x) => <option key={x.id} value={x.id}>{letterOf(s.data, x.id)}. {x.name}</option>)}</select></div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5"><label className="lab" htmlFor="qv-field">Change the</label>
          <select id="qv-field" className="inp" value={field} onChange={(e) => setField(e.target.value as VariantField)}>{FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
        <div className="flex min-w-[200px] flex-[2_1_240px] flex-col gap-1.5"><label className="lab" htmlFor="qv-values">Values ({def.unit}), separated by commas</label>
          <input id="qv-values" className="inp" value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" /></div>
      </div>
      <p className="m-0 text-sm text-muted">{fresh.length ? `This makes ${fresh.length} scenario${fresh.length === 1 ? "" : "s"}: ${fresh.map((v) => (field === "deposit" ? `${v}% down` : field === "term" ? `${v} yrs` : field === "rate" ? `${v.toFixed(2)}%` : `${v} yr fix`)).join(", ")}.` : "Add at least one value that is different from the original."}{field !== "deposit" && values.length !== fresh.length ? " The original's own value is skipped." : ""} {fresh.length > room ? `There is only room for ${room} more.` : ""}</p>
      {error && <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2.5"><button className="btn btn-p" disabled={!fresh.length || fresh.length > room} onClick={() => void make()}>Make {fresh.length || ""} scenario{fresh.length === 1 ? "" : "s"}</button><button className="btn" onClick={onDone}>Cancel</button></div>
    </section>
  );
}

export default function ScenariosPage() {
  const s = useStore();
  const settings = mortgageSettings(s.data);
  const scenarios = orderedScenarios(s.data);
  const ids = scenarios.map((x) => x.id);
  const [picked, setPicked] = usePicked(ids);
  const [variants, setVariants] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);

  const results = useMemo(() => new Map(scenarios.map((x) => [x.id, resultOf(s.data, x, settings)])), [s.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const letters = SCENARIO_LETTERS;
  const letter = (id: string) => letters[Math.max(0, ids.indexOf(id))];
  const chosen: ScenarioResult[] = picked.map((id) => results.get(id)).filter((r): r is ScenarioResult => !!r);
  const plan = scenarios.find((x) => x.is_preferred);
  const named = (r: ScenarioResult) => ({ ...r, name: `${letter(r.id)}` });
  const summary = chosen.length >= 2 ? plainSummary(chosen.map(named), plan && picked.includes(plan.id) ? plan.id : undefined) : null;
  const rows: CompareRow[] = chosen.length >= 2 ? compareScenarios(chosen) : [];
  const completions = chosen.map((r) => { const sc = scenarios.find((x) => x.id === r.id)!; return sc.completion_date ? new Date(sc.completion_date) : defaultCompletion(); });

  const toggle = (id: string) => {
    if (picked.includes(id)) return setPicked(picked.filter((x) => x !== id));
    if (picked.length >= MAX_COMPARE) return setMsg(`You can compare up to ${MAX_COMPARE} at a time. Untick one first.`);
    setMsg(null);
    setPicked([...picked, id]);
  };
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That didn't work.");
    }
  };

  // Phones: two scenarios side by side with a picker for each column (SC-13).
  const pair = [left ?? picked[0] ?? ids[0], right ?? picked[1] ?? ids[1]].map((id) => results.get(id!)).filter((r): r is ScenarioResult => !!r);
  const pairRows = pair.length === 2 ? compareScenarios(pair) : [];
  const pairDone = pair.map((r) => { const sc = scenarios.find((x) => x.id === r.id)!; return sc.completion_date ? new Date(sc.completion_date) : defaultCompletion(); });

  if (!scenarios.length) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title="No scenarios yet" body="A scenario is a saved set of numbers: price, deposit, term and rate. Set one up in the calculator and save it, and you can compare it with others and see what overpaying does." action={<Link href="/mortgage" className="btn btn-p">Open the calculator</Link>} />
      </div>
    );
  }

  const scatter = chosen.map((r) => ({ id: r.id, letter: letter(r.id), colour: scColour(scenarios.find((x) => x.id === r.id)!.colour), name: r.name, pay: r.sim.payment, interest: r.sim.totals.interest }));
  const lines = chosen.map((r) => {
    const sc = scenarios.find((x) => x.id === r.id)!;
    return { id: r.id, letter: letter(r.id), colour: scColour(sc.colour), width: sc.is_preferred ? 3 : 2, balances: [r.sim.loan, ...r.sim.yearly.map((y) => y.closing)] };
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="sc-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="sc-h" className="m-0 text-[22px] font-bold">Your scenarios</h2>
            <p className="m-0 text-sm text-muted">Tick up to six to compare. The starred one is <strong>our plan</strong>, used for each home's monthly cost.</p>
          </div>
          <div className="no-print flex gap-2.5"><button className="btn" onClick={() => setVariants((v) => !v)} aria-expanded={variants}>Quick variants</button><Link className="btn btn-p" href="/mortgage">New scenario</Link></div>
        </div>
        {msg && <p role="alert" className="m-0 rounded-xl p-3 text-sm chip-warn">{msg}</p>}
        {variants && <QuickVariants scenarios={scenarios} onDone={() => setVariants(false)} />}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {scenarios.map((sc) => {
            const r = results.get(sc.id)!;
            const home = sc.property_id ? s.data.properties.find((p) => p.id === sc.property_id) : null;
            const L = letter(sc.id);
            const ltv = Math.round(r.sim.ltv);
            return (
              <div key={sc.id} className="mcard" style={sc.is_preferred ? { borderColor: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" } : undefined}>
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1 h-3 w-3 flex-none rounded-[4px]" style={{ background: scColour(sc.colour) }} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-bold">{L}. {sc.name}</span>
                    <span className="text-[13px] text-muted">{sc.initial_rate.toFixed(2)}%{sc.initial_period_months ? ` fixed for ${sc.initial_period_months / 12} years` : " for the whole term"}, {ltv}% LTV</span>
                    {home && <span className="text-[13px] text-muted">{splitAddress(home.address).street}</span>}
                  </span>
                  <input type="checkbox" className="h-5 w-5 flex-none" style={{ accentColor: "var(--accent)" }} checked={picked.includes(sc.id)} onChange={() => toggle(sc.id)} aria-label={`Compare ${L}`} />
                </div>
                <div className="flex items-baseline gap-1.5"><span className="text-2xl font-extrabold tracking-[-0.01em]">{gbp2(r.sim.payment)}</span><span className="text-[13px] text-muted">a month</span></div>
                <span className="text-[13px] text-ink-2">{gbp(r.sim.totals.interest)} interest over {sc.term_months / 12} years</span>
                {r.planSim && <span className="chip chip-info w-fit">Overpaying saves {gbp(r.sim.totals.interest - r.planSim.totals.interest)}</span>}
                {sc.note && <span className="text-[13px] text-muted">{sc.note}</span>}
                <div className="no-print -mx-2 -mb-2 flex items-center gap-0.5">
                  <button className="mic" aria-label={sc.is_preferred ? "Our plan. Unstar" : `Make ${L} our plan`} aria-pressed={sc.is_preferred} style={{ color: sc.is_preferred ? "var(--accent)" : undefined }} onClick={() => void act(() => store.setPreferredScenario(sc.is_preferred ? null : sc.id))}><IStar filled={sc.is_preferred} /></button>
                  <button className="mic" aria-label={`Duplicate ${L}`} onClick={() => void act(() => store.duplicateScenario(sc.id))}><IDuplicate /></button>
                  <Link className="mic" aria-label={`Edit ${L}`} href={`/mortgage?scenario=${sc.id}`}><IPencil /></Link>
                  <button className="mic" aria-label={`Delete ${L}`} onClick={() => { if (confirm(`Delete ${L}. ${sc.name}?`)) void act(() => store.deleteScenario(sc.id)); }}><ITrash /></button>
                  <span className="flex-1" />
                  {sc.is_preferred && <span className="mr-2 whitespace-nowrap rounded-xl px-2.5 py-1 text-[12.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Our plan</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="m-0 text-[13px] text-muted">{scenarios.length} of {MAX_SCENARIOS} scenarios. Everything here is shared with {s.data.members.filter((m) => m.id !== s.me).map((m) => m.display_name).join(", ") || "your partner"}.</p>
      </section>

      {chosen.length < 2 ? (
        <p className="panel m-0 p-6 text-muted" role="status">Tick at least two scenarios to compare them.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-5">
            <section className="panel flex min-w-0 flex-[1_1_420px] flex-col gap-1.5 px-[22px] py-5" aria-labelledby="ch1">
              <h2 id="ch1" className="m-0 text-[17px] font-bold">Monthly payment against total interest</h2>
              <p className="m-0 text-[13px] text-muted">Lower and further left is cheaper on both counts.</p>
              <ScatterChart items={scatter} />
            </section>
            <section className="panel flex min-w-0 flex-[1_1_420px] flex-col gap-1.5 px-[22px] py-5" aria-labelledby="ch2">
              <h2 id="ch2" className="m-0 text-[17px] font-bold">What you owe over time</h2>
              <p className="m-0 text-[13px] text-muted">{(() => { const soonest = [...chosen].sort((a, b) => a.sim.totals.months - b.sim.totals.months)[0]; const latest = Math.max(...chosen.map((r) => r.sim.totals.months)); return soonest.sim.totals.months < latest ? `${letter(soonest.id)} clears ${Math.round((latest - soonest.sim.totals.months) / 12)} years sooner.` : "They all clear at the same time."; })()}</p>
              <LinesChart series={lines} />
            </section>
          </div>
          {summary && <p className="m-0 rounded-xl px-5 py-4 text-base leading-6 res-card">{summary}</p>}

          <section className="panel hidden overflow-x-auto md:block" aria-label="Side-by-side comparison">
            <table className="mcmp">
              <thead>
                <tr>
                  <td style={{ borderTop: 0 }} />
                  {chosen.map((r) => (
                    <th key={r.id} scope="col" style={{ borderTop: 0, paddingTop: 18 }}><span className="flex items-center gap-2 text-[15px] font-bold"><span aria-hidden className="h-3 w-3 rounded-[4px]" style={{ background: scColour(scenarios.find((x) => x.id === r.id)!.colour) }} />{letter(r.id)}. {r.name}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const cells = describeRow(row, chosen, completions);
                  return (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {cells.map((c, i) => (
                        <td key={chosen[i].id} className={cx(c.best && "best")} style={{ fontWeight: c.best ? 700 : 400 }}>
                          <span className="inline-flex items-center gap-1.5">{c.text}{c.best && <ICheck width={16} height={16} aria-label="Best" style={{ color: "var(--accent)" }} />}</span>
                          {c.sub && <span className="sub">{c.sub}</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="flex flex-col md:hidden" aria-label="Two scenarios side by side">
            <div className="grid grid-cols-2 gap-2 pb-1.5">
              {([[left ?? picked[0] ?? ids[0], setLeft, "Left"], [right ?? picked[1] ?? ids[1], setRight, "Right"]] as const).map(([val, set, side]) => (
                <div key={side} className="flex flex-col gap-1">
                  <label className="lab sr-only" htmlFor={`pk-${side}`}>{side} column</label>
                  <select id={`pk-${side}`} className="inp !min-h-12 font-semibold" value={val} onChange={(e) => set(e.target.value)}>
                    {scenarios.map((x) => <option key={x.id} value={x.id}>{letter(x.id)}. {x.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {pairRows.map((row) => {
              const cells = describeRow(row, pair, pairDone);
              return (
                <div key={row.key} className="grid grid-cols-2 gap-2 border-t border-line-2 py-2.5">
                  <span className="col-span-2 text-[12.5px] font-semibold text-muted">{row.label}</span>
                  {cells.map((c, i) => (
                    <span key={pair[i].id} className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-base" style={{ background: c.best ? "var(--accent-soft)" : undefined, fontWeight: c.best ? 800 : 600 }}>
                      {c.text}{c.sub && <small className="text-xs font-medium text-muted">{c.sub}</small>}
                    </span>
                  ))}
                </div>
              );
            })}
          </section>

          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[13px] text-muted">Sample rates for illustration, not quotes. Estimates only. Confirm with a mortgage adviser.</p>
            <div className="flex gap-2.5">
              <button className="btn" onClick={() => window.print()}>Print</button>
              <button className="btn" onClick={() => downloadText("mortgage-scenarios.csv", comparisonCsv(chosen, rows, chosen.map((r) => letter(r.id))), "text/csv;charset=utf-8")}>Download as CSV</button>
            </div>
          </div>
          <span className="hidden print:block"><Estimate /></span>
        </>
      )}
    </div>
  );
}

