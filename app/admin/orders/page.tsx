import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import OrdersFilter from "@/components/OrdersFilter";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { allOrders, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { ORDER_STATUS_LABEL, OrderStatus, deliveredQuantity, formatDate, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_KEYS: OrderStatus[] = ["pending", "invoiced", "delivered", "cancelled"];

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: { status?: string; company?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users.filter((u) => u.role === "customer");

  const statusFilter = searchParams.status || "all";
  const companyFilter = searchParams.company || "all";

  let orders = allOrders(state);
  if (statusFilter !== "all") {
    orders = orders.filter((o) => o.status === (statusFilter as OrderStatus));
  }
  if (companyFilter !== "all") {
    orders = orders.filter((o) => o.userId === companyFilter);
  }

  const summary = summarize(orders, state.deliveries);
  const countByStatus = (s: OrderStatus) =>
    state.orders.filter((o) => o.status === s).length;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/orders" />

      <div className="container">
        <div className="card">
          <h2 className="card-title">受注一覧</h2>
          <p className="card-desc">
            表示中 {summary.orderCount} 件／{summary.orderedQuantity.toLocaleString("ja-JP")} 台
            （納品済 {summary.deliveredQuantity.toLocaleString("ja-JP")} 台）
          </p>

          <OrdersFilter
            status={statusFilter}
            company={companyFilter}
            statusOptions={[
              { value: "all", label: `すべて（${state.orders.length} 件）` },
              ...STATUS_KEYS.map((s) => ({
                value: s,
                label: `${ORDER_STATUS_LABEL[s]}（${countByStatus(s)} 件）`
              }))
            ]}
            companyOptions={[
              { value: "all", label: "すべての発注元" },
              ...customers.map((c) => ({ value: c.id, label: c.companyName }))
            ]}
          />

          {orders.length === 0 ? (
            <div className="empty-state">該当する受注はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>注文番号</th>
                    <th>発注元</th>
                    <th>注文日</th>
                    <th className="num">台数</th>
                    <th className="num">納品済</th>
                    <th className="num">単価</th>
                    <th className="num">金額（税込）</th>
                    <th>状況</th>
                    <th>請求書</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const delivered = deliveredQuantity(order.id, state.deliveries);
                    return (
                      <tr key={order.id}>
                        <td className="mono" data-label="注文番号">{order.orderNumber}</td>
                        <td data-label="発注元">{order.companyName}</td>
                        <td className="mono" data-label="注文日">{formatDate(order.orderedAt)}</td>
                        <td className="num" data-label="台数">{order.quantity}</td>
                        <td className="num" data-label="納品済">{delivered}</td>
                        <td className="num" data-label="単価">
                          {order.unitPrice === null ? (
                            <span className="muted">未入力</span>
                          ) : (
                            yen(order.unitPrice)
                          )}
                        </td>
                        <td
                          className={order.unitPrice === null ? "num sm-empty" : "num"}
                          data-label="金額（税込）"
                        >
                          {order.unitPrice === null ? (
                            <span className="muted">—</span>
                          ) : (
                            yen(order.quantity * order.unitPrice)
                          )}
                        </td>
                        <td data-label="状況">
                          <StatusBadge
                            status={order.status}
                            delivered={delivered}
                            quantity={order.quantity}
                          />
                        </td>
                        <td className="mono" data-label="請求書">
                          {order.invoiceNumber ? (
                            <a
                              className="link"
                              href={`/api/invoice/${order.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {order.invoiceNumber}
                            </a>
                          ) : (
                            <span className="muted">未発行</span>
                          )}
                        </td>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="link">
                            詳細
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
