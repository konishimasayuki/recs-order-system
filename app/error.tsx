"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * サーバー側で例外が出たときに Next.js が出す英語の
 * "Application error: a server-side exception has occurred" を置き換える。
 * 本番ビルドではメッセージがクライアントに渡らないため、
 * 突き合わせに使える digest と復旧手順を必ず表示する。
 */
export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[recsgps] page error:", error);
  }, [error]);

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-head">
          <p className="brand-eyebrow">RECSGPS ORDER SYSTEM</p>
          <h1 className="brand-title" style={{ marginBottom: 0 }}>
            エラーが発生しました
          </h1>
        </div>

        <div className="login-body">
          <div className="error-box">
            画面を表示できませんでした。時間をおいて再度お試しください。
          </div>

          <p className="muted" style={{ lineHeight: 1.8 }}>
            繰り返し表示される場合は、下のエラーIDを添えて管理者にご連絡ください。
            管理者は Vercel のログでこのIDを検索すると原因を特定できます。
          </p>

          {error.digest && (
            <p className="muted" style={{ marginTop: 8 }}>
              エラーID：<code>{error.digest}</code>
            </p>
          )}

          <div className="action-row" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-primary" onClick={() => reset()}>
              再読み込み
            </button>
            <Link href="/login" className="btn btn-outline">
              ログイン画面へ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
