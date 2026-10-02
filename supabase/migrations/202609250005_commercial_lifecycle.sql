-- Phase 4: canonical draft commercial terms, immutable approval snapshot,
-- payment-request generation, payment audit, and final-invoice gating.
-- Additive and transaction-safe. Historical rows are left unchanged.

begin;

alter table public.projects add column if not exists current_commercial_spec jsonb;
alter table public.projects add column if not exists approved_commercial_snapshot jsonb;
alter table public.projects add column if not exists approved_quotation_id uuid references public.quotations(id) on delete restrict;
alter table public.projects add column if not exists completed_at timestamptz;

alter table public.quotations add column if not exists revision_number integer not null default 1;
alter table public.quotations add column if not exists updated_at timestamptz not null default now();

alter table public.proforma_invoices add column if not exists payment_schedule_item_id uuid
  references public.project_payment_schedule_items(id) on delete restrict;

alter table public.invoices add column if not exists approved_commercial_snapshot jsonb;
alter table public.invoices add column if not exists is_final_project_invoice boolean not null default false;

create unique index if not exists projects_approved_quotation_unique_idx
  on public.projects(approved_quotation_id) where approved_quotation_id is not null;
create unique index if not exists proformas_schedule_item_unique_idx
  on public.proforma_invoices(payment_schedule_item_id) where payment_schedule_item_id is not null;
create unique index if not exists project_final_invoice_unique_idx
  on public.invoices(project_id) where is_final_project_invoice = true;
create unique index if not exists managed_payment_reference_unique_idx
  on public.payment_receipts(project_id, payment_reference)
  where reconciliation_managed = true and is_void = false and payment_reference is not null;

create table if not exists public.project_activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_activity_log_client_idx
  on public.project_activity_log(client_id, created_at desc);
create index if not exists project_activity_log_project_idx
  on public.project_activity_log(project_id, created_at desc);

alter table public.project_activity_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_activity_log'
      and policyname = 'Authenticated users read project activity'
  ) then
    create policy "Authenticated users read project activity"
      on public.project_activity_log for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_activity_log'
      and policyname = 'Authenticated users append project activity'
  ) then
    create policy "Authenticated users append project activity"
      on public.project_activity_log for insert to authenticated with check (true);
  end if;
end
$$;

