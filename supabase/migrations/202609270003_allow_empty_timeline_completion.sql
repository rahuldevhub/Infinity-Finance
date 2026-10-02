begin;

-- Older approved projects may not have timeline rows. They still need an explicit,
-- audited completion confirmation before a final invoice can be issued. Pending
-- timeline work remains a hard blocker whenever timeline rows do exist.
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
  if v_pending > 0 then raise exception 'Complete every active timeline task before completing the project'; end if;
  update public.projects set status = 'completed', completed_at = now()
  where id = p_project_id returning * into v_project;
  insert into public.project_activity_log(client_id, project_id, event_type, event_data, created_by)
  values (v_project.client_id, v_project.id, 'project_marked_completed',
    jsonb_build_object('completed_at', v_project.completed_at, 'timeline_item_count', v_total), auth.uid());
  return v_project;
end;
$$;

create or replace function public.validate_project_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_pending integer;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status = 'active' and new.approved_quotation_id is null then
    raise exception 'A project becomes active only through quotation approval';
  end if;
  if new.status = 'completed' then
    if new.approved_commercial_snapshot is null then raise exception 'Project completion requires an approved contract'; end if;
    select count(*) filter (where status <> 'completed')::integer into v_pending
    from public.project_timeline_items where project_id = new.id and deleted_at is null;
    if v_pending > 0 then raise exception 'Project completion requires all active timeline tasks to be completed'; end if;
    new.completed_at := coalesce(new.completed_at, now());
  elsif old.status = 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

grant execute on function public.complete_project_from_timeline(uuid) to authenticated;

commit;
