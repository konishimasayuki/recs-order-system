import { AppState, Delivery, Order, deliveredQuantity } from "./types";

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

export function summarize(orders: Order[], deliveries: Delivery[]): Summary {
  const active = orders.filter(isActive);
  const orderedQuantity = active.reduce((s, o) => s + o.quantity, 0);
  const activeIds = new Set(active.map((o) => o.id));
  const delivered = deliveries
    .filter((d) => activeIds.has(d.orderId))
    .reduce((s, d) => s + d.quantity, 0);

  const invoicedAmount = active
    .filter((o) => o.invoiceNumber && o.unitPrice !== null)
    .reduce((s, o) => s + o.quantity * (o.unitPrice ?? 0), 0);

  return {
    orderCount: active.length,
    orderedQuantity,
    deliveredQuantity: delivered,
    pendingQuantity: Math.max(0, orderedQuantity - delivered),
    invoicedAmount,
    awaitingInvoiceCount: active.filter((o) => !o.invoiceNumber).length
  };
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
