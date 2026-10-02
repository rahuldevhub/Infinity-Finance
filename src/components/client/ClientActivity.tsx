import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Client, Project } from '../../types';
import { Card } from '../ui/Card';
import { formatDate } from '../../utils/formatters';

interface ActivityItem { id: string; date: string; label: string; detail: string }

function lifecycleActivity(item: { id: string; event_type: string; event_data: Record<string, unknown>; created_at: string }): ActivityItem {
  const data = item.event_data || {};
  const title = typeof data.title === 'string' ? data.title : '';
  const labels: Record<string, string> = {
    timeline_task_created: 'Timeline task created',
    timeline_task_edited: 'Timeline task edited',
    timeline_task_completed: 'Timeline task completed',
    timeline_task_reopened: 'Timeline task reopened',
    timeline_task_deleted: 'Timeline task deleted',
    timeline_tasks_reordered: 'Timeline tasks reordered',
    project_marked_completed: 'Project marked completed',
    project_reopened: 'Project reopened',
  };
  return {
    id: `lifecycle-${item.id}`,
    date: item.created_at,
    label: labels[item.event_type] || item.event_type.replaceAll('_', ' '),
    detail: title || (item.event_type === 'timeline_tasks_reordered' ? 'Timeline order updated' : ''),
  };
}

export function ClientActivity({ client, projects }: { client: Client; projects: Project[] }) {
  const [remote, setRemote] = useState<ActivityItem[]>([]);
  useEffect(() => {
    void Promise.all([
      supabase.from('project_agreements').select('id, rendered_title, generated_at').eq('client_id', client.id),
      supabase.from('client_email_log').select('id, subject, status, created_at').eq('client_id', client.id),
      supabase.from('quotations').select('id, quotation_number, status, total_amount, accepted_at, created_at').eq('client_id', client.id),
      supabase.from('proforma_invoices').select('id, proforma_number, total_amount, created_at').eq('client_id', client.id),
      supabase.from('payment_receipts').select('id, receipt_number, amount_received, is_void, created_at').eq('client_id', client.id),
      supabase.from('invoices').select('id, invoice_number, total_amount, created_at').eq('client_id', client.id),
      supabase.from('project_activity_log').select('id, event_type, event_data, created_at').eq('client_id', client.id),
    ]).then(([agreements, emails, quotations, proformas, receipts, invoices, lifecycle]) => setRemote([
      ...(agreements.data || []).map((item) => ({ id: `agreement-${item.id}`, date: item.generated_at, label: 'Agreement generated', detail: item.rendered_title })),
      ...(emails.data || []).map((item) => ({ id: `email-${item.id}`, date: item.created_at, label: `Email ${item.status}`, detail: item.subject })),
      ...(quotations.data || []).map((item) => ({ id: `quotation-${item.id}`, date: item.created_at, label: `Quotation ${item.status}`, detail: `${item.quotation_number} · ₹${Number(item.total_amount).toLocaleString('en-IN')}` })),
      ...(quotations.data || []).filter((item) => item.accepted_at).map((item) => ({ id: `quotation-accepted-${item.id}`, date: item.accepted_at as string, label: 'Quotation approved', detail: item.quotation_number })),
      ...(proformas.data || []).map((item) => ({ id: `proforma-${item.id}`, date: item.created_at, label: 'Proforma created', detail: `${item.proforma_number} · ₹${Number(item.total_amount).toLocaleString('en-IN')}` })),
      ...(receipts.data || []).map((item) => ({ id: `receipt-${item.id}`, date: item.created_at, label: item.is_void ? 'Receipt voided' : 'Payment received', detail: `${item.receipt_number} · ₹${Number(item.amount_received).toLocaleString('en-IN')}` })),
      ...(invoices.data || []).map((item) => ({ id: `invoice-${item.id}`, date: item.created_at, label: 'Invoice created', detail: `${item.invoice_number} · ₹${Number(item.total_amount).toLocaleString('en-IN')}` })),
      ...(lifecycle.data || []).map((item) => lifecycleActivity(item as { id: string; event_type: string; event_data: Record<string, unknown>; created_at: string })),
    ]));
  }, [client.id]);
  const items: ActivityItem[] = [
    { id: `client-${client.id}`, date: client.created_at, label: 'Client created', detail: client.name },
    ...projects.map((project) => ({ id: `project-${project.id}`, date: project.created_at, label: 'Project created', detail: project.name })),
    ...remote,
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return <Card><h2 className="font-bold mb-4">Activity</h2><div className="space-y-4">{items.map((item) => <div key={item.id} className="flex gap-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><Clock3 size={14} /></div><div><p className="text-sm font-semibold">{item.label}</p><p className="text-sm text-gray-500">{item.detail}</p><p className="text-xs text-gray-400 mt-1">{formatDate(item.date)}</p></div></div>)}</div></Card>;
}
