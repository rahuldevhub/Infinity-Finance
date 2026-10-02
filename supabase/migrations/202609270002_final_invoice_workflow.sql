-- Additive support for final tax invoices with an optional client relationship,
-- immutable bill-to snapshots, and invoice-level discounts. Historical invoice
-- values and due dates are left untouched.

alter table public.invoices alter column client_id drop not null;

alter table public.invoices
  add column if not exists client_name_override text,
  add column if not exists client_gstin_override text,
  add column if not exists billing_address_override text,
  add column if not exists client_state_override text,
  add column if not exists client_email_override text,
  add column if not exists client_phone_override text,
  add column if not exists discount_type text not null default 'flat',
  add column if not exists discount_value numeric(12,4) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass and conname = 'invoices_client_identity_check'
  ) then
    alter table public.invoices add constraint invoices_client_identity_check
      check (client_id is not null or nullif(trim(client_name_override), '') is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass and conname = 'invoices_discount_type_check'
  ) then
    alter table public.invoices add constraint invoices_discount_type_check
      check (discount_type in ('flat', 'percent'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass and conname = 'invoices_discount_values_check'
  ) then
    alter table public.invoices add constraint invoices_discount_values_check
      check (discount_value >= 0 and discount_amount >= 0 and (discount_type <> 'percent' or discount_value <= 100));
  end if;
end
$$;

comment on column public.invoices.client_name_override is 'Bill-to name snapshot for standalone/manual final invoices.';
comment on column public.invoices.discount_amount is 'Invoice-level discount deducted before GST.';
