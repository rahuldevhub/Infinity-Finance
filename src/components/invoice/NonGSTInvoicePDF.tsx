import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Invoice, BusinessSettings } from '../../types';
import { registerPDFFonts } from '../../utils/pdfFonts';
registerPDFFonts();
import { getLogo, PLACEHOLDER_LOGOS } from '../../utils/logos';
import { BUSINESS, getBrandDetails } from '../../constants/businessDetails';
import { amountToWords } from '../../utils/amountToWords';

// ── Helpers ──────────────────────────────────────────────────────────────────

function dmy(s?: string | null): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmt(n: number): string {
  const v = Math.round(n * 100) / 100;
  return 'INR ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAD = 44;
const BDR = '#e0e0e0';
const DARK = '#1a1a2e';
const MUTED = '#888888';

// Table column widths (content area ≈ 507pt; rows have paddingHorizontal: 10)
const C = { qty: 38, unit: 38, rate: 70, amount: 75 };

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Roboto', color: DARK, backgroundColor: 'white', paddingBottom: 72 },
  stripe: { height: 4 },

  titleBar: {
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1, borderBottomColor: BDR, borderBottomStyle: 'solid',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: PAD, paddingVertical: 10,
  },
  titleText: { color: DARK, fontSize: 14, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 2 },
  titleMeta: { fontSize: 9, color: MUTED, textAlign: 'right', marginBottom: 1 },

  billingBox: { flex: 1, borderWidth: 1, borderColor: BDR, borderStyle: 'solid', padding: 10 },
  billingLabel: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: MUTED, letterSpacing: 1.5, marginBottom: 5 },
  billingName: { fontSize: 12, fontFamily: 'Roboto', fontWeight: 700, color: DARK },
  billingAddr: { fontSize: 9, color: '#444444', marginTop: 2 },
  billingContact: { fontSize: 9, color: '#666666', marginTop: 2 },

  th: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: 'white' },
  td: { fontSize: 9, color: '#2d2d2d' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 10, color: '#444444' },
  summaryValue: { fontSize: 10, color: '#2d2d2d' },

  paymentBox: {
    flex: 13,
    backgroundColor: '#eff6ff',
    borderWidth: 1, borderColor: '#bfdbfe', borderStyle: 'solid',
    padding: 10,
  },
  paymentLabel: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#1d4ed8', letterSpacing: 1.5, marginBottom: 6 },
  paymentRow: { fontSize: 9, color: '#2d2d2d', marginBottom: 3 },
  paymentRowBold: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#2d2d2d', marginBottom: 3 },

  signBox: {
    flex: 10,
    borderWidth: 1, borderColor: BDR, borderStyle: 'solid',
    padding: 10, minHeight: 70,
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderTopColor: BDR, borderTopStyle: 'solid',
    paddingHorizontal: PAD, paddingVertical: 8, backgroundColor: 'white',
  },
  footerText: { fontSize: 8, color: MUTED },
  footerNote: { fontSize: 8, color: '#aaaaaa', fontFamily: 'Roboto', textAlign: 'center', marginTop: 3 },
});

// ── Component ─────────────────────────────────────────────────────────────────

interface NonGSTInvoicePDFProps {
  invoice: Invoice;
  settings?: BusinessSettings | null;
}

