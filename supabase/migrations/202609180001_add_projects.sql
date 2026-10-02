-- Phase 1: introduce a project/order layer without changing historical records.
-- Review this migration against the production schema before running it remotely.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'quotation', 'active', 'completed', 'cancelled')),
  contract_value numeric(12,2)
    check (contract_value is null or contract_value >= 0),
  sub_brand text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_created_at_idx on public.projects(created_at desc);

alter table public.projects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'Authenticated users can manage projects'
  ) then
    create policy "Authenticated users can manage projects"
      on public.projects for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'projects_set_updated_at'
      and tgrelid = 'public.projects'::regclass
      and not tgisinternal
  ) then
    create trigger projects_set_updated_at
      before update on public.projects
      for each row execute function public.set_projects_updated_at();
  end if;
end
$$;

-- Nullable links preserve all historical rows. RESTRICT prevents deleting a
-- project while any financial document still belongs to it.
alter table public.quotations
  add column if not exists project_id uuid references public.projects(id) on delete restrict;

alter table public.proforma_invoices
  add column if not exists project_id uuid references public.projects(id) on delete restrict;

alter table public.invoices
  add column if not exists project_id uuid references public.projects(id) on delete restrict;

alter table public.payment_receipts
  add column if not exists project_id uuid references public.projects(id) on delete restrict;

create index if not exists quotations_project_id_idx on public.quotations(project_id);
create index if not exists proforma_invoices_project_id_idx on public.proforma_invoices(project_id);
create index if not exists invoices_project_id_idx on public.invoices(project_id);
create index if not exists payment_receipts_project_id_idx on public.payment_receipts(project_id);
