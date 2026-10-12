# HomeHunt

A private home-buying journal for two. Plan viewings, rate each home on the doorstep, and see a transparent score and rank for every home. Built from the HomeHunt PRD (`docs/PRD.md`) and the approved mock-ups.

## Try it in one minute

```bash
npm install
npm run dev        # http://localhost:3000
```

There is no login. The first screen asks who's looking (Saurabh or Vedika); the choice is remembered on that device, and **Switch** in the menu changes it. The app always starts as a **clean slate** with no homes.

With no environment variables it runs in **local mode**: data lives in that one browser. To explore, Settings has **Load sample homes** (the mock-up's London homes, local mode only) and **Start empty**. Open a second tab as the other person to see private ratings in action. To share one board between your two phones, connect Supabase (below).

## What's built

| PRD area | Where |
| --- | --- |
| Scoring, tiers, ranking, stamp duty (§6, §7, FR-S, FR-X1) | `packages/scoring`: pure functions, config-driven, golden test for the §6.7 worked example (75.5, 69.8, combined 72.6) |
| Mortgage planner (mortgage PRD) | `packages/mortgage`: a pure month-by-month engine (initial and follow-on rate, four overpayment types, shorten-the-term or lower-the-payment, allowance and ERC check, LTV bands, scenario comparison), tested against every golden figure in the PRD. Screens under `/mortgage`: Calculator, Scenarios (compare up to 6, quick variants, our plan) and Overpayments. Scenarios and settings are shared by both of you (`0002_mortgage.sql`); our plan shows on each home's Costs tab, optionally on the board, and as a row on Compare |
| Update checker | Every build knows its own version and the app's main address (Vercel's production domain, or `APP_CANONICAL_URL`). The app asks `/api/version` there when it opens, when you come back to it, and every 15 minutes. If a newer build exists it shows a bar: **Reload** on the live address, or **Open the latest** (same page) when you're on an old deployment address. Settings and the phone menu have **Check for updates** and show the build number |
| PDF import | On the same page, **Upload a PDF** (an agent's brochure, or a listing page saved as PDF). The browser draws the first five pages and the last one as pictures and pulls out the printed text, then both go through the screenshot reader |
| Agent contact | Each agent has a mobile, office phone and email. Call and Text open the phone's dialler and messages (mobile first), Email opens the mail app. Agent details read from a listing or PDF are pre-filled on the Add page for checking |
| Screenshot import | `/api/extract-screenshots` + the Add page: paste or drop up to 6 listing screenshots; Claude (official SDK, structured output) reads the facts and finds the main photo, which is cropped out as the home's picture |
| Listing import (§9.2, FR-I) | `packages/importers` + `/api/import`: Rightmove, Zoopla, OnTheMarket adapters, JSON-LD / Open Graph / text fallbacks, Claude API extraction, paste-text and manual fallbacks, SSRF-safe image copy |
| Walking times (§9.3, FR-L) | `packages/geo` + `/api/proximity`: postcodes.io, OpenStreetMap, optional Google Places/Routes or OpenRouteService; manual overrides are never overwritten |
| Screens S1 to S10 | `apps/web/src/app`: Board, Add, Property (8 tabs), Schedule/Today, 6-step rating stepper, Compare, Agents, Settings, Sign-in |
| Data (§8) | `supabase/migrations/0001_init.sql`: all tables, a single household of two, private storage buckets, no accounts |
| PWA, offline (§10) | manifest, service worker, IndexedDB write outbox that replays on reconnect |

## Running for real: shared between your two phones (Supabase + Vercel)

1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor. It creates the tables and the household with its two members (Saurabh and Vedika, editable in Settings). **No homes are added.** No auth setup or invitations are needed.
2. From Project Settings, then API, copy the project URL, the `anon` key and the `service_role` key.
3. In Vercel, import the repo with **Root Directory** `apps/web` (leave "include source files outside the Root Directory" on) and Node 22. Add the environment variables from `.env.example`: the URL and anon key, and `SUPABASE_SERVICE_ROLE_KEY` (server only, never expose it to the browser).
4. Deploy. Both of you open the URL, pick your name, and share the same board live.

If you deploy **without** the Supabase variables, each device keeps its own separate empty board in its own browser.

### The trade-off of having no login

Anyone who knows your site address can open it and pick a name, and the database accepts requests from anyone holding the public `anon` key (which ships in the page). Treat the URL as a private link and don't share it. If that isn't enough, the easiest extra lock is Vercel's **Deployment Protection** (password or Vercel login in front of the whole site) at no code cost. Ratings stay hidden between the two of you in the app, but that is a courtesy between two people, not a security boundary.

Optional daily backup (FR-D2): keep the repo private, add the secret `SUPABASE_DB_URL` and the variable `ENABLE_BACKUP=true`. Supabase Pro also includes daily backups.

## Adding a home from screenshots (works when the portals block links)

On **Add a home**, take screenshots of the listing (the photo, then the price and details), copy each, and press Ctrl/⌘ + V on the page. You can also drop files or choose them from your photos. **Read the screenshots** sends them to Claude, which fills the same review form as a link import, with every field marked "Worked out, please check". The listing's main photo is cropped out and kept as the home's picture; if it can't be found, your first screenshot is used and you can pick a different one.

This needs `ANTHROPIC_API_KEY` set on the server (Vercel). Without it you'll be told so, and your first screenshot is kept as the photo while you type the details. It uses `claude-opus-5-5` by default; set `ANTHROPIC_VISION_MODEL` to change that. Screenshots are processed in memory and are not stored. The browser shrinks them to fit Vercel's 4.5 MB request limit.

**PDFs** go the same way. The PDF is opened in your browser (up to 40 MB), up to six pages are drawn as pictures, and the text printed in the PDF is sent alongside to help with small print. Nothing about the PDF itself is uploaded, so large brochures don't hit the request limit. A scanned PDF works too, from the pictures alone. Password-protected PDFs are refused with a message.

## Tests

```bash
npm test             # unit tests: scoring (every curve breakpoint, gates, caps, ties), importers (fixtures), geo, the mortgage engine's golden figures, screenshot reading, calculator logic
npm run typecheck
npm run build && npm run e2e   # browser journeys, laptop and phone
```

## Decisions and deviations to know about

- **Old deployment addresses.** Every Vercel deployment keeps its own permanent address that never updates, and a phone that opens one keeps showing that old build. Builds from this one on notice and offer the newest. Anything older cannot, so open the live address once. In local mode (no Supabase) your homes live in the browser at the address you used, so moving addresses starts empty: export first.

- **Mortgage tables need a second migration.** If you already ran `0001_init.sql`, also run `supabase/migrations/0002_mortgage.sql` once (safe to repeat). Until you do, the app still opens and the calculator works; saving a scenario shows a banner telling you to run it.
- **The mortgage PRD contradicts itself in one place.** Section 10 says scenario C is lowest on monthly payment, total interest and total payable. By its own table (and by the engine) C is lowest on payment and total payable, but D (15% down over 25 years) has the lowest total interest: £460,837 against C's £468,964. The app follows the numbers, so D is marked best on interest.
- **Calculator opens with a rate filled in** (the sample rate for 85% LTV, 5.15%) rather than blank, as in the mock-up; the PRD says blank. Rates are examples you can change in Settings, never quotes.
- **The first scenario you save becomes "our plan"** so the property pages have something to show; star another any time.
- **Scenario colours** keep the mock-ups' hues but are nudged so they stay distinguishable for colour-blind readers; every chart mark also carries its letter.
- **Lower the payment** re-sets the payment to keep the original term after each overpayment, but the yearly overpayments carry on, so the loan can still finish early (£10,000 a year clears scenario B in 29 years; the PRD's £130,828 saving is exactly this).
- **Phones**: the tab bar carries Mortgage in place of Settings; Settings and Agents are in the profile menu at the top right.

- **Lifecycle** (the PRD's diagram wasn't readable in the export): Shortlisted, Viewing booked, Viewed, Second viewing, Offer made, Offer accepted are active; Ruled out, Withdrawn, Sold are exits.
- **Budget gate** follows the figure in play: an accepted offer, else the live offer, else the asking price ("Offers over" is gated on the asking price). The PRD wording ("asking price or latest offer") would rule out a home you are negotiating below the limit.
- **Provisional scores** normalise over the criteria that have data, as §6.6 says, so an unseen home with great walking times can show a high "so far" score (Ramsden Road shows 90, the mock-up shows 79).
- **Unrated criteria** (for example before walking times are calculated) are also normalised rather than counted as zero.
- **Tier colours** follow the mock-ups (strong contender is blue; the PRD text says teal).
- **No sign-in**: the PRD's magic-link screen (S10) is replaced by a name picker, at your request. Ratings are hidden by the app, not by database rules.
- **Visibility**: until you submit your own rating, the board shows a home without your partner's ratings, so your score and rank can differ from theirs for that home.
- `property_field_source` is a JSON column on `property`; `scoring_config` stores the whole config as JSON; `proximity` has an extra `method` column (routed or estimated).
- The "static map" on Location is a labelled diagram of nearby places, not map tiles, to avoid a third-party map key.
- Photos you take are resized in the browser; in demo mode they stay in IndexedDB.

## Not verified, not built

- **The mortgage maths is verified against the PRD's own figures, not against a lender.** Interest is monthly at annual rate ÷ 12, as the PRD specifies; real statements use daily interest and will differ slightly. Overpayments are applied at each anniversary, with no delay in recalculating the payment.
- **The mortgage Supabase tables (`0002_mortgage.sql`) have never run against a live project**, like the rest of the Supabase path. Local mode is what the browser tests exercise.
- Not built from the mortgage PRD: Settings' separate "show monthly cost on board" is built, but the affordability check takes income from the calculator or Settings only (no per-scenario income), and overpayment plans are one per scenario in this version.

- **Supabase path is untested against a live project** (no credentials here): the adapter, SQL policies, storage and live sync are written and typechecked but have never run. Local mode, the API routes, scoring and the UI are what the tests exercise. Run the SQL on a scratch project and try it from two devices before relying on it.
- **Portal parsers use synthetic fixtures.** I couldn't capture real Rightmove/Zoopla/OnTheMarket pages, so the adapters follow the data shapes I expect. Save a real page for each portal into `packages/importers/test/fixtures/` and fix any field that doesn't parse; the paste-text and manual fallbacks cover you meanwhile.
- OpenStreetMap, Google and postcodes.io calls are tested with mocked responses only.
- **PDF page drawing is tested in a real browser (Chromium) with a sample PDF; Claude's reading of PDFs is tested with a mocked Claude**, like screenshots. Try one real brochure.
- **Screenshot reading is tested with a mocked Claude** (request shape, parsing, cropping, errors), not against the live API. Try it with a few real Zoopla screenshots and check the fields and the cropped photo.
- Not built (the PRD's "Should" items): web-push and email reminders (FR-V5), AI suggestion of impact and criterion for pros and cons (FR-C5). Phase 2 items are out of scope.
- `npm audit` reports no issues in production dependencies; the remaining dev-only findings are in the test runner (vitest).
