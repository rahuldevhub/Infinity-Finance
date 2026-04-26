import { useState, useEffect, useRef } from 'react';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { getLogo, saveLogo, removeLogo, fileToBase64, PLACEHOLDER_LOGOS } from '../utils/logos';

export function Settings() {
  const { settings, loading, updateSettings } = useBusinessSettings();
  const [form, setForm] = useState({
    gst_name: '',
    gstin: '',
    address: '',
    state: '',
    state_code: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch: '',
    account_name: '',
    sub_brand_1: '',
    sub_brand_2: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Logo state
  const [logoRitera, setLogoRitera] = useState<string | null>(null);
  const [logoRiteraSize, setLogoRiteraSize] = useState(0);
  const [logoRatixinfo, setLogoRatixinfo] = useState<string | null>(null);
  const [logoRatixinfoSize, setLogoRatixinfoSize] = useState(0);
  const riteraFileRef = useRef<HTMLInputElement>(null);
  const ratixFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoRitera(getLogo('ritera'));
    setLogoRatixinfo(getLogo('ratixinfo'));
  }, []);

  async function handleLogoUpload(brand: 'ritera' | 'ratixinfo', file: File) {
    const base64 = await fileToBase64(file);
    saveLogo(brand, base64);
    if (brand === 'ritera') {
      setLogoRitera(base64);
      setLogoRiteraSize(file.size);
    } else {
      setLogoRatixinfo(base64);
      setLogoRatixinfoSize(file.size);
    }
  }

  useEffect(() => {
    if (settings) {
      setForm({
        gst_name: settings.gst_name,
        gstin: settings.gstin,
        address: settings.address,
        state: settings.state,
        state_code: settings.state_code,
        bank_name: settings.bank_details?.bank_name || '',
        account_number: settings.bank_details?.account_number || '',
        ifsc_code: settings.bank_details?.ifsc_code || '',
        branch: settings.bank_details?.branch || '',
        account_name: settings.bank_details?.account_name || '',
        sub_brand_1: settings.sub_brands?.[0] || '',
        sub_brand_2: settings.sub_brands?.[1] || '',
      });
    }
  }, [settings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        gst_name: form.gst_name,
        gstin: form.gstin,
        address: form.address,
        state: form.state,
        state_code: form.state_code,
        bank_details: {
          bank_name: form.bank_name,
          account_number: form.account_number,
          ifsc_code: form.ifsc_code,
          branch: form.branch,
          account_name: form.account_name,
        },
        sub_brands: [form.sub_brand_1, form.sub_brand_2].filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <TopBar title="Settings" />
        <div className="px-4 md:px-6 py-12 text-center text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Settings" />
      <form onSubmit={handleSubmit} className="px-4 md:px-6 py-6 space-y-6 max-w-2xl">
        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="GST Registered Name"
              value={form.gst_name}
              onChange={(e) => setForm((f) => ({ ...f, gst_name: e.target.value }))}
              required
              placeholder="Infinity Enterprises"
            />
            <Input
              label="GSTIN"
              value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
              placeholder="33AAAAA0000A1Z5"
              required
              helperText="Your 15-digit GST Identification Number"
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full business address"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="State"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder="Tamil Nadu"
              />
              <Input
                label="State Code"
                value={form.state_code}
                onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))}
                placeholder="33"
                helperText="Used for CGST/SGST vs IGST logic"
              />
            </div>
          </div>
        </Card>

        {/* Sub-brands */}
        <Card>
          <CardHeader>
            <CardTitle>Sub-brands</CardTitle>
          </CardHeader>
          <p className="text-xs text-gray-500 mb-4">
            These appear as selectable options when creating invoices.
          </p>
          <div className="space-y-3">
            <Input
              label="Sub-brand 1"
              value={form.sub_brand_1}
              onChange={(e) => setForm((f) => ({ ...f, sub_brand_1: e.target.value }))}
              placeholder="Ritera Publishing"
            />
            <Input
              label="Sub-brand 2"
              value={form.sub_brand_2}
              onChange={(e) => setForm((f) => ({ ...f, sub_brand_2: e.target.value }))}
              placeholder="Ratixinfo Tech"
            />
          </div>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
          </CardHeader>
          <p className="text-xs text-gray-500 mb-4">
            These appear on the bottom of every invoice PDF.
          </p>
          <div className="space-y-4">
            <Input
              label="Account Holder Name"
              value={form.account_name}
              onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
              placeholder="Infinity Enterprises"
            />
            <Input
              label="Bank Name"
              value={form.bank_name}
              onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              placeholder="HDFC Bank"
            />
            <Input
              label="Account Number"
              value={form.account_number}
              onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
              placeholder="00000000000000"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="IFSC Code"
                value={form.ifsc_code}
                onChange={(e) => setForm((f) => ({ ...f, ifsc_code: e.target.value }))}
                placeholder="HDFC0000000"
              />
              <Input
                label="Branch"
                value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                placeholder="Chennai Main"
              />
            </div>
          </div>
        </Card>

        {/* Brand Logos */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Logos</CardTitle>
          </CardHeader>
          <p className="text-xs text-gray-500 mb-4">
            Upload logos for PDF order forms. Logos appear in invoice and quotation PDF headers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ritera Publishing */}
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Ritera Publishing</p>
              <div className="flex items-center justify-center h-16 mb-3 bg-gray-50 rounded border border-dashed border-gray-300">
                <img
                  src={logoRitera || PLACEHOLDER_LOGOS.ritera}
                  alt="Ritera logo preview"
                  style={{ maxHeight: 48, objectFit: 'contain' }}
                />
              </div>
              {logoRitera && logoRiteraSize > 500 * 1024 && (
                <p className="text-xs text-amber-600 mb-2">
                  Logo file is large. Smaller logos (under 200KB) work better in PDFs.
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => riteraFileRef.current?.click()}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                >
                  Upload Logo
                </button>
                {logoRitera && (
                  <button
                    type="button"
                    onClick={() => { removeLogo('ritera'); setLogoRitera(null); setLogoRiteraSize(0); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={riteraFileRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload('ritera', file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Ratixinfo Tech */}
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Ratixinfo Tech</p>
              <div className="flex items-center justify-center h-16 mb-3 bg-gray-50 rounded border border-dashed border-gray-300">
                <img
                  src={logoRatixinfo || PLACEHOLDER_LOGOS.ratixinfo}
                  alt="Ratixinfo logo preview"
                  style={{ maxHeight: 48, objectFit: 'contain' }}
                />
              </div>
              {logoRatixinfo && logoRatixinfoSize > 500 * 1024 && (
                <p className="text-xs text-amber-600 mb-2">
                  Logo file is large. Smaller logos (under 200KB) work better in PDFs.
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => ratixFileRef.current?.click()}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                >
                  Upload Logo
                </button>
                {logoRatixinfo && (
                  <button
                    type="button"
                    onClick={() => { removeLogo('ratixinfo'); setLogoRatixinfo(null); setLogoRatixinfoSize(0); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={ratixFileRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload('ratixinfo', file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </Card>

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            ✓ Settings saved successfully!
          </div>
        )}

        <div className="pb-8">
          <Button type="submit" size="lg" loading={saving}>
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
