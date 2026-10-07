import { extractWithClaude, type AiExtractOptions } from "./ai-extract";
import { buildResult } from "./build";
import { mergeDrafts } from "./extract";
import { fetchListingHtml, type FetchOptions } from "./fetch-listing";
import { parseListingHtml } from "./portals";
import { stripHtml } from "./parse-utils";
import type { DraftField, ImportResult } from "./types";
import { listingIdFromUrl, normaliseUrl } from "./url";

export interface ImportOptions extends FetchOptions {
  /** When set, AI extraction runs if fewer than four core fields are found. */
  ai?: Omit<AiExtractOptions, "fetchImpl"> | null;
  aiFetchImpl?: typeof fetch;
}

/** Parse already-fetched HTML. Pure apart from the optional AI call. */
export async function importFromHtml(html: string, url: string, ai?: ImportOptions["ai"], aiFetch?: typeof fetch): Promise<ImportResult> {
  const { url: clean, portal } = normaliseUrl(url);
  const base = { portal, listing_url: clean, listing_id: listingIdFromUrl(clean, portal) };
  let partial = parseListingHtml(html, portal);
  let result = buildResult(partial, base);
  if (result.needsAi && ai) {
    try {
      const extra = await extractWithClaude(stripHtml(html), { ...ai, fetchImpl: aiFetch });
      const before = partial;
      partial = mergeDrafts(partial, extra);
      const inferred = (Object.keys(partial) as DraftField[]).filter((k) => (before as Record<string, unknown>)[k] === undefined || (before as Record<string, unknown>)[k] === null);
      result = buildResult(partial, base, inferred);
    } catch {
      /* AI is a bonus; the structured result stands */
    }
  }
  return result;
}

/** Fetch one listing page and parse it (FR-I1 to FR-I6). Throws ImportError on failure. */
export async function importFromUrl(rawUrl: string, opts: ImportOptions = {}): Promise<ImportResult> {
  const { html, url } = await fetchListingHtml(rawUrl, opts);
  return importFromHtml(html, url, opts.ai, opts.aiFetchImpl);
}
