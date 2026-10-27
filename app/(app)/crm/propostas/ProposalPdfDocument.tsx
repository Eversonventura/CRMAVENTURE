import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 11, color: "#1a1a1a" },
  brand: { fontSize: 18, fontWeight: 700, color: "#FF007A" },
  title: { fontSize: 16, marginTop: 6, fontWeight: 700 },
  meta: { fontSize: 10, color: "#666", marginTop: 2 },
  section: { marginTop: 18 },
  label: { fontSize: 9, color: "#888", textTransform: "uppercase", marginBottom: 4 },
  value: { fontSize: 12, lineHeight: 1.5 },
  valuePill: {
    fontSize: 20,
    fontWeight: 700,
    color: "#FF007A",
  },
  row: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
});

export function ProposalPdfDocument({
  companyName,
  presentedAt,
  value,
  validityDate,
  decisionMakers,
  objections,
  agreedResponseDate,
}: {
  companyName: string;
  presentedAt: string | null;
  value: number | null;
  validityDate: string | null;
  decisionMakers: string | null;
  objections: string | null;
  agreedResponseDate: string | null;
}) {
  const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—");
  const fmtCurrency = (v: number | null) =>
    v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>aventure</Text>
        <Text style={styles.title}>Proposta comercial — {companyName}</Text>
        <Text style={styles.meta}>Apresentada em {fmt(presentedAt)}</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Valor</Text>
          <Text style={styles.valuePill}>{fmtCurrency(value)}</Text>
        </View>

        <View style={[styles.section, styles.row]}>
          <View style={styles.col}>
            <Text style={styles.label}>Validade</Text>
            <Text style={styles.value}>{fmt(validityDate)}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Resposta combinada até</Text>
            <Text style={styles.value}>{fmt(agreedResponseDate)}</Text>
          </View>
        </View>

        {decisionMakers && (
          <View style={styles.section}>
            <Text style={styles.label}>Quem decide</Text>
            <Text style={styles.value}>{decisionMakers}</Text>
          </View>
        )}

        {objections && (
          <View style={styles.section}>
            <Text style={styles.label}>Objeções levantadas</Text>
            <Text style={styles.value}>{objections}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
