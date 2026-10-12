import { describe, expect, it } from "vitest";
import { NO_OVERPAYMENT, compareScenarios, simulate, type MortgageInputs, type ScenarioResult } from "@homehunt/mortgage";
import { describeRow } from "./mortgage-format";

const inp = (dep: number, years: number, rate: number): MortgageInputs => ({ price: 695_000, depositAmount: Math.round(6950 * dep), termMonths: years * 12, initialRate: rate, initialPeriodMonths: 60, followOnRate: null, feeAmount: 999, feeAddedToLoan: false, otherCosts: 2500, stampDuty: 24_750 });
const mk = (id: string, i: MortgageInputs, plan = false): ScenarioResult => ({ id, name: id, inputs: i, sim: simulate(i), planSim: plan ? simulate(i, { ...NO_OVERPAYMENT, amount: 10_000 }) : null });

describe("describeRow", () => {
  const items = [mk("A", inp(10, 30, 5.35)), mk("B", inp(15, 30, 5.15)), mk("C", inp(25, 30, 4.85)), mk("D", inp(15, 25, 5.15))];
  const rows = compareScenarios(items);
  const completions = items.map(() => new Date(2026, 10, 1));
  const cells = (k: string) => describeRow(rows.find((r) => r.key === k)!, items, completions);

  it("monthly payment: best is marked and the others say how much more a month", () => {
    const c = cells("payment");
    expect(c.map((x) => x.text)).toEqual(["£3,492.88", "£3,225.65", "£2,750.59", "£3,505.29"]);
    expect(c[2]).toMatchObject({ best: true, sub: "Best" });
    expect(c[1].sub).toBe("+£475.06 a month");
  });
  it("cash needed: A is best and C needs £104,250 more", () => {
    const c = cells("cash");
    expect(c[0]).toMatchObject({ text: "£97,749", best: true });
    expect(c[2].sub).toBe("+£104,250");
  });
  it("term, rate, deposit and end date read as words", () => {
    expect(cells("term").map((x) => x.text)).toEqual(["30 years", "30 years", "30 years", "25 years"]);
    expect(cells("term")[3]).toMatchObject({ best: true, sub: "Shortest" });
    expect(cells("term")[0].sub).toBe("5 years longer");
    expect(cells("rate")[1]).toMatchObject({ text: "5.15%", sub: "Fixed for 5 years", best: false });
    expect(cells("deposit")[1]).toMatchObject({ text: "£104,250", sub: "15% of the price" });
    expect(cells("endMonths").map((x) => x.text)).toEqual(["Nov 2056", "Nov 2056", "Nov 2056", "Nov 2051"]);
    expect(cells("endMonths")[3].sub).toBe("Earliest");
  });
  it("overpayment rows say 'No overpayments' where a scenario has none", () => {
    const withPlan = [mk("B", inp(15, 30, 5.15), true), mk("D", inp(15, 25, 5.15))];
    const r = compareScenarios(withPlan);
    const c = describeRow(r.find((x) => x.key === "overInterestSaved")!, withPlan, [new Date(2026, 10, 1), new Date(2026, 10, 1)]);
    expect(c[0].text).toBe("£224,962");
    expect(c[1]).toMatchObject({ text: "–", sub: "No overpayments" });
  });
});
