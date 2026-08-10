import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { allOrders, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage() {
  const user = await requireUser("admin");
  const state = await readState();
  const orders = allOrders(state);
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const deliveries = [...state.deliveries].sort((a, b) =>
    b.deliveredAt.localeCompare(a.deliveredAt)
  );
  const summary = summarize(orders, state.deliveries);

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/deliveries" />

      <div className="container">
        <div className="stat-grid">
          <div className="stat-card accent">
            <p className="stat-label">累計納品台数</p>
            <div className="stat-value">
              {summary.deliveredQuantity.toLocaleString("ja-JP")}
              <small>台</small>
            </div>
          </div>
          <div className="stat-card">
            <p className="stat-label">納品残</p>
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
          <h2 className="card-title">納品一覧</h2>
          <p className="card-desc">
            納品の登録・取消は各注文の詳細画面から行います。
          </p>

          {deliveries.length === 0 ? (
            <div className="empty-state">まだ納品登録はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>納品日</th>
                    <th>発注元</th>
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
                        <td className="mono" data-label="納品日">{d.deliveredAt}</td>
                        <td data-label="発注元">{order?.companyName ?? "—"}</td>
                        <td className="mono" data-label="注文番号">{order?.orderNumber ?? "—"}</td>
                        <td className="num" data-label="納品台数">{d.quantity} 台</td>
                        <td className="num" data-label="注文台数">{order?.quantity ?? "—"} 台</td>
                        <td data-label="送り状番号">{d.trackingNumber || "—"}</td>
                        <td data-label="備考">{d.note || "—"}</td>
                        <td>
                          {order && (
                            <Link href={`/admin/orders/${order.id}`} className="link">
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
