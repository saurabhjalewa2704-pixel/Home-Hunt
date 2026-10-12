import { endDate, type CompareRow, type ScenarioResult } from "@homehunt/mortgage";
import { gbp, gbp2, yrsMos } from "./format";

export interface CellView {
  text: string;
  /** The line under the value: the difference from the best, or a short fact. */
  sub: string;
  best: boolean;
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
export const monthYear = (d: Date) => MONTH_YEAR.format(d);

const plusMoney = (n: number, f: (v: number) => string, unit = "") => (n < 0.005 ? "" : `+${f(n)}${unit}`);

/**
 * Words and numbers for each cell of a comparison row (SC-9): the value, and under every value that
 * is not the best the difference from the best, for example "+£267.64 a month".
 */
export function describeRow(row: CompareRow, items: ScenarioResult[], completions: Date[]): CellView[] {
  return row.cells.map((c, i) => {
    const r = items[i];
    const v = c.value;
    const best = c.best;
    const diffSub = (f: (n: number) => string, unit = "") => (best ? "Best" : c.diff === null ? "" : c.diff < 0.005 ? "Same" : plusMoney(c.diff, f, unit));
    switch (row.key) {
      case "deposit":
        return { text: gbp(v), sub: `${r.inputs.price > 0 ? Math.round((r.inputs.depositAmount / r.inputs.price) * 1000) / 10 : 0}% of the price`, best: false };
      case "loan":
        return { text: gbp(v), sub: `${r.sim.noMortgage ? 0 : Math.round(r.sim.ltv)}% loan-to-value${best ? ", lowest" : c.diff ? `, ${plusMoney(c.diff, gbp)}` : ""}`, best };
      case "rate":
        return { text: `${r.inputs.initialRate.toFixed(2)}%`, sub: r.inputs.initialPeriodMonths > 0 ? `Fixed for ${r.inputs.initialPeriodMonths / 12} years` : "Whole term", best: false };
      case "term":
        return { text: yrsMos(r.inputs.termMonths), sub: best ? "Shortest" : c.diff ? `${yrsMos(c.diff)} longer` : "", best };
      case "payment":
        return { text: gbp2(v), sub: diffSub(gbp2, " a month"), best };
      case "paymentAfter":
        return { text: r.sim.paymentAfter === null ? "Same" : gbp2(v), sub: r.sim.paymentAfter === null ? "No change after the fix" : diffSub(gbp2, " a month"), best };
      case "interest":
      case "payable":
      case "costOfBorrowing":
      case "cash":
        return { text: gbp(v), sub: diffSub(gbp), best };
      case "endMonths":
        return { text: monthYear(endDate(completions[i], r.sim.totals.months)), sub: best ? "Earliest" : c.diff ? `${yrsMos(Math.round(c.diff))} later` : "", best };
      case "overEndMonths":
        return v === null ? { text: "–", sub: "No overpayments", best: false } : { text: monthYear(endDate(completions[i], v)), sub: best ? "Earliest" : c.diff ? `${yrsMos(Math.round(c.diff))} later` : "", best };
      case "overInterestSaved":
        return v === null ? { text: "–", sub: "No overpayments", best: false } : { text: gbp(v), sub: best ? "Most saved" : c.diff ? `${gbp(c.diff)} less` : "", best };
    }
  });
}