create or replace function public.try_parse_jsonb(p_value text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_value::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function public.project_quotation_commercial_spec(p_quotation_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'quotationId', q.id,
    'quotationNumber', q.quotation_number,
    'revisionNumber', q.revision_number,
    'projectName', p.name,
    'projectDescription', p.description,
    'company', coalesce(q.company, p.company),
    'subBrand', q.sub_brand,
    'title', q.title,
    'package', public.try_parse_jsonb(q.notes),
    'items', to_jsonb(q.items),
    'serviceDetails', p.service_details,
    'commercials', jsonb_build_object(
      'basePrice', round(q.taxable_value + coalesce(q.discount_amount, 0), 2),
      'discountType', q.discount_type,
      'discountValue', q.discount_value,
      'discountAmount', q.discount_amount,
      'taxableAmount', q.taxable_value,
      'includeGst', q.include_gst,
      'gstRate', q.gst_rate,
      'cgstAmount', q.cgst_amount,
      'sgstAmount', q.sgst_amount,
      'igstAmount', q.igst_amount,
      'isIgst', q.is_igst,
      'total', q.total_amount
    ),
    'paymentSchedule', coalesce(q.payment_schedule, '[]'::jsonb),
    'terms', q.terms,
    'quotationStatus', q.status,
    'createdAt', q.created_at,
    'updatedAt', q.updated_at
  )
  from public.quotations q
  join public.projects p on p.id = q.project_id
  where q.id = p_quotation_id;
$$;

create or replace function public.prepare_project_quotation_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_percentage_total numeric(9,4);
  v_amount_total numeric(12,2);
begin
  if old.status in ('approved', 'converted') and (
    old.project_id is distinct from new.project_id
    or old.client_id is distinct from new.client_id
    or old.company is distinct from new.company
    or old.sub_brand is distinct from new.sub_brand
    or old.title is distinct from new.title
    or old.items is distinct from new.items
    or old.taxable_value is distinct from new.taxable_value
    or old.include_gst is distinct from new.include_gst
    or old.gst_rate is distinct from new.gst_rate
    or old.cgst_amount is distinct from new.cgst_amount
    or old.sgst_amount is distinct from new.sgst_amount
    or old.igst_amount is distinct from new.igst_amount
    or old.is_igst is distinct from new.is_igst
    or old.total_amount is distinct from new.total_amount
    or old.discount_type is distinct from new.discount_type
    or old.discount_value is distinct from new.discount_value
    or old.discount_amount is distinct from new.discount_amount
    or old.payment_schedule is distinct from new.payment_schedule
    or old.notes is distinct from new.notes
    or old.terms is distinct from new.terms
  ) then
    raise exception 'Approved quotation commercial terms are immutable';
  end if;

  if old.status in ('draft', 'sent') and (
    old.title is distinct from new.title
    or old.items is distinct from new.items
    or old.taxable_value is distinct from new.taxable_value
    or old.total_amount is distinct from new.total_amount
    or old.payment_schedule is distinct from new.payment_schedule
    or old.notes is distinct from new.notes
    or old.terms is distinct from new.terms
    or old.discount_type is distinct from new.discount_type
    or old.discount_value is distinct from new.discount_value
    or old.gst_rate is distinct from new.gst_rate
  ) then
    if new.project_id is not null then
      if round(new.taxable_value + new.cgst_amount + new.sgst_amount + new.igst_amount, 2) <> round(new.total_amount, 2) then
        raise exception 'Quotation totals do not reconcile';
      end if;
      select coalesce(sum((entry->>'percentage')::numeric), 0), coalesce(sum(round((entry->>'amount')::numeric, 2)), 0)
        into v_percentage_total, v_amount_total
      from jsonb_array_elements(coalesce(new.payment_schedule, '[]'::jsonb)) entry;
      if abs(v_percentage_total - 100) > 0.0001 then raise exception 'Payment percentages must total exactly 100'; end if;
      if v_amount_total <> round(new.total_amount, 2) then raise exception 'Payment schedule amounts must equal quotation total'; end if;
    end if;
    new.revision_number := old.revision_number + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.replace_project_payment_schedule(
  p_project_id uuid,
  p_items jsonb,
  p_quotation_id uuid default null,
  p_proforma_id uuid default null
)
returns setof public.project_payment_schedule_items
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.projects where id = p_project_id and approved_quotation_id is not null) then
    raise exception 'Approved payment schedules are immutable; create a new commercial revision before approval';
  end if;
  raise exception 'Edit the draft quotation payment split before approval';
end;
$$;

create or replace function public.protect_approved_payment_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_project_id uuid;
begin
  v_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  if exists (select 1 from public.projects where id = v_project_id and approved_quotation_id is not null) then
    if tg_op = 'DELETE' or old.project_id is distinct from new.project_id
      or old.quotation_id is distinct from new.quotation_id
      or old.installment_number is distinct from new.installment_number
      or old.label is distinct from new.label
      or old.milestone is distinct from new.milestone
      or old.percentage is distinct from new.percentage
      or old.amount is distinct from new.amount
      or old.due_date is distinct from new.due_date
    then raise exception 'Approved payment schedule is immutable'; end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'protect_approved_payment_schedule' and tgrelid = 'public.project_payment_schedule_items'::regclass and not tgisinternal) then
    create trigger protect_approved_payment_schedule before update or delete on public.project_payment_schedule_items
      for each row execute function public.protect_approved_payment_schedule();
  end if;
end
$$;

create or replace function public.require_approved_contract_for_managed_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is not null and new.reconciliation_managed = true
    and not exists (
      select 1 from public.projects
      where id = new.project_id and approved_quotation_id is not null and approved_commercial_snapshot is not null
    )
  then raise exception 'Payment requires an approved project contract'; end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'zz_require_approved_contract_for_managed_payment' and tgrelid = 'public.payment_receipts'::regclass and not tgisinternal) then
    create trigger zz_require_approved_contract_for_managed_payment
      before insert or update on public.payment_receipts
      for each row execute function public.require_approved_contract_for_managed_payment();
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prepare_project_quotation_update' and tgrelid = 'public.quotations'::regclass and not tgisinternal) then
    create trigger prepare_project_quotation_update before update on public.quotations
      for each row execute function public.prepare_project_quotation_update();
  end if;
end
$$;

