-- Phase 2: structured payment schedules and atomic project payment reconciliation.
-- Additive only. Review against production and apply only after Phase 1.

create table if not exists public.project_payment_schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  quotation_id uuid references public.quotations(id) on delete set null,
  proforma_id uuid references public.proforma_invoices(id) on delete set null,
  installment_number integer not null check (installment_number > 0),
  label text not null,
  milestone text,
  percentage numeric(7,4) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, installment_number)
);

alter table public.project_payment_schedule_items
  add column if not exists milestone text;

alter table public.quotations
  add column if not exists accepted_at timestamptz;

alter table public.payment_receipts
  add column if not exists payment_schedule_item_id uuid
    references public.project_payment_schedule_items(id) on delete restrict;

alter table public.payment_receipts
  add column if not exists reconciliation_managed boolean not null default false;

alter table public.payment_receipts
  add column if not exists is_void boolean not null default false;

alter table public.payment_receipts
  add column if not exists voided_at timestamptz;

alter table public.payment_receipts
  add column if not exists voided_by uuid references auth.users(id);

alter table public.payment_receipts
  add column if not exists void_reason text;

-- The existing receipt UI/email flow uses this field, and record_project_payment
-- writes it. Keep Phase 2 independently installable on the checked-in base schema.
alter table public.payment_receipts
  add column if not exists client_email text;

create index if not exists project_payment_schedule_items_project_idx
  on public.project_payment_schedule_items(project_id, installment_number);

create index if not exists project_payment_schedule_items_quotation_idx
  on public.project_payment_schedule_items(quotation_id);

create index if not exists project_payment_schedule_items_proforma_idx
  on public.project_payment_schedule_items(proforma_id);

create index if not exists payment_receipts_schedule_item_idx
  on public.payment_receipts(payment_schedule_item_id);

create index if not exists payment_receipts_project_reconciliation_idx
  on public.payment_receipts(project_id, reconciliation_managed, is_void);

alter table public.project_payment_schedule_items enable row level security;

comment on table public.project_payment_schedule_items is
  'Structured project installments. Payment state is derived from non-void reconciled payment receipts.';

comment on column public.payment_receipts.reconciliation_managed is
  'False for pre-Phase-2 historical rows; true for payments governed by project reconciliation rules.';

comment on column public.invoices.payment_status is
  'Legacy/manual for historical and standalone documents. Project payment state is derived from receipts.';

comment on column public.proforma_invoices.payment_status is
  'Legacy/manual for historical and standalone documents. Project payment state is derived from receipts.';

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_payment_schedule_items'
      and policyname = 'Authenticated users can manage project payment schedules'
  ) then
    create policy "Authenticated users can manage project payment schedules"
      on public.project_payment_schedule_items for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

create or replace function public.project_payment_summary_json(p_project_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_contract numeric(12,2);
  v_received numeric(12,2);
  v_outstanding numeric(12,2);
  v_progress numeric(7,2);
  v_state text;
begin
  select contract_value
  into v_contract
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'Project not found';
  end if;

  select coalesce(sum(amount_received), 0)::numeric(12,2)
  into v_received
  from public.payment_receipts
  where project_id = p_project_id
    and reconciliation_managed = true
    and is_void = false;

  if v_contract is null or v_contract <= 0 then
    v_outstanding := null;
    v_progress := 0;
    v_state := 'unconfigured';
  else
    v_outstanding := greatest(v_contract - v_received, 0);
    v_progress := round(least((v_received / v_contract) * 100, 100), 2);
    v_state := case
      when v_received <= 0 then 'pending'
      when v_received < v_contract then 'partial'
      else 'paid'
    end;
  end if;

  return jsonb_build_object(
    'project_id', p_project_id,
    'contract_value', v_contract,
    'total_received', v_received,
    'outstanding', v_outstanding,
    'payment_progress', v_progress,
    'payment_state', v_state
  );
end;
$$;

create or replace function public.validate_project_schedule_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_contract numeric(12,2);
  v_other_total numeric(12,2);
  v_allocated numeric(12,2);
begin
  select contract_value
  into v_contract
  from public.projects
  where id = new.project_id
  for update;

  if v_contract is null or v_contract <= 0 then
    raise exception 'Set a positive project contract value before creating a payment schedule';
  end if;

  select coalesce(sum(amount), 0)::numeric(12,2)
  into v_other_total
  from public.project_payment_schedule_items
  where project_id = new.project_id
    and id <> new.id;

  if v_other_total + new.amount > v_contract then
    raise exception 'Payment schedule total cannot exceed project contract value';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(amount_received), 0)::numeric(12,2)
    into v_allocated
    from public.payment_receipts
    where payment_schedule_item_id = old.id
      and reconciliation_managed = true
      and is_void = false;

    if new.amount < v_allocated then
      raise exception 'Installment amount cannot be lower than payments already allocated to it';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'validate_project_schedule_item'
      and tgrelid = 'public.project_payment_schedule_items'::regclass
      and not tgisinternal
  ) then
    create trigger validate_project_schedule_item
      before insert or update on public.project_payment_schedule_items
      for each row execute function public.validate_project_schedule_item();
  end if;
