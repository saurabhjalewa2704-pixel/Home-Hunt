export type Portal = "rightmove" | "zoopla" | "onthemarket";
export type FieldSource = "fetched" | "inferred" | "missing";
export type PriceQualifier = "guide" | "offers_over" | "offers_in_excess" | "fixed";

export interface ListingDraft {
  portal: Portal | null;
  listing_url: string | null;
  listing_id: string | null;
  asking_price: number | null;
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
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  key_features: string[];
  description: string | null;
  image_urls: string[];
  agent_name: string | null;
  agency: string | null;
  agent_phone: string | null;
  agent_email: string | null;
}

export type DraftField = keyof ListingDraft;

export interface ImportResult {
  draft: ListingDraft;
  sources: Record<DraftField, FieldSource>;
  /** How many of the six core fields (price, beds, baths, size, address, first image) were found. */
  coreFound: number;
  /** True when structured extraction found too few core fields and AI extraction should run. */
  needsAi: boolean;
}

export const CORE_FIELDS: DraftField[] = ["asking_price", "beds", "baths", "floor_area_sqft", "address", "image_urls"];

export function emptyDraft(): ListingDraft {
  return {
    portal: null,
    listing_url: null,
    listing_id: null,
    asking_price: null,
    price_qualifier: null,
    property_type: null,
    beds: null,
    baths: null,
    receptions: null,
    floor_area_sqft: null,
    tenure: null,
    lease_years: null,
    service_charge: null,
    ground_rent: null,
    council_tax_band: null,
    epc: null,
    address: null,
    postcode: null,
    lat: null,
    lng: null,
    key_features: [],
    description: null,
    image_urls: [],
    agent_name: null,
    agency: null,
    agent_phone: null,
    agent_email: null,
  };
}

export const isEmptyValue = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
