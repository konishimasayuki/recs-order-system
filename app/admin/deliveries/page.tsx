import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ListFilter from "@/components/ListFilter";
import { parseMulti } from "@/lib/filters";
import Pagination, { clampPage } from "@/components/Pagination";
import { requireUser } from "@/lib/auth";
import { allOrders, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function AdminDeliveriesPage({
  searchParams
}: {
  searchParams: { company?: string; page?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users.filter((u) => u.role === "customer");
  const orders = allOrders(state);
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const companySelected = parseMulti(
    searchParams.company,
    customers.map((c) => c.id)
  );

  let deliveries = [...state.deliveries].sort((a, b) =>
    b.deliveredAt.localeCompare(a.deliveredAt)
  );
  if (companySelected.length > 0) {
    deliveries = deliveries.filter((d) => {
      const uid = orderMap.get(d.orderId)?.userId;
      return uid !== undefined && companySelected.includes(uid);
    });
  }

  const summary = summarize(orders, state.deliveries, state.invoices);
  const page = clampPage(searchParams.page, deliveries.length, PER_PAGE);
  const pageDeliveries = deliveries.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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
              {state.deliveries.length.toLocaleString("ja-JP")}
              <small>回</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-head-text">
              <h2 className="card-title">納品一覧</h2>
            </div>
            <ListFilter
              fields={[
                {
                  name: "company",
                  label: "発注元",
                  values: companySelected,
                  columns: 2,
                  options: customers.map((c) => ({
                    value: c.id,
                    label: c.companyName
                  }))
                }
              ]}
            />
          </div>

          {deliveries.length === 0 ? (
            <div className="empty-state">該当する納品はありません。</div>
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
                  {pageDeliveries.map((d) => {
                    const order = orderMap.get(d.orderId);
                    return (
                      <tr key={d.id} className={order ? "selectable" : undefined}>
                        <td className="mono" data-label="納品日">{d.deliveredAt}</td>
                        <td data-label="発注元">{order?.companyName ?? "—"}</td>
                        <td className="mono" data-label="注文番号">{order?.orderNumber ?? "—"}</td>
                        <td className="num" data-label="納品台数">{d.quantity} 台</td>
                        <td className="num" data-label="注文台数">{order?.quantity ?? "—"} 台</td>
                        <td data-label="送り状番号" className={d.trackingNumber ? undefined : "sm-empty"}>
                          {d.trackingNumber || "—"}
                        </td>
                        <td data-label="備考" className={d.note ? undefined : "sm-empty"}>
                          {d.note || "—"}
                        </td>
                        <td>
                          {order && (
                            <Link href={`/admin/orders/${order.id}`} className="row-link">
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

          <Pagination
            total={deliveries.length}
            page={page}
            perPage={PER_PAGE}
            basePath="/admin/deliveries"
            params={{ company: companySelected.join(",") }}
          />
        </div>
      </div>
    </div>
  );
}
