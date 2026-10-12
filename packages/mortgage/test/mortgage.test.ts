import { describe, expect, it } from "vitest";
import {
  NO_OVERPAYMENT,
  compareOverpay,
  compareScenarios,
  defaultCompletion,
  endDate,
  ltvBand,
  maxBorrowing,
  plainSummary,
  pmt,
  rateForLtv,
  simulate,
  suggestName,
  variantsOf,
  type MortgageInputs,
  type OverpaymentPlan,
  type ScenarioResult,
} from "../src";

// The PRD's worked example: a £695,000 home. Standard-rate stamp duty is £24,750 (relief stops above £500,000).
const PRICE = 695_000;
const inputs = (dep: number, years: number, rate: number, extra: Partial<MortgageInputs> = {}): MortgageInputs => ({
  price: PRICE,
  depositAmount: Math.round((PRICE * dep) / 100),
  termMonths: years * 12,
  initialRate: rate,
  initialPeriodMonths: 60,
  followOnRate: null,
  feeAmount: 999,
  feeAddedToLoan: false,
  otherCosts: 2500,
  stampDuty: 24_750,
  ...extra,
});
const plan = (p: Partial<OverpaymentPlan>): OverpaymentPlan => ({ ...NO_OVERPAYMENT, ...p });
const pounds = (n: number) => Math.round(n);
const pence = (n: number) => Math.round(n * 100) / 100;

const B = inputs(15, 30, 5.15);

describe("monthly payment and totals (PRD section 6 golden values)", () => {
  const s = simulate(B);
  it("loan of £590,750 at 5.15% over 30 years", () => {
    expect(s.loan).toBe(590_750);
    expect(pence(s.payment)).toBe(3225.65);
    expect(pounds(s.totals.interest)).toBe(570_484);
    expect(pounds(s.totals.payable)).toBe(1_161_234);
    expect(s.totals.months).toBe(360);
  });
  it("year 1: £30,225 interest and £8,483 capital", () => {
    expect(pounds(s.yearly[0].interest)).toBe(30_225);
    expect(pounds(s.yearly[0].capital)).toBe(8_483);
  });
  it("a 5-year fix at 5.15% then 7.24%: payment rises to £3,925.84 from month 61, total interest £780,540", () => {
    const r = simulate(inputs(15, 30, 5.15, { followOnRate: 7.24 }));
    expect(pence(r.payment)).toBe(3225.65);
    expect(pence(r.paymentAfter!)).toBe(3925.84);
    expect(pence(r.schedule[59].payment)).toBe(3225.65);
    expect(pence(r.schedule[60].payment)).toBe(3925.84);
    expect(pounds(r.totals.interest)).toBe(780_540);
  });
  it("a follow-on rate equal to the initial rate changes nothing", () => {
    const r = simulate(inputs(15, 30, 5.15, { followOnRate: 5.15 }));
    expect(r.paymentAfter).toBeNull();
    expect(pounds(r.totals.interest)).toBe(570_484);
  });
  it("a follow-on rate lower than the initial rate lowers the payment", () => {
    const r = simulate(inputs(15, 30, 5.15, { followOnRate: 4.0 }));
    expect(r.paymentAfter!).toBeLessThan(r.payment);
  });
});

describe("the four scenarios (PRD section 7)", () => {
  const A = simulate(inputs(10, 30, 5.35));
  const C = simulate(inputs(25, 30, 4.85));
  const D = simulate(inputs(15, 25, 5.15));
  it("A: 10% down", () => {
    expect(A.loan).toBe(625_500);
    expect(pence(A.payment)).toBe(3492.88);
    expect(pounds(A.totals.interest)).toBe(631_936);
    expect(pounds(A.totals.payable)).toBe(1_257_436);
    expect(pounds(A.cashNeeded)).toBe(97_749);
  });
  it("B: 15% down", () => {
    expect(pounds(simulate(B).cashNeeded)).toBe(132_499);
  });
  it("C: 25% down", () => {
    expect(C.loan).toBe(521_250);
    expect(pence(C.payment)).toBe(2750.59);
    expect(pounds(C.totals.interest)).toBe(468_964);
    expect(pounds(C.totals.payable)).toBe(990_214);
    expect(pounds(C.cashNeeded)).toBe(201_999);
  });
  it("D: 25 years", () => {
    expect(pence(D.payment)).toBe(3505.29);
    expect(pounds(D.totals.interest)).toBe(460_837);
    expect(pounds(D.totals.payable)).toBe(1_051_587);
    expect(pounds(D.cashNeeded)).toBe(132_499);
  });
  it("25% down needs £69,500 more cash than 15%; the shorter term saves £109,647 for £280 more a month", () => {
    const b = simulate(B);
    expect(pounds(C.cashNeeded - b.cashNeeded)).toBe(69_500);
    expect(pounds(b.totals.interest - D.totals.interest)).toBe(109_647);
    expect(pounds(D.payment - b.payment)).toBe(280);
  });
});

