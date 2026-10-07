<!-- Plain-text export of the PRD (tables and diagrams flattened). The source of truth is the HomeHunt PRD doc. -->


# HomeHunt — Product Requirements Document

 ·  · Version 1.0 (draft)

## 1. Overview

HomeHunt is a private, browser-based app for two first-time buyers in London to plan viewings, record what they thought, and get a consistent score and priority for every home. It replaces scattered portal favourites, WhatsApp notes and memory with one shared record per property.

Problem. Buying in London means dozens of viewings across Rightmove, Zoopla and OnTheMarket within a few weeks. Details blur, the two buyers remember homes differently, and there is no consistent way to compare a two-bed near a park with a larger flat further from a station.

Vision. Paste a listing link, and the home appears with its photo, price and size. Book the viewing, rate it on the doorstep, list the pros and cons, and the app tells you where it stands against everything else you have seen.

### Goals

One place for every property and viewing — listing details, agent, schedule, notes and photos together.

Fast capture — a post-viewing assessment completed on a phone in under 5 minutes.

Minimal typing — listing facts and walking times are filled in automatically wherever possible.

A score the buyers trust — transparent, explainable, tuned to their stated priorities, and adjustable.

A clear priority order — every active home sits in a tier and a rank, so the next decision (second viewing, offer, drop) is obvious.

### Success measures

 | 
Measure
 | 
Target

 | 
Time to add a property from a portal link
 | 
Under 30 seconds, including review

 | 
Listing fields auto-filled on a supported portal link
 | 
At least 80% of core fields (price, beds, baths, size, address, first image)

 | 
Post-viewing assessment completion time on mobile
 | 
Under 5 minutes per person

 | 
Viewed homes with a complete score
 | 
100% within 24 hours of the viewing

 | 
Buyers agree the top 3 ranked homes match their gut ranking
 | 
Yes, after the first 10 viewings (tuning check)

### Decisions already made

Platform: responsive web app that works in any browser on phone and laptop, installable to the home screen (PWA). No native app.

Two raters: each partner rates privately; the app combines the two scores and flags strong disagreement.

Distances: walking times are calculated automatically from the address, and either buyer can override them with what they saw on the day.

Budget: £750,000 is a hard maximum: any home whose asking price or latest offer is above it is ruled out. Below it, budget is still a rating factor, and more headroom scores higher.

## 2. Users and journeys

The app has exactly two users who share one household: the two buyers. Both have equal rights; there are no admin roles in v1.

### Context of use

 | 
Moment
 | 
Device
 | 
What matters

 | 
Browsing listings at home or on the commute
 | 
Phone or laptop
 | 
Add a property in seconds from a portal link or the phone's share sheet

 | 
Booking with the agent
 | 
Phone
 | 
Agent details, a date and time, calendar invite

 | 
On the day of viewings
 | 
Phone, often poor signal
 | 
Today's agenda, address, map link, one-tap call to the agent, notes

 | 
On the doorstep after a viewing
 | 
Phone, one hand
 | 
Rate rooms and add pros and cons quickly; works offline and syncs later

 | 
Weekly review together
 | 
Laptop
 | 
Ranked board, side-by-side comparison, score breakdown, disagreements

### Key journeys

Add a property. Paste a Rightmove, Zoopla or OnTheMarket link → the app fetches the photo, price, beds, baths, size, tenure and address → the buyer checks and saves → walking times to the station, park, supermarket, gym and restaurants are calculated → a pre-viewing score appears from the objective data alone.

Book a viewing. Add the agent (or pick an existing one) → set date, time and who is attending → the home moves to Viewing booked and appears on the schedule; an .ics invite can be downloaded or added to a calendar.

Viewing day. Open Today → see each viewing in time order with its photo, address, agent phone and directions → jot quick notes during the visit.

Post-viewing assessment. Each buyer opens the home and taps Rate this viewing → a short stepper: rooms, space, location checks, gut feel, pros and cons → submit → the full score updates and the home is placed in a priority tier.

Review and decide. On the board, homes are ranked by combined score within tiers → the buyers open Compare for the top two to four → mark one for a second viewing, an offer, or rule it out with a reason.

Offer stage. Record offers made, the agent's response and the final agreed price → the budget criterion re-scores against the offer price rather than the asking price.

### Property lifecycle

Every property carries one status, which drives where it appears:

A home can also go straight from Viewed to Offer made; every stage from Shortlisted to Offer made counts as active for ranking.

## 3. Scope

The MVP covers all seven capabilities in the brief; phase 2 adds conveniences that are useful but not needed to start viewing.

 | 
Capability
 | 
MVP (v1)
 | 
Phase 2

 | 
Properties and viewings
 | 
Add from link or manually, statuses, schedule, Today view, .ics export
 | 
Two-way Google or Outlook calendar sync

 | 
Listing import
 | 
Rightmove, Zoopla, OnTheMarket links; first image, price, beds, baths, size, tenure, address; manual fallback
 | 
Share-sheet capture from the portal apps; price-change tracking on saved links

 | 
Agents
 | 
Agent and agency records, linked to properties, tap to call or email
 | 
Contact log (calls, emails, chasers)

 | 
Post-viewing assessment
 | 
Per-person room ratings, space, location checks, gut feel, photos, notes
 | 
Voice notes transcribed into notes and pros/cons

 | 
Pros and cons
 | 
Free text, bullet list, impact level, link to a criterion, deal-breaker flag
 | 
AI suggestion of impact and criterion from free text

 | 
Proximity
 | 
Auto walking times for 5 categories, manual override
 | 
Commute time to named destinations; map view with all homes

 | 
Scoring and priority
 | 
