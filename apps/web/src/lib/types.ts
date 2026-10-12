import type { CriterionKey, Impact, OfferOutcome, PriceQualifier, ScoringConfig } from "@homehunt/scoring";
import type { ProximityCategory } from "@homehunt/geo";

export type { PriceQualifier, ProximityCategory };

export const STATUSES = [
  "shortlisted",
  "viewing_booked",
  "viewed",
  "second_viewing",
  "offer_made",
  "offer_accepted",
  "ruled_out",
  "withdrawn",
  "sold",
] as const;
export type Status = (typeof STATUSES)[number];
/** Shortlisted to Offer made (and an accepted offer) count as active for ranking. */
export const ACTIVE_STATUSES: Status[] = ["shortlisted", "viewing_booked", "viewed", "second_viewing", "offer_made", "offer_accepted"];

export const STATUS_LABELS: Record<Status, string> = {
  shortlisted: "Shortlisted",
  viewing_booked: "Viewing booked",
  viewed: "Viewed",
  second_viewing: "Second viewing",
  offer_made: "Offer made",
  offer_accepted: "Offer accepted",
  ruled_out: "Ruled out",
  withdrawn: "Withdrawn",
  sold: "Sold",
};

export const RULE_OUT_REASONS = ["Over budget", "Too far from station", "Too small", "Condition", "Lease", "Area", "Sold"];

export interface Member {
  id: string;
  household_id: string;
  display_name: string;
  colour: string;
}

