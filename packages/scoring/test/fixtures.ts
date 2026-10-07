import {
  DEFAULT_CONFIG,
  type ScoreAssessment,
  type ScoreInput,
  type ScoreProCon,
  type ScoreProperty,
  type ScoreProximity,
} from "../src";

export const A = "buyer-a";
export const B = "buyer-b";

export const worked: { property: ScoreProperty; proximity: ScoreProximity } = {
  property: { askingPrice: 735_000, priceQualifier: "guide", floorAreaSqft: 880, offers: [], manuallyRuledOut: false },
  proximity: { station: 9, park: 4, supermarket: 12, gym: 8, restaurants: 6 },
};

/** PRD 6.7. Buyer A rates 4,3,4,3 for space and a mean of 3.5 for the rest. */
export const assessA: ScoreAssessment = {
  memberId: A,
  submitted: true,
  ratings: { living_room: 4, kitchen: 3, bedroom_1: 4, bedroom_2: 3, bathrooms: 4, outdoor: 3, storage: 3.5 as number },
  spaceLiving: 4,
  spaceKitchen: 3,
  gutFeel: 4,
};
export const assessB: ScoreAssessment = {
  memberId: B,
  submitted: true,
  ratings: { living_room: 3, kitchen: 3, bedroom_1: 3, bathrooms: 3, outdoor: 3, storage: 3 },
  spaceLiving: 3,
  spaceKitchen: 3,
  gutFeel: 3,
};
// Buyer A's rest-of-home mean must be 3.5: (4+3+4+3+3.5)/5 = 3.5
assessA.ratings = { living_room: 4, kitchen: 3, bedroom_1: 4, bedroom_2: 3, bathrooms: 3.5 as number, outdoor: 4, storage: 3 };

export const prosConsA: ScoreProCon[] = [
  { memberId: A, kind: "pro", impact: "major", criterion: null, dealBreaker: false },
  { memberId: A, kind: "pro", impact: "minor", criterion: null, dealBreaker: false },
  { memberId: A, kind: "con", impact: "moderate", criterion: "space", dealBreaker: false },
  { memberId: A, kind: "con", impact: "major", criterion: null, dealBreaker: false },
];
export const prosConsB: ScoreProCon[] = [
  { memberId: B, kind: "pro", impact: "major", criterion: null, dealBreaker: false },
  { memberId: B, kind: "con", impact: "major", criterion: null, dealBreaker: false },
  { memberId: B, kind: "con", impact: "moderate", criterion: null, dealBreaker: false },
];

export const workedInput = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  ...worked,
  assessments: [assessA, assessB],
  prosCons: [...prosConsA, ...prosConsB],
  memberIds: [A, B],
  config: DEFAULT_CONFIG,
  ...over,
});