Home Score, combined couple score, gates, tiers, rank, breakdown, compare
 | 
Sensitivity view ("what if we cared more about space?")

 | 
Costs
 | 
Stamp duty estimate at the asking or offer price
 | 
Mortgage, service charge and running-cost calculator

### Non-goals

Not a property search engine: homes are found on the portals and brought in.

No messaging agents from inside the app.

No public sharing, multi-household support or user sign-up flow.

No financial or mortgage advice; cost figures are estimates for planning.

## 4. Screens

Ten screens cover the MVP; the board, the property page and the post-viewing assessment carry most of the value and deserve the most design care.

Navigation. On phones, a bottom tab bar: Board, Schedule, a central + Add button, Compare, Settings. On laptops, the same items in a left sidebar, with the board as the home screen.

### S1 — Board (home)

Ranked list of active homes grouped by priority tier (Top pick, Strong contender, Maybe, Unlikely), with Ruled out collapsed at the bottom.

Each card: listing photo, price, beds/baths, size in sq ft, area or postcode district, status chip, combined score in a ring (0–100), rank number, and small icons for any breached must-have (for example a train icon in amber when the station is over 15 minutes).

A disagreement marker when the two buyers' scores differ by 10 points or more.

Filters: status, tier, price band, beds. Sort: rank (default), score, price, viewing date, recently added.

Toggle between list and compact table view on laptop.

Empty state: a single prompt to paste the first listing link.

### S2 — Add property

One large field: Paste a Rightmove, Zoopla or OnTheMarket link.

After paste: a loading state, then an import preview card showing the photo and every fetched field, each editable, with fields that could not be fetched highlighted for manual entry.

Secondary path: Enter manually.

Optional on the same screen: pick or add the agent, and set the status (Shortlisted or Viewing booked with date and time).

### S3 — Property detail

Header: photo (tap for the gallery of any photos you took), price, address, beds/baths/size, status chip with a change control, combined score ring, tier and rank, link out to the listing.

Tabs or stacked sections:

Overview — listing facts (property type, tenure, lease years left, service charge and ground rent if leasehold, council tax band, EPC rating, floor area), key notes.

Viewings — past and upcoming viewings with attendees and quick notes; add a viewing.

Our ratings — each buyer's assessment side by side, with differences highlighted; Rate this viewing button for anyone who has not yet rated.

Pros and cons — two columns; each item shows who added it, its impact and any deal-breaker flag.

Location — walking minutes to the nearest station, park, supermarket, gym and restaurants, the named place for each, whether it was calculated or entered, and a small static map.

Agent — agent card with call, email and agency details.

Score — the breakdown described in section 6, criterion by criterion, plus gates and pros/cons adjustment.

Costs — asking or offer price, estimated stamp duty, offers made.

### S4 — Schedule

Agenda list grouped by day, with Today pinned at the top; a month calendar on laptop.

Each entry: time, photo thumbnail, address, agent name with tap-to-call, directions link, attendee avatars.

After the viewing time passes, the entry shows Rate now until both buyers have rated.

### S5 — Post-viewing assessment (mobile stepper)

Six short steps with a progress bar, large tap targets and autosave:

Rooms — 1–5 star rating per space present: living room, kitchen, each bedroom, bathrooms, outdoor space, storage. Rooms are pre-listed from the bedroom and bathroom count.

Space — two quick questions: Is the living room big enough for how we live? and Is the kitchen big enough to cook and eat? (1–5 each).

Home quality — natural light, condition and likely work needed, noise, layout.

Location check — the calculated walking times shown with the place names; tap to override any; rate the street and neighbourhood feel.

Pros and cons — free text, one item per line, each becoming a bullet; tap an item to set impact and link it to a criterion; mark any con as a deal-breaker.

Gut feel — Could you see yourselves living here? (1–5) and an optional note. Submit shows the new score.

### S6 — Score breakdown

A dedicated view (or expanded tab) showing each criterion's weight, input, sub-score and points, the pros and cons adjustment, any gate applied, and the combined and per-person totals. Each line explains itself in a sentence, for example Station 12 min walk: 15.0 of 20.

### S7 — Compare

Two to four homes side by side: photo, price, score, tier, and one row per criterion with the best value highlighted; pros and cons summarised at the bottom.

### S8 — Agents

List of agents and agencies with the properties linked to each, tap to call or email.

### S9 — Settings

Household (names, invite partner), budget limit and headroom curve, criteria weights with sliders that always sum to 100, walking-time thresholds, tier cut-offs, stamp duty buyer type, and data export (CSV and JSON).

### S10 — Sign-in

Email magic link only; no passwords.

## 5. Functional requirements

Each requirement has an ID so Claude Code can reference it in commits and tests; Must items are MVP, Should items are MVP if time allows.

### 5.1 Properties

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-P1
 | 
Create a property from a portal link (5.2) or manually. Required fields: address or postcode, price, link or "no link".
 | 
Must

 | 
FR-P2
 | 
Store listing facts: portal, listing URL, listing ID, asking price, price qualifier (Guide, Offers over, Offers in excess of, Fixed), property type, beds, baths, receptions, floor area (sq ft and m²), tenure, lease years remaining, service charge (£/year), ground rent (£/year), council tax band, EPC rating, address, postcode, latitude and longitude, key features, description, first image and image URLs.
 | 
Must

 | 
FR-P3
 | 
Every property has one status from the lifecycle in section 2; status changes are time-stamped and shown as a history.
 | 
Must

 | 
FR-P4
 | 
Ruling a property out requires a reason (free text or picked from common reasons: over budget, too far from station, too small, condition, lease, area, sold).
 | 
Must

 | 
