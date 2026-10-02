-- Phase 3: additive Client Onboarding + Workspace schema. Apply only after Phase 1 and Phase 2.
-- Existing clients/projects/documents remain valid because all new ownership columns are nullable.

alter table public.clients add column if not exists default_company text;

alter table public.projects add column if not exists company text;
alter table public.projects add column if not exists service_details text;
alter table public.projects add column if not exists proposed_price numeric(12,2);
alter table public.projects add column if not exists onboarding_snapshot jsonb;
alter table public.projects add column if not exists onboarding_key uuid;
create unique index if not exists projects_onboarding_key_unique_idx
  on public.projects(created_by, onboarding_key) where onboarding_key is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.clients'::regclass and conname = 'clients_default_company_check') then
    alter table public.clients add constraint clients_default_company_check
      check (default_company is null or default_company in ('ritera', 'ratix', 'infinity'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_company_check') then
    alter table public.projects add constraint projects_company_check
      check (company is null or company in ('ritera', 'ratix', 'infinity'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_proposed_price_check') then
    alter table public.projects add constraint projects_proposed_price_check
      check (proposed_price is null or proposed_price >= 0);
  end if;
end
$$;

-- These are the established quotation fields used by CreateQuotation. Adding
-- them conditionally closes the dependency on older manually-run enhancements.
alter table public.quotations add column if not exists discount_type text default 'percent';
alter table public.quotations add column if not exists discount_value numeric default 0;
alter table public.quotations add column if not exists discount_amount numeric default 0;
alter table public.quotations add column if not exists payment_schedule jsonb default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.quotations'::regclass and conname = 'quotations_discount_type_check') then
    alter table public.quotations add constraint quotations_discount_type_check
      check (discount_type in ('flat', 'percent'));
  end if;
end
$$;

alter table public.quotations add column if not exists company text;
alter table public.proforma_invoices add column if not exists company text;
alter table public.invoices add column if not exists company text;
alter table public.payment_receipts add column if not exists company text;

create or replace function public.inherit_document_company()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.company is null and new.project_id is not null then
    select company into new.company from public.projects where id = new.project_id;
  end if;
  if new.company is null and new.client_id is not null then
    select default_company into new.company from public.clients where id = new.client_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'quotations_inherit_company' and tgrelid = 'public.quotations'::regclass and not tgisinternal) then
    create trigger quotations_inherit_company before insert or update of project_id, client_id, company on public.quotations
      for each row execute function public.inherit_document_company();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'proformas_inherit_company' and tgrelid = 'public.proforma_invoices'::regclass and not tgisinternal) then
    create trigger proformas_inherit_company before insert or update of project_id, client_id, company on public.proforma_invoices
      for each row execute function public.inherit_document_company();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'invoices_inherit_company' and tgrelid = 'public.invoices'::regclass and not tgisinternal) then
    create trigger invoices_inherit_company before insert or update of project_id, client_id, company on public.invoices
      for each row execute function public.inherit_document_company();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'receipts_inherit_company' and tgrelid = 'public.payment_receipts'::regclass and not tgisinternal) then
    create trigger receipts_inherit_company before insert or update of project_id, client_id, company on public.payment_receipts
      for each row execute function public.inherit_document_company();
  end if;
end
$$;

create table if not exists public.project_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  template_key text not null,
  template_name text not null,
  rendered_title text not null,
  rendered_content text not null,
  status text not null default 'generated' check (status in ('generated', 'downloaded', 'executed', 'cancelled')),
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_agreements_client_id_idx on public.project_agreements(client_id);
create index if not exists project_agreements_project_id_idx on public.project_agreements(project_id);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  subject_template text not null,
  body_template text not null,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.email_templates (template_key, name, subject_template, body_template) values
