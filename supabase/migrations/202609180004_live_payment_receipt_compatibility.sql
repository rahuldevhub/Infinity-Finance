-- Live-production compatibility correction.
-- Apply immediately after 001 -> 002 -> 003 and before recording project payments.
-- Production payment_receipts.towards is NOT NULL, so a managed payment must
-- always provide a non-empty fallback value.

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
security invoker
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
    p_payment_mode, nullif(trim(p_payment_reference), ''),
    coalesce(nullif(trim(p_towards), ''), 'Project payment'),
    p_invoice_id, p_proforma_id, v_project.id, p_schedule_item_id, true,
    nullif(trim(p_notes), ''), auth.uid(), nullif(trim(p_client_email), '')
  ) returning * into v_receipt;

  return jsonb_build_object(
    'receipt', to_jsonb(v_receipt),
    'summary', public.project_payment_summary_json(v_project.id)
  );
end;
$$;

grant execute on function public.record_project_payment(
  uuid, text, date, numeric, text, uuid, text, text, text, uuid, uuid, text, text
) to authenticated;
