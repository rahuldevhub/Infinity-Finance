-- Phase 4 corrective migration: one project proforma, issue-time numbering,
-- and one final invoice after the approved contract is fully paid.
-- Existing financial rows are preserved. Legacy/installment proformas remain
-- readable and are deliberately not converted or deleted.

begin;

alter table public.proforma_invoices
  alter column proforma_number drop not null,
  alter column date drop not null;

alter table public.proforma_invoices
  add column if not exists approved_commercial_snapshot jsonb,
  add column if not exists is_project_proforma boolean not null default false,
  add column if not exists issued_at timestamptz;

alter table public.invoices
  add column if not exists issued_at timestamptz;

create unique index if not exists project_single_proforma_unique_idx
  on public.proforma_invoices(project_id)
  where is_project_proforma = true;

comment on column public.proforma_invoices.is_project_proforma is
  'True only for the single full-value proforma created from an approved project snapshot.';
comment on column public.proforma_invoices.issued_at is
  'Set only when the draft proforma receives its issue date and number.';
comment on column public.invoices.issued_at is
  'Set when the final invoice is issued. Project final invoices are not persisted as drafts.';

create or replace function public.next_project_proforma_number(p_issue_date date)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_prefix text;
  v_sequence integer;
begin
  if p_issue_date is null then raise exception 'Proforma issue date is required'; end if;
  v_prefix := 'PRF-' || to_char(p_issue_date, 'YYMM');
  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));
  select coalesce(max(suffix::integer), 0) + 1
    into v_sequence
  from (
    select substring(proforma_number from char_length(v_prefix) + 1) as suffix
    from public.proforma_invoices
    where proforma_number like v_prefix || '%'
  ) numbered
  where suffix ~ '^[0-9]+$';
  return v_prefix || lpad(v_sequence::text, 2, '0');
end;
$$;

create or replace function public.next_project_invoice_number(p_issue_date date)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_prefix text;
  v_sequence integer;