('client_onboarding', 'Client Onboarding — Sample', 'Welcome, {{client_name}}', 'Hello {{client_name}},\n\nWelcome to {{company_name}}. This is a sample onboarding message.'),
('agreement_sharing', 'Agreement Sharing — Sample', 'Agreement for {{project_name}}', 'Hello {{client_name}},\n\nThe sample agreement for {{project_name}} is ready for review.'),
('quotation_sent', 'Order Form / Quotation Sent — Sample', 'Quotation {{quotation_number}} for {{project_name}}', 'Hello {{client_name}},\n\nQuotation {{quotation_number}} for {{project_name}} is ready for review. Amount: {{amount}}.'),
('quotation_approved', 'Order Form Approved / Next Step — Sample', 'Next steps for {{project_name}}', 'Hello {{client_name}},\n\nQuotation {{quotation_number}} is approved. We will now proceed with the next project step.'),
('proforma_sent', 'Proforma Shared — Sample', 'Proforma {{proforma_number}} for {{project_name}}', 'Hello {{client_name}},\n\nProforma {{proforma_number}} for {{project_name}} is ready.'),
('payment_request', 'Payment Request — Sample', 'Payment request for {{project_name}}', 'Hello {{client_name}},\n\nPayment due for {{project_name}}: {{payment_due}}. Outstanding: {{outstanding}}.'),
('payment_received', 'Payment Received — Sample', 'Payment received — {{receipt_number}}', 'Hello {{client_name}},\n\nThank you. We recorded {{received}} for {{project_name}} under receipt {{receipt_number}}.'),
('next_stage', 'Project Stage Update — Sample', 'Project update for {{project_name}}', 'Hello {{client_name}},\n\nThe next stage of {{project_name}} has started.'),
('final_payment_request', 'Final Payment Request — Sample', 'Final payment request for {{project_name}}', 'Hello {{client_name}},\n\nThe remaining amount for {{project_name}} is {{outstanding}}.'),
('project_completed', 'Project Completed — Sample', '{{project_name}} completed', 'Hello {{client_name}},\n\nWe are pleased to confirm completion of {{project_name}}.')
on conflict (template_key) do nothing;

create table if not exists public.client_email_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  template_id uuid references public.email_templates(id) on delete set null,
  recipient text not null,
  subject text not null,
  body_snapshot text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_email_log_client_id_idx on public.client_email_log(client_id);
create index if not exists client_email_log_project_id_idx on public.client_email_log(project_id);

alter table public.project_agreements enable row level security;
alter table public.email_templates enable row level security;
alter table public.client_email_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_agreements' and policyname = 'authenticated users manage project agreements') then
    create policy "authenticated users manage project agreements" on public.project_agreements
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname = 'authenticated users read email templates') then
    create policy "authenticated users read email templates" on public.email_templates
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_email_log' and policyname = 'authenticated users read client email log') then
    create policy "authenticated users read client email log" on public.client_email_log
      for select to authenticated using (true);
  end if;
end
$$;

comment on column public.projects.proposed_price is
  'Non-binding project proposal value. It does not configure contract_value or payment obligations.';

comment on column public.projects.onboarding_snapshot is
  'Immutable-at-creation snapshot of package, deliverables, commercial proposal, and draft payment split.';

