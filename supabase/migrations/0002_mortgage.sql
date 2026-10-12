-- HomeHunt mortgage planner (milestone 8): scenarios, overpayment plans and settings.
-- Run this once in the Supabase SQL editor, after 0001_init.sql. Safe to run again.
-- Only inputs are stored, never results: the app recalculates them in milliseconds.

create table if not exists public.mortgage_scenarios (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  note text,
  colour text not null default '#17805A',
  property_id uuid references public.properties (id) on delete set null,
  -- Null with a property means "follow that home's price".
  price numeric check (price is null or price > 0),
  deposit_amount numeric not null check (deposit_amount >= 0),
  term_months int not null check (term_months between 12 and 600),
  initial_rate numeric not null check (initial_rate > 0 and initial_rate <= 15),
  initial_period_months int not null default 60 check (initial_period_months >= 0),
  -- Null means the same as the initial rate ("assume we remortgage on similar terms").
  follow_on_rate numeric check (follow_on_rate is null or (follow_on_rate > 0 and follow_on_rate <= 15)),
  fee_amount numeric not null default 999 check (fee_amount >= 0),
  fee_added_to_loan boolean not null default false,
  other_costs numeric not null default 2500 check (other_costs >= 0),
  sdlt_override numeric,
  completion_date date,
  is_preferred boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one "our plan" per household.
create unique index if not exists mortgage_scenarios_one_preferred
  on public.mortgage_scenarios (household_id) where is_preferred;

create table if not exists public.overpayment_plans (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.mortgage_scenarios (id) on delete cascade,
  type text not null check (type in ('annual_amount','annual_percent','monthly_amount','lump_sum')),
  amount numeric,
  percent numeric,
  start_month int not null default 1 check (start_month >= 1),
  end_month int,
  annual_increase_pct numeric not null default 0,
  mode text not null default 'shorten_term' check (mode in ('shorten_term','lower_payment')),
  lump_sum_month int,
  unique (scenario_id)
);

create table if not exists public.mortgage_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  allowance_pct numeric not null default 10,
  erc_pct numeric,
  default_term_months int not null default 360,
  default_initial_period_months int not null default 60,
  default_fee numeric not null default 999,
  default_other_costs numeric not null default 2500,
  ltv_rate_presets jsonb not null default '[{"ltv":60,"rate":4.6},{"ltv":75,"rate":4.85},{"ltv":80,"rate":5.0},{"ltv":85,"rate":5.15},{"ltv":90,"rate":5.35},{"ltv":95,"rate":5.6}]',
  income_multiple numeric not null default 4.5,
  combined_income numeric,
  show_monthly_on_board boolean not null default false
);

-- Same open access as the rest of the app (no accounts; see 0001_init.sql).
do $$
declare t text;
begin
  foreach t in array array['mortgage_scenarios','overpayment_plans','mortgage_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_open') then
      execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || '_open', t);
    end if;
  end loop;
end $$;

-- Live sync between your two phones.
do $$
declare t text;
begin
  foreach t in array array['mortgage_scenarios','overpayment_plans','mortgage_settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- One settings row for the household, with the defaults above.
insert into public.mortgage_settings (household_id)
select id from public.households h
where not exists (select 1 from public.mortgage_settings s where s.household_id = h.id);
