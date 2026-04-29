import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { PaymentReceipt, Client } from '../../types'
import { registerPDFFonts } from '../../utils/pdfFonts'
registerPDFFonts()
import { getBrandDetails } from '../../constants/businessDetails'
import { getLogo, PLACEHOLDER_LOGOS } from '../../utils/logos'
import { amountToWords } from '../../utils/amountToWords'

interface ReceiptPDFProps {
  receipt: PaymentReceipt
  client?: Client | null
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string): string {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const PAYMENT_MODE_MAP: Record<string, string> = {
  upi: 'UPI',
  bank: 'Bank Transfer',
  cash: 'Cash',
  card: 'Card',
  razorpay: 'Razorpay',
  cheque: 'Cheque',
}

function formatPaymentMode(mode: string): string {
  if (!mode) return '—'
  return PAYMENT_MODE_MAP[mode.toLowerCase()] || (mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase())
}

// ── Styles at module level — no fontFamily (uses react-pdf built-in) ──────────
const styles = StyleSheet.create({
  // Page — paddingBottom leaves room for absolute-positioned banner + footer
  page: { backgroundColor: '#ffffff', paddingBottom: 100 },

  // HEADER
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 28 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, objectFit: 'contain', marginRight: 12 },
  brandName: { color: '#ffffff', fontSize: 16, fontWeight: 700 },
  brandTag: { fontSize: 9, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  contactText: { color: '#94a3b8', fontSize: 9, lineHeight: 1.8 },

  // STRIPE
  stripe: { height: 3 },

  // TITLE BAR
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 28, borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8', borderBottomStyle: 'solid' },
  docTitle: { fontSize: 14, fontWeight: 700 },
  docMeta: { alignItems: 'flex-end' },
  docMetaText: { fontSize: 9, color: '#888888', lineHeight: 1.8 },

  // BODY — normal flow; page paddingBottom reserves space for fixed banner+footer
  body: { flexDirection: 'column' },

  // RECEIVED WITH THANKS FROM BOX
  recvBox: { marginTop: 16, marginHorizontal: 28, borderWidth: 0.5, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#fafafa' },
  recvLabel: { fontSize: 8, fontWeight: 700, color: '#888888', letterSpacing: 1, marginBottom: 6 },
  recvName: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  recvWords: { fontSize: 10, color: '#666666' },
  recvAmount: { fontSize: 24, fontWeight: 700, marginTop: 6 },

  // PAYMENT GRID 2×2
  gridOuter: { marginTop: 14, marginHorizontal: 28, borderWidth: 0.5, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, overflow: 'hidden' },
  gridRowTop: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0', borderBottomStyle: 'solid' },
  gridRowBottom: { flexDirection: 'row' },
  gridCellLeft: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRightWidth: 0.5, borderRightColor: '#e0e0e0', borderRightStyle: 'solid' },
  gridCellRight: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  cellLabel: { fontSize: 8, fontWeight: 700, color: '#888888', letterSpacing: 0.5, marginBottom: 3 },
  cellValue: { fontSize: 11, fontWeight: 700 },

  // NOTES
  notesSection: { marginTop: 14, marginHorizontal: 28, borderTopWidth: 0.5, borderTopColor: '#f0f0f0', borderTopStyle: 'solid', paddingTop: 10 },
  notesLabel: { fontSize: 8, fontWeight: 700, color: '#888888', marginBottom: 5 },
  notesCustom: { fontSize: 10, color: '#444444', marginBottom: 6 },
  notesStd: { fontSize: 9, color: '#aaaaaa', lineHeight: 1.7 },

  // THANK YOU BANNER — fixed just above footer
  thanksBanner: { position: 'absolute', bottom: 28, left: 0, right: 0, paddingVertical: 10, paddingHorizontal: 28, alignItems: 'center' },
  thanksBannerText: { color: '#ffffff', fontSize: 11, fontWeight: 700, letterSpacing: 1, textAlign: 'center' },

  // DARK FOOTER — fixed at very bottom
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 28 },
  footerText: { fontSize: 8, color: '#64748b' },
})

