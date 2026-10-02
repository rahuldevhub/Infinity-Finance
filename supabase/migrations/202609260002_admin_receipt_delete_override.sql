-- Let the explicit Client Workspace admin cleanup RPC permanently delete a
-- selected managed receipt without weakening the normal reconciliation guard.

begin;

create or replace function public.prevent_managed_payment_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.client_workspace_admin_delete', true) = 'on' then
    return old;
  end if;

  if old.project_id is not null and old.reconciliation_managed = true then
    raise exception 'Reconciled project payments must be voided, not deleted';
  end if;
  return old;
end;
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

    perform set_config('app.client_workspace_admin_delete', 'on', true);
    delete from public.payment_receipts where id = p_document_id;
    perform set_config('app.client_workspace_admin_delete', 'off', true);

  elsif p_document_type = 'quotation' then
    select company, sub_brand into v_company, v_sub_brand
    from public.quotations where id = p_document_id for update;
    if not found then raise exception 'Document not found'; end if;
    if not public.client_cleanup_matches_workspace(v_company, v_sub_brand, p_workspace) then raise exception 'Document belongs to another workspace'; end if;

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

revoke all on function public.delete_client_financial_document(text, uuid, text) from public;
grant execute on function public.delete_client_financial_document(text, uuid, text) to authenticated;

commit;