FR-P5
 | 
Detect duplicates by listing ID or normalised address and warn before saving.
 | 
Should

 | 
FR-P6
 | 
Upload own photos (up to 30 per property) and add free-text notes with author and time.
 | 
Must

 | 
FR-P7
 | 
Archive rather than delete; hard delete only from Settings.
 | 
Should

### 5.2 Listing import

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-I1
 | 
Accept a URL from Rightmove, Zoopla or OnTheMarket, identify the portal, and fetch the page server-side once, on the user's request.
 | 
Must

 | 
FR-I2
 | 
Extract, in order of preference: the portal's embedded structured data, schema.org JSON-LD, Open Graph tags, then page text. Return each field with a source flag (fetched / inferred / missing).
 | 
Must

 | 
FR-I3
 | 
Always attempt to capture the first listing image; store a resized copy (max 1600 px wide plus a 400 px thumbnail) in the app's private storage so the card still shows if the listing is removed.
 | 
Must

 | 
FR-I4
 | 
If structured extraction yields fewer than 4 core fields, send the page text to the Claude API with a strict JSON schema to extract the rest; mark those fields inferred for the user to confirm.
 | 
Should

 | 
FR-I5
 | 
If the fetch is blocked or fails, show the error plainly and offer two fallbacks: paste the listing text (parsed by the same extractor) or enter manually.
 | 
Must

 | 
FR-I6
 | 
The user always reviews the import preview before saving; nothing is saved silently.
 | 
Must

 | 
FR-I7
 | 
Floor area: if only m² is given, convert to sq ft (× 10.764) and vice versa; if absent, leave blank and let the user add it from the floor plan.
 | 
Must

 | 
FR-I8
 | 
Refresh from listing button re-fetches price and status, and records any price change with date.
 | 
Should

### 5.3 Viewings and schedule

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-V1
 | 
A property can have multiple viewings (first, second, with surveyor), each with date, start time, duration (default 30 min), attendees, agent, meeting notes and status (Booked, Done, Cancelled, No-show).
 | 
Must

 | 
FR-V2
 | 
Schedule view lists upcoming viewings by day with Today pinned; past viewings without both assessments show Rate now.
 | 
Must

 | 
FR-V3
 | 
Download an .ics invite for any viewing, including address, agent phone and listing link.
 | 
Must

 | 
FR-V4
 | 
Flag clashes when two viewings overlap or are less than the walking or driving time apart (estimate shown).
 | 
Should

 | 
FR-V5
 | 
Optional reminder notification 1 hour before a viewing and a Rate now nudge 30 minutes after it ends (web push where supported, otherwise email).
 | 
Should

### 5.4 Agents

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-A1
 | 
Store agent name, agency, branch, phone, mobile, email, notes. Agency details can be imported from the listing when present.
 | 
Must

 | 
FR-A2
 | 
Link one agent per viewing and a default agent per property; an agent can be linked to many properties.
 | 
Must

 | 
FR-A3
 | 
Tap to call, text or email from the property page and the schedule.
 | 
Must

### 5.5 Post-viewing assessment

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-R1
 | 
Each buyer completes their own assessment per property; neither sees the other's ratings until they have submitted their own (to avoid anchoring), after which both are visible side by side.
 | 
Must

 | 
FR-R2
 | 
Ratings use a 1–5 scale with plain labels: 1 Poor, 2 Weak, 3 OK, 4 Good, 5 Excellent. Rooms not present can be marked N/A.
 | 
Must

 | 
FR-R3
 | 
Rated items: living room, kitchen, each bedroom, bathrooms, outdoor space, storage, natural light, condition, noise, layout, street and neighbourhood feel, gut feel, plus the two space questions.
 | 
Must

 | 
FR-R4
 | 
Assessments autosave locally and sync when online; a submitted assessment can be edited, and edits re-score.
 | 
Must

 | 
FR-R5
 | 
An assessment can be completed from a later viewing; the most recent submission per person is the one scored.
 | 
Must

### 5.6 Pros and cons

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-C1
 | 
Enter pros and cons as free text; each new line becomes a bullet. Bullets can be reordered, edited and deleted.
 | 
Must

 | 
FR-C2
 | 
Each bullet has an impact level (Minor, Moderate, Major; default Moderate) and an optional link to a scoring criterion (for example Space or Station).
 | 
Must

 | 
FR-C3
 | 
Any con can be flagged as a deal-breaker, which rules the home out for that buyer (section 6.5).
 | 
Must

 | 
FR-C4
 | 
Pros and cons belong to the buyer who wrote them and count toward that buyer's score; the other buyer can tap Agree to add the same item to their own list.
 | 
Must

 | 
FR-C5
 | 
Optional AI assist suggests impact and criterion for each bullet; the buyer confirms or changes it.
 | 
Should

### 5.7 Location and proximity

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-L1
 | 
From the property's coordinates (or geocoded postcode), calculate walking time in minutes and distance to the nearest: rail, Tube, Overground, Elizabeth line or DLR station; park; full-size supermarket; gym; and a cluster of restaurants.
 | 
Must

 | 
FR-L2
 | 
Park means a public green space of at least 1 hectare (configurable); small squares and private gardens do not count.
 | 
Must

 | 
FR-L3
 | 