begin
  if p_issue_date is null then raise exception 'Invoice issue date is required'; end if;
  v_prefix := 'INV-' || to_char(p_issue_date, 'YYMM');
  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));
  select coalesce(max(suffix::integer), 0) + 1
    into v_sequence
  from (
    select substring(invoice_number from char_length(v_prefix) + 1) as suffix
    from public.invoices
    where invoice_number like v_prefix || '%'
      and coalesce(invoice_type, 'gst') = 'gst'
  ) numbered
  where suffix ~ '^[0-9]+$';
  return v_prefix || lpad(v_sequence::text, 2, '0');
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
  v_count integer;
  v_index integer := 0;
  v_percentage numeric(7,4);
  v_percentage_total numeric(9,4) := 0;
  v_amount numeric(12,2);
  v_allocated numeric(12,2) := 0;
  v_snapshot jsonb;
  v_proforma_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_quotation from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if v_quotation.project_id is null then raise exception 'Quotation is not linked to a project'; end if;
  select * into v_project from public.projects where id = v_quotation.project_id for update;
  if not found then raise exception 'Project not found'; end if;

  if v_quotation.status = 'approved' and v_project.approved_quotation_id = v_quotation.id then
    return jsonb_build_object(
      'project_id', v_project.id,
      'quotation_id', v_quotation.id,
      'contract_value', v_project.contract_value,
      'payment_summary', public.project_payment_summary_json(v_project.id),
      'idempotent_replay', true
    );
  end if;
  if v_quotation.status not in ('draft', 'sent') then raise exception 'Only a draft or sent quotation can be accepted'; end if;
  if v_project.approved_quotation_id is not null then raise exception 'Project already has an approved quotation'; end if;
  if v_quotation.total_amount is null or v_quotation.total_amount <= 0 then raise exception 'Quotation total must be greater than zero'; end if;
  if round(v_quotation.taxable_value + v_quotation.cgst_amount + v_quotation.sgst_amount + v_quotation.igst_amount, 2) <> round(v_quotation.total_amount, 2) then
    raise exception 'Quotation totals do not reconcile';
  end if;

  v_count := jsonb_array_length(coalesce(v_quotation.payment_schedule, '[]'::jsonb));
  if v_count = 0 then raise exception 'Quotation payment schedule is required'; end if;
  select coalesce(sum((entry->>'percentage')::numeric), 0),
         coalesce(sum(round((entry->>'amount')::numeric, 2)), 0)
    into v_percentage_total, v_allocated
  from jsonb_array_elements(v_quotation.payment_schedule) entry;
  if abs(v_percentage_total - 100) > 0.0001 then raise exception 'Quotation payment percentages must total exactly 100'; end if;
  if v_allocated <> round(v_quotation.total_amount, 2) then raise exception 'Quotation payment amounts must equal the contract value'; end if;

  v_snapshot := public.project_quotation_commercial_spec(v_quotation.id)
    || jsonb_build_object('approvedAt', now(), 'quotationStatus', 'approved');

  update public.projects
  set contract_value = round(v_quotation.total_amount, 2),
      status = 'active',
      approved_quotation_id = v_quotation.id,
      approved_commercial_snapshot = v_snapshot,
      updated_at = now()
  where id = v_project.id;

  update public.quotations
  set status = 'approved', accepted_at = coalesce(accepted_at, now())
  where id = v_quotation.id;

  v_allocated := 0;
  for v_item in select value from jsonb_array_elements(v_quotation.payment_schedule) loop
    v_index := v_index + 1;
    v_percentage := (v_item->>'percentage')::numeric;
    v_amount := case when v_index = v_count
      then round(v_quotation.total_amount, 2) - v_allocated
      else round(v_quotation.total_amount * v_percentage / 100, 2)
    end;

    insert into public.project_payment_schedule_items
      (project_id, quotation_id, installment_number, label, milestone, percentage, amount, due_date)
    values (
      v_project.id,
      v_quotation.id,
      v_index,
      coalesce(nullif(trim(v_item->>'label'), ''), 'Installment ' || v_index),
      nullif(trim(v_item->>'milestone'), ''),
      v_percentage,
      v_amount,
      nullif(v_item->>'due_date', '')::date
    );
    v_allocated := v_allocated + v_amount;
  end loop;

  insert into public.proforma_invoices (
    proforma_number, date, client_id, sub_brand, company, quotation_id, project_id,
    items, taxable_value, include_gst, gst_rate, cgst_amount, sgst_amount,
    igst_amount, is_igst, total_amount, notes, payment_status, status, created_by,
    approved_commercial_snapshot, is_project_proforma, issued_at
  ) values (
    null, null, v_project.client_id, v_quotation.sub_brand, v_quotation.company,
    v_quotation.id, v_project.id, v_quotation.items, v_quotation.taxable_value,
    v_quotation.include_gst, v_quotation.gst_rate, v_quotation.cgst_amount,
    v_quotation.sgst_amount, v_quotation.igst_amount, v_quotation.is_igst,
    v_quotation.total_amount,
    'Full project proforma prepared from approved quotation ' || v_quotation.quotation_number,
    'pending', 'draft', auth.uid(), v_snapshot, true, null
  ) returning id into v_proforma_id;

  update public.project_payment_schedule_items
  set proforma_id = v_proforma_id, updated_at = now()
  where project_id = v_project.id and quotation_id = v_quotation.id;

  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (
    v_project.client_id,
    v_project.id,
    'quotation_approved',
    jsonb_build_object(
      'quotation_id', v_quotation.id,
      'quotation_number', v_quotation.quotation_number,
      'contract_value', v_quotation.total_amount,
      'proforma_id', v_proforma_id
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'project_id', v_project.id,
    'quotation_id', v_quotation.id,
    'proforma_id', v_proforma_id,
    'contract_value', round(v_quotation.total_amount, 2),
    'payment_summary', public.project_payment_summary_json(v_project.id)
  );
end;
$$;

create or replace function public.issue_project_proforma(p_proforma_id uuid, p_issue_date date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proforma public.proforma_invoices%rowtype;
  v_number text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_issue_date is null then raise exception 'Proforma issue date is required'; end if;

  select * into v_proforma
  from public.proforma_invoices
  where id = p_proforma_id
  for update;

  if not found then raise exception 'Proforma not found'; end if;
  if not v_proforma.is_project_proforma or v_proforma.project_id is null then
    raise exception 'Only a prepared project proforma can be issued through this workflow';
  end if;
  if v_proforma.approved_commercial_snapshot is null then
    raise exception 'Proforma requires an approved commercial snapshot';
  end if;
  if v_proforma.status = 'sent' and v_proforma.proforma_number is not null and v_proforma.date is not null then
    return to_jsonb(v_proforma) || jsonb_build_object('idempotent_replay', true);
  end if;
  if v_proforma.status <> 'draft' or v_proforma.proforma_number is not null or v_proforma.date is not null then
    raise exception 'Only an unissued draft proforma can be issued';
  end if;

  v_number := public.next_project_proforma_number(p_issue_date);
  update public.proforma_invoices
  set proforma_number = v_number,
      date = p_issue_date,
      status = 'sent',
      issued_at = now()
  where id = p_proforma_id
  returning * into v_proforma;

  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (
    v_proforma.client_id,
    v_proforma.project_id,
    'proforma_issued',
    jsonb_build_object('proforma_id', v_proforma.id, 'proforma_number', v_number, 'issue_date', p_issue_date),
    auth.uid()
  );

  return to_jsonb(v_proforma);
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
declare
  v_project public.projects%rowtype;
  v_receipt public.payment_receipts%rowtype;
  v_number text;
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

  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (
    v_project.client_id,
    v_project.id,
    'payment_recorded',
    jsonb_build_object('receipt_id', v_receipt.id, 'receipt_number', v_receipt.receipt_number, 'amount', v_receipt.amount_received, 'payment_date', v_receipt.date),
    auth.uid()
  );

  return jsonb_build_object('receipt', to_jsonb(v_receipt), 'summary', public.project_payment_summary_json(v_project.id));
end;
$$;

create or replace function public.void_project_payment(p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt public.payment_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A void reason is required'; end if;
  select * into v_receipt from public.payment_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if v_receipt.project_id is null or not v_receipt.reconciliation_managed then raise exception 'Only reconciled project payments can be voided'; end if;
  if v_receipt.is_void then raise exception 'Receipt is already voided'; end if;
  perform 1 from public.projects where id = v_receipt.project_id for update;

  update public.payment_receipts
  set is_void = true,
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = trim(p_reason)
  where id = p_receipt_id;

  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  select client_id, id, 'payment_voided',
         jsonb_build_object('receipt_id', v_receipt.id, 'receipt_number', v_receipt.receipt_number, 'amount', v_receipt.amount_received, 'reason', trim(p_reason)),
         auth.uid()
  from public.projects where id = v_receipt.project_id;

  return public.project_payment_summary_json(v_receipt.project_id);
end;
$$;

create or replace function public.prepare_project_final_invoice()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_summary jsonb;
  v_q jsonb;
  v_package text;
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
  if v_project.approved_commercial_snapshot is null
     or v_project.approved_quotation_id is null
     or v_summary->>'payment_state' <> 'paid'
     or round(coalesce((v_summary->>'outstanding')::numeric, 0), 2) <> 0 then
    raise exception 'Final invoice requires an approved, fully paid project with zero outstanding';
  end if;
  if exists (
    select 1 from public.invoices
    where project_id = v_project.id and is_final_project_invoice = true and id <> new.id
  ) then
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
  new.items := array[jsonb_build_object(
    'description', v_package || ' — ' || v_project.name,
    'hsn_sac', '',
    'quantity', 1,
    'unit', 'Project',
    'rate', (v_q->>'taxableAmount')::numeric,
    'taxable_value', (v_q->>'taxableAmount')::numeric,
    'gst_rate', (v_q->>'gstRate')::numeric,
    'cgst', (v_q->>'cgstAmount')::numeric,
    'sgst', (v_q->>'sgstAmount')::numeric,
    'igst', (v_q->>'igstAmount')::numeric,
    'total', (v_q->>'total')::numeric
  )];
  new.payment_status := 'paid';
  new.approved_commercial_snapshot := v_project.approved_commercial_snapshot;
  new.is_final_project_invoice := true;
  return new;
end;
$$;

create or replace function public.issue_project_final_invoice(p_project_id uuid, p_issue_date date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_invoice public.invoices%rowtype;
  v_summary jsonb;
  v_number text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_issue_date is null then raise exception 'Invoice issue date is required'; end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  select * into v_client from public.clients where id = v_project.client_id;
  if not found then raise exception 'Project client not found'; end if;
  if v_project.approved_commercial_snapshot is null or v_project.approved_quotation_id is null then
    raise exception 'Final invoice requires an approved commercial contract';
  end if;

  v_summary := public.project_payment_summary_json(v_project.id);
  if v_summary->>'payment_state' <> 'paid'
     or round(coalesce((v_summary->>'outstanding')::numeric, 0), 2) <> 0 then
    raise exception 'Final invoice is locked until all project payments are received';
  end if;

  select * into v_invoice
  from public.invoices
  where project_id = v_project.id and is_final_project_invoice = true
  limit 1;
  if found then return to_jsonb(v_invoice) || jsonb_build_object('idempotent_replay', true); end if;

  v_number := public.next_project_invoice_number(p_issue_date);
  insert into public.invoices (
    invoice_number, invoice_date, client_id, sub_brand, company,
    place_of_supply, place_of_supply_code, is_igst, total_amount,
    payment_status, invoice_type, notes, project_id,
    approved_commercial_snapshot, is_final_project_invoice, issued_at, created_by
  ) values (
    v_number,
    p_issue_date,
    v_project.client_id,
    coalesce(v_project.sub_brand, ''),
    v_project.company,
    coalesce(nullif(v_client.state, ''), 'Tamil Nadu'),
    coalesce(nullif(v_client.state_code, ''), '33'),
    false,
    0,
    'paid',
    'gst',
    'Final invoice generated from the approved commercial snapshot.',
    v_project.id,
    v_project.approved_commercial_snapshot,
    true,
    now(),
    auth.uid()
  ) returning * into v_invoice;

  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (
    v_project.client_id,
    v_project.id,
    'final_invoice_issued',
    jsonb_build_object('invoice_id', v_invoice.id, 'invoice_number', v_number, 'issue_date', p_issue_date),
    auth.uid()
  );

  return to_jsonb(v_invoice);
end;
$$;

grant execute on function public.next_project_proforma_number(date) to authenticated;
grant execute on function public.next_project_invoice_number(date) to authenticated;
grant execute on function public.issue_project_proforma(uuid, date) to authenticated;
grant execute on function public.issue_project_final_invoice(uuid, date) to authenticated;

commit;
