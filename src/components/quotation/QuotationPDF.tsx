import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Quotation } from '../../hooks/useQuotations';
import type { BusinessSettings } from '../../types';
import { getLogo } from '../../utils/logos';

// ─── Public client interface (subset — kept compatible with callers) ──────────
export interface QuotationPDFClient {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  gstin?: string | null;
}

interface QuotationPDFProps {
  quotation: Quotation;
  client: QuotationPDFClient | null;
  businessSettings: BusinessSettings | null;
}

// ─── Package notes shape stored in quotation.notes ───────────────────────────
interface PackageNotesData {
  packageId: string;
  packageName: string;
  services: Record<string, string[]>;
  complementary: string[];
  paidAddons: string[];
  excludedServices?: string[];
}

// ─── Ratixinfo notes shape stored in quotation.notes ─────────────────────────
interface RatixinfoNotesData {
  type: 'ratixinfo';
  projectType?: string;
  timeline?: string;
  techStack?: string;
  projectPhase?: string;
  services?: Record<string, string[]>;
  customService?: string;
  projectPrice?: number;
  notes?: string;
}

function parsePackageData(notes: string | null): PackageNotesData | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed.packageId === 'string') return parsed as PackageNotesData;
    return null;
  } catch {
    return null;
  }
}

function parseRatixinfoData(notes: string | null): RatixinfoNotesData | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && parsed.type === 'ratixinfo') return parsed as RatixinfoNotesData;
    return null;
  } catch {
    return null;
  }
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const NAVY  = '#1a1a2e';
const RED   = '#e63946';
const SLATE = '#0f172a';
const BLUE  = '#3b82f6';
const LGRAY = '#f8f8f8';
const BDR   = '#e0e0e0';
const MUTED = '#888888';
const DARK  = '#2d2d2d';
const PAD   = 44;

// ─── Ratixinfo development process steps ─────────────────────────────────────
const RATIX_PROCESS_STEPS = [
  'Discovery & Planning \u2014 We begin with a detailed project discussion to understand your goals, timeline, and technical requirements. A project scope document is prepared and agreed upon.',
  'Design & Development \u2014 Our team designs wireframes and develops the solution with regular progress updates. You will receive milestone demos throughout the development process.',
  'Testing & Delivery \u2014 Thorough QA testing is performed before final handover. Source code and assets are delivered upon receipt of full payment as per the agreement.',
  'Support & Growth \u2014 30 days post-launch support is included at no additional cost. We\u2019re here to help you scale and grow your digital presence.',
];

