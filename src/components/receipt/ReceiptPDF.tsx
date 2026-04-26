import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { PaymentReceipt, Client } from '../../types'
import { registerFonts } from '../../utils/pdfFonts'
registerFonts()
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

function capitalize(s: string): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ReceiptPDF({ receipt, client }: ReceiptPDFProps) {
  const brand = getBrandDetails(receipt.sub_brand)
  const isRitera = receipt.sub_brand?.toLowerCase().includes('ritera')
  const logoSrc = getLogo(isRitera ? 'ritera' : 'ratixinfo')
    || PLACEHOLDER_LOGOS[isRitera ? 'ritera' : 'ratixinfo']

  const clientName = client?.name || receipt.client_name_override || '—'
  const amount = receipt.amount_received || 0

  const styles = StyleSheet.create({
    page: { fontFamily: 'Roboto', backgroundColor: '#ffffff', paddingBottom: 0 },

    // HEADER
    header: { backgroundColor: brand.headerBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 32 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 44, height: 44, objectFit: 'contain', marginRight: 12 },
    brandName: { color: '#ffffff', fontSize: 16, fontFamily: 'Roboto', fontWeight: 'bold', letterSpacing: 1 },
    brandTag: { color: brand.accentColor, fontSize: 9, marginTop: 2, letterSpacing: 0.5, fontFamily: 'Roboto' },
    headerRight: { alignItems: 'flex-end' },
    contactText: { color: '#94a3b8', fontSize: 9, marginBottom: 2, fontFamily: 'Roboto' },

    // STRIPE
    stripe: { backgroundColor: brand.accentColor, height: 3 },

    // TITLE BAR
    titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 32, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', borderBottomStyle: 'solid' },
    docTitle: { fontSize: 14, fontFamily: 'Roboto', fontWeight: 'bold', color: brand.headerBg, letterSpacing: 2 },
    docMeta: { alignItems: 'flex-end' },
    docMetaText: { fontSize: 9, color: '#888888', marginBottom: 1, fontFamily: 'Roboto' },

    // BODY
    body: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 16 },

    // RECEIVED FROM BOX
    recvBox: { borderWidth: 0.5, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#fafafa' },
    recvLabel: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: '#888888', letterSpacing: 1.5, marginBottom: 6 },
    recvName: { fontSize: 16, fontFamily: 'Roboto', fontWeight: 'bold', color: brand.headerBg, marginBottom: 4 },
    recvWords: { fontSize: 10, color: '#666666', fontFamily: 'Roboto', fontStyle: 'italic', marginBottom: 8 },
    recvAmount: { fontSize: 22, fontFamily: 'Roboto', fontWeight: 'bold', color: brand.accentColor },

    // PAYMENT GRID
    gridOuter: { marginTop: 14, borderWidth: 0.5, borderColor: '#e0e0e0', borderStyle: 'solid', borderRadius: 6, overflow: 'hidden' },
    gridRowTop: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0', borderBottomStyle: 'solid' },
    gridRowBottom: { flexDirection: 'row' },
    gridCellLeft: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRightWidth: 0.5, borderRightColor: '#e0e0e0', borderRightStyle: 'solid' },
    gridCellRight: { flex: 1, paddingVertical: 8, paddingHorizontal: 12 },
    cellLabel: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: '#888888', letterSpacing: 0.5, marginBottom: 3 },
    cellValue: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 'bold', color: brand.headerBg },

    // NOTES
    notesSection: { marginTop: 10, borderTopWidth: 0.5, borderTopColor: '#f0f0f0', borderTopStyle: 'solid', paddingTop: 10 },
    notesLabel: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: '#888888', letterSpacing: 1, marginBottom: 5 },
    notesCustom: { fontSize: 10, color: '#444444', marginBottom: 6, fontFamily: 'Roboto' },
    notesStd: { fontSize: 9, color: '#aaaaaa', fontFamily: 'Roboto', fontStyle: 'italic', lineHeight: 1.7 },

    // THANK YOU BANNER
    thanksBanner: { backgroundColor: brand.accentColor, paddingVertical: 10, paddingHorizontal: 32, alignItems: 'center', marginTop: 20 },
    thanksBannerText: { color: '#ffffff', fontSize: 11, fontFamily: 'Roboto', fontWeight: 'bold', letterSpacing: 1.5 },

    // DARK FOOTER
    footer: { backgroundColor: brand.headerBg, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 32 },
    footerText: { fontSize: 8, color: '#64748b', fontFamily: 'Roboto' },
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoSrc && <Image src={logoSrc} style={styles.logo} />}
            <View>
              <Text style={styles.brandName}>{brand.brandName.toUpperCase()}</Text>
              <Text style={styles.brandTag}>{brand.tagline}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contactText}>{brand.email}</Text>
            <Text style={styles.contactText}>{brand.website}</Text>
            <Text style={styles.contactText}>{brand.phone}</Text>
          </View>
        </View>

        {/* ACCENT STRIPE */}
        <View style={styles.stripe} />

        {/* TITLE BAR */}
        <View style={styles.titleBar}>
          <Text style={styles.docTitle}>PAYMENT RECEIPT</Text>
          <View style={styles.docMeta}>
            <Text style={styles.docMetaText}>Receipt No: {receipt.receipt_number}</Text>
            <Text style={styles.docMetaText}>Date: {formatDate(receipt.date)}</Text>
          </View>
        </View>

        {/* BODY */}
        <View style={styles.body}>

          {/* RECEIVED FROM BOX */}
          <View style={styles.recvBox}>
            <Text style={styles.recvLabel}>RECEIVED WITH THANKS FROM</Text>
            <Text style={styles.recvName}>{clientName}</Text>
            <Text style={styles.recvWords}>The sum of: {amountToWords(amount)} Only</Text>
            <Text style={styles.recvAmount}>INR {formatAmount(amount)}</Text>
          </View>

          {/* PAYMENT GRID 2x2 */}
          <View style={styles.gridOuter}>
            <View style={styles.gridRowTop}>
              <View style={styles.gridCellLeft}>
                <Text style={styles.cellLabel}>PAYMENT DATE</Text>
                <Text style={styles.cellValue}>{formatDate(receipt.date)}</Text>
              </View>
              <View style={styles.gridCellRight}>
                <Text style={styles.cellLabel}>PAYMENT MODE</Text>
                <Text style={styles.cellValue}>{capitalize(receipt.payment_mode)}</Text>
              </View>
            </View>
            <View style={styles.gridRowBottom}>
              <View style={styles.gridCellLeft}>
                <Text style={styles.cellLabel}>REFERENCE NO</Text>
                <Text style={styles.cellValue}>{receipt.payment_reference || '—'}</Text>
              </View>
              <View style={styles.gridCellRight}>
                <Text style={styles.cellLabel}>TOWARDS</Text>
                <Text style={styles.cellValue}>{receipt.towards || '—'}</Text>
              </View>
            </View>
          </View>

          {/* NOTES */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>NOTES</Text>
            {receipt.notes ? (
              <Text style={styles.notesCustom}>{receipt.notes}</Text>
            ) : null}
            <Text style={styles.notesStd}>
              This is a computer-generated receipt and does not require a physical signature.
            </Text>
            <Text style={styles.notesStd}>
              This receipt is valid as proof of payment for the amount mentioned above.
            </Text>
            <Text style={styles.notesStd}>
              For any queries, contact us at: {brand.email}
            </Text>
          </View>

        </View>

        {/* THANK YOU BANNER */}
        <View style={styles.thanksBanner}>
          <Text style={styles.thanksBannerText}>THANK YOU FOR YOUR PAYMENT!</Text>
        </View>

        {/* DARK FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{brand.website}</Text>
          <Text style={styles.footerText}>{brand.email}</Text>
          <Text style={styles.footerText}>{brand.phone}</Text>
        </View>

      </Page>
    </Document>
  )
}
