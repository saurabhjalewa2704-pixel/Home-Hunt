-- HomeHunt schema (PRD section 8) for ONE household of two people, with no sign-in.
-- Each person just picks their name in the app. Because there are no accounts, the
-- database is open to anyone holding the project's public (anon) key: treat the
-- deployed URL as private, and see the README for how to lock it down further.
-- Starts empty: no homes, only the household and its two members.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  colour text not null default '#2B5C8A',
  unique (household_id, display_name)
);

create table public.scoring_config (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  version int not null,
  config jsonb not null,
  buyer_type text not null default 'first_time' check (buyer_type in ('first_time', 'standard')),
  created_at timestamptz not null default now(),
  unique (household_id, version)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  status text not null default 'shortlisted'
    check (status in ('shortlisted','viewing_booked','viewed','second_viewing','offer_made','offer_accepted','ruled_out','withdrawn','sold')),
  portal text check (portal in ('rightmove','zoopla','onthemarket')),
  listing_url text,
  listing_id text,
  asking_price numeric not null check (asking_price > 0),
  price_qualifier text check (price_qualifier in ('guide','offers_over','offers_in_excess','fixed')),
  property_type text,
  beds numeric,
  baths numeric,
  receptions numeric,
  floor_area_sqft numeric,
  tenure text check (tenure in ('freehold','leasehold','share_of_freehold')),
  lease_years numeric,
  service_charge numeric,
  ground_rent numeric,
  council_tax_band text,
  epc text,
  address text not null,
  postcode text,
  lat double precision,
  lng double precision,
  address_precision text not null default 'exact' check (address_precision in ('exact','approximate')),
  key_features text[] not null default '{}',
  description text,
  cover_image_path text,
  image_urls text[] not null default '{}',
  -- Replaces the separate property_field_source table: fetched / inferred / manual per field.
  field_sources jsonb not null default '{}',
  default_agent_id uuid,
  pinned_by uuid references public.members (id) on delete set null,
  pin_reason text,
  ruled_out_reason text,
  archived_at timestamptz,
  tint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.properties (household_id);
create unique index properties_listing_unique on public.properties (household_id, listing_id) where listing_id is not null and archived_at is null;

create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  from_status text,
  to_status text not null,
  member_id uuid references public.members (id) on delete set null,
  at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  agency text, branch text, phone text, mobile text, email text, notes text
);
alter table public.properties add constraint properties_agent_fk foreign key (default_agent_id) references public.agents (id) on delete set null;

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  starts_at timestamptz not null,
  duration_min int not null default 30,
  status text not null default 'booked' check (status in ('booked','done','cancelled','no_show')),
  attendees text[] not null default '{}',
  notes text,
  kind text not null default 'first' check (kind in ('first','second','survey'))
);
create index on public.viewings (property_id, starts_at);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  viewing_id uuid references public.viewings (id) on delete set null,
  member_id uuid not null references public.members (id) on delete cascade,
  ratings jsonb not null default '{}',
  space_living int check (space_living between 1 and 5),
  space_kitchen int check (space_kitchen between 1 and 5),
  gut_feel int check (gut_feel between 1 and 5),
  note text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (property_id, member_id)
);

create table public.pro_cons (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('pro','con')),
  text text not null,
  impact text not null default 'moderate' check (impact in ('minor','moderate','major')),
  criterion text check (criterion in ('budget','station','space','park','supermarket','rest','extras','gut')),
  deal_breaker boolean not null default false,
  position int not null default 0,
  agreed_from_id uuid references public.pro_cons (id) on delete set null,
  check (not deal_breaker or kind = 'con')
);

create table public.proximity (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  category text not null check (category in ('station','park','supermarket','convenience','gym','restaurants')),
  place_name text not null,
  place_lat double precision,
  place_lng double precision,
  walk_min int not null check (walk_min >= 0),
  walk_m int,
  source text not null default 'auto' check (source in ('auto','manual')),
  edited_by uuid references public.members (id) on delete set null,
  calculated_at timestamptz not null default now(),
  method text check (method in ('routed','estimated')),
  unique (property_id, category)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  amount numeric not null check (amount > 0),
  made_at timestamptz not null default now(),
  conditions text,
  response text,
  responded_at timestamptz,
  outcome text not null default 'pending' check (outcome in ('pending','accepted','rejected','countered'))
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  config_version int not null,
  combined numeric not null,
  provisional boolean not null default false,
  tier text not null,
  rank int,
  member_scores jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.score_snapshots (property_id, created_at desc);

-- ------------------------------------------------------------ access
-- No accounts: the anon role may read and write everything in the app's tables.
-- Which buyer's ratings are shown is decided in the app, not the database.

do $$
declare t text;
begin
  foreach t in array array['households','members','scoring_config','properties','status_events','agents','viewings',
    'assessments','pro_cons','proximity','offers','notes','photos','score_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || '_open', t);
  end loop;
end $$;

-- Members are created below, once; the app may only rename them.
drop policy members_open on public.members;
create policy members_read on public.members for select to anon, authenticated using (true);
create policy members_update on public.members for update to anon, authenticated using (true) with check (true);
-- Likewise the household row.
drop policy households_open on public.households;
create policy households_read on public.households for select to anon, authenticated using (true);
create policy households_update on public.households for update to anon, authenticated using (true) with check (true);

-- ------------------------------------------------------------ realtime

alter publication supabase_realtime add table
  public.properties, public.status_events, public.agents, public.viewings, public.assessments,
  public.pro_cons, public.proximity, public.offers, public.notes, public.photos,
  public.score_snapshots, public.scoring_config, public.members;

-- ------------------------------------------------------------ storage (private buckets)

insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', false), ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

-- Listing images are written by the server (service role) and read through signed URLs.
-- Photos you take are uploaded straight from the browser.
create policy property_photos_all on storage.objects for all to anon, authenticated
  using (bucket_id = 'property-photos') with check (bucket_id = 'property-photos');
create policy listing_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-images');

-- ------------------------------------------------------------ the household (clean slate)

with h as (
  insert into public.households (name) select 'Saurabh and Vedika' where not exists (select 1 from public.households) returning id
)
insert into public.members (household_id, display_name, colour)
select h.id, v.n, v.c from h, (values ('Saurabh', '#2B5C8A'), ('Vedika', '#7A3E8E')) as v (n, c);
