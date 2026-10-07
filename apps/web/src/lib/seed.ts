import { DEFAULT_CONFIG } from "@homehunt/scoring";
import type { Agent, Assessment, Data, Offer, ProCon, Property, Proximity, Status, Viewing } from "./types";

export const HOUSEHOLD_ID = "h-demo";
export const SAURABH = "m-saurabh";
export const VEDIKA = "m-vedika";

export function emptyData(): Data {
  const created = new Date().toISOString();
  return {
    household: { id: HOUSEHOLD_ID, name: "Saurabh and Vedika", created_at: created },
    members: [
      { id: SAURABH, household_id: HOUSEHOLD_ID, display_name: "Saurabh", colour: "#2B5C8A" },
      { id: VEDIKA, household_id: HOUSEHOLD_ID, display_name: "Vedika", colour: "#7A3E8E" },
    ],
    scoring_config: [{ id: "cfg-1", household_id: HOUSEHOLD_ID, version: 1, config: DEFAULT_CONFIG, buyer_type: "first_time" }],
    properties: [],
    status_events: [],
    agents: [],
    viewings: [],
    assessments: [],
    pro_cons: [],
    proximity: [],
    offers: [],
    notes: [],
    photos: [],
    score_snapshots: [],
  };
}

/** The next Saturday at or after `from` (today counts), at the given local time. */
function saturday(from: Date, h: number, m: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  d.setHours(h, m, 0, 0);
  return d;
}
function daysAgo(from: Date, n: number, h = 11, m = 0): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}

interface HomeSpec {
  key: string;
  status: Status;
  address: string;
  postcode: string;
  price: number;
  qualifier?: Property["price_qualifier"];
  beds: number;
  baths: number;
  area: number;
  type: string;
  tenure: Property["tenure"];
  lease?: number;
  tax: string;
  epc: string;
  tint: string;
  agent: string;
  lat: number;
  lng: number;
  prox: Array<[Proximity["category"], string, number, ("manual" | "auto")?]>;
  features: string[];
}

/**
 * Sample homes mirror the approved mock-ups: seven London homes across tiers
 * plus one over budget. Bolingbroke Grove reproduces PRD section 6.7 exactly.
 */
