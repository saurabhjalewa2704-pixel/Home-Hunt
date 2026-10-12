import { stampDuty } from "@homehunt/scoring";
import {
  NO_OVERPAYMENT,
  simulate,
  type MortgageInputs,
  type OverpaymentPlan,
  type ScenarioResult,
  type SimOptions,
  type Simulation,
} from "@homehunt/mortgage";
import { activeConfig, EVERYONE, scoreOne } from "./derive";
import type { Data, MortgageScenario, MortgageSettings, OverpaymentPlanRow } from "./types";

/** Scenario colours, in order. Each is a light-theme hex stored on the scenario; `dark` is the same hue stepped for dark surfaces. */
export const SCENARIO_COLOURS = [
  { light: "#9C3F7E", dark: "#B65398" },
  { light: "#17805A", dark: "#2AA070" },
  { light: "#2F6FD0", dark: "#4682E6" },
  { light: "#B07A00", dark: "#BC8A0E" },
  { light: "#6A5ACD", dark: "#8473E4" },
  { light: "#D2582B", dark: "#DB6538" },
] as const;

/** A CSS value for a stored colour that follows the light/dark theme (variables are defined in globals.css). */
export function scColour(hex: string): string {
  const i = SCENARIO_COLOURS.findIndex((c) => c.light.toLowerCase() === hex.toLowerCase());
  return i >= 0 ? `var(--sc-${i})` : hex;
}

export const SCENARIO_LETTERS = "ABCDEFGHIJKL";
export const MAX_SCENARIOS = 12;
export const MAX_COMPARE = 6;

export const DEFAULT_LTV_PRESETS = [
  { ltv: 60, rate: 4.6 },
  { ltv: 75, rate: 4.85 },
  { ltv: 80, rate: 5.0 },
  { ltv: 85, rate: 5.15 },
  { ltv: 90, rate: 5.35 },
  { ltv: 95, rate: 5.6 },
];

export const DEFAULT_SETTINGS: Omit<MortgageSettings, "id" | "household_id"> = {
  allowance_pct: 10,
  erc_pct: null,
  default_term_months: 360,
  default_initial_period_months: 60,
  default_fee: 999,
  default_other_costs: 2500,
  ltv_rate_presets: DEFAULT_LTV_PRESETS,
  income_multiple: 4.5,
  combined_income: null,
  show_monthly_on_board: false,
};

/** The household's mortgage settings, or the defaults until they are first saved. */
export function mortgageSettings(data: Data): MortgageSettings {
  const row = data.mortgage_settings[0];
  return row ? { ...DEFAULT_SETTINGS, ...row } : { id: "", household_id: data.household.id, ...DEFAULT_SETTINGS };
}

export const planFromRow = (r: OverpaymentPlanRow | null | undefined): OverpaymentPlan | null =>
  r
    ? {
        type: r.type,
        amount: r.amount ?? 0,
        percent: r.percent ?? 0,
        startMonth: r.start_month,
        endMonth: r.end_month,
        annualIncreasePct: r.annual_increase_pct,
        mode: r.mode,
        lumpSumMonth: r.lump_sum_month,
      }
    : null;

export const planFor = (data: Data, scenarioId: string) => planFromRow(data.overpayment_plans.find((p) => p.scenario_id === scenarioId));

export const EMPTY_PLAN: OverpaymentPlan = { ...NO_OVERPAYMENT, amount: 10_000, percent: 5 };

/** The price a home is scored on: the latest live or accepted offer, else the asking price. */
export function homePrice(data: Data, propertyId: string | null): number | null {
  const p = propertyId ? data.properties.find((x) => x.id === propertyId) : null;
  return p ? scoreOne(data, p, EVERYONE).result.effectivePrice : null;
}

export function priceOf(data: Data, s: MortgageScenario): number {
  return s.price ?? homePrice(data, s.property_id) ?? 0;
}

/** Stamp duty at the household's buyer type and rates. */
export function stampDutyFor(data: Data, price: number): number {
  const { config, buyerType } = activeConfig(data);
  return stampDuty(price, config.sdlt, buyerType === "first_time");
}

export function inputsOf(data: Data, s: MortgageScenario): MortgageInputs {
  const price = priceOf(data, s);
  return {
    price,
    depositAmount: s.deposit_amount,
    termMonths: s.term_months,
    initialRate: s.initial_rate,
    initialPeriodMonths: s.initial_period_months,
    followOnRate: s.follow_on_rate,
    feeAmount: s.fee_amount,
    feeAddedToLoan: s.fee_added_to_loan,
    otherCosts: s.other_costs,
    stampDuty: s.sdlt_override ?? stampDutyFor(data, price),
  };
}

export const simOptions = (settings: MortgageSettings): SimOptions => ({ allowancePct: settings.allowance_pct, ercPct: settings.erc_pct });

export function resultOf(data: Data, s: MortgageScenario, settings = mortgageSettings(data)): ScenarioResult {
  const inputs = inputsOf(data, s);
  const plan = planFor(data, s.id);
  const opts = simOptions(settings);
  return { id: s.id, name: s.name, inputs, sim: simulate(inputs, null, opts), planSim: plan && plan.amount + plan.percent > 0 ? simulate(inputs, plan, opts) : null };
}

export const preferredScenario = (data: Data) => data.mortgage_scenarios.find((s) => s.is_preferred) ?? null;

/** Scenarios in the order they were made, which fixes their letters A, B, C. */
export const orderedScenarios = (data: Data) => [...data.mortgage_scenarios].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
export const letterOf = (data: Data, id: string) => SCENARIO_LETTERS[Math.max(0, orderedScenarios(data).findIndex((s) => s.id === id))] ?? "?";

/**
 * "Our plan" applied to another home: the same deposit percentage, term and rates on that home's price,
 * with its own stamp duty. This puts every home's monthly cost on one basis.
 */
export function planOnHome(data: Data, price: number): { scenario: MortgageScenario; inputs: MortgageInputs; sim: Simulation } | null {
  const s = preferredScenario(data);
  if (!s || price <= 0) return null;
  const own = priceOf(data, s);
  const pct = own > 0 ? s.deposit_amount / own : 0.15;
  const inputs: MortgageInputs = {
    price,
    depositAmount: Math.round(price * pct),
    termMonths: s.term_months,
    initialRate: s.initial_rate,
    initialPeriodMonths: s.initial_period_months,
    followOnRate: s.follow_on_rate,
    feeAmount: s.fee_amount,
    feeAddedToLoan: s.fee_added_to_loan,
    otherCosts: s.other_costs,
    stampDuty: stampDutyFor(data, price),
  };
  return { scenario: s, inputs, sim: simulate(inputs) };
}

export const SC_FOOTNOTE = "Estimates only. Confirm with a mortgage adviser.";
