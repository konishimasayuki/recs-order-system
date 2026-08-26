import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SubmitButton from "@/components/SubmitButton";
import Pagination, { clampPage } from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import {
  createAccountAction,
  deleteOrderAction,
  sendTestMailAction,
  updateAccountAction,
  updateSellerAction
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getMailConfig } from "@/lib/mail";
import { allOrders } from "@/lib/queries";
import { STORAGE_MODE, readState } from "@/lib/store";
import { deliveredQuantity, formatDate, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

const OK_MESSAGES: Record<string, string> = {
  created: "発注アカウントを作成しました。",
  updated: "アカウント情報を更新しました。",
  saved: "請求元情報を保存しました。"
};

const ERROR_MESSAGES: Record<string, string> = {
  input: "ID・パスワード（4文字以上）・会社名は必須です。",
  duplicate: "そのIDはすでに使われています。別のIDを指定してください。",
  notfound: "対象の注文が見つかりませんでした。すでに削除されている可能性があります。"
};

const ORDERS_PER_PAGE = 20;

/**
 * 設定のまとめ画面。利用頻度の低い設定系（発注アカウント・請求元情報）を
 * ヘッダーの「設定」タブ1つに集約し、ここでサブタブとして切り替える。
 */
export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: {
    tab?: string;
    mode?: string;
    select?: string;
    ok?: string;
    error?: string;
    mailtest?: string;
    number?: string;
    delete?: string;
    page?: string;
  };
}) {
  const user = await requireUser("admin");
  const mail = getMailConfig();
  const state = await readState();
  const seller = state.seller;
  const customers = state.users
    .filter((u) => u.role === "customer")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const tab =
    searchParams.tab === "seller"
      ? "seller"
      : searchParams.tab === "orders"
        ? "orders"
        : "accounts";
  const creating = searchParams.mode === "new";
  // 存在しないIDを指定された場合は未選択として扱う
  const selected = customers.find((c) => c.id === searchParams.select) ?? null;

  // 注文の削除タブ。1件ずつ確認してから消す
  const orders = allOrders(state);
  const ordersPage = clampPage(searchParams.page, orders.length, ORDERS_PER_PAGE);
  const pageOrders = orders.slice(
    (ordersPage - 1) * ORDERS_PER_PAGE,
    ordersPage * ORDERS_PER_PAGE
  );
  const deleteTarget = searchParams.delete
    ? orders.find((o) => o.id === searchParams.delete) ?? null
    : null;
  const deleteTargetDeliveries = deleteTarget
    ? state.deliveries.filter((d) => d.orderId === deleteTarget.id)
    : [];

  const okMessage =
    searchParams.ok === "deleted"
      ? `注文 ${searchParams.number ?? ""} を削除しました。この注文番号は次の注文で再び使われます。`
      : searchParams.ok
        ? OK_MESSAGES[searchParams.ok]
        : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/settings" />

      <div className="container">
        {okMessage && <div className="success-box">{okMessage}</div>}
        {errorMessage && <div className="error-box">{errorMessage}</div>}

        <div className="card">
          <nav className="card-tabs">
            <Link href="/admin/settings" className={tab === "accounts" ? "active" : ""}>
              発注アカウント
              <span className="count">{customers.length}</span>
            </Link>
            <Link
              href="/admin/settings?tab=seller"
              className={tab === "seller" ? "active" : ""}
            >
              請求元情報
            </Link>
            <Link
              href="/admin/settings?tab=orders"
              className={tab === "orders" ? "active" : ""}
            >
              注文の削除
            </Link>
          </nav>

          {tab === "orders" ? (
            <>
              <p className="card-desc">
                誤って作成した注文を1件ずつ削除します。紐づく納品記録も一緒に
                削除され、削除した注文番号は次の注文で再び使われます。
                取り消しはできません。
              </p>

              {orders.length === 0 ? (
                <div className="empty-state">削除できる注文はありません。</div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="data-table pair-cards">
                      <thead>
                        <tr>
                          <th>注文番号</th>
                          <th>発注元</th>
                          <th>注文日</th>
                          <th className="num">台数</th>
                          <th>状況</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageOrders.map((order) => {
                          const delivered = deliveredQuantity(order.id, state.deliveries);
                          return (
                            <tr key={order.id}>
                              <td className="mono" data-label="注文番号">
                                {order.orderNumber}
                              </td>
                              <td data-label="発注元">{order.companyName}</td>
                              <td className="mono" data-label="注文日">
                                {formatDate(order.orderedAt)}
                              </td>
                              <td className="num" data-label="台数">
                                {order.quantity} 台
                              </td>
                              <td data-label="状況">
                                <StatusBadge
                                  status={order.status}
                                  delivered={delivered}
                                  quantity={order.quantity}
                                />
                              </td>
                              <td className="row-action">
                                <Link
                                  href={`/admin/settings?tab=orders&page=${ordersPage}&delete=${order.id}`}
                                  className="btn btn-danger btn-sm"
                                >
                                  削除
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    total={orders.length}
                    page={ordersPage}
                    perPage={ORDERS_PER_PAGE}
                    basePath="/admin/settings"
                    params={{ tab: "orders" }}
                  />
                </>
              )}
            </>
          ) : tab === "seller" ? (
            <form action={updateSellerAction}>
              <p className="card-desc">
                ここで入力した内容が請求書PDFに印字されます。空欄の項目は印字されません。
              </p>

              <h3 className="section-heading">会社情報</h3>

              <div className="field">
                <label htmlFor="name">会社名</label>
                <input id="name" name="name" type="text" defaultValue={seller.name} required />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="postalCode">郵便番号</label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    placeholder="〒000-0000"
                    defaultValue={seller.postalCode}
                  />
                </div>
                <div className="field">
                  <label htmlFor="registrationNumber">インボイス登録番号</label>
                  <input
                    id="registrationNumber"
                    name="registrationNumber"
                    type="text"
                    placeholder="T0000000000000"
                    defaultValue={seller.registrationNumber}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="address">住所</label>
                <input id="address" name="address" type="text" defaultValue={seller.address} />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="tel">電話番号</label>
                  <input id="tel" name="tel" type="text" defaultValue={seller.tel} />
                </div>
                <div className="field">
                  <label htmlFor="fax">FAX番号</label>
                  <input id="fax" name="fax" type="text" defaultValue={seller.fax} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="contact">担当者名</label>
                <input id="contact" name="contact" type="text" defaultValue={seller.contact} />
              </div>

              <h3 className="section-heading">振込先</h3>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="bankName">金融機関名</label>
                  <input
                    id="bankName"
                    name="bankName"
                    type="text"
                    defaultValue={seller.bankName}
                  />
                </div>
                <div className="field">
                  <label htmlFor="branchName">支店名</label>
                  <input
                    id="branchName"
                    name="branchName"
                    type="text"
                    defaultValue={seller.branchName}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="accountType">口座種別</label>
                  <select id="accountType" name="accountType" defaultValue={seller.accountType}>
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="accountNumber">口座番号</label>
                  <input
                    id="accountNumber"
                    name="accountNumber"
                    type="text"
                    defaultValue={seller.accountNumber}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="accountHolder">口座名義</label>
                <input
                  id="accountHolder"
                  name="accountHolder"
                  type="text"
                  defaultValue={seller.accountHolder}
                />
              </div>

              <h3 className="section-heading">請求書の文言</h3>

              <div className="field">
                <label htmlFor="paymentTerms">お支払期限</label>
                <input
                  id="paymentTerms"
                  name="paymentTerms"
                  type="text"
                  defaultValue={seller.paymentTerms}
                />
              </div>

              <div className="field">
                <label htmlFor="invoiceNotice">注意書き</label>
                <textarea
                  id="invoiceNotice"
                  name="invoiceNotice"
                  defaultValue={seller.invoiceNotice}
                />
                <p className="field-hint">請求書下部の赤枠に表示されます。</p>
              </div>

              <SubmitButton className="btn btn-gold">請求元情報を保存する</SubmitButton>
            </form>
          ) : creating ? (
            <form action={createAccountAction}>
              <p className="card-desc">
                発注企業ごとにIDとパスワードを発行します。標準単価を設定すると、
                その会社の注文画面に金額が表示され、新規注文の単価に自動で反映されます。
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="new-loginId">ログインID</label>
                  <input
                    id="new-loginId"
                    name="loginId"
                    type="text"
                    autoCapitalize="off"
                    spellCheck={false}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="new-password">パスワード</label>
                  <input id="new-password" name="password" type="text" minLength={4} required />
                  <p className="field-hint">
                    4文字以上。発注先へ通知する値をそのまま入力します。
                  </p>
                </div>
              </div>

              <div className="field">
                <label htmlFor="new-companyName">会社名</label>
                <input id="new-companyName" name="companyName" type="text" required />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="new-contactName">ご担当者名（任意）</label>
                  <input id="new-contactName" name="contactName" type="text" />
                </div>
                <div className="field">
                  <label htmlFor="new-email">メールアドレス（任意）</label>
                  <input id="new-email" name="email" type="email" />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="new-postalCode">郵便番号（任意）</label>
                  <input
                    id="new-postalCode"
                    name="postalCode"
                    type="text"
                    placeholder="〒000-0000"
                  />
                </div>
                <div className="field">
                  <label htmlFor="new-tel">電話番号（任意）</label>
                  <input id="new-tel" name="tel" type="text" />
                </div>
              </div>

              <div className="field">
                <label htmlFor="new-address">住所（任意）</label>
                <input id="new-address" name="address" type="text" />
              </div>

              <div className="field">
                <label htmlFor="new-unitPrice">標準単価（税込・円／任意）</label>
                <input id="new-unitPrice" name="defaultUnitPrice" type="number" min={0} step={1} />
                <p className="field-hint">
                  未入力の場合、注文時の金額は「単価確定後にご案内」と表示されます。
                </p>
              </div>

              <div className="action-row">
                <SubmitButton className="btn btn-gold">アカウントを作成する</SubmitButton>
                <Link href="/admin/settings" className="btn btn-outline">
                  一覧に戻る
                </Link>
              </div>
            </form>
          ) : customers.length === 0 ? (
            <div className="empty-state">
              発注アカウントがまだありません。
              <br />
              <Link href="/admin/settings?mode=new" className="link">
                新規追加から作成する
              </Link>
            </div>
          ) : (
            <>
              <div className="card-head">
                <div className="card-head-text">
                  <p className="card-desc">
                    会社を選ぶと、その会社の設定が下に表示されます。
                  </p>
                </div>
                <Link href="/admin/settings?mode=new" className="btn btn-gold btn-sm">
                  ＋ 新規追加
                </Link>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>会社名</th>
                      <th className="num">標準単価</th>
                      <th>状態</th>
                      <th>登録日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        className={`selectable${selected?.id === c.id ? " is-selected" : ""}`}
                      >
                        <td className="mono" data-label="ID">{c.loginId}</td>
                        <td data-label="会社名">
                          <Link
                            href={`/admin/settings?select=${c.id}`}
                            className="row-link"
                            aria-current={selected?.id === c.id ? "true" : undefined}
                          >
                            {c.companyName}
                          </Link>
                        </td>
                        <td className="num" data-label="標準単価">
                          {c.defaultUnitPrice === null ? (
                            <span className="muted">未設定</span>
                          ) : (
                            yen(c.defaultUnitPrice)
                          )}
                        </td>
                        <td data-label="状態">
                          {c.active ? (
                            <span className="badge badge-delivered">有効</span>
                          ) : (
                            <span className="badge badge-cancelled">停止中</span>
                          )}
                        </td>
                        <td className="mono" data-label="登録日">
                          {formatDate(c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {tab === "accounts" && !creating && selected && (
          <form className="card" action={updateAccountAction} key={selected.id}>
            <div className="selection-head">
              <div>
                <h2 className="card-title">{selected.companyName} の設定</h2>
                <p className="card-desc">
                  ログインID：{selected.loginId}（IDは変更できません）
                </p>
              </div>
              <Link href="/admin/settings" className="link">
                選択を解除
              </Link>
            </div>
            <input type="hidden" name="userId" value={selected.id} />

            <div className="field-row">
              <div className="field">
                <label htmlFor={`companyName-${selected.id}`}>会社名</label>
                <input
                  id={`companyName-${selected.id}`}
                  name="companyName"
                  type="text"
                  defaultValue={selected.companyName}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`unitPrice-${selected.id}`}>標準単価（税込・円）</label>
                <input
                  id={`unitPrice-${selected.id}`}
                  name="defaultUnitPrice"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={selected.defaultUnitPrice ?? ""}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor={`contactName-${selected.id}`}>ご担当者名</label>
                <input
                  id={`contactName-${selected.id}`}
                  name="contactName"
                  type="text"
                  defaultValue={selected.contactName}
                />
              </div>
              <div className="field">
                <label htmlFor={`email-${selected.id}`}>メールアドレス</label>
                <input
                  id={`email-${selected.id}`}
                  name="email"
                  type="email"
                  defaultValue={selected.email}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor={`postalCode-${selected.id}`}>郵便番号</label>
                <input
                  id={`postalCode-${selected.id}`}
                  name="postalCode"
                  type="text"
                  defaultValue={selected.postalCode}
                />
              </div>
              <div className="field">
                <label htmlFor={`tel-${selected.id}`}>電話番号</label>
                <input
                  id={`tel-${selected.id}`}
                  name="tel"
                  type="text"
                  defaultValue={selected.tel}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`address-${selected.id}`}>住所</label>
              <input
                id={`address-${selected.id}`}
                name="address"
                type="text"
                defaultValue={selected.address}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor={`newPassword-${selected.id}`}>
                  パスワードの再設定（任意）
                </label>
                <input
                  id={`newPassword-${selected.id}`}
                  name="newPassword"
                  type="text"
                  placeholder="変更する場合のみ入力"
                />
                <p className="field-hint">4文字以上を入力すると上書きされます。</p>
              </div>
              <div className="field">
                <label htmlFor={`active-${selected.id}`}>アカウント状態</label>
                <select
                  id={`active-${selected.id}`}
                  name="active"
                  defaultValue={selected.active ? "1" : "0"}
                >
                  <option value="1">有効（ログインできる）</option>
                  <option value="0">停止（ログインできない）</option>
                </select>
              </div>
            </div>

            <SubmitButton className="btn btn-primary">この内容で更新する</SubmitButton>
          </form>
        )}

        {tab === "accounts" && !creating && !selected && customers.length > 0 && (
          <div className="card">
            <div className="empty-state">
              上の一覧から会社を選ぶと、標準単価・担当者・パスワードなどの設定が
              ここに表示されます。
            </div>
          </div>
        )}

        {tab === "seller" && (
          <div className="card">
            <h2 className="card-title">システム情報</h2>
            <table className="detail-table">
              <tbody>
                <tr>
                  <th>データ保存先</th>
                  <td>
                    {STORAGE_MODE === "postgres"
                      ? "Postgres（本番）"
                      : "ローカルファイル（.data/state.json）"}
                  </td>
                </tr>
                <tr>
                  <th>受注通知メール</th>
                  <td>
                    {mail.enabled
                      ? "有効（Resend）"
                      : "未設定（RESEND_API_KEY を設定すると有効になります）"}
                  </td>
                </tr>
                {mail.enabled && (
                  <>
                    <tr>
                      <th>送信元</th>
                      <td className="mono">{mail.from}</td>
                    </tr>
                    <tr>
                      <th>通知先</th>
                      <td className="mono">{mail.to.join(", ")}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {mail.enabled && (
              <>
                {searchParams.mailtest === "ok" && (
                  <div className="success-box" style={{ marginTop: 16 }}>
                    テストメールを送信しました。{mail.to.join(", ")}{" "}
                    の受信箱（迷惑メールフォルダも）をご確認ください。
                  </div>
                )}
                {searchParams.mailtest && searchParams.mailtest !== "ok" && (
                  <div className="error-box" style={{ marginTop: 16 }}>
                    送信に失敗しました：{searchParams.mailtest}
                  </div>
                )}
                <form action={sendTestMailAction} style={{ marginTop: 16 }}>
                  <SubmitButton className="btn btn-outline">
                    テストメールを送信する
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
        )}

        {deleteTarget && (
          <div className="modal-backdrop">
            <Link
              href={`/admin/settings?tab=orders&page=${ordersPage}`}
              className="modal-scrim"
              aria-label="閉じる"
            />
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <h2 className="card-title">この注文を削除しますか？</h2>
                <Link
                  href={`/admin/settings?tab=orders&page=${ordersPage}`}
                  className="modal-close"
                  aria-label="閉じる"
                >
                  ×
                </Link>
              </div>

              <table className="detail-table">
                <tbody>
                  <tr>
                    <th>注文番号</th>
                    <td className="mono">{deleteTarget.orderNumber}</td>
                  </tr>
                  <tr>
                    <th>発注元</th>
                    <td>{deleteTarget.companyName}</td>
                  </tr>
                  <tr>
                    <th>注文日</th>
                    <td className="mono">{formatDate(deleteTarget.orderedAt)}</td>
                  </tr>
                  <tr>
                    <th>台数</th>
                    <td>{deleteTarget.quantity} 台</td>
                  </tr>
                  <tr>
                    <th>納品記録</th>
                    <td>
                      {deleteTargetDeliveries.length > 0
                        ? `${deleteTargetDeliveries.length} 件（一緒に削除されます）`
                        : "なし"}
                    </td>
                  </tr>
                  <tr>
                    <th>請求書</th>
                    <td className="mono">
                      {deleteTarget.invoiceNumber ?? "未発行"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="notice-inline" style={{ marginTop: 16 }}>
                削除すると元に戻せません。注文番号{" "}
                {deleteTarget.orderNumber} は次の注文で再び使われます。
                {deleteTarget.invoiceNumber
                  ? `発行済みの請求書 ${deleteTarget.invoiceNumber} も無効になります。`
                  : ""}
              </div>

              <form action={deleteOrderAction}>
                <input type="hidden" name="orderId" value={deleteTarget.id} />
                <div className="action-row">
                  <SubmitButton className="btn btn-danger">
                    この注文を削除する
                  </SubmitButton>
                  <Link
                    href={`/admin/settings?tab=orders&page=${ordersPage}`}
                    className="btn btn-outline"
                  >
                    キャンセル
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
