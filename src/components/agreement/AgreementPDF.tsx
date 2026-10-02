import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: '#1f2937', lineHeight: 1.6 },
  eyebrow: { color: '#64748b', fontSize: 9, letterSpacing: 1.5, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 22 },
  body: {},
  notice: { marginTop: 28, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', color: '#92400e', fontSize: 9 },
});

export function AgreementPDF({ title, content }: { title: string; content: string }) {
  return <Document><Page size="A4" style={styles.page}><View><Text style={styles.eyebrow}>AGREEMENT PREVIEW</Text><Text style={styles.title}>{title}</Text><Text style={styles.body}>{content}</Text><Text style={styles.notice}>Sample generated document. Review and execute the final legal terms before relying on it.</Text></View></Page></Document>;
}
