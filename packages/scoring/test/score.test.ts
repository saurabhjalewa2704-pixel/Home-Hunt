import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, effectivePrice, interpolate, score, stampDuty, tierFor, totalWeight } from "../src";
import { A, B, assessA, assessB, prosConsA, worked, workedInput } from "./fixtures";

// Round half away from zero, as the PRD does (-0.25 shows as -0.3).
const r1 = (n: number) => Math.sign(n) * Math.round(Math.abs(n) * 10) / 10;
const pts = (m: ReturnType<typeof score>["memberScores"][string], key: string) =>
  r1(m.lines.find((l) => l.key === key)!.points!);

describe("golden test: PRD 6.7 worked example", () => {
  const res = score(workedInput());

  it("reproduces the line-by-line points for buyer A", () => {
    const a = res.memberScores[A];
    expect(pts(a, "budget")).toBe(13.5);
    expect(pts(a, "station")).toBe(17.6);
    expect(pts(a, "space")).toBe(14.1);
    expect(pts(a, "park")).toBe(12.0);
    expect(pts(a, "supermarket")).toBe(7.1);
    expect(pts(a, "rest")).toBe(5.0);
    expect(pts(a, "extras")).toBe(3.5);
    expect(pts(a, "gut")).toBe(3.0);
    expect(r1(a.subtotal)).toBe(75.8);
  });

  it("reproduces buyer B's points", () => {
    const b = res.memberScores[B];
    expect(pts(b, "space")).toBe(12.6);
    expect(pts(b, "rest")).toBe(4.0);
    expect(pts(b, "gut")).toBe(2.0);
    expect(r1(b.subtotal)).toBe(72.3);
  });

  it("applies the pros and cons adjustment", () => {
    expect(r1(res.memberScores[A].prosConsAdjustment)).toBe(-0.3);
    expect(r1(res.memberScores[B].prosConsAdjustment)).toBe(-2.5);
  });

  it("gives 75.5, 69.8 and combined 72.6 in Strong contender", () => {
    expect(r1(res.memberScores[A].score)).toBe(75.5);
    expect(r1(res.memberScores[B].score)).toBe(69.8);
    expect(r1(res.combined)).toBe(72.6);
    expect(res.tier).toBe("strong");
    expect(res.provisional).toBe(false);
    expect(res.softGates).toEqual([]);
    expect(res.hardGate).toBeNull();
  });

  it("does not flag disagreement for a 5.8 point gap", () => {
    expect(res.disagreement).toBe(false);
    expect(r1(res.disagreementPoints)).toBe(5.8);
  });

  it("leaves £15,000 headroom", () => {
    expect(res.headroom).toBe(15_000);
  });

  it("would place buyer B alone in Maybe", () => {
    expect(tierFor(res.memberScores[B].score, false, DEFAULT_CONFIG)).toBe("maybe");
  });
});

describe("curves: every breakpoint", () => {
  const c = DEFAULT_CONFIG.curves;
  it.each([
    ["station", c.station, [[0, 1], [5, 1], [10, 0.85], [15, 0.6], [20, 0.1], [25, 0], [40, 0]]],
    ["park", c.park, [[3, 1], [5, 1], [10, 0.7], [15, 0.3], [20, 0], [30, 0]]],
    ["supermarket", c.supermarket, [[5, 1], [10, 0.75], [15, 0.35], [25, 0], [20, 0.175]]],
    ["gym/restaurants", c.gymRestaurants, [[5, 1], [10, 0.7], [20, 0.2], [30, 0]]],
    ["area", c.area, [[400, 0.1], [550, 0.1], [650, 0.4], [800, 0.7], [1000, 1], [1500, 1]]],
    ["budget", DEFAULT_CONFIG.budgetCurve, [[600_000, 1], [650_000, 1], [700_000, 0.85], [750_000, 0.6]]],
  ] as const)("%s", (_n, curve, cases) => {
    for (const [x, y] of cases) expect(interpolate(curve, x)).toBeCloseTo(y, 6);
  });

  it("interpolates between breakpoints", () => {
    expect(interpolate(DEFAULT_CONFIG.curves.station, 9)).toBeCloseTo(0.88, 6);
    expect(interpolate(DEFAULT_CONFIG.curves.supermarket, 12)).toBeCloseTo(0.59, 6);
  });

  it("default weights add to 100", () => {
    expect(totalWeight(DEFAULT_CONFIG)).toBe(100);
  });
});

