import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Client } from '../types';

export function useClients(searchQuery?: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('clients').select('*').order('name');
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  async function createClient(client: Omit<Client, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('clients').insert([client]).select().single();
    if (error) throw error;
    await fetchClients();
    return data;
  }

  async function updateClient(id: string, updates: Partial<Client>) {
    const { error } = await supabase.from('clients').update(updates).eq('id', id);
    if (error) throw error;
    await fetchClients();
  }

  async function deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    await fetchClients();
  }

  return { clients, loading, error, refetch: fetchClients, createClient, updateClient, deleteClient };
}
