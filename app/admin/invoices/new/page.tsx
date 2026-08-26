import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SubmitButton from "@/components/SubmitButton";
import { issueBulkInvoiceAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { allOrders } from "@/lib/queries";
import { readState } from "@/lib/store";
import {
  billableQuantity,
  deliveredQuantity,
  formatDate,
  invoicedQuantity,
  yen
} from "@/lib/types";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  empty: "請求する注文を1件以上選んでください。",
  quantity: "請求する台数は1以上、かつ請求できる台数以内で入力してください。",
  noprice: "単価が未設定の注文が含まれています。先に単価を入力してください。",
  notfound: "対象の注文が見つかりませんでした。"
};

/**
 * まとめ請求。同じ発注元の注文をまとめて1枚の請求書にする。
 * 請求先が変わるため、発注元をまたいだ1枚の請求書は作らない。
 */
export default async function NewBulkInvoicePage({
  searchParams
}: {
  searchParams: { company?: string; error?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users.filter((u) => u.role === "customer");

  // 請求できる台数が残っている注文がある発注元だけを候補に出す
  const orders = allOrders(state).filter(
    (o) => billableQuantity(o, state.deliveries, state.invoices) > 0
  );
  const companyIds = new Set(orders.map((o) => o.userId));
  const candidates = customers.filter((c) => companyIds.has(c.id));

  const selected = candidates.find((c) => c.id === searchParams.company) ?? null;
  const targets = selected ? orders.filter((o) => o.userId === selected.id) : [];
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error]
    : null;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/invoices" />

      <div className="container">
        <Link href="/admin/invoices" className="back-link">
          ← 請求書一覧に戻る
        </Link>

        {errorMessage && <div className="error-box">{errorMessage}</div>}

        <div className="card">
          <h2 className="card-title">まとめて請求する</h2>
          <p className="card-desc">
            納品が済んでいて単価も決まっている台数を、発注元ごとに1枚の請求書に
            まとめます。注文ごとに請求する台数を変えられます。
          </p>

          {candidates.length === 0 ? (
            <div className="empty-state">
              請求できる注文はありません。納品の登録と単価をご確認ください。
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table pair-cards">
                <thead>
                  <tr>
                    <th>発注元</th>
                    <th className="num">請求できる注文</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const rows = orders.filter((o) => o.userId === c.id);
                    const qty = rows.reduce(
                      (s, o) =>
                        s + billableQuantity(o, state.deliveries, state.invoices),
                      0
                    );
                    return (
                      <tr
                        key={c.id}
                        className={selected?.id === c.id ? "is-selected" : undefined}
                      >
                        <td data-label="発注元">{c.companyName}</td>
                        <td className="num" data-label="請求できる注文">
                          {rows.length} 件／{qty} 台
                        </td>
                        <td className="row-action">
                          <Link
                            href={`/admin/invoices/new?company=${c.id}`}
                            className={
                              selected?.id === c.id
                                ? "btn btn-primary btn-sm"
                                : "btn btn-outline btn-sm"
                            }
                          >
                            {selected?.id === c.id ? "選択中" : "選ぶ"}
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

        {selected && targets.length > 0 && (
          <form className="card" action={issueBulkInvoiceAction}>
            <h2 className="card-title">{selected.companyName} への請求</h2>
            <p className="card-desc">
              請求する注文にチェックを入れ、台数を確認してください。
              初期値は請求できる台数です。
            </p>
            <input type="hidden" name="companyId" value={selected.id} />

            <div className="choice-list">
              {targets.map((order) => {
                const delivered = deliveredQuantity(order.id, state.deliveries);
                const invoiced = invoicedQuantity(order.id, state.invoices);
                const billable = billableQuantity(
                  order,
                  state.deliveries,
                  state.invoices
                );
                return (
                  <div className="choice" key={order.id}>
                    <input
                      type="checkbox"
                      name="orderIds"
                      value={order.id}
                      id={`pick-${order.id}`}
                      defaultChecked
                    />
                    <span className="choice-body">
                      <span className="choice-main">
                        <label htmlFor={`pick-${order.id}`}>
                          <strong className="mono">{order.orderNumber}</strong>
                        </label>
                        <span>{yen(order.unitPrice ?? 0)} ／台</span>
                      </span>
                      <span className="choice-sub">
                        注文日 {formatDate(order.orderedAt)}／注文 {order.quantity} 台
                        （納品済 {delivered} ／ 請求済 {invoiced}）
                      </span>
                      <span className="choice-qty">
                        <label htmlFor={`qty-${order.id}`}>請求する台数</label>
                        <input
                          id={`qty-${order.id}`}
                          name={`quantity_${order.id}`}
                          type="number"
                          min={1}
                          max={billable}
                          step={1}
                          defaultValue={billable}
                        />
                        <span className="muted">／ 請求できる {billable} 台</span>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="action-row" style={{ marginTop: 18 }}>
              <SubmitButton className="btn btn-gold">
                この内容で請求書を発行する
              </SubmitButton>
              <Link href="/admin/invoices" className="btn btn-outline">
                キャンセル
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
