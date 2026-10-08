import { describe, expect, it } from "vitest";
import { bestPhone, isEmail, looksLikeMobile, telHref } from "./format";

describe("telHref", () => {
  it("cleans UK numbers into something a phone dials", () => {
    expect(telHref("020 7123 4567")).toBe("02071234567");
    expect(telHref("(020) 7123-4567")).toBe("02071234567");
    expect(telHref("07700 900123")).toBe("07700900123");
  });
  it("normalises international prefixes and drops (0)", () => {
    expect(telHref("+44 (0)20 7123 4567")).toBe("+442071234567");
    expect(telHref("0044 20 7123 4567")).toBe("+442071234567");
  });
  it("ignores an extension and refuses things that aren't numbers", () => {
    expect(telHref("020 7123 4567 ext. 12")).toBe("02071234567");
    expect(telHref("call the office")).toBeNull();
    expect(telHref("123")).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
  });
});

describe("bestPhone", () => {
  it("prefers a dialable mobile, falls back to the office line", () => {
    expect(bestPhone({ mobile: "07700 900123", phone: "020 7123 4567" })).toBe("07700 900123");
    expect(bestPhone({ mobile: "n/a", phone: "020 7123 4567" })).toBe("020 7123 4567");
    expect(bestPhone({ mobile: null, phone: null })).toBeNull();
  });
});

describe("isEmail", () => {
  it("accepts ordinary addresses only", () => {
    expect(isEmail("sam@dwellings.co.uk")).toBe(true);
    expect(isEmail(" sam@dwellings.co.uk ")).toBe(true);
    expect(isEmail("sam@dwellings")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

describe("looksLikeMobile", () => {
  it("spots UK mobiles but not landlines", () => {
    expect(looksLikeMobile("07700 900123")).toBe(true);
    expect(looksLikeMobile("+44 7700 900123")).toBe(true);
    expect(looksLikeMobile("020 7123 4567")).toBe(false);
    expect(looksLikeMobile("")).toBe(false);
  });
});
