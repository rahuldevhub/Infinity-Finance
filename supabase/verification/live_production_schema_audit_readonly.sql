-- Production catalog audit. Read-only: catalog and information-schema queries only.
select jsonb_pretty(jsonb_build_object(
  'captured_at', now(),
  'database', current_database(),
  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'kind', case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table' end,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'approx_rows', greatest(c.reltuples::bigint, 0)
    ) order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  ),
  'columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'ordinal', a.attnum,
      'column', a.attname,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid),
      'identity', nullif(a.attidentity, ''),
      'generated', nullif(a.attgenerated, '')
    ) order by c.relname, a.attnum), '[]'::jsonb)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attnum > 0
      and not a.attisdropped
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'name', con.conname,
      'type', case con.contype
        when 'p' then 'primary_key'
        when 'f' then 'foreign_key'
        when 'u' then 'unique'
        when 'c' then 'check'
        when 'x' then 'exclusion'
        else con.contype::text
      end,
      'definition', pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'initially_deferred', con.condeferred
    ) order by c.relname, con.conname), '[]'::jsonb)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  ),
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'name', indexname,
      'definition', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
    from pg_indexes
    where schemaname = 'public'
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'name', policyname,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    ) order by tablename, policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public'
  ),
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'result', pg_get_function_result(p.oid),
      'language', l.lanname,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'execute_acl', p.proacl,
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
  ),
  'triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'name', t.tgname,
      'enabled', t.tgenabled,
      'definition', pg_get_triggerdef(t.oid, true)
    ) order by c.relname, t.tgname), '[]'::jsonb)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
  )
)) as live_production_schema_audit;
