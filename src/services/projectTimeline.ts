import { supabase } from '../lib/supabase';
import type { Project, ProjectTimelineItem } from '../types';

export interface ProjectTimelineItemInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export async function getProjectTimelineItems(projectId: string): Promise<ProjectTimelineItem[]> {
  const { data, error } = await supabase
    .from('project_timeline_items')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ProjectTimelineItem[];
}

export async function createProjectTimelineItem(projectId: string, input: ProjectTimelineItemInput): Promise<ProjectTimelineItem> {
  const { data, error } = await supabase.rpc('create_project_timeline_item', {
    p_project_id: projectId,
    p_title: input.title,
    p_description: input.description || null,
    p_due_date: input.dueDate || null,
  });
  if (error) throw error;
  return data as ProjectTimelineItem;
}

export async function updateProjectTimelineItem(itemId: string, input: ProjectTimelineItemInput): Promise<ProjectTimelineItem> {
  const { data, error } = await supabase.rpc('update_project_timeline_item', {
    p_item_id: itemId,
    p_title: input.title,
    p_description: input.description || null,
    p_due_date: input.dueDate || null,
  });
  if (error) throw error;
  return data as ProjectTimelineItem;
}

export async function setProjectTimelineItemCompleted(itemId: string, completed: boolean): Promise<ProjectTimelineItem> {
  const { data, error } = await supabase.rpc('set_project_timeline_item_completed', {
    p_item_id: itemId,
    p_completed: completed,
  });
  if (error) throw error;
  return data as ProjectTimelineItem;
}

export async function deleteProjectTimelineItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_project_timeline_item', { p_item_id: itemId });
  if (error) throw error;
}

export async function reorderProjectTimelineItems(projectId: string, itemIds: string[]): Promise<ProjectTimelineItem[]> {
  const { data, error } = await supabase.rpc('reorder_project_timeline_items', {
    p_project_id: projectId,
    p_item_ids: itemIds,
  });
  if (error) throw error;
  return (data || []) as ProjectTimelineItem[];
}

export async function completeProjectFromTimeline(projectId: string): Promise<Project> {
  const { data, error } = await supabase.rpc('complete_project_from_timeline', { p_project_id: projectId });
  if (error) throw error;
  return data as Project;
}

export async function reopenProjectFromTimeline(projectId: string): Promise<Project> {
  const { data, error } = await supabase.rpc('reopen_project_from_timeline', { p_project_id: projectId });
  if (error) throw error;
  return data as Project;
}
