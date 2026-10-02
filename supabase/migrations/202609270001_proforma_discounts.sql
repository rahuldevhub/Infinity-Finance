-- Additive proforma discount fields. Existing rows retain their current totals
-- and are represented as zero-discount documents.
begin;

alter table public.proforma_invoices
  add column if not exists discount_type text not null default 'flat',
  add column if not exists discount_value numeric(12,4) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.proforma_invoices'::regclass
      and conname = 'proforma_discount_type_check'
  ) then
    alter table public.proforma_invoices
      add constraint proforma_discount_type_check
      check (discount_type in ('flat', 'percent'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.proforma_invoices'::regclass
      and conname = 'proforma_discount_values_check'
  ) then
    alter table public.proforma_invoices
      add constraint proforma_discount_values_check
      check (
        discount_value >= 0
        and discount_amount >= 0
        and (discount_type <> 'percent' or discount_value <= 100)
        and discount_amount <= taxable_value + discount_amount
      );
  end if;
end $$;

comment on column public.proforma_invoices.discount_type is
  'Discount input mode: flat currency amount or percent of the pre-discount subtotal.';
comment on column public.proforma_invoices.discount_value is
  'User-entered discount value in the selected discount_type.';
comment on column public.proforma_invoices.discount_amount is
  'Calculated discount amount deducted before GST.';

commit;
