import { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Users, ShieldCheck, Building2, UserPlus, ChevronRight } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import type { Client } from '../types';
import { INDIAN_STATES } from '../types';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils/formatters';

// Initials + deterministic neutral tint for client avatars (green/red reserved
// for financial meaning, so avatars stay slate/blue/amber).
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const AVATAR_TINTS = [
  { bg: '#f1f5f9', fg: '#334155' },
  { bg: '#eff6ff', fg: '#2563eb' },
  { bg: '#eef2ff', fg: '#4f46e5' },
  { bg: '#f0f9ff', fg: '#0284c7' },
  { bg: '#fffbeb', fg: '#d97706' },
];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

const emptyForm = {
  name: '',
  gstin: '',
  address: '',
  state: '',
  state_code: '',
  email: '',
  phone: '',
};

export function Clients() {
  const [search, setSearch] = useState('');
  const { clients, loading, createClient, updateClient, deleteClient } = useClients(
    search || undefined
  );

  const total = clients.length;
  const gstCount = clients.filter((c) => c.gstin).length;
  const nonGst = total - gstCount;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      gstin: c.gstin || '',
      address: c.address,
      state: c.state,
      state_code: c.state_code,
      email: c.email || '',
      phone: c.phone || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        gstin: form.gstin || null,
        email: form.email || null,
        phone: form.phone || null,
      };
      if (editing) {
        await updateClient(editing.id, payload);
      } else {
        await createClient(payload);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError('');
    try {
      await deleteClient(id);
      setConfirmDelete(null);
    } catch (e: any) {
      setDeleteError('Cannot delete: client has existing invoices.');
    }
  }

  return (
    <div>
      <TopBar
        title="Clients"
        subtitle="Manage your customers"
        actions={
          <Button size="sm" onClick={openCreate} aria-label="Add Client">
            <Plus size={16} /> <span className="hidden sm:inline">Add Client</span>
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-5 md:py-6 space-y-4 md:space-y-5">
        {/* Top metrics — desktop */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          <div className="card-surface hover-lift p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.07)' }}>
              <Users size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Total Clients</p>
              <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>{total}</p>
            </div>
          </div>
          <div className="card-surface hover-lift p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">GST-Registered</p>
              <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>{gstCount}</p>
            </div>
          </div>
          <div className="card-surface hover-lift p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Non-GST (B2C)</p>
              <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>{nonGst}</p>
            </div>
          </div>
        </div>

        {/* Top metrics — mobile */}
        <div className="md:hidden space-y-3">
          <div className="card-surface p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.07)' }}>
              <Users size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Total Clients</p>
              <p className="text-3xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>{total}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card-surface p-3.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
                <ShieldCheck size={16} className="text-blue-600" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">GST</p>
              <p className="text-xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>{gstCount}</p>
            </div>
            <div className="card-surface p-3.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                <Building2 size={16} className="text-gray-500" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Non-GST</p>
              <p className="text-xl font-extrabold text-gray-900" style={{ fontFamily: '"Nunito", ui-rounded, sans-serif', letterSpacing: '-0.02em' }}>{nonGst}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search size={16} className="absolute left-3.5 md:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-10 md:pl-9 pr-4 py-3 md:py-2 border border-gray-200 rounded-xl md:rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {/* Client list — mobile */}
        <div className="md:hidden space-y-2.5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-surface p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))
          ) : clients.length === 0 ? (
            search ? (
              <p className="text-sm text-gray-400 text-center py-16">No clients match "{search}".</p>
            ) : (
              <div className="card-surface flex flex-col items-center gap-3 text-center py-10 px-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Users size={22} className="text-gray-300" />
                </div>
                <div>
                  <p className="text-gray-700 font-semibold">No clients yet</p>
                  <p className="text-sm text-gray-400 mt-0.5">Add your first client to start invoicing.</p>
                </div>
                <button
                  onClick={openCreate}
                  className="mt-1 inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-medium active:opacity-90 transition-opacity"
                  style={{ background: 'var(--accent)' }}
                >
                  <Plus size={14} /> Add Client
                </button>
              </div>
            )
          ) : (
            clients.map((c) => {
              const tint = tintFor(c.name);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(c); }
                  }}
                  className="card-surface flex items-center gap-3 p-4 active:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    {c.gstin ? (
                      <>
                        <p className="text-xs text-gray-400 mt-0.5">GST Registered</p>
                        <p className="text-[11px] font-mono text-gray-400 truncate">{c.gstin}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Non-GST</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteError(''); setConfirmDelete(c.id); }}
                    className="p-2 -m-2 rounded-lg text-gray-300 active:bg-red-50 active:text-red-500 shrink-0"
                    aria-label="Delete client"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} className="text-gray-300 shrink-0" />
                </div>
              );
            })
          )}
        </div>

        <Card padding={false} className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Client', 'GSTIN', 'State', 'Email', 'Phone', 'Added', ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      {search ? (
                        <p className="text-sm text-gray-400">No clients match “{search}”.</p>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                            <Users size={22} className="text-gray-300" />
                          </div>
                          <div>
                            <p className="text-gray-700 font-semibold">No clients yet</p>
                            <p className="text-sm text-gray-400 mt-0.5">Add your first client to start invoicing.</p>
                          </div>
                          <button
                            onClick={openCreate}
                            className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                            style={{ background: 'var(--accent)' }}
                          >
                            <Plus size={14} /> Add Client
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const tint = tintFor(c.name);
                    return (
                      <tr key={c.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: tint.bg, color: tint.fg }}
                            >
                              {initials(c.name)}
                            </div>
                            <span className="font-semibold text-gray-900">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {c.gstin ? (
                            <span className="font-mono text-xs text-gray-600">{c.gstin}</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">B2C</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-600">{c.state || '—'}</td>
                        <td className="px-5 py-4 text-gray-500">{c.email || '—'}</td>
                        <td className="px-5 py-4 text-gray-500">{c.phone || '—'}</td>
                        <td className="px-5 py-4 text-gray-400">{formatDate(c.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(c)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteError('');
                                setConfirmDelete(c.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Client' : 'New Client'}
        icon={<UserPlus size={18} />}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            placeholder="Client / Company Name"
          />
          <Input
            label="GSTIN (optional)"
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
            placeholder="22AAAAA0000A1Z5"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Full billing address"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">State</label>
            <select
              value={form.state_code}
              onChange={(e) => {
                const s = INDIAN_STATES.find((st) => st.code === e.target.value);
                setForm((f) => ({
                  ...f,
                  state_code: e.target.value,
                  state: s?.name || '',
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Email (optional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="client@email.com"
          />
          <Input
            label="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91 98765 43210"
          />
          <Button type="submit" loading={saving} className="w-full">
            {editing ? 'Update Client' : 'Add Client'}
          </Button>
        </form>
      </Modal>

      {/* Delete Confirm */}
      {confirmDelete && (
        <Modal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          title="Delete Client"
          size="sm"
        >
          <p className="text-sm text-gray-600 mb-4">
            Delete this client? This will fail if they have existing invoices.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 mb-3">{deleteError}</p>
          )}
          <div className="flex gap-3">
            <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
