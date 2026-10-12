import { loanAmount, rateForLtv, type MortgageInputs } from "@homehunt/mortgage";
import type { Data, MortgageScenario, MortgageSettings } from "./types";
import { homePrice, inputsOf, mortgageSettings, planOnHome, preferredScenario, priceOf, stampDutyFor } from "./mortgage";

/** The calculator's form. Typed numbers are kept as text where half-typed values matter (rates). */
export interface CalcState {
  homeId: string;
  price: number;
  depPct: number;
  depAmt: number;
  termYears: number;
  termExtraMonths: number;
  rateStr: string;
  initialYears: number;
  followSame: boolean;
  followStr: string;
  feeAmount: number;
  feeAdded: boolean;
  otherCosts: number;
  sdltOverride: number | null;
  /** Follow the rate preset for the deposit's LTV band (SC-6). */
  bandRate: boolean;
  /** The saved scenario being edited, if any. */
  scenarioId: string | null;
}

export const PRICE_MIN = 50_000;
export const PRICE_MAX = 5_000_000;

/** A rate in %, rounded to 2 decimals; null if blank, 0, above 15 or not a number. */
export function parseRate(str: string): number | null {
  const v = parseFloat(str);
  if (str.trim() === "" || !Number.isFinite(v) || v <= 0 || v > 15) return null;
  return Math.round(v * 100) / 100;
}

const roundTo = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function setPrice(c: CalcState, price: number, presets: MortgageSettings["ltv_rate_presets"]): CalcState {
  const p = Math.max(0, price);
  // Editing the price keeps the percentage and recalculates the pounds (MC-2).
  return applyBand({ ...c, price: p, depAmt: Math.round((p * c.depPct) / 100) }, presets);
}
export function setDepPct(c: CalcState, pct: number, presets: MortgageSettings["ltv_rate_presets"]): CalcState {
  const v = Math.max(0, pct);
  return applyBand({ ...c, depPct: v, depAmt: Math.round((c.price * v) / 100) }, presets);
}
export function setDepAmt(c: CalcState, amt: number, presets: MortgageSettings["ltv_rate_presets"]): CalcState {
  const a = Math.max(0, amt);
  return applyBand({ ...c, depAmt: a, depPct: c.price > 0 ? roundTo((a / c.price) * 100, 2) : 0 }, presets);
}
function applyBand(c: CalcState, presets: MortgageSettings["ltv_rate_presets"]): CalcState {
  if (!c.bandRate || c.price <= 0) return c;
  const ltv = (Math.max(0, c.price - c.depAmt) / c.price) * 100;
  const r = rateForLtv(presets, ltv);
  return r === null ? c : { ...c, rateStr: r.toFixed(2) };
}

export interface CalcErrors {
  price?: string;
  deposit?: string;
  term?: string;
  rate?: string;
  follow?: string;
}

export function calcErrors(c: CalcState): CalcErrors {
  const e: CalcErrors = {};
  if (!(c.price >= PRICE_MIN && c.price <= PRICE_MAX)) e.price = "Enter a price between £50,000 and £5,000,000.";
  if (c.depAmt > c.price) e.deposit = "Your deposit can't be more than the price.";
  if (c.depAmt < 0 || !Number.isFinite(c.depAmt)) e.deposit = "Enter a deposit of £0 or more.";
  if (c.termYears < 5 || c.termYears * 12 + c.termExtraMonths > 40 * 12) e.term = c.termYears < 5 ? "Choose a term of at least 5 years." : "The longest term is 40 years.";
  if (parseRate(c.rateStr) === null) e.rate = "Enter a rate between 0.01% and 15%.";
  if (!c.followSame && parseRate(c.followStr) === null) e.follow = "Enter a rate between 0.01% and 15%.";
  return e;
}

export const hasErrors = (e: CalcErrors) => Object.keys(e).length > 0;

/** The engine inputs for the form, or null while any field is invalid. */
export function calcInputs(c: CalcState, stampDuty: number): MortgageInputs | null {
  if (hasErrors(calcErrors(c))) return null;
  return {
    price: c.price,
    depositAmount: c.depAmt,
    termMonths: c.termYears * 12 + c.termExtraMonths,
    initialRate: parseRate(c.rateStr)!,
    initialPeriodMonths: c.initialYears * 12,
    followOnRate: c.followSame ? null : parseRate(c.followStr),
    feeAmount: c.feeAmount,
    feeAddedToLoan: c.feeAdded,
    otherCosts: c.otherCosts,
    stampDuty,
  };
}

