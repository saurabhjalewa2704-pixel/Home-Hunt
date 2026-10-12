/** Everything a scenario needs to be calculated. Rates are percentages (5.15 means 5.15%). */
export interface MortgageInputs {
  price: number;
  depositAmount: number;
  termMonths: number;
  initialRate: number;
  /** Months at the initial rate. 0 means one rate for the whole term. */
  initialPeriodMonths: number;
  /** Rate after the initial period. null means "the same", i.e. assume you remortgage on similar terms. */
  followOnRate: number | null;
  feeAmount: number;
  feeAddedToLoan: boolean;
  otherCosts: number;
  stampDuty: number;
}

export type OverpaymentType = "annual_amount" | "annual_percent" | "monthly_amount" | "lump_sum";
export type OverpaymentMode = "shorten_term" | "lower_payment";

export interface OverpaymentPlan {
  type: OverpaymentType;
  /** Pounds: per year, per month, or the lump sum. */
  amount: number;
  /** For annual_percent: a share of the balance at the start of that mortgage year. */
  percent: number;
  /** First month an overpayment may happen (1 = from the start). */
  startMonth: number;
  /** Last month one may happen; null runs to the end. */
  endMonth: number | null;
  /** Grow the overpayment by this % each year (for pay rises). */
  annualIncreasePct: number;
  mode: OverpaymentMode;
  /** For lump_sum: the month it is paid. */
  lumpSumMonth: number | null;
}

export interface SimOptions {
  /** Overpayment allowance as a % of the balance at the start of each year, during the initial period. Default 10. */
  allowancePct?: number;
  /** Estimated early repayment charge as a % of the excess over the allowance. */
  ercPct?: number | null;
}

export interface MonthRow {
  month: number;
  opening: number;
  rate: number;
  payment: number;
  interest: number;
  capital: number;
  overpayment: number;
  closing: number;
}

export interface YearRow {
  year: number;
  opening: number;
  /** Regular payments made this year. */
  payments: number;
  interest: number;
  capital: number;
  overpaid: number;
  closing: number;
  /** Allowance for the year while in the initial period, otherwise null (no limit). */
  allowance: number | null;
  /** True when the overpayment made inside the initial period exceeds the allowance. */
  flagged: boolean;
}

export interface AllowanceBreach {
  year: number;
  overpaid: number;
  allowance: number;
  excess: number;
  /** Estimated charge on the excess, when an ERC % is set. */
  erc: number | null;
}

export interface Simulation {
  /** True when the deposit covers the whole price: nothing to borrow. */
  noMortgage: boolean;
  loan: number;
  ltv: number;
  /** The lender band (60, 75, 80, 85, 90 or 95) this loan falls in, or null above 95%. */
  ltvBand: number | null;
  /** The next better band and the extra deposit needed to reach it. */
  nextBand: number | null;
  headroom: number;
  /** Payment during the initial period. */
  payment: number;
  /** Payment after the initial period if it differs, else null. */
  paymentAfter: number | null;
  schedule: MonthRow[];
  yearly: YearRow[];
  totals: {
    interest: number;
    /** Regular monthly payments only. */
    regular: number;
    overpaid: number;
    /** Every pound handed to the lender: regular payments plus overpayments. */
    payable: number;
    months: number;
  };
  cashNeeded: number;
  totalCostOfBorrowing: number;
  breaches: AllowanceBreach[];
  /** Lower-the-payment mode: the payment after the first overpayment and in the last year. */
  lowerPayments: { afterFirst: number | null; final: number | null };
}

export interface OverpayComparison {
  monthsSaved: number;
  interestSaved: number;
  payableSaved: number;
  totalOverpaid: number;
  /** Interest saved per £1 overpaid. */
  returnPerPound: number;
}

export interface LtvPreset {
  /** The band, for example 85. */
  ltv: number;
  rate: number;
}