describe("overpayments on scenario B (PRD sections 5, 6 and 7)", () => {
  const base = simulate(B);
  const run = (p: Partial<OverpaymentPlan>) => {
    const s = simulate(B, plan(p), { allowancePct: 10 });
    return { s, c: compareOverpay(base, s) };
  };

  it("£10,000 a year, shorten the term: 19 years 4 months, £224,962 saved", () => {
    const { s, c } = run({ type: "annual_amount", amount: 10_000 });
    expect(s.totals.months).toBe(232);
    expect(pounds(s.totals.interest)).toBe(345_522);
    expect(pounds(c.interestSaved)).toBe(224_962);
    expect(pounds(c.payableSaved)).toBe(224_962);
    expect(pounds(s.totals.overpaid)).toBe(190_000);
    expect(pounds(s.totals.regular)).toBe(746_272);
    expect(pounds(s.totals.payable)).toBe(936_272);
    expect(c.monthsSaved).toBe(128); // 10 years 8 months
    expect(c.returnPerPound.toFixed(2)).toBe("1.18");
    // The payment itself doesn't change when you shorten the term.
    expect(pence(s.payment)).toBe(3225.65);
    expect(s.breaches).toHaveLength(0); // £10,000 is well inside the £59,075 allowance
  });
  it("5% of the start-of-year balance: 15 years 3 months, £330,055 saved, £241,074 overpaid", () => {
    const { s, c } = run({ type: "annual_percent", percent: 5 });
    expect(s.totals.months).toBe(183);
    expect(pounds(c.interestSaved)).toBe(330_055);
    expect(pounds(s.totals.overpaid)).toBe(241_074);
  });
  it("£5,000 a year: 23 years 4 months, £143,092 saved", () => {
    const { s, c } = run({ type: "annual_amount", amount: 5_000 });
    expect(s.totals.months).toBe(280);
    expect(pounds(c.interestSaved)).toBe(143_092);
  });
  it("£20,000 a year: 14 years 7 months, £317,128 saved", () => {
    const { s, c } = run({ type: "annual_amount", amount: 20_000 });
    expect(s.totals.months).toBe(175);
    expect(pounds(c.interestSaved)).toBe(317_128);
  });
  it("lower the payment: £10,000 a year drops the payment to £3,170.25, saving £130,828", () => {
    const { s, c } = run({ type: "annual_amount", amount: 10_000, mode: "lower_payment" });
    expect(pence(s.lowerPayments.afterFirst!)).toBe(3170.25);
    // The payment is re-set to keep the original 30-year term, but the £10,000 a year carries on, so the loan still clears early.
    expect(s.totals.months).toBe(348);
    expect(pounds(c.interestSaved)).toBe(130_828);
    // With a single overpayment the term really does stay the same.
    const once = simulate(B, plan({ type: "lump_sum", amount: 10_000, lumpSumMonth: 12, mode: "lower_payment" }));
    expect(once.totals.months).toBe(360);
  });
  it("£70,000 in year 1 breaks the 10% allowance of £59,075 and is flagged", () => {
    const s = simulate(B, plan({ type: "annual_amount", amount: 70_000 }), { allowancePct: 10, ercPct: 3 });
    expect(s.yearly[0].flagged).toBe(true);
    expect(pounds(s.yearly[0].allowance!)).toBe(59_075);
    expect(s.breaches[0].year).toBe(1);
    expect(pounds(s.breaches[0].excess)).toBe(10_925);
    expect(pounds(s.breaches[0].erc!)).toBe(328); // 3% of the excess
  });
  it("overpaying after the initial period is never flagged", () => {
    const s = simulate(B, plan({ type: "annual_amount", amount: 70_000, startMonth: 61 }), { allowancePct: 10 });
    expect(s.breaches).toHaveLength(0);
    expect(s.yearly.find((y) => y.year === 6)!.allowance).toBeNull();
  });
  it("a first overpayment in year 6 starts at the sixth anniversary", () => {
    const s = simulate(B, plan({ type: "annual_amount", amount: 10_000, startMonth: 61 }));
    expect(s.schedule.filter((r) => r.overpayment > 0)[0].month).toBe(72);
  });
  it("monthly overpayments are paid every month; a lump sum once, in its month", () => {
    const m = simulate(B, plan({ type: "monthly_amount", amount: 500 }));
    expect(m.schedule[0].overpayment).toBe(500);
    expect(m.schedule[1].overpayment).toBe(500);
    const l = simulate(B, plan({ type: "lump_sum", amount: 20_000, lumpSumMonth: 24 }));
    expect(l.schedule.filter((r) => r.overpayment > 0).map((r) => r.month)).toEqual([24]);
    expect(pounds(l.totals.overpaid)).toBe(20_000);
  });
  it("stops after the end month, and grows with a yearly increase", () => {
    const s = simulate(B, plan({ type: "annual_amount", amount: 10_000, endMonth: 36 }));
    expect(s.schedule.filter((r) => r.overpayment > 0).map((r) => r.month)).toEqual([12, 24, 36]);
    const g = simulate(B, plan({ type: "annual_amount", amount: 10_000, annualIncreasePct: 10, endMonth: 36 }));
    expect(g.schedule.filter((r) => r.overpayment > 0).map((r) => Math.round(r.overpayment))).toEqual([10_000, 11_000, 12_100]);
  });
  it("an overpayment larger than the balance pays it off and the loan ends that month", () => {
    const s = simulate(B, plan({ type: "lump_sum", amount: 9_999_999, lumpSumMonth: 20 }));
    expect(s.totals.months).toBe(20);
    expect(s.schedule[19].closing).toBe(0);
    expect(pounds(s.totals.overpaid + s.schedule.reduce((a, r) => a + r.capital, 0))).toBe(590_750);
  });
});

