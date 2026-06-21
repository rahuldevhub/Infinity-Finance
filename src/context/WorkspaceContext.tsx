import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface Workspace {
  id: string;
  name: string;
  sub: string;
  accent: string;
  accentRgb: string;
}

// Universal neutral finance theme — every workspace shares the same slate/navy
// accent. Green/red are reserved for financial meaning, never brand color.
const ACCENT = '#0f172a';
const ACCENT_RGB = '15,23,42';

export const WORKSPACES: Workspace[] = [
  { id: 'infinity', name: 'Infinity Enterprises', sub: 'Accounting OS', accent: ACCENT, accentRgb: ACCENT_RGB },
  { id: 'ritera', name: 'Ritera Publishing', sub: 'Self-Publishing', accent: ACCENT, accentRgb: ACCENT_RGB },
  { id: 'ratix', name: 'Ratixinfo Tech', sub: 'Digital Services', accent: ACCENT, accentRgb: ACCENT_RGB },
];

interface WorkspaceContextValue {
  workspace: Workspace;
  setWorkspace: (id: string) => void;
  workspaces: Workspace[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string>(() => localStorage.getItem('workspace') || 'infinity');
  const workspace = useMemo(() => WORKSPACES.find((w) => w.id === id) || WORKSPACES[0], [id]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', workspace.accent);
    root.style.setProperty('--accent-rgb', workspace.accentRgb);
    localStorage.setItem('workspace', workspace.id);
  }, [workspace]);

  const value = useMemo(
    () => ({ workspace, setWorkspace: setId, workspaces: WORKSPACES }),
    [workspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
