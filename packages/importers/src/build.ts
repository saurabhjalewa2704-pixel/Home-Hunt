import { draftFromText, mergeDrafts } from "./extract";
import { isPartialPostcode, sqftToSqm } from "./parse-utils";
import { CORE_FIELDS, emptyDraft, isEmptyValue, type DraftField, type FieldSource, type ImportResult, type ListingDraft } from "./types";

export const MIN_CORE_FIELDS = 4;

/**
 * Turn a partial parse into the result the import preview shows: a full draft
 * plus a source flag (fetched / inferred / missing) for every field.
 * `inferredKeys` marks fields that were worked out rather than read, for
 * example by AI extraction or from a partial postcode.
 */
export function buildResult(
  partial: Partial<ListingDraft>,
  base: Pick<ListingDraft, "portal" | "listing_url" | "listing_id">,
  inferredKeys: Iterable<DraftField> = [],
): ImportResult {
  const draft: ListingDraft = { ...emptyDraft(), ...partial, ...base };
  const inferred = new Set<DraftField>(inferredKeys);
  const sources = {} as Record<DraftField, FieldSource>;
  for (const k of Object.keys(draft) as DraftField[]) {
    sources[k] = isEmptyValue(draft[k]) ? "missing" : inferred.has(k) ? "inferred" : "fetched";
  }
  // A postcode that is only the outward part is worked out, not fetched.
  if (draft.postcode && isPartialPostcode(draft.postcode) && sources.postcode === "fetched") sources.postcode = "inferred";
  for (const k of ["portal", "listing_url", "listing_id"] as DraftField[]) if (!isEmptyValue(draft[k])) sources[k] = "fetched";
  const coreFound = CORE_FIELDS.filter((k) => sources[k] !== "missing").length;
  return { draft, sources, coreFound, needsAi: coreFound < MIN_CORE_FIELDS };
}

/** Parse text the buyer pasted from a listing page (FR-I5 fallback). */
export function importFromText(text: string): ImportResult {
  const partial = draftFromText(text);
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const addrLine = lines.find((l) => /(road|street|grove|lane|avenue|close|gardens?|hill|square|terrace|way|place|court|mews|park|drive)\b/i.test(l) && l.length < 120);
  if (addrLine && !partial.address) partial.address = addrLine.replace(/^address:?\s*/i, "");
  return buildResult(partial, { portal: null, listing_url: null, listing_id: null });
}

export { mergeDrafts, sqftToSqm };