/** A fresh calculator on the household's defaults, optionally on a home's price and "our plan"'s terms. */
export function initialCalc(data: Data, homeId = ""): CalcState {
  const settings = mortgageSettings(data);
  const price = (homeId && homePrice(data, homeId)) || 695_000;
  const plan = homeId ? planOnHome(data, price) : null;
  if (plan) {
    const i = plan.inputs;
    return {
      homeId,
      price,
      depPct: roundTo((i.depositAmount / price) * 100, 2),
      depAmt: i.depositAmount,
      termYears: Math.floor(i.termMonths / 12),
      termExtraMonths: i.termMonths % 12,
      rateStr: i.initialRate.toFixed(2),
      initialYears: Math.round(i.initialPeriodMonths / 12),
      followSame: i.followOnRate === null,
      followStr: (i.followOnRate ?? i.initialRate + 2).toFixed(2),
      feeAmount: i.feeAmount,
      feeAdded: i.feeAddedToLoan,
      otherCosts: i.otherCosts,
      sdltOverride: null,
      bandRate: false,
      scenarioId: null,
    };
  }
  const depPct = 15;
  const rate = rateForLtv(settings.ltv_rate_presets, 100 - depPct) ?? 5.15;
  return {
    homeId,
    price,
    depPct,
    depAmt: Math.round((price * depPct) / 100),
    termYears: Math.floor(settings.default_term_months / 12),
    termExtraMonths: settings.default_term_months % 12,
    rateStr: rate.toFixed(2),
    initialYears: Math.round(settings.default_initial_period_months / 12),
    followSame: true,
    followStr: (rate + 2.09).toFixed(2),
    feeAmount: settings.default_fee,
    feeAdded: false,
    otherCosts: settings.default_other_costs,
    sdltOverride: null,
    bandRate: false,
    scenarioId: null,
  };
}

/** Load a saved scenario into the form for editing. */
export function calcFromScenario(data: Data, s: MortgageScenario): CalcState {
  const i = inputsOf(data, s);
  const price = priceOf(data, s) || i.price;
  return {
    homeId: s.property_id ?? "",
    price,
    depPct: price > 0 ? roundTo((s.deposit_amount / price) * 100, 2) : 0,
    depAmt: s.deposit_amount,
    termYears: Math.floor(s.term_months / 12),
    termExtraMonths: s.term_months % 12,
    rateStr: s.initial_rate.toFixed(2),
    initialYears: Math.round(s.initial_period_months / 12),
    followSame: s.follow_on_rate === null,
    followStr: (s.follow_on_rate ?? s.initial_rate + 2).toFixed(2),
    feeAmount: s.fee_amount,
    feeAdded: s.fee_added_to_loan,
    otherCosts: s.other_costs,
    sdltOverride: s.sdlt_override,
    bandRate: false,
    scenarioId: s.id,
  };
}

/** The fields to save for the form. Returns null while it is invalid. */
export function scenarioFields(c: CalcState, data: Data) {
  if (hasErrors(calcErrors(c))) return null;
  const linked = c.homeId ? homePrice(data, c.homeId) : null;
  return {
    property_id: c.homeId || null,
    // A scenario on a home follows that home's price (offers included) until a different price is typed.
    price: linked !== null && linked === c.price ? null : c.price,
    deposit_amount: c.depAmt,
    term_months: c.termYears * 12 + c.termExtraMonths,
    initial_rate: parseRate(c.rateStr)!,
    initial_period_months: c.initialYears * 12,
    follow_on_rate: c.followSame ? null : parseRate(c.followStr),
    fee_amount: c.feeAmount,
    fee_added_to_loan: c.feeAdded,
    other_costs: c.otherCosts,
    sdlt_override: c.sdltOverride,
  };
}

export function stampDutyOf(c: CalcState, data: Data): number {
  return c.sdltOverride ?? stampDutyFor(data, c.price);
}

export { loanAmount, preferredScenario };
