import type { Metadata } from "next";
import "./globals.css";

/**
 * 画面表示には端末標準の日本語フォントを使う。
 * public/fonts の Noto Sans JP を next/font で配信すると、
 * サブセット化されないTTFが約11MBそのまま端末へ送られ、
 * スマートフォンでは初回表示が実用にならないほど待たされる。
 * 同梱フォントは請求書PDFの生成（サーバー側）専用とする。
 */

export const metadata: Metadata = {
  title: "RECSGPS 注文システム",
  description: "RECSGPS（リモート始動阻止装置／GPS装置）の受発注管理システムです。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
