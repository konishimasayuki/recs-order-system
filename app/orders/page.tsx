import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { ordersOf, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { deliveredQuantity, formatDate, yen } from "@/lib/types";

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
            <p className="stat-label">累計納品台数</p>
            <div className="stat-value">
              {summary.deliveredQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="stat-note">納品率 {progress}%</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">納品待ち台数</p>
            <div className="stat-value">
              {summary.pendingQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
            <p className="stat-note">出荷準備中・製作中を含みます</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">請求済金額（税込）</p>
            <div className="stat-value" style={{ fontSize: 24 }}>
              {yen(summary.invoicedAmount)}
            </div>
            <p className="stat-note">請求書発行済みの注文の合計</p>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">RECSGPS を注文する</h2>
          <p className="card-desc">
            台数を指定してご注文いただけます。ご注文内容はMIAMIホールディングスへ即時に通知されます。
          </p>
          <div className="action-row">
            <Link href="/orders/new" className="btn btn-gold">
              新規注文を作成する
            </Link>
            <Link href="/orders/history" className="btn btn-outline">
              注文履歴をすべて見る
            </Link>
            <Link href="/deliveries" className="btn btn-outline">
              納品履歴を見る
            </Link>
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>注文番号</th>
                    <th>注文日</th>
                    <th className="num">台数</th>
                    <th className="num">納品済</th>
                    <th className="num">金額（税込）</th>
                    <th>状況</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => {
                    const delivered = deliveredQuantity(order.id, state.deliveries);
                    return (
                      <tr key={order.id}>
                        <td className="mono" data-label="注文番号">{order.orderNumber}</td>
                        <td className="mono" data-label="注文日">{formatDate(order.orderedAt)}</td>
                        <td className="num" data-label="台数">{order.quantity}</td>
                        <td className="num" data-label="納品済">{delivered}</td>
                        <td className="num" data-label="金額（税込）">
                          {order.unitPrice === null ? (
                            <span className="muted">未確定</span>
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

        <p className="site-footer">
          RECSGPS 注文システム / MIAMIホールディングス株式会社
        </p>
      </div>
    </div>
  );
}
