-- HomeHunt schema (PRD section 8). Every table is scoped to a household and
-- protected by row-level security, so only the two members can see anything.

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
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  colour text not null default '#2B5C8A',
  email text,
  unique (household_id, user_id)
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

-- ------------------------------------------------------- access helpers
-- security definer so policies can look at members without recursing into
-- their own policy.

create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.household_id = h and m.user_id = auth.uid());
$$;

create or replace function public.is_property_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.properties pr join public.members m on m.household_id = pr.household_id
    where pr.id = p and m.user_id = auth.uid()
  );
$$;

create or replace function public.owns_member(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.id = mid and m.user_id = auth.uid());
$$;

-- "I have submitted my own rating for this home": the gate on seeing the other buyer's.
create or replace function public.i_submitted(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments a join public.members m on m.id = a.member_id
    where a.property_id = p and m.user_id = auth.uid() and a.submitted_at is not null
  );
$$;

-- ------------------------------------------------------------ row-level security

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.scoring_config enable row level security;
alter table public.properties enable row level security;
alter table public.status_events enable row level security;
alter table public.agents enable row level security;
alter table public.viewings enable row level security;
alter table public.assessments enable row level security;
alter table public.pro_cons enable row level security;
alter table public.proximity enable row level security;
alter table public.offers enable row level security;
alter table public.notes enable row level security;
alter table public.photos enable row level security;
alter table public.score_snapshots enable row level security;

create policy households_read on public.households for select using (public.is_member(id));
create policy households_update on public.households for update using (public.is_member(id));

create policy members_read on public.members for select using (public.is_member(household_id));
create policy members_update on public.members for update using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy scoring_config_all on public.scoring_config for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy properties_all on public.properties for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy agents_all on public.agents for all using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy status_events_all on public.status_events for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));
create policy viewings_all on public.viewings for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));
create policy proximity_all on public.proximity for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));
create policy offers_all on public.offers for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));
create policy notes_all on public.notes for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));
create policy photos_all on public.photos for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));
create policy score_snapshots_all on public.score_snapshots for all using (public.is_property_member(property_id)) with check (public.is_property_member(property_id));

-- Assessments and pros/cons are personal: you always see your own; you see the
-- other buyer's only once you have submitted yours (FR-R1). Only the owner can write.
create policy assessments_read on public.assessments for select using (
  public.owns_member(member_id) or (public.is_property_member(property_id) and submitted_at is not null and public.i_submitted(property_id))
);
create policy assessments_write on public.assessments for insert with check (public.owns_member(member_id) and public.is_property_member(property_id));
create policy assessments_update on public.assessments for update using (public.owns_member(member_id)) with check (public.owns_member(member_id));
create policy assessments_delete on public.assessments for delete using (public.owns_member(member_id));

create policy pro_cons_read on public.pro_cons for select using (
  public.owns_member(member_id) or (public.is_property_member(property_id) and public.i_submitted(property_id))
);
create policy pro_cons_write on public.pro_cons for insert with check (public.owns_member(member_id) and public.is_property_member(property_id));
create policy pro_cons_update on public.pro_cons for update using (public.owns_member(member_id)) with check (public.owns_member(member_id));
create policy pro_cons_delete on public.pro_cons for delete using (public.owns_member(member_id));

-- ------------------------------------------------------------ realtime

alter publication supabase_realtime add table
  public.properties, public.status_events, public.agents, public.viewings, public.assessments,
  public.pro_cons, public.proximity, public.offers, public.notes, public.photos,
  public.score_snapshots, public.scoring_config, public.members;

-- ------------------------------------------------------------ storage (private buckets)

insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', false), ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

-- Files live under <household id>/...; a member can touch only their own household's folder.
create policy listing_images_read on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy property_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'property-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy property_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'property-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy property_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'property-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ------------------------------------------------------------ one-off setup

-- Run once in the SQL editor, after inviting both people under Authentication > Users:
--   select public.bootstrap_household('Our home', 'a@example.com', 'Saurabh', 'b@example.com', 'Vedika');
-- No sign-up flow exists: only these two users are linked to a household.
create or replace function public.bootstrap_household(h_name text, email_a text, name_a text, email_b text, name_b text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  hid uuid;
  ua uuid;
  ub uuid;
begin
  if exists (select 1 from public.households) then
    raise exception 'A household already exists. HomeHunt supports one household.';
  end if;
  select id into ua from auth.users where lower(email) = lower(email_a);
  select id into ub from auth.users where lower(email) = lower(email_b);
  if ua is null or ub is null then
    raise exception 'Invite both people under Authentication > Users first, then run this again.';
  end if;
  insert into public.households (name) values (h_name) returning id into hid;
  insert into public.members (household_id, user_id, display_name, colour, email) values
    (hid, ua, name_a, '#2B5C8A', email_a), (hid, ub, name_b, '#7A3E8E', email_b);
  return hid;
end $$;
revoke all on function public.bootstrap_household(text, text, text, text, text) from public, anon, authenticated;
