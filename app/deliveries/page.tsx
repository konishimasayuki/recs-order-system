import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import Pagination, { clampPage } from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { deliveriesOf, ordersOf, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { deliveredQuantity, statusTone } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function CustomerDeliveriesPage({
  searchParams
}: {
  searchParams: { page?: string };
}) {
  const user = await requireUser("customer");
  const state = await readState();
  const orders = ordersOf(state, user.id);
  const orderIds = new Set(orders.map((o) => o.id));
  const deliveries = deliveriesOf(state, orderIds);
  const summary = summarize(orders, state.deliveries);
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const page = clampPage(searchParams.page, deliveries.length, PER_PAGE);
  const pageDeliveries = deliveries.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/deliveries" />

      <div className="container">
        <Link href="/orders" className="back-link">
          ← ダッシュボードに戻る
        </Link>

        <div className="stat-grid">
          <div className="stat-card accent">
            <p className="stat-label">累計納品台数</p>
            <div className="stat-value">
              {summary.deliveredQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
          </div>
          <div className="stat-card">
            <p className="stat-label">納品待ち台数</p>
            <div className="stat-value">
              {summary.pendingQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
          </div>
          <div className="stat-card">
            <p className="stat-label">納品回数</p>
            <div className="stat-value">
              {deliveries.length.toLocaleString("ja-JP")}
              <small>回</small>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">納品履歴</h2>
          <p className="card-desc">
            MIAMIホールディングスが登録した出荷・納品の記録です。分納の場合は複数行に分かれます。
          </p>

          {deliveries.length === 0 ? (
            <div className="empty-state">まだ納品の記録はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table pair-cards">
                <thead>
                  <tr>
                    <th>納品日</th>
                    <th>注文番号</th>
                    <th className="num">納品台数</th>
                    <th>注文の状況</th>
                    <th>送り状番号</th>
                    <th>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {pageDeliveries.map((d) => {
                    const order = orderMap.get(d.orderId);
                    const delivered = order
                      ? deliveredQuantity(order.id, state.deliveries)
                      : 0;
                    return (
                      <tr
                        key={d.id}
                        className={
                          order
                            ? `selectable ${statusTone(order.status, delivered)}`
                            : undefined
                        }
                      >
                        <td className="mono" data-label="納品日">{d.deliveredAt}</td>
                        <td className="mono" data-label="注文番号">
                          {order ? (
                            <Link href={`/orders/${order.id}`} className="row-link">
                              {order.orderNumber}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num" data-label="納品台数">{d.quantity} 台</td>
                        <td data-label="注文の状況">
                          {order ? (
                            <StatusBadge
                              status={order.status}
                              delivered={delivered}
                              quantity={order.quantity}
                            />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td
                          data-label="送り状番号"
                          className={d.trackingNumber ? "span-2" : "sm-empty"}
                        >
                          {d.trackingNumber || "—"}
                        </td>
                        <td data-label="備考" className={d.note ? "span-2" : "sm-empty"}>
                          {d.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            total={deliveries.length}
            page={page}
            perPage={PER_PAGE}
            basePath="/deliveries"
          />
        </div>
      </div>
    </div>
  );
}
