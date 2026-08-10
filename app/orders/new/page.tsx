import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import QuantityField from "@/components/QuantityField";
import SubmitButton from "@/components/SubmitButton";
import { createOrderAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { PRODUCT_NAME } from "@/lib/types";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  quantity: "注文台数は1以上の整数で入力してください。",
  address: "納品先を入力してください。"
};

export default async function NewOrderPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const user = await requireUser("customer");
  const message = searchParams.error ? MESSAGES[searchParams.error] : null;

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/orders/new" />

      <div className="container-narrow">
        <Link href="/orders" className="back-link">
          ← ダッシュボードに戻る
        </Link>

        <form className="card" action={createOrderAction}>
          <h2 className="card-title">RECSGPS 新規注文</h2>
          <p className="card-desc">{PRODUCT_NAME}</p>

          {message && <div className="error-box">{message}</div>}

          <div className="info-box">
            <h4>発注元</h4>
            {user.companyName}（ID：{user.loginId}）
          </div>

          <QuantityField unitPrice={user.defaultUnitPrice} />

          <div className="field">
            <label htmlFor="shippingAddress">納品先</label>
            <textarea
              id="shippingAddress"
              name="shippingAddress"
              placeholder={"〒000-0000\n都道府県市区町村番地・建物名"}
              defaultValue={
                user.postalCode || user.address
                  ? `${user.postalCode}\n${user.address}`.trim()
                  : ""
              }
              required
            />
            <p className="field-hint">請求書の宛先住所としても使用されます。</p>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="contactName">ご担当者名</label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                placeholder="山田 太郎"
                defaultValue={user.contactName}
              />
            </div>

            <div className="field">
              <label htmlFor="email">連絡先メールアドレス</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="example@example.com"
                defaultValue={user.email}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="desiredDeliveryDate">納品希望日（任意）</label>
            <input id="desiredDeliveryDate" name="desiredDeliveryDate" type="date" />
          </div>

          <div className="field">
            <label htmlFor="note">備考（任意）</label>
            <textarea
              id="note"
              name="note"
              placeholder="ご要望・連絡事項がありましたらご記入ください。"
            />
          </div>

          <SubmitButton pendingLabel="送信中…">この内容で注文する</SubmitButton>

          <p className="field-hint" style={{ marginTop: 14 }}>
            ご注文後、MIAMIホールディングスにて単価確定・請求書発行を行います。
            部品の取得に2〜3週間かかる場合があります。
          </p>
        </form>
      </div>
    </div>
  );
}