describe("properties that must always hold", () => {
  const cases: MortgageInputs[] = [B, inputs(10, 30, 5.35), inputs(25, 25, 4.85), inputs(5, 40, 7.5), inputs(40, 10, 2.1), inputs(15, 27, 4.89, { initialPeriodMonths: 0 }), inputs(15, 30, 5.15, { followOnRate: 8.5 })];
  it("with no overpayments, total payable = loan + total interest", () => {
    for (const c of cases) {
      const s = simulate(c);
      expect(s.totals.payable).toBeCloseTo(s.loan + s.totals.interest, 4);
      expect(s.schedule[s.schedule.length - 1].closing).toBe(0);
    }
  });
  it("overpaying never increases total interest or total payable, and never lengthens the loan", () => {
    for (const c of cases) {
      const base = simulate(c);
      for (const p of [plan({ type: "annual_amount", amount: 3_000 }), plan({ type: "annual_percent", percent: 2 }), plan({ type: "monthly_amount", amount: 200 }), plan({ type: "lump_sum", amount: 15_000, lumpSumMonth: 18 })]) {
        for (const mode of ["shorten_term", "lower_payment"] as const) {
          const o = simulate(c, { ...p, mode });
          expect(o.totals.interest).toBeLessThanOrEqual(base.totals.interest + 1e-6);
          expect(o.totals.payable).toBeLessThanOrEqual(base.totals.payable + 1e-6);
          expect(o.totals.months).toBeLessThanOrEqual(base.totals.months);
        }
      }
    }
  });
  it("saved payable equals saved interest because the amount borrowed is the same", () => {
    const base = simulate(B);
    const c = compareOverpay(base, simulate(B, plan({ type: "annual_amount", amount: 12_345 })));
    expect(c.payableSaved).toBeCloseTo(c.interestSaved, 4);
  });
  it("a zero rate gives zero interest and a payment of loan ÷ months", () => {
    const s = simulate(inputs(15, 30, 0, { initialPeriodMonths: 0 }));
    expect(s.totals.interest).toBeCloseTo(0, 6);
    expect(s.payment).toBeCloseTo(590_750 / 360, 6);
    expect(pmt(120, 0, 12)).toBe(10);
  });
  it("the schedule balances row by row", () => {
    const s = simulate(B, plan({ type: "annual_amount", amount: 10_000 }));
    for (const r of s.schedule) expect(r.opening - r.capital - r.overpayment).toBeCloseTo(r.closing, 6);
    expect(s.yearly.reduce((a, y) => a + y.interest, 0)).toBeCloseTo(s.totals.interest, 4);
  });
});

