import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calculateInstallmentPaymentSummary } from '../domain/paymentCalculations';
import { replaceProjectPaymentSchedule, type PaymentScheduleDraftItem } from '../services/projectPayments';
import type { PaymentReceipt, ProjectPaymentScheduleItem, ProjectPaymentSummary } from '../types';

export interface ScheduleItemWithSummary extends ProjectPaymentScheduleItem {
  received: number;
  remaining: number;
  progress: number;
  payment_state: 'pending' | 'partial' | 'paid';
}

function normalizeSummary(data: ProjectPaymentSummary): ProjectPaymentSummary {
  return {
    ...data,
    contract_value: data.contract_value == null ? null : Number(data.contract_value),
    total_received: Number(data.total_received),
    outstanding: data.outstanding == null ? null : Number(data.outstanding),
    payment_progress: Number(data.payment_progress),
  };
}

export function useProjectPayments(projectId?: string | null) {
  const [scheduleItems, setScheduleItems] = useState<ProjectPaymentScheduleItem[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [summary, setSummary] = useState<ProjectPaymentSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setScheduleItems([]);
      setReceipts([]);
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [summaryResult, scheduleResult, receiptResult] = await Promise.all([
        supabase.rpc('project_payment_summary_json', { p_project_id: projectId }),
        supabase
          .from('project_payment_schedule_items')
          .select('*')
          .eq('project_id', projectId)
          .order('installment_number'),
        supabase
          .from('payment_receipts')
          .select('*')
          .eq('project_id', projectId)
          .eq('reconciliation_managed', true)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      const firstError = summaryResult.error || scheduleResult.error || receiptResult.error;
      if (firstError) throw firstError;
      setSummary(normalizeSummary(summaryResult.data as ProjectPaymentSummary));
      setScheduleItems((scheduleResult.data || []) as ProjectPaymentScheduleItem[]);
      setReceipts((receiptResult.data || []) as PaymentReceipt[]);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Failed to load project payments');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the route-scoped payment ledger when the project changes.
    void refresh();
  }, [refresh]);

  const installments = useMemo<ScheduleItemWithSummary[]>(() => scheduleItems.map((item) => {
    const itemReceipts = receipts.filter((receipt) =>
      !receipt.is_void && receipt.payment_schedule_item_id === item.id
    );
    const payment = calculateInstallmentPaymentSummary(
      Number(item.amount),
      itemReceipts.map((receipt) => Number(receipt.amount_received)),
    );
    return {
      ...item,
      amount: Number(item.amount),
      percentage: item.percentage == null ? null : Number(item.percentage),
      received: payment.received,
      remaining: payment.remaining,
      progress: payment.progress,
      payment_state: payment.state,
    };
  }), [receipts, scheduleItems]);

  async function replaceSchedule(
    items: PaymentScheduleDraftItem[],
    quotationId?: string | null,
    proformaId?: string | null,
  ): Promise<void> {
    if (!projectId) throw new Error('Project is required');
    await replaceProjectPaymentSchedule(projectId, items, quotationId, proformaId);
    await refresh();
  }

  return {
    summary,
    installments,
    receipts,
    loading,
    error,
    refresh,
    replaceSchedule,
  };
}