create or replace function public.create_client_project_onboarding(
  p_client jsonb,
  p_project jsonb,
  p_quotation jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_quotation_id uuid;
  v_onboarding_key uuid;
  v_company text;
  v_total numeric(12,2);
  v_schedule_total numeric(9,4);
  v_schedule_amount_total numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_onboarding_key := nullif(p_project->>'onboarding_key', '')::uuid;
  if v_onboarding_key is null then raise exception 'Onboarding key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_onboarding_key::text, 0));
  select id, client_id into v_project_id, v_client_id
  from public.projects
  where onboarding_key = v_onboarding_key and created_by = auth.uid();
  if found then
    select id into v_quotation_id from public.quotations where project_id = v_project_id order by created_at limit 1;
    if v_quotation_id is null then raise exception 'Existing onboarding request is incomplete'; end if;
    return jsonb_build_object('client_id', v_client_id, 'project_id', v_project_id, 'quotation_id', v_quotation_id, 'idempotent_replay', true);
  end if;
  v_company := p_client->>'default_company';
  if v_company is null or v_company not in ('ritera', 'ratix', 'infinity') then raise exception 'Invalid company'; end if;
  if nullif(trim(p_client->>'name'), '') is null then raise exception 'Client name is required'; end if;
  if nullif(trim(p_project->>'name'), '') is null then raise exception 'Project name is required'; end if;
  if jsonb_typeof(p_project->'onboarding_snapshot') <> 'object' then raise exception 'Onboarding snapshot is required'; end if;
  v_total := round((p_quotation->>'total_amount')::numeric, 2);
  if v_total <= 0 then raise exception 'Proposed total must be greater than zero'; end if;
  if p_quotation->>'discount_type' is null or p_quotation->>'discount_type' not in ('flat', 'percent') then raise exception 'Invalid quotation discount type'; end if;
  if p_quotation->>'taxable_value' is null
    or p_quotation->>'cgst_amount' is null
    or p_quotation->>'sgst_amount' is null
    or p_quotation->>'igst_amount' is null
  then raise exception 'Quotation component totals are required'; end if;
  if round(
    (p_quotation->>'taxable_value')::numeric
    + (p_quotation->>'cgst_amount')::numeric
    + (p_quotation->>'sgst_amount')::numeric
    + (p_quotation->>'igst_amount')::numeric,
    2
  ) <> v_total then raise exception 'Quotation components must reconcile to the proposed total'; end if;

  select coalesce(sum((entry->>'percentage')::numeric), 0)
  into v_schedule_total
  from jsonb_array_elements(coalesce(p_quotation->'payment_schedule', '[]'::jsonb)) entry;
  if abs(v_schedule_total - 100) > 0.0001 then
    raise exception 'Draft payment split must total exactly 100 percent';
  end if;
  select coalesce(sum(round((entry->>'amount')::numeric, 2)), 0)::numeric(12,2)
  into v_schedule_amount_total
  from jsonb_array_elements(coalesce(p_quotation->'payment_schedule', '[]'::jsonb)) entry;
  if v_schedule_amount_total <> v_total then
    raise exception 'Draft payment split amounts must equal the proposed total';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_quotation->'payment_schedule') entry
    where entry->>'percentage' is null
      or entry->>'amount' is null
      or (entry->>'percentage')::numeric <= 0
      or (entry->>'amount')::numeric <= 0
  ) then raise exception 'Draft payment stages must be positive'; end if;

  insert into public.clients (name, email, phone, address, state, state_code, gstin, default_company)
  values (
    trim(p_client->>'name'), nullif(trim(p_client->>'email'), ''), nullif(trim(p_client->>'phone'), ''),
    coalesce(p_client->>'address', ''), coalesce(p_client->>'state', ''), coalesce(p_client->>'state_code', ''),
    nullif(upper(trim(p_client->>'gstin')), ''), v_company
  ) returning id into v_client_id;

  insert into public.projects
    (client_id, name, description, status, contract_value, sub_brand, company, service_details,
     proposed_price, onboarding_snapshot, onboarding_key, created_by)
  values (
    v_client_id, trim(p_project->>'name'), nullif(trim(p_project->>'description'), ''), 'quotation', null,
    p_project->>'sub_brand', v_company, nullif(trim(p_project->>'service_details'), ''), v_total,
    p_project->'onboarding_snapshot', v_onboarding_key, auth.uid()
  ) returning id into v_project_id;

  insert into public.quotations (
    quotation_number, date, valid_until, client_id, project_id, client_name_override,
    client_email_override, sub_brand, company, title, items, taxable_value, include_gst,
    gst_rate, cgst_amount, sgst_amount, igst_amount, is_igst, total_amount,
    discount_type, discount_value, discount_amount, payment_schedule, notes, terms,
    status, converted_invoice_id, created_by
  ) values (
    p_quotation->>'quotation_number', (p_quotation->>'date')::date,
    nullif(p_quotation->>'valid_until', '')::date, v_client_id, v_project_id, null, null,
    p_project->>'sub_brand', v_company, trim(p_project->>'name'), coalesce(p_quotation->'items', '[]'::jsonb),
    (p_quotation->>'taxable_value')::numeric, (p_quotation->>'include_gst')::boolean,
    (p_quotation->>'gst_rate')::numeric, (p_quotation->>'cgst_amount')::numeric,
    (p_quotation->>'sgst_amount')::numeric, (p_quotation->>'igst_amount')::numeric,
    (p_quotation->>'is_igst')::boolean, v_total, p_quotation->>'discount_type',
    (p_quotation->>'discount_value')::numeric, (p_quotation->>'discount_amount')::numeric,
    p_quotation->'payment_schedule', p_quotation->>'notes', p_quotation->>'terms',
    'draft', null, auth.uid()
  ) returning id into v_quotation_id;

  return jsonb_build_object('client_id', v_client_id, 'project_id', v_project_id, 'quotation_id', v_quotation_id);
end;
$$;

grant execute on function public.create_client_project_onboarding(jsonb, jsonb, jsonb) to authenticated;
