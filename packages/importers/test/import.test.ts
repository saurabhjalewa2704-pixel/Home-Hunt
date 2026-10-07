import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  EXTRACTION_SCHEMA,
  ImportError,
  fetchListingHtml,
  importFromHtml,
  importFromText,
  importFromUrl,
  listingIdFromUrl,
  normaliseUrl,
  postcodeFrom,
  sqftToSqm,
  sqmToSqft,
} from "../src";

const fx = (n: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", n), "utf8");

describe("normaliseUrl", () => {
  it("accepts the three portals and strips tracking params", () => {
    const r = normaliseUrl("http://www.rightmove.co.uk/properties/150000001?utm_source=x&channel=RES_BUY#/?x=1");
    expect(r.portal).toBe("rightmove");
    expect(r.url).toBe("https://www.rightmove.co.uk/properties/150000001");
    expect(normaliseUrl("https://www.zoopla.co.uk/for-sale/details/66000002/").portal).toBe("zoopla");
    expect(normaliseUrl("https://www.onthemarket.com/details/12345678/").portal).toBe("onthemarket");
  });
  it("rejects other hosts, lookalikes and junk", () => {
    expect(() => normaliseUrl("https://example.com/x")).toThrowError(/paste the listing text/);
    expect(() => normaliseUrl("https://rightmove.co.uk.evil.test/x")).toThrow(ImportError);
    expect(() => normaliseUrl("not a url")).toThrow(ImportError);
    expect(() => normaliseUrl("file:///etc/passwd")).toThrow(ImportError);
  });
  it("extracts listing ids", () => {
    expect(listingIdFromUrl("https://www.rightmove.co.uk/properties/150000001", "rightmove")).toBe("150000001");
    expect(listingIdFromUrl("https://www.zoopla.co.uk/for-sale/details/66000002/", "zoopla")).toBe("66000002");
  });
});

describe("portal parsers (fixtures)", () => {
  it("rightmove: PAGE_MODEL", async () => {
    const r = await importFromHtml(fx("rightmove.html"), "https://www.rightmove.co.uk/properties/150000001");
    expect(r.draft).toMatchObject({
      portal: "rightmove",
      listing_id: "150000001",
      asking_price: 735000,
      price_qualifier: "guide",
      beds: 2,
      baths: 1,
      floor_area_sqft: 880,
      tenure: "leasehold",
      lease_years: 92,
      service_charge: 1850,
      ground_rent: 250,
      council_tax_band: "E",
      postcode: "SW11 6HG",
      lat: 51.4651,
    });
    expect(r.draft.address).toContain("Bolingbroke Grove");
    expect(r.draft.image_urls[0]).toBe("https://media.rightmove.example/img/1.jpg");
    expect(r.draft.key_features).toHaveLength(3);
    expect(r.coreFound).toBe(6);
    expect(r.needsAi).toBe(false);
    expect(r.sources.asking_price).toBe("fetched");
    expect(r.sources.epc).toBe("missing");
  });

  it("zoopla: __NEXT_DATA__, converts nothing when sq ft is given", async () => {
    const r = await importFromHtml(fx("zoopla.html"), "https://www.zoopla.co.uk/for-sale/details/66000002/?utm_medium=x");
    expect(r.draft).toMatchObject({ asking_price: 650000, beds: 2, baths: 1, floor_area_sqft: 740, tenure: "leasehold", lease_years: 118, council_tax_band: "D", postcode: "SW17 7PP" });
    expect(r.draft.description).not.toContain("<p>");
    expect(r.needsAi).toBe(false);
  });

  it("onthemarket: falls back to JSON-LD, Open Graph, then text", async () => {
    const r = await importFromHtml(fx("onthemarket.html"), "https://www.onthemarket.com/details/12345678/");
    expect(r.draft).toMatchObject({ asking_price: 695000, beds: 2, baths: 1, floor_area_sqft: 812, tenure: "share_of_freehold", council_tax_band: "C", epc: "D", price_qualifier: "guide" });
    expect(r.draft.postcode).toBe("SW18 2HW");
    expect(r.draft.image_urls).toContain("https://media.otm.example/1.jpg");
  });

  it("flags a partial postcode as inferred", async () => {
    const html = fx("onthemarket.html").replace(/SW18 2HW/g, "SW18");
    const r = await importFromHtml(html, "https://www.onthemarket.com/details/12345678/");
    expect(r.draft.postcode).toBe("SW18");
    expect(r.sources.postcode).toBe("inferred");
  });
});

describe("AI fallback (FR-I4)", () => {
  it("is not called when 4+ core fields are found", async () => {
    const ai = vi.fn();
    await importFromHtml(fx("rightmove.html"), "https://www.rightmove.co.uk/properties/150000001", { apiKey: "k" }, ai as never);
    expect(ai).not.toHaveBeenCalled();
  });

  it("fills a sparse page and marks the new fields inferred", async () => {
    const calls: unknown[] = [];
    const fake = vi.fn(async (_u: unknown, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({ content: [{ type: "tool_use", input: { asking_price: 640000, beds: 2, baths: 1, address: "Brixton Hill, London SW2", floor_area_sqft: null } }] }),
        { status: 200 },
      );
    });
    const r = await importFromHtml(fx("sparse.html"), "https://www.zoopla.co.uk/for-sale/details/1/", { apiKey: "k" }, fake as never);
    expect(r.draft.asking_price).toBe(640000);
    expect(r.sources.asking_price).toBe("inferred");
    expect(r.sources.floor_area_sqft).toBe("missing");
    const body = calls[0] as { tool_choice: { name: string }; tools: Array<{ input_schema: unknown }> };
    expect(body.tool_choice.name).toBe("record_listing");
    expect(body.tools[0].input_schema).toEqual(EXTRACTION_SCHEMA);
  });

  it("keeps the structured result when the AI call fails", async () => {
    const fake = vi.fn(async () => new Response("no", { status: 500 }));
    const r = await importFromHtml(fx("sparse.html"), "https://www.zoopla.co.uk/for-sale/details/1/", { apiKey: "k" }, fake as never);
    expect(r.needsAi).toBe(true);
    expect(r.draft.asking_price).toBeNull();
  });
});

