-- Dashboard financial foundation: make entity scope explicit on operational ledgers.
-- Historical rows remain NULL intentionally; assigning them requires a reviewed business mapping.

alter table public.expenses add column if not exists company text;
alter table public.cash_transactions add column if not exists company text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_company_check'
  ) then
    alter table public.expenses add constraint expenses_company_check
      check (company is null or company in ('ritera', 'ratix', 'infinity'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cash_transactions'::regclass
      and conname = 'cash_transactions_company_check'
  ) then
    alter table public.cash_transactions add constraint cash_transactions_company_check
      check (company is null or company in ('ritera', 'ratix', 'infinity'));
  end if;
end
$$;

create index if not exists expenses_company_date_idx
  on public.expenses(company, date);

create index if not exists cash_transactions_company_date_idx
  on public.cash_transactions(company, date);

create index if not exists invoices_company_date_idx
  on public.invoices(company, invoice_date);

create index if not exists payment_receipts_company_date_valid_idx
  on public.payment_receipts(company, date)
  where is_void = false;

comment on column public.expenses.company is
  'Entity scope used by reporting. NULL means the historical row is unclassified and must not be silently assigned.';

comment on column public.cash_transactions.company is
  'Entity scope used by the canonical cash ledger. NULL means the historical row is unclassified.';
