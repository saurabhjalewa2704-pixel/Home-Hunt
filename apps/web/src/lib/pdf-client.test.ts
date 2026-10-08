import { describe, expect, it } from "vitest";
import { isPdf, pickPages } from "./pdf-client";

describe("pickPages", () => {
  it("uses every page of a short PDF", () => {
    expect(pickPages(1)).toEqual([1]);
    expect(pickPages(6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("takes the first five and the last of a long brochure", () => {
    expect(pickPages(20)).toEqual([1, 2, 3, 4, 5, 20]);
  });
  it("respects a smaller allowance", () => {
    expect(pickPages(20, 3)).toEqual([1, 2, 20]);
    expect(pickPages(20, 1)).toEqual([1]);
  });
});

describe("isPdf", () => {
  it("recognises a PDF by type or by name", () => {
    expect(isPdf({ type: "application/pdf", name: "x" })).toBe(true);
    expect(isPdf({ type: "", name: "Brochure.PDF" })).toBe(true);
    expect(isPdf({ type: "image/png", name: "a.png" })).toBe(false);
  });
});
