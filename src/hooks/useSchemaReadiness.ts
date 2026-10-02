import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SchemaReadiness {
  loading: boolean;
  ready: boolean;
  missing: string[];
  retry: () => Promise<void>;
}

export function useSchemaReadiness(): SchemaReadiness {
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState<string[]>([]);

  const retry = useCallback(async () => {
    setLoading(true);
    const checks = await Promise.all([
      supabase.from('projects').select('id').limit(1),
      supabase.from('project_payment_schedule_items').select('id').limit(1),
      supabase.from('payment_receipts').select('reconciliation_managed').limit(1),
      supabase.from('project_timeline_items').select('id').limit(1),
    ]);
    const labels = ['Phase 1 projects', 'Phase 2 payment schedules', 'Phase 2 receipt reconciliation', 'Phase 7 project timeline'];
    checks.forEach((result, index) => {
      if (result.error) console.warn('Client Workspace schema check failed', { check: labels[index], code: result.error.code, message: result.error.message });
    });
    setMissing(checks.flatMap((result, index) => result.error ? [labels[index]] : []));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Probe additive migration readiness once on mount.
    void retry();
  }, [retry]);

  return { loading, ready: !loading && missing.length === 0, missing, retry };
}
