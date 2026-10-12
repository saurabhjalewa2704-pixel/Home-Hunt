"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { maxBorrowing, simulate, type Simulation } from "@homehunt/mortgage";
import { Estimate, MoneyField, RateField, Seg, SliderField } from "@/components/mortgage/bits";
import { BalanceChart } from "@/components/mortgage/Charts";
import { gbp, gbp2, plural, splitAddress } from "@/lib/format";
import { downloadText } from "@/lib/ics";
import { suggestName } from "@homehunt/mortgage";
import { homePrice, mortgageSettings, simOptions, SCENARIO_LETTERS, orderedScenarios } from "@/lib/mortgage";
import {
  calcErrors,
  calcFromScenario,
  calcInputs,
  initialCalc,
  scenarioFields,
  setDepAmt,
  setDepPct,
  setPrice,
  stampDutyOf,
  type CalcState,
} from "@/lib/mortgage-calc";
import { amortisationCsv } from "@/lib/mortgage-csv";
import { store, useStore } from "@/lib/store";
import { ACTIVE_STATUSES } from "@/lib/types";

const FIX_OPTIONS = [0, 2, 3, 5, 10];

function Calculator() {
  const s = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const settings = mortgageSettings(s.data);
  const presets = settings.ltv_rate_presets;

  const [c, setC] = useState<CalcState>(() => {
    const sid = params.get("scenario");
    const sc = sid ? s.data.mortgage_scenarios.find((x) => x.id === sid) : null;
    return sc ? calcFromScenario(s.data, sc) : initialCalc(s.data, params.get("home") ?? "");
  });
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showStamp, setShowStamp] = useState(c.sdltOverride !== null);
  const [months, setMonths] = useState(false);
  const [income, setIncome] = useState<number>(settings.combined_income ?? 0);

  const errors = calcErrors(c);
  const stamp = stampDutyOf(c, s.data);
  const inputs = calcInputs(c, stamp);
  const key = JSON.stringify(inputs);
  const live = useMemo(() => (inputs ? simulate(inputs, null, simOptions(settings)) : null), [key, settings.allowance_pct]); // eslint-disable-line react-hooks/exhaustive-deps
  // While a field is invalid, keep showing the last valid result (MC-3).
  const last = useRef<{ sim: Simulation; termYears: number; fixYears: number } | null>(null);
  if (live && inputs) last.current = { sim: live, termYears: inputs.termMonths / 12, fixYears: inputs.initialPeriodMonths / 12 };
  const shown = last.current;
  const sim = shown?.sim ?? null;

  const homes = s.data.properties.filter((p) => !p.archived_at && ACTIVE_STATUSES.includes(p.status)).sort((a, b) => a.address.localeCompare(b.address));
  const linkedHome = c.homeId ? s.data.properties.find((p) => p.id === c.homeId) : null;
  const edit = <K extends keyof CalcState>(k: K, v: CalcState[K]) => setC((cur) => ({ ...cur, [k]: v }));
  const existing = c.scenarioId ? s.data.mortgage_scenarios.find((x) => x.id === c.scenarioId) : null;
  const letters = orderedScenarios(s.data);
  const existingLetter = existing ? SCENARIO_LETTERS[letters.findIndex((x) => x.id === existing.id)] : null;

  const pickHome = (id: string) => {
    const price = id ? homePrice(s.data, id) : null;
    setC((cur) => ({ ...setPrice({ ...cur, homeId: id, sdltOverride: null }, price ?? cur.price, presets), homeId: id }));
    setShowStamp(false);
  };

  const maxLoan = income > 0 ? maxBorrowing(income, settings.income_multiple) : null;
  const overMax = maxLoan !== null && sim && sim.loan > maxLoan;

  const defaultName = inputs ? suggestName(inputs) : "";
  const fields = scenarioFields(c, s.data);

  async function save(asNew: boolean) {
    if (!fields || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await store.saveScenario({ ...fields, id: asNew ? undefined : c.scenarioId ?? undefined, name: name.trim() || defaultName, note: note.trim() || null });
      return saved;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save that scenario.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  const rateHint = c.bandRate ? "Following the sample rate for your loan-to-value band. Edit it to type your own." : undefined;
  const yearly = sim?.yearly ?? [];
  const balancePoints = sim ? [{ year: 0, balance: sim.loan }, ...yearly.map((y) => ({ year: y.year, balance: y.closing }))] : [];
  const y1 = yearly[0];

  const saveAndGo = async (asNew: boolean, to?: (id: string) => string) => {
    const sc = await save(asNew);
    if (sc) router.push(to ? to(sc.id) : "/mortgage/scenarios");
  };

  return (
    <div className="flex flex-wrap items-start gap-6 max-md:pb-20">
      {/* Phones: the answer stays in view while you move the sliders, and saving stays within reach. */}
      {sim && !sim.noMortgage && (
        <div aria-hidden className="no-print sticky top-12 z-20 -mx-4 flex w-[calc(100%+2rem)] items-end justify-between gap-3 border-b border-line bg-bg px-4 py-2.5 md:hidden">
          <span className="flex flex-col"><span className="text-xs text-muted">Monthly payment</span><span className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">{gbp2(sim.payment)}</span></span>
          <span className="flex flex-col text-right"><span className="text-xs text-muted">Total interest</span><span className="text-lg font-bold">{gbp(sim.totals.interest)}</span></span>
        </div>
      )}
      <div className="no-print fixed inset-x-0 bottom-[80px] z-20 flex gap-2.5 border-t border-line bg-bg p-3 md:hidden">
        <Link className="btn flex-1" href={existing ? `/mortgage/overpayments?scenario=${existing.id}` : "/mortgage/overpayments"} aria-label="Try overpaying">Try overpaying</Link>
        <button className="btn btn-p flex-1" disabled={!fields || saving} aria-label={existing ? "Update this scenario" : "Save this scenario"} onClick={() => void saveAndGo(false)}>{existing ? "Update scenario" : "Save scenario"}</button>
      </div>
      <section className="panel min-w-0 flex-[1_1_380px]" aria-label="Your numbers">
        {existing && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-6 py-3 text-sm">
            <span>Editing <strong>{existingLetter}. {existing.name}</strong></span>
            <button className="font-semibold text-accent underline" onClick={() => { setC(initialCalc(s.data)); router.replace("/mortgage"); }}>Start a fresh one</button>
          </div>
        )}
        <div className="mgrp">
          <h2 className="m-0 text-base font-bold">The home</h2>
          <div className="flex flex-col gap-1.5">
            <label className="lab" htmlFor="c-home">Home from your board</label>
            <select id="c-home" className="inp" value={c.homeId} onChange={(e) => pickHome(e.target.value)}>
              <option value="">No specific home</option>
              {homes.map((p) => <option key={p.id} value={p.id}>{splitAddress(p.address).street}, {gbp(homePrice(s.data, p.id) ?? p.asking_price)}</option>)}
            </select>
            {linkedHome && c.price !== (homePrice(s.data, c.homeId) ?? c.price) && <span className="text-[13px] text-muted">Price changed from {gbp(homePrice(s.data, c.homeId))}, for example for an offer below asking.</span>}
          </div>
          <MoneyField id="c-price" label="Price" value={c.price} onChange={(n) => setC((cur) => setPrice(cur, n, presets))} error={errors.price} />
          <input className="mrng" type="range" aria-label="Price slider" min={400_000} max={1_000_000} step={5_000} value={Math.min(1_000_000, Math.max(400_000, c.price))} onChange={(e) => setC((cur) => setPrice(cur, Number(e.target.value), presets))} />
        </div>

        <div className="mgrp">
          <h2 className="m-0 text-base font-bold">Your deposit</h2>
          <SliderField id="c-dep" label="Deposit" valueText={`${Math.round(c.depPct * 100) / 100}%, ${gbp(c.depAmt)}`} min={5} max={40} step={1} value={c.depPct} onChange={(n) => setC((cur) => setDepPct(cur, n, presets))} />
          <div className="flex flex-wrap gap-3">
            <MoneyField id="c-dep-amt" label="Deposit (£)" value={c.depAmt} onChange={(n) => setC((cur) => setDepAmt(cur, n, presets))} error={errors.deposit} />
            <MoneyField id="c-dep-pct" label="Deposit (%)" value={Math.round(c.depPct * 100) / 100} onChange={(n) => setC((cur) => setDepPct(cur, n, presets))} prefix="" suffix="%" step={0.5} max={100} />
          </div>
          {sim && !sim.noMortgage && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{sim.ltv.toFixed(0)}% loan-to-value{sim.ltvBand ? `, ${sim.ltvBand}% band` : ", above the 95% band"}</span>
              <span className="text-[13px] leading-[18px] text-muted">{sim.nextBand ? `${gbp(sim.headroom)} more deposit gets you to the ${sim.nextBand}% band` : "Best band already"}</span>
            </div>
          )}
        </div>

        <div className="mgrp">
          <h2 className="m-0 text-base font-bold">The mortgage</h2>
          <SliderField id="c-term" label="Term" valueText={`${c.termYears} years${c.termExtraMonths ? ` ${c.termExtraMonths} months` : ""}`} min={5} max={40} step={1} value={c.termYears} onChange={(n) => edit("termYears", n)} />
          <div className="flex flex-wrap gap-3">
            <MoneyField id="c-term-y" label="Years" value={c.termYears} onChange={(n) => edit("termYears", Math.round(n))} prefix="" min={5} max={40} error={errors.term} />
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor="c-term-m">Extra months</label>
              <select id="c-term-m" className="inp !min-h-12" value={c.termExtraMonths} onChange={(e) => edit("termExtraMonths", Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <RateField id="c-rate" label="Interest rate" value={c.rateStr} onChange={(v) => setC((cur) => ({ ...cur, rateStr: v, bandRate: false }))} error={errors.rate} hint={rateHint} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink-2">
            <input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={c.bandRate} onChange={(e) => setC((cur) => (e.target.checked ? setDepAmt({ ...cur, bandRate: true }, cur.depAmt, presets) : { ...cur, bandRate: false }))} />
            Use the sample rate for my loan-to-value band
          </label>
          <Seg label="Fixed for" value={c.initialYears} onChange={(v) => edit("initialYears", v)} options={[...new Set([...FIX_OPTIONS, c.initialYears])].sort((a, b) => a - b).map((y) => ({ value: y, label: y === 0 ? "Whole term" : `${y} yrs` }))} />
          {c.initialYears === 0 && <span className="-mt-2 text-[13px] text-muted">One rate for the whole term.</span>}
          {c.initialYears > 0 && (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink-2">
                <input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={c.followSame} onChange={(e) => edit("followSame", e.target.checked)} />
                After the fix, assume we remortgage at the same rate
              </label>
              {!c.followSame && <RateField id="c-follow" label="Rate after the fix" value={c.followStr} onChange={(v) => edit("followStr", v)} sliderMin={2} sliderMax={10} error={errors.follow} hint="This shows the cost of not remortgaging." />}
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <MoneyField id="c-fee" label="Arrangement fee" value={c.feeAmount} onChange={(n) => edit("feeAmount", n)} />
            <MoneyField id="c-other" label="Other purchase costs" value={c.otherCosts} onChange={(n) => edit("otherCosts", n)} hint="Legal fees, survey, searches." />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink-2">
            <input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={c.feeAdded} onChange={(e) => edit("feeAdded", e.target.checked)} />
            Add the arrangement fee to the loan
          </label>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Stamp duty estimate <strong>{gbp(stamp)}</strong>{c.sdltOverride !== null && " (your figure)"}</span>
            <button className="font-semibold text-accent underline" onClick={() => { if (showStamp) { edit("sdltOverride", null); setShowStamp(false); } else { edit("sdltOverride", stamp); setShowStamp(true); } }}>{showStamp ? "Use the estimate" : "Change"}</button>
          </div>
          {showStamp && <MoneyField id="c-sdlt" label="Stamp duty (£)" value={c.sdltOverride ?? 0} onChange={(n) => edit("sdltOverride", n)} />}
          <MoneyField id="c-income" label="Combined gross income (optional)" value={income} onChange={setIncome} hint={`Used for a rough borrowing check at ${settings.income_multiple}× income.`} />
          {income !== (settings.combined_income ?? 0) && <button className="btn w-fit" onClick={() => void store.saveMortgageSettings({ combined_income: income > 0 ? income : null })}>Remember this income</button>}
        </div>
      </section>

      <section className="flex min-w-0 flex-[1.25_1_460px] flex-col gap-5" aria-label="Results" aria-live="polite">
        {Object.keys(errors).length > 0 && <p role="status" className="m-0 rounded-xl p-3 text-sm chip-warn">Fix the highlighted field to update the results. Showing your last valid result.</p>}
        {sim ? (
          <>
            <div className="panel flex flex-col gap-5 p-6">
              {sim.noMortgage ? (
                <div className="flex flex-col gap-1"><span className="text-[15px] text-muted">Monthly payment</span><span className="text-[40px] leading-[44px] font-extrabold">£0</span><span className="text-[15px] font-semibold">No mortgage needed. Your deposit covers the price.</span></div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] text-muted">Monthly payment</span>
                  <span className="text-[44px] leading-[48px] font-extrabold tracking-[-0.03em] md:text-[56px] md:leading-[60px]" data-testid="monthly-payment">{gbp2(sim.payment)}</span>
                  {sim.paymentAfter !== null && <span className="text-[15px] font-semibold" style={{ color: "var(--amber-fg)" }}>Rising to {gbp2(sim.paymentAfter)} a month after year {shown!.fixYears} if you don't remortgage</span>}
                  <span className="text-sm text-muted">On a loan of {gbp(sim.loan)} over {plural(Math.floor(sim.totals.months / 12), "year")}{sim.totals.months % 12 ? ` ${plural(sim.totals.months % 12, "month")}` : ""}</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="mstat"><span className="mstat-l">Total interest</span><span className="mstat-v">{gbp(sim.totals.interest)}</span></div>
                <div className="mstat"><span className="mstat-l">Total payable</span><span className="mstat-v">{gbp(sim.totals.payable)}</span></div>
                <div className="mstat"><span className="mstat-l">Cash needed on day one</span><span className="mstat-v">{gbp(sim.cashNeeded)}</span></div>
              </div>
              <p className="m-0 text-[13px] leading-[18px] text-muted">Total cost of borrowing {gbp(sim.totalCostOfBorrowing)} (interest plus the {gbp(c.feeAmount)} fee). Cash needed is the {gbp(c.depAmt)} deposit, {gbp(stamp)} stamp duty{c.feeAdded ? "" : `, ${gbp(c.feeAmount)} fee`} and {gbp(c.otherCosts)} other costs.</p>
              {!sim.noMortgage && (
                <div className="flex flex-col gap-2">
                  <div className="flex h-3.5 overflow-hidden rounded-[7px]" role="img" aria-label={`Of ${gbp(sim.totals.payable)} repaid, ${gbp(sim.loan)} is the loan and ${gbp(sim.totals.interest)} is interest`}>
                    <span style={{ width: `${(sim.loan / sim.totals.payable) * 100}%`, background: "var(--accent)" }} />
                    <span className="flex-1" style={{ background: "var(--track)" }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-ink-2">
                    <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: "var(--accent)" }} />Borrowed {gbp(sim.loan)}</span>
                    <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: "var(--track)" }} />Interest {gbp(sim.totals.interest)} ({Math.round((sim.totals.interest / sim.totals.payable) * 100)}% of what you repay)</span>
                  </div>
                </div>
              )}
              {overMax && <p role="alert" className="m-0 rounded-xl p-3 text-sm chip-warn">Typical maximum borrowing is about {gbp(maxLoan!)} ({settings.income_multiple}× {gbp(income)}), and this loan is {gbp(sim.loan - maxLoan!)} above that. A mortgage adviser can say what you could really borrow.</p>}
              {maxLoan !== null && !overMax && <p className="m-0 text-[13px] text-muted">Typical maximum borrowing about {gbp(maxLoan)} at {settings.income_multiple}× your income.</p>}
              <Estimate />
            </div>

            {!sim.noMortgage && (
              <div className="panel flex flex-col gap-2 px-6 py-5">
                <h2 className="m-0 text-[17px] font-bold">What you owe, year by year</h2>
                <BalanceChart points={balancePoints} termYears={shown!.termYears} fixYears={shown!.fixYears} label={`Balance falls from ${gbp(sim.loan)} to zero over ${shown!.termYears} years`} />
                {y1 && <p className="m-0 text-[13px] leading-[18px] text-muted">In year 1 you pay {gbp(y1.interest)} of interest and clear {gbp(y1.capital)} of the loan.</p>}
              </div>
            )}

            {!sim.noMortgage && (
              <details className="panel px-6 py-4">
                <summary className="cursor-pointer text-[15px] font-bold">Full repayment table</summary>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink-2"><input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={months} onChange={(e) => setMonths(e.target.checked)} />Show every month</label>
                  <button className="btn" onClick={() => downloadText(months ? "repayments-by-month.csv" : "repayments-by-year.csv", amortisationCsv(sim, months))}>Download as CSV</button>
                </div>
                <div className="mt-2 max-h-[420px] overflow-auto">
                  <table className="mnum-t">
                    <thead><tr><th scope="col">{months ? "Month" : "Year"}</th><th scope="col">Opening balance</th><th scope="col">Interest</th><th scope="col">Capital</th><th scope="col">Closing balance</th></tr></thead>
                    <tbody>
                      {months
                        ? sim.schedule.map((m) => <tr key={m.month}><td>{m.month}</td><td>{gbp(m.opening)}</td><td>{gbp(m.interest)}</td><td>{gbp(m.capital)}</td><td>{gbp(m.closing)}</td></tr>)
                        : yearly.map((y) => <tr key={y.year}><td>{y.year}</td><td>{gbp(y.opening)}</td><td>{gbp(y.interest)}</td><td>{gbp(y.capital)}</td><td>{gbp(y.closing)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 mb-0 text-[12.5px] leading-[18px] text-muted">Interest is worked out monthly at the annual rate ÷ 12, which is how lenders usually illustrate payments. A real statement may use daily interest and differ by small amounts.</p>
              </details>
            )}
          </>
        ) : (
          <p className="panel m-0 p-6 text-muted">Enter a price, deposit, term and rate to see the monthly payment.</p>
        )}

        <div className="no-print panel flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor="sc-name">Scenario name</label>
              <input id="sc-name" className="inp" placeholder={defaultName || "For example 15% down, 30 yrs, 5.15%"} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor="sc-note">Note (optional)</label>
              <input id="sc-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder={existing?.note ?? "Why this one?"} />
            </div>
          </div>
          {saveError && <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>{saveError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Estimate />
            <div className="flex flex-wrap gap-2.5">
              {existing ? (
                <>
                  <Link className="btn" href={`/mortgage/overpayments?scenario=${existing.id}`}>Try overpaying</Link>
                  <button className="btn" disabled={!fields || saving} onClick={async () => { if (await save(true)) router.push("/mortgage/scenarios"); }}>Save as new</button>
                  <button className="btn btn-p" disabled={!fields || saving} onClick={async () => { if (await save(false)) router.push("/mortgage/scenarios"); }}>Update scenario</button>
                </>
              ) : (
                <>
                  <button className="btn" disabled={!fields || saving} onClick={async () => { const sc = await save(false); if (sc) router.push(`/mortgage/overpayments?scenario=${sc.id}`); }}>Save and try overpaying</button>
                  <button className="btn btn-p" disabled={!fields || saving} onClick={async () => { if (await save(false)) router.push("/mortgage/scenarios"); }}>Save as scenario</button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense fallback={<p className="text-muted" role="status">Opening the calculator…</p>}>
      <Calculator />
    </Suspense>
  );
}
