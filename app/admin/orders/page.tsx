import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ListFilter from "@/components/ListFilter";
import { parseMulti } from "@/lib/filters";
import Pagination, { clampPage } from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { allOrders, summarize } from "@/lib/queries";
import { readState } from "@/lib/store";
import { ORDER_STATUS_LABEL, OrderStatus, deliveredQuantity, formatDate } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 絞り込みに出す状況。納品完了は絞り込み対象外（全件表示には含まれる） */
const FILTER_STATUSES: OrderStatus[] = ["pending", "invoiced", "cancelled"];

const PER_PAGE = 20;

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: { status?: string; company?: string; page?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users.filter((u) => u.role === "customer");

  const statusSelected = parseMulti(searchParams.status, FILTER_STATUSES);
  const companySelected = parseMulti(
    searchParams.company,
    customers.map((c) => c.id)
  );

  let orders = allOrders(state);
  if (statusSelected.length > 0) {
    orders = orders.filter((o) => statusSelected.includes(o.status));
  }
  if (companySelected.length > 0) {
    orders = orders.filter((o) => companySelected.includes(o.userId));
  }

  const summary = summarize(orders, state.deliveries);
  const page = clampPage(searchParams.page, orders.length, PER_PAGE);
  const pageOrders = orders.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/orders" />

      <div className="container">
        <div className="card">
          <div className="card-head">
            <div className="card-head-text">
              <h2 className="card-title">受注一覧</h2>
              <p className="card-desc">
                表示中 {summary.orderCount} 件／
                {summary.orderedQuantity.toLocaleString("ja-JP")} 台
              </p>
            </div>
            <ListFilter
              fields={[
                {
                  name: "status",
                  label: "状況",
                  values: statusSelected,
                  columns: 3,
                  options: FILTER_STATUSES.map((s) => ({
                    value: s,
                    label: ORDER_STATUS_LABEL[s]
                  }))
                },
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

          {orders.length === 0 ? (
            <div className="empty-state">該当する受注はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table pair-cards">
                <thead>
                  <tr>
                    <th>注文番号</th>
                    <th>発注元</th>
                    <th>注文日</th>
                    <th>納品希望日</th>
                    <th className="num">台数</th>
                    <th>状況</th>
                    <th>請求書</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOrders.map((order) => {
                    const delivered = deliveredQuantity(order.id, state.deliveries);
                    return (
                      <tr key={order.id} className="selectable">
                        <td className="mono" data-label="注文番号">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="row-link"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td data-label="発注元">{order.companyName}</td>
                        <td className="mono" data-label="注文日">
                          {formatDate(order.orderedAt)}
                        </td>
                        <td className="mono" data-label="納品希望日">
                          {order.desiredDeliveryDate || "—"}
                        </td>
                        <td className="num span-2" data-label="台数">
                          {order.quantity} 台
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            total={orders.length}
            page={page}
            perPage={PER_PAGE}
            basePath="/admin/orders"
            params={{
              status: statusSelected.join(","),
              company: companySelected.join(",")
            }}
          />
        </div>
      </div>
    </div>
  );
}
