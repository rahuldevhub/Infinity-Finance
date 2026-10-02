-- Phase 7: operational project timeline and completion gating.
-- Timeline data is deliberately isolated from commercial and payment records.

begin;

create table if not exists public.project_timeline_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  sort_order integer not null check (sort_order > 0),
  due_date date,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create index if not exists project_timeline_items_project_order_idx
  on public.project_timeline_items(project_id, sort_order)
  where deleted_at is null;
create index if not exists project_timeline_items_project_status_idx
  on public.project_timeline_items(project_id, status)
  where deleted_at is null;

alter table public.project_timeline_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_timeline_items'
      and policyname = 'Authenticated users can manage project timeline'
  ) then
    create policy "Authenticated users can manage project timeline"
      on public.project_timeline_items for all to authenticated
      using (true) with check (true);
  end if;
end
$$;

create or replace function public.set_project_timeline_item_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists project_timeline_items_set_updated_at on public.project_timeline_items;
create trigger project_timeline_items_set_updated_at
  before update on public.project_timeline_items
  for each row execute function public.set_project_timeline_item_updated_at();

create or replace function public.project_timeline_summary_json(p_project_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'project_id', p_project_id,
    'total_items', count(*)::integer,
    'completed_items', count(*) filter (where status = 'completed')::integer,
    'remaining_items', count(*) filter (where status = 'pending')::integer,
    'progress_percentage', case when count(*) = 0 then null
      else round((count(*) filter (where status = 'completed'))::numeric * 100 / count(*), 0)
    end,
    'execution_state', case
      when count(*) = 0 or count(*) filter (where status = 'completed') = 0 then 'not_started'
      when count(*) filter (where status = 'pending') = 0 then 'ready_to_complete'
      else 'in_progress'
    end
  )
  from public.project_timeline_items
  where project_id = p_project_id and deleted_at is null;
$$;

create or replace function public.create_project_timeline_item(
  p_project_id uuid,
  p_title text,
  p_description text default null,
  p_due_date date default null
)
returns public.project_timeline_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_item public.project_timeline_items%rowtype;
  v_sort_order integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Timeline task name is required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  select coalesce(max(sort_order), 0) + 1 into v_sort_order
  from public.project_timeline_items where project_id = p_project_id and deleted_at is null;
  insert into public.project_timeline_items(project_id, title, description, sort_order, due_date, created_by)
  values (p_project_id, trim(p_title), nullif(trim(p_description), ''), v_sort_order, p_due_date, auth.uid())
  returning * into v_item;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'timeline_task_created',
    jsonb_build_object('timeline_item_id', v_item.id, 'title', v_item.title), auth.uid());
  return v_item;
end;
$$;

create or replace function public.update_project_timeline_item(
  p_item_id uuid,
  p_title text,
  p_description text default null,
  p_due_date date default null
)
returns public.project_timeline_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.project_timeline_items%rowtype;
  v_client_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Timeline task name is required'; end if;
  select * into v_item from public.project_timeline_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Timeline task not found'; end if;
  select client_id into v_client_id from public.projects where id = v_item.project_id;
  update public.project_timeline_items
  set title = trim(p_title), description = nullif(trim(p_description), ''), due_date = p_due_date
  where id = p_item_id returning * into v_item;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_client_id, v_item.project_id, 'timeline_task_edited',
    jsonb_build_object('timeline_item_id', v_item.id, 'title', v_item.title), auth.uid());
  return v_item;
end;
$$;

create or replace function public.set_project_timeline_item_completed(p_item_id uuid, p_completed boolean)
returns public.project_timeline_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.project_timeline_items%rowtype;
  v_client_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.project_timeline_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Timeline task not found'; end if;
  select client_id into v_client_id from public.projects where id = v_item.project_id;
  update public.project_timeline_items
  set status = case when p_completed then 'completed' else 'pending' end,
      completed_at = case when p_completed then now() else null end
  where id = p_item_id returning * into v_item;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_client_id, v_item.project_id,
    case when p_completed then 'timeline_task_completed' else 'timeline_task_reopened' end,
    jsonb_build_object('timeline_item_id', v_item.id, 'title', v_item.title), auth.uid());
  return v_item;
end;
$$;

create or replace function public.delete_project_timeline_item(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.project_timeline_items%rowtype;
  v_client_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.project_timeline_items where id = p_item_id and deleted_at is null for update;
  if not found then raise exception 'Timeline task not found'; end if;
  select client_id into v_client_id from public.projects where id = v_item.project_id;
  update public.project_timeline_items set deleted_at = now() where id = p_item_id;
  with ordered as (
    select id, row_number() over (order by sort_order, created_at, id)::integer as next_order
    from public.project_timeline_items where project_id = v_item.project_id and deleted_at is null
  )
  update public.project_timeline_items item set sort_order = ordered.next_order
  from ordered where item.id = ordered.id;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_client_id, v_item.project_id, 'timeline_task_deleted',
    jsonb_build_object('timeline_item_id', v_item.id, 'title', v_item.title, 'was_completed', v_item.status = 'completed'), auth.uid());
