import { describe, expect, it } from "vitest";
import { calcErrors, calcFromScenario, calcInputs, initialCalc, parseRate, scenarioFields, setDepAmt, setDepPct, setPrice, stampDutyOf } from "./mortgage-calc";
import { DEFAULT_LTV_PRESETS, planOnHome, preferredScenario, mortgageSettings, orderedScenarios, letterOf } from "./mortgage";
import { emptyData, sampleData } from "./seed";
import type { Data, MortgageScenario } from "./types";

const P = DEFAULT_LTV_PRESETS;
const scenario = (over: Partial<MortgageScenario> = {}): MortgageScenario => ({
  id: "s1", household_id: "h", name: "B", note: null, colour: "#17805A", property_id: null, price: 695_000, deposit_amount: 104_250, term_months: 360,
  initial_rate: 5.15, initial_period_months: 60, follow_on_rate: null, fee_amount: 999, fee_added_to_loan: false, other_costs: 2500, sdlt_override: null,
  completion_date: null, is_preferred: true, created_by: null, updated_by: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...over,
});

describe("parseRate", () => {
  it("accepts two decimals and rounds further digits", () => {
    expect(parseRate("4.89")).toBe(4.89);
    expect(parseRate("9.25")).toBe(9.25);
    expect(parseRate("5.155")).toBe(5.16);
    expect(parseRate("15")).toBe(15);
  });
  it("rejects blank, zero, negative, above 15 and text", () => {
    for (const bad of ["", "  ", "0", "-1", "15.01", "abc"]) expect(parseRate(bad)).toBeNull();
  });
});

describe("deposit £ and % stay in sync (MC-2)", () => {
  const base = initialCalc(emptyData());
  it("starts on the household defaults: 15% down, 30 years, 5-year fix, £999 fee", () => {
    expect(base.depPct).toBe(15);
    expect(base.depAmt).toBe(104_250);
    expect(base.termYears).toBe(30);
    expect(base.initialYears).toBe(5);
    expect(base.rateStr).toBe("5.15");
    expect(base.feeAmount).toBe(999);
    expect(base.otherCosts).toBe(2500);
  });
  it("editing the price keeps the percentage and recalculates the pounds", () => {
    const c = setPrice(base, 600_000, P);
    expect(c.depPct).toBe(15);
    expect(c.depAmt).toBe(90_000);
  });
  it("editing the pounds recalculates the percentage, and the percentage the pounds", () => {
    expect(setDepAmt(base, 69_500, P).depPct).toBe(10);
    expect(setDepPct(base, 25, P).depAmt).toBe(173_750);
  });
  it("follows the rate preset for the LTV band only when asked", () => {
    expect(setDepPct(base, 25, P).rateStr).toBe("5.15");
    const on = { ...base, bandRate: true };
    expect(setDepPct(on, 25, P).rateStr).toBe("4.85"); // 75% LTV
    expect(setDepPct(on, 10, P).rateStr).toBe("5.35"); // 90% LTV
  });
});