end
$$;

create or replace function public.validate_project_schedule_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_project_id uuid;
  v_contract numeric(12,2);
  v_schedule_total numeric(12,2);
begin
  v_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;

  select contract_value
  into v_contract
  from public.projects
  where id = v_project_id;

  select coalesce(sum(amount), 0)::numeric(12,2)
  into v_schedule_total
  from public.project_payment_schedule_items
  where project_id = v_project_id;

  if v_contract is not null and v_schedule_total <> v_contract then
    raise exception 'Payment schedule total (%) must equal project contract value (%)', v_schedule_total, v_contract;
  end if;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'validate_project_schedule_total'
      and tgrelid = 'public.project_payment_schedule_items'::regclass
      and not tgisinternal
  ) then
    create constraint trigger validate_project_schedule_total
      after insert or update or delete on public.project_payment_schedule_items
      deferrable initially deferred
      for each row execute function public.validate_project_schedule_total();
  end if;
end
$$;

create or replace function public.protect_project_contract_value()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.contract_value is distinct from new.contract_value
    and old.contract_value is not null
    and (
      exists (select 1 from public.project_payment_schedule_items where project_id = old.id)
      or exists (
        select 1 from public.payment_receipts
        where project_id = old.id
          and reconciliation_managed = true
          and is_void = false
      )
    )
  then
    raise exception 'Contract value is locked after a payment schedule or reconciled payment exists';
  end if;

  return new;
end;
$$;

create or replace function public.protect_accepted_project_quotation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.project_id is not null
    and old.status in ('approved', 'converted')
    and exists (
      select 1 from public.project_payment_schedule_items
      where quotation_id = old.id
    )
    and (
      old.project_id is distinct from new.project_id
      or old.total_amount is distinct from new.total_amount
      or old.payment_schedule is distinct from new.payment_schedule
      or old.client_id is distinct from new.client_id
    )
  then
    raise exception 'Accepted project quotation commercial terms are locked';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_project_contract_value'
      and tgrelid = 'public.projects'::regclass
      and not tgisinternal
  ) then
    create trigger protect_project_contract_value
      before update of contract_value on public.projects
      for each row execute function public.protect_project_contract_value();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_accepted_project_quotation'
      and tgrelid = 'public.quotations'::regclass
      and not tgisinternal
  ) then
    create trigger protect_accepted_project_quotation
      before update on public.quotations
      for each row execute function public.protect_accepted_project_quotation();
  end if;
end
$$;

create or replace function public.validate_project_payment_receipt()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_contract numeric(12,2);
  v_received numeric(12,2);
  v_installment_amount numeric(12,2);
  v_installment_project uuid;
  v_installment_received numeric(12,2);
