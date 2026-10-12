import type { CompareRow, ScenarioResult, Simulation } from "@homehunt/mortgage";

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (a: Array<string | number | null | undefined>) => a.map(cell).join(",");
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The amortisation table by year, or by month, as CSV (MC-6). */
export function amortisationCsv(sim: Simulation, monthly: boolean): string {
  if (monthly) {
    return [line(["Month", "Opening balance", "Rate %", "Payment", "Interest", "Capital", "Overpayment", "Closing balance"]), ...sim.schedule.map((m) => line([m.month, r2(m.opening), m.rate, r2(m.payment), r2(m.interest), r2(m.capital), r2(m.overpayment), r2(m.closing)]))].join("\n") + "\n";
  }
  return [line(["Year", "Opening balance", "Payments", "Interest", "Capital", "Overpaid", "Closing balance"]), ...sim.yearly.map((y) => line([y.year, r2(y.opening), r2(y.payments), r2(y.interest), r2(y.capital), r2(y.overpaid), r2(y.closing)]))].join("\n") + "\n";
}

/** The scenario comparison as CSV (SC-12): scenarios in columns, measures in rows, raw numbers. */
export function comparisonCsv(items: ScenarioResult[], rows: CompareRow[], letters: string[]): string {
  const head = line(["Measure", ...items.map((r, i) => `${letters[i]}. ${r.name}`)]);
  const body = rows.map((row) => {
    const fmt = (v: number | null) => (v === null ? "" : row.key === "term" || row.key === "endMonths" || row.key === "overEndMonths" ? v : r2(v));
    return line([row.label, ...row.cells.map((c) => fmt(c.value))]);
  });
  return [head, ...body].join("\n") + "\n";
}
