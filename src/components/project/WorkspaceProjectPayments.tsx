import { useNavigate } from 'react-router-dom';
import { useProjectPayments } from '../../hooks/useProjectPayments';
import type { Project } from '../../types';
import { ProjectPaymentPlan } from './ProjectPaymentPlan';

export function WorkspaceProjectPayments({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { summary, installments, loading, error } = useProjectPayments(project.id);
  return (
    <ProjectPaymentPlan
      summary={summary}
      installments={installments}
      loading={loading}
      error={error}
      canEditSchedule={false}
      onRecordPayment={(installmentId) => navigate(`/receipts/new?project_id=${project.id}${installmentId ? `&schedule_item_id=${installmentId}` : ''}`)}
    />
  );
}
