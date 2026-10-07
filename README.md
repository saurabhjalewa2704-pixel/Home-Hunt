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

## Tests

```bash
npm test             # 80 unit tests: scoring (every curve breakpoint, gates, caps, ties), importers (fixtures), geo
npm run typecheck
npm run build && npm run e2e   # 12 browser journeys, laptop and phone
```

## Decisions and deviations to know about

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

- **Supabase path is untested against a live project** (no credentials here): the adapter, SQL policies, storage and live sync are written and typechecked but have never run. Local mode, the API routes, scoring and the UI are what the tests exercise. Run the SQL on a scratch project and try it from two devices before relying on it.
- **Portal parsers use synthetic fixtures.** I couldn't capture real Rightmove/Zoopla/OnTheMarket pages, so the adapters follow the data shapes I expect. Save a real page for each portal into `packages/importers/test/fixtures/` and fix any field that doesn't parse; the paste-text and manual fallbacks cover you meanwhile.
- OpenStreetMap, Google and postcodes.io calls are tested with mocked responses only.
- Not built (the PRD's "Should" items): web-push and email reminders (FR-V5), AI suggestion of impact and criterion for pros and cons (FR-C5). Phase 2 items are out of scope.
- `npm audit` reports no issues in production dependencies; the remaining dev-only findings are in the test runner (vitest).
