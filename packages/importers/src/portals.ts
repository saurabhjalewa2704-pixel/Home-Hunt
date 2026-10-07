import { draftFromData, draftFromJsonLd, draftFromOpenGraph, draftFromText, jsonScripts, mergeDrafts, openGraph, windowAssignment } from "./extract";
import { stripHtml } from "./parse-utils";
import type { ListingDraft, Portal } from "./types";

export interface PortalAdapter {
  portal: Portal;
  /** Structured data embedded in the page, most specific first. */
  embedded(html: string): unknown[];
}

const nextData = (html: string) => jsonScripts(html).filter((s) => s.id === "__NEXT_DATA__").map((s) => s.json);

export const ADAPTERS: Record<Portal, PortalAdapter> = {
  rightmove: {
    portal: "rightmove",
    embedded(html) {
      const model = windowAssignment(html, "PAGE_MODEL");
      const pd = model && typeof model === "object" ? ((model as Record<string, unknown>).propertyData ?? model) : undefined;
      return pd ? [pd] : [];
    },
  },
  zoopla: {
    portal: "zoopla",
    embedded: nextData,
  },
  onthemarket: {
    portal: "onthemarket",
    embedded(html) {
      return nextData(html);
    },
  },
};

/**
 * Preference order from the PRD (FR-I2): the portal's embedded data, then
 * schema.org JSON-LD, then Open Graph tags, then page text.
 */
export function parseListingHtml(html: string, portal: Portal): Partial<ListingDraft> {
  let draft: Partial<ListingDraft> = {};
  for (const data of ADAPTERS[portal].embedded(html)) draft = mergeDrafts(draft, draftFromData(data));
  const ld = jsonScripts(html).filter((s) => /ld\+json/i.test(s.type ?? "")).map((s) => s.json);
  if (ld.length) draft = mergeDrafts(draft, draftFromJsonLd(ld));
  draft = mergeDrafts(draft, draftFromOpenGraph(openGraph(html)));
  draft = mergeDrafts(draft, draftFromText(stripHtml(html)));
  return draft;
}
