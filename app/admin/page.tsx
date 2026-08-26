import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SubmitButton from "@/components/SubmitButton";
import { registerDeliveryAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { allOrders, rollupByCustomer, summarize } from "@/lib/queries";
import { getStorageStatus, readState } from "@/lib/store";
import { deliveredQuantity, formatDate } from "@/lib/types";

export const dynamic = "force-dynamic";

const DELIVERY_ERRORS: Record<string, string> = {
  over: "納品台数が注文の残り台数を超えています。台数を確認してください。",
  deliveryQuantity: "納品台数は1以上の数値で入力してください。",
  orderTarget: "どの注文への納品か選んでください。",
  notfound: "対象の注文が見つかりませんでした。"
};

export default async function AdminDashboard({
  searchParams
}: {
  searchParams: { deliver?: string; ok?: string; error?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  // 保存先はデータへのアクセス後に確定するため readState() の後に取得する
  const storage = getStorageStatus();
  const orders = allOrders(state);
  const summary = summarize(orders, state.deliveries, state.invoices);
  /**
   * 請求元の案内は住所が未入力のときだけ出す。
   * 以前はインボイス登録番号も必須にしていたが、登録番号を使わない運用でも
   * 「設定したのに消えない」バナーになってしまうため、請求書の体裁に
   * 最低限必要な住所だけを条件にする。
   */
  const sellerIncomplete = !state.seller.address;

  const ROLLUP_LIMIT = 5;

  /**
   * 対応中（請求書発行または納品が未完了）の受注を発注元ごとに集計する。
   * 1件ずつ並べると受注が増えたとき画面が際限なく伸びるため、
   * ダッシュボードでは会社単位のまとめだけを見せ、明細は受注一覧に任せる。
   */
  const needsActionAll = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "delivered"
  );

  const byCompany = new Map<
    string,
    { companyName: string; count: number; quantity: number; delivered: number }
  >();
  for (const o of needsActionAll) {
    const row =
      byCompany.get(o.userId) ??
      { companyName: o.companyName, count: 0, quantity: 0, delivered: 0 };
    row.count += 1;
    row.quantity += o.quantity;
    row.delivered += deliveredQuantity(o.id, state.deliveries);
    byCompany.set(o.userId, row);
  }
  const needsActionByCompany = [...byCompany.entries()]
    .map(([userId, r]) => ({ userId, ...r }))
    .sort(
      (a, b) =>
        b.quantity - b.delivered - (a.quantity - a.delivered) || b.count - a.count
    );

  // 注文実績のない発注先は集計に出さない。納品残の多い順に上位だけ見せる
  const rollupActive = rollupByCustomer(state)
    .filter((r) => r.orderCount > 0)
    .sort(
      (a, b) =>
        b.orderedQuantity - b.deliveredQuantity - (a.orderedQuantity - a.deliveredQuantity) ||
        b.orderedQuantity - a.orderedQuantity
    );
  const rollup = rollupActive.slice(0, ROLLUP_LIMIT);
  const rollupHidden = rollupActive.length - rollup.length;

  /**
   * 納品登録の対象。発注元の行から開くと、その会社の未完了の注文が候補になる。
   * 注文ごとに納品先が違うことがあるため、どの注文に割り当てるかを選ばせる。
   */
  const deliverCompanyId = searchParams.deliver;
  const deliverOrders = deliverCompanyId
    ? needsActionAll
        .filter((o) => o.userId === deliverCompanyId)
        .map((o) => ({
          ...o,
          remaining: o.quantity - deliveredQuantity(o.id, state.deliveries)
        }))
        .filter((o) => o.remaining > 0)
    : [];
  const deliverTarget = deliverOrders.length > 0 ? deliverOrders[0].companyName : null;
  // 納品先が1つでないときは、割り当て先を選ばないと誤配送につながる
  const multipleAddresses =
    new Set(deliverOrders.map((o) => o.shippingAddress.trim())).size > 1;
  const today = new Date().toISOString().slice(0, 10);
  const deliveryError = searchParams.error ? DELIVERY_ERRORS[searchParams.error] : null;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin" />

      <div className="container">
        {searchParams.ok === "delivered" && (
          <div className="success-box">納品を登録しました。</div>
        )}
        {deliveryError && <div className="error-box">{deliveryError}</div>}

        {storage.ephemeral && (
          <div className="notice-box">
            <strong>データが一時領域に保存されています</strong>
            <p>
              データベースに接続されていないため、注文・納品・アカウントの記録は
              サーバーが入れ替わるたびに初期化されます。運用を始める前に、Vercel の
              Storage で Postgres を接続し、環境変数 <code>DATABASE_URL</code>
              （または <code>POSTGRES_URL</code>）を設定したうえで再デプロイしてください。
            </p>
          </div>
        )}

        {sellerIncomplete && (
          <div className="notice-box">
            <strong>請求元の住所が未入力です</strong>
            <p>
              請求書PDFに住所が印字されません。
              <Link href="/admin/settings?tab=seller" className="link">
                設定
              </Link>
              の「請求元情報」から入力してください。
            </p>
          </div>
        )}

        <div className="stat-grid">
          <div className="stat-card accent" style={{ gridColumn: "1 / -1" }}>
            <p className="stat-label">請求書未発行</p>
            <div className="stat-value">
              {summary.awaitingInvoiceCount.toLocaleString("ja-JP")}
              <small>件</small>
            </div>
            <p className="stat-note" style={{ color: "#b9c1d1" }}>
              単価入力・発行が必要です
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-head-text">
              <h2 className="card-title">
                対応中の受注（{needsActionAll.length} 件）
              </h2>
            </div>
            <Link href="/admin/orders" className="btn btn-outline btn-sm">
              受注一覧へ
            </Link>
          </div>

          {needsActionByCompany.length === 0 ? (
            <div className="empty-state">対応が必要な受注はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>発注元</th>
                    <th className="num">件数</th>
                    <th className="num">納品済／合計台数</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {needsActionByCompany.map((row) => (
                    <tr key={row.userId} className="selectable">
                      <td data-label="発注元">
                        <Link
                          href={`/admin/orders?status=pending,invoiced&company=${row.userId}`}
                          className="row-link"
                        >
                          {row.companyName}
                        </Link>
                      </td>
                      <td className="num" data-label="件数">{row.count} 件</td>
                      <td className="num" data-label="納品済／合計台数">
                        {row.delivered} ／ {row.quantity} 台
                      </td>
                      <td className="row-action">
                        <Link
                          href={`/admin?deliver=${row.userId}`}
                          className="btn btn-outline btn-sm"
                        >
                          納品を登録
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">発注元別の累計</h2>
          {rollup.length === 0 ? (
            <div className="empty-state">まだ受注がありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
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
                      <td data-label="発注元">{row.companyName}</td>
                      <td className="num" data-label="注文件数">{row.orderCount}</td>
                      <td className="num" data-label="累計受注台数">{row.orderedQuantity} 台</td>
                      <td className="num" data-label="累計納品台数">
                        {row.deliveredQuantity} 台
                      </td>
                      <td className="num" data-label="納品残">
                        {Math.max(0, row.orderedQuantity - row.deliveredQuantity)} 台
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rollupHidden > 0 && (
            <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
              納品残の多い {rollup.length} 社を表示しています（ほか {rollupHidden} 社）。
              発注元ごとの明細は
              <Link href="/admin/orders" className="link">
                受注一覧
              </Link>
              の絞り込みで確認できます。
            </p>
          )}
        </div>

        {deliverTarget && (
          <div className="modal-backdrop">
            {/* 背景をタップしても閉じられるように、全面をリンクで覆う */}
            <Link href="/admin" className="modal-scrim" aria-label="閉じる" />
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <h2 className="card-title">納品を登録（{deliverTarget}）</h2>
                <Link href="/admin" className="modal-close" aria-label="閉じる">
                  ×
                </Link>
              </div>

              {multipleAddresses && (
                <div className="notice-inline">
                  納品先が複数あります。どの注文（納品先）への納品か選んでください。
                </div>
              )}

              <form action={registerDeliveryAction}>
                <input type="hidden" name="returnTo" value="dashboard" />
                <input type="hidden" name="companyId" value={deliverCompanyId} />

                {deliverOrders.length === 1 ? (
                  <>
                    <input type="hidden" name="orderId" value={deliverOrders[0].id} />
                    <div className="field">
                      <span className="label">納品先</span>
                      <div className="choice-single">
                        <strong className="mono">{deliverOrders[0].orderNumber}</strong>
                        <span className="choice-sub">
                          {deliverOrders[0].shippingAddress}
                        </span>
                        <span className="choice-sub">
                          注文日 {formatDate(deliverOrders[0].orderedAt)}／残り{" "}
                          {deliverOrders[0].remaining} 台
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="field">
                    <span className="label">納品先（割り当てる注文）</span>
                    <div className="choice-list">
                      {deliverOrders.map((order, index) => (
                        <label className="choice" key={order.id}>
                          <input
                            type="radio"
                            name="orderId"
                            value={order.id}
                            defaultChecked={index === 0}
                            required
                          />
                          <span className="choice-body">
                            <span className="choice-main">
                              <strong className="mono">{order.orderNumber}</strong>
                              <span>残り {order.remaining} 台</span>
                            </span>
                            <span className="choice-sub">{order.shippingAddress}</span>
                            <span className="choice-sub">
                              注文日 {formatDate(order.orderedAt)}
                              {order.desiredDeliveryDate
                                ? `／納品希望日 ${order.desiredDeliveryDate}`
                                : ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="deliver-quantity">納品台数</label>
                    <input
                      id="deliver-quantity"
                      name="quantity"
                      type="number"
                      min={1}
                      step={1}
                      defaultValue={deliverOrders.length === 1 ? deliverOrders[0].remaining : ""}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="deliver-date">納品日</label>
                    <input
                      id="deliver-date"
                      name="deliveredAt"
                      type="date"
                      defaultValue={today}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="deliver-tracking">送り状番号（任意）</label>
                  <input id="deliver-tracking" name="trackingNumber" type="text" />
                </div>

                <div className="field">
                  <label htmlFor="deliver-note">備考（任意）</label>
                  <input id="deliver-note" name="note" type="text" />
                </div>

                <div className="action-row">
                  <SubmitButton className="btn btn-gold">納品を登録する</SubmitButton>
                  <Link href="/admin" className="btn btn-outline">
                    キャンセル
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}

        {deliverCompanyId && !deliverTarget && (
          <div className="modal-backdrop">
            <Link href="/admin" className="modal-scrim" aria-label="閉じる" />
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <h2 className="card-title">納品を登録</h2>
                <Link href="/admin" className="modal-close" aria-label="閉じる">
                  ×
                </Link>
              </div>
              <div className="empty-state">
                この発注元に納品待ちの注文はありません。
              </div>
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12.5, textAlign: "right", margin: 0 }}>
          データ保存先：
          {storage.mode === "postgres"
            ? "Postgres（接続済み）"
            : storage.ephemeral
              ? "一時領域（再起動で消えます）"
              : `ローカルファイル（${storage.directory ?? "未確定"}）`}
        </p>
      </div>
    </div>
  );
}
