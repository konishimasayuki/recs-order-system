import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { cancelOrderAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { readState } from "@/lib/store";
import {
  PRODUCT_NAME,
  calcAmounts,
  deliveredQuantity,
  formatDate,
  formatDateTime,
  invoicesOfOrder,
  yen
} from "@/lib/types";

export const dynamic = "force-dynamic";

const OK_MESSAGES: Record<string, string> = {
  created: "ご注文を受け付けました。MIAMIホールディングスへ通知しました。",
  cancelled: "注文をキャンセルしました。"
};

export default async function CustomerOrderDetail({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { ok?: string };
}) {
  const user = await requireUser("customer");
  const state = await readState();
  const order = state.orders.find((o) => o.id === params.id && o.userId === user.id);
  if (!order) notFound();

  const deliveries = state.deliveries
    .filter((d) => d.orderId === order.id)
    .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
  const delivered = deliveredQuantity(order.id, state.deliveries);
  const orderInvoices = invoicesOfOrder(order.id, state.invoices);
  const amounts = order.unitPrice === null ? null : calcAmounts(order.quantity, order.unitPrice);
  const okMessage = searchParams.ok ? OK_MESSAGES[searchParams.ok] : null;
  const canCancel = order.status === "pending" && delivered === 0;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/orders/history" />

      <div className="container-narrow">
        <Link href="/orders/history" className="back-link">
          ← 注文履歴に戻る
        </Link>

        {okMessage && <div className="success-box">{okMessage}</div>}

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
                {formatDateTime(order.orderedAt)} 受付
              </p>
            </div>
            <StatusBadge
              status={order.status}
              delivered={delivered}
              quantity={order.quantity}
            />
          </div>

          <table className="detail-table">
            <tbody>
              <tr>
                <th>品名</th>
                <td>{PRODUCT_NAME}</td>
              </tr>
              <tr>
                <th>注文台数</th>
                <td className="amount">{order.quantity} 台</td>
              </tr>
              <tr>
                <th>納品済台数</th>
                <td className="amount">
                  {delivered} 台（残り {Math.max(0, order.quantity - delivered)} 台）
                </td>
              </tr>
              <tr>
                <th>単価（税込）</th>
                <td className="amount">
                  {order.unitPrice === null ? (
                    <span className="muted">単価確定後にご案内します</span>
                  ) : (
                    yen(order.unitPrice)
                  )}
                </td>
              </tr>
              {amounts && (
                <>
                  <tr>
                    <th>小計（税抜）</th>
                    <td className="amount">{yen(amounts.subtotalExcludingTax)}</td>
                  </tr>
                  <tr>
                    <th>消費税（10%）</th>
                    <td className="amount">{yen(amounts.taxAmount)}</td>
                  </tr>
                  <tr className="grand-total">
                    <th>合計（税込）</th>
                    <td className="amount">{yen(amounts.totalAmount)}</td>
                  </tr>
                </>
              )}
              <tr>
                <th>納品先</th>
                <td style={{ whiteSpace: "pre-wrap" }}>{order.shippingAddress}</td>
              </tr>
              <tr>
                <th>ご担当者</th>
                <td>{order.contactName || "—"}</td>
              </tr>
              <tr>
                <th>連絡先</th>
                <td>{order.email || "—"}</td>
              </tr>
              <tr>
                <th>納品希望日</th>
                <td>{order.desiredDeliveryDate || "指定なし"}</td>
              </tr>
              <tr>
                <th>備考</th>
                <td style={{ whiteSpace: "pre-wrap" }}>{order.note || "—"}</td>
              </tr>
              <tr>
                <th>請求書</th>
                <td>
                  {orderInvoices.length === 0 ? (
                    <span className="muted">未発行</span>
                  ) : (
                    /* 分割請求・まとめ請求があるため複数行になりうる */
                    orderInvoices.map((inv) => {
                      const qty = inv.lines
                        .filter((l) => l.orderId === order.id)
                        .reduce((s, l) => s + l.quantity, 0);
                      return (
                        <div key={inv.id}>
                          <a
                            className="link"
                            href={`/api/invoice/${inv.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {inv.invoiceNumber}
                          </a>
                          （{formatDate(inv.issuedAt)} 発行／{qty} 台）
                        </div>
                      );
                    })
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="action-row">
            {orderInvoices.length > 0 && (
              <a
                className="btn btn-primary"
                href={`/api/invoice/${orderInvoices[0].id}`}
                target="_blank"
                rel="noreferrer"
              >
                {orderInvoices.length > 1
                  ? "最新の請求書PDFをダウンロード"
                  : "請求書PDFをダウンロード"}
              </a>
            )}
            <Link href="/orders/new" className="btn btn-outline">
              続けて注文する
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">納品履歴</h2>
          {deliveries.length === 0 ? (
            <div className="empty-state">まだ納品登録はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>納品日</th>
                    <th className="num">台数</th>
                    <th>送り状番号</th>
                    <th>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="mono" data-label="納品日">{d.deliveredAt}</td>
                      <td className="num" data-label="台数">{d.quantity} 台</td>
                      <td data-label="送り状番号">{d.trackingNumber || "—"}</td>
                      <td data-label="備考">{d.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canCancel && (
          <form className="card" action={cancelOrderAction}>
            <h2 className="card-title">注文のキャンセル</h2>
            <p className="card-desc">
              請求書発行前かつ納品開始前の注文のみキャンセルできます。
            </p>
            <input type="hidden" name="orderId" value={order.id} />
            <SubmitButton
              className="btn btn-danger"
              pendingLabel="処理中…"
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
