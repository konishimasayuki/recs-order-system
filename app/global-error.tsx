"use client";

import { useEffect } from "react";

/**
 * ルートレイアウト自体が落ちた場合の最後の受け皿。
 * app/error.tsx と違い html / body から自前で描画する必要があり、
 * globals.css も適用されないためスタイルは最小限にインラインで持つ。
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[recsgps] global error:", error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f5f7",
          color: "#1f2430",
          fontFamily:
            "system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif"
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: "32px 28px",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.08)"
          }}
        >
          <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>
            システムエラーが発生しました
          </h1>
          <p style={{ lineHeight: 1.8, margin: "0 0 16px" }}>
            時間をおいて再度お試しください。繰り返す場合は、下のエラーIDを添えて
            管理者にご連絡ください。
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
              エラーID：<code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: 6,
              background: "#1f2430",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
