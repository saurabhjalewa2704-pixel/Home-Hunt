# HomeHunt

A private home-buying journal for two. Plan viewings, rate each home on the doorstep, and see a transparent score and rank for every home. Built from the HomeHunt PRD (`docs/PRD.md`) and the approved mock-ups.

## Try it in one minute

```bash
npm install
npm run dev        # http://localhost:3000
```

With no environment variables it runs in **demo mode**: no accounts, data lives in your browser, and the board is pre-filled with the mock-up's London homes. Pick **Saurabh** or **Vedika**; open a second tab as the other buyer to see private ratings in action. Settings has **Start empty** and **Load sample homes**.

## What's built

| PRD area | Where |
| --- | --- |
| Scoring, tiers, ranking, stamp duty (§6, §7, FR-S, FR-X1) | `packages/scoring`: pure functions, config-driven, golden test for the §6.7 worked example (75.5, 69.8, combined 72.6) |
| Listing import (§9.2, FR-I) | `packages/importers` + `/api/import`: Rightmove, Zoopla, OnTheMarket adapters, JSON-LD / Open Graph / text fallbacks, Claude API extraction, paste-text and manual fallbacks, SSRF-safe image copy |
| Walking times (§9.3, FR-L) | `packages/geo` + `/api/proximity`: postcodes.io, OpenStreetMap, optional Google Places/Routes or OpenRouteService; manual overrides are never overwritten |
| Screens S1 to S10 | `apps/web/src/app`: Board, Add, Property (8 tabs), Schedule/Today, 6-step rating stepper, Compare, Agents, Settings, Sign-in |
| Data + privacy (§8, §9.5) | `supabase/migrations/0001_init.sql`: all tables, row-level security, ratings hidden until you submit yours, private storage buckets |
| PWA, offline (§10) | manifest, service worker, IndexedDB write outbox that replays on reconnect |

## Running for real (Supabase)

1. Create a Supabase project. In **Authentication**, turn **off** "Allow new users to sign up", then **invite** the two buyers' email addresses.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor, then once:
   `select public.bootstrap_household('Our home', 'a@example.com', 'Saurabh', 'b@example.com', 'Vedika');`
   A third email address cannot see any data: every table is behind row-level security.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and service-role key. Add the optional keys you want.
4. In Authentication, add your site URL and `https://<your-domain>/auth/callback` to the redirect allow-list.
5. Deploy to Vercel (set the same variables) or `npm run build && npm start`.
6. Optional daily backup (FR-D2): keep the repo private, add the secret `SUPABASE_DB_URL` and the variable `ENABLE_BACKUP=true`. Supabase Pro also includes daily backups.

## Tests

```bash
npm test             # 80 unit tests: scoring (every curve breakpoint, gates, caps, ties), importers (fixtures), geo
npm run typecheck
npm run build && npm run e2e   # 11 browser journeys, laptop and phone
```

## Decisions and deviations to know about

- **Lifecycle** (the PRD's diagram wasn't readable in the export): Shortlisted, Viewing booked, Viewed, Second viewing, Offer made, Offer accepted are active; Ruled out, Withdrawn, Sold are exits.
- **Budget gate** follows the figure in play: an accepted offer, else the live offer, else the asking price ("Offers over" is gated on the asking price). The PRD wording ("asking price or latest offer") would rule out a home you are negotiating below the limit.
- **Provisional scores** normalise over the criteria that have data, as §6.6 says, so an unseen home with great walking times can show a high "so far" score (Ramsden Road shows 90, the mock-up shows 79).
- **Unrated criteria** (for example before walking times are calculated) are also normalised rather than counted as zero.
- **Tier colours** follow the mock-ups (strong contender is blue; the PRD text says teal).
- **Visibility**: until you submit your own rating, the board shows a home without your partner's ratings, so your score and rank can differ from theirs for that home.
- `property_field_source` is a JSON column on `property`; `scoring_config` stores the whole config as JSON; `proximity` has an extra `method` column (routed or estimated).
- The "static map" on Location is a labelled diagram of nearby places, not map tiles, to avoid a third-party map key.
- Photos you take are resized in the browser; in demo mode they stay in IndexedDB.

## Not verified, not built

- **Supabase path is untested against a live project** (no credentials here): the adapter, RLS policies, storage policies and magic-link flow are written and typechecked but have never run. Demo mode, the API routes, scoring and the UI are what the tests exercise. Run the SQL on a scratch project and try the two-user flow before trusting it.
- **Portal parsers use synthetic fixtures.** I couldn't capture real Rightmove/Zoopla/OnTheMarket pages, so the adapters follow the data shapes I expect. Save a real page for each portal into `packages/importers/test/fixtures/` and fix any field that doesn't parse; the paste-text and manual fallbacks cover you meanwhile.
- OpenStreetMap, Google and postcodes.io calls are tested with mocked responses only.
- Not built (the PRD's "Should" items): web-push and email reminders (FR-V5), AI suggestion of impact and criterion for pros and cons (FR-C5). Phase 2 items are out of scope.
- `npm audit` reports no issues in production dependencies; the remaining dev-only findings are in the test runner (vitest).
