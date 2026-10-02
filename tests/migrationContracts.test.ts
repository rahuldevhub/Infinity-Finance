import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migration = (name: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const phase1 = migration('202609180001_add_projects.sql');
const phase2 = migration('202609180002_add_payment_reconciliation.sql');
const phase3 = migration('202609180003_client_onboarding_workspace.sql');
const phase4 = migration('202609180004_live_payment_receipt_compatibility.sql');
const phase5 = migration('202609250005_commercial_lifecycle.sql');
const phase6 = migration('202609250006_single_project_documents.sql');
const phase7 = migration('202609250007_project_timeline.sql');
const phase8 = migration('202609260001_admin_client_cleanup.sql');
const phase9 = migration('202609260002_admin_receipt_delete_override.sql');
const phase10 = migration('202609270001_proforma_discounts.sql');
const phase11 = migration('202609270002_final_invoice_workflow.sql');
const phase12 = migration('202609270003_allow_empty_timeline_completion.sql');
const verification = readFileSync(resolve(process.cwd(), 'supabase/verification/post_phase3_readonly.sql'), 'utf8');

test('migrations remain additive and ordered by their real dependencies', () => {
  for (const sql of [phase1, phase2, phase3, phase4]) {
    assert.doesNotMatch(sql, /\b(drop|truncate)\b/i);
  }
  assert.match(phase1, /create table if not exists public\.projects/i);
  assert.match(phase2, /references public\.projects\(id\)/i);
  assert.match(phase3, /alter table public\.projects add column if not exists onboarding_snapshot/i);
});

test('live payment receipt correction satisfies the production NOT NULL rule', () => {
  assert.match(phase4, /create or replace function public\.record_project_payment/i);
  assert.match(phase4, /coalesce\(nullif\(trim\(p_towards\), ''\), 'Project payment'\)/i);
  assert.doesNotMatch(phase4, /\b(drop|truncate|delete)\b/i);
});

test('Phase 1 preserves historical documents and protects linked projects', () => {
  const sql = normalize(phase1);
  for (const table of ['quotations', 'proforma_invoices', 'invoices', 'payment_receipts']) {
    assert.ok(sql.includes(`alter table public.${table} add column if not exists project_id uuid references public.projects(id) on delete restrict`));
  }
  assert.match(phase1, /alter table public\.projects enable row level security/i);
  assert.match(phase1, /projects_set_updated_at/i);
});

test('Phase 2 RPC signatures match the application service contract', () => {
  const sql = normalize(phase2);
  assert.ok(sql.includes('function public.accept_project_quotation(p_quotation_id uuid)'));
  assert.ok(sql.includes('function public.replace_project_payment_schedule( p_project_id uuid, p_items jsonb, p_quotation_id uuid default null, p_proforma_id uuid default null )'));
  assert.ok(sql.includes('function public.record_project_payment( p_project_id uuid, p_receipt_number text, p_payment_date date, p_amount numeric, p_payment_mode text, p_schedule_item_id uuid default null, p_payment_reference text default null, p_notes text default null, p_towards text default null, p_proforma_id uuid default null, p_invoice_id uuid default null, p_sub_brand text default null, p_client_email text default null )'));
  assert.ok(sql.includes('function public.void_project_payment(p_receipt_id uuid, p_reason text)'));
  assert.ok(sql.includes('function public.project_payment_summary_json(p_project_id uuid)'));
});

test('Phase 2 enforces locking, positive payments, overpayment, and void history', () => {
  assert.match(phase2, /where id = p_project_id\s+for update/i);
  assert.match(phase2, /Payment amount must be greater than zero/i);
  assert.match(phase2, /Payment exceeds project outstanding balance/i);
  assert.match(phase2, /Payment exceeds installment remaining balance/i);
  assert.match(phase2, /Reconciled project payments must be voided, not deleted/i);
  assert.match(phase2, /add column if not exists client_email text/i);
});

test('Phase 3 onboarding RPC is atomic, draft-only, and concurrency-idempotent', () => {
  const sql = normalize(phase3);
  assert.ok(sql.includes('function public.create_client_project_onboarding( p_client jsonb, p_project jsonb, p_quotation jsonb )'));
  assert.match(phase3, /pg_advisory_xact_lock/i);
  assert.match(phase3, /on public\.projects\(created_by, onboarding_key\)/i);
  assert.match(phase3, /'quotation', null,/i);
  assert.match(phase3, /'draft', null, auth\.uid\(\)/i);
  assert.doesNotMatch(phase3, /insert into public\.project_payment_schedule_items/i);
  assert.doesNotMatch(phase3, /insert into public\.payment_receipts/i);
  assert.match(phase3, /Draft payment split amounts must equal the proposed total/i);
});

test('new Phase 1-3 tables keep RLS enabled and authenticated policies', () => {
  for (const [sql, table] of [
    [phase1, 'projects'],
    [phase2, 'project_payment_schedule_items'],
    [phase3, 'project_agreements'],
    [phase3, 'email_templates'],
    [phase3, 'client_email_log'],
  ] as const) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(phase1, /to authenticated/i);
  assert.match(phase2, /to authenticated/i);
  assert.match(phase3, /to authenticated/i);
});

test('post-migration verification SQL is read-only and checks every required RPC', () => {
  assert.doesNotMatch(verification, /\b(create|alter|insert|update|delete|drop|truncate)\b/i);
  for (const name of [
    'create_client_project_onboarding', 'accept_project_quotation',
    'replace_project_payment_schedule', 'record_project_payment',
    'void_project_payment', 'project_payment_summary_json',
  ]) {
    assert.ok(verification.includes(`('${name}')`));
  }
});

test('Phase 4 lifecycle keeps one canonical draft and freezes approval terms', () => {
  assert.match(phase5, /add column if not exists current_commercial_spec jsonb/i);
  assert.match(phase5, /add column if not exists approved_commercial_snapshot jsonb/i);
  assert.match(phase5, /function public\.save_project_draft_quotation/i);
  assert.match(phase5, /Approved quotation commercial terms are immutable/i);
  assert.match(phase5, /Payment percentages must total exactly 100/i);
  assert.match(phase5, /Quotation payment amounts must equal the contract value/i);
  assert.doesNotMatch(phase5, /drop\s+(table|column)/i);
  assert.doesNotMatch(phase5, /truncate/i);
});

test('Phase 4 lifecycle creates requests, protects payments, and gates final invoices', () => {
  assert.match(phase5, /insert into public\.proforma_invoices/i);
  assert.match(phase5, /next_project_receipt_number\(p_payment_date date\)/i);
  assert.match(phase5, /Payment requires an approved project contract/i);
  assert.match(phase5, /managed_payment_reference_unique_idx/i);
  assert.match(phase5, /payment_voided/i);
  assert.match(phase5, /Project completion requires all installments to be fully paid/i);
  assert.match(phase5, /Final invoice requires an approved, completed, fully paid project/i);
  assert.match(phase5, /new\.approved_commercial_snapshot := v_project\.approved_commercial_snapshot/i);
});

test('corrective lifecycle creates one unissued full-value proforma per new approved project', () => {
  assert.equal((phase6.match(/insert into public\.proforma_invoices/gi) || []).length, 1);
  assert.match(phase6, /project_single_proforma_unique_idx/i);
  assert.match(phase6, /where is_project_proforma = true/i);
  assert.match(phase6, /null, null, v_project\.client_id/i);
  assert.match(phase6, /v_quotation\.total_amount[\s\S]*?'pending', 'draft'/i);
  assert.doesNotMatch(phase6, /delete\s+from\s+public\.proforma_invoices/i);
  assert.doesNotMatch(phase6, /drop\s+(table|column)/i);
  assert.doesNotMatch(phase6, /truncate/i);
});

test('document numbers are assigned only by issue-date RPCs', () => {
  assert.match(phase6, /next_project_proforma_number\(p_issue_date date\)/i);
  assert.match(phase6, /'PRF-' \|\| to_char\(p_issue_date, 'YYMM'\)/i);
  assert.match(phase6, /issue_project_proforma\(p_proforma_id uuid, p_issue_date date\)/i);
  assert.match(phase6, /set proforma_number = v_number,[\s\S]*date = p_issue_date,[\s\S]*status = 'sent'/i);
  assert.match(phase6, /next_project_invoice_number\(p_issue_date date\)/i);
  assert.match(phase6, /'INV-' \|\| to_char\(p_issue_date, 'YYMM'\)/i);
  assert.match(phase6, /issue_project_final_invoice\(p_project_id uuid, p_issue_date date\)/i);
});

test('final invoice is snapshot-based and gated by actual paid balance', () => {
  assert.match(phase6, /v_summary->>'payment_state' <> 'paid'/i);
  assert.match(phase6, /v_summary->>'outstanding'/i);
  assert.match(phase6, /new\.approved_commercial_snapshot := v_project\.approved_commercial_snapshot/i);
  assert.match(phase6, /project_final_invoice_unique_idx|A final invoice already exists for this project/i);
  const recordPayment = phase6.slice(
    phase6.indexOf('create or replace function public.record_project_payment'),
    phase6.indexOf('create or replace function public.void_project_payment'),
  );
  assert.doesNotMatch(recordPayment, /update public\.proforma_invoices/i);
});

test('project timeline is additive, audited, soft-deleted, and ordered in the database', () => {
  assert.match(phase7, /create table if not exists public\.project_timeline_items/i);
  assert.match(phase7, /alter table public\.project_timeline_items enable row level security/i);
  assert.match(phase7, /deleted_at timestamptz/i);
  assert.match(phase7, /reorder_project_timeline_items\(p_project_id uuid, p_item_ids uuid\[\]\)/i);
  assert.match(phase7, /timeline_task_(created|edited|completed|reopened|deleted)/i);
  assert.doesNotMatch(phase7, /delete\s+from\s+public\.project_timeline_items/i);
  assert.doesNotMatch(phase7, /drop\s+(table|column)/i);
  assert.doesNotMatch(phase7, /truncate/i);
});

test('project completion and final invoice require independent execution and payment gates', () => {
  assert.match(phase7, /complete_project_from_timeline\(p_project_id uuid\)/i);
  assert.match(phase7, /Project completion requires all active timeline tasks to be completed/i);
  assert.match(phase7, /v_project\.status <> 'completed'/i);
  assert.match(phase7, /v_summary->>'payment_state' <> 'paid'/i);
  assert.match(phase7, /v_summary->>'outstanding'/i);
  assert.match(phase7, /Final invoice requires an approved, completed, fully paid project with zero outstanding/i);
});

test('approved legacy projects can be explicitly completed without fabricated timeline rows', () => {
  assert.match(phase12, /complete_project_from_timeline\(p_project_id uuid\)/i);
  assert.match(phase12, /if v_pending > 0 then raise exception 'Complete every active timeline task/i);
  assert.doesNotMatch(phase12, /if v_total = 0 then raise exception/i);
  assert.match(phase12, /'project_marked_completed'/i);
  assert.match(phase12, /'timeline_item_count', v_total/i);
  assert.doesNotMatch(phase12, /\b(delete|truncate|drop table|drop column)\b/i);
});

test('admin client cleanup is explicit, scoped, and transaction-safe', () => {
  assert.match(phase8, /begin;/i);
  assert.match(phase8, /commit;/i);
  assert.match(phase8, /function public\.delete_client_financial_document/i);
  assert.match(phase8, /function public\.delete_client_project/i);
  assert.match(phase8, /function public\.delete_client_record/i);
  assert.match(phase8, /client_cleanup_matches_workspace/i);
  assert.match(phase8, /update public\.payment_receipts set invoice_id = null/i);
  assert.match(phase8, /update public\.projects set approved_quotation_id = null/i);
  assert.match(phase8, /Project still has financial documents/i);
  assert.doesNotMatch(phase8, /on delete cascade/i);
});

test('admin receipt deletion bypass is scoped to the cleanup transaction', () => {
  assert.match(phase9, /current_setting\('app\.client_workspace_admin_delete', true\) = 'on'/i);
  assert.match(phase9, /set_config\('app\.client_workspace_admin_delete', 'on', true\)/i);
  assert.match(phase9, /set_config\('app\.client_workspace_admin_delete', 'off', true\)/i);
  assert.match(phase9, /Reconciled project payments must be voided, not deleted/i);
  assert.doesNotMatch(phase9, /drop trigger|disable trigger/i);
});

test('proforma discounts are additive and preserve existing rows as zero-discount documents', () => {
  assert.match(phase10, /add column if not exists discount_type text not null default 'flat'/i);
  assert.match(phase10, /add column if not exists discount_value numeric\(12,4\) not null default 0/i);
  assert.match(phase10, /add column if not exists discount_amount numeric\(12,2\) not null default 0/i);
  assert.match(phase10, /discount_type in \('flat', 'percent'\)/i);
  assert.doesNotMatch(phase10, /\b(update|delete|truncate|drop table|drop column)\b/i);
});

test('final invoice workflow permits standalone bill-to snapshots without rewriting history', () => {
  assert.match(phase11, /alter column client_id drop not null/i);
  assert.match(phase11, /add column if not exists client_name_override text/i);
  assert.match(phase11, /add column if not exists client_gstin_override text/i);
  assert.match(phase11, /add column if not exists billing_address_override text/i);
  assert.match(phase11, /add column if not exists discount_type text not null default 'flat'/i);
  assert.match(phase11, /client_id is not null or nullif\(trim\(client_name_override\), ''\) is not null/i);
  assert.doesNotMatch(phase11, /\b(update|delete|truncate|drop table|drop column)\b/i);
  assert.doesNotMatch(phase11, /alter column due_date/i);
});
