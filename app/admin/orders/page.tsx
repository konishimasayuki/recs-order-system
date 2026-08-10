import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { allOrders, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { ORDER_STATUS_LABEL, OrderStatus, deliveredQuantity, formatDate, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "受付済" },
  { key: "invoiced", label: "請求書発行済" },
  { key: "delivered", label: "納品完了" },
  { key: "cancelled", label: "キャンセル" }
];

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: { status?: string; company?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users.filter((u) => u.role === "customer");

  let orders = allOrders(state);
  const statusFilter = searchParams.status ?? "all";
  const companyFilter = searchParams.company ?? "all";

  if (statusFilter !== "all") {
    orders = orders.filter((o) => o.status === (statusFilter as OrderStatus));
  }
  if (companyFilter !== "all") {
    orders = orders.filter((o) => o.userId === companyFilter);
  }

  const summary = summarize(orders, state.deliveries);

  function buildHref(next: { status?: string; company?: string }): string {
    const params = new URLSearchParams();
    const status = next.status ?? statusFilter;
    const company = next.company ?? companyFilter;
    if (status !== "all") params.set("status", status);
    if (company !== "all") params.set("company", company);
    const qs = params.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  }

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

          <div className="action-row" style={{ marginBottom: 10 }}>
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={buildHref({ status: f.key })}
                className={`btn btn-sm ${statusFilter === f.key ? "btn-primary" : "btn-outline"}`}
              >
                {f.label}
              </Link>
            ))}
          </div>

          <div className="action-row" style={{ marginBottom: 18 }}>
            <Link
              href={buildHref({ company: "all" })}
              className={`btn btn-sm ${companyFilter === "all" ? "btn-primary" : "btn-outline"}`}
            >
              全社
            </Link>
            {customers.map((c) => (
              <Link
                key={c.id}
                href={buildHref({ company: c.id })}
                className={`btn btn-sm ${companyFilter === c.id ? "btn-primary" : "btn-outline"}`}
              >
                {c.companyName}
              </Link>
            ))}
          </div>

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
                        <td className="num" data-label="金額（税込）">
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

        <p className="site-footer">
          状況の内訳：{Object.entries(ORDER_STATUS_LABEL)
            .map(([k, v]) => `${v}=${state.orders.filter((o) => o.status === k).length}`)
            .join("　")}
        </p>
      </div>
    </div>
  );
}
