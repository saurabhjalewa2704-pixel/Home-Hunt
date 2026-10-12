"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { compareOverpay, simulate, type OverpaymentMode, type OverpaymentPlan, type OverpaymentType, type Simulation } from "@homehunt/mortgage";
import { IWarn } from "@/components/icons";
import { Estimate, MoneyField, Seg } from "@/components/mortgage/bits";
import { OverpayChart, type BalancePoint } from "@/components/mortgage/Charts";
import { EmptyState, cx } from "@/components/ui";
import { gbp, gbp2, yrsMos } from "@/lib/format";
import { EMPTY_PLAN, inputsOf, letterOf, mortgageSettings, orderedScenarios, planFor, simOptions } from "@/lib/mortgage";
import { store, useStore } from "@/lib/store";

interface Form {
  type: OverpaymentType;
  amount: number;
  percent: number;
  startYear: number;
  /** 0 means "to the end". */
  endYear: number;
  increase: number;
  mode: OverpaymentMode;
  lumpYear: number;
}

const toForm = (p: OverpaymentPlan | null): Form => {
  const q = p ?? EMPTY_PLAN;
  return {
    type: q.type,
    amount: q.amount || 10_000,
    percent: q.percent || 5,
    startYear: Math.floor((Math.max(1, q.startMonth) - 1) / 12) + 1,
    endYear: q.endMonth ? Math.ceil(q.endMonth / 12) : 0,
    increase: q.annualIncreasePct,
    mode: q.mode,
    lumpYear: q.lumpSumMonth ? Math.ceil(q.lumpSumMonth / 12) : 1,
  };
};
const toPlan = (f: Form): OverpaymentPlan => ({
  type: f.type,
  amount: f.amount,
  percent: f.percent,
  startMonth: (f.startYear - 1) * 12 + 1,
  endMonth: f.endYear > 0 ? f.endYear * 12 : null,
  annualIncreasePct: f.increase,
  mode: f.mode,
  lumpSumMonth: f.type === "lump_sum" ? f.lumpYear * 12 : null,
});

const TYPES: Array<{ value: OverpaymentType; label: string }> = [
  { value: "annual_amount", label: "A fixed amount each year" },
  { value: "annual_percent", label: "% of the balance each year" },
  { value: "monthly_amount", label: "A fixed amount each month" },
  { value: "lump_sum", label: "A one-off lump sum" },
];

const points = (sim: Simulation): BalancePoint[] => {
  const ys = sim.yearly.slice(0, -1).map((y) => ({ year: y.year, balance: y.closing }));
  const last = sim.yearly[sim.yearly.length - 1];
  const lastIsFull = last && sim.totals.months % 12 === 0;
  return [{ year: 0, balance: sim.loan }, ...ys, ...(last ? [lastIsFull ? { year: last.year, balance: last.closing } : { year: sim.totals.months / 12, balance: 0 }] : [])];
};

const describe = (f: Form) =>
  f.type === "annual_amount" ? `${gbp(f.amount)} a year` : f.type === "annual_percent" ? `${f.percent}% of the balance each year` : f.type === "monthly_amount" ? `${gbp(f.amount)} a month` : `a one-off ${gbp(f.amount)}`;