create or replace function public.sync_project_draft_from_quotation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_spec jsonb;
begin
  if new.project_id is null or new.status not in ('draft', 'sent') then return new; end if;
  v_spec := public.project_quotation_commercial_spec(new.id);
  update public.projects
  set current_commercial_spec = v_spec,
      proposed_price = round(new.total_amount, 2),
      updated_at = now()
  where id = new.project_id and approved_quotation_id is null;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'sync_project_draft_from_quotation' and tgrelid = 'public.quotations'::regclass and not tgisinternal) then
    create trigger sync_project_draft_from_quotation after insert or update on public.quotations
      for each row execute function public.sync_project_draft_from_quotation();
  end if;
end
$$;

create or replace function public.save_project_draft_quotation(
  p_quotation_id uuid,
  p_draft jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quotation public.quotations%rowtype;
  v_project public.projects%rowtype;
  v_base numeric(12,2);
  v_discount_type text;
  v_discount_value numeric(12,4);
  v_discount numeric(12,2);
  v_taxable numeric(12,2);
  v_gst_rate numeric(7,4);
  v_gst numeric(12,2);
  v_cgst numeric(12,2) := 0;
  v_sgst numeric(12,2) := 0;
  v_igst numeric(12,2) := 0;
  v_total numeric(12,2);
  v_percent_total numeric(9,4);
  v_schedule jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_count integer;
  v_index integer := 0;
  v_allocated numeric(12,2) := 0;
  v_amount numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_quotation from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if v_quotation.project_id is null then raise exception 'Quotation is not linked to a project'; end if;
  if v_quotation.status not in ('draft', 'sent') then raise exception 'Only a draft or sent quotation can be edited'; end if;
  select * into v_project from public.projects where id = v_quotation.project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if v_project.approved_quotation_id is not null then raise exception 'Approved project commercial terms are locked'; end if;

  v_base := round((p_draft->>'base_price')::numeric, 2);
  v_discount_type := coalesce(p_draft->>'discount_type', 'percent');
  v_discount_value := coalesce((p_draft->>'discount_value')::numeric, 0);
  v_gst_rate := coalesce((p_draft->>'gst_rate')::numeric, 0);
  if v_base <= 0 then raise exception 'Base price must be greater than zero'; end if;
  if v_discount_type not in ('flat', 'percent') then raise exception 'Invalid discount type'; end if;
  if v_discount_value < 0 or (v_discount_type = 'percent' and v_discount_value > 100) then raise exception 'Invalid discount value'; end if;
  if v_gst_rate < 0 or v_gst_rate > 100 then raise exception 'Invalid GST rate'; end if;

  v_discount := case when v_discount_type = 'percent'
    then round(v_base * v_discount_value / 100, 2)
    else round(v_discount_value, 2) end;
  if v_discount > v_base then raise exception 'Discount cannot exceed base price'; end if;
  v_taxable := v_base - v_discount;
  v_gst := case when coalesce((p_draft->>'include_gst')::boolean, true)
    then round(v_taxable * v_gst_rate / 100, 2) else 0 end;
  if coalesce((p_draft->>'is_igst')::boolean, false) then v_igst := v_gst;
  else v_cgst := round(v_gst / 2, 2); v_sgst := v_gst - v_cgst; end if;
  v_total := v_taxable + v_gst;

  if jsonb_typeof(p_draft->'payment_schedule') <> 'array' or jsonb_array_length(p_draft->'payment_schedule') = 0 then
    raise exception 'At least one payment stage is required';
  end if;
  select coalesce(sum((entry->>'percentage')::numeric), 0)
    into v_percent_total from jsonb_array_elements(p_draft->'payment_schedule') entry;
  if abs(v_percent_total - 100) > 0.0001 then raise exception 'Payment percentages must total exactly 100'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_draft->'payment_schedule') entry
    where nullif(trim(entry->>'label'), '') is null or (entry->>'percentage')::numeric <= 0
  ) then raise exception 'Payment stages require a label and positive percentage'; end if;

  v_count := jsonb_array_length(p_draft->'payment_schedule');
  for v_entry in select value from jsonb_array_elements(p_draft->'payment_schedule') loop
    v_index := v_index + 1;
    v_amount := case when v_index = v_count then v_total - v_allocated
      else round(v_total * (v_entry->>'percentage')::numeric / 100, 2) end;
    v_schedule := v_schedule || jsonb_build_array(jsonb_build_object(
      'label', trim(v_entry->>'label'),
      'percentage', (v_entry->>'percentage')::numeric,
      'amount', v_amount,
      'milestone', nullif(trim(v_entry->>'milestone'), ''),
      'due_date', nullif(v_entry->>'due_date', '')
    ));
    v_allocated := v_allocated + v_amount;
  end loop;

  update public.quotations set
    date = coalesce(nullif(p_draft->>'date', '')::date, date),
    valid_until = nullif(p_draft->>'valid_until', '')::date,
    title = coalesce(nullif(trim(p_draft->>'title'), ''), title),
    consultant_name = nullif(trim(p_draft->>'consultant_name'), ''),
    items = coalesce(p_draft->'items', '[]'::jsonb),
    taxable_value = v_taxable, include_gst = v_gst > 0, gst_rate = v_gst_rate,
    cgst_amount = v_cgst, sgst_amount = v_sgst, igst_amount = v_igst,
    is_igst = coalesce((p_draft->>'is_igst')::boolean, false), total_amount = v_total,
    discount_type = v_discount_type, discount_value = v_discount_value,
    discount_amount = v_discount, payment_schedule = v_schedule,
    notes = p_draft->>'notes', terms = p_draft->>'terms'
  where id = p_quotation_id;

  update public.projects set
    description = coalesce(p_draft->>'project_description', description),
    service_details = coalesce(p_draft->>'service_details', service_details),
    proposed_price = v_total,
    updated_at = now()
  where id = v_project.id;

  return (select to_jsonb(q) from public.quotations q where q.id = p_quotation_id);
