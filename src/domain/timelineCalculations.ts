import type { ProjectExecutionState, ProjectTimelineItem, ProjectTimelineSummary } from '../types/index.js';

export function calculateTimelineSummary(
  projectId: string,
  items: ProjectTimelineItem[],
  projectCompleted = false,
): ProjectTimelineSummary {
  const active = items.filter((item) => !item.deleted_at);
  const completed = active.filter((item) => item.status === 'completed').length;
  const total = active.length;
  const remaining = total - completed;
  let executionState: ProjectExecutionState = 'not_started';
  if (projectCompleted) executionState = 'completed';
  else if (total > 0 && remaining === 0) executionState = 'ready_to_complete';
  else if (completed > 0) executionState = 'in_progress';

  return {
    project_id: projectId,
    total_items: total,
    completed_items: completed,
    remaining_items: remaining,
    progress_percentage: total === 0 ? null : Math.round((completed / total) * 100),
    execution_state: executionState,
  };
}
