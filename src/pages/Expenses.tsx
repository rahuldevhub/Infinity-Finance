import { useState } from 'react';
import { Plus, Trash2, ExternalLink, Pencil } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useAuth } from '../hooks/useAuth';
import { EXPENSE_CATEGORIES, GST_RATES } from '../types';
import type { Expense } from '../types';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, getMonthRange } from '../utils/formatters';

export function Expenses() {
  const { user } = useAuth();
  const today = new Date();
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editBillFile, setEditBillFile] = useState<File | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);

  const { start, end } = getMonthRange(filterYear, filterMonth);
  const { expenses, loading, createExpense, updateExpense, deleteExpense, uploadBill } = useExpenses({
    start,
    end,
    category: filterCategory || undefined,
  });

  const [editForm, setEditForm] = useState({
    date: '',
    vendor_name: '',
    description: '',
    category: 'Office Supplies',
    taxable_amount: '',
    gst_rate: 18,
    total_amount: '',
    is_itc_eligible: true,
    gstin_of_vendor: '',
  });

  const editGstAmount = (parseFloat(editForm.taxable_amount) || 0) * editForm.gst_rate / 100;
  const editAutoTotal = (parseFloat(editForm.taxable_amount) || 0) + editGstAmount;

  function openEditExpense(exp: Expense) {
    setEditForm({
      date: exp.date,
      vendor_name: exp.vendor_name,
      description: exp.description || '',
      category: exp.category,
      taxable_amount: String(exp.taxable_amount),
      gst_rate: exp.gst_rate,
      total_amount: String(exp.total_amount),
      is_itc_eligible: exp.is_itc_eligible,
      gstin_of_vendor: exp.gstin_of_vendor || '',
    });
    setEditingExpense(exp);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;
    setEditSaving(true);
    try {
      let bill_url = editingExpense.bill_url;
      if (editBillFile) bill_url = await uploadBill(editBillFile);
      await updateExpense(editingExpense.id, {
        date: editForm.date,
        vendor_name: editForm.vendor_name,
        description: editForm.description,
        category: editForm.category,
        taxable_amount: parseFloat(editForm.taxable_amount) || 0,
        gst_amount: editGstAmount,
        gst_rate: editForm.gst_rate,
        total_amount: parseFloat(editForm.total_amount) || editAutoTotal,
        is_itc_eligible: editForm.is_itc_eligible,
        bill_url,
        gstin_of_vendor: editForm.gstin_of_vendor || null,
      });
      setEditingExpense(null);
      setEditBillFile(null);
    } finally {
      setEditSaving(false);
    }
  }

  const defaultForm = {
    date: today.toISOString().split('T')[0],
    vendor_name: '',
    description: '',
    category: 'Office Supplies',
    taxable_amount: '',
    gst_rate: 18,
    total_amount: '',
    is_itc_eligible: true,
    gstin_of_vendor: '',
  };
  const [form, setForm] = useState(defaultForm);

  const gstAmount = (parseFloat(form.taxable_amount) || 0) * form.gst_rate / 100;
  const autoTotal = (parseFloat(form.taxable_amount) || 0) + gstAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let bill_url = null;
      if (billFile) bill_url = await uploadBill(billFile);
      await createExpense({
        date: form.date,
        vendor_name: form.vendor_name,
        description: form.description,
        category: form.category,
        taxable_amount: parseFloat(form.taxable_amount) || 0,
        gst_amount: gstAmount,
        gst_rate: form.gst_rate,
        total_amount: parseFloat(form.total_amount) || autoTotal,
        is_itc_eligible: form.is_itc_eligible,
        bill_url,
        gstin_of_vendor: form.gstin_of_vendor || null,
        created_by: user?.id || '',
      });
      setShowForm(false);
      setBillFile(null);
      setForm(defaultForm);
    } finally {
      setSaving(false);
    }
  }

  const totalGST = expenses.reduce((s, e) => s + Number(e.gst_amount), 0);
  const totalITC = expenses
    .filter((e) => e.is_itc_eligible)
    .reduce((s, e) => s + Number(e.gst_amount), 0);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' }),
  }));
  const years = [today.getFullYear() - 1, today.getFullYear()].map((y) => ({
    value: String(y),
    label: String(y),
  }));

  return (
    <div>
      <TopBar
        title="Expenses"
        subtitle="Business expenses under Infinity Enterprises GST"
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Expense
          </Button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-xs text-gray-500 mb-1">Total GST on Expenses</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalGST)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-1">ITC Available</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(totalITC)}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">GST</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">ITC</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Bill</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : expenses.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        No expenses found
                      </td>
                    </tr>
                  )
                  : expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setDetailExpense(exp)}
                      >
                        <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{exp.vendor_name}</p>
                          <p className="text-xs text-gray-400">{exp.description}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge variant="blue">{exp.category}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(exp.total_amount)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(exp.gst_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={exp.is_itc_eligible ? 'green' : 'gray'}>
                            {exp.is_itc_eligible ? 'Yes' : 'No'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {exp.bill_url ? (
                            <a
                              href={exp.bill_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800 inline-flex justify-center"
                            >
                              <ExternalLink size={15} />
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditExpense(exp)}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-400 mr-1"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(exp.id)}
                            className="p-1.5 rounded hover:bg-red-100 text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Expense" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
            <Input
              label="Vendor Name"
              value={form.vendor_name}
              onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
              required
              placeholder="Vendor name"
            />
          </div>
          <Input
            label="Vendor GSTIN (optional)"
            value={form.gstin_of_vendor}
            onChange={(e) => setForm((f) => ({ ...f, gstin_of_vendor: e.target.value }))}
            placeholder="22AAAAA0000A1Z5"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description"
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Taxable Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.taxable_amount}
              onChange={(e) => setForm((f) => ({ ...f, taxable_amount: e.target.value }))}
              required
              placeholder="0.00"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">GST Rate</label>
              <select
                value={form.gst_rate}
                onChange={(e) => setForm((f) => ({ ...f, gst_rate: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">GST Amount</label>
              <input
                readOnly
                value={formatCurrency(gstAmount)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
              />
            </div>
          </div>
          <Input
            label="Total Amount (₹)"
            type="number"
            min="0"
            step="0.01"
            value={form.total_amount || String(autoTotal.toFixed(2))}
            onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
            placeholder={String(autoTotal.toFixed(2))}
            helperText="Auto-calculated from taxable + GST. Override if needed."
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="itc"
              checked={form.is_itc_eligible}
              onChange={(e) => setForm((f) => ({ ...f, is_itc_eligible: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="itc" className="text-sm text-gray-700">
              ITC Eligible (Input Tax Credit can be claimed)
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Upload Bill (optional)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setBillFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <Button type="submit" loading={saving} className="w-full">
            Save Expense
          </Button>
        </form>
      </Modal>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <Modal isOpen={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit Expense" size="lg">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
              <Input
                label="Vendor Name"
                value={editForm.vendor_name}
                onChange={(e) => setEditForm((f) => ({ ...f, vendor_name: e.target.value }))}
                required
                placeholder="Vendor name"
              />
            </div>
            <Input
              label="Vendor GSTIN (optional)"
              value={editForm.gstin_of_vendor}
              onChange={(e) => setEditForm((f) => ({ ...f, gstin_of_vendor: e.target.value }))}
              placeholder="22AAAAA0000A1Z5"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Input
              label="Description"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description"
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Taxable Amount (₹)"
                type="number"
                min="0"
                step="0.01"
                value={editForm.taxable_amount}
                onChange={(e) => setEditForm((f) => ({ ...f, taxable_amount: e.target.value }))}
                required
                placeholder="0.00"
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">GST Rate</label>
                <select
                  value={editForm.gst_rate}
                  onChange={(e) => setEditForm((f) => ({ ...f, gst_rate: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">GST Amount</label>
                <input
                  readOnly
                  value={formatCurrency(editGstAmount)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
                />
              </div>
            </div>
            <Input
              label="Total Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={editForm.total_amount || String(editAutoTotal.toFixed(2))}
              onChange={(e) => setEditForm((f) => ({ ...f, total_amount: e.target.value }))}
              placeholder={String(editAutoTotal.toFixed(2))}
              helperText="Auto-calculated from taxable + GST. Override if needed."
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="edit-itc"
                checked={editForm.is_itc_eligible}
                onChange={(e) => setEditForm((f) => ({ ...f, is_itc_eligible: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="edit-itc" className="text-sm text-gray-700">
                ITC Eligible (Input Tax Credit can be claimed)
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Replace Bill (optional)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setEditBillFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {editingExpense.bill_url && !editBillFile && (
                <p className="text-xs text-gray-400 mt-1">Current bill: <a href={editingExpense.bill_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a></p>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={editSaving} className="flex-1">
                Update Expense
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingExpense(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Expense Detail Modal */}
      {detailExpense && (
        <Modal isOpen={!!detailExpense} onClose={() => setDetailExpense(null)} title="Expense Details" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Date</p>
                <p className="text-gray-900 font-medium">{formatDate(detailExpense.date)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Category</p>
                <Badge variant="blue">{detailExpense.category}</Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Vendor</p>
                <p className="text-gray-900 font-medium">{detailExpense.vendor_name}</p>
                {detailExpense.gstin_of_vendor && (
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{detailExpense.gstin_of_vendor}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">ITC Eligible</p>
                <Badge variant={detailExpense.is_itc_eligible ? 'green' : 'gray'}>
                  {detailExpense.is_itc_eligible ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            {detailExpense.description && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Description</p>
                <p className="text-sm text-gray-700">{detailExpense.description}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Taxable Amount</span>
                <span className="font-medium">{formatCurrency(detailExpense.taxable_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GST Rate</span>
                <span className="font-medium">{detailExpense.gst_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GST Amount</span>
                <span className="font-medium text-blue-700">{formatCurrency(detailExpense.gst_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-700">Total Amount</span>
                <span className="font-bold text-gray-900">{formatCurrency(detailExpense.total_amount)}</span>
              </div>
            </div>
            {detailExpense.bill_url && (
              <a
                href={detailExpense.bill_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink size={14} /> View Bill / Receipt
              </a>
            )}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button
                onClick={() => { setDetailExpense(null); openEditExpense(detailExpense); }}
                size="sm"
              >
                <Pencil size={14} /> Edit Expense
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDetailExpense(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Expense" size="sm">
          <p className="text-sm text-gray-600 mb-4">
            Delete this expense? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={async () => {
                await deleteExpense(confirmDelete);
                setConfirmDelete(null);
              }}
            >
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
