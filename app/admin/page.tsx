import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { allOrders, rollupByCustomer, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { deliveredQuantity, formatDate, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireUser("admin");
  const state = await readState();
  const orders = allOrders(state);
  const summary = summarize(orders, state.deliveries);
  const rollup = rollupByCustomer(state);
  const needsAction = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "delivered"
  );
  const sellerIncomplete = !state.seller.address || !state.seller.registrationNumber;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin" />

      <div className="container">
        {sellerIncomplete && (
          <div className="notice-box">
            <strong>請求元情報が未設定です</strong>
            <p>
              請求書PDFに住所・登録番号・振込先が印字されません。
              <Link href="/admin/settings" className="link">
                請求元設定
              </Link>
              から入力してください。
            </p>
          </div>
        )}

        <div className="stat-grid">
          <div className="stat-card accent">
            <p className="stat-label">累計受注台数</p>
            <div className="stat-value">
              {summary.orderedQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
            <p className="stat-note" style={{ color: "#b9c1d1" }}>
              受注 {summary.orderCount} 件
            </p>
          </div>

          <div className="stat-card">
            <p className="stat-label">累計納品台数</p>
            <div className="stat-value">
              {summary.deliveredQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
            <p className="stat-note">残 {summary.pendingQuantity.toLocaleString("ja-JP")} 台</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">請求済金額（税込）</p>
            <div className="stat-value" style={{ fontSize: 24 }}>
              {yen(summary.invoicedAmount)}
            </div>
            <p className="stat-note">請求書発行済みの合計</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">請求書未発行</p>
            <div className="stat-value">
              {summary.awaitingInvoiceCount.toLocaleString("ja-JP")}
              <small>件</small>
            </div>
            <p className="stat-note">単価入力・発行が必要です</p>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">対応中の受注</h2>
          <p className="card-desc">請求書発行または納品が完了していない注文です。</p>

          {needsAction.length === 0 ? (
            <div className="empty-state">対応が必要な受注はありません。</div>
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
                    <th>状況</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {needsAction.map((order) => {
                    const delivered = deliveredQuantity(order.id, state.deliveries);
                    return (
                      <tr key={order.id}>
                        <td className="mono">{order.orderNumber}</td>
                        <td>{order.companyName}</td>
                        <td className="mono">{formatDate(order.orderedAt)}</td>
                        <td className="num">{order.quantity}</td>
                        <td className="num">{delivered}</td>
                        <td className="num">
                          {order.unitPrice === null ? (
                            <span className="muted">未入力</span>
                          ) : (
                            yen(order.unitPrice)
                          )}
                        </td>
                        <td>
                          <StatusBadge
                            status={order.status}
                            delivered={delivered}
                            quantity={order.quantity}
                          />
                        </td>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="link">
                            処理する
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

        <div className="card">
          <h2 className="card-title">発注元別の累計</h2>
          {rollup.length === 0 ? (
            <div className="empty-state">発注アカウントが登録されていません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th>発注元</th>
                    <th className="num">注文件数</th>
                    <th className="num">累計受注台数</th>
                    <th className="num">累計納品台数</th>
                    <th className="num">納品残</th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.map((row) => (
                    <tr key={row.userId}>
                      <td>{row.companyName}</td>
                      <td className="num">{row.orderCount}</td>
                      <td className="num">{row.orderedQuantity} 台</td>
                      <td className="num">{row.deliveredQuantity} 台</td>
                      <td className="num">
                        {Math.max(0, row.orderedQuantity - row.deliveredQuantity)} 台
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