end;
$$;

create or replace function public.reorder_project_timeline_items(p_project_id uuid, p_item_ids uuid[])
returns setof public.project_timeline_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_active_ids uuid[];
  v_client_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select client_id into v_client_id from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  select array_agg(id order by id) into v_active_ids
  from public.project_timeline_items where project_id = p_project_id and deleted_at is null;
  if coalesce(array_length(p_item_ids, 1), 0) <> coalesce(array_length(v_active_ids, 1), 0)
     or exists (select 1 from unnest(p_item_ids) id group by id having count(*) > 1)
     or exists (select 1 from unnest(p_item_ids) id where not (id = any(coalesce(v_active_ids, '{}'::uuid[])))) then
    raise exception 'Reorder must include every active timeline task exactly once';
  end if;
  update public.project_timeline_items item
  set sort_order = ordered.ordinality::integer
  from unnest(p_item_ids) with ordinality ordered(id, ordinality)
  where item.id = ordered.id and item.project_id = p_project_id and item.deleted_at is null;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_client_id, p_project_id, 'timeline_tasks_reordered',
    jsonb_build_object('timeline_item_ids', to_jsonb(p_item_ids)), auth.uid());
  return query select * from public.project_timeline_items
    where project_id = p_project_id and deleted_at is null order by sort_order, created_at;
end;
$$;

create or replace function public.complete_project_from_timeline(p_project_id uuid)
returns public.projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_total integer;
  v_pending integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if v_project.approved_commercial_snapshot is null or v_project.approved_quotation_id is null then
    raise exception 'Project completion requires an approved commercial contract';
  end if;
  select count(*)::integer, count(*) filter (where status <> 'completed')::integer
  into v_total, v_pending from public.project_timeline_items
  where project_id = p_project_id and deleted_at is null;
  if v_total = 0 then raise exception 'Add at least one timeline task before completing the project'; end if;
  if v_pending > 0 then raise exception 'Complete every active timeline task before completing the project'; end if;
  update public.projects set status = 'completed', completed_at = now()
  where id = p_project_id returning * into v_project;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'project_marked_completed',
    jsonb_build_object('completed_at', v_project.completed_at, 'timeline_item_count', v_total), auth.uid());
  return v_project;
end;
$$;

create or replace function public.reopen_project_from_timeline(p_project_id uuid)
returns public.projects
language plpgsql
security invoker
set search_path = public
as $$
declare v_project public.projects%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if v_project.status <> 'completed' then raise exception 'Only a completed project can be reopened'; end if;
  if exists (select 1 from public.invoices where project_id = p_project_id and is_final_project_invoice = true) then
    raise exception 'A project with an issued final invoice cannot be reopened';
  end if;
  update public.projects set status = 'active', completed_at = null
  where id = p_project_id returning * into v_project;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'project_reopened', '{}'::jsonb, auth.uid());
  return v_project;
end;
$$;

-- Completion is operational. Payment remains a separate invoice-eligibility gate.
create or replace function public.validate_project_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_total integer; v_pending integer;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status = 'active' and new.approved_quotation_id is null then
    raise exception 'A project becomes active only through quotation approval';
  end if;
  if new.status = 'completed' then
    if new.approved_commercial_snapshot is null then raise exception 'Project completion requires an approved contract'; end if;
    select count(*)::integer, count(*) filter (where status <> 'completed')::integer into v_total, v_pending
    from public.project_timeline_items where project_id = new.id and deleted_at is null;
    if v_total = 0 or v_pending > 0 then raise exception 'Project completion requires all active timeline tasks to be completed'; end if;
    new.completed_at := coalesce(new.completed_at, now());
  elsif old.status = 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_project_final_invoice()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_project public.projects%rowtype; v_summary jsonb; v_q jsonb; v_package text;
