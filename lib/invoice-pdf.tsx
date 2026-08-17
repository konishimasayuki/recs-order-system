import fs from "fs";
import path from "path";
import React from "react";
import * as fontkit from "fontkit";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFontsRegistered, findFont } from "./pdf-fonts";

type FontkitFont = ReturnType<typeof fontkit.openSync>;

/** 発行元ブロックの1行（ラベルと、折り返しを含む値の各行） */
type InfoRow = { label: string; lines: string[] };
import {
  Order,
  PRODUCT_NAME_MAIN,
  PRODUCT_NAME_SUB,
  SellerSettings,
  calcAmounts,
  formatDate,
  yen
} from "./types";

/** 発行元ブロックの行送り。ロゴの縦位置の計算にも使う */
const LINE_HEIGHT = 1.55;

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
  billToWrap: { width: "46%" },
  billTo: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1.5pt solid #1a1a1a",
    paddingBottom: 4
  },
  billToAddress: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 10 },
  sellerBox: { width: "50%", fontSize: 9, lineHeight: LINE_HEIGHT },
  sellerRow: { flexDirection: "row", alignItems: "center" },
  sellerInfo: { flex: 1 },
  // 社印（横判）風：社名を大きく、下にラベル右揃えの2列で住所・Tel等を組む
  stampName: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.2,
    marginBottom: 5
  },
  infoRow: { flexDirection: "row", marginBottom: 1 },
  infoValue: { flex: 1 },
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

// ロゴはビルドに同梱した public の画像を読む。無ければ載せずに生成を続ける
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

/**
 * 文字列の描画幅。ラベル列の幅を実測値で決め、
 * 「〒」の先頭を社名の1文字目の真下に置くために使う。
 * フォントを読めない環境では概算（半角0.55em・全角1em）にフォールバックする。
 */
let metricsFont: FontkitFont | null | undefined;
function textWidth(value: string, fontSize: number): number {
  if (metricsFont === undefined) {
    try {
      metricsFont = fontkit.openSync(findFont("NotoSansJP-Regular.ttf"));
    } catch (err) {
      console.error("[recsgps] フォントの実測に失敗したため概算幅を使います:", err);
      metricsFont = null;
    }
  }
  if (metricsFont) {
    const run = metricsFont.layout(value);
    return (run.advanceWidth / metricsFont.unitsPerEm) * fontSize;
  }
  let width = 0;
  for (const ch of value) {
    width += /[ -~｡-ﾟ]/.test(ch) ? fontSize * 0.55 : fontSize;
  }
  return width;
}

/** PNGヘッダから縦横比を読む（歪ませずに表示するため） */
function pngAspect(buffer: Buffer): number {
  if (buffer.length > 24 && buffer.readUInt32BE(12) === 0x49484452 /* IHDR */) {
    const w = buffer.readUInt32BE(16);
    const h = buffer.readUInt32BE(20);
    if (w > 0 && h > 0) return w / h;
  }
  return 1;
}

/**
 * 住所を「都道府県＋市区町村」と「それ以降」で分けて2行にする。
 * 途中の半端な位置で折り返さず、常に区切りのよいところで改行させる。
 * 政令市は行政区（福岡市中央区の「中央区」）まで1行目に含める。
 */
function splitAddress(address: string): string[] {
  const value = address.trim();
  if (!value) return [];
  const prefecture = value.match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/);
  const afterPrefecture = prefecture ? value.slice(prefecture[0].length) : value;
  const city = afterPrefecture.match(/^.+?[市区町村]/);
  if (!city) return [value];

  let head = (prefecture?.[0] ?? "") + city[0];
  let rest = afterPrefecture.slice(city[0].length);
  if (city[0].endsWith("市")) {
    // 区名は数字・空白を含まない短い語。丁目や建物名を巻き込まないよう字数で制限する
    const ward = rest.match(/^[^\s\d０-９]{1,4}区/);
    if (ward) {
      head += ward[0];
      rest = rest.slice(ward[0].length);
    }
  }

  const tail = rest.trim();
  return tail ? [head, tail] : [head];
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
  const logoHeight = 34;
  const logoColumnWidth = logo ? logoHeight * pngAspect(logo) + 10 : 0;

  // ロゴは社名＋住所の横に置くため、住所行だけ他の行と分けて持つ
  const addressRow: InfoRow | null =
    seller.postalCode || seller.address
      ? { label: seller.postalCode || "住所", lines: splitAddress(seller.address) }
      : null;
  const otherRows: InfoRow[] = [];
  if (seller.tel) otherRows.push({ label: "Tel", lines: [seller.tel] });
  if (seller.fax) otherRows.push({ label: "Fax", lines: [seller.fax] });
  if (seller.registrationNumber) {
    otherRows.push({ label: "登録番号", lines: [seller.registrationNumber] });
  }
  if (seller.contact) otherRows.push({ label: "担当", lines: [seller.contact] });
  // 一番長いラベル（通常は〒＋郵便番号）がぴったり収まる幅にして、
  // 右揃えでも先頭文字が社名の1文字目の真下に来るようにする
  const labelWidth = Math.max(
    0,
    ...[...(addressRow ? [addressRow] : []), ...otherRows].map((r) => textWidth(r.label, 9))
  );

  const infoRow = (row: InfoRow) => (
    <View key={row.label} style={styles.infoRow}>
      <Text style={{ width: labelWidth, textAlign: "right", marginRight: 10 }}>
        {row.label}
      </Text>
      <View style={styles.infoValue}>
        {row.lines.map((text, i) => (
          <Text key={i}>{text}</Text>
        ))}
      </View>
    </View>
  );

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
            {/* ロゴは社名＋住所のグループに対して縦中央。
                社名の1文字目とラベル列の左端はロゴ列の幅で揃う */}
            <View style={styles.sellerRow}>
              <View style={{ width: logoColumnWidth }}>
                {logo ? (
                  <Image
                    style={{ height: logoHeight, width: logoHeight * pngAspect(logo) }}
                    src={{ data: logo, format: "png" }}
                  />
                ) : null}
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.stampName}>{seller.name}</Text>
                {addressRow ? infoRow(addressRow) : null}
              </View>
            </View>
            <View style={styles.sellerRow}>
              <View style={{ width: logoColumnWidth }} />
              <View style={styles.sellerInfo}>{otherRows.map(infoRow)}</View>
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
