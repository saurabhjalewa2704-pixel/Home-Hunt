import { describe, expect, it } from "vitest";
import { decide, versionUrl, canCheck } from "./update";

const own = { build: "aaa1111", builtAt: "2026-10-12T10:00:00.000Z" };
const newer = { build: "bbb2222", builtAt: "2026-10-12T15:00:00.000Z" };
const here = { origin: "https://home-hunt-abc123-me.vercel.app", path: "/mortgage/scenarios?x=1#top" };
const live = "https://home-hunt.vercel.app";

describe("decide", () => {
  it("does nothing when the live build is the one running", () => {
    expect(decide(own, { ...own, builtAt: "2026-10-13T00:00:00Z" }, here, live).available).toBe(false); // same commit redeployed
  });
  it("does nothing when the live build is older, so a preview of newer work never nags", () => {
    expect(decide(own, { build: "old0000", builtAt: "2026-10-01T00:00:00Z" }, here, live).available).toBe(false);
    expect(decide(own, { build: "", builtAt: "" }, here, live).available).toBe(false);
  });
  it("on an old address, a newer live build means: open the live address on the same page", () => {
    expect(decide(own, newer, here, live)).toEqual({ available: true, action: "open", target: "https://home-hunt.vercel.app/mortgage/scenarios?x=1#top" });
  });
  it("on the live address itself, a newer build means: reload", () => {
    expect(decide(own, newer, { origin: live, path: "/" }, live)).toEqual({ available: true, action: "reload", target: null });
  });
  it("without a known live address it reloads this page", () => {
    expect(decide(own, newer, here, "")).toMatchObject({ available: true, action: "reload" });
    expect(decide(own, newer, here, "not a url")).toMatchObject({ action: "reload" });
  });
});

describe("helpers", () => {
  it("asks the live address, or this one when unknown", () => {
    expect(versionUrl("https://home-hunt.vercel.app")).toBe("https://home-hunt.vercel.app/api/version");
    expect(versionUrl("")).toBe("/api/version");
  });
  it("a development build can't check", () => {
    expect(canCheck({ build: "local", builtAt: "2026-10-12T00:00:00Z" })).toBe(false);
    expect(canCheck({ build: "abc1234", builtAt: "" })).toBe(false);
    expect(canCheck({ build: "abc1234", builtAt: "2026-10-12T00:00:00Z" })).toBe(true);
  });
});
