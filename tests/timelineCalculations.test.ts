import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTimelineSummary } from '../src/domain/timelineCalculations.js';
import type { ProjectTimelineItem } from '../src/types/index.js';

function item(id: string, status: 'pending' | 'completed', deleted = false): ProjectTimelineItem {
  return {
    id,
    project_id: 'project-1',
    title: id,
    description: null,
    status,
    sort_order: Number(id.replace(/\D/g, '')) || 1,
    due_date: null,
    completed_at: status === 'completed' ? '2026-09-25T10:00:00Z' : null,
    deleted_at: deleted ? '2026-09-25T11:00:00Z' : null,
    created_by: null,
    created_at: '2026-09-25T09:00:00Z',
    updated_at: '2026-09-25T09:00:00Z',
  };
}

test('empty timeline has no misleading percentage', () => {
  const summary = calculateTimelineSummary('project-1', []);
  assert.equal(summary.progress_percentage, null);
  assert.equal(summary.execution_state, 'not_started');
});

test('timeline rounds progress and ignores soft-deleted tasks', () => {
  const summary = calculateTimelineSummary('project-1', [
    item('1', 'completed'), item('2', 'completed'), item('3', 'pending'), item('4', 'pending', true),
  ]);
  assert.equal(summary.total_items, 3);
  assert.equal(summary.completed_items, 2);
  assert.equal(summary.remaining_items, 1);
  assert.equal(summary.progress_percentage, 67);
  assert.equal(summary.execution_state, 'in_progress');
});

test('all tasks become ready without automatically completing the project', () => {
  const ready = calculateTimelineSummary('project-1', [item('1', 'completed'), item('2', 'completed')]);
  assert.equal(ready.execution_state, 'ready_to_complete');
  const completed = calculateTimelineSummary('project-1', [item('1', 'completed'), item('2', 'completed')], true);
  assert.equal(completed.execution_state, 'completed');
});
