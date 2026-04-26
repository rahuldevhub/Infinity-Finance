import { useState, useRef, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import type { Client } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { INDIAN_STATES } from '../../types';

interface ClientSelectorProps {
  clients: Client[];
  selected: Client | null;
  onSelect: (client: Client) => void;
  onClear: () => void;
  onCreateClient: (client: Omit<Client, 'id' | 'created_at'>) => Promise<Client>;
}

export function ClientSelector({ clients, selected, onSelect, onClear, onCreateClient }: ClientSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ name: '', gstin: '', address: '', state: '', state_code: '', email: '', phone: '' });

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const client = await onCreateClient({ ...form, gstin: form.gstin || null, email: form.email || null, phone: form.phone || null });
      onSelect(client);
      setShowForm(false);
      setOpen(false);
    } finally { setSaving(false); }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
          {selected.gstin && <p className="text-xs text-gray-500">GSTIN: {selected.gstin}</p>}
          <p className="text-xs text-gray-500">{selected.state}</p>
        </div>
        <button onClick={onClear} className="p-1 rounded hover:bg-gray-200 text-gray-400">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search client by name or GSTIN..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(client => (
            <div
              key={client.id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => { onSelect(client); setOpen(false); setSearch(''); }}
            >
              <p className="text-sm font-medium text-gray-900">{client.name}</p>
              {client.gstin && <p className="text-xs text-gray-500">{client.gstin}</p>}
              <p className="text-xs text-gray-400">{client.state}</p>
            </div>
          )) : (
            <div className="px-4 py-3 text-sm text-gray-500">No clients found</div>
          )}
          <div className="border-t border-gray-100 px-4 py-2">
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> Add New Client
            </button>
          </div>

          {showForm && (
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 bg-blue-50">
              <p className="text-xs font-semibold text-gray-700">New Client</p>
              <Input
                placeholder="Client name *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="GSTIN (optional)"
                value={form.gstin}
                onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))}
              />
              <Input
                placeholder="Address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
              <select
                value={form.state_code}
                onChange={e => {
                  const s = INDIAN_STATES.find(st => st.code === e.target.value);
                  setForm(f => ({ ...f, state_code: e.target.value, state: s?.name || '' }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
              <Input placeholder="Email (optional)" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Phone (optional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Button size="sm" onClick={handleCreate} loading={saving} className="w-full">
                Save Client
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
