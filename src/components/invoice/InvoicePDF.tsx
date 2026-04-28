import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Invoice, BusinessSettings } from '../../types';
import { registerPDFFonts } from '../../utils/pdfFonts';
registerPDFFonts();
import { getLogo, PLACEHOLDER_LOGOS } from '../../utils/logos';
import { BUSINESS, getBrandDetails } from '../../constants/businessDetails';
import { amountToWords } from '../../utils/amountToWords';

// ── Helpers ───────────────────────────────────────────────────────────────────

function dmy(s?: string | null): string {
  if (!s) return '\u2014';
  const d = new Date(s + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmt(n: number): string {
  return 'INR ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Column widths ─────────────────────────────────────────────────────────────

const C  = { hsn: 55, qty: 30, rate: 65, gst: 38, cgst: 55, sgst: 55, igst: 55, total: 65 };
const CS = { qty: 38, unit: 38, rate: 72, amount: 80 };
const BDR = '#e0e0e0';

// ── All styles at module level — zero inline fontFamily in JSX ────────────────
const ps = StyleSheet.create({
  // Page
  page: { fontSize: 10, backgroundColor: 'white', paddingBottom: 72 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 32 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, marginRight: 12 },
  headerBrandName: { color: 'white', fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  headerBrandSub: { fontSize: 9, letterSpacing: 0.5, marginTop: 3, },
  headerRight: { alignItems: 'flex-end' },
  headerContact: { color: '#94a3b8', fontSize: 9, marginBottom: 2, },
  headerContactLast: { color: '#94a3b8', fontSize: 9, },

  // Accent stripe
  stripe: { height: 3 },

  // Title bar
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 32, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', borderBottomStyle: 'solid' },
  titleText: { fontSize: 14, fontWeight: 700, letterSpacing: 2 },
  titleMeta: { alignItems: 'flex-end' },
  metaText: { fontSize: 9, color: '#888888', marginBottom: 1, },
  metaTextLast: { fontSize: 9, color: '#888888', },

  // Bill boxes
  billedRow: { flexDirection: 'row', paddingHorizontal: 32, marginTop: 16 },
  billBox: { flex: 1, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  billBoxLeft: { flex: 1, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12, marginRight: 12 },
  billLabel: { fontSize: 8, fontWeight: 700, color: '#888888', letterSpacing: 1.5, marginBottom: 5 },
  billName: { fontSize: 12, fontWeight: 700 },
  billUnit: { fontSize: 9, marginTop: 2, },
  billAddr: { fontSize: 9, color: '#444444', marginTop: 2, },
  billGstin: { fontSize: 9, fontWeight: 700, marginTop: 3 },
  billContact: { fontSize: 9, color: '#666666', marginTop: 2, },

  // Supply details bar
  supplyBar: { marginHorizontal: 32, marginTop: 12, backgroundColor: '#f8f8f8', borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 4, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row' },
  supplyText: { fontSize: 9, color: '#444444', },
  supplyTextFirst: { fontSize: 9, color: '#444444', marginRight: 24, },

  // Table
  tableWrap: { marginHorizontal: 32, marginTop: 12 },
  tableHeader: { flexDirection: 'row', paddingVertical: 7, paddingLeft: 8, paddingRight: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingLeft: 8, paddingRight: 8, borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 6, paddingLeft: 8, paddingRight: 8, borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid', backgroundColor: '#fafafa' },
  th: { fontSize: 8, fontWeight: 700, color: 'white' },
  td: { fontSize: 9, color: '#2d2d2d', },

  // Summary
  summaryOuter: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 32, marginTop: 8 },
  summaryInner: { width: '50%' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8 },
  sumLabel: { fontSize: 10, color: '#444444', },
  sumValue: { fontSize: 10, color: '#2d2d2d', },
  totalDivider: { marginVertical: 4, marginHorizontal: 8, borderTopWidth: 1, borderTopStyle: 'solid' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  totalValue: { fontSize: 12, fontWeight: 700 },

  // Amount in words
  amountWords: { paddingHorizontal: 40, marginTop: 6 },
  amountWordsText: { fontSize: 9, color: '#666666', },

  // Payment details
  paymentBox: { marginHorizontal: 32, marginTop: 12, backgroundColor: '#eff6ff', borderWidth: 0.5, borderColor: '#bfdbfe', borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  paymentTitle: { fontSize: 8, fontWeight: 700, color: '#1d4ed8', letterSpacing: 1.5, marginBottom: 6 },
  paymentRow: { fontSize: 9, color: '#333333', lineHeight: 1.8, },
  paymentRowBold: { fontSize: 9, fontWeight: 700, color: '#333333', lineHeight: 1.8 },

  // Notes
  notesBox: { marginHorizontal: 32, marginTop: 12, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  notesTitle: { fontSize: 8, fontWeight: 700, color: '#888888', letterSpacing: 1, marginBottom: 5 },
  notesContent: { fontSize: 10, color: '#444444', marginBottom: 6, },
  notesStd: { fontSize: 9, color: '#aaaaaa', lineHeight: 1.7 },

  // Thank you banner (fixed above footer)
  thanksBanner: { position: 'absolute', bottom: 30, left: 0, right: 0, paddingVertical: 10, alignItems: 'center' },
  thanksBannerText: { color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 },

  // Footer (fixed at bottom)
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 8, paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#64748b', },
});

// ── Component ─────────────────────────────────────────────────────────────────

interface InvoicePDFProps {
  invoice: Invoice;
  settings?: BusinessSettings | null;
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const brand = getBrandDetails(invoice.sub_brand || '');
  const isRitera = !invoice.sub_brand?.toLowerCase().includes('ratix');
  const logoSrc = getLogo(isRitera ? 'ritera' : 'ratixinfo') || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo'];
  const isGst = invoice.invoice_type !== 'non_gst';

  const cgstRate = invoice.taxable_value > 0
    ? Math.round(invoice.cgst_amount / invoice.taxable_value * 100) : 0;
  const igstRate = invoice.taxable_value > 0
    ? Math.round(invoice.igst_amount / invoice.taxable_value * 100) : 0;

  const clientContacts = [invoice.client?.email, invoice.client?.phone].filter(Boolean).join(' · ');

  return (
    <Document>
      <Page size="A4" style={ps.page}>

        {/* ── A: Header ── */}
        <View style={[ps.header, { backgroundColor: brand.headerBg }]}>
          <View style={ps.headerLeft}>
            {logoSrc && <Image src={logoSrc} style={ps.logo} />}
            <View>
              {isGst ? (
                <>
                  <Text style={ps.headerBrandName}>{BUSINESS.legalName}</Text>
                  <Text style={[ps.headerBrandSub, { color: brand.accentColor }]}>Unit of {brand.brandName}</Text>
                </>
              ) : (
                <>
                  <Text style={ps.headerBrandName}>{brand.brandName}</Text>
                  <Text style={[ps.headerBrandSub, { color: brand.accentColor }]}>{brand.tagline}</Text>
                </>
              )}
            </View>
          </View>
          <View style={ps.headerRight}>
            <Text style={ps.headerContact}>{brand.email}</Text>
            <Text style={ps.headerContact}>{brand.website}</Text>
            <Text style={ps.headerContactLast}>{brand.phone}</Text>
          </View>
        </View>

        {/* ── B: Accent stripe ── */}
        <View style={[ps.stripe, { backgroundColor: brand.accentColor }]} />

        {/* ── Title bar ── */}
        <View style={ps.titleBar}>
          <Text style={[ps.titleText, { color: brand.headerBg }]}>
            {isGst ? 'TAX INVOICE' : 'RECEIPT / INVOICE'}
          </Text>
          <View style={ps.titleMeta}>
            <Text style={ps.metaText}>Invoice No: {invoice.invoice_number}</Text>
            <Text style={ps.metaText}>Date: {dmy(invoice.invoice_date)}</Text>
            {invoice.due_date ? <Text style={ps.metaTextLast}>Due Date: {dmy(invoice.due_date)}</Text> : null}
          </View>
        </View>

        {/* ── Billed By / Billed To ── */}
        <View style={ps.billedRow}>
          <View style={ps.billBoxLeft}>
            <Text style={ps.billLabel}>BILLED BY</Text>
            {isGst ? (
              <>
                <Text style={[ps.billName, { color: brand.headerBg }]}>{BUSINESS.legalName}</Text>
                <Text style={[ps.billUnit, { color: brand.accentColor }]}>(Unit of {brand.brandName})</Text>
              </>
            ) : (
              <Text style={[ps.billName, { color: brand.headerBg }]}>{brand.brandName}</Text>
            )}
            <Text style={ps.billAddr}>{BUSINESS.address}</Text>
            <Text style={ps.billAddr}>{BUSINESS.city}, {BUSINESS.state} - {BUSINESS.pincode}</Text>
            {isGst && <Text style={[ps.billGstin, { color: brand.headerBg }]}>GSTIN: {BUSINESS.gstin}</Text>}
            <Text style={ps.billContact}>{brand.email} · {brand.phone}</Text>
          </View>
          <View style={ps.billBox}>
            <Text style={ps.billLabel}>BILLED TO</Text>
            <Text style={[ps.billName, { color: brand.headerBg }]}>{invoice.client?.name || '\u2014'}</Text>
            {invoice.client?.address ? <Text style={ps.billAddr}>{invoice.client.address}</Text> : null}
            {invoice.client?.state ? <Text style={ps.billAddr}>{invoice.client.state}</Text> : null}
            {invoice.client?.gstin ? <Text style={[ps.billGstin, { color: brand.headerBg }]}>GSTIN: {invoice.client.gstin}</Text> : null}
            {clientContacts ? <Text style={ps.billContact}>{clientContacts}</Text> : null}
          </View>
        </View>

        {/* ── Supply details bar (GST only) ── */}
        {isGst && (
          <View style={ps.supplyBar}>
            <Text style={ps.supplyTextFirst}>Place of Supply: {invoice.place_of_supply}</Text>
            <Text style={ps.supplyText}>
              Tax Type: {invoice.is_igst ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}
            </Text>
          </View>
        )}

        {/* ── Line items table ── */}
        <View style={ps.tableWrap}>
          {isGst ? (
            <>
              <View style={[ps.tableHeader, { backgroundColor: brand.headerBg }]}>
                <Text style={[ps.th, { flex: 1 }]}>Description</Text>
                <Text style={[ps.th, { width: C.hsn, textAlign: 'center' }]}>HSN/SAC</Text>
                <Text style={[ps.th, { width: C.qty, textAlign: 'center' }]}>Qty</Text>
                <Text style={[ps.th, { width: C.rate, textAlign: 'right', paddingRight: 6 }]}>Rate</Text>
                <Text style={[ps.th, { width: C.gst, textAlign: 'center' }]}>GST%</Text>
                {!invoice.is_igst && <Text style={[ps.th, { width: C.cgst, textAlign: 'right' }]}>CGST</Text>}
                <Text style={[ps.th, { width: invoice.is_igst ? C.igst : C.sgst, textAlign: 'right' }]}>
                  {invoice.is_igst ? 'IGST' : 'SGST'}
                </Text>
                <Text style={[ps.th, { width: C.total, textAlign: 'right', paddingRight: 8 }]}>Total</Text>
              </View>
              {(invoice.items || []).map((item, i) => (
                <View key={i} style={i % 2 === 0 ? ps.tableRow : ps.tableRowAlt}>
                  <Text style={[ps.td, { flex: 1 }]}>{item.description}</Text>
                  <Text style={[ps.td, { width: C.hsn, textAlign: 'center' }]}>{item.hsn_sac}</Text>
                  <Text style={[ps.td, { width: C.qty, textAlign: 'center' }]}>{item.quantity} {item.unit}</Text>
                  <Text style={[ps.td, { width: C.rate, textAlign: 'right', paddingRight: 6 }]}>{num(item.rate)}</Text>
                  <Text style={[ps.td, { width: C.gst, textAlign: 'center' }]}>{item.gst_rate}%</Text>
                  {!invoice.is_igst && <Text style={[ps.td, { width: C.cgst, textAlign: 'right' }]}>{num(item.cgst)}</Text>}
                  <Text style={[ps.td, { width: invoice.is_igst ? C.igst : C.sgst, textAlign: 'right' }]}>
                    {num(invoice.is_igst ? item.igst : item.sgst)}
                  </Text>
                  <Text style={[ps.td, { width: C.total, textAlign: 'right', paddingRight: 8 }]}>{num(item.total)}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={[ps.tableHeader, { backgroundColor: brand.headerBg }]}>
                <Text style={[ps.th, { flex: 1 }]}>Description</Text>
                <Text style={[ps.th, { width: CS.qty, textAlign: 'center' }]}>Qty</Text>
                <Text style={[ps.th, { width: CS.unit, textAlign: 'center' }]}>Unit</Text>
                <Text style={[ps.th, { width: CS.rate, textAlign: 'right', paddingRight: 6 }]}>Rate</Text>
                <Text style={[ps.th, { width: CS.amount, textAlign: 'right', paddingRight: 8 }]}>Amount</Text>
              </View>
              {(invoice.items || []).map((item, i) => (
                <View key={i} style={i % 2 === 0 ? ps.tableRow : ps.tableRowAlt}>
                  <Text style={[ps.td, { flex: 1 }]}>{item.description}</Text>
                  <Text style={[ps.td, { width: CS.qty, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[ps.td, { width: CS.unit, textAlign: 'center' }]}>{item.unit}</Text>
                  <Text style={[ps.td, { width: CS.rate, textAlign: 'right', paddingRight: 6 }]}>{num(item.rate)}</Text>
                  <Text style={[ps.td, { width: CS.amount, textAlign: 'right', paddingRight: 8 }]}>{num(item.total)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Summary ── */}
        <View style={ps.summaryOuter}>
          <View style={ps.summaryInner}>
            {isGst && (
              <View style={ps.sumRow}>
                <Text style={ps.sumLabel}>Taxable Value</Text>
                <Text style={ps.sumValue}>{fmt(invoice.taxable_value)}</Text>
              </View>
            )}
            {isGst && !invoice.is_igst && (
              <>
                <View style={ps.sumRow}>
                  <Text style={ps.sumLabel}>CGST {cgstRate}%</Text>
                  <Text style={ps.sumValue}>{fmt(invoice.cgst_amount)}</Text>
                </View>
                <View style={ps.sumRow}>
                  <Text style={ps.sumLabel}>SGST {cgstRate}%</Text>
                  <Text style={ps.sumValue}>{fmt(invoice.sgst_amount)}</Text>
                </View>
              </>
            )}
            {isGst && invoice.is_igst && (
              <View style={ps.sumRow}>
                <Text style={ps.sumLabel}>IGST {igstRate}%</Text>
                <Text style={ps.sumValue}>{fmt(invoice.igst_amount)}</Text>
              </View>
            )}
            <View style={[ps.totalDivider, { borderTopColor: brand.headerBg }]} />
            <View style={ps.totalRow}>
              <Text style={[ps.totalLabel, { color: brand.headerBg }]}>Grand Total</Text>
              <Text style={[ps.totalValue, { color: brand.accentColor }]}>{fmt(invoice.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* ── Amount in words ── */}
        <View style={ps.amountWords}>
          <Text style={ps.amountWordsText}>
            Amount in Words: {amountToWords(invoice.total_amount)} Only
          </Text>
        </View>

        {/* ── Payment details (GST only) ── */}
        {isGst && (
          <View style={ps.paymentBox}>
            <Text style={ps.paymentTitle}>PAYMENT DETAILS</Text>
            <Text style={ps.paymentRow}>Bank: {BUSINESS.bank.name}</Text>
            <Text style={ps.paymentRow}>Account Name: {BUSINESS.bank.accountName}</Text>
            <Text style={ps.paymentRowBold}>Account No: {BUSINESS.bank.accountNumber}</Text>
            <Text style={ps.paymentRow}>IFSC: {BUSINESS.bank.ifsc}</Text>
            <Text style={ps.paymentRowBold}>UPI: {BUSINESS.bank.upi}</Text>
          </View>
        )}

        {/* ── Notes ── */}
        <View style={ps.notesBox}>
          <Text style={ps.notesTitle}>NOTES</Text>
          {invoice.notes ? (
            <Text style={ps.notesContent}>{invoice.notes}</Text>
          ) : null}
          <Text style={ps.notesStd}>This is a computer-generated invoice and does not require a physical signature.</Text>
          <Text style={ps.notesStd}>Subject to jurisdiction of Namakkal courts.</Text>
          <Text style={ps.notesStd}>For any queries: {brand.email}</Text>
        </View>

        {/* ── Thank you banner ── */}
        <View style={[ps.thanksBanner, { backgroundColor: brand.accentColor }]} fixed>
          <Text style={ps.thanksBannerText}>THANK YOU FOR YOUR BUSINESS!</Text>
        </View>

        {/* ── Footer ── */}
        <View style={[ps.footer, { backgroundColor: brand.headerBg }]} fixed>
          <Text style={ps.footerText}>{brand.website}</Text>
          <Text style={ps.footerText}>{brand.email}</Text>
          <Text style={ps.footerText}>{brand.phone}</Text>
        </View>

      </Page>
    </Document>
  );
}
