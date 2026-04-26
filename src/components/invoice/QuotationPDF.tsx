import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Quotation } from '../../hooks/useQuotations';
import type { BusinessSettings } from '../../types';
import { formatDate } from '../../utils/formatters';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1.5pt solid #1a56db', paddingBottom: 12 },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1a56db' },
  subBrand: { fontSize: 10, color: '#4b5563', marginTop: 2 },
  companyInfo: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  qtnTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'right' },
  qtnLabel: { fontSize: 8, color: '#6b7280', textAlign: 'right' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 },
  twoCol: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  clientName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' },
  value: { fontSize: 8.5, color: '#1f2937', marginBottom: 2 },
  subjectBox: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 4, marginBottom: 12 },
  subjectLabel: { fontSize: 7, color: '#6b7280', marginBottom: 2 },
  subjectText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e40af' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a56db', padding: '5 4', borderRadius: 3 },
  tableRow: { flexDirection: 'row', padding: '4 4', borderBottom: '0.5pt solid #e5e7eb' },
  tableRowAlt: { flexDirection: 'row', padding: '4 4', borderBottom: '0.5pt solid #e5e7eb', backgroundColor: '#f9fafb' },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: 'white' },
  tdText: { fontSize: 8, color: '#374151' },
  col_desc: { flex: 4 },
  col_qty: { flex: 1, textAlign: 'right' },
  col_unit: { flex: 1, textAlign: 'center' },
  col_rate: { flex: 1.5, textAlign: 'right' },
  col_amt: { flex: 1.5, textAlign: 'right' },
  summaryBox: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  summaryInner: { width: 210, backgroundColor: '#f9fafb', borderRadius: 4, padding: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  summaryLabel: { fontSize: 8, color: '#6b7280' },
  summaryValue: { fontSize: 8, color: '#1f2937' },
  summaryDiscountValue: { fontSize: 8, color: '#dc2626' },
  summaryDivider: { borderTop: '0.5pt dashed #d1d5db', marginTop: 3, marginBottom: 3 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTop: '1pt solid #d1d5db', paddingTop: 6, marginTop: 4 },
  summaryTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' },
  summaryTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1a56db' },
  footer: { marginTop: 16, borderTop: '1pt solid #e5e7eb', paddingTop: 10 },
  notesTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 3 },
  notesText: { fontSize: 8, color: '#6b7280', lineHeight: 1.5 },
  termsTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 3, marginTop: 8 },
  // Payment schedule table
  scheduleSection: { marginTop: 14 },
  scheduleHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '4 4', borderRadius: 3, marginTop: 4 },
  scheduleRow: { flexDirection: 'row', padding: '3 4', borderBottom: '0.5pt solid #e5e7eb' },
  scheduleThText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#374151' },
  scheduleTdText: { fontSize: 8, color: '#374151' },
  sch_label: { flex: 2 },
  sch_pct: { flex: 1, textAlign: 'right' },
  sch_amt: { flex: 1.5, textAlign: 'right' },
  sch_milestone: { flex: 2.5, paddingLeft: 8 },
  disclaimer: { marginTop: 16, textAlign: 'center', fontSize: 7, color: '#9ca3af' },
  signArea: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24 },
  signBox: { width: 140, borderTop: '1pt solid #6b7280', paddingTop: 4, textAlign: 'center' },
  signLabel: { fontSize: 7, color: '#6b7280' },
});

interface QuotationPDFProps {
  quotation: Quotation;
  settings: BusinessSettings;
}

