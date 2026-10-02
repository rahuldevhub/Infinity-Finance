import { Document, Page, Text, View, Image, StyleSheet, Svg, Path } from '@react-pdf/renderer';
import type { BusinessSettings, ProformaInvoice } from '../../types';
import { BUSINESS, getBrandDetails } from '../../constants/businessDetails';
import { getLogo, PLACEHOLDER_LOGOS } from '../../utils/logos';
import { amountToWords } from '../../utils/amountToWords';
import { registerPDFFonts } from '../../utils/pdfFonts';

registerPDFFonts();

export interface ProformaTemplateProps {
  proforma: ProformaInvoice;
  businessSettings?: BusinessSettings | null;
  qrSource?: string;
}

const NAVY = '#071f3a';
const SLATE = '#607089';
const LINE = '#dfe6ef';
const SOFT = '#f6f8fb';
const RED = '#ed1c2e';
const RED_SOFT = '#fff3f4';
const PURPLE = '#5f259f';
const PHONEPE_QR = '/assets/payment/phonepe-infinity-qr.jpg';

type IconName = 'document' | 'calendar' | 'tag' | 'mail' | 'globe' | 'phone' | 'bank' | 'qr' | 'notes';

const ICON_PATHS: Record<IconName, string> = {
  document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
  calendar: 'M6 2v4 M18 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M7 13h2 M11 13h2 M15 13h2 M7 17h2 M11 17h2',
  tag: 'M20.6 13.6 11 23.2 1.8 14V4.8h9.2z M7.2 9.2h.1',
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2c3 2.7 4.5 6 4.5 10S15 19.3 12 22c-3-2.7-4.5-6-4.5-10S9 4.7 12 2z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z',
  bank: 'M3 10h18 M5 10v8 M9 10v8 M15 10v8 M19 10v8 M3 18h18 M2 22h20 M12 2 2 7h20z',
  qr: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M9 5h6 M9 19h6 M9 8h3v3H9z M14 8h2v2h-2z M9 13h2v2H9z M13 12h3v3h-3z',
  notes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h1 M11 13h5 M8 17h1 M11 17h5',
};

