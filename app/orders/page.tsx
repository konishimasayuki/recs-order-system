import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { ordersOf, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { deliveredQuantity, formatDate, statusTone, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomerDashboard({
  searchParams
}: {
  searchParams: { ok?: string };
}) {
  const user = await requireUser("customer");
  const state = await readState();
  const orders = ordersOf(state, user.id);
  const summary = summarize(orders, state.deliveries);
  const recent = orders.slice(0, 5);
  const progress =
    summary.orderedQuantity > 0
      ? Math.round((summary.deliveredQuantity / summary.orderedQuantity) * 100)
      : 0;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/orders" />

      <div className="container">
        {searchParams.ok === "profile" && (
          <div className="success-box">お客様情報を保存しました。</div>
        )}

        <div className="stat-grid">
          <div className="stat-card accent">
            <p className="stat-label">累計注文台数</p>
            <div className="stat-value">
              {summary.orderedQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
            <p className="stat-note" style={{ color: "#b9c1d1" }}>
              注文 {summary.orderCount} 件（キャンセル分を除く）
            </p>
          </div>

          <div className="stat-card">
            <p className="stat-label">納品台数</p>
            <div className="stat-value">
              {summary.deliveredQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="stat-note">納品待ち {summary.pendingQuantity.toLocaleString("ja-JP")} 台</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">請求済金額（税込）</p>
            <div className="stat-value" style={{ fontSize: 24 }}>
              {yen(summary.invoicedAmount)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="action-stack">
            <Link href="/orders/new" className="btn btn-gold btn-lg">
              新規注文を作成する
            </Link>
            <div className="action-pair">
              <Link href="/orders/history" className="btn btn-outline">
                注文履歴
              </Link>
              <Link href="/deliveries" className="btn btn-outline">
                納品履歴
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">最近の注文</h2>
          {recent.length === 0 ? (
            <div className="empty-state">
              まだ注文がありません。
              <br />
              「新規注文を作成する」からご注文ください。
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table pair-cards">
                <thead>
                  <tr>
                    <th>注文番号</th>
                    <th>注文日</th>
                    <th>台数</th>
                    <th>状況</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => {
                    const delivered = deliveredQuantity(order.id, state.deliveries);
                    return (
                      <tr
                        key={order.id}
                        className={`selectable ${statusTone(order.status, delivered)}`}
                      >
                        <td className="mono" data-label="注文番号">
                          <Link href={`/orders/${order.id}`} className="row-link">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="mono" data-label="注文日">{formatDate(order.orderedAt)}</td>
                        <td data-label="台数">{order.quantity} 台</td>
                        <td data-label="状況">
                          <StatusBadge
                            status={order.status}
                            delivered={delivered}
                            quantity={order.quantity}
                          />
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
          RECSGPS 注文システム / MIAMIホールディングス株式会社
        </p>
      </div>
    </div>
  );
}