describe("edge cases", () => {
  it("deposit equal to the price needs no mortgage", () => {
    const s = simulate(inputs(100, 30, 5.15));
    expect(s.noMortgage).toBe(true);
    expect(s.loan).toBe(0);
    expect(s.payment).toBe(0);
    expect(s.totals.interest).toBe(0);
    expect(s.cashNeeded).toBe(PRICE + 24_750 + 999 + 2_500);
  });
  it("a fee added to the loan raises the loan and interest, and leaves cash needed alone", () => {
    const up = simulate(B);
    const added = simulate(inputs(15, 30, 5.15, { feeAddedToLoan: true }));
    expect(added.loan).toBe(591_749);
    expect(added.totals.interest).toBeGreaterThan(up.totals.interest);
    expect(pounds(up.cashNeeded - added.cashNeeded)).toBe(999);
    // The fee is a cost either way.
    expect(pounds(up.totalCostOfBorrowing)).toBe(pounds(up.totals.interest + 999));
  });
  it("27 years 6 months simulates 330 months", () => {
    const s = simulate({ ...B, termMonths: 27 * 12 + 6 });
    expect(s.totals.months).toBe(330);
    expect(s.schedule).toHaveLength(330);
  });
  it("a fixed period at least as long as the term is just one rate", () => {
    const s = simulate({ ...B, initialPeriodMonths: 400, followOnRate: 9 });
    expect(s.paymentAfter).toBeNull();
    expect(pounds(s.totals.interest)).toBe(570_484);
  });
});

describe("LTV bands and headroom", () => {
  it("£695,000 with 10% down is 90% LTV and £34,750 more deposit reaches 85%", () => {
    const b = ltvBand(625_500, PRICE);
    expect(b.band).toBe(90);
    expect(b.nextBand).toBe(85);
    expect(Math.round(b.headroom)).toBe(34_750);
  });
  it("15% down is exactly the 85% band; 40% down is the 60% band with nothing better", () => {
    expect(ltvBand(590_750, PRICE).band).toBe(85);
    const best = ltvBand(PRICE * 0.6, PRICE);
    expect(best.band).toBe(60);
    expect(best.nextBand).toBeNull();
    expect(best.headroom).toBe(0);
  });
  it("above 95% LTV has no band, and headroom is to reach 95%", () => {
    const b = ltvBand(PRICE * 0.97, PRICE);
    expect(b.band).toBeNull();
    expect(b.nextBand).toBe(95);
    expect(Math.round(b.headroom)).toBe(Math.round(PRICE * 0.02));
  });
  it("rate presets follow the band and affordability uses the income multiple", () => {
    const presets = [{ ltv: 60, rate: 4.6 }, { ltv: 75, rate: 4.85 }, { ltv: 85, rate: 5.15 }, { ltv: 90, rate: 5.35 }];
    expect(rateForLtv(presets, 85)).toBe(5.15);
    expect(rateForLtv(presets, 82)).toBe(5.15);
    expect(rateForLtv(presets, 50)).toBe(4.6);
    expect(rateForLtv(presets, 97)).toBe(5.35);
    expect(rateForLtv([], 80)).toBeNull();
    expect(maxBorrowing(120_000, 4.5)).toBe(540_000);
  });
});

describe("dates", () => {
  it("completion defaults to the first of next month and the end date adds the months simulated", () => {
    expect(defaultCompletion(new Date(2026, 9, 12)).toISOString().slice(0, 10)).toBe(new Date(2026, 10, 1).toISOString().slice(0, 10));
    const e = endDate(new Date(2026, 10, 1), 232);
    expect(e.getFullYear()).toBe(2046);
    expect(e.getMonth()).toBe(2);
  });
});

