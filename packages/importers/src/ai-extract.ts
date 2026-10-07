import { stripHtml } from "./parse-utils";
import type { DraftField, ListingDraft } from "./types";

/** Strict schema for the Claude API tool call (FR-I4). */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    asking_price: { type: ["number", "null"], description: "Asking price in GBP, digits only" },
    price_qualifier: { type: ["string", "null"], enum: ["guide", "offers_over", "offers_in_excess", "fixed", null] },
    property_type: { type: ["string", "null"] },
    beds: { type: ["number", "null"] },
    baths: { type: ["number", "null"] },
    receptions: { type: ["number", "null"] },
    floor_area_sqft: { type: ["number", "null"], description: "Square feet; convert from square metres if needed" },
    tenure: { type: ["string", "null"], enum: ["freehold", "leasehold", "share_of_freehold", null] },
    lease_years: { type: ["number", "null"] },
    service_charge: { type: ["number", "null"], description: "GBP per year" },
    ground_rent: { type: ["number", "null"], description: "GBP per year" },
    council_tax_band: { type: ["string", "null"] },
    epc: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    postcode: { type: ["string", "null"] },
  },
  required: ["asking_price", "beds", "baths", "address"],
} as const;

export interface AiExtractOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const SYSTEM =
  "You extract facts from UK property listing text. Return only values stated in the text. Use null for anything not stated; never guess. Prices are GBP.";

/**
 * Send visible page text to the Claude API with a forced tool call so the
 * output must match EXTRACTION_SCHEMA. The caller marks every returned field
 * as inferred for the buyer to confirm (FR-I4).
 */
export async function extractWithClaude(textOrHtml: string, opts: AiExtractOptions): Promise<Partial<ListingDraft>> {
  const text = (/<\w+[^>]*>/.test(textOrHtml) ? stripHtml(textOrHtml) : textOrHtml).slice(0, 24_000);
  const res = await (opts.fetchImpl ?? fetch)("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: opts.model ?? "claude-haiku-5-5",
      max_tokens: 1024,
      system: SYSTEM,
      tools: [{ name: "record_listing", description: "Record the facts found in the listing text", input_schema: EXTRACTION_SCHEMA }],
      tool_choice: { type: "tool", name: "record_listing" },
      messages: [{ role: "user", content: `Listing text:\n\n${text}` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}`);
  const body = (await res.json()) as { content?: Array<{ type: string; input?: Record<string, unknown> }> };
  const input = body.content?.find((c) => c.type === "tool_use")?.input ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== null && v !== undefined && k in EXTRACTION_SCHEMA.properties) out[k] = v;
  return out as Partial<ListingDraft>;
}

export const AI_FIELDS = Object.keys(EXTRACTION_SCHEMA.properties) as DraftField[];
