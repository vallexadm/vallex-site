-- VALLEX subscription checkout foundation (ASAAS Sandbox).
-- Apply this migration in Supabase SQL Editor before enabling the checkout route.

alter table public.plans
  add column if not exists monthly_price numeric(10, 2) not null default 0,
  add column if not exists is_public boolean not null default false;

update public.plans
set monthly_price = case code
  when 'free' then 0
  when 'basic' then 49.70
  when 'professional' then 79.00
  when 'enterprise' then 390.00
  else monthly_price
end,
is_public = code in ('free', 'basic', 'professional'),
max_users = case code
  when 'free' then 1
  when 'basic' then 3
  when 'professional' then 10
  else max_users
end
where code in ('free', 'basic', 'professional', 'enterprise');

create table if not exists public.asaas_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  created_by uuid not null,
  external_reference text not null unique,
  asaas_checkout_id text unique,
  checkout_url text,
  asaas_customer_id text,
  asaas_subscription_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'canceled', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asaas_checkout_sessions_org_status_idx
  on public.asaas_checkout_sessions (organization_id, status, created_at desc);

create index if not exists asaas_checkout_sessions_customer_idx
  on public.asaas_checkout_sessions (asaas_customer_id)
  where asaas_customer_id is not null;

create table if not exists public.asaas_webhook_events (
  event_id text primary key,
  event_name text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  process_error text
);

alter table public.asaas_checkout_sessions enable row level security;
alter table public.asaas_webhook_events enable row level security;
grant select, insert, update on table public.organization_subscriptions to service_role;
 grant select, insert, update on table public.asaas_checkout_sessions to service_role;
 grant select, insert, update on table public.asaas_webhook_events to service_role;

comment on table public.asaas_checkout_sessions is
  'Internal mapping between VALLEX organizations/plans and Asaas hosted checkouts.';
comment on table public.asaas_webhook_events is
  'Asaas webhook inbox used for idempotent subscription event processing.';


