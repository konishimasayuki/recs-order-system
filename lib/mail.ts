import { Order, PRODUCT_NAME, formatDateTime, yen } from "./types";

/**
 * 受注通知メール。RESEND_API_KEY が未設定のうちは何もしない。
 * メール運用を始めるときは Vercel の環境変数に以下を設定する。
 *   RESEND_API_KEY      … Resend のAPIキー
 *   RESEND_FROM_EMAIL   … ドメイン認証済みの送信元アドレス
 *   NOTIFY_EMAIL        … 受注通知の宛先（カンマ区切りで複数可）
 */
export function getMailConfig() {
  return {
    enabled: Boolean(process.env.RESEND_API_KEY),
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: (process.env.NOTIFY_EMAIL || "info@miamiholdings.co.jp")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
  };
}

/** Resend で送信する。成功なら null、失敗なら原因の文字列を返す（例外は投げない） */
async function sendMail(subject: string, html: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "RESEND_API_KEY が設定されていません。";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { from, to } = getMailConfig();

    const { data, error } = await resend.emails.send({
      from: `RECSGPS 注文システム <${from}>`,
      to,
      subject,
      html
    });

    if (error) {
      console.error("Resend send failed:", JSON.stringify(error));
      return `${error.name ?? "error"}: ${error.message ?? JSON.stringify(error)}`;
    }
    if (!data?.id) return "Resend から送信IDが返されませんでした。";
    return null;
  } catch (err) {
    console.error("sendMail failed:", err);
    return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
}

export async function notifyNewOrder(order: Order): Promise<void> {
  if (!getMailConfig().enabled) return;

  // メール失敗で注文自体を落とさない（原因はログに残す）
  const error = await sendMail(
    `【新規注文】${order.orderNumber} ${order.companyName}様（${order.quantity}台）`,
    `
      <div style="font-family: sans-serif; font-size: 14px; line-height: 1.7;">
        <h2>RECSGPS の新規注文が届きました</h2>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td><strong>注文番号</strong></td><td>${order.orderNumber}</td></tr>
          <tr><td><strong>注文日時</strong></td><td>${formatDateTime(order.orderedAt)}</td></tr>
          <tr><td><strong>発注元</strong></td><td>${order.companyName}</td></tr>
          <tr><td><strong>ご担当</strong></td><td>${order.contactName || "—"}</td></tr>
          <tr><td><strong>品名</strong></td><td>${PRODUCT_NAME}</td></tr>
          <tr><td><strong>台数</strong></td><td>${order.quantity} 台</td></tr>
          <tr><td><strong>単価（税込）</strong></td><td>${
            order.unitPrice === null ? "未確定" : yen(order.unitPrice)
          }</td></tr>
          <tr><td><strong>納品希望日</strong></td><td>${order.desiredDeliveryDate || "指定なし"}</td></tr>
          <tr><td><strong>納品先</strong></td><td>${order.shippingAddress.replace(/\n/g, "<br/>")}</td></tr>
          <tr><td><strong>備考</strong></td><td>${(order.note || "—").replace(/\n/g, "<br/>")}</td></tr>
        </table>
        <p>管理画面から単価入力・請求書発行・納品登録を行ってください。</p>
      </div>
    `
  );
  if (error) console.error("notifyNewOrder failed:", error);
}

/** 設定画面の「テストメールを送信する」から呼ぶ。失敗理由を画面に返す */
export async function sendTestMail(): Promise<string | null> {
  return sendMail(
    "【テスト】RECSGPS 注文システムの通知メール",
    `
      <div style="font-family: sans-serif; font-size: 14px; line-height: 1.7;">
        <p>これは RECSGPS 注文システムのテストメールです。</p>
        <p>このメールが届いていれば、受注通知メールの設定は正常です。</p>
        <p>送信日時：${formatDateTime(new Date().toISOString())}</p>
      </div>
    `
  );
}