export function sampleData(now = new Date()): Data {
  const d = emptyData();
  const at = (date: Date) => date.toISOString();
  const T = now.toISOString();

  const agents: Agent[] = [
    { id: "a-priya", household_id: HOUSEHOLD_ID, name: "Priya Shah", agency: "Sutton and Hale", branch: "Northcote Road", phone: "020 7946 0321", mobile: null, email: "priya@suttonhale.example", notes: null },
    { id: "a-amira", household_id: HOUSEHOLD_ID, name: "Amira Khan", agency: "Common Lane Estates", branch: "Wandsworth", phone: "020 7946 0114", mobile: "07700 900114", email: "amira@commonlane.example", notes: "Prefers calls before 5pm" },
    { id: "a-tom", household_id: HOUSEHOLD_ID, name: "Tom Reid", agency: "Kinleigh Park", branch: "Balham", phone: "020 7946 0875", mobile: null, email: "tom@kinleighpark.example", notes: null },
    { id: "a-dev", household_id: HOUSEHOLD_ID, name: "Dev Patel", agency: "Highfield & Co", branch: "Tooting", phone: "020 7946 0402", mobile: null, email: null, notes: null },
    { id: "a-grace", household_id: HOUSEHOLD_ID, name: "Grace Obi", agency: "Thurleigh Homes", branch: "Balham", phone: "020 7946 0733", mobile: null, email: null, notes: null },
  ];
  d.agents = agents;

  const homes: HomeSpec[] = [
    { key: "elsynge", status: "second_viewing", address: "Elsynge Road, Wandsworth Common, London SW18", postcode: "SW18 2HW", price: 695000, beds: 2, baths: 1, area: 812, type: "Flat", tenure: "share_of_freehold", tax: "C", epc: "D", tint: "#C8D6CF", agent: "a-amira", lat: 51.4549, lng: -0.1869,
      prox: [["station", "Wandsworth Common", 8], ["park", "Wandsworth Common", 3], ["supermarket", "Sainsbury's Local", 6], ["gym", "Gym Group", 7], ["restaurants", "Bellevue Road", 5]], features: ["Bay-windowed living room", "Two minutes to the common"] },
    { key: "fircroft", status: "viewed", address: "Fircroft Road, Tooting Bec, London SW17", postcode: "SW17 7PP", price: 650000, qualifier: "offers_over", beds: 2, baths: 1, area: 740, type: "Flat", tenure: "leasehold", lease: 118, tax: "D", epc: "C", tint: "#C9D3DE", agent: "a-dev", lat: 51.4272, lng: -0.1676,
      prox: [["station", "Tooting Bec", 11], ["park", "Tooting Common", 2], ["supermarket", "Tesco", 5], ["gym", "PureGym", 9], ["restaurants", "Upper Tooting Road", 6]], features: ["New kitchen", "Opposite Tooting Common"] },
    { key: "bolingbroke", status: "viewed", address: "Bolingbroke Grove, Battersea, London SW11", postcode: "SW11 6HG", price: 735000, beds: 2, baths: 1, area: 880, type: "Flat", tenure: "leasehold", lease: 92, tax: "E", epc: "C", tint: "#D6CFC4", agent: "a-priya", lat: 51.4651, lng: -0.1698,
      prox: [["station", "Clapham Junction", 9], ["park", "Wandsworth Common", 4], ["supermarket", "Sainsbury's", 12, "manual"], ["gym", "PureGym", 8], ["restaurants", "Northcote Road", 6]], features: ["South-facing garden", "Quiet street"] },
    { key: "brixton", status: "viewed", address: "Brixton Hill, Brixton, London SW2", postcode: "SW2 1RD", price: 640000, beds: 2, baths: 1, area: 690, type: "Flat", tenure: "leasehold", lease: 104, tax: "C", epc: "D", tint: "#D9D2DD", agent: "a-dev", lat: 51.4504, lng: -0.1166,
      prox: [["station", "Brixton", 17], ["park", "Brockwell Park", 6], ["supermarket", "Lidl", 4], ["gym", "Fitness First", 6], ["restaurants", "Brixton Village", 3]], features: ["Good light"] },
    { key: "wellfield", status: "viewed", address: "Wellfield Road, Streatham, London SW16", postcode: "SW16 2BS", price: 660000, beds: 3, baths: 1, area: 610, type: "Maisonette", tenure: "leasehold", lease: 84, tax: "C", epc: "E", tint: "#D2D8C8", agent: "a-dev", lat: 51.4208, lng: -0.1306,
      prox: [["station", "Streatham Common", 14], ["park", "Streatham Common", 12], ["supermarket", "Morrisons", 13], ["gym", "Gym Group", 14], ["restaurants", "Streatham High Road", 12]], features: ["Big garden"] },
    { key: "ramsden", status: "viewing_booked", address: "Ramsden Road, Balham, London SW12", postcode: "SW12", price: 710000, qualifier: "guide", beds: 2, baths: 2, area: 860, type: "Flat", tenure: "leasehold", tax: "C", epc: "", tint: "#CFD9D3", agent: "a-tom", lat: 51.4443, lng: -0.1527,
      prox: [["station", "Balham", 6], ["park", "Tooting Bec Common", 5], ["supermarket", "Waitrose", 3], ["gym", "PureGym", 5], ["restaurants", "Bedford Hill", 4]], features: ["Two bathrooms"] },
    { key: "thurleigh", status: "viewing_booked", address: "Thurleigh Road, Balham, London SW12", postcode: "SW12 8UB", price: 725000, beds: 2, baths: 1, area: 790, type: "Flat", tenure: "leasehold", lease: 120, tax: "D", epc: "C", tint: "#D2D8C8", agent: "a-grace", lat: 51.4509, lng: -0.1488,
      prox: [["station", "Clapham South", 9], ["park", "Clapham Common", 4], ["supermarket", "M&S Food", 7], ["gym", "Third Space", 8], ["restaurants", "Balham High Road", 5]], features: [] },
    { key: "grafton", status: "ruled_out", address: "Grafton Square, Clapham, London SW4", postcode: "SW4 0DB", price: 775000, beds: 2, baths: 1, area: 900, type: "Flat", tenure: "leasehold", lease: 140, tax: "E", epc: "C", tint: "#DAD6CE", agent: "a-priya", lat: 51.4636, lng: -0.1362,
      prox: [["station", "Clapham Common", 7], ["park", "Clapham Common", 3], ["supermarket", "Sainsbury's", 6], ["gym", "Gym Group", 8], ["restaurants", "Clapham High Street", 4]], features: [] },
  ];

  const ids: Record<string, string> = {};
  for (const h of homes) {
    const id = `p-${h.key}`;
    ids[h.key] = id;
    d.properties.push({
      id,
      household_id: HOUSEHOLD_ID,
      status: h.status,
      portal: h.key === "ramsden" ? "rightmove" : h.key === "fircroft" ? "zoopla" : "rightmove",
      listing_url: null,
      listing_id: null,
      asking_price: h.price,
      price_qualifier: h.qualifier ?? "guide",
      property_type: h.type,
      beds: h.beds,
      baths: h.baths,
      receptions: 1,
      floor_area_sqft: h.area,
      tenure: h.tenure,
      lease_years: h.lease ?? null,
      service_charge: h.tenure === "leasehold" ? 1850 : null,
      ground_rent: null,
      council_tax_band: h.tax,
      epc: h.epc || null,
      address: h.address,
      postcode: h.postcode,
      lat: h.lat,
      lng: h.lng,
      address_precision: h.postcode.length <= 4 ? "approximate" : "exact",
      key_features: h.features,
      description: null,
      cover_image_path: null,
      image_urls: [],
      field_sources: {},
      default_agent_id: h.agent,
      pinned_by: null,
      pin_reason: null,
      ruled_out_reason: h.key === "grafton" ? "Over budget" : null,
      archived_at: null,
      tint: h.tint,
      created_at: T,
      updated_at: T,
    });
    d.status_events.push({ id: `se-${h.key}`, property_id: id, from_status: null, to_status: h.status, member_id: SAURABH, at: T });
    h.prox.forEach(([category, place, min, source], i) => {
      d.proximity.push({
        id: `px-${h.key}-${i}`,
        property_id: id,
        category,
        place_name: place,
        place_lat: null,
        place_lng: null,
        walk_min: min,
        walk_m: min * 80,
        source: source ?? "auto",
        edited_by: source === "manual" ? VEDIKA : null,
        calculated_at: T,
        method: source === "manual" ? null : "routed",
      });
    });
  }

  // Viewings, relative to today so the schedule always has a live Saturday.
  const sat = (h: number, m = 0) => at(saturday(now, h, m));
  const viewing = (v: Omit<Viewing, "duration_min" | "notes" | "attendees"> & Partial<Viewing>): Viewing => ({ duration_min: 30, notes: null, attendees: [SAURABH, VEDIKA], ...v });
  d.viewings = [
    viewing({ id: "v-ramsden", property_id: ids.ramsden, agent_id: "a-tom", starts_at: sat(11, 30), status: "booked", kind: "first" }),
    viewing({ id: "v-elsynge-2", property_id: ids.elsynge, agent_id: "a-amira", starts_at: sat(13), status: "booked", kind: "second", notes: "Check the second bedroom fits a double bed, ask about the service charge." }),
    viewing({ id: "v-thurleigh", property_id: ids.thurleigh, agent_id: "a-grace", starts_at: sat(15), status: "booked", kind: "first" }),
    viewing({ id: "v-elsynge-1", property_id: ids.elsynge, agent_id: "a-amira", starts_at: at(daysAgo(now, 6, 17)), status: "done", kind: "first" }),
    viewing({ id: "v-fircroft", property_id: ids.fircroft, agent_id: "a-dev", starts_at: at(daysAgo(now, 4, 10)), status: "done", kind: "first" }),
    viewing({ id: "v-bolingbroke", property_id: ids.bolingbroke, agent_id: "a-priya", starts_at: at(daysAgo(now, 6, 18)), status: "done", kind: "first" }),
    viewing({ id: "v-brixton", property_id: ids.brixton, agent_id: "a-dev", starts_at: at(daysAgo(now, 4, 12)), status: "done", kind: "first" }),
    viewing({ id: "v-wellfield", property_id: ids.wellfield, agent_id: "a-dev", starts_at: at(daysAgo(now, 10, 15)), status: "done", kind: "first" }),
  ];

  // Ratings. Vector: [living, kitchen, spaceLiving, spaceKitchen, bed1, bed2, bathrooms, outdoor, gut, adjSel].
  type V = [number, number, number, number, number, number, number, number, number, number];
  const assess = (key: string, member: string, v: V, note: string | null = null): Assessment => {
    const submitted = daysAgo(now, 3, 20).toISOString();
    return {
      id: `as-${key}-${member}`,
      property_id: ids[key],
      viewing_id: d.viewings.find((x) => x.property_id === ids[key] && x.status === "done")?.id ?? null,
      member_id: member,
      ratings: { living_room: v[0], kitchen: v[1], bedroom_1: v[4], bedroom_2: v[5], bathrooms: v[6], outdoor: v[7] },
      space_living: v[2],
      space_kitchen: v[3],
      gut_feel: v[8],
      note,
      submitted_at: submitted,
      updated_at: submitted,
    };
  };
  d.assessments = [
    assess("elsynge", SAURABH, [5, 4, 3, 4, 5, 5, 4, 4, 5, 1]),
    assess("elsynge", VEDIKA, [2, 3, 2, 4, 4, 2, 4, 2, 3, 4]),
    assess("fircroft", SAURABH, [2, 4, 3, 3, 2, 4, 3, 2, 3, 5]),
    assess("fircroft", VEDIKA, [1, 1, 3, 3, 1, 2, 2, 3, 3, 2], "Layout felt cramped"),
    // PRD 6.7 worked example: A rates 4,3,4,3; mean rest 3.5; gut 4. B rates 3 throughout.
    assess("bolingbroke", SAURABH, [4, 3, 4, 3, 4, 3, 4, 3, 4, 3]),
    assess("bolingbroke", VEDIKA, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
    assess("brixton", SAURABH, [2, 2, 3, 3, 1, 1, 1, 3, 3, 5]),
    assess("brixton", VEDIKA, [2, 3, 3, 2, 4, 3, 3, 4, 2, 1]),
    assess("wellfield", SAURABH, [2, 1, 1, 1, 2, 1, 1, 1, 2, 4]),
    assess("wellfield", VEDIKA, [2, 1, 3, 2, 2, 1, 2, 3, 2, 4]),
  ];

  let n = 0;
  const pc = (key: string, member: string, kind: ProCon["kind"], text: string, impact: ProCon["impact"], criterion: ProCon["criterion"] = null, agreed: string | null = null): ProCon => ({
    id: `pc-${++n}`,
    property_id: ids[key],
    member_id: member,
    kind,
    text,
    impact,
    criterion,
    deal_breaker: false,
    position: n,
    agreed_from_id: agreed,
  });
  d.pro_cons = [
    pc("elsynge", SAURABH, "con", "Second bedroom is small", "moderate"),
    pc("elsynge", VEDIKA, "pro", "Two minutes to the common", "moderate"),
    pc("fircroft", SAURABH, "pro", "Opposite Tooting Common", "moderate"),
    pc("brixton", SAURABH, "pro", "Good light", "moderate"),
    pc("brixton", VEDIKA, "con", "Noisy bus route", "moderate"),
    pc("wellfield", SAURABH, "pro", "Big garden", "moderate"),
    pc("wellfield", VEDIKA, "pro", "Big garden", "moderate"),
  ];
  // Bolingbroke: PRD 6.7 bullets.
  const g = pc("bolingbroke", SAURABH, "pro", "South-facing garden", "major");
  const l = pc("bolingbroke", SAURABH, "con", "Lease will need extending", "major");
  d.pro_cons.push(
    g,
    pc("bolingbroke", SAURABH, "pro", "Quiet street", "minor"),
    pc("bolingbroke", SAURABH, "con", "Kitchen needs replacing", "moderate", "space"),
    l,
    pc("bolingbroke", VEDIKA, "pro", "South-facing garden", "major", null, g.id),
    pc("bolingbroke", VEDIKA, "con", "Lease will need extending", "major", null, l.id),
    pc("bolingbroke", VEDIKA, "con", "Main road at the end of the street", "moderate"),
  );

  d.offers = [] as Offer[];
  d.notes = [
    { id: "n-1", property_id: ids.elsynge, member_id: VEDIKA, text: "Ask about the service charge and when the roof was last done.", created_at: T },
  ];
  return d;
}