end;
$$;

create or replace function public.associate_project_schedule_with_proforma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_schedule_item_id is not null then
    update public.project_payment_schedule_items
    set proforma_id = new.id, updated_at = now()
    where id = new.payment_schedule_item_id and project_id = new.project_id;
  end if;
  return new;
end;
$$;

create or replace function public.accept_project_quotation(p_quotation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quotation public.quotations%rowtype;
  v_project public.projects%rowtype;
  v_item jsonb;
  v_schedule_item public.project_payment_schedule_items%rowtype;
  v_count integer;
  v_index integer := 0;
  v_percentage numeric(7,4);
  v_percentage_total numeric(9,4) := 0;
  v_amount numeric(12,2);
  v_allocated numeric(12,2) := 0;
  v_snapshot jsonb;
  v_prefix text;
  v_sequence integer;
  v_proforma_number text;
  v_ratio numeric;
  v_taxable numeric(12,2);
  v_cgst numeric(12,2);
  v_sgst numeric(12,2);
  v_igst numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_quotation from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if v_quotation.project_id is null then raise exception 'Quotation is not linked to a project'; end if;
  select * into v_project from public.projects where id = v_quotation.project_id for update;
  if not found then raise exception 'Project not found'; end if;

  if v_quotation.status = 'approved' and v_project.approved_quotation_id = v_quotation.id then
    return jsonb_build_object('project_id', v_project.id, 'quotation_id', v_quotation.id,
      'contract_value', v_project.contract_value, 'payment_summary', public.project_payment_summary_json(v_project.id), 'idempotent_replay', true);
  end if;
  if v_quotation.status not in ('draft', 'sent') then raise exception 'Only a draft or sent quotation can be accepted'; end if;
  if v_project.approved_quotation_id is not null then raise exception 'Project already has an approved quotation'; end if;
  if v_quotation.total_amount is null or v_quotation.total_amount <= 0 then raise exception 'Quotation total must be greater than zero'; end if;
  if round(v_quotation.taxable_value + v_quotation.cgst_amount + v_quotation.sgst_amount + v_quotation.igst_amount, 2) <> round(v_quotation.total_amount, 2) then
    raise exception 'Quotation totals do not reconcile';
  end if;

  v_count := jsonb_array_length(coalesce(v_quotation.payment_schedule, '[]'::jsonb));
  if v_count = 0 then raise exception 'Quotation payment schedule is required'; end if;
  select coalesce(sum((entry->>'percentage')::numeric), 0), coalesce(sum(round((entry->>'amount')::numeric, 2)), 0)
    into v_percentage_total, v_allocated from jsonb_array_elements(v_quotation.payment_schedule) entry;
  if abs(v_percentage_total - 100) > 0.0001 then raise exception 'Quotation payment percentages must total exactly 100'; end if;
  if v_allocated <> round(v_quotation.total_amount, 2) then raise exception 'Quotation payment amounts must equal the contract value'; end if;

  v_snapshot := public.project_quotation_commercial_spec(v_quotation.id)
    || jsonb_build_object('approvedAt', now(), 'quotationStatus', 'approved');
  update public.projects set contract_value = round(v_quotation.total_amount, 2), status = 'active',
    approved_quotation_id = v_quotation.id, approved_commercial_snapshot = v_snapshot, updated_at = now()
  where id = v_project.id;
  update public.quotations set status = 'approved', accepted_at = coalesce(accepted_at, now()) where id = v_quotation.id;

  v_allocated := 0;
  for v_item in select value from jsonb_array_elements(v_quotation.payment_schedule) loop
    v_index := v_index + 1;
    v_percentage := (v_item->>'percentage')::numeric;
    v_amount := case when v_index = v_count then round(v_quotation.total_amount, 2) - v_allocated
      else round(v_quotation.total_amount * v_percentage / 100, 2) end;
    insert into public.project_payment_schedule_items
      (project_id, quotation_id, installment_number, label, milestone, percentage, amount, due_date)
    values (v_project.id, v_quotation.id, v_index, coalesce(nullif(trim(v_item->>'label'), ''), 'Installment ' || v_index),
      nullif(trim(v_item->>'milestone'), ''), v_percentage, v_amount, nullif(v_item->>'due_date', '')::date)
    returning * into v_schedule_item;

    v_prefix := 'PRF-' || to_char(current_date, 'YYMM');
    perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));
    select coalesce(max(nullif(substring(proforma_number from char_length(v_prefix) + 1), '')::integer), 0) + 1
      into v_sequence from public.proforma_invoices where proforma_number like v_prefix || '%';
    v_proforma_number := v_prefix || lpad(v_sequence::text, 2, '0');
    v_ratio := v_amount / v_quotation.total_amount;
    v_taxable := round(v_quotation.taxable_value * v_ratio, 2);
    v_cgst := round(v_quotation.cgst_amount * v_ratio, 2);
    v_igst := round(v_quotation.igst_amount * v_ratio, 2);
    v_sgst := v_amount - v_taxable - v_cgst - v_igst;
    insert into public.proforma_invoices (
      proforma_number, date, client_id, sub_brand, company, quotation_id, project_id,
      payment_schedule_item_id, items, taxable_value, include_gst, gst_rate,
      cgst_amount, sgst_amount, igst_amount, is_igst, total_amount, notes,
      payment_status, status, created_by
    ) values (
      v_proforma_number, current_date, v_project.client_id, v_quotation.sub_brand, v_quotation.company,
      v_quotation.id, v_project.id, v_schedule_item.id,
      jsonb_build_array(jsonb_build_object('description', v_schedule_item.label, 'quantity', 1, 'unit', 'Installment', 'rate', v_amount, 'amount', v_amount)),
      v_taxable, v_quotation.include_gst, v_quotation.gst_rate, v_cgst, v_sgst, v_igst,
      v_quotation.is_igst, v_amount, 'Payment request for ' || v_schedule_item.label,
      'pending', 'draft', auth.uid()
    );
    v_allocated := v_allocated + v_amount;
  end loop;

  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'quotation_approved',
    jsonb_build_object('quotation_id', v_quotation.id, 'quotation_number', v_quotation.quotation_number, 'contract_value', v_quotation.total_amount), auth.uid());

  return jsonb_build_object('project_id', v_project.id, 'quotation_id', v_quotation.id,
    'contract_value', round(v_quotation.total_amount, 2), 'payment_summary', public.project_payment_summary_json(v_project.id));
