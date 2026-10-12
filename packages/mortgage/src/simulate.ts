import type { AllowanceBreach, MonthRow, MortgageInputs, OverpayComparison, OverpaymentPlan, SimOptions, Simulation, YearRow } from "./types";

export const LTV_BANDS = [60, 75, 80, 85, 90, 95] as const;
const EPS = 0.005;

/** Level payment for a loan of `principal` at an annual % rate over `months`. */
export function pmt(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 1200;
  return r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** The loan: price less deposit, plus the arrangement fee if it is added to the loan. */
export function loanAmount(i: MortgageInputs): number {
  return Math.max(0, i.price - i.depositAmount) + (i.feeAddedToLoan ? Math.max(0, i.feeAmount) : 0);
}

/** Lender band for an LTV, and the extra deposit needed to reach the next better band. */
export function ltvBand(loan: number, price: number): { ltv: number; band: number | null; nextBand: number | null; headroom: number } {
  const ltv = price > 0 ? (loan / price) * 100 : 0;
  const band = LTV_BANDS.find((b) => ltv <= b + 1e-9) ?? null;
  const better = [...LTV_BANDS].filter((b) => (band === null ? true : b < band)).pop() ?? null;
  const headroom = better === null ? 0 : Math.max(0, loan - (better / 100) * price);
  return { ltv, band, nextBand: better, headroom };
}

/** Overpayment (before it is capped at the balance) due at the end of `month`. */
function overpaymentDue(plan: OverpaymentPlan | null | undefined, month: number, yearStartBalance: number): number {
  if (!plan) return 0;
  const inRange = month >= Math.max(1, plan.startMonth) && (plan.endMonth === null || month <= plan.endMonth);
  if (!inRange) return 0;
  const yearsIn = Math.floor((month - 1) / 12) - Math.floor((Math.max(1, plan.startMonth) - 1) / 12);
  const grow = Math.pow(1 + (plan.annualIncreasePct || 0) / 100, Math.max(0, yearsIn));
  switch (plan.type) {
    case "monthly_amount":
      return plan.amount * grow;
    case "annual_amount":
      return month % 12 === 0 ? plan.amount * grow : 0;
    case "annual_percent":
      return month % 12 === 0 ? (plan.percent / 100) * yearStartBalance : 0;
    case "lump_sum":
      return plan.lumpSumMonth === month ? plan.amount : 0;
  }
}

/**
 * Simulate a repayment mortgage month by month. Interest is charged monthly at the annual rate / 12.
 * Yearly overpayments fall at the end of each 12-month mortgage year, after that month's payment.
 * Everything is full floating-point precision; round only for display.
 */
export function simulate(inputs: MortgageInputs, plan: OverpaymentPlan | null = null, opts: SimOptions = {}): Simulation {
  const allowancePct = opts.allowancePct ?? 10;
  const n = Math.max(0, Math.round(inputs.termMonths));
  const loan = loanAmount(inputs);
  const band = ltvBand(loan, inputs.price);
  const upfrontFee = inputs.feeAddedToLoan ? 0 : Math.max(0, inputs.feeAmount);
  const cashNeeded = Math.max(0, inputs.depositAmount) + inputs.stampDuty + upfrontFee + inputs.otherCosts;

  const ipm = Math.max(0, Math.min(Math.round(inputs.initialPeriodMonths), n));
  const r1 = inputs.initialRate;
  const r2 = inputs.followOnRate ?? inputs.initialRate;
  const changes = ipm > 0 && ipm < n && r2 !== r1;

  const base: Simulation = {
    noMortgage: loan <= EPS,
    loan,
    ltv: band.ltv,
    ltvBand: band.band,
    nextBand: band.nextBand,
    headroom: band.headroom,
    payment: 0,
    paymentAfter: null,
    schedule: [],
    yearly: [],
    totals: { interest: 0, regular: 0, overpaid: 0, payable: 0, months: 0 },
    cashNeeded,
    totalCostOfBorrowing: Math.max(0, inputs.feeAmount),
    breaches: [],
    lowerPayments: { afterFirst: null, final: null },
  };
  if (base.noMortgage || n === 0) return base;

  let bal = loan;
  let rate = r1;
  let pay = pmt(loan, r1, n);
  base.payment = pay;

  const schedule: MonthRow[] = [];
  const yearly: YearRow[] = [];
  let yr = { opening: loan, payments: 0, interest: 0, capital: 0, overpaid: 0, overpaidInFix: 0 };
  let interestTotal = 0;
  let regularTotal = 0;
  let overTotal = 0;
  let m = 0;

  const closeYear = (year: number, closing: number) => {
    const inFix = ipm > 0 && 12 * (year - 1) < ipm;
    const allowance = inFix ? (allowancePct / 100) * yr.opening : null;
    yearly.push({
      year,
      opening: yr.opening,
      payments: yr.payments,
      interest: yr.interest,
      capital: yr.capital,
      overpaid: yr.overpaid,
      closing,
      allowance,
      flagged: allowance !== null && yr.overpaidInFix > allowance + 0.5,
    });
  };

  while (bal > EPS && m < n) {
    m++;
    if (changes && m === ipm + 1) {
      rate = r2;
      pay = pmt(bal, r2, n - ipm);
      base.paymentAfter = pay;
    }
    const opening = bal;
    const interest = bal * (rate / 1200);
    const capital = Math.min(pay - interest, bal);
    const payment = capital + interest;
    bal -= capital;

    let over = 0;
    if (plan && bal > EPS) {
      over = Math.min(Math.max(0, overpaymentDue(plan, m, yr.opening)), bal);
      bal -= over;
      if (over > 0 && plan.mode === "lower_payment" && bal > EPS) {
        pay = pmt(bal, rate, n - m);
        if (base.lowerPayments.afterFirst === null) base.lowerPayments.afterFirst = pay;
        base.lowerPayments.final = pay;
      }
    }
    if (bal < EPS) bal = 0;

    interestTotal += interest;
    regularTotal += payment;
    overTotal += over;
    yr.payments += payment;
    yr.interest += interest;
    yr.capital += capital;
    yr.overpaid += over;
    if (over > 0 && m <= ipm) yr.overpaidInFix += over;
    schedule.push({ month: m, opening, rate, payment, interest, capital, overpayment: over, closing: bal });

    if (m % 12 === 0) {
      closeYear(m / 12, bal);
      yr = { opening: bal, payments: 0, interest: 0, capital: 0, overpaid: 0, overpaidInFix: 0 };
    }
  }
  if (m % 12 !== 0) closeYear(Math.ceil(m / 12), bal);

  const breaches: AllowanceBreach[] = yearly
    .filter((y) => y.flagged && y.allowance !== null)
    .map((y) => {
      const inFixPaid = schedule.filter((s) => Math.ceil(s.month / 12) === y.year && s.month <= ipm).reduce((a, s) => a + s.overpayment, 0);
      const excess = inFixPaid - (y.allowance as number);
      return { year: y.year, overpaid: inFixPaid, allowance: y.allowance as number, excess, erc: opts.ercPct ? (excess * opts.ercPct) / 100 : null };
    });

  return {
    ...base,
    schedule,
    yearly,
    totals: { interest: interestTotal, regular: regularTotal, overpaid: overTotal, payable: regularTotal + overTotal, months: m },
    totalCostOfBorrowing: interestTotal + Math.max(0, inputs.feeAmount),
    breaches,
  };
}

/** What overpaying changes, against the same mortgage with no overpayments. */
export function compareOverpay(baseline: Simulation, withPlan: Simulation): OverpayComparison {
  const interestSaved = baseline.totals.interest - withPlan.totals.interest;
  const totalOverpaid = withPlan.totals.overpaid;
  return {
    monthsSaved: baseline.totals.months - withPlan.totals.months,
    interestSaved,
    payableSaved: baseline.totals.payable - withPlan.totals.payable,
    totalOverpaid,
    returnPerPound: totalOverpaid > 0 ? interestSaved / totalOverpaid : 0,
  };
}

/** Completion date plus the months simulated; the mortgage ends in that month. */
export function endDate(completion: Date, months: number): Date {
  const d = new Date(completion.getFullYear(), completion.getMonth() + months, 1);
  return d;
}

/** First day of next month: the default completion date. */
export function defaultCompletion(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/** Years and months, for example "19 years 4 months". */
export function yearsMonths(months: number): { years: number; months: number } {
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** The rate to use for a loan's LTV from the household's presets (the preset at or above the band). */
export function rateForLtv(presets: Array<{ ltv: number; rate: number }>, ltv: number): number | null {
  if (!presets.length) return null;
  const sorted = [...presets].sort((a, b) => a.ltv - b.ltv);
  return (sorted.find((p) => ltv <= p.ltv + 1e-9) ?? sorted[sorted.length - 1]).rate;
}

/** Typical maximum borrowing from combined gross income and an income multiple. */
export function maxBorrowing(income: number, multiple: number): number {
  return Math.max(0, income) * Math.max(0, multiple);
}

export const NO_OVERPAYMENT: OverpaymentPlan = {
  type: "annual_amount",
  amount: 0,
  percent: 0,
  startMonth: 1,
  endMonth: null,
  annualIncreasePct: 0,
  mode: "shorten_term",
  lumpSumMonth: null,
};
