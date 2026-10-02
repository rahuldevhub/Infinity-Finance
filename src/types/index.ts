export interface Profile {
  id: string;
  full_name: string;
  role: 'owner' | 'ceo';
}

export interface BusinessSettings {
  id: string;
  gst_name: string;
  gstin: string;
  address: string;
  state: string;
  state_code: string;
  sub_brands: string[];
  bank_details: {
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    branch: string;
    account_name: string;
  };
}

export interface Client {
  id: string;
  name: string;
  gstin: string | null;
  address: string;
  state: string;
  state_code: string;
  email: string | null;
  phone: string | null;
  default_company?: import('../domain/company.js').CompanyCode | null;
  created_at: string;
}

export type ProjectStatus = 'draft' | 'quotation' | 'active' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  contract_value: number | null;
  sub_brand: string | null;
  company?: import('../domain/company.js').CompanyCode | null;
  service_details?: string | null;
  proposed_price?: number | null;
  onboarding_snapshot?: {
    package?: { packageId: string; packageName: string; services: Record<string, string[]>; deliverables: string[] };
    commercials?: {
      basePrice: number; discountType: string; discountValue: number; discountAmount: number;
      taxableAmount: number; gstRate: number; gstAmount: number; proposedTotal: number;
    };
    paymentSchedule?: Array<{ label: string; percentage: number; amount: number; milestone?: string }>;
    capturedAt?: string;
  } | null;
  onboarding_key?: string | null;
  current_commercial_spec?: Record<string, unknown> | null;
  approved_commercial_snapshot?: Record<string, unknown> | null;
  approved_quotation_id?: string | null;
  completed_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
}

export type ProjectTimelineItemStatus = 'pending' | 'completed';

export interface ProjectTimelineItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: ProjectTimelineItemStatus;
  sort_order: number;
  due_date: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectExecutionState = 'not_started' | 'in_progress' | 'ready_to_complete' | 'completed';

export interface ProjectTimelineSummary {
  project_id: string;
  total_items: number;
  completed_items: number;
  remaining_items: number;
  progress_percentage: number | null;
  execution_state: ProjectExecutionState;
}

export type PaymentState = 'unconfigured' | 'pending' | 'partial' | 'paid';

export interface ProjectPaymentSummary {
  project_id: string;
  contract_value: number | null;
  total_received: number;
  outstanding: number | null;
  payment_progress: number;
  payment_state: PaymentState;
}

export interface ProjectPaymentScheduleItem {
  id: string;
  project_id: string;
  quotation_id: string | null;
  proforma_id: string | null;
  installment_number: number;
  label: string;
  milestone: string | null;
  percentage: number | null;
  amount: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  description: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  rate: number;
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  client_id: string | null;
  client?: Client;
  client_name_override?: string | null;
  client_gstin_override?: string | null;
  billing_address_override?: string | null;
  client_state_override?: string | null;
  client_email_override?: string | null;
  client_phone_override?: string | null;
  sub_brand: string;
  company?: import('../domain/company.js').CompanyCode | null;
  place_of_supply: string;
  place_of_supply_code: string;
  is_igst: boolean;
  items: InvoiceItem[];
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  discount_type?: 'flat' | 'percent';
  discount_value?: number;
  discount_amount?: number;
  advance_received?: number;
  balance_due?: number;
  payment_status: 'paid' | 'pending' | 'partial';
  notes: string | null;
  created_at: string;
  created_by: string;
  invoice_type?: 'gst' | 'non_gst';
  project_id?: string | null;
  approved_commercial_snapshot?: Record<string, unknown> | null;
  is_final_project_invoice?: boolean;
  issued_at?: string | null;
}

export interface Expense {
  id: string;
  date: string;
  vendor_name: string;
  description: string;
  category: string;
  taxable_amount: number;
  gst_amount: number;
  gst_rate: number;
  total_amount: number;
  is_itc_eligible: boolean;
  bill_url: string | null;
  gstin_of_vendor: string | null;
  company?: import('../domain/company.js').CompanyCode | null;
  created_at: string;
  created_by: string;
}

export interface DashboardStats {
  totalSales: number;
  totalGSTCollected: number;
  totalExpenses: number;
  itcAvailable: number;
  netGSTPayable: number;
  pendingInvoicesCount: number;
  pendingInvoicesValue: number;
  /** Actual money collected this month (Payment Receipts) — cash-basis, not invoice-basis. */
  totalCollected: number;
  pendingProformasCount: number;
}

export interface MonthlyData {
  month: string;
  sales: number;
  expenses: number;
}

export interface ProformaItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface ProformaInvoice {
  id: string;
  proforma_number: string | null;
  date: string | null;
  due_date?: string | null;
  client_id?: string | null;
  client_name_override?: string | null;
  sub_brand: string;
  company?: import('../domain/company.js').CompanyCode | null;
  quotation_id?: string | null;
  project_id?: string | null;
  items: ProformaItem[];
  taxable_value: number;
  include_gst: boolean;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  is_igst: boolean;
  total_amount: number;
  discount_type?: 'flat' | 'percent';
  discount_value?: number;
  discount_amount?: number;
  notes?: string | null;
  payment_status: 'pending' | 'paid' | 'partial';
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  converted_invoice_id?: string | null;
  created_at: string;
  created_by?: string;
  payment_schedule_item_id?: string | null;
  approved_commercial_snapshot?: Record<string, unknown> | null;
  is_project_proforma?: boolean;
  issued_at?: string | null;
  client?: { name: string; email?: string | null; phone?: string | null; address?: string; state?: string; gstin?: string | null } | null;
  quotation?: { quotation_number: string; title?: string | null; status?: string | null; total_amount?: number | null } | null;
  project?: { name: string } | null;
}

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  date: string;
  client_id?: string | null;
  client_name_override?: string | null;
  sub_brand: string;
  company?: import('../domain/company.js').CompanyCode | null;
  amount_received: number;
  payment_mode: string;
  payment_reference?: string | null;
  towards?: string | null;
  invoice_id?: string | null;
  proforma_id?: string | null;
  quotation_id?: string | null;
  project_id?: string | null;
  payment_schedule_item_id?: string | null;
  reconciliation_managed?: boolean;
  is_void?: boolean;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  notes?: string | null;
  client_email?: string | null;
  email_sent?: boolean;
  email_sent_at?: string | null;
  created_at: string;
  created_by?: string;
  client?: { name: string; email?: string | null; address?: string } | null;
}

export const INDIAN_STATES = [
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Puducherry', code: '34' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
];

export const EXPENSE_CATEGORIES = [
  'Office Supplies',
  'Software & Subscriptions',
  'Travel & Transport',
  'Professional Fees',
  'Utilities',
  'Rent',
  'Marketing & Advertising',
  'Equipment & Hardware',
  'Communication',
  'Bank Charges',
  'Miscellaneous',
];

export const GST_RATES = [0, 5, 12, 18, 28];

export const BUSINESS_STATE_CODE = '33'; // Tamil Nadu