begin
  if tg_op = 'UPDATE' and old.is_final_project_invoice = true and (
    old.project_id is distinct from new.project_id or old.client_id is distinct from new.client_id
    or old.items is distinct from new.items or old.taxable_value is distinct from new.taxable_value
    or old.cgst_amount is distinct from new.cgst_amount or old.sgst_amount is distinct from new.sgst_amount
    or old.igst_amount is distinct from new.igst_amount or old.total_amount is distinct from new.total_amount
    or old.approved_commercial_snapshot is distinct from new.approved_commercial_snapshot
  ) then raise exception 'Final project invoice commercial terms are immutable'; end if;
  if new.project_id is null then return new; end if;
  select * into v_project from public.projects where id = new.project_id for update;
  if not found then raise exception 'Project not found'; end if;
  v_summary := public.project_payment_summary_json(v_project.id);
  if v_project.status <> 'completed' or v_project.approved_commercial_snapshot is null
     or v_project.approved_quotation_id is null or v_summary->>'payment_state' <> 'paid'
     or round(coalesce((v_summary->>'outstanding')::numeric, 0), 2) <> 0 then
    raise exception 'Final invoice requires an approved, completed, fully paid project with zero outstanding';
  end if;
  if exists (select 1 from public.invoices where project_id = v_project.id and is_final_project_invoice = true and id <> new.id) then
    raise exception 'A final invoice already exists for this project';
  end if;
  v_q := v_project.approved_commercial_snapshot->'commercials';
  v_package := coalesce(v_project.approved_commercial_snapshot#>>'{package,packageName}', v_project.name);
  new.client_id := v_project.client_id; new.sub_brand := coalesce(v_project.sub_brand, new.sub_brand);
  new.company := coalesce(v_project.company, new.company); new.taxable_value := (v_q->>'taxableAmount')::numeric;
  new.cgst_amount := (v_q->>'cgstAmount')::numeric; new.sgst_amount := (v_q->>'sgstAmount')::numeric;
  new.igst_amount := (v_q->>'igstAmount')::numeric; new.total_amount := (v_q->>'total')::numeric;
  new.is_igst := coalesce((v_q->>'isIgst')::boolean, false);
  new.items := array[jsonb_build_object('description', v_package || ' — ' || v_project.name, 'hsn_sac', '', 'quantity', 1, 'unit', 'Project',
    'rate', (v_q->>'taxableAmount')::numeric, 'taxable_value', (v_q->>'taxableAmount')::numeric,
    'gst_rate', (v_q->>'gstRate')::numeric, 'cgst', (v_q->>'cgstAmount')::numeric,
    'sgst', (v_q->>'sgstAmount')::numeric, 'igst', (v_q->>'igstAmount')::numeric, 'total', (v_q->>'total')::numeric)];
  new.payment_status := 'paid'; new.approved_commercial_snapshot := v_project.approved_commercial_snapshot;
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
declare v_project public.projects%rowtype; v_client public.clients%rowtype; v_invoice public.invoices%rowtype; v_summary jsonb; v_number text;
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
  if v_project.status <> 'completed' then raise exception 'Final invoice is locked until project work is marked completed'; end if;
  v_summary := public.project_payment_summary_json(v_project.id);
  if v_summary->>'payment_state' <> 'paid' or round(coalesce((v_summary->>'outstanding')::numeric, 0), 2) <> 0 then
    raise exception 'Final invoice is locked until all project payments are received';
  end if;
  select * into v_invoice from public.invoices where project_id = v_project.id and is_final_project_invoice = true limit 1;
  if found then return to_jsonb(v_invoice) || jsonb_build_object('idempotent_replay', true); end if;
  v_number := public.next_project_invoice_number(p_issue_date);
  insert into public.invoices(invoice_number, invoice_date, client_id, sub_brand, company, place_of_supply, place_of_supply_code,
    is_igst, total_amount, payment_status, invoice_type, notes, project_id, approved_commercial_snapshot,
    is_final_project_invoice, issued_at, created_by)
  values (v_number, p_issue_date, v_project.client_id, coalesce(v_project.sub_brand, ''), v_project.company,
    coalesce(nullif(v_client.state, ''), 'Tamil Nadu'), coalesce(nullif(v_client.state_code, ''), '33'), false, 0,
    'paid', 'gst', 'Final invoice generated from the approved commercial snapshot.', v_project.id,
    v_project.approved_commercial_snapshot, true, now(), auth.uid()) returning * into v_invoice;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'final_invoice_issued',
    jsonb_build_object('invoice_id', v_invoice.id, 'invoice_number', v_number, 'issue_date', p_issue_date), auth.uid());
  return to_jsonb(v_invoice);
end;
$$;

grant select, insert, update on public.project_timeline_items to authenticated;
grant execute on function public.project_timeline_summary_json(uuid) to authenticated;
grant execute on function public.create_project_timeline_item(uuid, text, text, date) to authenticated;
grant execute on function public.update_project_timeline_item(uuid, text, text, date) to authenticated;
grant execute on function public.set_project_timeline_item_completed(uuid, boolean) to authenticated;
grant execute on function public.delete_project_timeline_item(uuid) to authenticated;
grant execute on function public.reorder_project_timeline_items(uuid, uuid[]) to authenticated;
grant execute on function public.complete_project_from_timeline(uuid) to authenticated;
grant execute on function public.reopen_project_from_timeline(uuid) to authenticated;
grant execute on function public.issue_project_final_invoice(uuid, date) to authenticated;

commit;
