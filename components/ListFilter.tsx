"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface FilterFieldDef {
  /** URLクエリのキー。複数選択はカンマ区切りで載る */
  name: string;
  label: string;
  /** 現在チェックされている値。空配列は「絞り込みなし（全件）」 */
  values: string[];
  options: { value: string; label: string }[];
  /** チェックボックスを1行に並べる個数 */
  columns?: 2 | 3;
}

/**
 * 一覧カード共通の絞り込み。
 * 「絞り込み」ボタンで条件を開閉し、チェックボックスを押した瞬間に適用する。
 * 複数チェックはOR条件。状態はURLに持つため、リロードや共有でも保たれる。
 */
export default function ListFilter({ fields }: { fields: FilterFieldDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const activeCount = fields.filter((f) => f.values.length > 0).length;
  const [open, setOpen] = useState(activeCount > 0);

  function toggle(name: string, value: string) {
    const params = new URLSearchParams();
    for (const f of fields) {
      const vals =
        f.name === name
          ? f.values.includes(value)
            ? f.values.filter((v) => v !== value)
            : [...f.values, value]
          : f.values;
      if (vals.length > 0) params.set(f.name, vals.join(","));
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <>
      <button
        type="button"
        className={`filter-toggle${activeCount > 0 ? " active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        絞り込み
        {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="filter-bar" style={isPending ? { opacity: 0.6 } : undefined}>
          {fields.map((f) => (
            <div className="filter-field" key={f.name}>
              <p className="filter-label">{f.label}</p>
              <div className={`filter-checks cols-${f.columns ?? 2}`}>
                {f.options.map((o) => (
                  <label className="filter-check" key={o.value}>
                    <input
                      type="checkbox"
                      checked={f.values.includes(o.value)}
                      onChange={() => toggle(f.name, o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {activeCount > 0 && (
            <div className="filter-actions">
              <Link href={pathname} className="link">
                解除
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
