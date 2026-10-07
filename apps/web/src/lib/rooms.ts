import type { Property } from "./types";

export const RATING_WORDS = ["", "Poor", "Weak", "OK", "Good", "Excellent"] as const;

export interface RatingItem {
  key: string;
  label: string;
  /** Rooms can be marked "Not here"; quality items cannot. */
  optional?: boolean;
}

/** Rooms are pre-listed from the bedroom and bathroom count (PRD S5). */
export function roomItems(p: Pick<Property, "beds" | "baths">): RatingItem[] {
  const beds = Math.max(0, p.beds ?? 1);
  const baths = Math.max(1, Math.ceil(p.baths ?? 1));
  const items: RatingItem[] = [{ key: "living_room", label: "Living room" }, { key: "kitchen", label: "Kitchen" }];
  for (let i = 1; i <= beds; i++) items.push({ key: `bedroom_${i}`, label: beds === 1 ? "Bedroom" : `Bedroom ${i}` });
  items.push({ key: "bathrooms", label: baths > 1 ? "Main bathroom" : "Bathroom" });
  for (let i = 2; i <= baths; i++) items.push({ key: `bathroom_${i}`, label: i === 2 ? "En suite" : `Bathroom ${i}`, optional: true });
  items.push({ key: "outdoor", label: "Outdoor space", optional: true }, { key: "storage", label: "Storage", optional: true });
  return items;
}

export const QUALITY_ITEMS: RatingItem[] = [
  { key: "light", label: "Natural light" },
  { key: "condition", label: "Condition and work needed" },
  { key: "noise", label: "Quiet inside (noise)" },
  { key: "layout", label: "Layout" },
];

export const STREET_ITEM: RatingItem = { key: "street", label: "Street and neighbourhood feel" };

export const SPACE_QUESTIONS = [
  { key: "space_living", label: "Is the living room big enough for how we live?" },
  { key: "space_kitchen", label: "Is the kitchen big enough to cook and eat?" },
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  station: "Station",
  park: "Park",
  supermarket: "Supermarket",
  convenience: "Convenience store",
  gym: "Gym",
  restaurants: "Restaurants",
};

export const CRITERION_OPTIONS = [
  ["budget", "Budget"], ["station", "Station"], ["space", "Space"], ["park", "Park"], ["supermarket", "Supermarket"], ["rest", "Rest of the home"], ["extras", "Gym and restaurants"], ["gut", "Gut feel"],
] as const;
