import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function SchemaReadinessError({ missing, onRetry }: { missing: string[]; onRetry: () => void }) {
  return (
    <Card className="max-w-2xl mx-auto mt-8 border-amber-200 bg-amber-50/50">
      <div className="flex gap-3">
        <AlertTriangle className="text-amber-600 shrink-0" size={22} />
        <div>
          <h2 className="font-bold text-gray-900">Client Workspace schema is not ready</h2>
          <p className="mt-1 text-sm text-gray-600">Apply Phase 1, then Phase 2, then Phase 3 migrations to this Supabase environment. No data was changed.</p>
          <p className="mt-2 text-xs text-amber-800">Missing: {missing.join(', ')}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}><RefreshCw size={14} /> Retry</Button>
        </div>
      </div>
    </Card>
  );
}

