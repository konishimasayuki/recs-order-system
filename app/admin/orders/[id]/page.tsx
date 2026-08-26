import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import {
  cancelOrderAction,
  deleteDeliveryAction,
  issueInvoiceAction,
  registerDeliveryAction,
  updateUnitPriceAction
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { readState } from "@/lib/store";
import {
  PRODUCT_NAME,
  billableQuantity,
  calcAmounts,
  deliveredQuantity,
  formatDate,
  formatDateTime,
  invoicedQuantity,
  invoicesOfOrder,
  yen
} from "@/lib/types";

export const dynamic = "force-dynamic";

const OK_MESSAGES: Record<string, string> = {
  price: "単価を保存しました。",
  invoiced: "請求書を発行しました。",
  delivered: "納品を登録しました。",
  deliveryRemoved: "納品記録を取り消しました。",
  cancelled: "注文をキャンセルしました。"
};

const ERROR_MESSAGES: Record<string, string> = {
  price: "単価は0以上の数値で入力してください。",
  noprice: "先に単価を入力してください。請求書は単価未入力では発行できません。",
  quantity: "請求する台数は1以上、かつ請求できる台数以内で入力してください。",
  nobillable: "請求できる台数がありません。納品の登録と単価をご確認ください。",
  notfound: "対象の注文が見つかりませんでした。",
  over: "納品台数の合計が注文台数を超えています。",
  deliveryQuantity: "納品台数は1以上の整数で入力してください。"
};

export default async function AdminOrderDetail({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string; no?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const order = state.orders.find((o) => o.id === params.id);
  if (!order) notFound();

  const customer = state.users.find((u) => u.id === order.userId);
  const deliveries = state.deliveries
    .filter((d) => d.orderId === order.id)
    .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
  const delivered = deliveredQuantity(order.id, state.deliveries);
  const remaining = Math.max(0, order.quantity - delivered);
  const invoiced = invoicedQuantity(order.id, state.invoices);
  const orderInvoices = invoicesOfOrder(order.id, state.invoices);
  // 納品が済み、単価も決まっている台数だけ請求書を出せる
  const billable = billableQuantity(order, state.deliveries, state.invoices);
  const amounts = order.unitPrice === null ? null : calcAmounts(order.quantity, order.unitPrice);
  const today = new Date().toISOString().slice(0, 10);

  const okMessage =
    searchParams.ok === "invoiced" && searchParams.no
      ? `請求書 ${searchParams.no} を発行しました。`
      : searchParams.ok
        ? OK_MESSAGES[searchParams.ok]
        : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/orders" />

      <div className="container-narrow">
        <Link href="/admin/orders" className="back-link">
          ← 受注一覧に戻る
        </Link>

        {okMessage && <div className="success-box">{okMessage}</div>}
        {errorMessage && <div className="error-box">{errorMessage}</div>}

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
              flexWrap: "wrap"
            }}
          >
            <div>
              <h2 className="card-title">注文番号 {order.orderNumber}</h2>
              <p className="card-desc" style={{ marginBottom: 0 }}>
                {order.companyName}／{formatDateTime(order.orderedAt)} 受付
              </p>
            </div>
            <StatusBadge status={order.status} delivered={delivered} quantity={order.quantity} />
          </div>

          <table className="detail-table">
            <tbody>
              <tr>
                <th>品名</th>
                <td>{PRODUCT_NAME}</td>
              </tr>
              <tr>
                <th>台数</th>
                <td className="amount">
                  {order.quantity} 台（納品済 {delivered} ／ 残 {remaining}）
                </td>
              </tr>
              <tr>
                <th>納品先</th>
                <td style={{ whiteSpace: "pre-wrap" }}>{order.shippingAddress}</td>
              </tr>
              <tr>
                <th>ご担当者</th>
                <td>
                  {order.contactName || "—"}
                  {order.email ? `（${order.email}）` : ""}
                </td>
              </tr>
              <tr>
                <th>発注元TEL</th>
                <td>{customer?.tel || "—"}</td>
              </tr>
              <tr>
                <th>納品希望日</th>
                <td>{order.desiredDeliveryDate || "指定なし"}</td>
              </tr>
              <tr>
                <th>備考</th>
                <td style={{ whiteSpace: "pre-wrap" }}>{order.note || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {order.unitPrice === null && customer?.defaultUnitPrice != null ? (
          /* 注文にはまだ単価が保存されていないが、発注元に標準単価がある。
             標準単価がそのまま適用される（請求書発行時に自動確定）ため、
             確認表示と編集ボタンだけを出す */
          <div className="card price-card">
            <h2 className="card-title">単価</h2>

            <table className="detail-table" style={{ marginBottom: 18 }}>
              <tbody>
                <tr>
                  <th>標準単価（税込）</th>
                  <td className="amount">{yen(customer.defaultUnitPrice)}</td>
                </tr>
                <tr className="grand-total">
                  <th>請求合計（税込）</th>
                  <td className="amount">
                    {yen(calcAmounts(order.quantity, customer.defaultUnitPrice).totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>

            <details className="edit-details">
              <summary className="btn btn-outline btn-sm">単価を編集する</summary>
              <form action={updateUnitPriceAction} className="edit-details-body">
                <input type="hidden" name="orderId" value={order.id} />
                <div className="field">
                  <label htmlFor="unitPrice">単価（税込・円）</label>
                  <input
                    id="unitPrice"
                    name="unitPrice"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={customer.defaultUnitPrice}
                    required
                  />
                  <p className="field-hint">
                    消費税10%はこの税込単価から逆算されます（インボイス制度対応）。
                  </p>
                </div>
                <SubmitButton className="btn btn-primary">単価を保存する</SubmitButton>
              </form>
            </details>
          </div>
        ) : order.unitPrice === null ? (
          <form className="card" action={updateUnitPriceAction}>
            <h2 className="card-title">単価の入力</h2>
            <p className="card-desc">
              税込単価を入力してください。請求書の金額はここで入力した単価から算出されます。
            </p>
            <input type="hidden" name="orderId" value={order.id} />

            <div className="field">
              <label htmlFor="unitPrice">単価（税込・円）</label>
              <input
                id="unitPrice"
                name="unitPrice"
                type="number"
                min={0}
                step={1}
                placeholder="例：15730"
                required
              />
              <p className="field-hint">
                消費税10%はこの税込単価から逆算されます（インボイス制度対応）。
              </p>
            </div>

            <SubmitButton className="btn btn-primary">単価を保存する</SubmitButton>
          </form>
        ) : (
          /* 標準単価などで単価が確定済みのときは金額の確認だけを見せ、
             編集フォームは「単価を編集する」を押したときだけ開く */
          <div className="card price-card">
            <h2 className="card-title">単価</h2>

            {amounts && (
              <table className="detail-table" style={{ marginBottom: 18 }}>
                <tbody>
                  <tr>
                    <th>単価（税込）</th>
                    <td className="amount">{yen(order.unitPrice)}</td>
                  </tr>
                  <tr>
                    <th>小計（税抜）</th>
                    <td className="amount">{yen(amounts.subtotalExcludingTax)}</td>
                  </tr>
                  <tr>
                    <th>消費税（10%）</th>
                    <td className="amount">{yen(amounts.taxAmount)}</td>
                  </tr>
                  <tr className="grand-total">
                    <th>請求合計（税込）</th>
                    <td className="amount">{yen(amounts.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            <details className="edit-details">
              <summary className="btn btn-outline btn-sm">単価を編集する</summary>
              <form action={updateUnitPriceAction} className="edit-details-body">
                <input type="hidden" name="orderId" value={order.id} />
                <div className="field">
                  <label htmlFor="unitPrice">単価（税込・円）</label>
                  <input
                    id="unitPrice"
                    name="unitPrice"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={order.unitPrice}
                    required
                  />
                  <p className="field-hint">
                    消費税10%はこの税込単価から逆算されます（インボイス制度対応）。
                  </p>
                </div>
                <SubmitButton className="btn btn-primary">単価を保存する</SubmitButton>
              </form>
            </details>
          </div>
        )}

        <div className="card">
          <h2 className="card-title">請求書</h2>
          <table className="detail-table">
            <tbody>
              <tr>
                <th>請求済</th>
                <td className="amount">
                  {invoiced} 台 ／ 注文 {order.quantity} 台
                </td>
              </tr>
              <tr>
                <th>請求できる台数</th>
                <td className="amount">
                  {billable} 台
                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                    （納品済 {delivered} 台 − 請求済 {invoiced} 台）
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {billable > 0 ? (
            <form action={issueInvoiceAction} style={{ marginTop: 16 }}>
              <input type="hidden" name="orderId" value={order.id} />
              <div className="field">
                <label htmlFor="invoice-quantity">請求する台数</label>
                <input
                  id="invoice-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={billable}
                  step={1}
                  defaultValue={billable}
                  required
                />
                <p className="field-hint">
                  納品済みの台数まで、何回でも分けて発行できます。
                </p>
              </div>
              <SubmitButton className="btn btn-gold">請求書を発行する</SubmitButton>
            </form>
          ) : (
            <p className="card-desc" style={{ marginTop: 12, marginBottom: 0 }}>
              {order.unitPrice === null && customer?.defaultUnitPrice == null
                ? "単価が未設定のため発行できません。先に単価を入力してください。"
                : delivered === 0
                  ? "まだ納品が登録されていないため発行できません。"
                  : "納品済みの台数はすべて請求済みです。"}
            </p>
          )}

          {orderInvoices.length > 0 && (
            <>
              <h3 className="section-heading">発行済みの請求書</h3>
              <div className="table-wrap">
                <table className="data-table pair-cards">
                  <thead>
                    <tr>
                      <th>請求書番号</th>
                      <th>発行日</th>
                      <th className="num">台数</th>
                      <th className="num">金額（税込）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderInvoices.map((inv) => {
                      const qty = inv.lines
                        .filter((l) => l.orderId === order.id)
                        .reduce((s, l) => s + l.quantity, 0);
                      const amount = inv.lines
                        .filter((l) => l.orderId === order.id)
                        .reduce((s, l) => s + l.quantity * l.unitPrice, 0);
                      return (
                        <tr key={inv.id}>
                          <td className="mono" data-label="請求書番号">
                            <a
                              className="link"
                              href={`/api/invoice/${inv.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {inv.invoiceNumber}
                            </a>
                          </td>
                          <td className="mono" data-label="発行日">
                            {formatDate(inv.issuedAt)}
                          </td>
                          <td className="num" data-label="台数">
                            {qty} 台
                          </td>
                          <td className="num" data-label="金額（税込）">
                            {yen(amount)}
                            {inv.lines.length > 1 && (
                              <span className="muted" style={{ fontSize: 11 }}>
                                （まとめ請求の一部）
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">納品登録</h2>
          <p className="card-desc">
            分納の場合は都度登録してください。合計が注文台数に達すると「納品完了」になります。
            （残り {remaining} 台）
          </p>

          {remaining > 0 ? (
            <form action={registerDeliveryAction}>
              <input type="hidden" name="orderId" value={order.id} />

              <div className="field-row">
                <div className="field">
                  <label htmlFor="deliveryQuantity">納品台数</label>
                  <input
                    id="deliveryQuantity"
                    name="quantity"
                    type="number"
                    min={1}
                    max={remaining}
                    step={1}
                    defaultValue={remaining}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="deliveredAt">納品日</label>
                  <input
                    id="deliveredAt"
                    name="deliveredAt"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="trackingNumber">送り状番号（任意）</label>
                <input id="trackingNumber" name="trackingNumber" type="text" />
              </div>

              <div className="field">
                <label htmlFor="deliveryNote">備考（任意）</label>
                <input id="deliveryNote" name="note" type="text" />
              </div>

              <SubmitButton className="btn btn-primary">納品を登録する</SubmitButton>
            </form>
          ) : (
            <div className="success-box" style={{ marginBottom: 0 }}>
              全 {order.quantity} 台の納品が完了しています。
            </div>
          )}

          {deliveries.length > 0 && (
            <>
              <h3 className="section-heading">納品履歴</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>納品日</th>
                      <th className="num">台数</th>
                      <th>送り状番号</th>
                      <th>備考</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="mono" data-label="納品日">{d.deliveredAt}</td>
                        <td className="num" data-label="台数">{d.quantity} 台</td>
                        <td data-label="送り状番号">{d.trackingNumber || "—"}</td>
                        <td data-label="備考">{d.note || "—"}</td>
                        <td>
                          <form action={deleteDeliveryAction}>
                            <input type="hidden" name="deliveryId" value={d.id} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <SubmitButton
                              className="btn btn-danger btn-sm"
                              confirmMessage="この納品記録を取り消します。よろしいですか？"
                            >
                              取消
                            </SubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {order.status !== "cancelled" && delivered === 0 && (
          <form className="card" action={cancelOrderAction}>
            <h2 className="card-title">注文のキャンセル</h2>
            <p className="card-desc">納品登録がない注文をキャンセル扱いにします。</p>
            <input type="hidden" name="orderId" value={order.id} />
            <SubmitButton
              className="btn btn-danger"
              confirmMessage="この注文をキャンセルします。よろしいですか？"
            >
              この注文をキャンセルする
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
