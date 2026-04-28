import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { ProformaInvoice, BusinessSettings } from '../../types';
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

const C = { qty: 38, unit: 38, rate: 72, amount: 80 };
const BDR = '#e0e0e0';

// ── All styles at module level — zero inline fontFamily in JSX ────────────────
const ps = StyleSheet.create({
  // Page
  page: { fontFamily: 'Roboto', fontSize: 10, backgroundColor: 'white', paddingBottom: 72 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 32 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, marginRight: 12 },
  headerBrandName: { color: 'white', fontSize: 16, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 1 },
  headerBrandSub: { fontSize: 9, letterSpacing: 0.5, marginTop: 3, fontFamily: 'Roboto' },
  headerRight: { alignItems: 'flex-end' },
  headerContact: { color: '#94a3b8', fontSize: 9, marginBottom: 2, fontFamily: 'Roboto' },
  headerContactLast: { color: '#94a3b8', fontSize: 9, fontFamily: 'Roboto' },

  // Accent stripe
  stripe: { height: 3 },

  // Title bar
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 32, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', borderBottomStyle: 'solid' },
  titleText: { fontSize: 14, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 2 },
  titleMeta: { alignItems: 'flex-end' },
  metaText: { fontSize: 9, color: '#888888', marginBottom: 1, fontFamily: 'Roboto' },
  metaTextLast: { fontSize: 9, color: '#888888', fontFamily: 'Roboto' },

  // Disclaimer
  disclaimerBox: { backgroundColor: '#fef3c7', paddingVertical: 8, paddingHorizontal: 32 },
  disclaimerText: { fontSize: 9, color: '#92400e', fontFamily: 'Roboto' },

  // Bill boxes
  billedRow: { flexDirection: 'row', paddingHorizontal: 32, marginTop: 14 },
  billBox: { flex: 1, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  billBoxLeft: { flex: 1, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12, marginRight: 12 },
  billLabel: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#888888', letterSpacing: 1.5, marginBottom: 5 },
  billName: { fontSize: 12, fontFamily: 'Roboto', fontWeight: 700 },
  billUnit: { fontSize: 9, marginTop: 2, fontFamily: 'Roboto' },
  billAddr: { fontSize: 9, color: '#444444', marginTop: 2, fontFamily: 'Roboto' },
  billGstin: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, marginTop: 3 },
  billContact: { fontSize: 9, color: '#666666', marginTop: 2, fontFamily: 'Roboto' },

  // Table
  tableWrap: { marginHorizontal: 32, marginTop: 14 },
  tableHeader: { flexDirection: 'row', paddingVertical: 7, paddingLeft: 8, paddingRight: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingLeft: 8, paddingRight: 8, borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 6, paddingLeft: 8, paddingRight: 8, borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid', backgroundColor: '#fafafa' },
  th: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: 'white' },
  td: { fontSize: 9, color: '#2d2d2d', fontFamily: 'Roboto' },

  // Summary
  summaryOuter: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 32, marginTop: 8 },
  summaryInner: { width: '50%' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8 },
  sumLabel: { fontSize: 10, color: '#444444', fontFamily: 'Roboto' },
  sumValue: { fontSize: 10, color: '#2d2d2d', fontFamily: 'Roboto' },
  totalDivider: { marginVertical: 4, marginHorizontal: 8, borderTopWidth: 1, borderTopStyle: 'solid' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  totalLabel: { fontSize: 12, fontFamily: 'Roboto', fontWeight: 700 },
  totalValue: { fontSize: 12, fontFamily: 'Roboto', fontWeight: 700 },

  // Amount in words
  amountWords: { paddingHorizontal: 40, marginTop: 6 },
  amountWordsText: { fontSize: 9, color: '#666666', fontFamily: 'Roboto' },

  // Payment details
  paymentBox: { marginHorizontal: 32, marginTop: 12, backgroundColor: '#eff6ff', borderWidth: 0.5, borderColor: '#bfdbfe', borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  paymentTitle: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#1d4ed8', letterSpacing: 1.5, marginBottom: 6 },
  paymentRow: { fontSize: 9, color: '#333333', lineHeight: 1.8, fontFamily: 'Roboto' },
  paymentRowBold: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#333333', lineHeight: 1.8 },

  // Notes
  notesBox: { marginHorizontal: 32, marginTop: 12, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  notesTitle: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#888888', letterSpacing: 1, marginBottom: 5 },
  notesContent: { fontSize: 10, color: '#444444', marginBottom: 6, fontFamily: 'Roboto' },
  notesStd: { fontSize: 9, color: '#aaaaaa', fontFamily: 'Roboto', lineHeight: 1.7 },

  // Thank you banner (fixed above footer)
  thanksBanner: { position: 'absolute', bottom: 30, left: 0, right: 0, paddingVertical: 10, alignItems: 'center' },
  thanksBannerText: { color: 'white', fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 1.5 },

  // Footer (fixed at bottom)
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 8, paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#64748b', fontFamily: 'Roboto' },
});

// ── Component ─────────────────────────────────────────────────────────────────

interface ProformaPDFProps {
  proforma: ProformaInvoice;
  businessSettings?: BusinessSettings | null;
}

export function ProformaPDF({ proforma }: ProformaPDFProps) {
  const brand = getBrandDetails(proforma.sub_brand || '');
  const isRitera = !proforma.sub_brand?.toLowerCase().includes('ratix');
  const logoSrc = getLogo(isRitera ? 'ritera' : 'ratixinfo') || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo'];

  const clientName = proforma.client?.name || proforma.client_name_override || '';
  const clientContacts = [proforma.client?.email, proforma.client?.phone].filter(Boolean).join(' · ');

  const cgstRate = proforma.taxable_value > 0
    ? Math.round(proforma.cgst_amount / proforma.taxable_value * 100) : 0;
  const igstRate = proforma.taxable_value > 0
    ? Math.round(proforma.igst_amount / proforma.taxable_value * 100) : 0;

  return (
    <Document>
      <Page size="A4" style={ps.page}>

        {/* ── A: Header ── */}
        <View style={[ps.header, { backgroundColor: brand.headerBg }]}>
          <View style={ps.headerLeft}>
            {logoSrc && <Image src={logoSrc} style={ps.logo} />}
            <View>
              <Text style={ps.headerBrandName}>{BUSINESS.legalName}</Text>
              <Text style={[ps.headerBrandSub, { color: brand.accentColor }]}>Unit of {brand.brandName}</Text>
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
          <Text style={[ps.titleText, { color: brand.headerBg }]}>PROFORMA INVOICE</Text>
          <View style={ps.titleMeta}>
            <Text style={ps.metaText}>Proforma No: {proforma.proforma_number}</Text>
            <Text style={ps.metaText}>Date: {dmy(proforma.date)}</Text>
            {proforma.due_date ? <Text style={ps.metaTextLast}>Due: {dmy(proforma.due_date)}</Text> : null}
          </View>
        </View>

        {/* ── Disclaimer ── */}
        <View style={ps.disclaimerBox}>
          <Text style={ps.disclaimerText}>
            {'\u26A0  This is a proforma invoice for advance payment only. This is NOT a GST tax invoice.'}
          </Text>
        </View>

        {/* ── Billed By / Billed To ── */}
        <View style={ps.billedRow}>
          <View style={ps.billBoxLeft}>
            <Text style={ps.billLabel}>BILLED BY</Text>
            <Text style={[ps.billName, { color: brand.headerBg }]}>{BUSINESS.legalName}</Text>
            <Text style={[ps.billUnit, { color: brand.accentColor }]}>(Unit of {brand.brandName})</Text>
            <Text style={ps.billAddr}>{BUSINESS.address}</Text>
            <Text style={ps.billAddr}>{BUSINESS.city}, {BUSINESS.state} - {BUSINESS.pincode}</Text>
            <Text style={[ps.billGstin, { color: brand.headerBg }]}>GSTIN: {BUSINESS.gstin}</Text>
            <Text style={ps.billContact}>{brand.email} · {brand.phone}</Text>
          </View>
          <View style={ps.billBox}>
            <Text style={ps.billLabel}>BILLED TO</Text>
            <Text style={[ps.billName, { color: brand.headerBg }]}>{clientName || '\u2014'}</Text>
            {proforma.client?.address ? <Text style={ps.billAddr}>{proforma.client.address}</Text> : null}
            {proforma.client?.state ? <Text style={ps.billAddr}>{proforma.client.state}</Text> : null}
            {proforma.client?.gstin ? <Text style={[ps.billGstin, { color: brand.headerBg }]}>GSTIN: {proforma.client.gstin}</Text> : null}
            {clientContacts ? <Text style={ps.billContact}>{clientContacts}</Text> : null}
          </View>
        </View>

        {/* ── Line items table ── */}
        <View style={ps.tableWrap}>
          <View style={[ps.tableHeader, { backgroundColor: brand.headerBg }]}>
            <Text style={[ps.th, { flex: 1 }]}>Description</Text>
            <Text style={[ps.th, { width: C.qty, textAlign: 'center' }]}>Qty</Text>
            <Text style={[ps.th, { width: C.unit, textAlign: 'center' }]}>Unit</Text>
            <Text style={[ps.th, { width: C.rate, textAlign: 'right', paddingRight: 6 }]}>Rate</Text>
            <Text style={[ps.th, { width: C.amount, textAlign: 'right', paddingRight: 8 }]}>Amount</Text>
          </View>
          {(proforma.items || []).filter(i => i.description.trim()).map((item, i) => (
            <View key={i} style={i % 2 === 0 ? ps.tableRow : ps.tableRowAlt}>
              <Text style={[ps.td, { flex: 1 }]}>{item.description}</Text>
              <Text style={[ps.td, { width: C.qty, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[ps.td, { width: C.unit, textAlign: 'center' }]}>{item.unit}</Text>
              <Text style={[ps.td, { width: C.rate, textAlign: 'right', paddingRight: 6 }]}>{num(item.rate)}</Text>
              <Text style={[ps.td, { width: C.amount, textAlign: 'right', paddingRight: 8 }]}>{num(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── Summary ── */}
        <View style={ps.summaryOuter}>
          <View style={ps.summaryInner}>
            <View style={ps.sumRow}>
              <Text style={ps.sumLabel}>Subtotal</Text>
              <Text style={ps.sumValue}>{fmt(proforma.taxable_value)}</Text>
            </View>
            {proforma.include_gst && !proforma.is_igst && (
              <>
                <View style={ps.sumRow}>
                  <Text style={ps.sumLabel}>CGST {cgstRate}%</Text>
                  <Text style={ps.sumValue}>{fmt(proforma.cgst_amount)}</Text>
                </View>
                <View style={ps.sumRow}>
                  <Text style={ps.sumLabel}>SGST {cgstRate}%</Text>
                  <Text style={ps.sumValue}>{fmt(proforma.sgst_amount)}</Text>
                </View>
              </>
            )}
            {proforma.include_gst && proforma.is_igst && (
              <View style={ps.sumRow}>
                <Text style={ps.sumLabel}>IGST {igstRate}%</Text>
                <Text style={ps.sumValue}>{fmt(proforma.igst_amount)}</Text>
              </View>
            )}
            <View style={[ps.totalDivider, { borderTopColor: brand.headerBg }]} />
            <View style={ps.totalRow}>
              <Text style={[ps.totalLabel, { color: brand.headerBg }]}>Total</Text>
              <Text style={[ps.totalValue, { color: brand.accentColor }]}>{fmt(proforma.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* ── Amount in words ── */}
        <View style={ps.amountWords}>
          <Text style={ps.amountWordsText}>
            Amount in Words: {amountToWords(proforma.total_amount)} Only
          </Text>
        </View>

        {/* ── Payment details ── */}
        <View style={ps.paymentBox}>
          <Text style={ps.paymentTitle}>PAYMENT DETAILS</Text>
          <Text style={ps.paymentRow}>Bank: {BUSINESS.bank.name}</Text>
          <Text style={ps.paymentRow}>Account Name: {BUSINESS.bank.accountName}</Text>
          <Text style={ps.paymentRowBold}>Account No: {BUSINESS.bank.accountNumber}</Text>
          <Text style={ps.paymentRow}>IFSC: {BUSINESS.bank.ifsc}</Text>
          <Text style={ps.paymentRowBold}>UPI: {BUSINESS.bank.upi}</Text>
        </View>

        {/* ── Notes ── */}
        <View style={ps.notesBox}>
          <Text style={ps.notesTitle}>NOTES</Text>
          {proforma.notes ? (
            <Text style={ps.notesContent}>{proforma.notes}</Text>
          ) : null}
          <Text style={ps.notesStd}>This proforma is valid for 15 days from the date of issue.</Text>
          <Text style={ps.notesStd}>This is NOT a GST tax invoice and cannot be used for input tax credit.</Text>
          <Text style={ps.notesStd}>For any queries: {brand.email}</Text>
        </View>

        {/* ── Thank you banner ── */}
        <View style={[ps.thanksBanner, { backgroundColor: brand.accentColor }]} fixed>
          <Text style={ps.thanksBannerText}>PLEASE PROCESS PAYMENT TO INITIATE YOUR PROJECT!</Text>
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