end;
$$;

create or replace function public.next_project_receipt_number(p_payment_date date)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare v_prefix text; v_sequence integer;
begin
  v_prefix := 'RCP-' || to_char(p_payment_date, 'YYMM');
  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));
  select coalesce(max(nullif(substring(receipt_number from char_length(v_prefix) + 1), '')::integer), 0) + 1
    into v_sequence from public.payment_receipts where receipt_number like v_prefix || '%';
  return v_prefix || lpad(v_sequence::text, 2, '0');
end;
$$;

create or replace function public.record_project_payment(
  p_project_id uuid, p_receipt_number text, p_payment_date date, p_amount numeric, p_payment_mode text,
  p_schedule_item_id uuid default null, p_payment_reference text default null, p_notes text default null,
  p_towards text default null, p_proforma_id uuid default null, p_invoice_id uuid default null,
  p_sub_brand text default null, p_client_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_project public.projects%rowtype; v_receipt public.payment_receipts%rowtype; v_number text; v_paid numeric(12,2); v_due numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount is null or round(p_amount, 2) <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_date is null then raise exception 'Payment date is required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if v_project.approved_quotation_id is null or v_project.approved_commercial_snapshot is null or v_project.status not in ('active', 'completed') then
    raise exception 'Payment requires an approved project contract';
  end if;
  v_number := public.next_project_receipt_number(p_payment_date);
  insert into public.payment_receipts (
    receipt_number, date, client_id, sub_brand, amount_received, payment_mode, payment_reference,
    towards, invoice_id, proforma_id, project_id, payment_schedule_item_id,
    reconciliation_managed, notes, created_by, client_email
  ) values (
    v_number, p_payment_date, v_project.client_id, coalesce(nullif(p_sub_brand, ''), v_project.sub_brand, ''),
    round(p_amount, 2), p_payment_mode, nullif(trim(p_payment_reference), ''),
    coalesce(nullif(trim(p_towards), ''), 'Project payment'), p_invoice_id, p_proforma_id,
    v_project.id, p_schedule_item_id, true, nullif(trim(p_notes), ''), auth.uid(), nullif(trim(p_client_email), '')
  ) returning * into v_receipt;

  if p_proforma_id is not null then
    select coalesce(sum(amount_received), 0) into v_paid from public.payment_receipts
      where proforma_id = p_proforma_id and reconciliation_managed = true and is_void = false;
    select total_amount into v_due from public.proforma_invoices where id = p_proforma_id;
    update public.proforma_invoices set payment_status = case when v_paid >= v_due then 'paid' when v_paid > 0 then 'partial' else 'pending' end,
      status = case when v_paid >= v_due then 'paid' else status end where id = p_proforma_id;
  end if;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'payment_recorded',
    jsonb_build_object('receipt_id', v_receipt.id, 'receipt_number', v_receipt.receipt_number, 'amount', v_receipt.amount_received, 'payment_date', v_receipt.date), auth.uid());
  return jsonb_build_object('receipt', to_jsonb(v_receipt), 'summary', public.project_payment_summary_json(v_project.id));
