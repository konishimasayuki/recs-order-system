import AppHeader from "@/components/AppHeader";
import SubmitButton from "@/components/SubmitButton";
import { updateSellerAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { STORAGE_MODE, readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: { ok?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const seller = state.seller;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/settings" />

      <div className="container-narrow">
        {searchParams.ok === "saved" && (
          <div className="success-box">請求元情報を保存しました。</div>
        )}

        <form className="card" action={updateSellerAction}>
          <h2 className="card-title">請求元情報</h2>
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
              <input id="bankName" name="bankName" type="text" defaultValue={seller.bankName} />
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
                  {process.env.RESEND_API_KEY
                    ? "有効（Resend）"
                    : "未設定（RESEND_API_KEY を設定すると有効になります）"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
