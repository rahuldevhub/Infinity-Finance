import { useMemo, useRef, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { INDIAN_STATES, type Client } from '../../types';
import { COMPANY_CODES, COMPANY_LABELS, type CompanyCode } from '../../domain/company';
import { calculateOnboardingCommercials, materializePaymentStages, packageDeliverables, type DiscountType, type PaymentStageDraft } from '../../domain/clientOnboarding';
import { RITERA_PACKAGES } from '../../data/riteraPackages';
import { ClientOnboardingError, createClientProjectOnboarding, logClientOnboardingError } from '../../services/clientOnboarding';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  createClient: (client: Omit<Client, 'id' | 'created_at'>) => Promise<Client>;
  onCreated: (clientId: string) => void;
  onCancel: () => void;
}

const DEFAULT_STAGES: PaymentStageDraft[] = [
  { label: 'Advance', percentage: 40 },
  { label: 'Second Payment', percentage: 30 },
  { label: 'Final Payment', percentage: 30 },
];

export function ClientOnboardingForm({ createClient, onCreated, onCancel }: Props) {
  const [client, setClient] = useState({ name: '', email: '', phone: '', address: '', state: '', state_code: '', gstin: '', default_company: 'ritera' as CompanyCode });
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [packageId, setPackageId] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [newDeliverable, setNewDeliverable] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [gstRate, setGstRate] = useState('18');
  const [stages, setStages] = useState<PaymentStageDraft[]>(DEFAULT_STAGES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);
  const onboardingKeyRef = useRef(crypto.randomUUID());
  const selectedPackage = RITERA_PACKAGES.find((item) => item.id === packageId);

  const commercials = useMemo(() => {
    try {
      return calculateOnboardingCommercials(Number(basePrice), discountType, Number(discountValue || 0), Number(gstRate || 0), Boolean(client.state_code && client.state_code !== '33'));
    } catch { return null; }
  }, [basePrice, client.state_code, discountType, discountValue, gstRate]);

  const paymentRows = useMemo(() => {
    if (!commercials) return [];
    try { return materializePaymentStages(commercials.proposedTotal, stages); } catch { return []; }
  }, [commercials, stages]);

  function choosePackage(nextId: string) {
    setPackageId(nextId);
    const next = RITERA_PACKAGES.find((item) => item.id === nextId);
    if (!next) { setDeliverables([]); return; }
    setDeliverables(packageDeliverables(next.services, next.complementary));
    if (!next.isCustom) setBasePrice(String(next.price));
  }

  function addDeliverable() {
    const value = newDeliverable.trim();
    if (!value) return;
    setDeliverables((current) => [...current, value]); setNewDeliverable('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (submittingRef.current) return;
    if (!client.name.trim()) { setError('Client name is required.'); return; }
    if (client.default_company !== 'ritera') {
      submittingRef.current = true;
      setSaving(true);
      try {
        const created = await createClient({ ...client, name: client.name.trim(), email: client.email || null, phone: client.phone || null, gstin: client.gstin || null });
        onCreated(created.id);
      } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Client could not be created'); }
      finally { submittingRef.current = false; setSaving(false); }
      return;
    }
    if (!projectName.trim() || !selectedPackage) { setError('Project / Book name and package are required.'); return; }
    if (!commercials || commercials.proposedTotal <= 0) { setError('Enter a valid package price.'); return; }
    try { materializePaymentStages(commercials.proposedTotal, stages); } catch (scheduleError) { setError(scheduleError instanceof Error ? scheduleError.message : 'Invalid payment plan'); return; }
    submittingRef.current = true;
    setSaving(true);
    try {
      const result = await createClientProjectOnboarding({
        onboardingKey: onboardingKeyRef.current,
        client: { ...client, name: client.name.trim() },
        project: { name: projectName.trim(), description, packageId: selectedPackage.id, packageName: selectedPackage.name, services: selectedPackage.services, deliverables },
        commercials, paymentStages: stages,
      });
      onCreated(result.client_id);
    } catch (submitError) {
      logClientOnboardingError(submitError);
      const schemaMissing = submitError instanceof ClientOnboardingError
        && ['PGRST202', 'PGRST204', '42P01', '42703', '42883'].includes(submitError.code || '');
      setError(schemaMissing
        ? 'Database setup is incomplete. Apply the Phase 1, Phase 2, and Phase 3 migrations, then retry.'
        : 'Onboarding could not be completed. No partial setup was saved. Check the development console for details.');
    }
    finally { submittingRef.current = false; setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-7">
    <section><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Basic client information</h3><div className="grid md:grid-cols-2 gap-4"><Input label="Client Name" required value={client.name} onChange={(event) => setClient((current) => ({ ...current, name: event.target.value }))} /><Input label="Email" type="email" value={client.email} onChange={(event) => setClient((current) => ({ ...current, email: event.target.value }))} /><Input label="Phone" value={client.phone} onChange={(event) => setClient((current) => ({ ...current, phone: event.target.value }))} /><Input label="Address" value={client.address} onChange={(event) => setClient((current) => ({ ...current, address: event.target.value }))} /><div><label className="text-sm font-medium text-gray-700">State</label><select value={client.state_code} onChange={(event) => { const state = INDIAN_STATES.find((item) => item.code === event.target.value); setClient((current) => ({ ...current, state_code: event.target.value, state: state?.name || '' })); }} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select State</option>{INDIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}</select></div><Input label="GSTIN" value={client.gstin} onChange={(event) => setClient((current) => ({ ...current, gstin: event.target.value }))} /></div></section>

    <section><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Company *</h3><div className="grid sm:grid-cols-3 gap-2">{COMPANY_CODES.map((company) => <button key={company} type="button" onClick={() => setClient((current) => ({ ...current, default_company: company }))} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${client.default_company === company ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{company === 'ritera' ? 'Ritera' : company === 'ratix' ? 'Ratix' : COMPANY_LABELS[company]}</button>)}</div></section>

    {client.default_company === 'ritera' && <>
      <section className="rounded-xl border border-gray-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ritera project details</h3><div className="grid md:grid-cols-2 gap-4"><Input label="Project / Book Name" required value={projectName} onChange={(event) => setProjectName(event.target.value)} /><div><label className="text-sm font-medium text-gray-700">Package</label><select required value={packageId} onChange={(event) => choosePackage(event.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"><option value="">Select package</option>{RITERA_PACKAGES.map((item) => <option key={item.id} value={item.id}>{item.name}{item.price ? ` — ${formatCurrency(item.price)}` : ''}</option>)}</select></div></div><label className="block text-sm font-medium text-gray-700 mt-4">Project description / notes</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />{selectedPackage && <div className="mt-4"><p className="text-sm font-semibold">Deliverables snapshot</p><div className="mt-2 grid md:grid-cols-2 gap-2">{deliverables.map((item, index) => <div key={`${index}-${item}`} className="flex items-center gap-2"><Check size={14} className="text-green-600 shrink-0" /><input value={item} onChange={(event) => setDeliverables((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className="flex-1 border rounded-lg px-2 py-1.5 text-sm" /><button type="button" onClick={() => setDeliverables((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400"><Trash2 size={14} /></button></div>)}</div><div className="flex gap-2 mt-3"><input value={newDeliverable} onChange={(event) => setNewDeliverable(event.target.value)} placeholder="Custom deliverable" className="flex-1 border rounded-lg px-3 py-2 text-sm" /><Button type="button" size="sm" variant="outline" onClick={addDeliverable}><Plus size={14} /> Add</Button></div></div>}</section>

      <section className="rounded-xl border border-gray-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Commercial details</h3><div className="grid md:grid-cols-4 gap-3"><Input label="Base / Package Price" type="number" min="0.01" step="0.01" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} /><div><label className="text-sm font-medium">Discount Type</label><select value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"><option value="none">None</option><option value="percentage">Percentage</option><option value="flat">Flat</option></select></div><Input label="Discount Value" type="number" min="0" step="0.01" disabled={discountType === 'none'} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} /><div><label className="text-sm font-medium">GST Rate</label><select value={gstRate} onChange={(event) => setGstRate(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{[0,5,12,18,28].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></div></div>{commercials && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm"><div><p className="text-gray-400">Discount</p><p className="font-bold">{formatCurrency(commercials.discountAmount)}</p></div><div><p className="text-gray-400">Taxable</p><p className="font-bold">{formatCurrency(commercials.taxableAmount)}</p></div><div><p className="text-gray-400">GST</p><p className="font-bold">{formatCurrency(commercials.gstAmount)}</p></div><div><p className="text-gray-400">Final Proposed Value</p><p className="font-bold text-lg">{formatCurrency(commercials.proposedTotal)}</p></div></div>}</section>

      <section className="rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Payment plan</h3><button type="button" onClick={() => setStages((current) => [...current, { label: `Installment ${current.length + 1}`, percentage: 0 }])} className="text-sm font-semibold text-blue-600">+ Add Payment Stage</button></div><div className="space-y-3 mt-3">{stages.map((stage, index) => <div key={index} className="grid grid-cols-[1fr_100px_120px_36px] gap-2 items-end"><Input label={index === 0 ? 'Label' : undefined} value={stage.label} onChange={(event) => setStages((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /><Input label={index === 0 ? 'Percent' : undefined} type="number" min="0.01" max="100" step="0.01" value={stage.percentage} onChange={(event) => setStages((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: Number(event.target.value) } : item))} /><div className="h-10 flex items-center px-3 rounded-lg bg-gray-50 text-sm font-semibold">{paymentRows[index] ? formatCurrency(paymentRows[index].amount) : '—'}</div><button type="button" onClick={() => setStages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="h-10 text-red-400"><Trash2 size={15} /></button></div>)}</div><p className="mt-3 text-xs text-gray-500">Draft schedule only. No receipt or money-received record is created until the quotation is accepted and a real payment is recorded.</p></section>
    </>}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" loading={saving}>{saving ? (client.default_company === 'ritera' ? 'Creating Client & Project...' : 'Creating Client...') : (client.default_company === 'ritera' ? 'Create Client & Project' : 'Create Client')}</Button></div>
  </form>;
}