describe("comparing scenarios", () => {
  const mk = (id: string, name: string, i: MortgageInputs, p?: OverpaymentPlan): ScenarioResult => ({ id, name, inputs: i, sim: simulate(i), planSim: p ? simulate(i, p) : null });
  const items = [mk("a", "A", inputs(10, 30, 5.35)), mk("b", "B", B), mk("c", "C", inputs(25, 30, 4.85)), mk("d", "D", inputs(15, 25, 5.15))];
  const row = (key: string, rows = compareScenarios(items)) => rows.find((r) => r.key === key)!;

  it("C is best for monthly payment and total payable, D for total interest, A for cash", () => {
    // The PRD's section 7 prose says C is also lowest on interest, but its own table has D lower
    // (£460,837 against £468,964): the numbers are right, so D is best on interest.
    for (const k of ["payment", "payable"]) expect(row(k).cells.map((c) => c.best)).toEqual([false, false, true, false]);
    expect(row("interest").cells.map((c) => c.best)).toEqual([false, false, false, true]);
    expect(row("cash").cells.map((c) => c.best)).toEqual([true, false, false, false]);
  });
  it("shows the difference from the best under every other value", () => {
    const pay = row("payment").cells;
    expect(pence(pay[0].diff!)).toBe(742.28);
    expect(pay[2].diff).toBe(0);
    expect(Math.round(row("cash").cells[2].diff!)).toBe(201_999 - 97_749);
  });
  it("shortest term is best; unranked rows have no best", () => {
    expect(row("term").cells.map((c) => c.best)).toEqual([false, false, false, true]);
    expect(row("deposit").cells.every((c) => !c.best && c.diff === null)).toBe(true);
    expect(row("rate").cells.every((c) => !c.best)).toBe(true);
  });
  it("a row where every value is the same marks no best", () => {
    const rows = compareScenarios([items[1], mk("b2", "B copy", B)]);
    expect(row("payment", rows).cells.every((c) => !c.best)).toBe(true);
    expect(row("payment", rows).cells.every((c) => c.diff === 0)).toBe(true);
  });
  it("overpayment rows appear only when a scenario has a plan", () => {
    expect(compareScenarios(items).some((r) => r.key === "overInterestSaved")).toBe(false);
    const withPlan = [mk("b", "B", B, plan({ type: "annual_amount", amount: 10_000 })), mk("d", "D", inputs(15, 25, 5.15), plan({ type: "annual_amount", amount: 5_000 })), mk("a", "A", inputs(10, 30, 5.35))];
    const rows = compareScenarios(withPlan);
    const saved = rows.find((r) => r.key === "overInterestSaved")!;
    expect(pounds(saved.cells[0].value!)).toBe(224_962);
    expect(saved.cells.map((c) => c.best)).toEqual([true, false, false]);
    expect(saved.cells[2].value).toBeNull();
    const ends = rows.find((r) => r.key === "overEndMonths")!;
    expect(ends.cells[0].value).toBe(232);
  });
  it("writes a plain one-line summary from the numbers", () => {
    const s = plainSummary([items[1], items[3]], "b")!;
    expect(s).toBe("D costs £280 more a month than B but saves £109,647 of interest.");
    // Against the plan, the lowest-interest scenario is D, which needs no extra cash.
    expect(plainSummary(items, "b")).toBe(s);
    const c = plainSummary([items[1], items[2]], "b")!;
    expect(c).toBe("C costs £475 less a month than B and saves £101,520 of interest. It needs £69,500 more cash on day one.");
    expect(plainSummary([items[0]])).toBeNull();
  });
  it("suggests a name and builds quick variants", () => {
    expect(suggestName(B)).toBe("15% down, 30 yrs, 5.15%");
    expect(suggestName({ ...B, termMonths: 330 })).toBe("15% down, 27 yrs 6 mos, 5.15%");
    const v = variantsOf(B, "term", [25, 30, 35]);
    expect(v.map((x) => x.termMonths)).toEqual([300, 360, 420]);
    const d = variantsOf(B, "deposit", [10, 15, 25]);
    expect(d.map((x) => x.depositAmount)).toEqual([69_500, 104_250, 173_750]);
    expect(variantsOf(B, "rate", [4.5])[0].initialRate).toBe(4.5);
    expect(variantsOf(B, "initialPeriod", [2])[0].initialPeriodMonths).toBe(24);
  });
});
