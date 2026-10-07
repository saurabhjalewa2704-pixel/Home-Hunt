import type { ListingDraft, PriceQualifier } from "./types";

export const SQM_TO_SQFT = 10.764;

export function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

export const sqmToSqft = (m2: number) => Math.round(m2 * SQM_TO_SQFT);
export const sqftToSqm = (ft: number) => Math.round((ft / SQM_TO_SQFT) * 10) / 10;

export function qualifierFrom(text: string | null | undefined): PriceQualifier | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/in excess of/.test(t)) return "offers_in_excess";
  if (/offers? (over|above)|o\/o/.test(t)) return "offers_over";
  if (/fixed price/.test(t)) return "fixed";
  if (/guide/.test(t)) return "guide";
  return null;
}

export function tenureFrom(text: string | null | undefined): ListingDraft["tenure"] {
  if (!text) return null;
  const t = text.toLowerCase().replace(/_/g, " ");
  if (/share of freehold/.test(t)) return "share_of_freehold";
  if (/leasehold/.test(t)) return "leasehold";
  if (/freehold/.test(t)) return "freehold";
  return null;
}

const OUTCODE = "[A-Z]{1,2}\\d[A-Z\\d]?";
export const FULL_POSTCODE = new RegExp(`\\b(${OUTCODE})\\s*(\\d[A-Z]{2})\\b`, "i");
export const OUTWARD_ONLY = new RegExp(`\\b(${OUTCODE})\\b`);

export function postcodeFrom(text: string | null | undefined): string | null {
  if (!text) return null;
  const full = text.match(FULL_POSTCODE);
  if (full) return `${full[1].toUpperCase()} ${full[2].toUpperCase()}`;
  const out = text.match(new RegExp(`\\b(${OUTCODE})\\b`));
  return out ? out[1].toUpperCase() : null;
}

/** True when only the outward part (e.g. SW12) is known. */
export const isPartialPostcode = (pc: string | null) => !!pc && !/\s?\d[A-Z]{2}$/i.test(pc);

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Breadth-first search for the first value under any of the given keys. */
export function deepFind(root: unknown, keys: string[], accept: (v: unknown) => boolean = (v) => v !== null && v !== undefined && v !== ""): unknown {
  const want = new Set(keys.map((k) => k.toLowerCase()));
  const queue: unknown[] = [root];
  let seen = 0;
  while (queue.length && seen++ < 20000) {
    const cur = queue.shift();
    if (cur && typeof cur === "object") {
      if (Array.isArray(cur)) {
        queue.push(...cur);
      } else {
        const obj = cur as Record<string, unknown>;
        for (const k of Object.keys(obj)) if (want.has(k.toLowerCase()) && accept(obj[k])) return obj[k];
        queue.push(...Object.values(obj));
      }
    }
  }
  return undefined;
}
