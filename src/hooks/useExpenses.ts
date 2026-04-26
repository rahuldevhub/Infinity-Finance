import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense } from '../types';

interface ExpenseFilters {
  start?: string;
  end?: string;
  category?: string;
  is_itc_eligible?: boolean;
}

export function useExpenses(filters?: ExpenseFilters) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (filters?.start) query = query.gte('date', filters.start);
      if (filters?.end) query = query.lte('date', filters.end);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.is_itc_eligible !== undefined)
        query = query.eq('is_itc_eligible', filters.is_itc_eligible);

      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters?.start, filters?.end, filters?.category, filters?.is_itc_eligible]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function createExpense(expense: Omit<Expense, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('expenses').insert([expense]).select().single();
    if (error) throw error;
    await fetchExpenses();
    return data;
  }

  async function updateExpense(id: string, updates: Partial<Expense>) {
    const { error } = await supabase.from('expenses').update(updates).eq('id', id);
    if (error) throw error;
    await fetchExpenses();
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await fetchExpenses();
  }

  async function uploadBill(file: File): Promise<string> {
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('expense-bills').upload(fileName, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('expense-bills').getPublicUrl(fileName);
    return publicUrl;
  }

  return { expenses, loading, error, refetch: fetchExpenses, createExpense, updateExpense, deleteExpense, uploadBill };
}