describe("fetchListingHtml (FR-I1, FR-I5)", () => {
  const ok = (html: string, status = 200, headers: Record<string, string> = {}) => new Response(html, { status, headers });

  it("fetches once with a browser-like user agent", async () => {
    const f = vi.fn(async () => ok(fx("rightmove.html")));
    const r = await fetchListingHtml("https://www.rightmove.co.uk/properties/150000001?utm_source=a", { fetchImpl: f as never });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://www.rightmove.co.uk/properties/150000001");
    expect(init.headers["user-agent"]).toMatch(/Mozilla/);
    expect(r.html).toContain("PAGE_MODEL");
  });

  it("reports a block plainly", async () => {
    const f = async () => ok("", 403);
    await expect(fetchListingHtml("https://www.zoopla.co.uk/for-sale/details/1/", { fetchImpl: f as never })).rejects.toMatchObject({ code: "blocked" });
    const g = async () => ok(fx("blocked.html"));
    await expect(fetchListingHtml("https://www.zoopla.co.uk/for-sale/details/1/", { fetchImpl: g as never })).rejects.toMatchObject({ code: "blocked" });
  });

  it("will not follow a redirect off the portal hosts", async () => {
    const f = async () => ok("", 302, { location: "http://169.254.169.254/latest/meta-data" });
    await expect(fetchListingHtml("https://www.zoopla.co.uk/for-sale/details/1/", { fetchImpl: f as never })).rejects.toMatchObject({ code: "blocked" });
  });

  it("follows a redirect that stays on a portal", async () => {
    let n = 0;
    const f = async () => (n++ === 0 ? ok("", 301, { location: "/properties/150000001/" }) : ok(fx("rightmove.html")));
    const r = await fetchListingHtml("https://www.rightmove.co.uk/properties/150000001", { fetchImpl: f as never });
    expect(r.url).toBe("https://www.rightmove.co.uk/properties/150000001/");
  });

  it("times out", async () => {
    const f = (_u: unknown, init: { signal: AbortSignal }) =>
      new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))));
    await expect(fetchListingHtml("https://www.zoopla.co.uk/for-sale/details/1/", { fetchImpl: f as never, timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
  });

  it("importFromUrl rejects non-portal hosts without fetching", async () => {
    const f = vi.fn();
    await expect(importFromUrl("https://evil.example/x", { fetchImpl: f as never })).rejects.toBeInstanceOf(ImportError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("paste-text fallback and conversions", () => {
  it("parses pasted listing text", () => {
    const r = importFromText(
      "Ramsden Road, Balham, London SW12 9QT\nGuide price £710,000\n2 bedrooms 2 bathrooms\nSize: 79.9 sq m\nLeasehold. 104 years remaining\nService charge: £1,850 per year\nCouncil tax band: C",
    );
    expect(r.draft).toMatchObject({ asking_price: 710000, beds: 2, baths: 2, tenure: "leasehold", lease_years: 104, service_charge: 1850, council_tax_band: "C", price_qualifier: "guide", postcode: "SW12 9QT" });
    expect(r.draft.floor_area_sqft).toBe(860);
    expect(r.draft.address).toMatch(/Ramsden Road/);
  });
  it("converts between m² and sq ft (FR-I7)", () => {
    expect(sqmToSqft(81.8)).toBe(880);
    expect(sqftToSqm(880)).toBe(81.8);
  });
  it("recognises full and partial postcodes", () => {
    expect(postcodeFrom("Flat 2, Elsynge Rd SW18 2HW")).toBe("SW18 2HW");
    expect(postcodeFrom("Balham SW12")).toBe("SW12");
  });
});