describe("validation (MC-3)", () => {
  const ok = initialCalc(emptyData());
  it("a fresh calculator is valid", () => expect(calcErrors(ok)).toEqual({}));
  it("deposit above the price, bad rate, short term and bad price give plain-words errors", () => {
    expect(calcErrors({ ...ok, depAmt: 800_000 }).deposit).toMatch(/can't be more than the price/);
    expect(calcErrors({ ...ok, rateStr: "" }).rate).toMatch(/between 0.01% and 15%/);
    expect(calcErrors({ ...ok, rateStr: "0" }).rate).toBeTruthy();
    expect(calcErrors({ ...ok, rateStr: "16" }).rate).toBeTruthy();
    expect(calcErrors({ ...ok, termYears: 4 }).term).toMatch(/at least 5 years/);
    expect(calcErrors({ ...ok, termYears: 40, termExtraMonths: 6 }).term).toMatch(/longest term/);
    expect(calcErrors({ ...ok, price: 10_000 }).price).toBeTruthy();
    expect(calcErrors({ ...ok, followSame: false, followStr: "" }).follow).toBeTruthy();
  });
  it("gives no engine inputs while anything is invalid", () => {
    expect(calcInputs({ ...ok, rateStr: "" }, 24_750)).toBeNull();
    const i = calcInputs(ok, 24_750)!;
    expect(i.termMonths).toBe(360);
    expect(i.initialPeriodMonths).toBe(60);
    expect(i.followOnRate).toBeNull();
  });
  it("a typed 9.25 follow-on rate is kept, and 27 years 6 months is 330 months", () => {
    const i = calcInputs({ ...ok, followSame: false, followStr: "9.25", termYears: 27, termExtraMonths: 6 }, 0)!;
    expect(i.followOnRate).toBe(9.25);
    expect(i.termMonths).toBe(330);
  });
});

describe("scenarios, homes and our plan", () => {
  const data: Data = sampleData(new Date("2026-10-12T09:00:00Z"));
  const elsynge = data.properties.find((p) => p.address.startsWith("Elsynge"))!;

  it("a scenario on a home follows that home's price until a different price is typed", () => {
    const c = initialCalc(data, elsynge.id);
    expect(c.price).toBe(695_000);
    expect(scenarioFields(c, data)!.price).toBeNull();
    expect(scenarioFields(setPrice(c, 680_000, P), data)!.price).toBe(680_000);
    expect(scenarioFields({ ...c, homeId: "" }, data)!.price).toBe(695_000);
  });
  it("loads a saved scenario back into the form", () => {
    const c = calcFromScenario(data, scenario({ follow_on_rate: 7.24, term_months: 330 }));
    expect(c.followSame).toBe(false);
    expect(c.followStr).toBe("7.24");
    expect(c.termYears).toBe(27);
    expect(c.termExtraMonths).toBe(6);
    expect(c.depPct).toBe(15);
    expect(c.scenarioId).toBe("s1");
  });
  it("stamp duty follows the price, unless overridden", () => {
    const c = initialCalc(data);
    expect(stampDutyOf(c, data)).toBe(24_750);
    expect(stampDutyOf({ ...c, sdltOverride: 12_000 }, data)).toBe(12_000);
  });
  it("applies our plan to another home at the same deposit percentage, with that home's own stamp duty", () => {
    const withPlan: Data = { ...data, mortgage_scenarios: [scenario()] };
    expect(preferredScenario(withPlan)!.id).toBe("s1");
    const m = planOnHome(withPlan, 800_000)!;
    expect(m.inputs.depositAmount).toBe(120_000);
    expect(m.inputs.stampDuty).toBe(30_000);
    expect(m.sim.loan).toBe(680_000);
    expect(planOnHome(data, 800_000)).toBeNull();
    expect(planOnHome(withPlan, 0)).toBeNull();
  });
  it("letters scenarios in the order they were made", () => {
    const d: Data = { ...data, mortgage_scenarios: [scenario({ id: "z", created_at: "2026-10-03T00:00:00Z" }), scenario({ id: "a", created_at: "2026-10-01T00:00:00Z" }), scenario({ id: "m", created_at: "2026-10-02T00:00:00Z" })] };
    expect(orderedScenarios(d).map((s) => s.id)).toEqual(["a", "m", "z"]);
    expect(["a", "m", "z"].map((id) => letterOf(d, id))).toEqual(["A", "B", "C"]);
  });
  it("settings fall back to the defaults until first saved", () => {
    const s = mortgageSettings(emptyData());
    expect(s.allowance_pct).toBe(10);
    expect(s.income_multiple).toBe(4.5);
    expect(s.show_monthly_on_board).toBe(false);
    expect(s.ltv_rate_presets).toHaveLength(6);
  });
});
