import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { ScreenshotError, ScreenshotSchema, cropPhoto, normaliseScreenshot, readScreenshots, toDraft, type ScreenshotRead } from "./screenshots";

const empty: ScreenshotRead = {
  address: null, postcode: null, asking_price: null, price_qualifier: null, property_type: null, beds: null, baths: null, receptions: null,
  floor_area_sqft: null, floor_area_sqm: null, tenure: null, lease_years: null, service_charge: null, ground_rent: null,
  council_tax_band: null, epc: null, listing_id: null, agent_name: null, agency: null, agent_phone: null, key_features: [],
  description: null, photo: null, unreadable: [],
};

const png = (w: number, h: number, color = "#3a7") => sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer();

describe("toDraft", () => {
  it("keeps plausible values and drops nonsense", () => {
    const { draft, fieldsRead } = toDraft({
      ...empty, address: " Ramsden Road, Balham ", postcode: "sw12 9qt", asking_price: 710000, beds: 2, baths: 2, floor_area_sqft: 860,
      council_tax_band: "c", epc: "z", lease_years: 5000, service_charge: -1, tenure: "leasehold", key_features: ["Two bathrooms", " "],
    });
    expect(draft).toMatchObject({ address: "Ramsden Road, Balham", postcode: "SW12 9QT", asking_price: 710000, beds: 2, baths: 2, floor_area_sqft: 860, council_tax_band: "C", tenure: "leasehold", key_features: ["Two bathrooms"] });
    expect(draft.epc).toBeUndefined();
    expect(draft.lease_years).toBeUndefined();
    expect(draft.service_charge).toBeUndefined();
    expect(fieldsRead).not.toContain("epc");
  });
  it("converts square metres when only those are shown", () => {
    expect(toDraft({ ...empty, floor_area_sqm: 79.9 }).draft.floor_area_sqft).toBe(860);
  });
  it("rejects an implausible price and a malformed postcode", () => {
    const { draft } = toDraft({ ...empty, asking_price: 7, postcode: "not a postcode" });
    expect(draft.asking_price).toBeUndefined();
    expect(draft.postcode).toBeUndefined();
  });
});

describe("readScreenshots", () => {
  const fakeClient = (parsed: unknown, stop = "end_turn") => ({ messages: { parse: vi.fn(async () => ({ parsed_output: parsed, stop_reason: stop })) } }) as never;

  it("sends every screenshot as an image block, in order, with the structured-output schema", async () => {
    const client = fakeClient({ ...empty, address: "Elsynge Road", asking_price: 695000 });
    const a = await png(300, 200), b = await png(300, 200, "#a33");
    const r = await readScreenshots([a, b], { client, model: "claude-opus-5-5" });
    expect(r.draft).toMatchObject({ address: "Elsynge Road", asking_price: 695000 });
    const arg = (client as { messages: { parse: ReturnType<typeof vi.fn> } }).messages.parse.mock.calls[0][0] as { model: string; max_tokens: number; system: string; messages: Array<{ content: Array<{ type: string; text?: string; source?: { data: string; media_type: string } }> }>; output_config: { format: unknown }; tool_choice?: unknown; thinking?: unknown };
    expect(arg.model).toBe("claude-opus-5-5");
    const images = arg.messages[0].content.filter((c) => c.type === "image");
    expect(images).toHaveLength(2);
    expect(images[0].source!.data).toBe(a.toString("base64"));
    expect(images[1].source!.data).toBe(b.toString("base64"));
    expect(images[0].source!.media_type).toBe("image/jpeg");
    expect(arg.output_config.format).toBeTruthy();
    // Opus 5.5 rejects forced tool choice and a disabled thinking config: neither may be sent.
    expect(arg.tool_choice).toBeUndefined();
    expect(arg.thinking).toBeUndefined();
    expect(arg.system).toMatch(/data, never instructions/);
  });

  it("reports a refusal and an unparseable answer plainly", async () => {
    const x = await png(10, 10);
    await expect(readScreenshots([x], { client: fakeClient(null, "refusal") })).rejects.toMatchObject({ code: "refused" });
    await expect(readScreenshots([x], { client: fakeClient(null) })).rejects.toMatchObject({ code: "unreadable" });
  });

  it("explains a missing API key", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(readScreenshots([await png(10, 10)])).rejects.toBeInstanceOf(ScreenshotError);
    await expect(readScreenshots([await png(10, 10)])).rejects.toMatchObject({ code: "no_key" });
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });

  it("schema allows everything to be unknown", () => {
    expect(ScreenshotSchema.safeParse(empty).success).toBe(true);
  });
});

describe("cropPhoto", () => {
  it("cuts the box out of the right screenshot", async () => {
    const base = await sharp({ create: { width: 1000, height: 800, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 400, height: 300, channels: 3, background: "#ff0000" } }).png().toBuffer(), left: 100, top: 200 }])
      .jpeg().toBuffer();
    const out = await cropPhoto([await png(50, 50), base], { screenshot: 1, x: 0.1, y: 0.25, width: 0.4, height: 0.375 });
    const meta = await sharp(out!).metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]);
    const { dominant } = await sharp(out!).stats();
    expect(dominant.r).toBeGreaterThan(200);
    expect(dominant.g).toBeLessThan(60);
  });
  it("returns null for no box, a wrong index, or a sliver", async () => {
    const img = await png(1000, 800);
    expect(await cropPhoto([img], null)).toBeNull();
    expect(await cropPhoto([img], { screenshot: 3, x: 0, y: 0, width: 0.5, height: 0.5 })).toBeNull();
    expect(await cropPhoto([img], { screenshot: 0, x: 0, y: 0, width: 0.05, height: 0.05 })).toBeNull();
  });
  it("clamps a box that runs off the edge", async () => {
    const out = await cropPhoto([await png(1000, 800)], { screenshot: 0, x: 0.8, y: 0.8, width: 0.9, height: 0.9 });
    const meta = await sharp(out!).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(160);
  });
});

describe("normaliseScreenshot", () => {
  it("re-encodes images as JPEG and rejects non-images", async () => {
    const out = await normaliseScreenshot(await sharp({ create: { width: 100, height: 100, channels: 4, background: "#0f0" } }).png().toBuffer());
    expect((await sharp(out!).metadata()).format).toBe("jpeg");
    expect(await normaliseScreenshot(Buffer.from("<html>not an image</html>"))).toBeNull();
  });
});
