import { deepFind, postcodeFrom, qualifierFrom, sqmToSqft, stripHtml, tenureFrom, toNumber } from "./parse-utils";
import { emptyDraft, type ListingDraft } from "./types";

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i"))?.slice(1).find(Boolean) ?? null;

export function jsonScripts(html: string): Array<{ id: string | null; type: string | null; json: unknown }> {
  const out: Array<{ id: string | null; type: string | null; json: unknown }> = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const type = attr(m[1], "type");
    if (type && !/json/i.test(type)) continue;
    const body = m[2].trim();
    if (!body.startsWith("{") && !body.startsWith("[")) continue;
    try {
      out.push({ id: attr(m[1], "id"), type, json: JSON.parse(body) });
    } catch {
      /* not valid JSON, skip */
    }
  }
  return out;
}

/** `window.NAME = {...};` assignments, as Rightmove uses for PAGE_MODEL. */
export function windowAssignment(html: string, name: string): unknown {
  const idx = html.search(new RegExp(`window\\.${name}\\s*=\\s*\\{`));
  if (idx < 0) return undefined;
  const start = html.indexOf("{", idx);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function openGraph(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const key = attr(m[1], "property") ?? attr(m[1], "name");
    const content = attr(m[1], "content");
    if (key && content && /^(og:|twitter:|description)/i.test(key)) out[key.toLowerCase()] = content;
  }
  return out;
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function imageUrls(v: unknown): string[] {
  const urls: string[] = [];
  const add = (x: unknown) => {
    if (typeof x === "string" && /^https?:\/\//.test(x)) urls.push(x);
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      add(o.url ?? o.srcUrl ?? o.src ?? o.contentUrl ?? o.large ?? o.original);
    }
  };
  if (Array.isArray(v)) v.forEach(add);
  else add(v);
  return [...new Set(urls)];
}

/**
 * Map an embedded page-data object (PAGE_MODEL, __NEXT_DATA__, JSON-LD...) to
 * a draft. Uses key-name search so small shape changes in a portal's data do
 * not break the import; fixtures in the tests catch bigger ones.
 */
export function draftFromData(data: unknown): Partial<ListingDraft> {
  const d: Partial<ListingDraft> = {};
  const price =
    toNumber(deepFind(data, ["price"], (v) => typeof v === "number" || (typeof v === "string" && /\d/.test(v)))) ??
    toNumber(deepFind(data, ["primaryPrice", "displayPrice", "priceValue", "amount"]));
  if (price) d.asking_price = price;

  const qual =
    str(deepFind(data, ["displayPriceQualifier", "priceQualifier", "qualifier", "pricePrefix"], (v) => typeof v === "string")) ?? null;
  const q = qualifierFrom(qual);
  if (q) d.price_qualifier = q;

  const beds = toNumber(deepFind(data, ["bedrooms", "numBedrooms", "numberOfBedrooms", "beds"]));
  if (beds !== null) d.beds = beds;
  const baths = toNumber(deepFind(data, ["bathrooms", "numBathrooms", "numberOfBathrooms", "baths"]));
  if (baths !== null) d.baths = baths;
  const recs = toNumber(deepFind(data, ["receptions", "numRecepRooms", "numReceptionRooms", "livingRooms"]));
  if (recs !== null) d.receptions = recs;

  const sizings = deepFind(data, ["sizings"], Array.isArray);
  if (Array.isArray(sizings)) {
    const ft = sizings.find((s) => /sq\s?ft|sqft/i.test(String((s as Record<string, unknown>).unit)));
    const m2 = sizings.find((s) => /sq\s?m|sqm/i.test(String((s as Record<string, unknown>).unit)));
    const ftv = toNumber((ft as Record<string, unknown> | undefined)?.minimumSize ?? (ft as Record<string, unknown> | undefined)?.maximumSize);
    const m2v = toNumber((m2 as Record<string, unknown> | undefined)?.minimumSize ?? (m2 as Record<string, unknown> | undefined)?.maximumSize);
    if (ftv) d.floor_area_sqft = Math.round(ftv);
    else if (m2v) d.floor_area_sqft = sqmToSqft(m2v);
  }
  if (!d.floor_area_sqft) {
    const ft = toNumber(deepFind(data, ["floorAreaSqFt", "floorAreaSqft", "areaSqFt", "sizeSqFt"]));
    const m2 = toNumber(deepFind(data, ["floorAreaSqM", "floorAreaSqm", "areaSqM", "sizeSqM"]));
    if (ft) d.floor_area_sqft = Math.round(ft);
    else if (m2) d.floor_area_sqft = sqmToSqft(m2);
  }

  const address = str(deepFind(data, ["displayAddress", "streetAddress", "address"], (v) => typeof v === "string" && v.length > 3));
  if (address) d.address = address;
  const out = str(deepFind(data, ["outcode"]));
  const inc = str(deepFind(data, ["incode"]));
  const pc = str(deepFind(data, ["postalCode", "postcode"], (v) => typeof v === "string"));
  d.postcode = postcodeFrom(out && inc ? `${out} ${inc}` : (pc ?? address ?? "")) ?? undefined;
  if (!d.postcode) delete d.postcode;

  const lat = toNumber(deepFind(data, ["latitude", "lat"]));
  const lng = toNumber(deepFind(data, ["longitude", "lng", "lon"]));
  if (lat !== null && lng !== null && Math.abs(lat) > 1) {
    d.lat = lat;
    d.lng = lng;
  }

  const tenureRaw = deepFind(data, ["tenureType", "tenure"]);
  const tenure = tenureFrom(typeof tenureRaw === "object" && tenureRaw ? str(deepFind(tenureRaw, ["tenureType", "type"])) : str(tenureRaw));
  if (tenure) d.tenure = tenure;
  const lease = toNumber(deepFind(data, ["yearsRemainingOnLease", "leaseYearsRemaining", "unexpiredLeaseYears"]));
  if (lease !== null) d.lease_years = lease;
  const sc = toNumber(deepFind(data, ["annualServiceCharge", "serviceCharge"]));
  if (sc !== null) d.service_charge = sc;
  const gr = toNumber(deepFind(data, ["annualGroundRent", "groundRent"]));
  if (gr !== null) d.ground_rent = gr;
  const ct = str(deepFind(data, ["councilTaxBand", "counciltaxband"], (v) => typeof v === "string"));
  if (ct) d.council_tax_band = ct.replace(/^band\s*/i, "").toUpperCase().slice(0, 1);
  const epc = str(deepFind(data, ["epcRating", "epc", "energyRating"], (v) => typeof v === "string" && /^[A-G]$/i.test(v.trim())));
  if (epc) d.epc = epc.toUpperCase();

  const type = str(deepFind(data, ["propertySubType", "propertyType", "propertyTypeFull"], (v) => typeof v === "string"));
  if (type) d.property_type = type;
  const feats = deepFind(data, ["keyFeatures", "features", "bullets"], Array.isArray);
  if (Array.isArray(feats)) d.key_features = feats.map((f) => (typeof f === "string" ? f : str((f as Record<string, unknown>)?.text) ?? "")).filter(Boolean).slice(0, 12);
  const desc = str(deepFind(data, ["description", "detailedDescription", "fullDescription"], (v) => typeof v === "string" && v.length > 30));
  if (desc) d.description = stripHtml(desc).slice(0, 4000);
  const imgs = imageUrls(deepFind(data, ["images", "photos", "image", "propertyImages"]));
  if (imgs.length) d.image_urls = imgs;

  const agentName = str(deepFind(data, ["branchDisplayName", "agentName", "branchName"], (v) => typeof v === "string"));
  if (agentName) d.agency = agentName;
  const phone = str(deepFind(data, ["contactTelephone", "telephone", "phone", "branchPhone"], (v) => typeof v === "string"));
  if (phone) d.agent_phone = phone;
  return d;
}

export function draftFromJsonLd(blocks: unknown[]): Partial<ListingDraft> {
  const nodes: Record<string, unknown>[] = [];
  const walk = (b: unknown) => {
    if (Array.isArray(b)) b.forEach(walk);
    else if (b && typeof b === "object") {
      const o = b as Record<string, unknown>;
      nodes.push(o);
      if (o["@graph"]) walk(o["@graph"]);
    }
  };
  blocks.forEach(walk);
  const rel = nodes.find((n) => /RealEstateListing|Residence|Apartment|House|SingleFamilyResidence|Product|Offer/i.test(String(n["@type"])));
  if (!rel) return {};
  const d = draftFromData(rel);
  const offers = first(rel.offers) as Record<string, unknown> | undefined;
  if (offers && toNumber(offers.price)) d.asking_price = toNumber(offers.price)!;
  const addr = rel.address as Record<string, unknown> | undefined;
  if (addr && typeof addr === "object") {
    const parts = [addr.streetAddress, addr.addressLocality, addr.postalCode].filter((x) => typeof x === "string");
    if (parts.length) d.address = parts.join(", ");
    const pc = postcodeFrom(str(addr.postalCode) ?? "");
    if (pc) d.postcode = pc;
  }
  return d;
}

export function draftFromOpenGraph(og: Record<string, string>): Partial<ListingDraft> {
  const d: Partial<ListingDraft> = {};
  const title = og["og:title"] ?? "";
  const text = `${title} ${og["og:description"] ?? og["description"] ?? ""}`;
  const price = text.match(/£\s?([\d,]{5,})/);
  if (price) d.asking_price = toNumber(price[1]) ?? undefined;
  const q = qualifierFrom(text);
  if (q) d.price_qualifier = q;
  const beds = text.match(/(\d+)\s*bed/i);
  if (beds) d.beds = Number(beds[1]);
  const baths = text.match(/(\d+)\s*bath/i);
  if (baths) d.baths = Number(baths[1]);
  if (og["og:image"]) d.image_urls = [og["og:image"]];
  // Size, tenure and the like often sit in the description.
  const fromText = draftFromText(text);
  for (const k of ["floor_area_sqft", "tenure", "lease_years", "receptions"] as const) {
    if (fromText[k] !== undefined) (d as Record<string, unknown>)[k] = fromText[k];
  }
  const pc = postcodeFrom(title);
  if (pc) d.postcode = pc;
  const addr = title.match(/(?:for sale in|for sale at|in)\s+(.+?)(?:\s*[|\-–]|$)/i);
  if (addr) d.address = addr[1].trim();
  Object.keys(d).forEach((k) => (d as Record<string, unknown>)[k] === undefined && delete (d as Record<string, unknown>)[k]);
  return d;
}

/** Last resort: regex over visible text. Used for the page text and for pasted listing text. */
export function draftFromText(text: string): Partial<ListingDraft> {
  const t = text.replace(/\s+/g, " ");
  const d: Partial<ListingDraft> = {};
  const price = t.match(/£\s?(\d{3}(?:,\d{3})+)/);
  if (price) d.asking_price = toNumber(price[1]) ?? undefined;
  const q = qualifierFrom(t);
  if (q) d.price_qualifier = q;
  const beds = t.match(/(\d+)\s*(?:bed(?:room)?s?)\b/i);
  if (beds) d.beds = Number(beds[1]);
  else if (/\bstudio\b/i.test(t)) d.beds = 0;
  const baths = t.match(/(\d+)\s*(?:bath(?:room)?s?)\b/i);
  if (baths) d.baths = Number(baths[1]);
  const recs = t.match(/(\d+)\s*(?:reception(?: room)?s?)\b/i);
  if (recs) d.receptions = Number(recs[1]);
  const ft = t.match(/([\d,]{3,6}(?:\.\d+)?)\s*sq\.?\s?ft/i);
  const m2 = t.match(/([\d,]{2,5}(?:\.\d+)?)\s*(?:sq\.?\s?m|m²|sqm)\b/i);
  if (ft) d.floor_area_sqft = Math.round(toNumber(ft[1])!);
  else if (m2) d.floor_area_sqft = sqmToSqft(toNumber(m2[1])!);
  const tenure = tenureFrom(t);
  if (tenure) d.tenure = tenure;
  const lease = t.match(/(\d{2,3})\s*years?\s*(?:remaining|left|on (?:the )?lease)|lease(?: length)?:?\s*(\d{2,3})\s*years?/i);
  if (lease) d.lease_years = Number(lease[1] ?? lease[2]);
  const sc = t.match(/service charge:?\s*£\s?([\d,]+)/i);
  if (sc) d.service_charge = toNumber(sc[1])!;
  const gr = t.match(/ground rent:?\s*£\s?([\d,]+)/i);
  if (gr) d.ground_rent = toNumber(gr[1])!;
  const ct = t.match(/council tax(?: band)?:?\s*(?:band\s*)?([A-H])\b/i);
  if (ct) d.council_tax_band = ct[1].toUpperCase();
  const epc = t.match(/(?:EPC|energy(?: performance)?)(?: rating)?:?\s*([A-G])\b/i);
  if (epc) d.epc = epc[1].toUpperCase();
  const pc = postcodeFrom(t);
  if (pc) d.postcode = pc;
  Object.keys(d).forEach((k) => (d as Record<string, unknown>)[k] === undefined && delete (d as Record<string, unknown>)[k]);
  return d;
}

/** Fill gaps in `base` from `extra`; never overwrites a value already found. */
export function mergeDrafts(base: Partial<ListingDraft>, extra: Partial<ListingDraft>): Partial<ListingDraft> {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    const empty = cur === undefined || cur === null || cur === "" || (Array.isArray(cur) && cur.length === 0);
    if (empty && v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  }
  return out as Partial<ListingDraft>;
}

export { emptyDraft };
