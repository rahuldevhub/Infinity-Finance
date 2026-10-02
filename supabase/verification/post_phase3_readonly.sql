-- Read-only verification after applying 001 -> 002 -> 003.
select jsonb_pretty(jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'table', required.name,
      'exists', to_regclass('public.' || required.name) is not null
    ) order by required.name)
    from (values
      ('clients'), ('projects'), ('quotations'), ('proforma_invoices'), ('invoices'),
      ('payment_receipts'), ('project_payment_schedule_items'), ('project_agreements'),
      ('email_templates'), ('client_email_log')
    ) required(name)
  ),
  'columns', (
    select jsonb_agg(jsonb_build_object(
      'table', required.table_name,
      'column', required.column_name,
      'exists', columns.column_name is not null,
      'type', columns.data_type,
      'nullable', columns.is_nullable
    ) order by required.table_name, required.column_name)
    from (values
      ('clients', 'default_company'),
      ('projects', 'company'), ('projects', 'contract_value'), ('projects', 'onboarding_key'),
      ('projects', 'onboarding_snapshot'), ('projects', 'proposed_price'), ('projects', 'service_details'),
      ('quotations', 'project_id'), ('quotations', 'company'), ('quotations', 'accepted_at'),
      ('quotations', 'discount_type'), ('quotations', 'discount_value'),
      ('quotations', 'discount_amount'), ('quotations', 'payment_schedule'),
      ('proforma_invoices', 'project_id'), ('proforma_invoices', 'company'),
      ('invoices', 'project_id'), ('invoices', 'company'),
      ('payment_receipts', 'project_id'), ('payment_receipts', 'company'),
      ('payment_receipts', 'payment_schedule_item_id'), ('payment_receipts', 'reconciliation_managed'),
      ('payment_receipts', 'is_void'), ('payment_receipts', 'client_email'),
      ('project_payment_schedule_items', 'project_id'), ('project_payment_schedule_items', 'amount')
    ) required(table_name, column_name)
    left join information_schema.columns columns
      on columns.table_schema = 'public'
     and columns.table_name = required.table_name
     and columns.column_name = required.column_name
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'function', required.name,
      'exists', functions.oid is not null,
      'arguments', functions.arguments,
      'authenticated_execute', case when functions.oid is null then false else has_function_privilege('authenticated', functions.oid, 'EXECUTE') end
    ) order by required.name)
    from (values
      ('create_client_project_onboarding'), ('accept_project_quotation'),
      ('replace_project_payment_schedule'), ('record_project_payment'),
      ('void_project_payment'), ('project_payment_summary_json')
    ) required(name)
    left join lateral (
      select p.oid, pg_get_function_identity_arguments(p.oid) as arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = required.name
      order by p.oid desc
      limit 1
    ) functions on true
  ),
  'rls', (
    select jsonb_agg(jsonb_build_object(
      'table', required.name,
      'enabled', coalesce(classes.relrowsecurity, false)
    ) order by required.name)
    from (values
      ('clients'), ('projects'), ('quotations'), ('proforma_invoices'), ('invoices'),
      ('payment_receipts'), ('project_payment_schedule_items'), ('project_agreements'),
      ('email_templates'), ('client_email_log')
    ) required(name)
    left join pg_namespace namespaces on namespaces.nspname = 'public'
    left join pg_class classes on classes.relnamespace = namespaces.oid
      and classes.relname = required.name and classes.relkind = 'r'
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'policy', policyname,
      'command', cmd,
      'roles', roles
    ) order by tablename, policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clients', 'projects', 'quotations', 'proforma_invoices', 'invoices',
        'payment_receipts', 'project_payment_schedule_items', 'project_agreements',
        'email_templates', 'client_email_log'
      )
  )
)) as phase_3_verification_report;