end;
$$;

create or replace function public.void_project_payment(p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_receipt public.payment_receipts%rowtype; v_paid numeric(12,2); v_due numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A void reason is required'; end if;
  select * into v_receipt from public.payment_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if v_receipt.project_id is null or not v_receipt.reconciliation_managed then raise exception 'Only reconciled project payments can be voided'; end if;
  if v_receipt.is_void then raise exception 'Receipt is already voided'; end if;
  perform 1 from public.projects where id = v_receipt.project_id for update;
  update public.payment_receipts set is_void = true, voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason) where id = p_receipt_id;
  if v_receipt.proforma_id is not null then
    select coalesce(sum(amount_received), 0) into v_paid from public.payment_receipts
      where proforma_id = v_receipt.proforma_id and reconciliation_managed = true and is_void = false;
    select total_amount into v_due from public.proforma_invoices where id = v_receipt.proforma_id;
    update public.proforma_invoices set payment_status = case when v_paid >= v_due then 'paid' when v_paid > 0 then 'partial' else 'pending' end,
      status = case when v_paid >= v_due then 'paid' else 'draft' end where id = v_receipt.proforma_id;
  end if;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  select client_id, id, 'payment_voided', jsonb_build_object('receipt_id', v_receipt.id, 'receipt_number', v_receipt.receipt_number, 'amount', v_receipt.amount_received, 'reason', trim(p_reason)), auth.uid()
  from public.projects where id = v_receipt.project_id;
  return public.project_payment_summary_json(v_receipt.project_id);
end;
$$;

