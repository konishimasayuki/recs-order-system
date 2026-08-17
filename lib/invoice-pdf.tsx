import fs from "fs";
import path from "path";
import React from "react";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFontsRegistered } from "./pdf-fonts";
import {
  Order,
  PRODUCT_NAME_MAIN,
  PRODUCT_NAME_SUB,
  SellerSettings,
  calcAmounts,
  formatDate,
  yen
} from "./types";

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 40, color: "#1a1a1a" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 4
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  billToWrap: { width: "52%" },
  billTo: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1.5pt solid #1a1a1a",
    paddingBottom: 4
  },
  billToAddress: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 10 },
  sellerBox: { width: "44%", fontSize: 9, lineHeight: 1.55 },
  sellerRow: { flexDirection: "row", alignItems: "center" },
  sellerLogo: { width: 40, height: 40, marginRight: 8 },
  sellerInfo: { flex: 1 },
  // 社印（横判ゴム印）風：住所・社名・TEL を判子の文字組で重ねる
  stampAddress: { fontSize: 8.5, fontWeight: "bold", letterSpacing: 0.4, textAlign: "center" },
  stampName: {
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 0.8,
    textAlign: "center",
    marginTop: 2
  },
  stampTel: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 4
  },
  sellerMeta: { fontSize: 8.5, textAlign: "center" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  metaBox: { fontSize: 9, textAlign: "right", lineHeight: 1.5 },
  totalBanner: {
    backgroundColor: "#f2f4f7",
    padding: 10,
    marginTop: 6,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: { fontSize: 11 },
  totalValue: { fontSize: 16, fontWeight: "bold" },
  table: { marginTop: 8, borderTop: "1pt solid #333", borderBottom: "1pt solid #333" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#eef1f5",
    paddingVertical: 6,
    fontWeight: "bold"
  },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottom: "0.5pt solid #ddd" },
  colItem: { width: "42%", paddingHorizontal: 6 },
  itemSub: { fontSize: 8.5, color: "#666", marginTop: 2 },
  colQty: { width: "14%", paddingHorizontal: 6, textAlign: "right" },
  colUnit: { width: "22%", paddingHorizontal: 6, textAlign: "right" },
  colAmount: { width: "22%", paddingHorizontal: 6, textAlign: "right" },
  summaryTable: { marginTop: 10, alignSelf: "flex-end", width: "45%" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  summaryRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTop: "1pt solid #333"
  },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  bankBox: { fontSize: 10, lineHeight: 1.6, backgroundColor: "#f8f8f8", padding: 10 },
  noticeBox: {
    marginTop: 16,
    padding: 10,
    border: "1pt solid #c0392b",
    backgroundColor: "#fdf1f0"
  },
  noticeText: { fontSize: 10.5, fontWeight: "bold", color: "#c0392b" },
  footerNote: { marginTop: 26, fontSize: 8, color: "#888", textAlign: "center" }
});

function line(value: string): string {
  return value && value.trim() ? value : "—";
}

// ロゴ・社印はビルドに同梱した public の画像を読む。無ければ載せずに生成を続ける
const assetCache = new Map<string, Buffer | null>();
function loadAsset(name: string): Buffer | null {
  if (!assetCache.has(name)) {
    try {
      assetCache.set(name, fs.readFileSync(path.join(process.cwd(), "public", name)));
    } catch {
      assetCache.set(name, null);
    }
  }
  return assetCache.get(name) ?? null;
}

export function InvoiceDocument({
  order,
  seller
}: {
  order: Order;
  seller: SellerSettings;
}) {
  ensureFontsRegistered();

  const logo = loadAsset("logo.png");
  const unitPrice = order.unitPrice ?? 0;
  const amounts = calcAmounts(order.quantity, unitPrice);
  const hasBank = Boolean(seller.bankName || seller.accountNumber || seller.accountHolder);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>請求書</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text>請求書番号：{line(order.invoiceNumber ?? "")}</Text>
            <Text>発行日：{formatDate(order.invoicedAt ?? new Date().toISOString())}</Text>
            <Text>注文番号：{order.orderNumber}</Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.billToWrap}>
            <Text style={styles.billTo}>{order.companyName} 御中</Text>
            <Text style={styles.billToAddress}>{order.shippingAddress}</Text>
            {order.contactName ? <Text style={{ fontSize: 9.5 }}>ご担当：{order.contactName}</Text> : null}
          </View>

          <View style={styles.sellerBox}>
            <View style={styles.sellerRow}>
              {logo ? (
                <Image style={styles.sellerLogo} src={{ data: logo, format: "png" }} />
              ) : null}
              <View style={styles.sellerInfo}>
                {seller.postalCode || seller.address ? (
                  <Text style={styles.stampAddress}>
                    {seller.postalCode} {seller.address}
                  </Text>
                ) : null}
                <Text style={styles.stampName}>{seller.name}</Text>
                {seller.tel ? (
                  <Text style={styles.stampTel}>
                    TEL {seller.tel}
                    {seller.fax ? `　FAX ${seller.fax}` : ""}
                  </Text>
                ) : null}
                {seller.registrationNumber ? (
                  <Text style={styles.sellerMeta}>登録番号：{seller.registrationNumber}</Text>
                ) : null}
                {seller.contact ? (
                  <Text style={styles.sellerMeta}>担当：{seller.contact}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>ご請求金額（税込）</Text>
          <Text style={styles.totalValue}>{yen(amounts.totalAmount)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colItem}>品名</Text>
            <Text style={styles.colQty}>数量</Text>
            <Text style={styles.colUnit}>単価（税込）</Text>
            <Text style={styles.colAmount}>金額（税込）</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.colItem}>
              <Text>{PRODUCT_NAME_MAIN}</Text>
              <Text style={styles.itemSub}>{PRODUCT_NAME_SUB}</Text>
            </View>
            <Text style={styles.colQty}>{amounts.quantity}</Text>
            <Text style={styles.colUnit}>{yen(amounts.unitPrice)}</Text>
            <Text style={styles.colAmount}>{yen(amounts.totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.summaryTable}>
          <View style={styles.summaryRow}>
            <Text>小計（税抜）</Text>
            <Text>{yen(amounts.subtotalExcludingTax)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>消費税（10%）</Text>
            <Text>{yen(amounts.taxAmount)}</Text>
          </View>
          <View style={styles.summaryRowFinal}>
            <Text style={{ fontWeight: "bold" }}>合計（税込）</Text>
            <Text style={{ fontWeight: "bold" }}>{yen(amounts.totalAmount)}</Text>
          </View>
        </View>

        {seller.paymentTerms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>お支払期限</Text>
            <Text>{seller.paymentTerms}</Text>
          </View>
        ) : null}

        {hasBank ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>お振込先</Text>
            <View style={styles.bankBox}>
              <Text>
                {seller.bankName} {seller.branchName}　{seller.accountType}　{seller.accountNumber}
              </Text>
              <Text>{seller.accountHolder}</Text>
            </View>
          </View>
        ) : null}

        {seller.invoiceNotice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>※ {seller.invoiceNotice}</Text>
          </View>
        ) : null}

        <Text style={styles.footerNote}>
          この請求書は適格請求書等保存方式（インボイス制度）に対応しています。
        </Text>
      </Page>
    </Document>
  );
}
