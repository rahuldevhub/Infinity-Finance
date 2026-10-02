import {
  Circle, Document, Image, Line, Page, Path, Rect, StyleSheet, Svg, Text, View,
} from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { Invoice, BusinessSettings } from '../../types';
import { registerPDFFonts } from '../../utils/pdfFonts';
import { getLogo, PLACEHOLDER_LOGOS } from '../../utils/logos';
import { BUSINESS, getBrandDetails } from '../../constants/businessDetails';
import { amountToWords } from '../../utils/amountToWords';
import { invoiceClientSnapshot } from '../../domain/invoiceCompatibility';

registerPDFFonts();

const NAVY = '#071d3a';
const NAVY_2 = '#0b2b50';
const RED = '#ef233c';
const TEXT = '#10213d';
const MUTED = '#65758f';
const BORDER = '#dfe6ef';
const SOFT = '#f5f8fc';
const PALE_RED = '#fff5f6';
const GREEN = '#159447';
const PALE_GREEN = '#e3f7e9';
const PAD = 28;

function longDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function money(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function number(value: number): string {
  return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type IconName = 'mail' | 'globe' | 'phone' | 'document' | 'calendar' | 'tag' | 'building' | 'user' | 'pin' | 'layers' | 'notes';

function LineIcon({ name, color = NAVY, size = 14 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'mail' && <><Rect x="3" y="5" width="18" height="14" rx="2" {...common} /><Path d="M4 7l8 6 8-6" {...common} /></>}
      {name === 'globe' && <><Circle cx="12" cy="12" r="9" {...common} /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" {...common} /></>}
      {name === 'phone' && <Path d="M7 3l3 4-2 2c2 4 4 6 8 8l2-2 4 3c-1 3-3 4-6 3C9 19 5 15 3 8 2 5 4 3 7 3z" {...common} />}
      {name === 'document' && <><Path d="M6 3h8l4 4v14H6zM14 3v5h5" {...common} /><Line x1="9" y1="12" x2="15" y2="12" {...common} /><Line x1="9" y1="16" x2="15" y2="16" {...common} /></>}
      {name === 'calendar' && <><Rect x="3" y="5" width="18" height="16" rx="2" {...common} /><Line x1="3" y1="10" x2="21" y2="10" {...common} /><Line x1="8" y1="3" x2="8" y2="7" {...common} /><Line x1="16" y1="3" x2="16" y2="7" {...common} /></>}
      {name === 'tag' && <><Path d="M3 12V4h8l10 10-7 7z" {...common} /><Circle cx="8" cy="8" r="1.5" {...common} /></>}
      {name === 'building' && <><Path d="M5 21V5l7-3 7 3v16M3 21h18" {...common} /><Line x1="9" y1="7" x2="9" y2="9" {...common} /><Line x1="15" y1="7" x2="15" y2="9" {...common} /><Line x1="9" y1="12" x2="9" y2="14" {...common} /><Line x1="15" y1="12" x2="15" y2="14" {...common} /><Path d="M10 21v-4h4v4" {...common} /></>}
      {name === 'user' && <><Circle cx="12" cy="8" r="4" {...common} /><Path d="M4 21c1-5 4-7 8-7s7 2 8 7" {...common} /></>}
      {name === 'pin' && <><Path d="M12 22s7-7 7-13a7 7 0 10-14 0c0 6 7 13 7 13z" {...common} /><Circle cx="12" cy="9" r="2" {...common} /></>}
      {name === 'layers' && <><Path d="M12 3L3 8l9 5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5" {...common} /></>}
      {name === 'notes' && <><Path d="M6 3h12v18H6z" {...common} /><Line x1="9" y1="8" x2="15" y2="8" {...common} /><Line x1="9" y1="12" x2="15" y2="12" {...common} /><Line x1="9" y1="16" x2="13" y2="16" {...common} /></>}
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 9, color: TEXT, backgroundColor: '#ffffff', paddingBottom: 65 },
  header: { height: 88, paddingHorizontal: PAD, backgroundColor: NAVY, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  headerGlow: { position: 'absolute', right: -30, bottom: -35, width: 210, height: 76, backgroundColor: NAVY_2, transform: 'rotate(-7deg)' },
  headerAccent: { position: 'absolute', right: 78, bottom: -16, width: 105, height: 34, backgroundColor: '#5d1730', transform: 'rotate(19deg)', opacity: 0.55 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 50, height: 50, objectFit: 'contain', marginRight: 13 },
  brandDivider: { width: 1, height: 42, backgroundColor: '#a7b4c6', marginRight: 13 },
  brandName: { color: '#ffffff', fontSize: 18, fontWeight: 700, letterSpacing: 0.6 },
  brandTagline: { color: '#e3e9f1', fontSize: 9.5, marginTop: 4 },
  brandUnderline: { width: 30, height: 2, backgroundColor: RED, marginTop: 6 },
  contactBlock: { width: 165 },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  contactIcon: { width: 15, marginRight: 7, alignItems: 'center' },
  contactText: { color: '#ffffff', fontSize: 8.5 },
  redRule: { height: 2, backgroundColor: RED },
  titleArea: { marginHorizontal: PAD, paddingTop: 24, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  titleAreaCompact: { paddingTop: 14, paddingBottom: 10 },
  titleAccent: { width: 30, height: 2.5, borderRadius: 2, backgroundColor: RED, marginBottom: 12 },
  title: { color: NAVY, fontSize: 27, fontWeight: 700, letterSpacing: 0.3 },
  titleSoft: { color: '#6f819b' },
  subtitle: { color: '#6f819b', fontSize: 11, marginTop: 5 },
  metadata: { width: 177, borderLeftWidth: 1, borderLeftColor: BORDER, paddingLeft: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  iconTile: { width: 28, height: 28, borderRadius: 7, backgroundColor: SOFT, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  metaLabel: { color: MUTED, fontSize: 7.5, marginBottom: 2 },
  metaValue: { color: TEXT, fontSize: 9.5, fontWeight: 700 },
  statusBadge: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5 },
  statusText: { fontSize: 8, fontWeight: 700 },
  clientRow: { marginHorizontal: PAD, flexDirection: 'row' },
  card: { flex: 1, minHeight: 112, borderWidth: 0.7, borderColor: BORDER, borderRadius: 8, padding: 11 },
  cardCompact: { minHeight: 92, padding: 8 },
  cardLeft: { marginRight: 10 },
  cardHeader: { flexDirection: 'row' },
  cardBody: { flex: 1 },
  overline: { color: MUTED, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.7, marginBottom: 5 },
  clientName: { color: TEXT, fontSize: 12.5, fontWeight: 700, marginBottom: 3 },
  unitText: { color: '#3f506a', fontSize: 8.5, marginBottom: 2 },
  address: { color: '#3f506a', fontSize: 8.5, lineHeight: 1.35 },
  gstin: { color: TEXT, fontSize: 8.5, fontWeight: 700, marginTop: 3 },
  clientContact: { color: '#455977', fontSize: 8.2, marginTop: 4 },
  supplyBar: { marginHorizontal: PAD, marginTop: 11, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: SOFT, borderRadius: 7, flexDirection: 'row' },
  supplyBarCompact: { marginTop: 8, paddingVertical: 6 },
  supplyCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  supplyCellRight: { flex: 1, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: BORDER, paddingLeft: 16 },
  supplyLabel: { color: TEXT, fontSize: 8.5 },
  supplyValue: { fontWeight: 700 },
  table: { marginHorizontal: PAD, marginTop: 14, borderWidth: 0.7, borderColor: BORDER, borderRadius: 7, overflow: 'hidden' },
  tableCompact: { marginTop: 9 },
  tableHead: { minHeight: 32, paddingHorizontal: 7, backgroundColor: NAVY, flexDirection: 'row', alignItems: 'center' },
  tableRow: { minHeight: 33, paddingHorizontal: 7, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.6, borderBottomColor: BORDER },
  tableRowCompact: { minHeight: 24, paddingVertical: 5 },
  tableRowAlt: { backgroundColor: '#fbfcfe' },
  th: { color: '#ffffff', fontSize: 6.4, fontWeight: 700 },
  td: { color: TEXT, fontSize: 7.5 },
  rowNumber: { width: 20, textAlign: 'center' },
  description: { flex: 1, paddingHorizontal: 4 },
  hsn: { width: 48, textAlign: 'center' },
  qty: { width: 24, textAlign: 'center' },
  unit: { width: 30, textAlign: 'center' },
  rate: { width: 58, textAlign: 'right' },
  gst: { width: 31, textAlign: 'center' },
  tax: { width: 56, textAlign: 'right' },
  total: { width: 67, textAlign: 'right', fontWeight: 700 },
  totalsArea: { marginHorizontal: PAD, marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch' },
  totalsAreaCompact: { marginTop: 8 },
  wordsCard: { width: '57%', backgroundColor: PALE_RED, borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'center' },
  wordsCardCompact: { padding: 9 },
  wordsMark: { width: 37, height: 37, borderRadius: 8, backgroundColor: '#ffe6e9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  wordsMarkText: { color: RED, fontSize: 16, fontWeight: 700 },
  wordsLabel: { color: RED, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.5, marginBottom: 7 },
  wordsText: { color: TEXT, fontSize: 11, lineHeight: 1.25, fontWeight: 700 },
  totalsCard: { width: '39%', borderWidth: 0.7, borderColor: BORDER, borderRadius: 8, overflow: 'hidden' },
  totalsBody: { paddingHorizontal: 10, paddingVertical: 8 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  totalLineLabel: { color: TEXT, fontSize: 8.4 },
  totalLineValue: { color: TEXT, fontSize: 8.4, fontWeight: 700 },
  discountLabel: { color: RED },
  grandTotal: { backgroundColor: PALE_RED, borderTopWidth: 0.8, borderTopColor: '#ffb9c1', paddingVertical: 9, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandLabel: { color: RED, fontSize: 9, fontWeight: 700 },
  grandValue: { color: RED, fontSize: 15, fontWeight: 700 },
  notes: { marginHorizontal: PAD, marginTop: 13, borderWidth: 0.7, borderColor: BORDER, borderRadius: 8, padding: 11, flexDirection: 'row' },
  notesCompact: { marginTop: 8, padding: 8 },
  notesBody: { flex: 1 },
  notesTitle: { color: MUTED, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.7, marginBottom: 6 },
  noteLine: { color: '#455977', fontSize: 8, lineHeight: 1.45, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerBody: { marginHorizontal: PAD, height: 45, borderTopWidth: 0.7, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { color: '#455977', fontSize: 7 },
  footerStripe: { height: 8, backgroundColor: NAVY },
  footerRed: { position: 'absolute', bottom: 0, right: 0, width: 170, height: 8, backgroundColor: RED, transform: 'skewX(-28deg)' },
});

interface InvoicePDFProps {
  invoice: Invoice;
  settings?: BusinessSettings | null;
}

function MetaRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return <View style={styles.metaRow}><View style={styles.iconTile}><LineIcon name={icon} size={15} /></View><View><Text style={styles.metaLabel}>{label}</Text>{children}</View></View>;
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const brand = getBrandDetails(invoice.sub_brand || '');
  const isRitera = !invoice.sub_brand?.toLowerCase().includes('ratix');
  const logo = getLogo(isRitera ? 'ritera' : 'ratixinfo') || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo'];
  const billTo = invoiceClientSnapshot(invoice);
  const discountAmount = Number(invoice.discount_amount || 0);
  const subtotal = Number(invoice.taxable_value || 0) + discountAmount;
  const cgstRate = invoice.taxable_value > 0 ? Number(((invoice.cgst_amount / invoice.taxable_value) * 100).toFixed(2)) : 0;
  const igstRate = invoice.taxable_value > 0 ? Number(((invoice.igst_amount / invoice.taxable_value) * 100).toFixed(2)) : 0;
  const status = (invoice.payment_status || 'paid').toUpperCase();
  const paid = status === 'PAID';
  const compact = (invoice.items || []).length > 2;

  return (
    <Document title={`Tax Invoice ${invoice.invoice_number}`} author={brand.brandName} subject="Final GST tax invoice">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerGlow} /><View style={styles.headerAccent} />
          <View style={styles.brand}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}<View style={styles.brandDivider} />
            <View><Text style={styles.brandName}>{brand.brandName.toUpperCase()}</Text><Text style={styles.brandTagline}>{brand.tagline}</Text><View style={styles.brandUnderline} /></View>
          </View>
          <View style={styles.contactBlock}>
            <View style={styles.contactRow}><View style={styles.contactIcon}><LineIcon name="mail" color="#ffffff" size={12} /></View><Text style={styles.contactText}>{brand.email}</Text></View>
            <View style={styles.contactRow}><View style={styles.contactIcon}><LineIcon name="globe" color="#ffffff" size={12} /></View><Text style={styles.contactText}>{brand.website}</Text></View>
            <View style={styles.contactRow}><View style={styles.contactIcon}><LineIcon name="phone" color="#ffffff" size={12} /></View><Text style={styles.contactText}>{brand.phone}</Text></View>
          </View>
        </View>
        <View style={styles.redRule} />

        <View style={[styles.titleArea, compact ? styles.titleAreaCompact : {}]}>
          <View><View style={styles.titleAccent} /><Text style={styles.title}>TAX <Text style={styles.titleSoft}>INVOICE</Text></Text><Text style={styles.subtitle}>For services provided</Text></View>
          <View style={styles.metadata}>
            <MetaRow icon="document" label="Invoice No."><Text style={styles.metaValue}>{invoice.invoice_number}</Text></MetaRow>
            <MetaRow icon="calendar" label="Date"><Text style={styles.metaValue}>{longDate(invoice.invoice_date)}</Text></MetaRow>
            <MetaRow icon="tag" label="Status"><View style={[styles.statusBadge, { backgroundColor: paid ? PALE_GREEN : SOFT }]}><Text style={[styles.statusText, { color: paid ? GREEN : MUTED }]}>{status}</Text></View></MetaRow>
          </View>
        </View>

        <View style={styles.clientRow}>
          <View style={[styles.card, styles.cardLeft, compact ? styles.cardCompact : {}]}><View style={styles.cardHeader}><View style={styles.iconTile}><LineIcon name="building" size={16} /></View><View style={styles.cardBody}>
            <Text style={styles.overline}>BILLED BY</Text><Text style={styles.clientName}>{BUSINESS.legalName}</Text><Text style={styles.unitText}>(Unit of {brand.brandName})</Text>
            <Text style={styles.address}>{BUSINESS.address},</Text><Text style={styles.address}>{BUSINESS.city}, {BUSINESS.state} - {BUSINESS.pincode}</Text><Text style={styles.gstin}>GSTIN: {BUSINESS.gstin}</Text><Text style={styles.clientContact}>{brand.email}  |  {brand.phone}</Text>
          </View></View></View>
          <View style={[styles.card, compact ? styles.cardCompact : {}]}><View style={styles.cardHeader}><View style={styles.iconTile}><LineIcon name="user" size={16} /></View><View style={styles.cardBody}>
            <Text style={styles.overline}>BILLED TO</Text><Text style={styles.clientName}>{billTo.name || '-'}</Text>
            {billTo.address ? <Text style={styles.address}>{billTo.address}</Text> : null}{billTo.state ? <Text style={styles.address}>{billTo.state}</Text> : null}{billTo.gstin ? <Text style={styles.gstin}>GSTIN: {billTo.gstin}</Text> : null}{billTo.email ? <Text style={styles.clientContact}>Email: {billTo.email}</Text> : null}{billTo.phone ? <Text style={styles.clientContact}>Phone: {billTo.phone}</Text> : null}
          </View></View></View>
        </View>

        <View style={[styles.supplyBar, compact ? styles.supplyBarCompact : {}]}>
          <View style={styles.supplyCell}><View style={styles.iconTile}><LineIcon name="pin" size={15} /></View><Text style={styles.supplyLabel}>Place of Supply: <Text style={styles.supplyValue}>{invoice.place_of_supply || '-'}</Text></Text></View>
          <View style={styles.supplyCellRight}><View style={styles.iconTile}><LineIcon name="layers" size={15} /></View><Text style={styles.supplyLabel}>Tax Type: <Text style={styles.supplyValue}>{invoice.is_igst ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}</Text></Text></View>
        </View>

        <View style={[styles.table, compact ? styles.tableCompact : {}]}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.rowNumber]}>#</Text><Text style={[styles.th, styles.description]}>DESCRIPTION</Text><Text style={[styles.th, styles.hsn]}>HSN/SAC</Text><Text style={[styles.th, styles.qty]}>QTY</Text><Text style={[styles.th, styles.unit]}>UNIT</Text><Text style={[styles.th, styles.rate]}>RATE (INR)</Text><Text style={[styles.th, styles.gst]}>GST%</Text><Text style={[styles.th, styles.tax]}>{invoice.is_igst ? 'IGST (INR)' : 'CGST (INR)'}</Text>{!invoice.is_igst ? <Text style={[styles.th, styles.tax]}>SGST (INR)</Text> : null}<Text style={[styles.th, styles.total]}>AMOUNT (INR)</Text>
          </View>
          {(invoice.items || []).map((item, index) => <View key={index} wrap={false} style={[styles.tableRow, compact ? styles.tableRowCompact : {}, index % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.td, styles.rowNumber]}>{index + 1}</Text><Text style={[styles.td, styles.description]}>{item.description}</Text><Text style={[styles.td, styles.hsn]}>{item.hsn_sac || '-'}</Text><Text style={[styles.td, styles.qty]}>{item.quantity}</Text><Text style={[styles.td, styles.unit]}>{item.unit}</Text><Text style={[styles.td, styles.rate]}>{number(item.rate)}</Text><Text style={[styles.td, styles.gst]}>{item.gst_rate}%</Text><Text style={[styles.td, styles.tax]}>{number(invoice.is_igst ? item.igst : item.cgst)}</Text>{!invoice.is_igst ? <Text style={[styles.td, styles.tax]}>{number(item.sgst)}</Text> : null}<Text style={[styles.td, styles.total]}>{number(item.total)}</Text>
          </View>)}
        </View>

        <View style={[styles.totalsArea, compact ? styles.totalsAreaCompact : {}]} wrap={false}>
          <View style={[styles.wordsCard, compact ? styles.wordsCardCompact : {}]}><View style={styles.wordsMark}><Text style={styles.wordsMarkText}>A₹</Text></View><View style={{ flex: 1 }}><Text style={styles.wordsLabel}>AMOUNT IN WORDS</Text><Text style={styles.wordsText}>{amountToWords(invoice.total_amount)}</Text></View></View>
          <View style={styles.totalsCard}><View style={styles.totalsBody}>
            <View style={styles.totalLine}><Text style={styles.totalLineLabel}>Subtotal</Text><Text style={styles.totalLineValue}>{money(subtotal)}</Text></View>
            {discountAmount > 0 ? <View style={styles.totalLine}><Text style={[styles.totalLineLabel, styles.discountLabel]}>{invoice.discount_type === 'percent' ? `Discount (${Number(invoice.discount_value || 0)}%)` : 'Discount'}</Text><Text style={[styles.totalLineValue, styles.discountLabel]}>-{money(discountAmount)}</Text></View> : null}
            <View style={styles.totalLine}><Text style={styles.totalLineLabel}>Taxable Value</Text><Text style={styles.totalLineValue}>{money(invoice.taxable_value)}</Text></View>
            {invoice.is_igst ? <View style={styles.totalLine}><Text style={styles.totalLineLabel}>IGST @ {igstRate}%</Text><Text style={styles.totalLineValue}>{money(invoice.igst_amount)}</Text></View> : <><View style={styles.totalLine}><Text style={styles.totalLineLabel}>CGST @ {cgstRate}%</Text><Text style={styles.totalLineValue}>{money(invoice.cgst_amount)}</Text></View><View style={styles.totalLine}><Text style={styles.totalLineLabel}>SGST @ {cgstRate}%</Text><Text style={styles.totalLineValue}>{money(invoice.sgst_amount)}</Text></View></>}
          </View><View style={styles.grandTotal}><Text style={styles.grandLabel}>GRAND TOTAL</Text><Text style={styles.grandValue}>{money(invoice.total_amount)}</Text></View></View>
        </View>

        <View style={[styles.notes, compact ? styles.notesCompact : {}]} wrap={false}><View style={styles.iconTile}><LineIcon name="notes" size={16} /></View><View style={styles.notesBody}>
          <Text style={styles.notesTitle}>NOTES</Text>{invoice.notes ? <Text style={styles.noteLine}>•  {invoice.notes}</Text> : null}<Text style={styles.noteLine}>•  This is a computer-generated invoice and does not require a physical signature.</Text><Text style={styles.noteLine}>•  Subject to jurisdiction of Namakkal courts.</Text><Text style={styles.noteLine}>•  For any queries: {brand.email}</Text>
        </View></View>

        <View style={styles.footer} fixed><View style={styles.footerBody}>
          <View style={styles.footerItem}><View style={styles.contactIcon}><LineIcon name="globe" size={11} /></View><Text style={styles.footerText}>{brand.website}</Text></View><View style={styles.footerItem}><View style={styles.contactIcon}><LineIcon name="pin" size={11} /></View><Text style={styles.footerText}>{BUSINESS.address}, {BUSINESS.city} - {BUSINESS.pincode}</Text></View><View style={styles.footerItem}><View style={styles.contactIcon}><LineIcon name="mail" size={11} /></View><Text style={styles.footerText}>{brand.email}</Text></View><View style={styles.footerItem}><View style={styles.contactIcon}><LineIcon name="phone" size={11} /></View><Text style={styles.footerText}>{brand.phone}</Text></View>
        </View><View style={styles.footerStripe} /><View style={styles.footerRed} /></View>
      </Page>
    </Document>
  );
}