export interface Property {
  id: string;
  household_id: string;
  status: Status;
  portal: "rightmove" | "zoopla" | "onthemarket" | null;
  listing_url: string | null;
  listing_id: string | null;
  asking_price: number;
  price_qualifier: PriceQualifier | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  receptions: number | null;
  floor_area_sqft: number | null;
  tenure: "freehold" | "leasehold" | "share_of_freehold" | null;
  lease_years: number | null;
  service_charge: number | null;
  ground_rent: number | null;
  council_tax_band: string | null;
  epc: string | null;
  address: string;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  address_precision: "exact" | "approximate";
  key_features: string[];
  description: string | null;
  /** URL or data URL of the stored cover image (thumbnail). */
  cover_image_path: string | null;
  image_urls: string[];
  /** Per-field provenance: fetched, inferred or manual. */
  field_sources: Record<string, "fetched" | "inferred" | "manual">;
  default_agent_id: string | null;
  pinned_by: string | null;
  pin_reason: string | null;
  ruled_out_reason: string | null;
  archived_at: string | null;
  tint: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusEvent {
  id: string;
  property_id: string;
  from_status: Status | null;
  to_status: Status;
  member_id: string | null;
  at: string;
}

export interface Agent {
  id: string;
  household_id: string;
  name: string;
  agency: string | null;
  branch: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  notes: string | null;
}

export type ViewingStatus = "booked" | "done" | "cancelled" | "no_show";
export type ViewingKind = "first" | "second" | "survey";
export interface Viewing {
  id: string;
  property_id: string;
  agent_id: string | null;
  starts_at: string;
  duration_min: number;
  status: ViewingStatus;
  attendees: string[];
  notes: string | null;
  kind: ViewingKind;
}

export interface Assessment {
  id: string;
  property_id: string;
  viewing_id: string | null;
  member_id: string;
  ratings: Record<string, number | null>;
  space_living: number | null;
  space_kitchen: number | null;
  gut_feel: number | null;
  note: string | null;
  submitted_at: string | null;
  updated_at: string;
}

export interface ProCon {
  id: string;
  property_id: string;
  member_id: string;
  kind: "pro" | "con";
  text: string;
  impact: Impact;
  criterion: CriterionKey | null;
  deal_breaker: boolean;
  position: number;
  agreed_from_id: string | null;
}

export interface Proximity {
  id: string;
  property_id: string;
  category: ProximityCategory;
  place_name: string;
  place_lat: number | null;
  place_lng: number | null;
  walk_min: number;
  walk_m: number | null;
  source: "auto" | "manual";
  edited_by: string | null;
  calculated_at: string;
  method: "routed" | "estimated" | null;
}

export interface Offer {
  id: string;
  property_id: string;
  amount: number;
  made_at: string;
  conditions: string | null;
  response: string | null;
  responded_at: string | null;
  outcome: OfferOutcome;
}

export interface Note {
  id: string;
  property_id: string;
  member_id: string;
  text: string;
  created_at: string;
}

export interface Photo {
  id: string;
  property_id: string;
  member_id: string;
  storage_path: string;
  created_at: string;
}

export interface ScoreSnapshot {
  id: string;
  property_id: string;
  config_version: number;
  combined: number;
  provisional: boolean;
  tier: string;
  rank: number | null;
  member_scores: Record<string, number>;
  created_at: string;
}

export interface ConfigRow {
  id: string;
  household_id: string;
  version: number;
  config: ScoringConfig;
  buyer_type: "first_time" | "standard";
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

/** A named, saved set of calculator inputs shared by the household (mortgage PRD section 4). */
export interface MortgageScenario {
  id: string;
  household_id: string;
  name: string;
  note: string | null;
  /** One of the scenario palette colours (light-theme hex); see lib/mortgage.ts. */
  colour: string;
  property_id: string | null;
  /** Price typed on the scenario. Null with a property means "follow that home's price". */
  price: number | null;
  deposit_amount: number;
  term_months: number;
  initial_rate: number;
  initial_period_months: number;
  /** Null means the same as the initial rate. */
  follow_on_rate: number | null;
  fee_amount: number;
  fee_added_to_loan: boolean;
  other_costs: number;
  sdlt_override: number | null;
  completion_date: string | null;
  is_preferred: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OverpaymentPlanRow {
  id: string;
  scenario_id: string;
  type: "annual_amount" | "annual_percent" | "monthly_amount" | "lump_sum";
  amount: number | null;
  percent: number | null;
  start_month: number;
  end_month: number | null;
  annual_increase_pct: number;
  mode: "shorten_term" | "lower_payment";
  lump_sum_month: number | null;
}

/** One row per household. */
export interface MortgageSettings {
  id: string;
  household_id: string;
  allowance_pct: number;
  erc_pct: number | null;
  default_term_months: number;
  default_initial_period_months: number;
  default_fee: number;
  default_other_costs: number;
  ltv_rate_presets: Array<{ ltv: number; rate: number }>;
  income_multiple: number;
  combined_income: number | null;
  show_monthly_on_board: boolean;
}

export interface Data {
  household: Household;
  members: Member[];
  scoring_config: ConfigRow[];
  properties: Property[];
  status_events: StatusEvent[];
  agents: Agent[];
  viewings: Viewing[];
  assessments: Assessment[];
  pro_cons: ProCon[];
  proximity: Proximity[];
  offers: Offer[];
  notes: Note[];
  photos: Photo[];
  score_snapshots: ScoreSnapshot[];
  mortgage_scenarios: MortgageScenario[];
  overpayment_plans: OverpaymentPlanRow[];
  mortgage_settings: MortgageSettings[];
}

export type TableName = Exclude<keyof Data, "household">;
export const TABLES: TableName[] = [
  "members",
  "scoring_config",
  "properties",
  "status_events",
  "agents",
  "viewings",
  "assessments",
  "pro_cons",
  "proximity",
  "offers",
  "notes",
  "photos",
  "score_snapshots",
  "mortgage_scenarios",
  "overpayment_plans",
  "mortgage_settings",
];

/** Tables added after the first release. A database that predates them still loads; these just start empty. */
export const OPTIONAL_TABLES: TableName[] = ["mortgage_scenarios", "overpayment_plans", "mortgage_settings"];

export type RowOf<T extends TableName> = Data[T][number];
