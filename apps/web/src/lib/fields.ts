import type { ListingDraft } from "@homehunt/importers";

export interface Form {
  address: string;
  asking_price: string;
  price_qualifier: string;
  postcode: string;
  property_type: string;
  beds: string;
  baths: string;
  floor_area_sqft: string;
  tenure: string;
  lease_years: string;
  service_charge: string;
  ground_rent: string;
  council_tax_band: string;
  epc: string;
}

export const FIELDS: Array<{ key: keyof Form; label: string; kind?: "text" | "number" | "select"; options?: Array<[string, string]>; placeholder?: string; wide?: boolean; hint?: string }> = [
  { key: "address", label: "Address", wide: true, placeholder: "Street, area, London" },
  { key: "asking_price", label: "Asking price (£)", kind: "number" },
  { key: "price_qualifier", label: "Price type", kind: "select", options: [["guide", "Guide price"], ["offers_over", "Offers over"], ["offers_in_excess", "Offers in excess of"], ["fixed", "Fixed price"]] },
  { key: "postcode", label: "Postcode", placeholder: "SW12 9QT" },
  { key: "property_type", label: "Property type", placeholder: "Flat, first floor" },
  { key: "beds", label: "Bedrooms", kind: "number" },
  { key: "baths", label: "Bathrooms", kind: "number" },
  { key: "floor_area_sqft", label: "Floor area (sq ft)", kind: "number" },
  { key: "tenure", label: "Tenure", kind: "select", options: [["", "Not sure"], ["freehold", "Freehold"], ["leasehold", "Leasehold"], ["share_of_freehold", "Share of freehold"]] },
  { key: "lease_years", label: "Lease years left", kind: "number", placeholder: "Ask the agent" },
  { key: "service_charge", label: "Service charge (£ a year)", kind: "number" },
  { key: "ground_rent", label: "Ground rent (£ a year)", kind: "number", placeholder: "Ask the agent" },
  { key: "council_tax_band", label: "Council tax band", placeholder: "A to H" },
  { key: "epc", label: "EPC rating", placeholder: "From the EPC register" },
];

export const EMPTY: Form = { address: "", asking_price: "", price_qualifier: "guide", postcode: "", property_type: "", beds: "", baths: "", floor_area_sqft: "", tenure: "", lease_years: "", service_charge: "", ground_rent: "", council_tax_band: "", epc: "" };

export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
export const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

export function toForm(d: ListingDraft): Form {
  return {
    address: str(d.address),
    asking_price: str(d.asking_price),
    price_qualifier: d.price_qualifier ?? "guide",
    postcode: str(d.postcode),
    property_type: str(d.property_type),
    beds: str(d.beds),
    baths: str(d.baths),
    floor_area_sqft: str(d.floor_area_sqft),
    tenure: str(d.tenure),
    lease_years: str(d.lease_years),
    service_charge: str(d.service_charge),
    ground_rent: str(d.ground_rent),
    council_tax_band: str(d.council_tax_band),
    epc: str(d.epc),
  };
}

