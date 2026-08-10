import Link from "next/link";

/**
 * 一覧のページ送り。件数が増え続けても1ページの表示量を一定に保つ。
 * 絞り込み条件（params）を保ったままページだけを切り替える。
 * 1ページに収まるときは何も表示しない。
 */
export default function Pagination({
  total,
  page,
  perPage,
  basePath,
  params
}: {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v && v !== "all") q.set(k, v);
    }
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="pagination">
      {page > 1 ? (
        <Link className="btn btn-outline btn-sm" href={href(page - 1)}>
          ← 前へ
        </Link>
      ) : (
        <span className="btn btn-outline btn-sm is-disabled">← 前へ</span>
      )}
      <span className="muted">
        {total.toLocaleString("ja-JP")} 件中 {from}–{to} 件目
      </span>
      {page < pages ? (
        <Link className="btn btn-outline btn-sm" href={href(page + 1)}>
          次へ →
        </Link>
      ) : (
        <span className="btn btn-outline btn-sm is-disabled">次へ →</span>
      )}
    </div>
  );
}

/** searchParams のページ番号を 1〜最終ページに収める */
export function clampPage(raw: string | undefined, total: number, perPage: number): number {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const n = Number(raw) || 1;
  return Math.min(Math.max(1, Math.floor(n)), pages);
}