begin
  if tg_op = 'UPDATE' and old.reconciliation_managed = true then
    if new.reconciliation_managed = false then
      raise exception 'Reconciled payment management cannot be disabled';
    end if;
    if new.project_id is distinct from old.project_id then
      raise exception 'A reconciled payment cannot be moved to another project';
    end if;
    if old.is_void = true and new.is_void = false then
      raise exception 'A voided payment cannot be reactivated';
    end if;
  end if;

  if new.project_id is null then
    if new.payment_schedule_item_id is not null then
      raise exception 'An installment allocation requires a project';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.reconciliation_managed = false
    and new.project_id is not distinct from old.project_id
    and new.amount_received is not distinct from old.amount_received
    and new.payment_schedule_item_id is not distinct from old.payment_schedule_item_id
  then
    return new;
  end if;

  new.reconciliation_managed := true;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if new.is_void then
    if tg_op = 'INSERT' then
      raise exception 'A new payment receipt cannot be created as void';
    end if;
    if nullif(trim(new.void_reason), '') is null then
      raise exception 'Voiding a reconciled payment requires a reason';
    end if;
    new.voided_at := coalesce(new.voided_at, now());
    new.voided_by := auth.uid();
    return new;
  end if;

  if new.amount_received is null or new.amount_received <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select contract_value
  into v_contract
  from public.projects
  where id = new.project_id
  for update;

  if v_contract is null or v_contract <= 0 then
    raise exception 'Project contract value must be confirmed before recording payment';
  end if;

  select coalesce(sum(amount_received), 0)::numeric(12,2)
  into v_received
  from public.payment_receipts
  where project_id = new.project_id
    and reconciliation_managed = true
    and is_void = false
    and id <> new.id;

  if v_received + new.amount_received > v_contract then
    raise exception 'Payment exceeds project outstanding balance of %', greatest(v_contract - v_received, 0);
  end if;

  if new.payment_schedule_item_id is not null then
    select project_id, amount
    into v_installment_project, v_installment_amount
    from public.project_payment_schedule_items
    where id = new.payment_schedule_item_id
    for update;

    if not found or v_installment_project <> new.project_id then
      raise exception 'Payment schedule installment does not belong to this project';
    end if;

    select coalesce(sum(amount_received), 0)::numeric(12,2)
    into v_installment_received
    from public.payment_receipts
    where payment_schedule_item_id = new.payment_schedule_item_id
      and reconciliation_managed = true
      and is_void = false
      and id <> new.id;

    if v_installment_received + new.amount_received > v_installment_amount then
      raise exception 'Payment exceeds installment remaining balance of %', greatest(v_installment_amount - v_installment_received, 0);
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'validate_project_payment_receipt'
      and tgrelid = 'public.payment_receipts'::regclass
      and not tgisinternal
  ) then
    create trigger validate_project_payment_receipt
      before insert or update of project_id, payment_schedule_item_id, amount_received, reconciliation_managed, is_void
      on public.payment_receipts
      for each row execute function public.validate_project_payment_receipt();
  end if;
end
$$;

create or replace function public.prevent_managed_payment_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.project_id is not null and old.reconciliation_managed = true then
    raise exception 'Reconciled project payments must be voided, not deleted';
  end if;
  return old;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_managed_payment_delete'
      and tgrelid = 'public.payment_receipts'::regclass
      and not tgisinternal
  ) then
    create trigger prevent_managed_payment_delete
      before delete on public.payment_receipts
      for each row execute function public.prevent_managed_payment_delete();
  end if;
end
$$;