function Simulator() {
  const s = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const settings = mortgageSettings(s.data);
  const scenarios = orderedScenarios(s.data);
  const wanted = params.get("scenario");
  const [baseId, setBaseId] = useState(() => (scenarios.find((x) => x.id === wanted) ?? scenarios.find((x) => x.is_preferred) ?? scenarios[0])?.id ?? "");
  const base = scenarios.find((x) => x.id === baseId) ?? null;
  const [form, setForm] = useState<Form>(() => toForm(base ? planFor(s.data, base.id) : null));
  const [showAll, setShowAll] = useState(false);
  const [both, setBoth] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const edit = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const inputs = base ? inputsOf(s.data, base) : null;
  const opts = simOptions(settings);
  const key = JSON.stringify([inputs, form, settings.allowance_pct, settings.erc_pct]);
  const calc = useMemo(() => {
    if (!inputs) return null;
    const baseline = simulate(inputs, null, opts);
    const withPlan = simulate(inputs, toPlan(form), opts);
    const other = simulate(inputs, { ...toPlan(form), mode: form.mode === "shorten_term" ? "lower_payment" : "shorten_term" }, opts);
    return { baseline, withPlan, other, cmp: compareOverpay(baseline, withPlan), cmpOther: compareOverpay(baseline, other) };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!scenarios.length || !base || !inputs || !calc) {
    return <EmptyState title="Save a scenario first" body="The simulator overpays an existing mortgage, so it needs a saved scenario to start from. Set one up in the calculator and save it." action={<Link href="/mortgage" className="btn btn-p">Open the calculator</Link>} />;
  }
  const { baseline, withPlan, other, cmp, cmpOther } = calc;
  const letter = letterOf(s.data, base.id);
  const none = withPlan.totals.overpaid < 0.5;
  const saved = planFor(s.data, base.id);
  const isSaved = !!saved && JSON.stringify(toPlan(toForm(saved))) === JSON.stringify(toPlan(form));
  const fixYears = inputs.initialPeriodMonths / 12;
  const termYears = inputs.termMonths / 12;

  const sentence = (sim: Simulation, c: typeof cmp, mode: OverpaymentMode) => {
    if (none) return "Move the slider to see what overpaying would save.";
    const early = baseline.totals.months - sim.totals.months;
    return mode === "shorten_term"
      ? `Overpaying ${describe(form)} clears the mortgage ${yrsMos(early)} early and saves ${gbp(c.interestSaved)} in interest.`
      : `Overpaying ${describe(form)} lowers your payment to ${gbp2(sim.lowerPayments.afterFirst ?? sim.payment)} a month after the first overpayment and saves ${gbp(c.interestSaved)} in interest.`;
  };

  const breaches = withPlan.breaches;
  const first = breaches[0];
  const breachText = first
    ? `In year ${first.year} you'd overpay ${gbp(first.excess)} more than the ${settings.allowance_pct}% allowance of ${gbp(first.allowance)}. Your lender may charge an early repayment charge on that amount${first.erc !== null ? `, which at ${settings.erc_pct}% is about ${gbp(first.erc)}` : ""}${breaches.length > 1 ? `, and in ${breaches.length - 1} more year${breaches.length > 2 ? "s" : ""} of the fix` : ""}.`
    : "";

  const shorten = form.mode === "shorten_term";
  const stats: Array<[string, string, boolean?]> = [
    shorten ? ["Mortgage-free in", yrsMos(withPlan.totals.months)] : ["New monthly payment", gbp2(withPlan.lowerPayments.afterFirst ?? withPlan.payment)],
    shorten ? ["Time saved", cmp.monthsSaved ? yrsMos(cmp.monthsSaved) : "–"] : ["Total overpaid", gbp(withPlan.totals.overpaid)],
    ["Interest saved", gbp(cmp.interestSaved), true],
    ["Total payable saved", gbp(cmp.payableSaved), true],
  ];
  const payRow = shorten || !withPlan.lowerPayments.afterFirst ? gbp2(baseline.payment) : `${gbp2(baseline.payment)}, then ${gbp2(withPlan.lowerPayments.afterFirst)}`;
  const vs = [
    { label: "Term", base: yrsMos(baseline.totals.months), over: yrsMos(withPlan.totals.months), save: cmp.monthsSaved ? yrsMos(cmp.monthsSaved) : "–" },
    { label: "Monthly payment", base: gbp2(baseline.payment), over: payRow, save: !shorten && withPlan.lowerPayments.afterFirst ? `${gbp2(baseline.payment - withPlan.lowerPayments.afterFirst)} a month` : "–" },
    { label: "Regular monthly payments in total", base: gbp(baseline.totals.regular), over: gbp(withPlan.totals.regular), save: "–" },
    { label: "Overpayments", base: "£0", over: gbp(withPlan.totals.overpaid), save: "–" },
    { label: "Total payable", base: gbp(baseline.totals.payable), over: gbp(withPlan.totals.payable), save: gbp(cmp.payableSaved), strong: true },
    { label: "Of which interest", base: gbp(baseline.totals.interest), over: gbp(withPlan.totals.interest), save: gbp(cmp.interestSaved) },
  ];

  const rows = withPlan.yearly.slice(0, showAll ? undefined : 10);
  const presets: Array<{ label: string; f: Partial<Form> }> = [
    { label: "£5,000 a year", f: { type: "annual_amount", amount: 5_000 } },
    { label: "£10,000 a year", f: { type: "annual_amount", amount: 10_000 } },
    { label: "5% a year", f: { type: "annual_percent", percent: 5 } },
    { label: `${settings.allowance_pct}% a year, the full allowance`, f: { type: "annual_percent", percent: settings.allowance_pct } },
  ];
  const isPreset = (p: (typeof presets)[number]) => p.f.type === form.type && (p.f.type === "annual_amount" ? p.f.amount === form.amount : p.f.percent === form.percent);

  async function save() {
    try {
      await store.saveOverpaymentPlan(base!.id, toPlan(form));
      setFlash(`Saved to scenario ${letter}. It now shows in Scenarios.`);
      setTimeout(() => setFlash(null), 4000);
    } catch {
      /* the store shows the reason */
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="panel min-w-0 flex-[1_1_320px] max-md:order-2" aria-label="How you'd overpay">
        <div className="mgrp !gap-2.5">
          <label className="lab" htmlFor="o-base">Mortgage</label>
          <select id="o-base" className="inp" value={baseId} onChange={(e) => { setBaseId(e.target.value); setForm(toForm(planFor(s.data, e.target.value))); router.replace(`/mortgage/overpayments?scenario=${e.target.value}`); }}>
            {scenarios.map((x) => <option key={x.id} value={x.id}>{letterOf(s.data, x.id)}. {x.name}{x.is_preferred ? " (our plan)" : ""}</option>)}
          </select>
          <span className="text-[13px] text-muted">{gbp(baseline.loan)} at {inputs.initialRate.toFixed(2)}%{inputs.initialPeriodMonths ? `, fixed for ${fixYears} years` : ""}. {gbp2(baseline.payment)} a month.</span>
        </div>
        <div className="mgrp !gap-2.5">
          <span className="lab">Start from</span>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => <button key={p.label} type="button" className="filter" aria-pressed={isPreset(p)} onClick={() => setForm((f) => ({ ...f, ...p.f }))}>{p.label}</button>)}
          </div>
        </div>
        <div className="mgrp !gap-3">
          <Seg label="Overpay" value={form.type} onChange={(v) => edit("type", v)} options={TYPES} cols={2} />
          {form.type === "annual_percent" ? (
            <>
              <div className="flex items-baseline justify-between gap-3"><label className="lab" htmlFor="o-pct">Share of the balance each year</label><span className="text-[22px] font-extrabold">{form.percent}%</span></div>
              <input className="mrng" id="o-pct" type="range" min={0} max={20} step={1} value={form.percent} onChange={(e) => edit("percent", Number(e.target.value))} />
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3"><label className="lab" htmlFor="o-amt">{form.type === "annual_amount" ? "Amount each year" : form.type === "monthly_amount" ? "Amount each month" : "Lump sum"}</label><span className="text-[22px] font-extrabold">{gbp(form.amount)}</span></div>
              <input className="mrng" id="o-amt" type="range" min={0} max={form.type === "monthly_amount" ? 5_000 : form.type === "lump_sum" ? 200_000 : 70_000} step={form.type === "monthly_amount" ? 50 : 1_000} value={Math.min(form.amount, form.type === "monthly_amount" ? 5_000 : form.type === "lump_sum" ? 200_000 : 70_000)} onChange={(e) => edit("amount", Number(e.target.value))} />
              <MoneyField id="o-amt-n" label="Or type an amount" value={form.amount} onChange={(n) => edit("amount", n)} />
            </>
          )}
          <span className="text-[13px] text-muted">{form.type === "monthly_amount" ? "Paid every month." : form.type === "lump_sum" ? "Paid once." : "Paid at each mortgage anniversary."}</span>
        </div>
        <div className="mgrp !gap-3">
          {form.type === "lump_sum" ? (
            <MoneyField id="o-lump" label="Paid at the end of year" value={form.lumpYear} onChange={(n) => edit("lumpYear", Math.max(1, Math.min(termYears, Math.round(n))))} prefix="" min={1} max={termYears} />
          ) : (
            <>
              <Seg label="Starting" value={form.startYear > 1 ? "later" : "now"} onChange={(v) => edit("startYear", v === "now" ? 1 : Math.max(fixYears + 1, 2))} options={[{ value: "now", label: "From year 1" }, { value: "later", label: fixYears ? "After the fix ends" : "Later" }]} />
              <div className="flex flex-wrap gap-3">
                <MoneyField id="o-start" label="From year" value={form.startYear} onChange={(n) => edit("startYear", Math.max(1, Math.round(n)))} prefix="" min={1} max={termYears} />
                <MoneyField id="o-end" label="Stop after year (0 for the end)" value={form.endYear} onChange={(n) => edit("endYear", Math.max(0, Math.round(n)))} prefix="" min={0} max={termYears} />
                {form.type !== "annual_percent" && <MoneyField id="o-inc" label="Increase each year" value={form.increase} onChange={(n) => edit("increase", n)} prefix="" suffix="%" step={0.5} max={50} hint="For pay rises." />}
              </div>
            </>
          )}
        </div>
        <div className="mgrp !gap-3">
          <Seg label="Use overpayments to" value={form.mode} onChange={(v) => edit("mode", v)} options={[{ value: "shorten_term", label: "Finish sooner" }, { value: "lower_payment", label: "Pay less each month" }]} />
          <button className="btn w-fit" aria-expanded={both} onClick={() => setBoth((v) => !v)}>{both ? "Hide the comparison" : "Compare both"}</button>
        </div>
      </section>

      <section className="flex min-w-0 flex-[1.6_1_520px] flex-col gap-5 max-md:order-1" aria-label="Result" aria-live="polite">
        <p className="m-0 text-[13px] text-muted md:hidden">On {letter}, {base.name}: {gbp(baseline.loan)} at {inputs.initialRate.toFixed(2)}% over {termYears} years</p>
        {breaches.length > 0 && (
          <div role="alert" className="flex gap-3 rounded-xl border p-3.5" style={{ background: "var(--amber-bg)", borderColor: "var(--amber)", color: "var(--amber-fg)" }}>
            <IWarn width={20} height={20} className="mt-0.5 flex-none" />
            <span className="text-sm leading-[21px] md:text-[14.5px]">{breachText}</span>
          </div>
        )}
        <div className="panel flex flex-col gap-4 p-5 md:p-6">
          <p className="m-0 max-w-[40ch] text-[21px] leading-7 font-bold tracking-[-0.01em] md:text-2xl md:leading-8" data-testid="op-headline">{sentence(withPlan, cmp, form.mode)}</p>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {stats.map(([l, v, good]) => <div key={l} className="mstat"><span className="mstat-l">{l}</span><span className="mstat-v" style={good ? { color: "var(--accent)" } : undefined}>{v}</span></div>)}
          </div>
          {!none && cmp.returnPerPound > 0 && <p className="m-0 text-sm text-ink-2">Each £1 overpaid saves about <strong>£{cmp.returnPerPound.toFixed(2)}</strong> of interest, on {gbp(cmp.totalOverpaid)} overpaid in total.</p>}

          <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
            <table className="mnum-t" style={{ minWidth: 520 }}>
              <caption className="px-4 pt-3.5 pb-1 text-left text-base font-bold">Original term against overpaying</caption>
              <thead><tr><th scope="col" /><th scope="col">Original term</th><th scope="col">With overpayments</th><th scope="col" style={{ color: "var(--accent)" }}>You save</th></tr></thead>
              <tbody>
                {vs.map((v) => (
                  <tr key={v.label} style={v.strong ? { background: "var(--surface-2)", fontWeight: 800 } : undefined}>
                    <th scope="row" style={{ textAlign: "left", fontWeight: v.strong ? 800 : 400 }}>{v.label}</th><td>{v.base}</td><td>{v.over}</td><td style={{ color: "var(--accent)", background: v.strong ? "var(--accent-soft)" : undefined }}>{v.save}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 px-4 pt-2.5 pb-3.5 text-[12.5px] leading-[18px] text-muted">Total payable is every pound you pay the lender: monthly payments plus overpayments. You borrow the same amount either way, so the saving equals the interest saved.</p>
          </div>
          <section aria-labelledby="vs-h" className="rounded-xl border border-line px-3.5 pt-3 pb-1 md:hidden">
            <h2 id="vs-h" className="m-0 mb-1 text-[15px] font-bold">Original term against overpaying</h2>
            {vs.filter((v) => ["Term", "Total payable", "Of which interest"].includes(v.label)).map((v) => (
              <div key={v.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 border-t border-line-2 py-2.5 text-sm">
                <span className="col-span-2 text-[12.5px] font-semibold text-muted">{v.label === "Of which interest" ? "Interest" : v.label}</span>
                <span className="text-muted">Original</span><span className="text-right">{v.base}</span>
                <span className="font-bold">Overpaying</span><span className="text-right font-bold">{v.over}</span>
                <span className="font-bold" style={{ color: "var(--accent)" }}>You save</span><span className="text-right font-extrabold" style={{ color: "var(--accent)" }}>{v.save}</span>
              </div>
            ))}
            <p className="m-0 py-2.5 text-xs leading-[17px] text-muted">Total payable includes the overpayments ({gbp(withPlan.totals.overpaid)}).</p>
          </section>

          {both && (
            <section aria-label="Both outcomes side by side" className="grid gap-3 sm:grid-cols-2">
              {([["Finish sooner", "shorten_term", shorten ? withPlan : other, shorten ? cmp : cmpOther], ["Pay less each month", "lower_payment", shorten ? other : withPlan, shorten ? cmpOther : cmp]] as const).map(([label, mode, sim, c]) => (
                <div key={mode} className="rounded-xl border border-line p-4" style={form.mode === mode ? { borderColor: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" } : undefined}>
                  <h3 className="m-0 mb-1.5 text-base font-bold">{label}</h3>
                  <p className="m-0 text-sm leading-5">{sentence(sim, c, mode)}</p>
                  <dl className="m-0 mt-2.5 grid grid-cols-2 gap-1 text-sm"><dt className="text-muted">Mortgage-free in</dt><dd className="m-0 text-right">{yrsMos(sim.totals.months)}</dd><dt className="text-muted">Payment</dt><dd className="m-0 text-right">{gbp2(mode === "lower_payment" ? sim.lowerPayments.afterFirst ?? sim.payment : sim.payment)}</dd><dt className="text-muted">Interest saved</dt><dd className="m-0 text-right font-bold" style={{ color: "var(--accent)" }}>{gbp(c.interestSaved)}</dd></dl>
                </div>
              ))}
            </section>
          )}

          <OverpayChart base={points(baseline)} over={points(withPlan)} termYears={termYears} fixYears={fixYears} endMonths={withPlan.totals.months} />
        </div>

        <div className="panel overflow-x-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-[18px] pb-1.5">
            <h2 className="m-0 text-[17px] font-bold">Year by year</h2>
            <span className="text-[13px] text-muted">Allowance: {settings.allowance_pct}% of the balance at the start of each year, during the fix.</span>
          </div>
          <table className="mnum-t" style={{ minWidth: 640 }}>
            <thead><tr><th scope="col">Year</th><th scope="col">Start balance</th><th scope="col">Interest</th><th scope="col">Overpaid</th><th scope="col">Allowance</th><th scope="col">End balance</th></tr></thead>
            <tbody>
              {rows.map((y) => (
                <tr key={y.year} className={cx(y.flagged && "mrow-warn")}>
                  <td>{y.year}</td><td>{gbp(y.opening)}</td><td>{gbp(y.interest)}</td>
                  <td style={{ fontWeight: 600, color: y.flagged ? "var(--amber-fg)" : undefined }}>{y.overpaid > 0 ? gbp(y.overpaid) : "–"}{y.flagged && <span className="sr-only"> (over the allowance)</span>}</td>
                  <td style={{ color: "var(--muted)" }}>{y.allowance === null ? "No limit" : gbp(y.allowance)}</td><td>{gbp(y.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {withPlan.yearly.length > 10 && <div className="px-5 py-3"><button className="btn" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show years 1 to 10" : `Show all ${withPlan.yearly.length} years`}</button></div>}
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1"><Estimate /><span className="text-[13px] text-muted">Your lender's rules on overpayments apply. Interest is worked out monthly.</span></div>
          <div className="flex flex-wrap items-center gap-2.5">
            {flash && <span role="status" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{flash}</span>}
            {saved && <button className="btn" onClick={() => void store.saveOverpaymentPlan(base.id, null)}>Remove saved plan</button>}
            <button className="btn btn-p" disabled={none || isSaved} onClick={() => void save()}>{isSaved ? `Saved to scenario ${letter}` : `Save to scenario ${letter}`}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function OverpaymentsPage() {
  return (
    <Suspense fallback={<p className="text-muted" role="status">Opening the simulator…</p>}>
      <Simulator />
    </Suspense>
  );
}