Supermarket means a full-size grocery store from a configurable list (Tesco, Sainsbury's, Waitrose, Asda, Morrisons, Aldi, Lidl, M&S Food, Co-op, Iceland); convenience-only formats are recorded separately and score lower.
 | 
Must

 | 
FR-L4
 | 
Restaurants means the nearest point with at least 5 restaurants or cafés within 300 m of each other, so a lone takeaway does not count.
 | 
Should

 | 
FR-L5
 | 
Show the named place, minutes, metres and a source badge (Auto or Edited by …) for each; either buyer can override minutes and name. Overrides are shared, since distances are facts, not opinions.
 | 
Must

 | 
FR-L6
 | 
Results are cached per property and recalculated only when the address changes or on request.
 | 
Must

 | 
FR-L7
 | 
If the listing gives only a partial postcode, flag the walking times as approximate until the exact address is confirmed after the viewing.
 | 
Must

### 5.8 Scoring, priority and costs

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-S1
 | 
Calculate the Home Score, per-person and combined, exactly as specified in section 6, and recalculate on any input change.
 | 
Must

 | 
FR-S2
 | 
Show a pre-viewing score from objective data before anyone has rated the home, clearly labelled as provisional.
 | 
Must

 | 
FR-S3
 | 
Place every active home in a tier and rank as specified in section 7.
 | 
Must

 | 
FR-S4
 | 
Store a score snapshot on every change so the history of a home's score can be shown.
 | 
Should

 | 
FR-S5
 | 
Weights, thresholds, budget and tier cut-offs are editable in Settings; changes re-score every home immediately.
 | 
Must

 | 
FR-X1
 | 
Estimate stamp duty at the asking price, or the latest offer, using rates stored in configuration (not hard-coded). At prices above £500,000 first-time buyer relief does not apply and standard rates are used (source); on £750,000 that is about £27,500.
 | 
Should

 | 
FR-X2
 | 
Record offers: amount, date, conditions, agent response, outcome.
 | 
Must

### 5.9 Data

 | 
ID
 | 
Requirement
 | 
Priority

 | 
FR-D1
 | 
Export all data as CSV (one row per property with scores) and JSON (full).
 | 
Must

 | 
FR-D2
 | 
Daily automated database backup.
 | 
Must

## 6. Home Score algorithm

Every home gets a score out of 100 per buyer, built from eight weighted criteria that follow the brief's priorities, adjusted by that buyer's pros and cons, and checked against must-have gates; the two buyers' scores are averaged into the combined score that drives priority.

### 6.1 Principles

Explainable. Every point can be traced to an input and shown in a sentence.

Facts shared, opinions personal. Price, size and walking times are household facts entered once. Room ratings, gut feel and pros and cons are personal, so each buyer gets their own score.

Must-haves are gates, not just weights. A cheap, beautiful flat 25 minutes from a station should not outrank a solid home 8 minutes away because it scored well elsewhere. Gates handle that separately from the weighted score.

Configurable. All weights, curves and thresholds live in one configuration object, editable in Settings; the defaults below are the starting point.

One pure function. Scoring is a deterministic, side-effect-free module with unit tests, including the worked example in 6.7 as a golden test.

### 6.2 Criteria and default weights

 | 
#
 | 
Criterion
 | 
Weight
 | 
Inputs
 | 
Shared or personal

 | 
1
 | 
Budget fit
 | 
20
 | 
Effective price vs the £750,000 maximum; more headroom scores higher
 | 
Shared

 | 
2
 | 
Station walk
 | 
20
 | 
Walking minutes to nearest station
 | 
Shared

 | 
3
 | 
Living room and kitchen space
 | 
20
 | 
Living room and kitchen ratings, the two space questions, floor area
 | 
Personal ratings + shared floor area

 | 
4
 | 
Park nearby
 | 
12
 | 
Walking minutes to nearest park of 1 ha or more
 | 
Shared

 | 
5
 | 
Supermarket nearby
 | 
12
 | 
Walking minutes to nearest full-size supermarket
 | 
Shared

 | 
6
 | 
Rest of the home
 | 
8
 | 
Bedrooms, bathrooms, outdoor space, storage, light, condition, noise, layout, street feel
 | 
Personal

 | 
7
 | 
Gym and restaurants
 | 
4
 | 
Walking minutes to nearest gym and restaurant cluster
 | 
Shared

 | 
8
 | 
Gut feel
 | 
4
 | 
Could you see yourselves living here?
 | 
Personal

 | 
 | 
Total
 | 
100
 | 
 | 

 | 
—
 | 
Pros and cons adjustment
 | 
±10 cap
 | 
Impact of each bullet
 | 
Personal

The first five criteria carry 84% of the score because they are the brief's must-haves; living without a car makes the park and supermarket as important as each other. The remaining 16% rewards a good home and a good feeling about it without letting them override location and price.

### 6.3 Sub-score curves

Each criterion produces a sub-score from 0 to 1, which is multiplied by its weight. Curves are piecewise-linear between the breakpoints below; values between breakpoints are interpolated, and values beyond the last breakpoint take its value.

Budget fit. £750,000 is a hard maximum. Below it, more headroom scores higher, because money left over covers stamp duty (about £27,500 at £750,000), fees and work on the home. The effective price is the accepted offer, else the latest offer, else the asking price. For Offers in excess of and Offers over listings, the sub-score uses the asking price plus 2% (configurable, capped at £750,000), but the hard gate uses the asking price itself, so such a home is not ruled out on a guess.

 | 
Effective price
 | 
Sub-score

 | 
£650,000 or less
 | 
1.00

 | 
£700,000
 | 
0.85

 | 
£750,000
 | 
0.60

 | 
Above £750,000
 | 
Ruled out (hard gate, 6.5)

Walking-time curves (minutes → sub-score).

 | 
Minutes
 | 
Station
 | 
Park
 | 
Supermarket
 | 
Gym, restaurants (each)

 | 
0–5
 | 
1.00
 | 
1.00
 | 
1.00
 | 
1.00

 | 
10
 | 
0.85
 | 
0.70
 | 
0.75
 | 
0.70

 | 
15
 | 
0.60
 | 
0.30
 | 
0.35
 | 
—

 | 
20
 | 
0.10
 | 
0.00
 | 
—
 | 
0.20

 | 
25
 | 
0.00
 | 
0.00
 | 
0.00
 | 
—

 | 
30
 | 
0.00
 | 
0.00
 | 
0.00
 | 
0.00

The station curve stays generous up to 15 minutes and drops steeply after, matching the 15-minute limit. If the nearest full-size supermarket is over 10 minutes but a convenience store is within 5, the supermarket sub-score gets +0.10 (capped at 1). The gym and restaurants criterion is the average of the two.

Living room and kitchen space. R is the mean of four 1–5 answers (living room rating, kitchen rating, and the two space questions), normalised as (mean − 1) ÷ 4. A is the floor-area sub-score:

 | 
Floor area
 | 
550 sq ft or less
 | 
650
 | 
800
 | 
1,000 or more

 | 
A
 | 
0.10
 | 
0.40
 | 
0.70
 | 
1.00

Space sub-score = 0.6 × R + 0.4 × A. If floor area is unknown, the sub-score is R alone. Before anyone has rated the home, it is A alone (provisional).

Rest of the home and gut feel. The mean of the relevant 1–5 ratings, normalised as (mean − 1) ÷ 4; items marked N/A are excluded.

### 6.4 Pros and cons adjustment

Each bullet adds or subtracts points by impact: Minor 1, Moderate 2.5, Major 5. A bullet linked to a criterion that is already scored (for example kitchen is small linked to Space) counts at half value, so the same fact is not counted twice. The net adjustment per buyer is capped at +10 and −10, so free-text opinions can move a home up or down a tier but cannot outweigh the must-haves.

### 6.5 Gates

Hard gates put the home in Ruled out, whatever its score (the score stays visible, greyed):

Asking price or latest offer above £750,000. A home ruled out on budget returns to active if an offer at or under £750,000 is accepted.

A con flagged as a deal-breaker by either buyer — a veto, which the buyer who set it can lift.

Manually ruled out.

Soft gates apply when a must-have is breached:

Station walk over 15 minutes.

Park walk over 15 minutes.

Supermarket walk over 15 minutes.

Space ratings averaging 2 or less (R ≤ 0.25) — not decently spacious.

Each breached soft gate subtracts 5 points and caps the home's tier at Strong contender, so it can never be a Top pick. Separately, an amber flag (no penalty) shows when the park or supermarket is over 10 minutes, as an early warning.

### 6.6 Formula

For buyer i, with criterion weights w, sub-scores s, pros and cons adjustment Adj, and n soft gates breached:

If only one buyer has rated, the combined score is that buyer's score, labelled 1 of 2 rated.

If neither has rated, the provisional score uses only criteria with data: the sum of available points divided by the sum of available weights, × 100. It is labelled Provisional and shows which inputs are missing.

A disagreement of 10 points or more shows a marker on the card and a prompt on the property page: You see this one differently — talk it through.

Scores are stored at full precision, shown to one decimal in the breakdown and as a whole number in the score ring.

### 6.7 Worked example

A two-bed flat, guide price £735,000, 880 sq ft, 92-year lease. Station 9 min, park 4 min, full-size supermarket 12 min, gym 8 min, restaurants 6 min.

 | 
Criterion
 | 
Input (Buyer A)
 | 
Sub-score
 | 
Weight
 | 
Points A
 | 
Points B

 | 
Budget fit
 | 
£735,000
 | 
0.68
 | 
20
 | 
13.5
 | 
13.5

 | 
Station walk
 | 
9 min
 | 
0.88
 | 
20
 | 
17.6
 | 
17.6

 | 
Space
 | 
Ratings 4, 3, 4, 3; 880 sq ft
 | 
0.70
 | 
20
 | 
14.1
 | 
12.6

 | 
Park nearby
 | 
4 min
 | 
1.00
 | 
12
 | 
12.0
 | 
12.0

 | 
Supermarket nearby
 | 
12 min
 | 
0.59
 | 
12
 | 
7.1
 | 
7.1

 | 
Rest of the home
 | 
Mean rating 3.5
 | 
0.63
 | 
8
 | 
5.0
 | 
4.0

 | 
Gym and restaurants
 | 
8 and 6 min
 | 
0.88
 | 
4
 | 
3.5
 | 
3.5

 | 
Gut feel
 | 
4
 | 
0.75
 | 
4
 | 
3.0
 | 
2.0

 | 
Weighted subtotal
 | 
 | 
 | 
100
 | 
75.8
 | 
72.3

 | 
Pros and cons
 | 
 | 
 | 
 | 
−0.3
 | 
−2.5

 | 
Soft gates
 | 
None breached
 | 
 | 
 | 
0
 | 
0

 | 
Buyer score
 | 
 | 
 | 
 | 
75.5
 | 
69.8

Buyer A's pros and cons: south-facing garden (pro, Major, +5); quiet street (pro, Minor, +1); kitchen needs replacing (con, Moderate, linked to Space, −1.25); lease will need extending (con, Major, −5). Buyer B rated the space 3 across the board, the rest of the home 3.0 and gut feel 3, and added: south-facing garden (+5), lease will need extending (−5), main road at the end of the street (con, Moderate, −2.5).

Combined score: (75.5 + 69.8) ÷ 2 = 72.6 → Strong contender. At £735,000 the home leaves only £15,000 of headroom, which costs it 6.5 of the 20 budget points; Buyer B alone would place it in Maybe. The 5.8-point gap is under the disagreement threshold, so no marker shows. Claude Code should encode this example as a golden unit test.

## 7. Priority and ranking

Every active home sits in one of five tiers set by its combined score and gates, and gets a rank number across all active homes, so the buyers always know which home is first in line.

 | 
Tier
 | 
Rule
 | 
Suggested next step shown in the app

 | 
Top pick
 | 
Combined score 80 or more and no soft gate breached
 | 
Book a second viewing or prepare an offer

 | 
Strong contender
 | 
70 to 79.9, or 80+ with a soft gate breached
 | 
Second viewing; check the weak criterion

 | 
Maybe
 | 
55 to 69.9
 | 
Keep as back-up; revisit if the market is thin

 | 
Unlikely
 | 
Below 55
 | 
Consider ruling out

 | 
Ruled out
 | 
Any hard gate, or manually ruled out
 | 
None; kept for reference

### Ranking rules

Rank only homes whose status is active (Shortlisted to Offer made); Ruled out, withdrawn and sold homes are excluded.

Order by tier, then by combined score, highest first.

Tie-break (scores within 0.5 points): shorter station walk, then lower effective price, then most recent viewing.

Provisional scores (not yet viewed) are ranked in a separate To view group beneath the viewed tiers, ordered by provisional score, so they guide which viewings to book first without competing with homes you have actually seen.

Either buyer can pin a home to the top of its tier with a short reason (for example We both loved the light). Pins never move a home across tiers and are shown with a pin icon, so the algorithm stays honest.

### Rank movement

When a new assessment or a settings change moves a home up or down, the board shows a small arrow and the size of the move (for example ▲2) until the buyers next open the board, so changes are noticed.

## 8. Data model

Fifteen tables in Postgres, all scoped to a household so row-level security can keep the data private to the two buyers.

 | 
Entity
 | 
Key fields
 | 
Notes

 | 
household
 | 
id, name, created_at
 | 
One row in v1

 | 
member
 | 
id, household_id, user_id, display_name, colour
 | 
The two buyers; colour used for avatars and per-person scores

 | 
scoring_config
 | 
household_id, budget, budget_curve (json), qualifier_uplift, weights (json), curves (json), soft_gate_thresholds (json), tier_cutoffs (json), sdlt_rates (json), version
 | 
One active row per household; versioned so old score snapshots stay explainable

 | 
property
 | 
id, household_id, status, portal, listing_url, listing_id, asking_price, price_qualifier, property_type, beds, baths, receptions, floor_area_sqft, tenure, lease_years, service_charge, ground_rent, council_tax_band, epc, address, postcode, lat, lng, address_precision, key_features, description, cover_image_path, default_agent_id, pinned_by, pin_reason, ruled_out_reason, archived_at
 | 
address_precision is exact or approximate

 | 
property_field_source
 | 
property_id, field, source (fetched, inferred, manual), updated_at
 | 
Drives the fetched / inferred / missing badges

 | 
status_event
 | 
id, property_id, from_status, to_status, member_id, at
 | 
Lifecycle history

 | 
agent
 | 
id, household_id, name, agency, branch, phone, mobile, email, notes
 | 

 | 
viewing
 | 
id, property_id, agent_id, starts_at, duration_min, status, attendees (member ids), notes, kind (first, second, survey)
 | 

 | 
assessment
 | 
id, property_id, viewing_id, member_id, ratings (json, keyed by item), space_living, space_kitchen, gut_feel, note, submitted_at, updated_at
 | 
One current assessment per member per property; history kept by updated_at

 | 
pro_con
 | 
id, property_id, member_id, kind (pro, con), text, impact (minor, moderate, major), criterion (nullable), deal_breaker, position, agreed_from_id
 | 
agreed_from_id set when copied via Agree

 | 
proximity
 | 
id, property_id, category (station, park, supermarket, convenience, gym, restaurants), place_name, place_lat, place_lng, walk_min, walk_m, source (auto, manual), edited_by, calculated_at
 | 
One row per category

 | 
offer
 | 
id, property_id, amount, made_at, conditions, response, responded_at, outcome
 | 

 | 
score_snapshot
 | 
id, property_id, config_version, member_scores (json), combined, provisional, tier, rank, breakdown (json), soft_gates (json), hard_gate, created_at
 | 
Written on every change; the latest row drives the board

 | 
photo / note
 | 
id, property_id, member_id, storage_path or text, created_at
 | 
Own photos and notes

The rating keys in assessment.ratings are a fixed enum shared with the scoring module: living_room, kitchen, bedroom_1…bedroom_n, bathrooms, outdoor, storage, light, condition, noise, layout, street.

## 9. Technical architecture

Build it as one Next.js web app on Vercel with Supabase for the database, sign-in and file storage; three server-side services handle listing import, walking times and scoring.

Only the import and proximity services call outside the app; scoring runs entirely inside it, so scores never depend on a third party being up.

### 9.1 Stack

 | 
Layer
 | 
Choice
 | 
Why

 | 
Front end
 | 
Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui components
 | 
One codebase for phone and laptop; fast to build with Claude Code

 | 
App shell
 | 
PWA: web manifest, service worker, IndexedDB for offline assessment drafts
 | 
Home-screen install and doorstep use with weak signal

 | 
Back end
 | 
Next.js route handlers and server actions
 | 
No separate server to run

 | 
Database and auth
 | 
Supabase: Postgres with row-level security, email magic-link auth, Storage for images
 | 
Private to two users with little setup; free tier is enough for one household

 | 
Hosting
 | 
Vercel
 | 
Zero-config deploys from GitHub; preview URLs for each change

 | 
Scoring
 | 
packages/scoring: a pure TypeScript module shared by server and client
 | 
Same result everywhere; easy to unit-test

 | 
Tests
 | 
Vitest for units (scoring, parsers), Playwright for key journeys
 | 
Golden tests protect the algorithm

### 9.2 Listing import service

POST /api/import { url } runs on the server:

Validate the URL against an allow-list of portal hosts and normalise it (strip tracking parameters).

Fetch the page once, with a 10-second timeout and a browser-like user agent. No crawling, no background polling.

Run the portal's parser (one adapter per portal behind a common interface) over embedded page data, then JSON-LD, then Open Graph tags. Parsers are tested against saved HTML fixtures so changes to a portal's page show up as failing tests.

If fewer than four core fields are found, send the visible page text to the Claude API with a strict JSON output schema; mark the results inferred.

Download the first image, resize it (sharp) to 1600 px and a 400 px thumbnail, and store both privately in Supabase Storage.

Return the draft property with per-field source flags for the import preview. Nothing is saved until the user confirms.

Portal terms. The major portals' terms restrict automated collection of their content, and they may block server requests. The app stays on the right side of this by fetching only the single page a buyer pastes, for the household's own use, and by always offering the paste-text and manual fallbacks. If fetching proves unreliable, an adapter can be swapped for a paid listing-data provider without changing the rest of the app.

### 9.3 Proximity service

POST /api/proximity { propertyId }, triggered after save and when the address changes:

Coordinates from the listing; otherwise geocode the postcode with postcodes.io (free, UK-specific).

Candidate places within 2 km:

Stations and parks from OpenStreetMap via the Overpass API, which includes park boundaries, so the 1-hectare rule can be applied.

Supermarkets, gyms and restaurants from Google Places (Nearby Search), filtered by the brand list for full-size supermarkets.

Walking times for the closest few candidates per category from a routing API (Google Routes in walking mode by default; OpenRouteService as a configurable free alternative). Keep the shortest walk, not the shortest straight line.

Save one proximity row per category; manual overrides are never overwritten by recalculation unless the user resets them.

All map providers sit behind one interface so the household can switch provider if costs or accuracy disappoint. Expected volume is a few hundred calls a month.

### 9.4 Scoring service

score(property, proximity, assessments, prosCons, offers, config) → { memberScores, combined, provisional, softGates, hardGate, tier, breakdown } is a pure function in packages/scoring. A server action calls it after any write that affects inputs, writes a score_snapshot, then re-ranks all active properties in the household in one transaction.

### 9.5 Security and configuration

Row-level security on every table: a row is visible only to members of its household.

Secrets (Supabase service key, Google Maps key, Claude API key) in Vercel environment variables, never in the client bundle; map keys restricted by API and referrer.

Image and photo buckets are private; the app serves them through signed URLs.

### 9.6 Suggested repository layout

## 10. Non-functional requirements

 | 
Area
 | 
Requirement

 | 
Privacy
 | 
Data visible only to the two household members. No analytics or third-party trackers. Agent contact details are kept only for the duration of the search and can be deleted in bulk.

 | 
Security
 | 
Magic-link sign-in with sessions of 30 days on trusted devices; row-level security on every table; secrets only on the server; HTTPS only.

 | 
Performance
 | 
Board loads in under 2 seconds on 4G with 100 properties; score recalculation and re-rank in under 500 ms; listing import returns a preview in under 8 seconds or fails with a clear message.

 | 
Offline
 | 
The schedule for the next 7 days, property pages for booked viewings and the assessment stepper work offline; drafts sync automatically, with a visible Saved on this phone / Synced state.

 | 
Concurrency
 | 
Both buyers can edit at once; shared facts use last-write-wins with an edited by badge; personal assessments never conflict. Board updates live (Supabase Realtime).

 | 
Accessibility
 | 
WCAG 2.2 AA: contrast, 44 px tap targets, labels on every control, scores never conveyed by colour alone (number and label always shown).

 | 
Browsers
 | 
Latest two versions of Safari (iOS and macOS), Chrome and Edge. Layouts from 360 px wide to 1440 px.

 | 
Reliability
 | 
Daily database backup; listing images stored in the app, so cards survive removed listings.

 | 
Cost
 | 
Run within free tiers for hosting and database; maps and AI calls expected to cost a few pounds a month at most; a monthly usage cap set on each API key.

 | 
Locale
 | 
British English, £ with thousands separators, sq ft first with m² secondary, dates as Sat 14 Nov, 24-hour or 12-hour time per device setting.

## 11. Design direction

The app should feel like a calm, well-made home journal rather than a property portal or a spreadsheet: photos lead, scores are clear but not shouty, and the doorstep assessment is quick enough to do one-handed.

Tone. Warm, confident, uncluttered. Generous white space, soft neutral background, one accent colour. Avoid estate-agent visual clichés (red price banners, stock skylines).

Typography. A modern humanist sans for interface text; tabular numerals for prices, minutes and scores so columns line up.

Colour roles.

Neutral surfaces for most of the interface; one accent (for example a deep green) for primary actions.

Tier colours, always paired with the tier name: Top pick (green), Strong contender (teal), Maybe (amber), Unlikely (grey), Ruled out (muted, struck through).

Amber for soft-gate warnings, red only for hard gates and deal-breakers.

Each buyer has a personal colour used on avatars, their ratings and their pros and cons.

Full light and dark themes.

Key components.

Property card — 4:3 photo, price, beds/baths/sq ft, area, status chip, score ring with tier label, rank badge, gate icons, disagreement marker.

Score ring — 0–100 with the number in the centre; Provisional shown as a dashed ring.

Criterion row — icon, name, input (for example 9 min walk to Clapham Junction style text), a small bar for the sub-score, points out of weight.

Rating control — five large tappable segments labelled Poor to Excellent, plus N/A.

Walk-time chip — mode icon, minutes, place name, Auto or Edited badge, amber when over threshold.

Pros and cons list — two columns on laptop, stacked on phone, with impact dots (one, two or three) and a deal-breaker tag.

Import preview — field-by-field, with fetched, inferred and missing states visually distinct.

States to design. Empty board, import loading, import partial success, import blocked (with paste and manual fallbacks), offline with unsynced draft, provisional score, one of two rated, disagreement, soft gate breached, ruled out.

Mock-up deliverables for Claude Design. Mobile (390 px) and laptop (1440 px) versions of S1 Board, S2 Add property (including the preview and blocked states), S3 Property detail (Score and Our ratings tabs), S5 Assessment stepper (all six steps on mobile), S7 Compare (laptop), and S9 Settings (weights). Use realistic London sample data: five homes between £640,000 and £750,000 across tiers, plus one over-budget home shown as Ruled out, including the worked example from section 6.7.

## 12. Build plan

Build in seven milestones, each ending with something usable, so you can start logging real viewings after milestone 3 and get scores after milestone 5.

Foundations — repository, Next.js app, Supabase project, migrations, row-level security, magic-link sign-in, household with two members, deploy to Vercel.

Both buyers can sign in on phone and laptop and see an empty board; a third email address cannot see any data.

Properties, agents and import — FR-P, FR-A and FR-I: add by link with preview, manual entry, cover image stored, agents linked, statuses and history.

A pasted link from each supported portal produces a preview with photo, price, beds, baths and address in under 8 seconds, or a clear fallback.

Parser tests pass against saved HTML fixtures for all three portals.

Viewings and schedule — FR-V: viewings, Schedule and Today views, .ics download, clash warning.

A viewing added on one phone appears on the other within 5 seconds; the .ics opens correctly in Apple Calendar and Google Calendar.

Assessment and pros and cons — FR-R and FR-C: mobile stepper, private-until-submitted ratings, pros and cons with impact, criterion links, deal-breakers, Agree, offline drafts.

An assessment started in flight mode saves locally and syncs on reconnect without loss.

Proximity and scoring — FR-L and FR-S: walking times with overrides, the scoring package, provisional and full scores, gates, tiers, ranking, score breakdown.

The golden test reproduces the worked example in section 6.7 exactly (75.5, 69.8, combined 72.6, Strong contender).

Unit tests cover every curve breakpoint, the pros and cons cap, each soft gate, each hard gate, provisional scoring and tie-breaks.

Compare, settings and costs — S7 Compare, S9 Settings with weight sliders summing to 100, stamp duty estimate, offers, CSV and JSON export.

Changing a weight re-scores and re-ranks every home in under 500 ms and the board shows rank movement.

Polish and PWA — install prompt, push reminders, dark theme, accessibility pass, empty and error states, performance budget.

Lighthouse PWA and accessibility checks pass; the board meets the 2-second load target on a throttled 4G profile.

Working with Claude Code. Hand it this PRD as docs/PRD.md plus the approved mock-ups, and ask it to work one milestone at a time: plan, build, run the tests, then stop for review. Keep requirement IDs in commit messages so changes trace back to this document.

## 13. Assumptions, risks and open questions

### Assumptions

Purchase is in England, so stamp duty (SDLT) applies and both buyers are first-time buyers.

Homes are found on Rightmove, Zoopla and OnTheMarket; other links (agent websites) go through the paste-text or manual route.

"Station" means any rail, Tube, Overground, Elizabeth line or DLR station; all count equally in v1.

The budget applies to the purchase price, not the total cost including stamp duty and fees.

Default weights and thresholds in section 6 reflect the brief's order of priorities and will be tuned after the first 10 viewings.

### Risks

 | 
Risk
 | 
Likelihood
 | 
Impact
 | 
Mitigation

 | 
Portals block or change their pages, breaking import
 | 
High
 | 
Medium
 | 
Single user-initiated fetches only; parser fixtures catch changes; AI extraction from pasted text; manual entry; swappable adapter

 | 
Walking times differ from reality (crossings, closed paths, partial postcodes)
 | 
Medium
 | 
Medium
 | 
Shortest routed walk, not straight line; approximate flag for partial postcodes; easy manual override

 | 
Maps API needs a billing account and could incur cost
 | 
Medium
 | 
Low
 | 
Monthly cap on the key; caching per property; free OpenStreetMap and OpenRouteService alternative behind the same interface

 | 
Score doesn't match the buyers' instincts
 | 
Medium
 | 
High
 | 
Transparent breakdown, editable weights, gut-feel criterion, pins, a tuning check after 10 viewings

 | 
Scope creep delays use during the active search
 | 
Medium
 | 
High
 | 
Milestones 1–4 are usable on their own; phase 2 items stay out of the MVP

### Open questions

Resolved: £750,000 is a hard maximum, and headroom below it is scored.

Is a short lease a must-have? Proposal: automatically add a Major con when a leasehold has under 90 years left, and a deal-breaker under 80.

Should outdoor space (garden, balcony or terrace) become a must-have or stay inside Rest of the home?

Minimum bedrooms: should a one-bed be ruled out automatically?

Commute: do you want walking or public transport time to one or two regular destinations as an extra criterion in phase 2?

Any specific stations or lines that should score higher (for example a direct line to work)?

Which calendar do you both use, for the phase 2 calendar sync?

## 14. Hand-off prompts

Export this doc as Markdown, attach it, and use these prompts as the opening message in each tool.

### For Claude Design (mock-up)

### For Claude Code (build)