export function QuotationPDF({ quotation, settings }: QuotationPDFProps) {
  const fmt = (n: number) => `\u20B9${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const clientName = quotation.client?.name || quotation.client_name_override || '';
  const clientEmail = quotation.client?.email || quotation.client_email_override || '';
  const discountAmt = quotation.discount_amount || 0;
  const itemsSum = quotation.taxable_value + discountAmt; // subtotal before discount

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{settings.gst_name}</Text>
            <Text style={styles.subBrand}>{quotation.sub_brand}</Text>
            <Text style={styles.companyInfo}>{settings.address}</Text>
            <Text style={styles.companyInfo}>{settings.state}</Text>
            {settings.gstin && <Text style={styles.companyInfo}>GSTIN: {settings.gstin}</Text>}
          </View>
          <View>
            <Text style={styles.qtnTitle}>QUOTATION</Text>
            <Text style={styles.qtnLabel}>Ref: {quotation.quotation_number}</Text>
            <Text style={styles.qtnLabel}>Date: {formatDate(quotation.date)}</Text>
            {quotation.valid_until && <Text style={styles.qtnLabel}>Valid Until: {formatDate(quotation.valid_until)}</Text>}
          </View>
        </View>

        {/* Subject */}
        <View style={styles.subjectBox}>
          <Text style={styles.subjectLabel}>SUBJECT</Text>
          <Text style={styles.subjectText}>{quotation.title}</Text>
        </View>

        {/* Client + Prepared By */}
        <View style={[styles.section, styles.twoCol]}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Prepared For</Text>
            <Text style={styles.clientName}>{clientName}</Text>
            {quotation.client?.gstin && <Text style={styles.value}>GSTIN: {quotation.client.gstin}</Text>}
            {quotation.client?.address && <Text style={styles.value}>{quotation.client.address}</Text>}
            {quotation.client?.state && <Text style={styles.value}>{quotation.client.state}</Text>}
            {clientEmail ? <Text style={styles.value}>{clientEmail}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Prepared By</Text>
            <Text style={styles.value}>{quotation.sub_brand}</Text>
            <Text style={styles.value}>{settings.gst_name}</Text>
            {/* Enhancement 1: Consultant */}
            {quotation.consultant_name ? (
              <Text style={[styles.value, { marginTop: 4 }]}>Consultant: {quotation.consultant_name}</Text>
            ) : null}
          </View>
        </View>

        {/* Items Table */}
        <View style={{ marginTop: 4 }}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.col_desc]}>Description</Text>
            <Text style={[styles.thText, styles.col_qty]}>Qty</Text>
            <Text style={[styles.thText, styles.col_unit]}>Unit</Text>
            <Text style={[styles.thText, styles.col_rate]}>Rate</Text>
            <Text style={[styles.thText, styles.col_amt]}>Amount</Text>
          </View>
          {quotation.items.map((item, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tdText, styles.col_desc]}>{item.description}</Text>
              <Text style={[styles.tdText, styles.col_qty]}>{item.quantity}</Text>
              <Text style={[styles.tdText, styles.col_unit]}>{item.unit}</Text>
              <Text style={[styles.tdText, styles.col_rate]}>{fmt(item.rate)}</Text>
              <Text style={[styles.tdText, styles.col_amt]}>{fmt(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryInner}>
            {/* Subtotal (items sum) */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{fmt(itemsSum)}</Text>
            </View>

            {/* Enhancement 2: Discount */}
            {discountAmt > 0 && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {quotation.discount_type === 'percent'
                      ? `Discount (${quotation.discount_value}%)`
                      : 'Discount'}
                  </Text>
                  <Text style={styles.summaryDiscountValue}>-{fmt(discountAmt)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxable Value</Text>
                  <Text style={styles.summaryValue}>{fmt(quotation.taxable_value)}</Text>
                </View>
              </>
            )}

            {/* GST rows */}
            {quotation.include_gst && !quotation.is_igst && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>CGST ({quotation.gst_rate / 2}%)</Text>
                  <Text style={styles.summaryValue}>{fmt(quotation.cgst_amount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>SGST ({quotation.gst_rate / 2}%)</Text>
                  <Text style={styles.summaryValue}>{fmt(quotation.sgst_amount)}</Text>
                </View>
              </>
            )}
            {quotation.include_gst && quotation.is_igst && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>IGST ({quotation.gst_rate}%)</Text>
                <Text style={styles.summaryValue}>{fmt(quotation.igst_amount)}</Text>
              </View>
            )}
            {!quotation.include_gst && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST</Text>
                <Text style={styles.summaryValue}>Not applicable</Text>
              </View>
            )}

            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{fmt(quotation.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {quotation.notes && (
            <>
              <Text style={styles.notesTitle}>Notes</Text>
              <Text style={styles.notesText}>{quotation.notes}</Text>
            </>
          )}
          {quotation.terms && (
            <>
              <Text style={styles.termsTitle}>Terms & Conditions</Text>
              <Text style={styles.notesText}>{quotation.terms}</Text>
            </>
          )}

          {/* Enhancement 3: Payment Schedule */}
          {quotation.payment_schedule && quotation.payment_schedule.length > 0 && (
            <View style={styles.scheduleSection}>
              <Text style={styles.notesTitle}>Payment Schedule</Text>
              <View style={styles.scheduleHeader}>
                <Text style={[styles.scheduleThText, styles.sch_label]}>Installment</Text>
                <Text style={[styles.scheduleThText, styles.sch_pct]}>%</Text>
                <Text style={[styles.scheduleThText, styles.sch_amt]}>Amount</Text>
                <Text style={[styles.scheduleThText, styles.sch_milestone]}>Due / Milestone</Text>
              </View>
              {quotation.payment_schedule.map((item, i) => (
                <View key={i} style={styles.scheduleRow}>
                  <Text style={[styles.scheduleTdText, styles.sch_label]}>{item.label}</Text>
                  <Text style={[styles.scheduleTdText, styles.sch_pct]}>{item.percentage}%</Text>
                  <Text style={[styles.scheduleTdText, styles.sch_amt]}>{fmt(item.amount)}</Text>
                  <Text style={[styles.scheduleTdText, styles.sch_milestone]}>{item.milestone}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.disclaimer}>
          This is a computer-generated quotation. Subject to final approval. Not a tax invoice.
        </Text>

        <View style={styles.signArea}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Authorised Signatory</Text>
            <Text style={[styles.signLabel, { marginTop: 2 }]}>{settings.gst_name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
