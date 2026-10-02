import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, Edit2, Plus, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '../hooks/useClients';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Client } from '../types';
import { INDIAN_STATES } from '../types';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ClientOnboardingForm } from '../components/client/ClientOnboardingForm';
import { ClientWorkspaceDrawer } from '../components/client/ClientWorkspaceDrawer';
import { formatDate } from '../utils/formatters';
import { COMPANY_CODES, COMPANY_LABELS, requireNewClientCompany, type CompanyCode } from '../domain/company';
import { supabase } from '../lib/supabase';

type ClientFilter = 'all' | 'gst' | 'b2c';

const emptyForm = {
  name: '', gstin: '', address: '', state: '', state_code: '', email: '', phone: '', default_company: 'ritera' as CompanyCode,
};

const AVATAR_TINTS = [
  'bg-slate-100 text-slate-700', 'bg-blue-50 text-blue-700', 'bg-indigo-50 text-indigo-700', 'bg-sky-50 text-sky-700', 'bg-amber-50 text-amber-700',
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function tintFor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export function Clients() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { clients, loading, createClient, updateClient, refetch } = useClients();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});

  const scopedClients = useMemo(() => workspace.id === 'infinity'
    ? clients
    : clients.filter((client) => client.default_company === workspace.id), [clients, workspace.id]);

  const filteredClients = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return scopedClients.filter((client) => {
      if (filter === 'gst' && !client.gstin) return false;
      if (filter === 'b2c' && client.gstin) return false;
      if (!needle) return true;
      const company = client.default_company ? COMPANY_LABELS[client.default_company] : 'legacy client';
      return [client.name, company, client.email, client.phone, client.gstin].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [filter, scopedClients, search]);

  const gstCount = scopedClients.filter((client) => client.gstin).length;
  const b2cCount = scopedClients.length - gstCount;

  useEffect(() => {
    let cancelled = false;
    void supabase.from('projects').select('client_id, company, sub_brand').then(({ data, error }) => {
      if (cancelled || error) return;
      const visibleClientIds = new Set(scopedClients.map((client) => client.id));
      const counts = (data || []).reduce<Record<string, number>>((result, row) => {
        if (!visibleClientIds.has(row.client_id)) return result;
        const belongs = workspace.id === 'infinity' || row.company === workspace.id || row.sub_brand?.toLowerCase().includes(workspace.id === 'ratix' ? 'ratix' : 'ritera');
        if (belongs) result[row.client_id] = (result[row.client_id] || 0) + 1;
        return result;
      }, {});
      setProjectCounts(counts);
    });
    return () => { cancelled = true; };
  }, [scopedClients, workspace.id]);

  function openCreate() {
    const defaultCompany = COMPANY_CODES.includes(workspace.id as CompanyCode) ? workspace.id as CompanyCode : 'ritera';
    setEditing(null);
    setForm({ ...emptyForm, default_company: defaultCompany });
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name,
      gstin: client.gstin || '',
      address: client.address,
      state: client.state,
      state_code: client.state_code,
      email: client.email || '',
      phone: client.phone || '',
      default_company: client.default_company || 'ritera',
    });
    setShowForm(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, gstin: form.gstin || null, email: form.email || null, phone: form.phone || null, default_company: requireNewClientCompany(form.default_company) };
      if (editing) await updateClient(editing.id, payload);
      else {
        const created = await createClient(payload);
        setShowForm(false);
        navigate(`/clients/${created.id}`);
        return;
      }
      setShowForm(false);
      if (selectedClient?.id === editing?.id) setSelectedClient({ ...selectedClient, ...payload });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <TopBar title="Clients" subtitle={`${workspace.name} · client workspace`} actions={<Button size="sm" onClick={openCreate}><Plus size={16} /><span className="hidden sm:inline">Add client</span></Button>} />

      <main className="space-y-5 px-4 py-5 md:px-6 md:py-6">
        <section className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Client summary">
          {[
            { label: 'Total clients', value: scopedClients.length, icon: Users, tone: 'text-slate-700 bg-slate-100' },
            { label: 'GST registered', value: gstCount, icon: ShieldCheck, tone: 'text-blue-700 bg-blue-50' },
            { label: 'B2C', value: b2cCount, icon: Building2, tone: 'text-slate-500 bg-slate-50' },
          ].map((item, index) => <div key={item.label} className={`flex min-w-0 items-center gap-3 px-3 py-4 sm:px-5 ${index ? 'border-l border-slate-200' : ''}`}><div className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex ${item.tone}`}><item.icon size={17} /></div><div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">{item.label}</p><p className="mt-0.5 text-xl font-extrabold tabular-nums text-slate-950 sm:text-2xl">{item.value}</p></div></div>)}
        </section>

        <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, company, email, phone or GSTIN" aria-label="Search clients" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
          </div>
          <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 lg:w-auto" role="group" aria-label="Filter clients">
            {([['all', 'All', scopedClients.length], ['gst', 'GST', gstCount], ['b2c', 'B2C', b2cCount]] as const).map(([id, label, count]) => <button key={id} onClick={() => setFilter(id)} className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-bold transition lg:flex-none ${filter === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label} <span className="ml-1 text-slate-400">{count}</span></button>)}
          </div>
        </section>

        <Card padding={false}>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50/80">{['Client', 'Company', 'Projects', 'GST status', 'Location', 'Contact', 'Added', ''].map((heading) => <th key={heading} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? Array.from({ length: 5 }).map((_, row) => <tr key={row}>{Array.from({ length: 8 }).map((__, cell) => <td key={cell} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>)}</tr>) : filteredClients.map((client) => <tr key={client.id} onClick={() => setSelectedClient(client)} className="group cursor-pointer transition hover:bg-slate-50/80 focus-within:bg-slate-50/80">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tintFor(client.name)}`}>{initials(client.name)}</div><div className="min-w-0"><p className="font-bold text-slate-900">{client.name}</p><p className="max-w-52 truncate text-xs text-slate-400">{client.email || 'No email'}</p></div></div></td>
                  <td className="px-5 py-4 text-slate-600">{client.default_company ? COMPANY_LABELS[client.default_company] : <span className="text-slate-400">Legacy</span>}</td>
                  <td className="px-5 py-4 font-semibold tabular-nums text-slate-700">{projectCounts[client.id] ?? 0}</td>
                  <td className="px-5 py-4">{client.gstin ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">GST</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">B2C</span>}</td>
                  <td className="px-5 py-4 text-slate-600">{client.state || '—'}</td>
                  <td className="px-5 py-4"><p className="text-slate-600">{client.phone || '—'}</p>{client.gstin && <p className="mt-0.5 font-mono text-[11px] text-slate-400">{client.gstin}</p>}</td>
                  <td className="px-5 py-4 text-slate-400">{formatDate(client.created_at)}</td>
                  <td className="px-5 py-4"><button onClick={(event) => { event.stopPropagation(); openEdit(client); }} className="rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 group-hover:opacity-100 focus:opacity-100" aria-label={`Edit ${client.name}`}><Edit2 size={15} /></button></td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse bg-slate-50" />) : filteredClients.map((client) => <button key={client.id} onClick={() => setSelectedClient(client)} className="flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tintFor(client.name)}`}>{initials(client.name)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-bold text-slate-900">{client.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${client.gstin ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{client.gstin ? 'GST' : 'B2C'}</span></div><p className="mt-0.5 truncate text-xs text-slate-500">{client.email || client.phone || client.state || 'No contact details'}</p><p className="mt-0.5 text-[11px] text-slate-400">{projectCounts[client.id] ?? 0} projects · {client.default_company ? COMPANY_LABELS[client.default_company] : 'Legacy client'}</p></div><ChevronRight size={18} className="shrink-0 text-slate-300" /></button>)}
          </div>

          {!loading && filteredClients.length === 0 && <div className="px-5 py-16 text-center"><Users size={24} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No clients found</p><p className="mt-1 text-sm text-slate-400">Try another search or filter.</p></div>}
        </Card>
      </main>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit client' : 'New client onboarding'} icon={<UserPlus size={18} />} size={editing ? 'md' : 'xl'}>
        {!editing ? <ClientOnboardingForm createClient={createClient} onCreated={(clientId) => { setShowForm(false); navigate(`/clients/${clientId}`); }} onCancel={() => setShowForm(false)} /> : <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required placeholder="Client / company name" />
          <Input label="GSTIN (optional)" value={form.gstin} onChange={(event) => setForm((current) => ({ ...current, gstin: event.target.value }))} placeholder="22AAAAA0000A1Z5" />
          <Input label="Address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Full billing address" />
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-slate-700">State</label><select value={form.state_code} onChange={(event) => { const state = INDIAN_STATES.find((item) => item.code === event.target.value); setForm((current) => ({ ...current, state_code: event.target.value, state: state?.name || '' })); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Select state</option>{INDIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}</select></div>
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="client@email.com" />
          <Input label="Phone (optional)" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+91 98765 43210" />
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-slate-700">Company</label><select value={form.default_company} onChange={(event) => setForm((current) => ({ ...current, default_company: event.target.value as CompanyCode }))} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{COMPANY_CODES.map((company) => <option key={company} value={company}>{COMPANY_LABELS[company]}</option>)}</select></div>
          <Button type="submit" loading={saving} className="w-full">Update client</Button>
        </form>}
      </Modal>

      <ClientWorkspaceDrawer client={selectedClient} workspaceId={workspace.id} onClose={() => setSelectedClient(null)} onEdit={(client) => { setSelectedClient(null); openEdit(client); }} onDeleted={refetch} />
    </div>
  );
}