create or replace function public.accept_project_quotation(p_quotation_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_quotation public.quotations%rowtype;
  v_project public.projects%rowtype;
  v_item jsonb;
  v_count integer;
  v_index integer := 0;
  v_percentage numeric(7,4);
  v_percentage_total numeric(9,4) := 0;
  v_amount numeric(12,2);
  v_allocated numeric(12,2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_quotation
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found then raise exception 'Quotation not found'; end if;
  if v_quotation.project_id is null then raise exception 'Quotation is not linked to a project'; end if;
  if v_quotation.total_amount is null or v_quotation.total_amount <= 0 then raise exception 'Quotation total must be greater than zero'; end if;
  if v_quotation.status not in ('sent', 'approved') then raise exception 'Only a sent quotation can be accepted'; end if;

  select * into v_project
  from public.projects
  where id = v_quotation.project_id
  for update;

  if not found then raise exception 'Project not found'; end if;

  if v_project.contract_value is not null and v_project.contract_value <> round(v_quotation.total_amount, 2) then
    raise exception 'Project contract value is already confirmed at %', v_project.contract_value;
  end if;

  if v_project.contract_value is null then
    update public.projects
    set contract_value = round(v_quotation.total_amount, 2), status = 'active', updated_at = now()
    where id = v_project.id;
  elsif v_project.status in ('draft', 'quotation') then
    update public.projects set status = 'active', updated_at = now() where id = v_project.id;
  end if;

  update public.quotations
  set status = 'approved', accepted_at = coalesce(accepted_at, now())
  where id = v_quotation.id;

  if not exists (
    select 1 from public.project_payment_schedule_items where project_id = v_project.id
  ) then
    v_count := jsonb_array_length(coalesce(v_quotation.payment_schedule, '[]'::jsonb));

    if v_count = 0 then
      insert into public.project_payment_schedule_items
        (project_id, quotation_id, installment_number, label, milestone, percentage, amount)
      values
        (v_project.id, v_quotation.id, 1, 'Full Payment', null, 100, round(v_quotation.total_amount, 2));
    else
      select coalesce(sum((entry->>'percentage')::numeric), 0)
      into v_percentage_total
      from jsonb_array_elements(v_quotation.payment_schedule) entry;

      if abs(v_percentage_total - 100) > 0.0001 then
        raise exception 'Quotation payment schedule percentages must total exactly 100';
      end if;

      for v_item in select value from jsonb_array_elements(v_quotation.payment_schedule)
      loop
        v_index := v_index + 1;
        v_percentage := (v_item->>'percentage')::numeric;
        v_amount := case
          when v_index = v_count then round(v_quotation.total_amount, 2) - v_allocated
          else round((v_quotation.total_amount * v_percentage) / 100, 2)
        end;

        insert into public.project_payment_schedule_items
          (project_id, quotation_id, installment_number, label, milestone, percentage, amount)
        values
          (v_project.id, v_quotation.id, v_index,
           coalesce(nullif(v_item->>'label', ''), 'Installment ' || v_index),
           nullif(v_item->>'milestone', ''), v_percentage, v_amount);

        v_allocated := v_allocated + v_amount;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'project_id', v_project.id,
    'quotation_id', v_quotation.id,
    'contract_value', round(v_quotation.total_amount, 2),
    'payment_summary', public.project_payment_summary_json(v_project.id)
  );
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
set search_path = public
as $$
declare
  v_contract numeric(12,2);
  v_total numeric(12,2);
  v_item jsonb;
  v_number integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select contract_value into v_contract
  from public.projects
  where id = p_project_id
  for update;

  if not found then raise exception 'Project not found'; end if;
  if v_contract is null or v_contract <= 0 then raise exception 'Project contract value must be confirmed first'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one installment is required'; end if;

  if exists (
    select 1 from public.payment_receipts
    where project_id = p_project_id
      and reconciliation_managed = true
  ) then
    raise exception 'Payment schedule is locked after the first reconciled payment';
  end if;

  select coalesce(sum(round((entry->>'amount')::numeric, 2)), 0)::numeric(12,2)
  into v_total
  from jsonb_array_elements(p_items) entry;

  if v_total <> v_contract then
    raise exception 'Payment schedule total (%) must equal project contract value (%)', v_total, v_contract;
  end if;

  delete from public.project_payment_schedule_items where project_id = p_project_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_number := v_number + 1;
    insert into public.project_payment_schedule_items
      (project_id, quotation_id, proforma_id, installment_number, label, milestone, percentage, amount, due_date)
    values
      (p_project_id, p_quotation_id, p_proforma_id, v_number,
       coalesce(nullif(v_item->>'label', ''), 'Installment ' || v_number),
       nullif(v_item->>'milestone', ''), nullif(v_item->>'percentage', '')::numeric,
       round((v_item->>'amount')::numeric, 2),
       nullif(v_item->>'due_date', '')::date);
  end loop;

  return query
    select * from public.project_payment_schedule_items
    where project_id = p_project_id
    order by installment_number;
end;
$$;

create or replace function public.record_project_payment(
  p_project_id uuid,
  p_receipt_number text,
  p_payment_date date,
  p_amount numeric,
  p_payment_mode text,
  p_schedule_item_id uuid default null,
  p_payment_reference text default null,
  p_notes text default null,
  p_towards text default null,
  p_proforma_id uuid default null,
  p_invoice_id uuid default null,
  p_sub_brand text default null,
  p_client_email text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_receipt public.payment_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount is null or round(p_amount, 2) <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if nullif(trim(p_receipt_number), '') is null then raise exception 'Receipt number is required'; end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then raise exception 'Project not found'; end if;

  insert into public.payment_receipts (
    receipt_number, date, client_id, sub_brand, amount_received, payment_mode,
    payment_reference, towards, invoice_id, proforma_id, project_id,
    payment_schedule_item_id, reconciliation_managed, notes, created_by, client_email
  ) values (
    trim(p_receipt_number), p_payment_date, v_project.client_id,
    coalesce(nullif(p_sub_brand, ''), v_project.sub_brand, ''), round(p_amount, 2),
    p_payment_mode, nullif(trim(p_payment_reference), ''), nullif(trim(p_towards), ''),
    p_invoice_id, p_proforma_id, v_project.id, p_schedule_item_id, true,
    nullif(trim(p_notes), ''), auth.uid(), nullif(trim(p_client_email), '')
  ) returning * into v_receipt;

  return jsonb_build_object(
    'receipt', to_jsonb(v_receipt),
    'summary', public.project_payment_summary_json(v_project.id)
  );
end;
$$;

create or replace function public.void_project_payment(p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_receipt public.payment_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A void reason is required'; end if;

  select * into v_receipt
  from public.payment_receipts
  where id = p_receipt_id
  for update;

  if not found then raise exception 'Receipt not found'; end if;
  if v_receipt.project_id is null or v_receipt.reconciliation_managed = false then
    raise exception 'Only reconciled project payments can be voided through this function';
  end if;
  if v_receipt.is_void then raise exception 'Receipt is already voided'; end if;

  perform 1 from public.projects where id = v_receipt.project_id for update;

  update public.payment_receipts
  set is_void = true, voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_receipt_id;

  return public.project_payment_summary_json(v_receipt.project_id);
end;
$$;

create or replace function public.associate_project_schedule_with_proforma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is not null and new.quotation_id is not null then
    update public.project_payment_schedule_items
    set proforma_id = new.id, updated_at = now()
    where project_id = new.project_id
      and quotation_id = new.quotation_id
      and proforma_id is null;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'associate_project_schedule_with_proforma'
      and tgrelid = 'public.proforma_invoices'::regclass
      and not tgisinternal
  ) then
    create trigger associate_project_schedule_with_proforma
      after insert or update of project_id, quotation_id on public.proforma_invoices
      for each row execute function public.associate_project_schedule_with_proforma();
  end if;
end
$$;

grant execute on function public.project_payment_summary_json(uuid) to authenticated;
grant execute on function public.accept_project_quotation(uuid) to authenticated;
grant execute on function public.replace_project_payment_schedule(uuid, jsonb, uuid, uuid) to authenticated;
grant execute on function public.record_project_payment(uuid, text, date, numeric, text, uuid, text, text, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.void_project_payment(uuid, text) to authenticated;
