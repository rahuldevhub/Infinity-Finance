import { supabase } from '../lib/supabase';
import type { PaymentReceipt, ProjectPaymentScheduleItem, ProjectPaymentSummary } from '../types';

export interface PaymentScheduleDraftItem {
  label: string;
  milestone?: string | null;
  percentage: number | null;
  amount: number;
  due_date: string | null;
}

export interface RecordProjectPaymentInput {
  projectId: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  scheduleItemId?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  towards?: string | null;
  proformaId?: string | null;
  invoiceId?: string | null;
  subBrand?: string | null;
  clientEmail?: string | null;
}

export interface RecordProjectPaymentResult {
  receipt: PaymentReceipt;
  summary: ProjectPaymentSummary;
}

export interface ProjectDraftQuotationInput {
  date: string;
  valid_until?: string | null;
  title: string;
  consultant_name?: string | null;
  items: unknown[];
  base_price: number;
  discount_type: 'flat' | 'percent';
  discount_value: number;
  include_gst: boolean;
  gst_rate: number;
  is_igst: boolean;
  payment_schedule: Array<{
    label: string;
    percentage: number;
    milestone?: string | null;
    due_date?: string | null;
  }>;
  notes?: string | null;
  terms?: string | null;
  project_description?: string | null;
  service_details?: string | null;
}

export async function saveProjectDraftQuotation(
  quotationId: string,
  draft: ProjectDraftQuotationInput,
): Promise<void> {
  const { error } = await supabase.rpc('save_project_draft_quotation', {
    p_quotation_id: quotationId,
    p_draft: draft,
  });
  if (error) throw error;
}

export async function acceptProjectQuotation(quotationId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_project_quotation', {
    p_quotation_id: quotationId,
  });
  if (error) throw error;
}

export async function issueProjectProforma(proformaId: string, issueDate: string): Promise<void> {
  const { error } = await supabase.rpc('issue_project_proforma', {
    p_proforma_id: proformaId,
    p_issue_date: issueDate,
  });
  if (error) throw error;
}

export async function issueProjectFinalInvoice(projectId: string, issueDate: string): Promise<void> {
  const { error } = await supabase.rpc('issue_project_final_invoice', {
    p_project_id: projectId,
    p_issue_date: issueDate,
  });
  if (error) throw error;
}

export async function replaceProjectPaymentSchedule(
  projectId: string,
  items: PaymentScheduleDraftItem[],
  quotationId?: string | null,
  proformaId?: string | null,
): Promise<ProjectPaymentScheduleItem[]> {
  const { data, error } = await supabase.rpc('replace_project_payment_schedule', {
    p_project_id: projectId,
    p_items: items,
    p_quotation_id: quotationId || null,
    p_proforma_id: proformaId || null,
  });
  if (error) throw error;
  return (data || []) as ProjectPaymentScheduleItem[];
}

export async function recordProjectPayment(
  input: RecordProjectPaymentInput,
): Promise<RecordProjectPaymentResult> {
  const { data, error } = await supabase.rpc('record_project_payment', {
    p_project_id: input.projectId,
    p_receipt_number: input.receiptNumber,
    p_payment_date: input.paymentDate,
    p_amount: input.amount,
    p_payment_mode: input.paymentMode,
    p_schedule_item_id: input.scheduleItemId || null,
    p_payment_reference: input.paymentReference || null,
    p_notes: input.notes || null,
    p_towards: input.towards || null,
    p_proforma_id: input.proformaId || null,
    p_invoice_id: input.invoiceId || null,
    p_sub_brand: input.subBrand || null,
    p_client_email: input.clientEmail || null,
  });
  if (error) throw error;
  return data as RecordProjectPaymentResult;
}

export async function voidProjectPayment(receiptId: string, reason: string): Promise<ProjectPaymentSummary> {
  const { data, error } = await supabase.rpc('void_project_payment', {
    p_receipt_id: receiptId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as ProjectPaymentSummary;
}
