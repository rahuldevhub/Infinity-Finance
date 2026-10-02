import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, ChevronDown, ChevronUp, Circle, Edit2, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Project, ProjectTimelineItem } from '../../types';
import { calculateTimelineSummary } from '../../domain/timelineCalculations';
import {
  completeProjectFromTimeline,
  createProjectTimelineItem,
  deleteProjectTimelineItem,
  getProjectTimelineItems,
  reorderProjectTimelineItems,
  reopenProjectFromTimeline,
  setProjectTimelineItemCompleted,
  updateProjectTimelineItem,
} from '../../services/projectTimeline';
import { formatDate } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface Props {
  project: Project;
  onProjectChanged?: () => Promise<void> | void;
}

const EMPTY_FORM = { title: '', description: '', dueDate: '' };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function executionLabel(state: ReturnType<typeof calculateTimelineSummary>['execution_state']): string {
  if (state === 'completed') return 'Completed';
  if (state === 'ready_to_complete') return 'Ready to complete';
  if (state === 'in_progress') return 'In progress';
  return 'Not started';
}

export function ProjectExecutionTimeline({ project, onProjectChanged }: Props) {
  const [items, setItems] = useState<ProjectTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCompleteProject, setShowCompleteProject] = useState(false);
  const [editing, setEditing] = useState<ProjectTimelineItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getProjectTimelineItems(project.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Timeline could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the selected project's operational timeline.
    void load();
  }, [load]);

  const summary = useMemo(
    () => calculateTimelineSummary(project.id, items, project.status === 'completed'),
    [items, project.id, project.status],
  );
  const progress = summary.progress_percentage ?? 0;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowTaskForm(true);
  }

  function openEdit(item: ProjectTimelineItem) {
    setEditing(item);
    setForm({ title: item.title, description: item.description || '', dueDate: item.due_date || '' });
    setError('');
    setShowTaskForm(true);
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const input = { title: form.title.trim(), description: form.description.trim() || null, dueDate: form.dueDate || null };
      if (editing) await updateProjectTimelineItem(editing.id, input);
      else await createProjectTimelineItem(project.id, input);
      setShowTaskForm(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Timeline task could not be saved');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompleted(item: ProjectTimelineItem) {
    setWorkingId(item.id);
    setError('');
    try {
      const updated = await setProjectTimelineItemCompleted(item.id, item.status !== 'completed');
      setItems((current) => current.map((row) => row.id === item.id ? updated : row));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Timeline task could not be updated');
    } finally {
      setWorkingId(null);
    }
  }

  async function remove(item: ProjectTimelineItem) {
    const warning = item.status === 'completed'
      ? `Delete completed timeline item “${item.title}”? It will be removed from the active timeline but retained in the activity history.`
      : `Delete timeline item “${item.title}”?`;
    if (!window.confirm(warning)) return;
    setWorkingId(item.id);
    setError('');
    try {
      await deleteProjectTimelineItem(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id).map((row, index) => ({ ...row, sort_order: index + 1 })));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Timeline task could not be deleted');
    } finally {
      setWorkingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next.map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 })));
    setWorkingId(items[index].id);
    setError('');
    try {
      setItems(await reorderProjectTimelineItems(project.id, next.map((item) => item.id)));
    } catch (reorderError) {
      setItems(previous);
      setError(reorderError instanceof Error ? reorderError.message : 'Timeline order could not be saved');
    } finally {
      setWorkingId(null);
    }
  }

  async function markProjectComplete() {
    setSaving(true);
    setError('');
    try {
      try {
        await completeProjectFromTimeline(project.id);
      } catch (completeError) {
        const message = errorMessage(completeError, '');
        const legacyEmptyTimeline = items.length === 0 && message.includes('Add at least one timeline task');
        if (!legacyEmptyTimeline) throw completeError;

        // Compatibility for databases that still enforce the original one-task
        // minimum: the user's explicit confirmation becomes an audited review row.
        const review = await createProjectTimelineItem(project.id, {
          title: 'Project completion confirmed',
          description: 'Project completion was explicitly confirmed from the client workspace.',
        });
        const completedReview = await setProjectTimelineItemCompleted(review.id, true);
        setItems([completedReview]);
        await completeProjectFromTimeline(project.id);
      }
      setShowCompleteProject(false);
      await onProjectChanged?.();
    } catch (completeError) {
      setError(errorMessage(completeError, 'Project could not be marked completed'));
    } finally {
      setSaving(false);
    }
  }

  async function reopenProject() {
    setSaving(true);
    setError('');
    try {
      await reopenProjectFromTimeline(project.id);
      await onProjectChanged?.();
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : 'Project could not be reopened');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><ListChecks size={20} /></div>
            <div><p className="text-xs uppercase tracking-wider text-gray-400">Project timeline</p><h2 className="text-lg font-bold text-gray-900 mt-0.5">{project.name}</h2></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={project.status === 'completed' ? 'green' : summary.execution_state === 'ready_to_complete' ? 'blue' : summary.execution_state === 'in_progress' ? 'yellow' : 'gray'}>{executionLabel(summary.execution_state)}</Badge>
            {project.status === 'completed' ? <Button size="sm" variant="outline" loading={saving} onClick={() => void reopenProject()}><RotateCcw size={14} /> Reopen Project</Button> : <Button size="sm" onClick={openCreate}><Plus size={14} /> Add Task</Button>}
          </div>
        </div>

        {summary.total_items > 0 ? (
          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-gray-800">{summary.completed_items} / {summary.total_items} completed</p><p className="text-lg font-bold text-gray-900">{progress}%</p></div>
            <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden mt-3"><div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-sm"><div><p className="text-xs text-gray-400 uppercase">Completed</p><p className="font-bold text-green-700">{summary.completed_items}</p></div><div><p className="text-xs text-gray-400 uppercase">Remaining</p><p className="font-bold">{summary.remaining_items}</p></div><div><p className="text-xs text-gray-400 uppercase">Status</p><p className="font-bold">{executionLabel(summary.execution_state)}</p></div></div>
          </div>
        ) : null}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {loading ? <p className="py-10 text-center text-sm text-gray-400">Loading timeline...</p> : items.length === 0 ? (
          <div className="py-12 text-center">
            <ListChecks size={30} className="mx-auto text-gray-300" />
            <p className="text-sm text-gray-500 mt-3">No timeline tasks have been recorded.</p>
            <p className="text-xs text-gray-400 mt-1">Add tasks to track the remaining work, or confirm completion if the work is already finished.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={openCreate}><Plus size={14} /> Add Task</Button>
              {project.status !== 'completed' && project.approved_commercial_snapshot && project.approved_quotation_id && (
                <Button size="sm" variant="outline" onClick={() => setShowCompleteProject(true)}><CheckCircle2 size={14} /> Mark Project Complete</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {items.map((item, index) => {
              const completed = item.status === 'completed';
              return (
                <div key={item.id} className={`flex gap-3 p-4 ${completed ? 'bg-green-50/40' : 'bg-white'}`}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button type="button" aria-label={completed ? `Reopen ${item.title}` : `Complete ${item.title}`} disabled={workingId === item.id || project.status === 'completed'} onClick={() => void toggleCompleted(item)} className={`mt-0.5 rounded-full ${completed ? 'text-green-600' : 'text-gray-300 hover:text-green-600'} disabled:opacity-50`}>{completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}</button>
                    <span className="text-[10px] font-bold text-gray-400">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div><div className="flex items-center gap-2"><h3 className={`font-semibold ${completed ? 'text-green-900' : 'text-gray-900'}`}>{item.title}</h3><Badge variant={completed ? 'green' : 'gray'}>{completed ? 'Completed' : 'Pending'}</Badge></div>{item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}<div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">{item.due_date && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Due {formatDate(item.due_date)}</span>}{item.completed_at && <span className="inline-flex items-center gap-1 text-green-700"><Check size={12} /> Completed {formatDate(item.completed_at)}</span>}</div></div>
                      <div className="flex items-center gap-1 shrink-0">
                        {project.status !== 'completed' && <Button size="sm" variant={completed ? 'outline' : 'secondary'} disabled={workingId === item.id} onClick={() => void toggleCompleted(item)}>{completed ? 'Reopen' : 'Mark Complete'}</Button>}
                        <button type="button" aria-label={`Move ${item.title} up`} disabled={index === 0 || workingId != null || project.status === 'completed'} onClick={() => void move(index, -1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronUp size={15} /></button>
                        <button type="button" aria-label={`Move ${item.title} down`} disabled={index === items.length - 1 || workingId != null || project.status === 'completed'} onClick={() => void move(index, 1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronDown size={15} /></button>
                        <button type="button" aria-label={`Edit ${item.title}`} disabled={project.status === 'completed'} onClick={() => openEdit(item)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"><Edit2 size={15} /></button>
                        <button type="button" aria-label={`Delete ${item.title}`} disabled={workingId === item.id || project.status === 'completed'} onClick={() => void remove(item)} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {project.status !== 'completed' && summary.execution_state === 'ready_to_complete' && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-semibold text-green-900">Project work appears complete.</p><p className="text-sm text-green-700 mt-0.5">Mark the project complete when the work has been reviewed.</p></div><Button onClick={() => setShowCompleteProject(true)}><CheckCircle2 size={16} /> Mark Project Complete</Button></div>
        )}
      </Card>

      <Modal isOpen={showTaskForm} onClose={() => setShowTaskForm(false)} title={editing ? 'Edit Timeline Task' : 'Add Timeline Task'} icon={<ListChecks size={18} />}>
        <form onSubmit={saveTask} className="space-y-4"><Input label="Task name" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Send final PDF for author approval" /><div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700">Description</label><textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div><Input label="Due date (optional)" type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button><Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Add Task'}</Button></div></form>
      </Modal>

      <Modal isOpen={showCompleteProject} onClose={() => setShowCompleteProject(false)} title="Mark this project as completed?" icon={<CheckCircle2 size={18} />}>
        <div className="space-y-4"><p className="text-sm text-gray-600">{summary.total_items > 0 ? 'All active timeline tasks are complete.' : 'No timeline tasks are recorded. Confirm that all project work has been reviewed and completed.'} Marking the project complete may make the final invoice eligible once all required payments have been received.</p>{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setShowCompleteProject(false)}>Cancel</Button><Button loading={saving} onClick={() => void markProjectComplete()}>Mark Project Complete</Button></div></div>
      </Modal>
    </>
  );
}
