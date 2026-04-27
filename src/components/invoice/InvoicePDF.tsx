import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
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

// GST invoice columns
const C = { hsn: 55, qty: 30, rate: 65, gst: 38, cgst: 55, sgst: 55, igst: 55, total: 65 };
// Non-GST simplified columns
const CS = { qty: 38, unit: 38, rate: 72, amount: 80 };

const BDR = '#e0e0e0';

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

  const TH = { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: 'white' } as const;
  const TD = { fontSize: 9, color: '#2d2d2d', fontFamily: 'Roboto' } as const;
  const BILL_BOX = {
    flex: 1, borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6,
    paddingVertical: 10, paddingHorizontal: 12,
  } as const;
  const BILL_LABEL = { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#888888', letterSpacing: 1.5, marginBottom: 5 } as const;
  const BILL_NAME  = { fontSize: 12, fontFamily: 'Roboto', fontWeight: 700, color: brand.headerBg } as const;
  const BILL_ADDR  = { fontSize: 9, color: '#444444', marginTop: 2, fontFamily: 'Roboto' } as const;
  const BILL_GSTIN = { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: brand.headerBg, marginTop: 3 } as const;
  const BILL_CONTACT = { fontSize: 9, color: '#666666', marginTop: 2, fontFamily: 'Roboto' } as const;
  const SUM_ROW   = { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8 } as const;
  const SUM_LABEL = { fontSize: 10, color: '#444444', fontFamily: 'Roboto' } as const;
  const SUM_VALUE = { fontSize: 10, color: '#2d2d2d', fontFamily: 'Roboto' } as const;

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Roboto', backgroundColor: 'white', paddingBottom: 72 }}>

        {/* ── A: Header ── */}
        <View style={{
          backgroundColor: brand.headerBg,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingVertical: 16, paddingHorizontal: 32,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {logoSrc && <Image src={logoSrc} style={{ width: 44, height: 44, marginRight: 12 }} />}
            <View>
              {isGst ? (
                <>
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 1 }}>{BUSINESS.legalName}</Text>
                  <Text style={{ color: brand.accentColor, fontSize: 9, letterSpacing: 0.5, marginTop: 3, fontFamily: 'Roboto' }}>Unit of {brand.brandName}</Text>
                </>
              ) : (
                <>
                  <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 1 }}>{brand.brandName}</Text>
                  <Text style={{ color: brand.accentColor, fontSize: 9, letterSpacing: 0.5, marginTop: 3, fontFamily: 'Roboto' }}>{brand.tagline}</Text>
                </>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2, fontFamily: 'Roboto' }}>{brand.email}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2, fontFamily: 'Roboto' }}>{brand.website}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'Roboto' }}>{brand.phone}</Text>
          </View>
        </View>

        {/* ── B: Accent stripe ── */}
        <View style={{ backgroundColor: brand.accentColor, height: 3 }} />

        {/* ── Title bar ── */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingVertical: 12, paddingHorizontal: 32,
          borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', borderBottomStyle: 'solid',
        }}>
          <Text style={{ color: brand.headerBg, fontSize: 14, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 2 }}>
            {isGst ? 'TAX INVOICE' : 'RECEIPT / INVOICE'}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: '#888888', marginBottom: 1, fontFamily: 'Roboto' }}>Invoice No: {invoice.invoice_number}</Text>
            <Text style={{ fontSize: 9, color: '#888888', marginBottom: 1, fontFamily: 'Roboto' }}>Date: {dmy(invoice.invoice_date)}</Text>
            {invoice.due_date ? <Text style={{ fontSize: 9, color: '#888888', fontFamily: 'Roboto' }}>Due Date: {dmy(invoice.due_date)}</Text> : null}
          </View>
        </View>

        {/* ── Billed By / Billed To ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 32, marginTop: 16 }}>
          <View style={[BILL_BOX, { marginRight: 12 }]}>
            <Text style={BILL_LABEL}>BILLED BY</Text>
            {isGst ? (
              <>
                <Text style={BILL_NAME}>{BUSINESS.legalName}</Text>
                <Text style={{ fontSize: 9, color: brand.accentColor, marginTop: 2, fontFamily: 'Roboto' }}>(Unit of {brand.brandName})</Text>
              </>
            ) : (
              <Text style={BILL_NAME}>{brand.brandName}</Text>
            )}
            <Text style={BILL_ADDR}>{BUSINESS.address}</Text>
            <Text style={BILL_ADDR}>{BUSINESS.city}, {BUSINESS.state} - {BUSINESS.pincode}</Text>
            {isGst && <Text style={BILL_GSTIN}>GSTIN: {BUSINESS.gstin}</Text>}
            <Text style={BILL_CONTACT}>{brand.email} · {brand.phone}</Text>
          </View>
          <View style={BILL_BOX}>
            <Text style={BILL_LABEL}>BILLED TO</Text>
            <Text style={BILL_NAME}>{invoice.client?.name || '\u2014'}</Text>
            {invoice.client?.address ? <Text style={BILL_ADDR}>{invoice.client.address}</Text> : null}
            {invoice.client?.state ? <Text style={BILL_ADDR}>{invoice.client.state}</Text> : null}
            {invoice.client?.gstin ? <Text style={BILL_GSTIN}>GSTIN: {invoice.client.gstin}</Text> : null}
            {clientContacts ? <Text style={BILL_CONTACT}>{clientContacts}</Text> : null}
          </View>
        </View>

        {/* ── Supply details bar (GST only) ── */}
        {isGst && (
          <View style={{
            marginHorizontal: 32, marginTop: 12,
            backgroundColor: '#f8f8f8', borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 4,
            paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row',
          }}>
            <Text style={{ fontSize: 9, color: '#444444', marginRight: 24, fontFamily: 'Roboto' }}>Place of Supply: {invoice.place_of_supply}</Text>
            <Text style={{ fontSize: 9, color: '#444444', fontFamily: 'Roboto' }}>
              Tax Type: {invoice.is_igst ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}
            </Text>
          </View>
        )}

        {/* ── Line items table ── */}
        <View style={{ marginHorizontal: 32, marginTop: 12 }}>
          {isGst ? (
            <>
              {/* GST table header */}
              <View style={{
                backgroundColor: brand.headerBg, flexDirection: 'row',
                paddingVertical: 7, paddingLeft: 8, paddingRight: 8,
              }}>
                <Text style={[TH, { flex: 1 }]}>Description</Text>
                <Text style={[TH, { width: C.hsn, textAlign: 'center' }]}>HSN/SAC</Text>
                <Text style={[TH, { width: C.qty, textAlign: 'center' }]}>Qty</Text>
                <Text style={[TH, { width: C.rate, textAlign: 'right', paddingRight: 6 }]}>Rate</Text>
                <Text style={[TH, { width: C.gst, textAlign: 'center' }]}>GST%</Text>
                {!invoice.is_igst && <Text style={[TH, { width: C.cgst, textAlign: 'right' }]}>CGST</Text>}
                <Text style={[TH, { width: invoice.is_igst ? C.igst : C.sgst, textAlign: 'right' }]}>
                  {invoice.is_igst ? 'IGST' : 'SGST'}
                </Text>
                <Text style={[TH, { width: C.total, textAlign: 'right', paddingRight: 8 }]}>Total</Text>
              </View>
              {/* GST item rows */}
              {invoice.items.map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', paddingVertical: 6, paddingLeft: 8, paddingRight: 8,
                  borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid',
                  backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
                }}>
                  <Text style={[TD, { flex: 1 }]}>{item.description}</Text>
                  <Text style={[TD, { width: C.hsn, textAlign: 'center' }]}>{item.hsn_sac}</Text>
                  <Text style={[TD, { width: C.qty, textAlign: 'center' }]}>{item.quantity} {item.unit}</Text>
                  <Text style={[TD, { width: C.rate, textAlign: 'right', paddingRight: 6 }]}>{num(item.rate)}</Text>
                  <Text style={[TD, { width: C.gst, textAlign: 'center' }]}>{item.gst_rate}%</Text>
                  {!invoice.is_igst && <Text style={[TD, { width: C.cgst, textAlign: 'right' }]}>{num(item.cgst)}</Text>}
                  <Text style={[TD, { width: invoice.is_igst ? C.igst : C.sgst, textAlign: 'right' }]}>
                    {num(invoice.is_igst ? item.igst : item.sgst)}
                  </Text>
                  <Text style={[TD, { width: C.total, textAlign: 'right', paddingRight: 8 }]}>{num(item.total)}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              {/* Non-GST simplified table header */}
              <View style={{
                backgroundColor: brand.headerBg, flexDirection: 'row',
                paddingVertical: 7, paddingLeft: 8, paddingRight: 8,
              }}>
                <Text style={[TH, { flex: 1 }]}>Description</Text>
                <Text style={[TH, { width: CS.qty, textAlign: 'center' }]}>Qty</Text>
                <Text style={[TH, { width: CS.unit, textAlign: 'center' }]}>Unit</Text>
                <Text style={[TH, { width: CS.rate, textAlign: 'right', paddingRight: 6 }]}>Rate</Text>
                <Text style={[TH, { width: CS.amount, textAlign: 'right', paddingRight: 8 }]}>Amount</Text>
              </View>
              {/* Non-GST item rows */}
              {invoice.items.map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', paddingVertical: 6, paddingLeft: 8, paddingRight: 8,
                  borderBottomWidth: 0.5, borderBottomColor: '#eeeeee', borderBottomStyle: 'solid',
                  backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
                }}>
                  <Text style={[TD, { flex: 1 }]}>{item.description}</Text>
                  <Text style={[TD, { width: CS.qty, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[TD, { width: CS.unit, textAlign: 'center' }]}>{item.unit}</Text>
                  <Text style={[TD, { width: CS.rate, textAlign: 'right', paddingRight: 6 }]}>{num(item.rate)}</Text>
                  <Text style={[TD, { width: CS.amount, textAlign: 'right', paddingRight: 8 }]}>{num(item.total)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Summary (right-aligned, 50% width) ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 32, marginTop: 8 }}>
          <View style={{ width: '50%' }}>
            {isGst && (
              <View style={SUM_ROW}>
                <Text style={SUM_LABEL}>Taxable Value</Text>
                <Text style={SUM_VALUE}>{fmt(invoice.taxable_value)}</Text>
              </View>
            )}
            {isGst && !invoice.is_igst && (
              <>
                <View style={SUM_ROW}>
                  <Text style={SUM_LABEL}>CGST {cgstRate}%</Text>
                  <Text style={SUM_VALUE}>{fmt(invoice.cgst_amount)}</Text>
                </View>
                <View style={SUM_ROW}>
                  <Text style={SUM_LABEL}>SGST {cgstRate}%</Text>
                  <Text style={SUM_VALUE}>{fmt(invoice.sgst_amount)}</Text>
                </View>
              </>
            )}
            {isGst && invoice.is_igst && (
              <View style={SUM_ROW}>
                <Text style={SUM_LABEL}>IGST {igstRate}%</Text>
                <Text style={SUM_VALUE}>{fmt(invoice.igst_amount)}</Text>
              </View>
            )}
            <View style={{
              borderTopWidth: 1, borderTopColor: brand.headerBg, borderTopStyle: 'solid',
              marginVertical: 4, marginHorizontal: 8,
            }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Roboto', fontWeight: 700, color: brand.headerBg }}>Grand Total</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Roboto', fontWeight: 700, color: brand.accentColor }}>{fmt(invoice.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* ── Amount in words ── */}
        <View style={{ paddingHorizontal: 40, marginTop: 6 }}>
          <Text style={{ fontSize: 9, color: '#666666', fontFamily: 'Roboto' }}>
            Amount in Words: {amountToWords(invoice.total_amount)} Only
          </Text>
        </View>

        {/* ── Payment details (GST only) ── */}
        {isGst && (
          <View style={{
            marginHorizontal: 32, marginTop: 12,
            backgroundColor: '#eff6ff', borderWidth: 0.5, borderColor: '#bfdbfe', borderStyle: 'solid', borderRadius: 6,
            paddingVertical: 10, paddingHorizontal: 12,
          }}>
            <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#1d4ed8', letterSpacing: 1.5, marginBottom: 6 }}>
              PAYMENT DETAILS
            </Text>
            <Text style={{ fontSize: 9, color: '#333333', lineHeight: 1.8, fontFamily: 'Roboto' }}>Bank: {BUSINESS.bank.name}</Text>
            <Text style={{ fontSize: 9, color: '#333333', lineHeight: 1.8, fontFamily: 'Roboto' }}>Account Name: {BUSINESS.bank.accountName}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#333333', lineHeight: 1.8 }}>Account No: {BUSINESS.bank.accountNumber}</Text>
            <Text style={{ fontSize: 9, color: '#333333', lineHeight: 1.8, fontFamily: 'Roboto' }}>IFSC: {BUSINESS.bank.ifsc}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#333333', lineHeight: 1.8 }}>UPI: {BUSINESS.bank.upi}</Text>
          </View>
        )}

        {/* ── Notes ── */}
        <View style={{
          marginHorizontal: 32, marginTop: 12,
          borderWidth: 0.5, borderColor: BDR, borderStyle: 'solid', borderRadius: 6,
          paddingVertical: 10, paddingHorizontal: 12,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: '#888888', letterSpacing: 1, marginBottom: 5 }}>NOTES</Text>
          {invoice.notes ? (
            <Text style={{ fontSize: 10, color: '#444444', marginBottom: 6, fontFamily: 'Roboto' }}>{invoice.notes}</Text>
          ) : null}
          <Text style={{ fontSize: 9, color: '#aaaaaa', fontFamily: 'Roboto', lineHeight: 1.7 }}>
            This is a computer-generated invoice and does not require a physical signature.
          </Text>
          <Text style={{ fontSize: 9, color: '#aaaaaa', fontFamily: 'Roboto', lineHeight: 1.7 }}>
            Subject to jurisdiction of Namakkal courts.
          </Text>
          <Text style={{ fontSize: 9, color: '#aaaaaa', fontFamily: 'Roboto', lineHeight: 1.7 }}>
            For any queries: {brand.email}
          </Text>
        </View>

        {/* ── Thank you banner — pinned just above footer ── */}
        <View style={{
          position: 'absolute', bottom: 30, left: 0, right: 0,
          backgroundColor: brand.accentColor, paddingVertical: 10, alignItems: 'center',
        }} fixed>
          <Text style={{ color: 'white', fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 1.5 }}>
            THANK YOU FOR YOUR BUSINESS!
          </Text>
        </View>

        {/* ── C: Dark footer ── */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: brand.headerBg, paddingVertical: 8, paddingHorizontal: 32,
          flexDirection: 'row', justifyContent: 'space-between',
        }} fixed>
          <Text style={{ fontSize: 8, color: '#64748b', fontFamily: 'Roboto' }}>{brand.website}</Text>
          <Text style={{ fontSize: 8, color: '#64748b', fontFamily: 'Roboto' }}>{brand.email}</Text>
          <Text style={{ fontSize: 8, color: '#64748b', fontFamily: 'Roboto' }}>{brand.phone}</Text>
        </View>

      </Page>
    </Document>
  );
}
