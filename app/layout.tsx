import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const notoSansJP = localFont({
  src: [
    { path: "../public/fonts/NotoSansJP-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/NotoSansJP-Bold.ttf", weight: "700", style: "normal" }
  ],
  variable: "--font-noto-sans-jp",
  display: "swap"
});

export const metadata: Metadata = {
  title: "RECSGPS 注文システム",
  description: "RECSGPS（リモート始動阻止装置／GPS装置）の受発注管理システムです。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={notoSansJP.variable}>{children}</body>
    </html>
  );
}
