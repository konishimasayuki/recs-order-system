import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { requireUser } from "@/lib/auth";
import { allOrders, rollupByCustomer, summarize } from "@/lib/queries";
import { getStorageStatus, readState } from "@/lib/store";
import { deliveredQuantity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireUser("admin");
  const state = await readState();
  // 保存先はデータへのアクセス後に確定するため readState() の後に取得する
  const storage = getStorageStatus();
  const orders = allOrders(state);
  const summary = summarize(orders, state.deliveries);
  const sellerIncomplete = !state.seller.address || !state.seller.registrationNumber;

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

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin" />

      <div className="container">
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
            <strong>請求元情報が未設定です</strong>
            <p>
              請求書PDFに住所・登録番号・振込先が印字されません。
              <Link href="/admin/settings?tab=seller" className="link">
                設定
              </Link>
              から入力してください。
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