export default function ReceiptPDF({ receipt, client }: ReceiptPDFProps) {
  const brand = getBrandDetails(receipt.sub_brand)
  const isRitera = receipt.sub_brand?.toLowerCase().includes('ritera')
  const logoSrc = getLogo(isRitera ? 'ritera' : 'ratixinfo')
    || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo']

  const clientName = client?.name || receipt.client_name_override || '—'
  const amount = receipt.amount_received || 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* SECTION 1: Dark header */}
        <View style={[styles.header, { backgroundColor: brand.headerBg }]}>
          <View style={styles.headerLeft}>
            {logoSrc && <Image src={logoSrc} style={styles.logo} />}
            <View>
              <Text style={styles.brandName}>{brand.brandName.toUpperCase()}</Text>
              <Text style={[styles.brandTag, { color: brand.accentColor }]}>{brand.tagline}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contactText}>{brand.email}</Text>
            <Text style={styles.contactText}>{brand.website}</Text>
            <Text style={styles.contactText}>{brand.phone}</Text>
          </View>
        </View>

        {/* SECTION 2: Accent stripe */}
        <View style={[styles.stripe, { backgroundColor: brand.accentColor }]} />

        {/* SECTION 3: Title bar */}
        <View style={styles.titleBar}>
          <Text style={[styles.docTitle, { color: brand.headerBg }]}>PAYMENT RECEIPT</Text>
          <View style={styles.docMeta}>
            <Text style={styles.docMetaText}>Receipt No: {receipt.receipt_number}</Text>
            <Text style={styles.docMetaText}>Date: {formatDate(receipt.date)}</Text>
          </View>
        </View>

        {/* MAIN CONTENT — paddingBottom on page reserves space for fixed banner+footer */}
        <View style={styles.body}>

          {/* SECTION 4: Received with thanks from */}
          <View style={styles.recvBox}>
            <Text style={styles.recvLabel}>RECEIVED WITH THANKS FROM</Text>
            <Text style={[styles.recvName, { color: brand.headerBg }]}>{clientName}</Text>
            <Text style={styles.recvWords}>The sum of: {amountToWords(amount)}</Text>
            <Text style={[styles.recvAmount, { color: brand.accentColor }]}>INR {formatAmount(amount)}</Text>
          </View>

          {/* SECTION 5: Payment details 2×2 grid */}
          <View style={styles.gridOuter}>
            <View style={styles.gridRowTop}>
              <View style={styles.gridCellLeft}>
                <Text style={styles.cellLabel}>PAYMENT DATE</Text>
                <Text style={[styles.cellValue, { color: brand.headerBg }]}>{formatDate(receipt.date)}</Text>
              </View>
              <View style={styles.gridCellRight}>
                <Text style={styles.cellLabel}>PAYMENT MODE</Text>
                <Text style={[styles.cellValue, { color: brand.headerBg }]}>{formatPaymentMode(receipt.payment_mode)}</Text>
              </View>
            </View>
            <View style={styles.gridRowBottom}>
              <View style={styles.gridCellLeft}>
                <Text style={styles.cellLabel}>REFERENCE NO</Text>
                <Text style={[styles.cellValue, { color: brand.headerBg }]}>{receipt.payment_reference || '—'}</Text>
              </View>
              <View style={styles.gridCellRight}>
                <Text style={styles.cellLabel}>TOWARDS</Text>
                <Text style={[styles.cellValue, { color: brand.headerBg }]}>{receipt.towards || '—'}</Text>
              </View>
            </View>
          </View>

          {/* SECTION 6: Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesCustom}>
              {receipt.notes || 'Thank you for your payment. We look forward to serving you.'}
            </Text>
            <Text style={styles.notesStd}>This is a computer-generated receipt and does not require a physical signature.</Text>
            <Text style={styles.notesStd}>This receipt is valid as proof of payment for the amount mentioned above.</Text>
            <Text style={styles.notesStd}>For queries: {brand.email}</Text>
          </View>

        </View>

        {/* SECTION 7: Thank you banner — absolute, bottom: 28 */}
        <View style={[styles.thanksBanner, { backgroundColor: brand.accentColor }]} fixed>
          <Text style={styles.thanksBannerText}>THANK YOU FOR YOUR PAYMENT!</Text>
        </View>

        {/* SECTION 8: Dark footer — absolute, bottom: 0 */}
        <View style={[styles.footer, { backgroundColor: brand.headerBg }]} fixed>
          <Text style={styles.footerText}>{brand.website}</Text>
          <Text style={styles.footerText}>{brand.email}</Text>
          <Text style={styles.footerText}>{brand.phone}</Text>
        </View>

      </Page>
    </Document>
  )
}
