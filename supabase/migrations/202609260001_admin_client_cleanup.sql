-- Explicit, transaction-safe cleanup operations for the admin Client Workspace.
-- These functions detach references owned by related records, then delete only
-- the record the admin selected. No database-wide cascade behavior is changed.

begin;

create or replace function public.client_cleanup_matches_workspace(
  p_company text,
  p_sub_brand text,
  p_workspace text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_workspace = 'infinity'
    or p_company = p_workspace
    or (
      p_company is null
      and case p_workspace
        when 'ritera' then lower(coalesce(p_sub_brand, '')) like '%ritera%'
        when 'ratix' then lower(coalesce(p_sub_brand, '')) like '%ratix%'
        else lower(coalesce(p_sub_brand, '')) like '%infinity%'
      end
    );
$$;

create or replace function public.delete_client_financial_document(
  p_document_type text,
  p_document_id uuid,
  p_workspace text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_sub_brand text;
  v_project_id uuid;
  v_approved_quotation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_workspace not in ('infinity', 'ritera', 'ratix') then raise exception 'Invalid workspace'; end if;

  if p_document_type = 'invoice' then
    select company, sub_brand into v_company, v_sub_brand
    from public.invoices where id = p_document_id for update;
    if not found then raise exception 'Document not found'; end if;
    if not public.client_cleanup_matches_workspace(v_company, v_sub_brand, p_workspace) then raise exception 'Document belongs to another workspace'; end if;

    update public.payment_receipts set invoice_id = null where invoice_id = p_document_id;
    update public.quotations set converted_invoice_id = null where converted_invoice_id = p_document_id;
    update public.proforma_invoices set converted_invoice_id = null where converted_invoice_id = p_document_id;
    delete from public.invoices where id = p_document_id;

  elsif p_document_type = 'receipt' then
    select company, sub_brand into v_company, v_sub_brand
    from public.payment_receipts where id = p_document_id for update;
    if not found then raise exception 'Document not found'; end if;
    if not public.client_cleanup_matches_workspace(v_company, v_sub_brand, p_workspace) then raise exception 'Document belongs to another workspace'; end if;

    -- Preserve the global managed-payment delete guard while allowing this
    -- explicit admin cleanup operation to remove the selected receipt.
    perform set_config('app.client_workspace_admin_delete', 'on', true);
    delete from public.payment_receipts where id = p_document_id;
    perform set_config('app.client_workspace_admin_delete', 'off', true);

  elsif p_document_type = 'quotation' then
    select company, sub_brand into v_company, v_sub_brand
    from public.quotations where id = p_document_id for update;
    if not found then raise exception 'Document not found'; end if;
    if not public.client_cleanup_matches_workspace(v_company, v_sub_brand, p_workspace) then raise exception 'Document belongs to another workspace'; end if;

    -- The approved quotation pointer is RESTRICT. Clear only the pointer; the
    -- immutable commercial snapshot stays on the project as historical context.
    update public.projects set approved_quotation_id = null, updated_at = now()
      where approved_quotation_id = p_document_id;
    update public.project_payment_schedule_items set quotation_id = null, updated_at = now()
      where quotation_id = p_document_id;
    update public.proforma_invoices set quotation_id = null where quotation_id = p_document_id;
    update public.payment_receipts set quotation_id = null where quotation_id = p_document_id;
    delete from public.quotations where id = p_document_id;

  elsif p_document_type = 'proforma' then
    select company, sub_brand into v_company, v_sub_brand
    from public.proforma_invoices where id = p_document_id for update;
    if not found then raise exception 'Document not found'; end if;
    if not public.client_cleanup_matches_workspace(v_company, v_sub_brand, p_workspace) then raise exception 'Document belongs to another workspace'; end if;

    -- Approved schedules are normally immutable. Temporarily clear their
    -- project approval pointer inside this transaction, detach the selected
    -- proforma, then restore the unchanged quotation approval.
    for v_project_id, v_approved_quotation_id in
      select distinct p.id, p.approved_quotation_id
      from public.projects p
      join public.project_payment_schedule_items item on item.project_id = p.id
      where item.proforma_id = p_document_id
    loop
      update public.projects set approved_quotation_id = null where id = v_project_id;
      update public.project_payment_schedule_items set proforma_id = null, updated_at = now()
        where project_id = v_project_id and proforma_id = p_document_id;
      update public.projects set approved_quotation_id = v_approved_quotation_id where id = v_project_id;
    end loop;
    update public.payment_receipts set proforma_id = null where proforma_id = p_document_id;
    delete from public.proforma_invoices where id = p_document_id;

  else
    raise exception 'Unsupported document type';
  end if;

  return jsonb_build_object('id', p_document_id, 'type', p_document_type, 'deleted', true);
end;
$$;

create or replace function public.delete_client_project(
  p_project_id uuid,
  p_workspace text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_workspace not in ('infinity', 'ritera', 'ratix') then raise exception 'Invalid workspace'; end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if not public.client_cleanup_matches_workspace(v_project.company, v_project.sub_brand, p_workspace) then raise exception 'Project belongs to another workspace'; end if;
  if exists (select 1 from public.invoices where project_id = p_project_id)
    or exists (select 1 from public.payment_receipts where project_id = p_project_id)
    or exists (select 1 from public.quotations where project_id = p_project_id)
    or exists (select 1 from public.proforma_invoices where project_id = p_project_id)
  then raise exception 'Project still has financial documents'; end if;

  update public.projects set approved_quotation_id = null where id = p_project_id;
  delete from public.project_timeline_items where project_id = p_project_id;
  delete from public.project_agreements where project_id = p_project_id;
  delete from public.client_email_log where project_id = p_project_id;
  delete from public.project_activity_log where project_id = p_project_id;
  delete from public.project_payment_schedule_items where project_id = p_project_id;
  delete from public.projects where id = p_project_id;

  return jsonb_build_object('id', p_project_id, 'deleted', true);
end;
$$;

create or replace function public.delete_client_record(
  p_client_id uuid,
  p_workspace text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_workspace not in ('infinity', 'ritera', 'ratix') then raise exception 'Invalid workspace'; end if;

  select default_company into v_company from public.clients where id = p_client_id for update;
  if not found then raise exception 'Client not found'; end if;
  if p_workspace <> 'infinity' and v_company is distinct from p_workspace then raise exception 'Client belongs to another workspace'; end if;

  if exists (select 1 from public.projects where client_id = p_client_id)
    or exists (select 1 from public.invoices where client_id = p_client_id)
    or exists (select 1 from public.payment_receipts where client_id = p_client_id)
    or exists (select 1 from public.quotations where client_id = p_client_id)
    or exists (select 1 from public.proforma_invoices where client_id = p_client_id)
  then raise exception 'Client still has linked records'; end if;

  delete from public.client_email_log where client_id = p_client_id;
  delete from public.project_agreements where client_id = p_client_id;
  delete from public.project_activity_log where client_id = p_client_id;
  delete from public.clients where id = p_client_id;

  return jsonb_build_object('id', p_client_id, 'deleted', true);
end;
$$;

revoke all on function public.delete_client_financial_document(text, uuid, text) from public;
revoke all on function public.delete_client_project(uuid, text) from public;
revoke all on function public.delete_client_record(uuid, text) from public;
grant execute on function public.delete_client_financial_document(text, uuid, text) to authenticated;
grant execute on function public.delete_client_project(uuid, text) to authenticated;
grant execute on function public.delete_client_record(uuid, text) to authenticated;

commit;
