import { Document, Page, View, Text, Image, StyleSheet, Svg, Path, Circle, Rect } from '@react-pdf/renderer';
import type { PaymentReceipt, Client } from '../../types';
import { getBrandDetails } from '../../constants/businessDetails';
import { getLogo, PLACEHOLDER_LOGOS } from '../../utils/logos';
import { amountToWords } from '../../utils/amountToWords';
import { registerPDFFonts } from '../../utils/pdfFonts';

registerPDFFonts();

interface ReceiptTemplateProps {
  receipt: PaymentReceipt;
  client?: Client | null;
}

const NAVY = '#0b1f3a';
const SLATE = '#607089';
const LINE = '#e5eaf0';
const SOFT = '#f6f8fb';
const GREEN = '#159b69';
const GREEN_SOFT = '#eaf8f2';

function formatAmount(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateFrom(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNumericDate(value: string): string {
  return dateFrom(value)?.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '-';
}

function formatLongDate(value: string): string {
  return dateFrom(value)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) ?? '-';
}

const PAYMENT_MODES: Record<string, string> = {
  upi: 'UPI', bank: 'Bank Transfer', cash: 'Cash', card: 'Card', razorpay: 'Razorpay', cheque: 'Cheque',
};

function paymentMode(value: string): string {
  if (!value) return '-';
  return PAYMENT_MODES[value.toLowerCase()] ?? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
}

type IconName = 'document' | 'calendar' | 'user' | 'card' | 'hash' | 'note' | 'check' | 'heart' | 'mail' | 'web' | 'phone';

function Icon({ name, color = NAVY, size = 15 }: { name: IconName; color?: string; size?: number }) {
  if (name === 'check') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="11" fill={GREEN} /><Path d="M7 12.5l3.2 3.2L17.5 8.5" fill="none" stroke="#ffffff" strokeWidth="2.2" /></Svg>;
  if (name === 'heart') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 20s-7-4.2-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.8-7 10-7 10z" fill={color} /></Svg>;
  if (name === 'calendar') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke={color} strokeWidth="1.8" /><Path d="M8 3v4M16 3v4M4 9h16M8 13h2M14 13h2M8 17h2" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
  if (name === 'user') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="8" r="4" fill="none" stroke={color} strokeWidth="1.8" /><Path d="M4.5 21c.7-5 3.2-7 7.5-7s6.8 2 7.5 7" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
  if (name === 'card') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke={color} strokeWidth="1.8" /><Path d="M3 9h18M7 15h4" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
  if (name === 'hash') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 3L7 21M17 3l-2 18M4 9h17M3 15h17" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
  if (name === 'mail') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke={color} strokeWidth="1.8" /><Path d="M4 7l8 6 8-6" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
  if (name === 'web') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="1.8" /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke={color} strokeWidth="1.4" /></Svg>;
  if (name === 'phone') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M6 3l4 4-2 3c1.5 3 3 4.5 6 6l3-2 4 4-2 3C10 21 3 14 3 5z" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7" fill="none" stroke={color} strokeWidth="1.8" /></Svg>;
}

function IconTile({ name, accent }: { name: IconName; accent?: string }) {
  return <View style={styles.iconTile}><Icon name={name} color={accent ?? NAVY} size={17} /></View>;
}

function DetailCell({ icon, label, value, right, bottom }: { icon: IconName; label: string; value: string; right?: boolean; bottom?: boolean }) {
  return (
    <View style={[styles.detailCell, right ? {} : styles.detailCellBorderRight, bottom ? {} : styles.detailCellBorderBottom]}>
      <IconTile name={icon} />
      <View style={styles.detailCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.detailValue}>{value || '-'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: NAVY, fontFamily: 'Roboto', paddingBottom: 50 },
  header: { height: 94, backgroundColor: NAVY, paddingHorizontal: 30, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAccent: { height: 2.5 },
  brandRow: { flexDirection: 'row', alignItems: 'center', maxWidth: 330 },
  logo: { width: 48, height: 48, objectFit: 'contain', marginRight: 13 },
  brandDivider: { width: 0.7, height: 38, backgroundColor: '#ffffff', opacity: 0.55, marginRight: 13 },
  brandName: { color: '#ffffff', fontSize: 17, fontWeight: 700, letterSpacing: 0.4 },
  tagline: { color: '#d7dfeb', fontSize: 8.5, marginTop: 4 },
  contactBlock: { width: 178 },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  contactText: { color: '#eef3f8', fontSize: 7.8, marginLeft: 7 },
  content: { paddingHorizontal: 28 },
  titleArea: { height: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleAccent: { width: 28, height: 3, borderRadius: 2, marginBottom: 11 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline' },
  titleStrong: { fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: 0.8 },
  titleLight: { fontSize: 24, color: SLATE, marginLeft: 9, letterSpacing: 0.8 },
  subtitle: { fontSize: 10.5, color: SLATE, marginTop: 7 },
  meta: { width: 160, borderLeftWidth: 0.8, borderLeftColor: LINE, paddingLeft: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metaCopy: { marginLeft: 9 },
  metaLabel: { color: SLATE, fontSize: 7.5 },
  metaValue: { color: NAVY, fontSize: 10, fontWeight: 700, marginTop: 2 },
  hero: { minHeight: 112, borderRadius: 10, padding: 18, flexDirection: 'row', alignItems: 'stretch' },
  heroAmount: { flex: 1, paddingRight: 16, justifyContent: 'center' },
  heroLabel: { fontSize: 8.5, fontWeight: 700, letterSpacing: 1, marginBottom: 7 },
  amount: { fontSize: 34, fontWeight: 700, letterSpacing: -0.8 },
  amountWords: { fontSize: 9.2, color: SLATE, marginTop: 6, lineHeight: 1.35 },
  heroDivider: { width: 0.8, backgroundColor: '#e6dadd', marginRight: 16 },
  statusCard: { width: 154, borderRadius: 8, padding: 14, justifyContent: 'center' },
  statusHeading: { flexDirection: 'row', alignItems: 'center' },
  statusTitle: { fontSize: 15, fontWeight: 700, marginLeft: 8 },
  statusText: { fontSize: 8.4, lineHeight: 1.45, color: SLATE, marginTop: 8 },
  customer: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginTop: 10 },
  iconTile: { width: 34, height: 34, borderRadius: 8, backgroundColor: SOFT, alignItems: 'center', justifyContent: 'center' },
  customerCopy: { marginLeft: 12, flex: 1 },
  label: { color: SLATE, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.7 },
  customerName: { color: NAVY, fontSize: 18, fontWeight: 700, marginTop: 4 },
  customerExtra: { color: SLATE, fontSize: 8, marginTop: 3 },
  details: { height: 122, borderWidth: 0.7, borderColor: LINE, borderRadius: 9, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', flex: 1 },
  detailCell: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  detailCellBorderRight: { borderRightWidth: 0.7, borderRightColor: LINE },
  detailCellBorderBottom: { borderBottomWidth: 0.7, borderBottomColor: LINE },
  detailCopy: { flex: 1, marginLeft: 11 },
  detailValue: { color: NAVY, fontSize: 11.5, fontWeight: 700, marginTop: 4 },
  notes: { minHeight: 86, flexDirection: 'row', paddingTop: 17, paddingHorizontal: 2 },
  notesCopy: { flex: 1, marginLeft: 12 },
  notesHeading: { fontSize: 10, fontWeight: 700, color: NAVY },
  customNote: { fontSize: 8.8, color: NAVY, marginTop: 7, lineHeight: 1.4 },
  legalNote: { fontSize: 7.8, color: SLATE, marginTop: 4, lineHeight: 1.35 },
  thanks: { minHeight: 66, borderRadius: 9, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  heartTile: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  thanksCopy: { marginLeft: 16 },
  thanksLabel: { fontSize: 8, fontWeight: 700, letterSpacing: 0.8 },
  thanksTitle: { fontSize: 15, fontWeight: 700, color: NAVY, marginTop: 4 },
  thanksText: { fontSize: 8.5, color: SLATE, marginTop: 3 },
  footer: { position: 'absolute', bottom: 0, left: 28, right: 28, height: 43, borderTopWidth: 0.8, borderTopColor: LINE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 7.5, color: '#33465f', marginLeft: 6 },
  footerAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
});

export function ReceiptTemplateModern({ receipt, client }: ReceiptTemplateProps) {
  const brand = getBrandDetails(receipt.sub_brand);
  const isRitera = !receipt.sub_brand?.toLowerCase().includes('ratix');
  const logo = getLogo(isRitera ? 'ritera' : 'ratixinfo') || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo'];
  const accent = brand.accentColor;
  const softAccent = isRitera ? '#fff5f6' : '#eff6ff';
  const clientName = client?.name || receipt.client?.name || receipt.client_name_override || '-';
  const clientExtra = client?.address || receipt.client?.address || client?.email || receipt.client?.email || '';
  const amount = Number(receipt.amount_received || 0);
  const isPaid = !receipt.is_void;
  const clientNameSize = clientName.length > 38 ? 14 : clientName.length > 28 ? 16 : 18;

  return (
    <Document title={`Payment Receipt ${receipt.receipt_number}`} author={brand.brandName} subject="Payment receipt">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image src={logo} style={styles.logo} />
            <View style={styles.brandDivider} />
            <View><Text style={styles.brandName}>{brand.brandName.toUpperCase()}</Text><Text style={styles.tagline}>{brand.tagline}</Text></View>
          </View>
          <View style={styles.contactBlock}>
            <View style={styles.contactRow}><Icon name="mail" color="#ffffff" size={12} /><Text style={styles.contactText}>{brand.email}</Text></View>
            <View style={styles.contactRow}><Icon name="web" color="#ffffff" size={12} /><Text style={styles.contactText}>{brand.website}</Text></View>
            <View style={styles.contactRow}><Icon name="phone" color="#ffffff" size={12} /><Text style={styles.contactText}>{brand.phone}</Text></View>
          </View>
        </View>
        <View style={[styles.headerAccent, { backgroundColor: accent }]} />

        <View style={styles.content}>
          <View style={styles.titleArea}>
            <View><View style={[styles.titleAccent, { backgroundColor: accent }]} /><View style={styles.titleRow}><Text style={styles.titleStrong}>PAYMENT</Text><Text style={styles.titleLight}>RECEIPT</Text></View><Text style={styles.subtitle}>Thank you for your payment</Text></View>
            <View style={styles.meta}>
              <View style={styles.metaRow}><IconTile name="document" /><View style={styles.metaCopy}><Text style={styles.metaLabel}>Receipt No.</Text><Text style={styles.metaValue}>{receipt.receipt_number}</Text></View></View>
              <View style={styles.metaRow}><IconTile name="calendar" /><View style={styles.metaCopy}><Text style={styles.metaLabel}>Date</Text><Text style={styles.metaValue}>{formatLongDate(receipt.date)}</Text></View></View>
            </View>
          </View>

          <View style={[styles.hero, { backgroundColor: softAccent }]}>
            <View style={styles.heroAmount}><Text style={[styles.heroLabel, { color: accent }]}>PAYMENT RECEIVED</Text><Text style={[styles.amount, { color: accent }]}>₹{formatAmount(amount)}</Text><Text style={styles.amountWords}>{amountToWords(amount)}</Text></View>
            <View style={styles.heroDivider} />
            <View style={[styles.statusCard, { backgroundColor: isPaid ? GREEN_SOFT : '#fff0f0' }]}>
              <View style={styles.statusHeading}>{isPaid ? <Icon name="check" size={23} /> : <Icon name="document" color={accent} size={21} />}<Text style={[styles.statusTitle, { color: isPaid ? GREEN : accent }]}>{isPaid ? 'PAID' : 'VOID'}</Text></View>
              <Text style={styles.statusText}>{isPaid ? 'Payment successfully received and recorded.' : `This receipt has been voided.${receipt.void_reason ? ` ${receipt.void_reason}` : ''}`}</Text>
            </View>
          </View>

          <View style={styles.customer}><IconTile name="user" /><View style={styles.customerCopy}><Text style={styles.label}>RECEIVED FROM</Text><Text style={[styles.customerName, { fontSize: clientNameSize }]}>{clientName}</Text>{clientExtra ? <Text style={styles.customerExtra}>{clientExtra}</Text> : null}</View></View>

          <View style={styles.details}>
            <View style={styles.detailRow}><DetailCell icon="calendar" label="PAYMENT DATE" value={formatNumericDate(receipt.date)} /><DetailCell icon="card" label="PAYMENT MODE" value={paymentMode(receipt.payment_mode)} right /></View>
            <View style={styles.detailRow}><DetailCell icon="hash" label="REFERENCE NO." value={receipt.payment_reference || '-'} bottom /><DetailCell icon="document" label="TOWARDS" value={receipt.towards || '-'} right bottom /></View>
          </View>

          <View style={styles.notes}><IconTile name="note" /><View style={styles.notesCopy}><Text style={styles.notesHeading}>Notes</Text><Text style={styles.customNote}>{receipt.notes || 'Thank you for your payment. We look forward to serving you.'}</Text><Text style={styles.legalNote}>This is a computer-generated receipt and does not require a physical signature.</Text><Text style={styles.legalNote}>This receipt is valid as proof of payment for the amount mentioned above.</Text><Text style={styles.legalNote}>For queries: {brand.email}</Text></View></View>

          <View style={[styles.thanks, { backgroundColor: softAccent }]}><View style={styles.heartTile}><Icon name="heart" color={accent} size={20} /></View><View style={styles.thanksCopy}><Text style={[styles.thanksLabel, { color: accent }]}>THANK YOU</Text><Text style={styles.thanksTitle}>Thank you for your payment!</Text><Text style={styles.thanksText}>We appreciate your continued support.</Text></View></View>
        </View>

        <View style={styles.footer} fixed><View style={styles.footerItem}><Icon name="web" size={12} /><Text style={styles.footerText}>{brand.website}</Text></View><View style={styles.footerItem}><Icon name="mail" size={12} /><Text style={styles.footerText}>{brand.email}</Text></View><View style={styles.footerItem}><Icon name="phone" size={12} /><Text style={styles.footerText}>{brand.phone}</Text></View></View>
        <View style={[styles.footerAccent, { backgroundColor: accent }]} fixed />
      </Page>
    </Document>
  );
}