export function NonGSTInvoicePDF({ invoice }: NonGSTInvoicePDFProps) {
  const brand = getBrandDetails(invoice.sub_brand || '');
  const isRitera = !invoice.sub_brand?.toLowerCase().includes('ratix');
  const logoSrc = getLogo(isRitera ? 'ritera' : 'ratixinfo') || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo'];

  const clientContacts = [invoice.client?.email, invoice.client?.phone].filter(Boolean).join(' · ');

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── SECTION 1: Header — brand name directly, no GSTIN ── */}
        <View style={{
          backgroundColor: brand.headerBg,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingHorizontal: PAD, paddingTop: 20, paddingBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {logoSrc && <Image src={logoSrc} style={{ width: 52, height: 52, marginRight: 12 }} />}
            <View>
              <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Roboto', fontWeight: 700 }}>{brand.brandName.toUpperCase()}</Text>
              <Text style={{ color: brand.accentColor, fontSize: 9, marginTop: 2 }}>{brand.tagline}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#cccccc', fontSize: 9, marginBottom: 2, textAlign: 'right' }}>{brand.email}</Text>
            <Text style={{ color: '#cccccc', fontSize: 9, marginBottom: 2, textAlign: 'right' }}>{brand.website}</Text>
            <Text style={{ color: '#cccccc', fontSize: 9, textAlign: 'right' }}>{brand.phone}</Text>
          </View>
        </View>

        {/* ── SECTION 2: Accent stripe ── */}
        <View style={[s.stripe, { backgroundColor: brand.accentColor }]} />

        {/* ── SECTION 3: Title bar ── */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>RECEIPT / INVOICE</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titleMeta}>Invoice No: {invoice.invoice_number}</Text>
            <Text style={s.titleMeta}>Date: {dmy(invoice.invoice_date)}</Text>
          </View>
        </View>

        {/* ── SECTION 4: Billed By / Billed To — no GSTIN for either ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: PAD, marginTop: 16 }}>
          <View style={[s.billingBox, { marginRight: 12 }]}>
            <Text style={s.billingLabel}>BILLED BY</Text>
            <Text style={s.billingName}>{brand.brandName}</Text>
            <Text style={s.billingAddr}>{BUSINESS.address}</Text>
            <Text style={s.billingAddr}>{BUSINESS.city}, {BUSINESS.state} - {BUSINESS.pincode}</Text>
            <Text style={s.billingContact}>{brand.email} · {brand.phone}</Text>
          </View>
          <View style={s.billingBox}>
            <Text style={s.billingLabel}>BILLED TO</Text>
            <Text style={s.billingName}>{invoice.client?.name || ''}</Text>
            {invoice.client?.address && <Text style={s.billingAddr}>{invoice.client.address}</Text>}
            {invoice.client?.state && <Text style={s.billingAddr}>{invoice.client.state}</Text>}
            {clientContacts ? <Text style={s.billingContact}>{clientContacts}</Text> : null}
          </View>
        </View>

        {/* ── SECTION 5: Line items table ── */}
        <View style={{ marginHorizontal: PAD, marginTop: 16 }}>
          {/* Header row */}
          <View style={{ backgroundColor: DARK, flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10 }}>
            <Text style={[s.th, { flex: 1 }]}>Description</Text>
            <Text style={[s.th, { width: C.qty, textAlign: 'center' }]}>Qty</Text>
            <Text style={[s.th, { width: C.unit, textAlign: 'center' }]}>Unit</Text>
            <Text style={[s.th, { width: C.rate, textAlign: 'right' }]}>Rate</Text>
            <Text style={[s.th, { width: C.amount, textAlign: 'right' }]}>Amount</Text>
          </View>
          {/* Item rows */}
          {invoice.items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10,
                borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid',
                backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
              }}
            >
              <Text style={[s.td, { flex: 1 }]}>{item.description}</Text>
              <Text style={[s.td, { width: C.qty, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[s.td, { width: C.unit, textAlign: 'center' }]}>{item.unit}</Text>
              <Text style={[s.td, { width: C.rate, textAlign: 'right' }]}>{fmt(item.rate)}</Text>
              <Text style={[s.td, { width: C.amount, textAlign: 'right' }]}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* ── SECTION 6: Summary ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: PAD, marginTop: 8 }}>
          <View style={{ width: '40%' }}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Subtotal</Text>
              <Text style={s.summaryValue}>{fmt(invoice.taxable_value)}</Text>
            </View>
            <View style={{
              borderTopWidth: 1, borderTopColor: DARK, borderTopStyle: 'solid',
              marginTop: 3, paddingTop: 5,
              flexDirection: 'row', justifyContent: 'space-between',
            }}>
              <Text style={{ fontSize: 12, fontFamily: 'Roboto', fontWeight: 700, color: DARK }}>Grand Total</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Roboto', fontWeight: 700, color: brand.accentColor }}>{fmt(invoice.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* ── SECTION 7: Amount in words ── */}
        <View style={{ paddingHorizontal: PAD, marginTop: 5 }}>
          <Text style={{ fontSize: 9, color: '#666666', fontFamily: 'Roboto' }}>
            Amount in Words: {amountToWords(invoice.total_amount)}
          </Text>
        </View>

        {/* ── SECTION 8: Payment details + Signature ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: PAD, marginTop: 16 }}>
          <View style={[s.paymentBox, { marginRight: 12 }]}>
            <Text style={s.paymentLabel}>PAYMENT DETAILS</Text>
            <Text style={s.paymentRow}>Bank: {BUSINESS.bank.name}</Text>
            <Text style={s.paymentRow}>Account Name: {BUSINESS.bank.accountName}</Text>
            <Text style={s.paymentRowBold}>Account No: {BUSINESS.bank.accountNumber}</Text>
            <Text style={s.paymentRow}>IFSC: {BUSINESS.bank.ifsc}</Text>
            <Text style={s.paymentRowBold}>UPI: {BUSINESS.bank.upi}</Text>
          </View>
          <View style={s.signBox}>
            <Text style={{ fontSize: 9, color: MUTED }}>For {brand.brandName}</Text>
            <View style={{ height: 30 }} />
            <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: DARK }}>Authorised Signatory</Text>
            <Text style={{ fontSize: 8, color: MUTED, fontFamily: 'Roboto' }}>Original for Recipient</Text>
          </View>
        </View>

        {/* ── SECTION 9: Notes ── */}
        {invoice.notes ? (
          <View style={{ paddingHorizontal: PAD, marginTop: 12 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: MUTED, marginBottom: 3 }}>Notes</Text>
            <Text style={{ fontSize: 9, color: '#444444', lineHeight: 1.6 }}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ── SECTION 10: Disclaimer ── */}
        <View style={{
          marginHorizontal: PAD, marginTop: 12,
          backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderStyle: 'solid',
          paddingHorizontal: 12, paddingVertical: 8,
        }}>
          <Text style={{ fontSize: 8, color: '#92400e', fontFamily: 'Roboto', textAlign: 'center' }}>
            This is not a GST tax invoice and cannot be used for input tax credit.
          </Text>
        </View>

        {/* ── SECTION 11: Footer (fixed) ── */}
        <View style={s.footer} fixed>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={s.footerText}>{brand.website}</Text>
            <Text style={s.footerText}>{brand.email}</Text>
            <Text
              style={s.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
          <Text style={s.footerNote}>
            This is a computer-generated document and does not require a physical signature.
          </Text>
        </View>

      </Page>
    </Document>
  );
}
