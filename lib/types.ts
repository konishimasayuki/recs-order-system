// RECSGPS 注文システム — 共通の型と定数

export const PRODUCT_NAME = "RECSGPS（リモート始動阻止装置／GPS装置）";
/** 請求書の品名欄で折り返さないよう2行に分けて表示する */
export const PRODUCT_NAME_MAIN = "RECSGPS";
export const PRODUCT_NAME_SUB = "リモート始動阻止装置／GPS装置";
export const TAX_RATE = 0.1; // 消費税率 10%

export type Role = "customer" | "admin";

/** 発注アカウント／受注アカウント */
export interface User {
  id: string;
  loginId: string;
  passwordHash: string;
  role: Role;
  companyName: string;
  contactName: string;
  email: string;
  postalCode: string;
  address: string;
  tel: string;
  /** 顧客ごとの標準単価（税込・円）。未設定は null */
  defaultUnitPrice: number | null;
  active: boolean;
  createdAt: string;
}

export type OrderStatus = "pending" | "invoiced" | "delivered" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "受付済",
  invoiced: "請求書発行済",
  delivered: "納品完了",
  cancelled: "キャンセル"
};

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  /** 発注時点の会社名（アカウント名変更に影響されないよう控えを持つ） */
  companyName: string;
  contactName: string;
  email: string;
  quantity: number;
  /** 税込単価（円）。受注側が確定するまで null */
  unitPrice: number | null;
  shippingAddress: string;
  note: string;
  status: OrderStatus;
  orderedAt: string; // ISO
  /** 請求書番号・発行日（発行済みのみ） */
  invoiceNumber: string | null;
  invoicedAt: string | null;
  desiredDeliveryDate: string; // YYYY-MM-DD、空文字可
}

export interface Delivery {
  id: string;
  orderId: string;
  quantity: number;
  deliveredAt: string; // YYYY-MM-DD
  trackingNumber: string;
  note: string;
  createdAt: string;
}

/** 請求元（MIAMIホールディングス）情報。管理画面から編集する */
export interface SellerSettings {
  name: string;
  postalCode: string;
  address: string;
  tel: string;
  fax: string;
  contact: string;
  registrationNumber: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  /** 請求書の備考・支払期限などの注記 */
  invoiceNotice: string;
  paymentTerms: string;
}

export const DEFAULT_SELLER: SellerSettings = {
  name: "MIAMIホールディングス株式会社",
  postalCode: "",
  address: "",
  tel: "",
  fax: "",
  contact: "",
  registrationNumber: "",
  bankName: "",
  branchName: "",
  accountType: "普通",
  accountNumber: "",
  accountHolder: "",
  invoiceNotice: "お振込み確認後、製作・出荷に入ります。あらかじめご了承ください。",
  paymentTerms: "請求書発行日の翌月末日"
};

export interface AppState {
  users: User[];
  orders: Order[];
  deliveries: Delivery[];
  seller: SellerSettings;
  counters: { order: number; invoice: number };
}

// --- 金額計算（インボイス制度対応：税込金額から消費税を逆算） ---

export interface Amounts {
  quantity: number;
  unitPrice: number;
  subtotalExcludingTax: number;
  taxAmount: number;
  totalAmount: number;
}

export function calcAmounts(quantity: number, unitPrice: number): Amounts {
  const q = Math.max(0, Math.floor(quantity));
  const totalAmount = q * unitPrice;
  const taxAmount = Math.round((totalAmount * TAX_RATE) / (1 + TAX_RATE));
  return {
    quantity: q,
    unitPrice,
    subtotalExcludingTax: totalAmount - taxAmount,
    taxAmount,
    totalAmount
  };
}

export function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/** 注文に対する納品済み台数 */
export function deliveredQuantity(orderId: string, deliveries: Delivery[]): number {
  return deliveries
    .filter((d) => d.orderId === orderId)
    .reduce((sum, d) => sum + d.quantity, 0);
}

/** 一覧カードの色分けクラス名（StatusBadge の一部納品判定と揃える） */
export function statusTone(status: OrderStatus, delivered: number): string {
  const partial = status !== "cancelled" && status !== "delivered" && delivered > 0;
  return `tone-${partial ? "partial" : status}`;
}