// ─── Publishing process steps (always shown for Ritera) ──────────────────────
const PROCESS_STEPS = [
  'Publishing Process \u2014 Your journey begins once the manuscript is complete and the first payment initiates the digital agreement.',
  'Submission \u2014 You\'ll receive a Submission Form via email to send your manuscript and documents. A marketing consultant will assist you.',
  'Publishing Begins \u2014 After approval, a Publishing Manager is assigned within 48 hours to guide you through design, printing, and distribution setup.',
  'Sales & Earnings \u2014 Each sale is tracked per schedule. Monthly reports are shared, and earnings are processed once they reach INR 2,500, as per the agreement.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `INR ${r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dmy(s: string): string {
  const d = new Date(s + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Pages
  page1: { fontFamily: 'Helvetica', color: DARK, fontSize: 10, backgroundColor: 'white', paddingBottom: 44 },
  page2: { fontFamily: 'Helvetica', color: DARK, fontSize: 10, backgroundColor: 'white', paddingBottom: 44 },

  // ── Header bar (Page 1 — full height) ──
  headerBar: {
    backgroundColor: NAVY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: PAD,
    paddingTop: 22,
    paddingBottom: 22,
  },
  brandName:    { color: 'white', fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 4 },
  brandTagline: { color: '#aaaaaa', fontSize: 7.5, letterSpacing: 0.5 },
  headerRight:  { alignItems: 'flex-end' },
  headerContact: { color: '#cccccc', fontSize: 8, marginBottom: 2, textAlign: 'right' },

  // ── Header bar (Page 2 — compact) ──
  headerBarCompact: {
    backgroundColor: NAVY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },
  brandNameSm: { color: 'white', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },

  // ── Red stripe ──
  redStripe: { backgroundColor: RED, height: 4 },

  // ── Title bar ──
  titleBar: {
    backgroundColor: LGRAY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: BDR,
    borderBottomStyle: 'solid',
  },
  titleText: { color: NAVY, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },
  titleMeta: { color: MUTED, fontSize: 8.5, textAlign: 'right' },

  // ── Welcome line ──
  welcome: { paddingHorizontal: PAD, paddingTop: 14, paddingBottom: 2 },
  welcomeText: { fontSize: 10.5, fontFamily: 'Helvetica-Oblique', color: NAVY, lineHeight: 1.5 },

  // ── Author details table ──
  tableWrap: {
    marginHorizontal: PAD,
    marginTop: 14,
    borderWidth: 1,
    borderColor: BDR,
    borderStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BDR,
    borderBottomStyle: 'solid',
  },
  tableRowLast: { flexDirection: 'row' },
  tableLabel: {
    width: '38%',
    backgroundColor: '#f3f4f6',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: BDR,
    borderRightStyle: 'solid',
  },
  tableLabelText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#555555' },
  tableValue: { flex: 1, paddingVertical: 7, paddingHorizontal: 10 },
  tableValueText: { fontSize: 8.5, color: DARK },

  // ── Investment summary (right-aligned 55% block) ──
  investWrap: { marginHorizontal: PAD, marginTop: 14, alignItems: 'flex-end' },
  investBox: {
    width: '55%',
    borderWidth: 1,
    borderColor: BDR,
    borderStyle: 'solid',
  },
  investHeader: {
    backgroundColor: NAVY,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  investHeaderText: { color: 'white', fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  investRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: BDR,
    borderBottomStyle: 'solid',
  },
  investRowAlt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: LGRAY,
    borderBottomWidth: 1,
    borderBottomColor: BDR,
    borderBottomStyle: 'solid',
  },
  investLabel:         { fontSize: 8.5, color: '#555555' },
  investValue:         { fontSize: 8.5, color: DARK },
  investDiscountValue: { fontSize: 8.5, color: '#16a34a' },
  investTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff5f5',
  },
  investTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY },
  investTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: RED },

  // ── Payment schedule table ──
  schedWrap: {
    marginHorizontal: PAD,
    marginTop: 14,
    borderWidth: 1,
    borderColor: BDR,
    borderStyle: 'solid',
  },
  schedHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: BDR,
    borderBottomStyle: 'solid',
  },
  schedThCell: { paddingVertical: 6, paddingHorizontal: 10 },
  schedThText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#555555' },
  schedRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BDR,
    borderBottomStyle: 'solid',
  },
  schedRowLast: { flexDirection: 'row' },
  schedTdCell: { paddingVertical: 6, paddingHorizontal: 10 },
  schedTdText: { fontSize: 8.5, color: DARK },
  schedCol1: { flex: 3 },
  schedCol2: { flex: 2, textAlign: 'right' },

  // ── Navy full-width banner ──
  navyBanner: {
    backgroundColor: NAVY,
    marginTop: 16,
    paddingHorizontal: PAD,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navyBannerText: { color: 'white', fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  // ── Publishing process (4 steps) ──
  processWrap: { marginHorizontal: PAD, marginTop: 14 },
  processTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  processStep: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-start' },
  stepBubble: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
    flexShrink: 0,
  },
  stepNum: { color: 'white', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  stepText: { flex: 1, fontSize: 8.5, color: DARK, lineHeight: 1.5 },

  // ── Page 2: section heading with red accent ──
  sectionWrap: { paddingHorizontal: PAD, marginTop: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionAccent: { width: 4, height: 13, backgroundColor: RED, marginRight: 8, borderRadius: 2 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 0.5, textTransform: 'uppercase' },

  // ── Services by category ──
  categoryLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#888888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, marginTop: 8 },
  serviceItem: { flexDirection: 'row', paddingVertical: 2.5 },
  serviceBullet: { fontSize: 8.5, color: MUTED, width: 14 },
  serviceText: { flex: 1, fontSize: 8.5, color: DARK, lineHeight: 1.4 },

  // ── Complementary / paid add-ons ──
  addonItem: { flexDirection: 'row', paddingVertical: 2.5 },
  addonBullet: { fontSize: 8.5, color: RED, width: 14 },
  addonText: { flex: 1, fontSize: 8.5, color: DARK },

  // ── Closing paragraph ──
  closingWrap: { paddingHorizontal: PAD, marginTop: 12 },
  closingText: { fontSize: 9, color: '#555555', fontFamily: 'Helvetica-Oblique', lineHeight: 1.6 },

  // ── Terms ──
  termsWrap: { paddingHorizontal: PAD, marginTop: 14 },
  termsTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  termsRow: { flexDirection: 'row', marginBottom: 4 },
  termsBullet: { fontSize: 8.5, color: MUTED, width: 12 },
  termsText: { flex: 1, fontSize: 8.5, color: '#555555', lineHeight: 1.5 },

  // ── Fixed footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
  },
  footerLeft:   { fontSize: 7.5, color: '#aaaaaa', flex: 1 },
  footerCenter: { fontSize: 7.5, color: '#cccccc', fontFamily: 'Helvetica-Oblique', flex: 2, textAlign: 'center' },
  footerRight:  { fontSize: 7.5, color: '#aaaaaa', flex: 1, textAlign: 'right' },

  // ── Legacy (fallback) layout ──
  legacyPage: { fontFamily: 'Helvetica', color: DARK, fontSize: 10, backgroundColor: 'white', paddingBottom: 44 },
  legacySection: { paddingHorizontal: PAD, marginTop: 14 },
  legacySectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  legacyItemRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', borderBottomStyle: 'solid' },
  legacyBullet: { fontSize: 9, color: RED, width: 14 },
  legacyItemDesc: { flex: 1, fontSize: 9, color: DARK, lineHeight: 1.4 },
  legacyItemAmt: { fontSize: 9, color: MUTED, marginLeft: 8, textAlign: 'right' },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={last ? s.tableRowLast : s.tableRow}>
      <View style={s.tableLabel}><Text style={s.tableLabelText}>{label}</Text></View>
      <View style={s.tableValue}><Text style={s.tableValueText}>{value}</Text></View>
    </View>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionAccent} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function PageFooter({ website = 'www.riterapublishing.com' }: { website?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLeft}>{website}</Text>
      <Text style={s.footerCenter}>Thank you for placing your trust in us!</Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function QuotationPDF({ quotation, client, businessSettings }: QuotationPDFProps) {
  // Client data (prefer explicit prop, then joined client, then overrides)
  const clientName     = client?.name    || quotation.client?.name    || quotation.client_name_override  || '';
  const clientEmail    = client?.email   || quotation.client?.email   || quotation.client_email_override || '';
  const clientPhone    = client?.phone   || '';
  const clientAddress  = client?.address || quotation.client?.address || '';
  const clientState    = client?.state   || quotation.client?.state   || '';
  const clientLocation = [clientAddress, clientState].filter(Boolean).join(', ');

  // Pricing
  const discountAmt = quotation.discount_amount || 0;
  const subtotal    = quotation.taxable_value + discountAmt;
  const gstTotal    = (quotation.cgst_amount || 0) + (quotation.sgst_amount || 0) + (quotation.igst_amount || 0);

  // Schedule
  const schedule = quotation.payment_schedule || [];

  // Terms
  const termsLines = (quotation.terms || '').split('\n').map(l => l.trim()).filter(Boolean);

  // Business header contact lines
  const contactLines = [
    businessSettings?.address || '',
    businessSettings?.state   || '',
    businessSettings?.gstin ? `GSTIN: ${businessSettings.gstin}` : '',
  ].filter(Boolean);

  // Author info rows
  const authorRows = [
    { label: 'Author Name',     value: clientName    || '\u2014' },
    { label: 'Email Address',   value: clientEmail   || '\u2014' },
    { label: 'Contact Number',  value: clientPhone   || '\u2014' },
    { label: 'Location',        value: clientLocation || '\u2014' },
    ...(quotation.consultant_name ? [{ label: 'Publishing Consultant', value: quotation.consultant_name }] : []),
    { label: 'Package',         value: quotation.title || '\u2014' },
    { label: 'Date',            value: dmy(quotation.date) },
    ...(quotation.valid_until ? [{ label: 'Valid Until', value: dmy(quotation.valid_until) }] : []),
  ];

  // Logo logic
  const isRatixinfoBrand = (quotation.sub_brand || '').toLowerCase().includes('ratix');
  const logoSrc = isRatixinfoBrand ? getLogo('ratixinfo') : getLogo('ritera');

  // Try to parse package JSON from notes
  const packageData = parsePackageData(quotation.notes);

  // ── Ritera 2-page PDF ──────────────────────────────────────────────────────
  if (packageData) {
    const hasComplementary = packageData.complementary.length > 0;
    const hasPaidAddons    = packageData.paidAddons.length > 0;
    const hasServices      = Object.keys(packageData.services).length > 0;

    return (
      <Document>

        {/* ════════════════════════ PAGE 1 ════════════════════════ */}
        <Page size="A4" style={s.page1}>

          {/* 1 · Header */}
          <View style={s.headerBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {logoSrc && (
                <Image src={logoSrc} style={{ width: 48, height: 48, marginRight: 12 }} />
              )}
              <View>
                <Text style={s.brandName}>{(quotation.sub_brand || '').toUpperCase()}</Text>
                <Text style={s.brandTagline}>A GLOBAL SELF-PUBLISHING COMPANY</Text>
              </View>
            </View>
            <View style={s.headerRight}>
              {contactLines.map((l, i) => <Text key={i} style={s.headerContact}>{l}</Text>)}
              {businessSettings?.gst_name && (
                <Text style={s.headerContact}>{businessSettings.gst_name}</Text>
              )}
            </View>
          </View>

          {/* 2 · Red stripe */}
          <View style={s.redStripe} />

          {/* 3 · Title bar */}
          <View style={s.titleBar}>
            <Text style={s.titleText}>YOUR PUBLISHING PROPOSAL</Text>
            <Text style={s.titleMeta}>
              {`Ref: ${quotation.quotation_number}   |   Date: ${dmy(quotation.date)}   |   ${packageData.packageName} Package`}
            </Text>
          </View>

          {/* 4 · Welcome line */}
          {clientName ? (
            <View style={s.welcome}>
              <Text style={s.welcomeText}>
                {`We\u2019re excited to begin this journey with you, ${clientName}. This proposal has been crafted especially for you and outlines everything we\u2019ll create together.`}
              </Text>
            </View>
          ) : null}

          {/* 5 · Author details */}
          <View style={s.tableWrap}>
            {authorRows.map((row, i) => (
              <InfoRow key={i} label={row.label} value={row.value} last={i === authorRows.length - 1} />
            ))}
          </View>

          {/* 6 · Investment Summary (right-aligned 55%) */}
          <View style={s.investWrap}>
            <View style={s.investBox}>
              <View style={s.investHeader}>
                <Text style={s.investHeaderText}>INVESTMENT SUMMARY</Text>
              </View>
              <View style={s.investRow}>
                <Text style={s.investLabel}>Package: {packageData.packageName}</Text>
                <Text style={s.investValue}>{fmt(subtotal)}</Text>
              </View>
              {discountAmt > 0 && (
                <View style={s.investRowAlt}>
                  <Text style={s.investLabel}>
                    {quotation.discount_type === 'percent'
                      ? `Discount (${quotation.discount_value}%)`
                      : 'Discount'}
                  </Text>
                  <Text style={s.investDiscountValue}>- {fmt(discountAmt)}</Text>
                </View>
              )}
              {quotation.include_gst && gstTotal > 0 && (
                <View style={s.investRow}>
                  <Text style={s.investLabel}>
                    {quotation.is_igst
                      ? `IGST (${quotation.gst_rate}%)`
                      : `GST (${quotation.gst_rate}%)`}
                  </Text>
                  <Text style={s.investValue}>{fmt(gstTotal)}</Text>
                </View>
              )}
              <View style={s.investTotalRow}>
                <Text style={s.investTotalLabel}>Final Investment</Text>
                <Text style={s.investTotalValue}>{fmt(quotation.total_amount)}</Text>
              </View>
            </View>
          </View>

          {/* 7 · Payment Schedule */}
          <View style={s.schedWrap}>
            <View style={s.schedHeader}>
              <View style={[s.schedThCell, s.schedCol1]}><Text style={s.schedThText}>PAYMENT TERM</Text></View>
              <View style={[s.schedThCell, s.schedCol2]}><Text style={s.schedThText}>AMOUNT</Text></View>
            </View>
            {schedule.length > 0 ? (
              schedule.map((item, i) => (
                <View key={i} style={i < schedule.length - 1 ? s.schedRow : s.schedRowLast}>
                  <View style={[s.schedTdCell, s.schedCol1]}>
                    <Text style={s.schedTdText}>
                      {item.label || `Payment ${i + 1}`}
                      {item.milestone ? ` \u2014 ${item.milestone}` : ''}
                    </Text>
                  </View>
                  <View style={[s.schedTdCell, s.schedCol2]}>
                    <Text style={s.schedTdText}>{fmt(item.amount)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={s.schedRowLast}>
                <View style={[s.schedTdCell, s.schedCol1]}>
                  <Text style={s.schedTdText}>Full Payment \u2014 On Agreement</Text>
                </View>
                <View style={[s.schedTdCell, s.schedCol2]}>
                  <Text style={s.schedTdText}>{fmt(quotation.total_amount)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* 8 · Navy banner */}
          <View style={s.navyBanner}>
            <Text style={s.navyBannerText}>YOUR JOURNEY BEGINS WITH RITERA!</Text>
          </View>

          {/* 9 · Publishing Process */}
          <View style={s.processWrap}>
            <Text style={s.processTitle}>Publishing Process</Text>
            {PROCESS_STEPS.map((step, i) => (
              <View key={i} style={s.processStep}>
                <View style={s.stepBubble}><Text style={s.stepNum}>{i + 1}</Text></View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <PageFooter />
        </Page>

        {/* ════════════════════════ PAGE 2 ════════════════════════ */}
        <Page size="A4" style={s.page2}>

          {/* Compact header */}
          <View style={s.headerBarCompact}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {logoSrc && (
                <Image src={logoSrc} style={{ width: 32, height: 32, marginRight: 8 }} />
              )}
              <Text style={s.brandNameSm}>{(quotation.sub_brand || '').toUpperCase()}</Text>
            </View>
            <Text style={s.headerContact}>List of Deliverables</Text>
          </View>
          <View style={s.redStripe} />

          {/* Deliverables banner */}
          <View style={[s.navyBanner, { marginTop: 0, paddingVertical: 14 }]}>
            <Text style={[s.navyBannerText, { fontSize: 13 }]}>List of Deliverables</Text>
          </View>

          {/* Services by category */}
          {hasServices && (
            <View style={s.sectionWrap}>
              <SectionHeading title="Services Included in Your Package" />
              {Object.entries(packageData.services).map(([category, services]) => {
                const visibleServices = services.filter(
                  svc => !packageData.excludedServices?.includes(svc)
                );
                if (visibleServices.length === 0) return null;
                return (
                  <View key={category}>
                    <Text style={s.categoryLabel}>{category}</Text>
                    {visibleServices.map((svc, i) => (
                      <View key={i} style={s.serviceItem}>
                        <Text style={s.serviceBullet}>{'\u2014'}</Text>
                        <Text style={s.serviceText}>{svc}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Complimentary add-ons */}
          {hasComplementary && (
            <View style={s.sectionWrap}>
              <SectionHeading title="Complimentary Add-ons" />
              {packageData.complementary.map((item, i) => (
                <View key={i} style={s.addonItem}>
                  <Text style={s.addonBullet}>{'\u2014'}</Text>
                  <Text style={s.addonText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Paid add-ons */}
          {hasPaidAddons && (
            <View style={s.sectionWrap}>
              <SectionHeading title="Additional Services" />
              {packageData.paidAddons.map((item, i) => (
                <View key={i} style={s.addonItem}>
                  <Text style={s.addonBullet}>{'\u2014'}</Text>
                  <Text style={s.addonText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Thank you banner */}
          <View style={[s.navyBanner, { marginHorizontal: PAD, borderRadius: 4 }]}>
            <Text style={s.navyBannerText}>Thank you for placing your trust in us!</Text>
          </View>

          {/* Closing paragraph */}
          <View style={s.closingWrap}>
            <Text style={s.closingText}>
              Your publishing journey is about to begin, and we&apos;re honoured to walk alongside you.
              If you have any questions or need support at any stage, we&apos;re just a message away.
              Here&apos;s to creating something meaningful together.
            </Text>
          </View>

          {/* Terms */}
          {termsLines.length > 0 && (
            <View style={s.termsWrap}>
              <Text style={s.termsTitle}>Terms &amp; Conditions</Text>
              {termsLines.map((line, i) => (
                <View key={i} style={s.termsRow}>
                  <Text style={s.termsBullet}>{'\u2022'}</Text>
                  <Text style={s.termsText}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          <PageFooter />
        </Page>

      </Document>
    );
  }

  // ── Ratixinfo Tech PDF (2-page) ────────────────────────────────────────────
  if (isRatixinfoBrand) {
    const ratixinfoData = parseRatixinfoData(quotation.notes);
    const ratixContactLines = ['ratixinfotech@gmail.com', '+91 77081 33665'];

    const ratixClientRows = [
      { label: 'Client Name',    value: clientName     || '\u2014' },
      { label: 'Email Address',  value: clientEmail    || '\u2014' },
      { label: 'Contact Number', value: clientPhone    || '\u2014' },
      { label: 'Location',       value: clientLocation || '\u2014' },
      ...(quotation.consultant_name     ? [{ label: 'Handled By',   value: quotation.consultant_name }]      : []),
      { label: 'Project',        value: quotation.title || '\u2014' },
      ...(ratixinfoData?.projectType    ? [{ label: 'Project Type', value: ratixinfoData.projectType }]      : []),
      ...(ratixinfoData?.timeline       ? [{ label: 'Timeline',     value: ratixinfoData.timeline }]         : []),
      ...(ratixinfoData?.techStack      ? [{ label: 'Tech Stack',   value: ratixinfoData.techStack }]        : []),
      ...(ratixinfoData?.projectPhase   ? [{ label: 'Phase',        value: ratixinfoData.projectPhase }]     : []),
      { label: 'Date',           value: dmy(quotation.date) },
      ...(quotation.valid_until         ? [{ label: 'Valid Until',  value: dmy(quotation.valid_until) }]     : []),
    ];

    const ratixServices = ratixinfoData?.services || {};
    const hasServices   = Object.keys(ratixServices).some(k => (ratixServices[k] || []).length > 0);
    const hasCustom     = Boolean(ratixinfoData?.customService);

    return (
      <Document>

        {/* ════════════════════════ PAGE 1 ════════════════════════ */}
        <Page size="A4" style={s.page1}>

          {/* 1 · Header */}
          <View style={[s.headerBar, { backgroundColor: SLATE }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {logoSrc && <Image src={logoSrc} style={{ width: 48, height: 48, marginRight: 12 }} />}
              <View>
                <Text style={s.brandName}>{(quotation.sub_brand || '').toUpperCase()}</Text>
                <Text style={s.brandTagline}>TECHNOLOGY SOLUTIONS &amp; DIGITAL SERVICES</Text>
              </View>
            </View>
            <View style={s.headerRight}>
              {ratixContactLines.map((l, i) => <Text key={i} style={s.headerContact}>{l}</Text>)}
            </View>
          </View>

          {/* 2 · Blue stripe */}
          <View style={[s.redStripe, { backgroundColor: BLUE }]} />

          {/* 3 · Title bar */}
          <View style={s.titleBar}>
            <Text style={[s.titleText, { color: SLATE }]}>PROJECT PROPOSAL</Text>
            <Text style={s.titleMeta}>
              {`Ref: ${quotation.quotation_number}   |   Date: ${dmy(quotation.date)}`}
            </Text>
          </View>

          {/* 4 · Welcome line */}
          {clientName ? (
            <View style={s.welcome}>
              <Text style={s.welcomeText}>
                {`We\u2019re excited to work on this project with you, ${clientName}. This proposal outlines the scope, investment, and timeline for your project.`}
              </Text>
            </View>
          ) : null}

          {/* 5 · Client / Project details */}
          <View style={s.tableWrap}>
            {ratixClientRows.map((row, i) => (
              <InfoRow key={i} label={row.label} value={row.value} last={i === ratixClientRows.length - 1} />
            ))}
          </View>

          {/* 6 · Project Investment */}
          <View style={s.investWrap}>
            <View style={s.investBox}>
              <View style={[s.investHeader, { backgroundColor: SLATE }]}>
                <Text style={s.investHeaderText}>PROJECT INVESTMENT</Text>
              </View>
              <View style={s.investRow}>
                <Text style={s.investLabel}>Project Value</Text>
                <Text style={s.investValue}>{fmt(subtotal)}</Text>
              </View>
              {discountAmt > 0 && (
                <View style={s.investRowAlt}>
                  <Text style={s.investLabel}>
                    {quotation.discount_type === 'percent'
                      ? `Discount (${quotation.discount_value}%)`
                      : 'Discount'}
                  </Text>
                  <Text style={s.investDiscountValue}>- {fmt(discountAmt)}</Text>
                </View>
              )}
              {quotation.include_gst && gstTotal > 0 && (
                <View style={s.investRow}>
                  <Text style={s.investLabel}>
                    {quotation.is_igst
                      ? `IGST (${quotation.gst_rate}%)`
                      : `GST (${quotation.gst_rate}%)`}
                  </Text>
                  <Text style={s.investValue}>{fmt(gstTotal)}</Text>
                </View>
              )}
              <View style={[s.investTotalRow, { backgroundColor: '#eff6ff' }]}>
                <Text style={[s.investTotalLabel, { color: SLATE }]}>Project Investment</Text>
                <Text style={[s.investTotalValue, { color: BLUE }]}>{fmt(quotation.total_amount)}</Text>
              </View>
            </View>
          </View>

          {/* 7 · Payment Schedule */}
          {schedule.length > 0 && (
            <View style={s.schedWrap}>
              <View style={s.schedHeader}>
                <View style={[s.schedThCell, s.schedCol1]}><Text style={s.schedThText}>PAYMENT TERM</Text></View>
                <View style={[s.schedThCell, s.schedCol2]}><Text style={s.schedThText}>AMOUNT</Text></View>
              </View>
              {schedule.map((item, i) => (
                <View key={i} style={i < schedule.length - 1 ? s.schedRow : s.schedRowLast}>
                  <View style={[s.schedTdCell, s.schedCol1]}>
                    <Text style={s.schedTdText}>
                      {item.label || `Payment ${i + 1}`}
                      {item.milestone ? ` \u2014 ${item.milestone}` : ''}
                    </Text>
                  </View>
                  <View style={[s.schedTdCell, s.schedCol2]}>
                    <Text style={s.schedTdText}>{fmt(item.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 8 · Closing banner */}
          <View style={[s.navyBanner, { backgroundColor: SLATE }]}>
            <Text style={s.navyBannerText}>LET&apos;S BUILD SOMETHING GREAT TOGETHER!</Text>
          </View>

          <PageFooter website="www.ratixinfo.com" />
        </Page>

        {/* ════════════════════════ PAGE 2 ════════════════════════ */}
        <Page size="A4" style={s.page2}>

          {/* Compact header */}
          <View style={[s.headerBarCompact, { backgroundColor: SLATE }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {logoSrc && <Image src={logoSrc} style={{ width: 32, height: 32, marginRight: 8 }} />}
              <Text style={s.brandNameSm}>{(quotation.sub_brand || '').toUpperCase()}</Text>
            </View>
            <Text style={s.headerContact}>Scope of Work</Text>
          </View>
          <View style={[s.redStripe, { backgroundColor: BLUE }]} />

          {/* Scope of Work banner */}
          <View style={[s.navyBanner, { backgroundColor: SLATE, marginTop: 0, paddingVertical: 14 }]}>
            <Text style={[s.navyBannerText, { fontSize: 13 }]}>SCOPE OF WORK</Text>
          </View>

          {/* Services by category */}
          {hasServices && (
            <View style={s.sectionWrap}>
              <SectionHeading title="Deliverable Services" />
              {Object.entries(ratixServices).map(([category, services]) => {
                if (!services || services.length === 0) return null;
                return (
                  <View key={category}>
                    <Text style={s.categoryLabel}>{category}</Text>
                    {services.map((svc, i) => (
                      <View key={i} style={s.serviceItem}>
                        <Text style={[s.serviceBullet, { color: BLUE }]}>{'\u2014'}</Text>
                        <Text style={s.serviceText}>{svc}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Custom / additional deliverable */}
          {hasCustom && (
            <View style={s.sectionWrap}>
              <SectionHeading title="Additional Deliverables" />
              <View style={s.serviceItem}>
                <Text style={[s.serviceBullet, { color: BLUE }]}>{'\u2014'}</Text>
                <Text style={s.serviceText}>{ratixinfoData!.customService}</Text>
              </View>
            </View>
          )}

          {/* Development Process */}
          <View style={s.processWrap}>
            <Text style={[s.processTitle, { color: SLATE }]}>Our Development Process</Text>
            {RATIX_PROCESS_STEPS.map((step, i) => (
              <View key={i} style={s.processStep}>
                <View style={[s.stepBubble, { backgroundColor: BLUE }]}>
                  <Text style={s.stepNum}>{i + 1}</Text>
                </View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Closing banner */}
          <View style={[s.navyBanner, { backgroundColor: SLATE, marginHorizontal: PAD, borderRadius: 4 }]}>
            <Text style={s.navyBannerText}>LET&apos;S BUILD SOMETHING GREAT TOGETHER!</Text>
          </View>

          {/* Terms */}
          {termsLines.length > 0 && (
            <View style={s.termsWrap}>
              <Text style={[s.termsTitle, { color: SLATE }]}>Terms &amp; Conditions</Text>
              {termsLines.map((line, i) => (
                <View key={i} style={s.termsRow}>
                  <Text style={s.termsBullet}>{'\u2022'}</Text>
                  <Text style={s.termsText}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          <PageFooter website="www.ratixinfo.com" />
        </Page>

      </Document>
    );
  }

  // ── Fallback / legacy single-page proposal (non-Ritera or plain-text notes) ─

  const legacyItems = quotation.items.filter(i => i.description.trim());
  const legacyNotesLines = (quotation.notes || '').split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={s.legacyPage}>

        {/* Header */}
        <View style={s.headerBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {logoSrc && (
              <Image src={logoSrc} style={{ width: 48, height: 48, marginRight: 12 }} />
            )}
            <View>
              <Text style={s.brandName}>{(quotation.sub_brand || businessSettings?.gst_name || '').toUpperCase()}</Text>
              <Text style={s.brandTagline}>A GLOBAL SELF-PUBLISHING COMPANY</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {contactLines.map((l, i) => <Text key={i} style={s.headerContact}>{l}</Text>)}
          </View>
        </View>

        <View style={s.redStripe} />

        {/* Title bar */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>YOUR PUBLISHING PROPOSAL</Text>
          <Text style={s.titleMeta}>{`Ref: ${quotation.quotation_number}   |   Date: ${dmy(quotation.date)}`}</Text>
        </View>

        {/* Welcome */}
        {clientName ? (
          <View style={s.welcome}>
            <Text style={s.welcomeText}>
              {`We\u2019re excited to begin this journey with you, ${clientName}.`}
            </Text>
          </View>
        ) : null}

        {/* Author details */}
        <View style={s.tableWrap}>
          {authorRows.map((row, i) => (
            <InfoRow key={i} label={row.label} value={row.value} last={i === authorRows.length - 1} />
          ))}
        </View>

        {/* Investment Summary */}
        <View style={s.investWrap}>
          <View style={s.investBox}>
            <View style={s.investHeader}>
              <Text style={s.investHeaderText}>INVESTMENT SUMMARY</Text>
            </View>
            <View style={s.investRow}>
              <Text style={s.investLabel}>Total Value</Text>
              <Text style={s.investValue}>{fmt(subtotal)}</Text>
            </View>
            {discountAmt > 0 && (
              <View style={s.investRowAlt}>
                <Text style={s.investLabel}>Discount</Text>
                <Text style={s.investDiscountValue}>- {fmt(discountAmt)}</Text>
              </View>
            )}
            {quotation.include_gst && gstTotal > 0 && (
              <View style={s.investRow}>
                <Text style={s.investLabel}>
                  {quotation.is_igst ? `IGST (${quotation.gst_rate}%)` : `GST (${quotation.gst_rate}%)`}
                </Text>
                <Text style={s.investValue}>{fmt(gstTotal)}</Text>
              </View>
            )}
            <View style={s.investTotalRow}>
              <Text style={s.investTotalLabel}>Final Investment</Text>
              <Text style={s.investTotalValue}>{fmt(quotation.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Payment schedule */}
        {schedule.length > 0 && (
          <View style={s.schedWrap}>
            <View style={s.schedHeader}>
              <View style={[s.schedThCell, s.schedCol1]}><Text style={s.schedThText}>PAYMENT TERM</Text></View>
              <View style={[s.schedThCell, s.schedCol2]}><Text style={s.schedThText}>AMOUNT</Text></View>
            </View>
            {schedule.map((item, i) => (
              <View key={i} style={i < schedule.length - 1 ? s.schedRow : s.schedRowLast}>
                <View style={[s.schedTdCell, s.schedCol1]}>
                  <Text style={s.schedTdText}>
                    {item.label || `Payment ${i + 1}`}
                    {item.milestone ? ` \u2014 ${item.milestone}` : ''}
                  </Text>
                </View>
                <View style={[s.schedTdCell, s.schedCol2]}>
                  <Text style={s.schedTdText}>{fmt(item.amount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Deliverables (from items) */}
        {legacyItems.length > 0 && (
          <View style={s.legacySection}>
            <Text style={s.legacySectionTitle}>What We Will Deliver</Text>
            {legacyItems.map((item, i) => (
              <View key={i} style={s.legacyItemRow}>
                <Text style={s.legacyBullet}>{'\u2714'}</Text>
                <Text style={s.legacyItemDesc}>{item.description}</Text>
                {item.amount > 0 && <Text style={s.legacyItemAmt}>{fmt(item.amount)}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {legacyNotesLines.length > 0 && (
          <View style={s.legacySection}>
            <Text style={s.legacySectionTitle}>Notes</Text>
            {legacyNotesLines.map((line, i) => (
              <Text key={i} style={[s.legacyItemDesc, { marginBottom: 3, lineHeight: 1.5 }]}>{line}</Text>
            ))}
          </View>
        )}

        {/* Terms */}
        {termsLines.length > 0 && (
          <View style={s.legacySection}>
            <Text style={s.legacySectionTitle}>Terms &amp; Conditions</Text>
            {termsLines.map((line, i) => (
              <View key={i} style={s.termsRow}>
                <Text style={s.termsBullet}>{'\u2022'}</Text>
                <Text style={s.termsText}>{line}</Text>
              </View>
            ))}
          </View>
        )}

        <PageFooter />
      </Page>
    </Document>
  );
}
