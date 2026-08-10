import AppHeader from "@/components/AppHeader";
import SubmitButton from "@/components/SubmitButton";
import { createAccountAction, updateAccountAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { readState } from "@/lib/store";
import { formatDate, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

const OK_MESSAGES: Record<string, string> = {
  created: "発注アカウントを作成しました。",
  updated: "アカウント情報を更新しました。"
};

const ERROR_MESSAGES: Record<string, string> = {
  input: "ID・パスワード（4文字以上）・会社名は必須です。",
  duplicate: "そのIDはすでに使われています。別のIDを指定してください。"
};

export default async function AdminAccountsPage({
  searchParams
}: {
  searchParams: { ok?: string; error?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users
    .filter((u) => u.role === "customer")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const okMessage = searchParams.ok ? OK_MESSAGES[searchParams.ok] : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/accounts" />

      <div className="container">
        {okMessage && <div className="success-box">{okMessage}</div>}
        {errorMessage && <div className="error-box">{errorMessage}</div>}

        <form className="card" action={createAccountAction}>
          <h2 className="card-title">発注アカウントを追加する</h2>
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
              <p className="field-hint">4文字以上。発注先へ通知する値をそのまま入力します。</p>
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
              <input id="new-postalCode" name="postalCode" type="text" placeholder="〒000-0000" />
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

          <SubmitButton className="btn btn-gold">アカウントを作成する</SubmitButton>
        </form>

        <div className="card">
          <h2 className="card-title">登録済みの発注アカウント</h2>
          <p className="card-desc">{customers.length} 件</p>

          <div className="table-wrap">
            <table className="data-table" style={{ minWidth: 620 }}>
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
                  <tr key={c.id}>
                    <td className="mono">{c.loginId}</td>
                    <td>{c.companyName}</td>
                    <td className="num">
                      {c.defaultUnitPrice === null ? (
                        <span className="muted">未設定</span>
                      ) : (
                        yen(c.defaultUnitPrice)
                      )}
                    </td>
                    <td>
                      {c.active ? (
                        <span className="badge badge-delivered">有効</span>
                      ) : (
                        <span className="badge badge-cancelled">停止中</span>
                      )}
                    </td>
                    <td className="mono">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {customers.map((c) => (
          <form className="card" action={updateAccountAction} key={c.id}>
            <h2 className="card-title">{c.companyName} の設定</h2>
            <p className="card-desc">ログインID：{c.loginId}（IDは変更できません）</p>
            <input type="hidden" name="userId" value={c.id} />

            <div className="field-row">
              <div className="field">
                <label htmlFor={`companyName-${c.id}`}>会社名</label>
                <input
                  id={`companyName-${c.id}`}
                  name="companyName"
                  type="text"
                  defaultValue={c.companyName}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`unitPrice-${c.id}`}>標準単価（税込・円）</label>
                <input
                  id={`unitPrice-${c.id}`}
                  name="defaultUnitPrice"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={c.defaultUnitPrice ?? ""}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor={`contactName-${c.id}`}>ご担当者名</label>
                <input
                  id={`contactName-${c.id}`}
                  name="contactName"
                  type="text"
                  defaultValue={c.contactName}
                />
              </div>
              <div className="field">
                <label htmlFor={`email-${c.id}`}>メールアドレス</label>
                <input id={`email-${c.id}`} name="email" type="email" defaultValue={c.email} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor={`postalCode-${c.id}`}>郵便番号</label>
                <input
                  id={`postalCode-${c.id}`}
                  name="postalCode"
                  type="text"
                  defaultValue={c.postalCode}
                />
              </div>
              <div className="field">
                <label htmlFor={`tel-${c.id}`}>電話番号</label>
                <input id={`tel-${c.id}`} name="tel" type="text" defaultValue={c.tel} />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`address-${c.id}`}>住所</label>
              <input id={`address-${c.id}`} name="address" type="text" defaultValue={c.address} />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor={`newPassword-${c.id}`}>パスワードの再設定（任意）</label>
                <input
                  id={`newPassword-${c.id}`}
                  name="newPassword"
                  type="text"
                  placeholder="変更する場合のみ入力"
                />
                <p className="field-hint">4文字以上を入力すると上書きされます。</p>
              </div>
              <div className="field">
                <label htmlFor={`active-${c.id}`}>アカウント状態</label>
                <select id={`active-${c.id}`} name="active" defaultValue={c.active ? "1" : "0"}>
                  <option value="1">有効（ログインできる）</option>
                  <option value="0">停止（ログインできない）</option>
                </select>
              </div>
            </div>

            <SubmitButton className="btn btn-primary">この内容で更新する</SubmitButton>
          </form>
        ))}
      </div>
    </div>
  );
}