function PdfIcon({ name, size = 12, color = NAVY }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={ICON_PATHS[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function money(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateValue(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function hyphenatedAmountWords(value: number): string {
  return amountToWords(value).replace(
    /\b(Twenty|Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety) (One|Two|Three|Four|Five|Six|Seven|Eight|Nine)\b/g,
    '$1-$2',
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: NAVY,
    fontFamily: 'Roboto',
    fontSize: 8.2,
    paddingBottom: 51,
  },
  header: {
    height: 75,
    backgroundColor: NAVY,
    paddingHorizontal: 28,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerDense: { height: 66, paddingVertical: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', maxWidth: 345 },
  logo: { width: 47, height: 47, objectFit: 'contain', marginRight: 12 },
  logoDense: { width: 40, height: 40 },
  brandDivider: { width: 0.8, height: 36, backgroundColor: '#ffffff', opacity: 0.55, marginRight: 13 },
  brandDividerDense: { height: 30 },
  brandName: { color: '#ffffff', fontSize: 16.5, fontWeight: 700, letterSpacing: 0.45 },
  brandNameDense: { fontSize: 14.5 },
  tagline: { color: '#eef3f8', fontSize: 8.4, marginTop: 3.5 },
  brandUnderline: { width: 28, height: 2.2, backgroundColor: RED, marginTop: 5 },
  contact: { alignItems: 'flex-start', minWidth: 154 },
  contactLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 4.5 },
  contactIcon: { width: 13, alignItems: 'flex-start' },
  contactText: { color: '#ffffff', fontSize: 7.5 },
  accent: { height: 2.5, backgroundColor: RED },
  body: { paddingHorizontal: 27 },
  titleArea: {
    minHeight: 83,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleAreaDense: { minHeight: 62, paddingVertical: 5 },
  titleBlock: { flex: 1, paddingRight: 18 },
  titleMark: { width: 31, height: 3, borderRadius: 2, backgroundColor: RED, marginBottom: 10 },
  title: { fontSize: 25, fontWeight: 700, letterSpacing: 0.5 },
  titleDense: { fontSize: 22 },
  subtitle: { fontSize: 10.5, color: SLATE, marginTop: 4.5 },
  metadata: { width: 199, borderLeftWidth: 0.8, borderLeftColor: LINE, paddingLeft: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5.2 },
  metaIconFrame: {
    width: 21,
    height: 18,
    borderRadius: 5,
    backgroundColor: SOFT,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: { color: SLATE, fontSize: 7.5, width: 57 },
  metaValue: { flex: 1, fontSize: 8.4, fontWeight: 700 },
  statusPill: {
    backgroundColor: SOFT,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3.3,
    fontSize: 7.6,
    fontWeight: 700,
  },
  billRow: { flexDirection: 'row', marginBottom: 8 },
  billCard: { flex: 1, minHeight: 73, borderWidth: 0.7, borderColor: LINE, borderRadius: 8, padding: 9.5 },
  billCardDense: { minHeight: 56, padding: 6 },
  billCardLeft: { marginRight: 10 },
  sectionLabel: { color: SLATE, fontSize: 7, fontWeight: 700, letterSpacing: 0.75, marginBottom: 5 },
  billName: { fontSize: 11.5, fontWeight: 700, lineHeight: 1.2 },
  billText: { color: SLATE, fontSize: 7.4, marginTop: 3, lineHeight: 1.25 },
  infoPair: { flexDirection: 'row', marginTop: 3 },
  infoLabel: { width: 67, color: SLATE, fontSize: 7.2 },
  infoValue: { flex: 1, color: NAVY, fontSize: 7.3, lineHeight: 1.2 },
  table: { borderWidth: 0.7, borderColor: LINE, borderRadius: 7, overflow: 'hidden', marginBottom: 8 },
  tableHeader: { minHeight: 25, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY },
  tableRow: {
    minHeight: 27,
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 0.6,
    borderTopColor: LINE,
  },
  tableRowDense: { minHeight: 22, paddingVertical: 3.5 },
  tableRowAlt: { backgroundColor: SOFT },
  th: { color: '#ffffff', fontSize: 7, fontWeight: 700 },
  td: { color: '#24364d', fontSize: 7.7, lineHeight: 1.25 },
  index: { width: 25, textAlign: 'center' },
  desc: { flex: 1, paddingRight: 7 },
  qty: { width: 38, textAlign: 'center' },
  unit: { width: 47, textAlign: 'center' },
  rate: { width: 81, textAlign: 'right' },
  amountCol: { width: 87, textAlign: 'right' },
  summaryRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 8 },
  wordsCard: { flex: 1, borderRadius: 8, backgroundColor: RED_SOFT, padding: 12, marginRight: 10, justifyContent: 'center' },
  wordsCardDense: { padding: 8 },
  wordsLabel: { color: RED, fontSize: 7.8, fontWeight: 700, letterSpacing: 0.65 },
  wordsText: { color: NAVY, fontSize: 12.3, fontWeight: 700, lineHeight: 1.32, marginTop: 9 },
  summaryCard: { width: 245, borderWidth: 0.7, borderColor: LINE, borderRadius: 8, overflow: 'hidden' },
  summaryContent: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 5 },
  sumLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4.3 },
  sumLabel: { color: NAVY, fontSize: 7.7 },
  sumValue: { color: NAVY, fontSize: 7.8, fontWeight: 700 },
  discountLabel: { color: RED },
  discountValue: { color: RED },
  totalLine: {
    borderTopWidth: 0.8,
    borderTopColor: '#f2c8cc',
    backgroundColor: RED_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { color: RED, fontSize: 9, fontWeight: 700 },
  totalValue: { color: RED, fontSize: 15.5, fontWeight: 700 },
  payment: { flexDirection: 'row', marginBottom: 8 },
  paymentDense: { marginBottom: 6 },
  bankCard: { flex: 1, borderWidth: 0.7, borderColor: LINE, borderRadius: 8, padding: 12, marginRight: 9 },
  bankCardDense: { padding: 7 },
  paymentHeading: { flexDirection: 'row', alignItems: 'center' },
  sectionIconFrame: { width: 25, height: 25, borderRadius: 6, backgroundColor: SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  paymentTitle: { fontSize: 9.4, fontWeight: 700 },
  paymentIntro: { color: SLATE, fontSize: 7.2, marginTop: 3, marginBottom: 9 },
  paymentIntroDense: { marginBottom: 4 },
  bankPanel: { backgroundColor: SOFT, borderRadius: 6, padding: 8 },
  bankPanelDense: { padding: 5 },
  bankLine: { flexDirection: 'row', marginBottom: 3.7 },
  bankLineDense: { marginBottom: 2.2 },
  bankLabel: { width: 82, color: SLATE, fontSize: 7.1 },
  bankValue: { flex: 1, color: NAVY, fontSize: 7.5, fontWeight: 700 },
  accountNotice: { backgroundColor: '#f4f7fb', borderRadius: 6, padding: 8, marginTop: 7 },
  accountNoticeDense: { padding: 5, marginTop: 4 },
  accountNoticeTitle: { color: NAVY, fontSize: 7.2 },
  accountNoticeText: { color: SLATE, fontSize: 7.1, marginTop: 2.5 },
  qrCard: {
    width: 185,
    borderRadius: 8,
    backgroundColor: RED_SOFT,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 11,
    alignItems: 'center',
  },
  qrCardDense: { width: 175, paddingTop: 6, paddingBottom: 5 },
  qrHeading: { flexDirection: 'row', alignItems: 'center' },
  qrTitle: { color: RED, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5 },
  qrIntro: { color: SLATE, fontSize: 7.1, marginTop: 3, marginBottom: 5 },
  qr: { width: 123, height: 123, objectFit: 'contain' },
  qrDense: { width: 88, height: 88 },
  phonePe: { color: PURPLE, fontSize: 11, fontWeight: 700, marginTop: 4 },
  qrAccount: { color: NAVY, fontSize: 7.3, fontWeight: 700, marginTop: 4 },
  notes: { borderWidth: 0.7, borderColor: LINE, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 10 },
  notesDense: { paddingVertical: 5 },
  notesHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  noteRow: { flexDirection: 'row', marginBottom: 3.4 },
  bullet: { width: 11, color: NAVY, fontSize: 7.3 },
  noteText: { flex: 1, color: '#31445c', fontSize: 7.2, lineHeight: 1.3 },
  footer: {
    position: 'absolute',
    bottom: 5,
    left: 27,
    right: 27,
    height: 40,
    borderTopWidth: 0.8,
    borderTopColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { color: '#33465f', fontSize: 6.5 },
  footerAddress: { color: SLATE, fontSize: 6.1, maxWidth: 210, textAlign: 'center' },
  footerBand: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: NAVY },
  footerAccent: { position: 'absolute', bottom: 0, right: 0, width: 175, height: 4, backgroundColor: RED },
});

const standardNotes = [
  'This is a proforma invoice for advance payment purposes only. It is not a GST tax invoice.',
  'Kindly arrange payment at your earliest convenience to proceed with the work.',
  'A formal GST invoice will be issued upon completion.',
];

export function ProformaTemplateModern({ proforma, qrSource = PHONEPE_QR }: ProformaTemplateProps) {
  const brand = getBrandDetails(proforma.sub_brand || '');
  const isRitera = !proforma.sub_brand?.toLowerCase().includes('ratix');
  const logo = getLogo(isRitera ? 'ritera' : 'ratixinfo') || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo'];
  const clientName = proforma.client?.name || proforma.client_name_override || '—';
  const discountAmount = Number(proforma.discount_amount || 0);
  const subtotal = Number(proforma.taxable_value || 0) + discountAmount;
  const discountLabel = proforma.discount_type === 'percent' && Number(proforma.discount_value || 0) > 0
    ? `Discount (${Number(proforma.discount_value)}%)`
    : 'Discount';
  const cgstRate = Number(proforma.gst_rate || 0) / 2;
  const quotationReference = proforma.quotation?.quotation_number || '';
  const projectReference = proforma.project?.name || proforma.quotation?.title || '';
  const reference = projectReference || quotationReference || '—';
  const referenceDetail = projectReference && quotationReference ? quotationReference : '';
  const supplyState = proforma.client?.state || BUSINESS.state;
  const supplyLabel = proforma.is_igst
    ? `${supplyState} (Inter-state - IGST)`
    : `${supplyState} (Intra-state - CGST + SGST)`;
  const customNote = proforma.notes?.trim();
  const notes = customNote && !standardNotes.some(note => customNote.toLowerCase().includes(note.toLowerCase()))
    ? [customNote, ...standardNotes]
    : standardNotes;
  const lineItems = (proforma.items || []).filter(item => item.description.trim());
  const dense = lineItems.length > 2
    || lineItems.some(item => item.description.length > 70)
    || clientName.length > 55
    || reference.length > 70;

  return (
    <Document
      title={`Proforma Invoice ${proforma.proforma_number || 'Draft'}`}
      author={brand.brandName}
      subject="Advance payment request"
    >
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, dense ? styles.headerDense : {}]} fixed>
          <View style={styles.brandRow}>
            <Image src={logo} style={[styles.logo, dense ? styles.logoDense : {}]} />
            <View style={[styles.brandDivider, dense ? styles.brandDividerDense : {}]} />
            <View>
              <Text style={[styles.brandName, dense ? styles.brandNameDense : {}]}>{brand.brandName.toUpperCase()}</Text>
              <Text style={styles.tagline}>{brand.tagline}</Text>
              <View style={styles.brandUnderline} />
            </View>
          </View>
          <View style={styles.contact}>
            <View style={styles.contactLine}><View style={styles.contactIcon}><PdfIcon name="mail" size={8.5} color="#ffffff" /></View><Text style={styles.contactText}>{brand.email}</Text></View>
            <View style={styles.contactLine}><View style={styles.contactIcon}><PdfIcon name="globe" size={8.5} color="#ffffff" /></View><Text style={styles.contactText}>{brand.website}</Text></View>
            <View style={styles.contactLine}><View style={styles.contactIcon}><PdfIcon name="phone" size={8.5} color="#ffffff" /></View><Text style={styles.contactText}>{brand.phone}</Text></View>
          </View>
        </View>
        <View style={styles.accent} fixed />

        <View style={styles.body}>
          <View style={[styles.titleArea, dense ? styles.titleAreaDense : {}]}>
            <View style={styles.titleBlock}>
              <View style={styles.titleMark} />
              <Text style={[styles.title, dense ? styles.titleDense : {}]}>PROFORMA INVOICE</Text>
              <Text style={styles.subtitle}>Advance payment request</Text>
            </View>
            <View style={styles.metadata}>
              <View style={styles.metaRow}><View style={styles.metaIconFrame}><PdfIcon name="document" size={10} /></View><Text style={styles.metaLabel}>Proforma No.</Text><Text style={styles.metaValue}>{proforma.proforma_number || 'Draft'}</Text></View>
              <View style={styles.metaRow}><View style={styles.metaIconFrame}><PdfIcon name="calendar" size={10} /></View><Text style={styles.metaLabel}>Date</Text><Text style={styles.metaValue}>{dateValue(proforma.date)}</Text></View>
              <View style={styles.metaRow}><View style={styles.metaIconFrame}><PdfIcon name="calendar" size={10} /></View><Text style={styles.metaLabel}>Due Date</Text><Text style={styles.metaValue}>{dateValue(proforma.due_date)}</Text></View>
              <View style={styles.metaRow}><View style={styles.metaIconFrame}><PdfIcon name="tag" size={10} /></View><Text style={styles.metaLabel}>Status</Text><Text style={styles.statusPill}>{proforma.status.toUpperCase()}</Text></View>
            </View>
          </View>

          <View style={styles.billRow} wrap={false}>
            <View style={[styles.billCard, styles.billCardLeft, dense ? styles.billCardDense : {}]}>
              <Text style={styles.sectionLabel}>BILL TO</Text>
              <Text style={styles.billName}>{clientName}</Text>
              {proforma.client?.email ? <Text style={styles.billText}>{proforma.client.email}</Text> : null}
              {proforma.client?.address ? <Text style={styles.billText}>{proforma.client.address}</Text> : null}
              {proforma.client?.gstin ? <Text style={styles.billText}>GSTIN: {proforma.client.gstin}</Text> : null}
            </View>
            <View style={[styles.billCard, dense ? styles.billCardDense : {}]}>
              <Text style={styles.sectionLabel}>PROJECT / REFERENCE</Text>
              <Text style={styles.billName}>{reference}</Text>
              {referenceDetail ? <Text style={styles.billText}>{referenceDetail}</Text> : null}
              <View style={styles.infoPair}><Text style={styles.infoLabel}>Place of Supply</Text><Text style={styles.infoValue}>{supplyLabel}</Text></View>
              <View style={styles.infoPair}><Text style={styles.infoLabel}>Brand</Text><Text style={styles.infoValue}>{brand.brandName}</Text></View>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, styles.index]}>#</Text>
              <Text style={[styles.th, styles.desc]}>DESCRIPTION</Text>
              <Text style={[styles.th, styles.qty]}>QTY</Text>
              <Text style={[styles.th, styles.unit]}>UNIT</Text>
              <Text style={[styles.th, styles.rate]}>RATE (INR)</Text>
              <Text style={[styles.th, styles.amountCol]}>AMOUNT (INR)</Text>
            </View>
            {lineItems.map((item, index) => (
              <View key={`${item.description}-${index}`} style={[styles.tableRow, index % 2 ? styles.tableRowAlt : {}, dense ? styles.tableRowDense : {}]} wrap={false}>
                <Text style={[styles.td, styles.index]}>{index + 1}</Text>
                <Text style={[styles.td, styles.desc]}>{item.description}</Text>
                <Text style={[styles.td, styles.qty]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.unit]}>{item.unit}</Text>
                <Text style={[styles.td, styles.rate]}>{money(item.rate)}</Text>
                <Text style={[styles.td, styles.amountCol]}>{money(item.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryRow} wrap={false}>
            <View style={[styles.wordsCard, dense ? styles.wordsCardDense : {}]}>
              <Text style={styles.wordsLabel}>AMOUNT IN WORDS</Text>
              <Text style={styles.wordsText}>{hyphenatedAmountWords(Number(proforma.total_amount || 0))}</Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryContent}>
                <View style={styles.sumLine}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumValue}>{money(subtotal)}</Text></View>
                <View style={styles.sumLine}><Text style={[styles.sumLabel, styles.discountLabel]}>{discountLabel}</Text><Text style={[styles.sumValue, styles.discountValue]}>{discountAmount > 0 ? '-' : ''}{money(discountAmount)}</Text></View>
                <View style={styles.sumLine}><Text style={styles.sumLabel}>Taxable Value</Text><Text style={styles.sumValue}>{money(proforma.taxable_value)}</Text></View>
                {proforma.include_gst && !proforma.is_igst ? <>
                  <View style={styles.sumLine}><Text style={styles.sumLabel}>CGST @ {cgstRate}%</Text><Text style={styles.sumValue}>{money(proforma.cgst_amount)}</Text></View>
                  <View style={styles.sumLine}><Text style={styles.sumLabel}>SGST @ {cgstRate}%</Text><Text style={styles.sumValue}>{money(proforma.sgst_amount)}</Text></View>
                </> : null}
                {proforma.include_gst && proforma.is_igst ? <View style={styles.sumLine}><Text style={styles.sumLabel}>IGST @ {proforma.gst_rate}%</Text><Text style={styles.sumValue}>{money(proforma.igst_amount)}</Text></View> : null}
              </View>
              <View style={styles.totalLine}><Text style={styles.totalLabel}>TOTAL AMOUNT</Text><Text style={styles.totalValue}>{money(proforma.total_amount)}</Text></View>
            </View>
          </View>

          <View style={[styles.payment, dense ? styles.paymentDense : {}]} wrap={false}>
            <View style={[styles.bankCard, dense ? styles.bankCardDense : {}]}>
              <View style={styles.paymentHeading}>
                <View style={styles.sectionIconFrame}><PdfIcon name="bank" size={14} /></View>
                <View><Text style={styles.paymentTitle}>PAYMENT INFORMATION</Text><Text style={[styles.paymentIntro, dense ? styles.paymentIntroDense : {}]}>Please use the following details for payment</Text></View>
              </View>
              <View style={[styles.bankPanel, dense ? styles.bankPanelDense : {}]}>
                <View style={[styles.bankLine, dense ? styles.bankLineDense : {}]}><Text style={styles.bankLabel}>Account Holder</Text><Text style={styles.bankValue}>INFINITY ENTERPRISES</Text></View>
                <View style={[styles.bankLine, dense ? styles.bankLineDense : {}]}><Text style={styles.bankLabel}>Bank Name</Text><Text style={styles.bankValue}>{BUSINESS.bank.name}</Text></View>
                <View style={[styles.bankLine, dense ? styles.bankLineDense : {}]}><Text style={styles.bankLabel}>Account Number</Text><Text style={styles.bankValue}>{BUSINESS.bank.accountNumber}</Text></View>
                <View style={[styles.bankLine, dense ? styles.bankLineDense : {}]}><Text style={styles.bankLabel}>IFSC Code</Text><Text style={styles.bankValue}>{BUSINESS.bank.ifsc}</Text></View>
                <View style={[styles.bankLine, dense ? styles.bankLineDense : {}]}><Text style={styles.bankLabel}>Branch</Text><Text style={styles.bankValue}>{BUSINESS.bank.branch}</Text></View>
                <View style={[styles.bankLine, dense ? styles.bankLineDense : {}]}><Text style={styles.bankLabel}>Account Type</Text><Text style={styles.bankValue}>{BUSINESS.bank.accountType}</Text></View>
              </View>
              <View style={[styles.accountNotice, dense ? styles.accountNoticeDense : {}]}>
                <Text style={styles.accountNoticeTitle}>Payment account: INFINITY ENTERPRISES</Text>
                <Text style={styles.accountNoticeText}>{brand.brandName} is a business unit of Infinity Enterprises.</Text>
              </View>
            </View>
            <View style={[styles.qrCard, dense ? styles.qrCardDense : {}]}>
              <View style={styles.qrHeading}><PdfIcon name="qr" size={12} color={RED} /><Text style={styles.qrTitle}>  SCAN TO PAY</Text></View>
              <Text style={styles.qrIntro}>Scan this QR to pay via PhonePe</Text>
              <Image src={qrSource} style={[styles.qr, dense ? styles.qrDense : {}]} />
              <Text style={styles.phonePe}>PhonePe</Text>
              <Text style={styles.qrAccount}>INFINITY ENTERPRISES</Text>
            </View>
          </View>

          <View style={[styles.notes, dense ? styles.notesDense : {}]} wrap={false}>
            <View style={styles.notesHeading}><View style={styles.sectionIconFrame}><PdfIcon name="notes" size={13} /></View><Text style={styles.sectionLabel}>NOTES</Text></View>
            {notes.map((note, index) => (
              <View key={`${note}-${index}`} style={styles.noteRow}>
                <Text style={styles.bullet}>•</Text><Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{brand.website}</Text>
          <Text style={styles.footerAddress}>{BUSINESS.address}, {BUSINESS.city}, {BUSINESS.state} - {BUSINESS.pincode}</Text>
          <Text style={styles.footerText}>{brand.email}</Text>
          <Text style={styles.footerText}>{brand.phone}</Text>
        </View>
        <View style={styles.footerBand} fixed />
        <View style={styles.footerAccent} fixed />
      </Page>
    </Document>
  );
}