describe("pros and cons", () => {
  it("caps the net adjustment at +10 and -10", () => {
    const many = (kind: "pro" | "con") =>
      Array.from({ length: 6 }, () => ({ memberId: A, kind, impact: "major" as const, criterion: null, dealBreaker: false }));
    const up = score(workedInput({ prosCons: many("pro") }));
    const down = score(workedInput({ prosCons: many("con").map((x) => ({ ...x, dealBreaker: false })) }));
    expect(up.memberScores[A].prosConsAdjustment).toBe(10);
    expect(down.memberScores[A].prosConsAdjustment).toBe(-10);
  });

  it("counts a criterion-linked bullet at half value", () => {
    const linked = score(workedInput({ prosCons: [{ memberId: A, kind: "con", impact: "major", criterion: "space", dealBreaker: false }] }));
    const plain = score(workedInput({ prosCons: [{ memberId: A, kind: "con", impact: "major", criterion: null, dealBreaker: false }] }));
    expect(linked.memberScores[A].prosConsAdjustment).toBe(-2.5);
    expect(plain.memberScores[A].prosConsAdjustment).toBe(-5);
  });

  it("only counts a buyer's own bullets towards their score", () => {
    const res = score(workedInput({ prosCons: prosConsA }));
    expect(res.memberScores[B].prosConsAdjustment).toBe(0);
  });
});

describe("soft gates", () => {
  const withProx = (p: object) => score(workedInput({ proximity: { ...worked.proximity, ...p } }));

  it.each(["station", "park", "supermarket"] as const)("%s over 15 min subtracts 5 and caps the tier", (key) => {
    const base = score(workedInput());
    const res = withProx({ [key]: 16 });
    expect(res.softGates).toContain(key);
    expect(res.memberScores[A].softGates).toContain(key);
    expect(res.combined).toBeLessThan(base.combined - 5 + 0.0001);
  });

  it("does not trigger at exactly 15 minutes", () => {
    expect(withProx({ station: 15 }).softGates).toEqual([]);
  });

  it("caps a score of 80+ at Strong contender", () => {
    expect(tierFor(85, true, DEFAULT_CONFIG)).toBe("strong");
    expect(tierFor(85, false, DEFAULT_CONFIG)).toBe("top_pick");
    expect(tierFor(80, false, DEFAULT_CONFIG)).toBe("top_pick");
    expect(tierFor(79.9, false, DEFAULT_CONFIG)).toBe("strong");
    expect(tierFor(70, false, DEFAULT_CONFIG)).toBe("strong");
    expect(tierFor(69.9, false, DEFAULT_CONFIG)).toBe("maybe");
    expect(tierFor(55, false, DEFAULT_CONFIG)).toBe("maybe");
    expect(tierFor(54.9, false, DEFAULT_CONFIG)).toBe("unlikely");
  });

  it("flags poor space ratings (R <= 0.25)", () => {
    const poor = { ...assessA, ratings: { ...assessA.ratings, living_room: 2, kitchen: 1 }, spaceLiving: 2, spaceKitchen: 2 };
    const res = score(workedInput({ assessments: [poor, assessB] }));
    expect(res.memberScores[A].softGates).toContain("space");
    expect(res.memberScores[B].softGates).not.toContain("space");
    expect(res.softGates).toContain("space");
  });

  it("shows an amber flag with no penalty between 10 and 15 minutes", () => {
    const res = score(workedInput());
    expect(res.amberFlags).toEqual(["supermarket"]);
    expect(res.softGates).toEqual([]);
  });

  it("gives the convenience-store bonus when the supermarket is over 10 min", () => {
    const base = score(workedInput());
    const bonus = score(workedInput({ proximity: { ...worked.proximity, convenience: 4 } }));
    const d = bonus.memberScores[A].lines.find((l) => l.key === "supermarket")!.sub! - base.memberScores[A].lines.find((l) => l.key === "supermarket")!.sub!;
    expect(d).toBeCloseTo(0.1, 6);
  });
});

