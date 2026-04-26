import { useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import type { Client } from '../types';
import { INDIAN_STATES } from '../types';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils/formatters';

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
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} /> Add Client
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Name', 'GSTIN', 'State', 'Email', 'Phone', 'Added', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      No clients found
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {c.gstin || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.state || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setConfirmDelete(c.id);
                            }}
                            className="p-1.5 rounded hover:bg-red-100 text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