create or replace function public.validate_project_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_summary jsonb;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status = 'active' and new.approved_quotation_id is null then raise exception 'A project becomes active only through quotation approval'; end if;
  if new.status = 'completed' then
    if new.approved_commercial_snapshot is null then raise exception 'Project completion requires an approved contract'; end if;
    v_summary := public.project_payment_summary_json(new.id);
    if v_summary->>'payment_state' <> 'paid' then raise exception 'Project completion requires all installments to be fully paid'; end if;
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'validate_project_status_transition' and tgrelid = 'public.projects'::regclass and not tgisinternal) then
    create trigger validate_project_status_transition before update of status on public.projects
      for each row execute function public.validate_project_status_transition();
  end if;
end
$$;

create or replace function public.prepare_project_final_invoice()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_project public.projects%rowtype; v_summary jsonb; v_q jsonb; v_package text;
begin
  if tg_op = 'UPDATE' and old.is_final_project_invoice = true and (
    old.project_id is distinct from new.project_id
    or old.client_id is distinct from new.client_id
    or old.items is distinct from new.items
    or old.taxable_value is distinct from new.taxable_value
    or old.cgst_amount is distinct from new.cgst_amount
    or old.sgst_amount is distinct from new.sgst_amount
    or old.igst_amount is distinct from new.igst_amount
    or old.total_amount is distinct from new.total_amount
    or old.approved_commercial_snapshot is distinct from new.approved_commercial_snapshot
  ) then
    raise exception 'Final project invoice commercial terms are immutable';
  end if;
  if new.project_id is null then return new; end if;
  select * into v_project from public.projects where id = new.project_id for update;
  if not found then raise exception 'Project not found'; end if;
  v_summary := public.project_payment_summary_json(v_project.id);
  if v_project.status <> 'completed' or v_project.approved_commercial_snapshot is null or v_summary->>'payment_state' <> 'paid' then
    raise exception 'Final invoice requires an approved, completed, fully paid project';
  end if;
  if exists (select 1 from public.invoices where project_id = v_project.id and is_final_project_invoice = true and id <> new.id) then
    raise exception 'A final invoice already exists for this project';
  end if;
  v_q := v_project.approved_commercial_snapshot->'commercials';
  v_package := coalesce(v_project.approved_commercial_snapshot#>>'{package,packageName}', v_project.name);
  new.client_id := v_project.client_id;
  new.sub_brand := coalesce(v_project.sub_brand, new.sub_brand);
  new.company := coalesce(v_project.company, new.company);
  new.taxable_value := (v_q->>'taxableAmount')::numeric;
  new.cgst_amount := (v_q->>'cgstAmount')::numeric;
  new.sgst_amount := (v_q->>'sgstAmount')::numeric;
  new.igst_amount := (v_q->>'igstAmount')::numeric;
  new.total_amount := (v_q->>'total')::numeric;
  new.is_igst := coalesce((v_q->>'isIgst')::boolean, false);
  new.items := array[jsonb_build_object('description', v_package || ' — ' || v_project.name, 'hsn_sac', '', 'quantity', 1, 'unit', 'Project',
    'rate', (v_q->>'taxableAmount')::numeric, 'taxable_value', (v_q->>'taxableAmount')::numeric,
    'gst_rate', (v_q->>'gstRate')::numeric, 'cgst', (v_q->>'cgstAmount')::numeric,
    'sgst', (v_q->>'sgstAmount')::numeric, 'igst', (v_q->>'igstAmount')::numeric, 'total', (v_q->>'total')::numeric)];
  new.payment_status := 'paid';
  new.approved_commercial_snapshot := v_project.approved_commercial_snapshot;
  new.is_final_project_invoice := true;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prepare_project_final_invoice' and tgrelid = 'public.invoices'::regclass and not tgisinternal) then
    create trigger prepare_project_final_invoice before insert or update on public.invoices
      for each row execute function public.prepare_project_final_invoice();
  end if;
end
$$;

grant execute on function public.project_quotation_commercial_spec(uuid) to authenticated;
grant execute on function public.try_parse_jsonb(text) to authenticated;
grant execute on function public.save_project_draft_quotation(uuid, jsonb) to authenticated;
grant execute on function public.accept_project_quotation(uuid) to authenticated;
grant execute on function public.next_project_receipt_number(date) to authenticated;
grant execute on function public.record_project_payment(uuid, text, date, numeric, text, uuid, text, text, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.void_project_payment(uuid, text) to authenticated;

commit;
