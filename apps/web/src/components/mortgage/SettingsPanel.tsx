"use client";
import { useEffect, useState } from "react";
import { mortgageSettings } from "@/lib/mortgage";
import { store, useStore } from "@/lib/store";
import { MoneyField } from "./bits";

/** Settings > Mortgage planner (mortgage PRD section 2). Saved together with the button so half-typed numbers never reach your partner. */
export function MortgageSettingsPanel() {
  const s = useStore();
  const saved = mortgageSettings(s.data);
  const [d, setD] = useState(saved);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => setD(mortgageSettings(s.data)), [s.data.mortgage_settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify({ ...d, id: "" }) !== JSON.stringify({ ...saved, id: "" });
  const valid = d.allowance_pct >= 0 && d.allowance_pct <= 100 && d.default_term_months >= 60 && d.default_term_months <= 480 && d.income_multiple > 0 && d.ltv_rate_presets.every((p) => p.rate > 0 && p.rate <= 15);

  async function save() {
    try {
      await store.saveMortgageSettings({ ...d });
      setFlash("Saved.");
      setTimeout(() => setFlash(null), 3000);
    } catch {
      /* the store shows the reason */
    }
  }

  return (
    <section className="panel flex flex-col gap-4 p-6" aria-label="Mortgage planner">
      <h2 className="m-0 text-xl font-bold">Mortgage planner</h2>
      <p className="m-0 text-sm text-muted">Defaults for new scenarios, and the rules used to warn you about overpaying. Rates here are examples you can change, not quotes. Both of you share them.</p>
      <div className="flex flex-wrap gap-4">
        <MoneyField id="ms-allow" label="Overpayment allowance" value={d.allowance_pct} onChange={(n) => setD({ ...d, allowance_pct: n })} prefix="" suffix="%" step={0.5} max={100} hint="Of the balance at the start of each year, during the fixed period." />
        <MoneyField id="ms-erc" label="Early repayment charge (optional)" value={d.erc_pct ?? 0} onChange={(n) => setD({ ...d, erc_pct: n > 0 ? n : null })} prefix="" suffix="%" step={0.5} max={25} hint="Shows an estimated charge on any overpayment above the allowance." />
      </div>
      <div className="flex flex-wrap gap-4">
        <MoneyField id="ms-term" label="Default term" value={Math.round(d.default_term_months / 12)} onChange={(n) => setD({ ...d, default_term_months: Math.round(n) * 12 })} prefix="" suffix="years" min={5} max={40} />
        <MoneyField id="ms-fix" label="Default fixed period" value={Math.round(d.default_initial_period_months / 12)} onChange={(n) => setD({ ...d, default_initial_period_months: Math.round(n) * 12 })} prefix="" suffix="years" min={0} max={10} />
        <MoneyField id="ms-fee" label="Arrangement fee" value={d.default_fee} onChange={(n) => setD({ ...d, default_fee: n })} />
        <MoneyField id="ms-other" label="Other purchase costs" value={d.default_other_costs} onChange={(n) => setD({ ...d, default_other_costs: n })} hint="Legal fees, survey, searches." />
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="lab mb-1">Example rate for each loan-to-value band</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {d.ltv_rate_presets.map((p, i) => (
            <div key={p.ltv} className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink-2" htmlFor={`ms-ltv-${p.ltv}`}>{p.ltv}% LTV</label>
              <span className="mnum !w-full !min-h-11 !text-base"><input id={`ms-ltv-${p.ltv}`} type="number" inputMode="decimal" step={0.05} min={0.05} max={15} value={p.rate} onChange={(e) => setD({ ...d, ltv_rate_presets: d.ltv_rate_presets.map((q, j) => (j === i ? { ...q, rate: Number(e.target.value) } : q)) })} /><span aria-hidden>%</span></span>
            </div>
          ))}
        </div>
        <span className="text-[13px] text-muted">Used when you tick "Use the sample rate for my loan-to-value band" in the calculator.</span>
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <MoneyField id="ms-mult" label="Income multiple" value={d.income_multiple} onChange={(n) => setD({ ...d, income_multiple: n })} prefix="" suffix="×" step={0.1} min={1} max={10} hint="For the typical-maximum-borrowing check." />
        <MoneyField id="ms-income" label="Combined gross income (optional)" value={d.combined_income ?? 0} onChange={(n) => setD({ ...d, combined_income: n > 0 ? n : null })} />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink-2">
        <input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={d.show_monthly_on_board} onChange={(e) => setD({ ...d, show_monthly_on_board: e.target.checked })} />
        Show each home's monthly payment on the board (using "our plan")
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">Figures are estimates, not advice. <a href="https://www.moneyhelper.org.uk/en/homes" target="_blank" rel="noopener noreferrer">Find free help with a mortgage</a>.</span>
        <div className="flex items-center gap-3">
          {flash && <span role="status" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{flash}</span>}
          <button className="btn btn-p" disabled={!dirty || !valid} onClick={() => void save()}>Save mortgage settings</button>
        </div>
      </div>
    </section>
  );
}