describe("hard gates", () => {
  it("rules out an asking price over the limit but keeps the score", () => {
    const res = score(workedInput({ property: { ...worked.property, askingPrice: 775_000 } }));
    expect(res.hardGate?.reason).toBe("over_budget");
    expect(res.tier).toBe("ruled_out");
    expect(res.combined).toBeGreaterThan(0);
  });

  it("returns to active when an offer at or under the limit is accepted", () => {
    const res = score(
      workedInput({ property: { ...worked.property, askingPrice: 775_000, offers: [{ amount: 740_000, outcome: "accepted" }] } }),
    );
    expect(res.hardGate).toBeNull();
    expect(res.effectivePrice).toBe(740_000);
  });

  it("does not gate an 'offers over' listing on its uplifted price", () => {
    const res = score(workedInput({ property: { ...worked.property, askingPrice: 745_000, priceQualifier: "offers_over" } }));
    expect(res.hardGate).toBeNull();
    // sub-score uses asking + 2%, capped at the limit
    expect(res.memberScores[A].lines[0].sub).toBeCloseTo(0.6, 6);
  });

  it("rules out on a deal-breaker from either buyer", () => {
    const res = score(
      workedInput({ prosCons: [{ memberId: B, kind: "con", impact: "major", criterion: null, dealBreaker: true }] }),
    );
    expect(res.hardGate?.reason).toBe("deal_breaker");
    expect(res.tier).toBe("ruled_out");
  });

  it("rules out manually", () => {
    const res = score(workedInput({ property: { ...worked.property, manuallyRuledOut: true } }));
    expect(res.hardGate?.reason).toBe("manual");
  });

  it("re-scores budget against the latest offer", () => {
    const res = score(workedInput({ property: { ...worked.property, offers: [{ amount: 700_000, outcome: "pending" }] } }));
    expect(effectivePrice({ ...worked.property, offers: [{ amount: 700_000, outcome: "pending" }] })).toBe(700_000);
    expect(res.memberScores[A].lines[0].sub).toBeCloseTo(0.85, 6);
  });
});

describe("provisional and partial scoring", () => {
  it("scores from objective data only and says what is missing", () => {
    const res = score(workedInput({ assessments: [], prosCons: [] }));
    expect(res.provisional).toBe(true);
    expect(res.ratedCount).toBe(0);
    expect(res.missing).toEqual(expect.arrayContaining(["Rest of the home", "Gut feel"]));
    // available points / available weights * 100
    const m = Object.values(res.memberScores)[0];
    const sumPts = m.lines.reduce((s, l) => s + (l.points ?? 0), 0);
    const sumW = m.lines.filter((l) => l.points !== null).reduce((s, l) => s + l.weight, 0);
    expect(res.combined).toBeCloseTo((sumPts / sumW) * 100, 6);
  });

  it("uses floor area alone for provisional space", () => {
    const res = score(workedInput({ assessments: [], prosCons: [] }));
    const space = Object.values(res.memberScores)[0].lines.find((l) => l.key === "space")!;
    expect(space.sub).toBeCloseTo(0.82, 6);
  });

  it("with one buyer rated, the combined score is that buyer's score", () => {
    const res = score(workedInput({ assessments: [assessA], prosCons: prosConsA }));
    expect(res.ratedCount).toBe(1);
    expect(res.provisional).toBe(false);
    expect(res.combined).toBe(res.memberScores[A].score);
    expect(res.disagreement).toBe(false);
  });

  it("ignores unsubmitted assessments", () => {
    const res = score(workedInput({ assessments: [{ ...assessA, submitted: false }, assessB] }));
    expect(res.ratedCount).toBe(1);
  });

  it("uses ratings alone for space when floor area is unknown", () => {
    const res = score(workedInput({ property: { ...worked.property, floorAreaSqft: null } }));
    expect(res.memberScores[A].lines.find((l) => l.key === "space")!.sub).toBeCloseTo(0.625, 6);
  });
});

describe("disagreement", () => {
  it("flags a gap of 10 points or more", () => {
    const keen = { ...assessB, ratings: Object.fromEntries(Object.keys(assessB.ratings).map((k) => [k, 1])), spaceLiving: 1, spaceKitchen: 1, gutFeel: 1 };
    const res = score(workedInput({ assessments: [assessA, keen] }));
    expect(res.disagreement).toBe(true);
    expect(res.disagreementPoints).toBeGreaterThanOrEqual(10);
  });
});

describe("stamp duty", () => {
  it.each([
    [650_000, 22_500],
    [695_000, 24_750],
    [735_000, 26_750],
    [750_000, 27_500],
  ])("standard rates apply above the first-time-buyer cap: %i", (price, expected) => {
    expect(stampDuty(price, DEFAULT_CONFIG.sdlt, true)).toBe(expected);
  });
  it("applies first-time relief at or under £500,000", () => {
    expect(stampDuty(300_000, DEFAULT_CONFIG.sdlt, true)).toBe(0);
    expect(stampDuty(450_000, DEFAULT_CONFIG.sdlt, true)).toBe(7_500);
    expect(stampDuty(450_000, DEFAULT_CONFIG.sdlt, false)).toBe(12_500);
  });
});
