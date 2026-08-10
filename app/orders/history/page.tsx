import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ListFilter from "@/components/ListFilter";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { ordersOf, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import {
  ORDER_STATUS_LABEL,
  OrderStatus,
  deliveredQuantity,
  formatDate,
  yen
} from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_KEYS: OrderStatus[] = ["pending", "invoiced", "delivered", "cancelled"];

export default async function OrderHistoryPage({
  searchParams
}: {
  searchParams: { status?: string };
}) {
  const user = await requireUser("customer");
  const state = await readState();
  const allMine = ordersOf(state, user.id);

  const statusFilter = searchParams.status || "all";
  const orders =
    statusFilter === "all"
      ? allMine
      : allMine.filter((o) => o.status === (statusFilter as OrderStatus));

  const summary = summarize(orders, state.deliveries);
  const countByStatus = (s: OrderStatus) =>
    allMine.filter((o) => o.status === s).length;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/orders/history" />

      <div className="container">
        <Link href="/orders" className="back-link">
          ← ダッシュボードに戻る
        </Link>

        <div className="card">
          <div className="card-head">
            <div className="card-head-text">
              <h2 className="card-title">注文履歴</h2>
              <p className="card-desc">
                全 {summary.orderCount} 件／累計{" "}
                {summary.orderedQuantity.toLocaleString("ja-JP")} 台 （うち納品済{" "}
                {summary.deliveredQuantity.toLocaleString("ja-JP")} 台）
              </p>
            </div>
            <ListFilter
              fields={[
                {
                  name: "status",
                  label: "状況",
                  value: statusFilter,
                  options: [
                    { value: "all", label: `すべて（${allMine.length} 件）` },
                    ...STATUS_KEYS.map((s) => ({
                      value: s,
                      label: `${ORDER_STATUS_LABEL[s]}（${countByStatus(s)} 件）`
                    }))
                  ]
                }
              ]}
            />
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">
              {allMine.length === 0 ? (
                <>
                  まだ注文がありません。
                  <br />
                  <Link href="/orders/new" className="link">
                    新規注文を作成する
                  </Link>
                </>
              ) : (
                "該当する注文はありません。"
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>注文番号</th>
                    <th>注文日</th>
                    <th className="num">台数</th>
                    <th className="num">納品済</th>
                    <th className="num">単価（税込）</th>
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
                        <td className="mono" data-label="注文日">{formatDate(order.orderedAt)}</td>
                        <td className="num" data-label="台数">{order.quantity}</td>
                        <td className="num" data-label="納品済">{delivered}</td>
                        <td className="num" data-label="単価（税込）">
                          {order.unitPrice === null ? (
                            <span className="muted">未確定</span>
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
                        <td data-label="請求書">
                          {order.invoiceNumber ? (
                            <a
                              className="link"
                              href={`/api/invoice/${order.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              PDF
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <Link href={`/orders/${order.id}`} className="link">
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
