import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectStatus } from '../types';

export interface ProjectFilters {
  clientId?: string;
  status?: ProjectStatus;
  enabled?: boolean;
}

export type ProjectCreateInput = Pick<Project, 'client_id' | 'name'> &
  Partial<Pick<Project, 'description' | 'status' | 'contract_value' | 'sub_brand' | 'company' | 'service_details' | 'proposed_price' | 'created_by'>>;

export type ProjectUpdateInput = Partial<
  Pick<Project, 'name' | 'description' | 'status' | 'contract_value' | 'sub_brand' | 'company' | 'service_details' | 'proposed_price'>
>;

const PROJECT_SELECT = '*, client:clients(*)';

export function useProjects(filters: ProjectFilters = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getProjects = useCallback(async (): Promise<Project[]> => {
    let query = supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .order('created_at', { ascending: false });

    if (filters.clientId) query = query.eq('client_id', filters.clientId);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error: queryError } = await query;
    if (queryError) throw queryError;
    return (data || []) as Project[];
  }, [filters.clientId, filters.status]);

  const refresh = useCallback(async () => {
    if (filters.enabled === false) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProjects(await getProjects());
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [filters.enabled, getProjects]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the current project collection when its filters change.
    void refresh();
  }, [refresh]);

  const getProject = useCallback(async (id: string): Promise<Project> => {
    const { data, error: queryError } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .single();
    if (queryError) throw queryError;
    return data as Project;
  }, []);

  async function getProjectsByClient(clientId: string): Promise<Project[]> {
    const { data, error: queryError } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (queryError) throw queryError;
    return (data || []) as Project[];
  }

  async function createProject(input: ProjectCreateInput): Promise<Project> {
    const { data, error: mutationError } = await supabase
      .from('projects')
      .insert([{ ...input, status: input.status || 'draft' }])
      .select(PROJECT_SELECT)
      .single();
    if (mutationError) throw mutationError;
    await refresh();
    return data as Project;
  }

  async function updateProject(id: string, updates: ProjectUpdateInput): Promise<Project> {
    const { data, error: mutationError } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(PROJECT_SELECT)
      .single();
    if (mutationError) throw mutationError;
    await refresh();
    return data as Project;
  }

  async function deleteProject(id: string): Promise<void> {
    const { error: mutationError } = await supabase.from('projects').delete().eq('id', id);
    if (mutationError) throw mutationError;
    await refresh();
  }

  return {
    projects,
    loading,
    error,
    getProjects,
    getProject,
    getProjectsByClient,
    createProject,
    updateProject,
    deleteProject,
    refetch: refresh,
  };
}
