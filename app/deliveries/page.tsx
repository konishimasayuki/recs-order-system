import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { deliveriesOf, ordersOf, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CustomerDeliveriesPage() {
  const user = await requireUser("customer");
  const state = await readState();
  const orders = ordersOf(state, user.id);
  const orderIds = new Set(orders.map((o) => o.id));
  const deliveries = deliveriesOf(state, orderIds);
  const summary = summarize(orders, state.deliveries);
  const orderMap = new Map(orders.map((o) => [o.id, o]));

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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>納品日</th>
                    <th>注文番号</th>
                    <th className="num">納品台数</th>
                    <th className="num">注文台数</th>
                    <th>送り状番号</th>
                    <th>備考</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => {
                    const order = orderMap.get(d.orderId);
                    return (
                      <tr key={d.id}>
                        <td className="mono">{d.deliveredAt}</td>
                        <td className="mono">{order?.orderNumber ?? "—"}</td>
                        <td className="num">{d.quantity} 台</td>
                        <td className="num">{order?.quantity ?? "—"} 台</td>
                        <td>{d.trackingNumber || "—"}</td>
                        <td>{d.note || "—"}</td>
                        <td>
                          {order && (
                            <Link href={`/orders/${order.id}`} className="link">
                              注文詳細
                            </Link>
                          )}
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
