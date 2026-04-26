import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { BusinessSettings } from '../types';

export function useBusinessSettings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('business_settings').select('*').single();
    setSettings(data);
    setLoading(false);
  }

  async function updateSettings(updates: Partial<BusinessSettings>) {
    if (!settings) return;
    const { error } = await supabase
      .from('business_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', settings.id);
    if (error) throw error;
    await fetchSettings();
  }

  return { settings, loading, updateSettings, refetch: fetchSettings };
}
