import {
  AppState,
  Delivery,
  Invoice,
  Order,
  billableQuantity,
  calcInvoiceAmounts,
  deliveredQuantity
} from "./types";

export interface Summary {
  orderCount: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  pendingQuantity: number;
  invoicedAmount: number;
  awaitingInvoiceCount: number;
}

function isActive(order: Order): boolean {
  return order.status !== "cancelled";
}

export function summarize(
  orders: Order[],
  deliveries: Delivery[],
  invoices: Invoice[] = []
): Summary {
  const active = orders.filter(isActive);
  const orderedQuantity = active.reduce((s, o) => s + o.quantity, 0);
  const activeIds = new Set(active.map((o) => o.id));
  const delivered = deliveries
    .filter((d) => activeIds.has(d.orderId))
    .reduce((s, d) => s + d.quantity, 0);

  // 請求済金額は請求書の明細から数える（分割請求・まとめ請求に対応）
  const invoicedAmount = invoices
    .filter((inv) => inv.lines.some((l) => activeIds.has(l.orderId)))
    .reduce(
      (s, inv) =>
        s +
        inv.lines
          .filter((l) => activeIds.has(l.orderId))
          .reduce((t, l) => t + l.quantity * l.unitPrice, 0),
      0
    );

  return {
    orderCount: active.length,
    orderedQuantity,
    deliveredQuantity: delivered,
    pendingQuantity: Math.max(0, orderedQuantity - delivered),
    invoicedAmount,
    // 納品済みで単価も決まっているのに、まだ請求していない台数が残る注文
    awaitingInvoiceCount: active.filter(
      (o) => billableQuantity(o, deliveries, invoices) > 0
    ).length
  };
}

/** 請求書を新しい順に並べる（発注元で絞り込める） */
export function invoicesOf(state: AppState, userId?: string): Invoice[] {
  return state.invoices
    .filter((inv) => !userId || inv.userId === userId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

/** 請求書1枚の合計金額（一覧の表示用） */
export function invoiceTotal(invoice: Invoice): number {
  return calcInvoiceAmounts(invoice).totalAmount;
}

export function ordersOf(state: AppState, userId: string): Order[] {
  return state.orders
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
}

export function allOrders(state: AppState): Order[] {
  return [...state.orders].sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
}

export function deliveriesOf(state: AppState, orderIds: Set<string>): Delivery[] {
  return state.deliveries
    .filter((d) => orderIds.has(d.orderId))
    .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
}

export interface CustomerRollup {
  userId: string;
  companyName: string;
  orderCount: number;
  orderedQuantity: number;
  deliveredQuantity: number;
}

export function rollupByCustomer(state: AppState): CustomerRollup[] {
  const rows = new Map<string, CustomerRollup>();

  for (const user of state.users.filter((u) => u.role === "customer")) {
    rows.set(user.id, {
      userId: user.id,
      companyName: user.companyName,
      orderCount: 0,
      orderedQuantity: 0,
      deliveredQuantity: 0
    });
  }

  for (const order of state.orders) {
    if (order.status === "cancelled") continue;
    const row = rows.get(order.userId);
    if (!row) continue;
    row.orderCount += 1;
    row.orderedQuantity += order.quantity;
    row.deliveredQuantity += deliveredQuantity(order.id, state.deliveries);
  }

  return [...rows.values()].sort((a, b) => b.orderedQuantity - a.orderedQuantity);
}
