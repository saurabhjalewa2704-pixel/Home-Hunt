import { compareOverpay } from "./simulate";
import type { MortgageInputs, OverpayComparison, Simulation } from "./types";

export interface ScenarioResult {
  id: string;
  name: string;
  inputs: MortgageInputs;
  /** The mortgage with no overpayments. */
  sim: Simulation;
  /** The same mortgage with the scenario's overpayment plan, when it has one. */
  planSim?: Simulation | null;
}

export interface CompareCell {
  value: number | null;
  /** Best in its row. False when every value is the same. */
  best: boolean;
  /** Difference from the best value (always 0 or more, in the row's own units). */
  diff: number | null;
}

export type CompareKey =
  | "deposit"
  | "loan"
  | "rate"
  | "term"
  | "payment"
  | "paymentAfter"
  | "interest"
  | "payable"
  | "costOfBorrowing"
  | "cash"
  | "endMonths"
  | "overEndMonths"
  | "overInterestSaved";

export interface CompareRow {
  key: CompareKey;
  label: string;
  /** Which end is best: lowest, highest, or not ranked. */
  rank: "min" | "max" | null;
  cells: CompareCell[];
}

const DEFS: Array<{ key: CompareKey; label: string; rank: "min" | "max" | null; get: (r: ScenarioResult) => number | null }> = [
  { key: "deposit", label: "Deposit", rank: null, get: (r) => r.inputs.depositAmount },
  { key: "loan", label: "Loan amount", rank: "min", get: (r) => r.sim.loan },
  { key: "rate", label: "Rate", rank: null, get: (r) => r.inputs.initialRate },
  { key: "term", label: "Term", rank: "min", get: (r) => r.inputs.termMonths },
  { key: "payment", label: "Monthly payment", rank: "min", get: (r) => r.sim.payment },
  { key: "paymentAfter", label: "Monthly payment after initial period", rank: "min", get: (r) => r.sim.paymentAfter ?? r.sim.payment },
  { key: "interest", label: "Total interest", rank: "min", get: (r) => r.sim.totals.interest },
  { key: "payable", label: "Total payable", rank: "min", get: (r) => r.sim.totals.payable },
  { key: "costOfBorrowing", label: "Total cost of borrowing", rank: "min", get: (r) => r.sim.totalCostOfBorrowing },
  { key: "cash", label: "Cash needed on day one", rank: "min", get: (r) => r.sim.cashNeeded },
  { key: "endMonths", label: "Mortgage-free by", rank: "min", get: (r) => r.sim.totals.months },
  { key: "overEndMonths", label: "With overpayments: mortgage-free by", rank: "min", get: (r) => (r.planSim ? r.planSim.totals.months : null) },
  { key: "overInterestSaved", label: "With overpayments: interest saved", rank: "max", get: (r) => (r.planSim ? r.sim.totals.interest - r.planSim.totals.interest : null) },
];

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Lay scenarios out in columns and measures in rows, marking the best value in each ranked row. */
export function compareScenarios(items: ScenarioResult[]): CompareRow[] {
  const hasPlan = items.some((r) => r.planSim);
  const hasFollowOn = items.some((r) => r.sim.paymentAfter !== null);
  return DEFS.filter((d) => (d.key === "overEndMonths" || d.key === "overInterestSaved" ? hasPlan : d.key === "paymentAfter" ? hasFollowOn : true)).map((d) => {
    const values = items.map((r) => d.get(r));
    const known = values.filter((v): v is number => v !== null);
    const target = d.rank === null || !known.length ? null : d.rank === "min" ? Math.min(...known) : Math.max(...known);
    const allSame = known.length > 0 && known.every((v) => same(v, known[0]));
    return {
      key: d.key,
      label: d.label,
      rank: d.rank,
      cells: values.map((v) => ({
        value: v,
        best: target !== null && v !== null && !allSame && same(v, target),
        diff: target === null || v === null ? null : Math.abs(v - target),
      })),
    };
  });
}

/** "15% down, 30 yrs, 5.15%": the suggested name for a scenario. */
export function suggestName(i: MortgageInputs): string {
  const dep = i.price > 0 ? (i.depositAmount / i.price) * 100 : 0;
  const depText = Math.abs(dep - Math.round(dep)) < 0.05 ? String(Math.round(dep)) : dep.toFixed(1);
  const years = Math.floor(i.termMonths / 12);
  const months = i.termMonths % 12;
  return `${depText}% down, ${years} yrs${months ? ` ${months} mos` : ""}, ${i.initialRate.toFixed(2)}%`;
}

export type VariantField = "term" | "deposit" | "rate" | "initialPeriod";

/** One input varied across values: term in years, deposit as % of the price, rate in %, initial period in years. */
export function variantsOf(base: MortgageInputs, field: VariantField, values: number[]): MortgageInputs[] {
  return values.map((v) => {
    switch (field) {
      case "term":
        return { ...base, termMonths: Math.round(v * 12) };
      case "deposit":
        return { ...base, depositAmount: Math.round((base.price * v) / 100) };
      case "rate":
        return { ...base, initialRate: v };
      case "initialPeriod":
        return { ...base, initialPeriodMonths: Math.round(v * 12) };
    }
  });
}

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

/**
 * One plain sentence about the trade-off between a reference scenario and the one that costs least overall,
 * built from the numbers. Returns null when there is nothing to compare.
 */
export function plainSummary(items: ScenarioResult[], referenceId?: string): string | null {
  if (items.length < 2) return null;
  const ref = items.find((r) => r.id === referenceId) ?? items[0];
  const others = items.filter((r) => r !== ref);
  const cheapest = [...others].sort((a, b) => a.sim.totals.interest - b.sim.totals.interest)[0];
  const dPay = cheapest.sim.payment - ref.sim.payment;
  const dInt = ref.sim.totals.interest - cheapest.sim.totals.interest;
  const payPart = Math.abs(dPay) < 0.5 ? `costs the same each month as ${ref.name}` : `costs ${gbp(Math.abs(dPay))} ${dPay > 0 ? "more" : "less"} a month than ${ref.name}`;
  const payBetter = dPay < -0.5;
  let s: string;
  if (Math.abs(dInt) < 0.5) s = `${cheapest.name} ${payPart}, with the same total interest.`;
  else {
    // "but" when one measure is better and the other worse, "and" when they point the same way.
    const intBetter = dInt > 0;
    const joiner = payBetter === intBetter || Math.abs(dPay) < 0.5 ? " and " : " but ";
    s = `${cheapest.name} ${payPart}${joiner}${intBetter ? "saves" : "costs"} ${gbp(Math.abs(dInt))} ${intBetter ? "of interest" : "more in interest"}.`;
  }
  const dCash = cheapest.sim.cashNeeded - ref.sim.cashNeeded;
  if (dCash > 0.5) s += ` It needs ${gbp(dCash)} more cash on day one.`;
  return s;
}

export { compareOverpay };
export type { OverpayComparison };
